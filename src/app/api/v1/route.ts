import { NextRequest, NextResponse } from 'next/server';
import pkg from '../../../../package.json';

/** GET /api/v1: indice dell'API con i collegamenti utili. */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  return NextResponse.json({
    name: 'Preventivi 3D API',
    version: pkg.version,
    openapi: `${origin}/api/public/openapi.json`,
    me: `${origin}/api/v1/me`,
    endpoints: [
      'GET /api/v1/quotes', 'POST /api/v1/quotes', 'GET /api/v1/quotes/{id}', 'PATCH /api/v1/quotes/{id}',
      'GET /api/v1/clients', 'GET /api/v1/inventory', 'PATCH /api/v1/inventory/spools/{id}',
      'GET /api/v1/maintenance', 'GET /api/v1/analytics',
    ],
  });
}
