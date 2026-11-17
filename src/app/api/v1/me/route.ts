import { NextRequest, NextResponse } from 'next/server';
import { getKeyContext } from '@/lib/keyContext';
import { verifySessionToken, SESSION_COOKIE_NAME, getUserById } from '@/lib/auth';
import { RESOURCES, accessFor, ALL_SCOPES, scopeAllowedForRole } from '@/lib/apiScopes';

/**
 * GET /api/v1/me: chi sta chiamando e cosa può fare.
 * Utile agli agenti AI per scoprire i propri permessi prima di usare gli altri strumenti.
 */
export async function GET(request: NextRequest) {
  const key = getKeyContext(request);
  if (key) {
    return NextResponse.json({
      type: 'api_key',
      key: { id: key.id, name: key.name, expiresAt: key.expiresAt, rateLimitPerMinute: key.rateLimitPerMinute },
      owner: { id: key.ownerId, username: key.ownerUsername, role: key.ownerRole },
      scopes: key.scopes,
      permissions: Object.fromEntries(RESOURCES.map(r => [r.id, accessFor(key.scopes, r.id)])),
    });
  }

  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const user = session ? getUserById(session.userId) : null;
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  const scopes = ALL_SCOPES.filter(s => scopeAllowedForRole(s, user.role));
  return NextResponse.json({
    type: 'session',
    owner: { id: user.id, username: user.username, role: user.role },
    scopes,
    permissions: Object.fromEntries(RESOURCES.map(r => [r.id, accessFor(scopes, r.id)])),
  });
}
