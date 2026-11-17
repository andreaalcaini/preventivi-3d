import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { extractApiKey, authorizeApiKey } from '@/lib/apiKeys';

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

  // Integrazioni esterne: chiave API in Authorization: Bearer p3d_... o X-API-Key
  const apiKey = extractApiKey(request.headers);
  if (apiKey) {
    const check = authorizeApiKey(apiKey, pathname, request.method);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status });
    }
    const headers = new Headers(request.headers);
    headers.set('x-p3d-api-key-id', check.key.id);
    headers.set('x-p3d-api-key-scope', check.key.scope);
    return NextResponse.next({ request: { headers } });
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Applica a tutte le richieste tranne _next/static, _next/image, favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
