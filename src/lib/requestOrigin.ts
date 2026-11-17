import type { NextRequest } from 'next/server';

/** Origine pubblica della richiesta, anche dietro tunnel o reverse proxy (SITE_URL ha la precedenza). */
export function requestOrigin(request: NextRequest): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host;
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0] || (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto}://${host}`;
}
