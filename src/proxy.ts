import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { extractApiKey, authorizeApiKey, clientIp } from '@/lib/apiKeys';

const PUBLIC_PATHS = ['/login', '/ordine', '/richiedi-preventivo'];
const PUBLIC_API_PREFIXES = ['/api/auth/login', '/api/public/', '/api/makerworld'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permetti asset statici e favicon
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    (!pathname.startsWith('/api/') && pathname.includes('.')) // favicon.ico, immagini, file statici (mai le API)
  ) {
    return NextResponse.next();
  }

  // Permetti percorsi pubblici dell'area cliente e login
  const isPublicPage = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`));
  const isPublicApi = PUBLIC_API_PREFIXES.some(p => pathname.startsWith(p));

  if (isPublicPage || isPublicApi) {
    // Se l'utente è già loggato e cerca di andare su /login, reindirizza alla home del venditore
    if (pathname === '/login') {
      const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
      if (verifySessionToken(token)) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
    return NextResponse.next();
  }

  // Le intestazioni interne x-p3d-* le imposta solo il proxy: quelle in ingresso vengono scartate
  const forwarded = new Headers(request.headers);
  for (const name of [...forwarded.keys()]) {
    if (name.startsWith('x-p3d-')) forwarded.delete(name);
  }

  // Integrazioni esterne: chiave API in Authorization: Bearer p3d_... o X-API-Key
  const apiKey = extractApiKey(request.headers);
  if (apiKey) {
    const check = authorizeApiKey(apiKey, pathname, request.method, clientIp(request.headers));
    if (!check.ok) {
      const res = NextResponse.json({ error: check.error }, { status: check.status });
      if (check.retryAfter) res.headers.set('Retry-After', String(check.retryAfter));
      if (check.rate) {
        res.headers.set('X-RateLimit-Limit', String(check.rate.limit));
        res.headers.set('X-RateLimit-Remaining', String(check.rate.remaining));
      }
      return res;
    }
    forwarded.set('x-p3d-key', encodeURIComponent(JSON.stringify(check.key)));
    const res = NextResponse.next({ request: { headers: forwarded } });
    res.headers.set('X-RateLimit-Limit', String(check.rate.limit));
    res.headers.set('X-RateLimit-Remaining', String(check.rate.remaining));
    return res;
  }

  // Per tutte le altre rotte (calcolatore, preventivi, clienti, magazzino, utenti), verifica autenticazione
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({ request: { headers: forwarded } });
}

export const config = {
  matcher: [
    /*
     * Applica a tutte le richieste tranne _next/static, _next/image, favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
