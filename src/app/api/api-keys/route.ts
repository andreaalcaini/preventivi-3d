import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME, getAllPublicUsers, getUserById, userCanManageApiKeys } from '@/lib/auth';
import {
  listApiKeys, createApiKey, updateApiKey, rotateApiKey, revokeApiKey, deleteApiKey, type Actor,
} from '@/lib/apiKeys';

/** Utente della sessione con il ruolo aggiornato dal file utenti (non quello memorizzato nel token). */
function getActor(request: NextRequest): Actor | null {
  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return null;
  const user = getUserById(session.userId);
  return user ? { id: user.id, username: user.username, role: user.role, canCreateApiKeys: userCanManageApiKeys(user) } : null;
}

const unauthorized = () => NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

export async function GET(request: NextRequest) {
  const actor = getActor(request);
  if (!actor) return unauthorized();
  return NextResponse.json({
    actor,
    keys: listApiKeys(actor),
    users: actor.role === 'admin'
      ? getAllPublicUsers().map(u => ({ id: u.id, username: u.username, displayName: u.displayName, role: u.role, canCreateApiKeys: userCanManageApiKeys(u) }))
      : [],
  });
}

export async function POST(request: NextRequest) {
  const actor = getActor(request);
  if (!actor) return unauthorized();
  if (!actor.canCreateApiKeys) {
    return NextResponse.json({ error: 'Non hai il permesso di creare chiavi API: chiedilo a un amministratore' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 });
  const result = createApiKey(actor, body);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}

/** PATCH { id, action: "update" | "rotate" | "revoke", ...campi } */
export async function PATCH(request: NextRequest) {
  const actor = getActor(request);
  if (!actor) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== 'string') return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 });

  if (body.action === 'revoke') {
    if (!revokeApiKey(actor, body.id)) return NextResponse.json({ error: 'Chiave non trovata o già revocata' }, { status: 404 });
    return NextResponse.json({ success: true });
  }
  if (body.action === 'rotate') {
    const r = rotateApiKey(actor, body.id);
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json(r);
  }
  if (body.action === 'update') {
    const { id, action: _action, ownerId: _owner, ...fields } = body;
    const r = updateApiKey(actor, id, fields);
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json(r);
  }
  return NextResponse.json({ error: 'Azione non valida' }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const actor = getActor(request);
  if (!actor) return unauthorized();
  const id = request.nextUrl.searchParams.get('id');
  if (!id || !deleteApiKey(actor, id)) return NextResponse.json({ error: 'Chiave non trovata' }, { status: 404 });
  return NextResponse.json({ success: true });
}
