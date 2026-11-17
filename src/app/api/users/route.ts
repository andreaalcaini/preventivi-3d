import { NextRequest, NextResponse } from 'next/server';
import { logActivity } from '@/lib/activity';
import {
  verifySessionToken,
  SESSION_COOKIE_NAME,
  getAllPublicUsers,
  getUserById,
  createUser,
  updateUserPassword,
  setUserApiKeyPermission,
  deleteUser,
  type User,
} from '@/lib/auth';

/** Utente della sessione letto dal file utenti, così il ruolo è sempre quello attuale. */
function getActor(request: NextRequest): User | null {
  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  return session ? getUserById(session.userId) : null;
}

const unauthorized = () => NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
const adminOnly = () => NextResponse.json({ error: 'Operazione riservata agli amministratori' }, { status: 403 });

export async function GET(request: NextRequest) {
  const actor = getActor(request);
  if (!actor) return unauthorized();
  return NextResponse.json({ users: getAllPublicUsers(), actor: { id: actor.id, role: actor.role } });
}

export async function POST(request: NextRequest) {
  const actor = getActor(request);
  if (!actor) return unauthorized();
  if (actor.role !== 'admin') return adminOnly();

  try {
    const body = await request.json();
    const result = createUser(body);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    logActivity(actor.username, 'utenti', result.user?.id || '', `Creato utente @${result.user?.username} (${result.user?.role})`);
    return NextResponse.json({ success: true, user: result.user });
  } catch {
    return NextResponse.json({ error: 'Errore creazione utente' }, { status: 500 });
  }
}

/**
 * PATCH { userId, newPassword }: cambio password (la propria, oppure di chiunque se amministratore).
 * PATCH { userId, canCreateApiKeys }: concede o revoca la creazione di chiavi API (solo amministratori).
 */
export async function PATCH(request: NextRequest) {
  const actor = getActor(request);
  if (!actor) return unauthorized();

  try {
    const body = await request.json();
    const { userId } = body ?? {};
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    if (typeof body.canCreateApiKeys === 'boolean') {
      if (actor.role !== 'admin') return adminOnly();
      const result = setUserApiKeyPermission(userId, body.canCreateApiKeys);
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 404 });
      logActivity(actor.username, 'utenti', userId, `${body.canCreateApiKeys ? 'Concesso' : 'Revocato'} permesso chiavi API a ${getUserById(userId)?.username || userId}`);
      return NextResponse.json({ success: true });
    }

    if (typeof body.newPassword === 'string') {
      if (actor.role !== 'admin' && actor.id !== userId) return adminOnly();
      const result = updateUserPassword(userId, body.newPassword);
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
      logActivity(actor.username, 'utenti', userId, `Password cambiata per ${getUserById(userId)?.username || userId}`);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Errore aggiornamento utente' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const actor = getActor(request);
  if (!actor) return unauthorized();
  if (actor.role !== 'admin') return adminOnly();

  try {
    const userId = new URL(request.url).searchParams.get('id');
    if (!userId) return NextResponse.json({ error: 'ID utente richiesto' }, { status: 400 });
    if (userId === actor.id) {
      return NextResponse.json({ error: 'Non puoi eliminare il tuo stesso account' }, { status: 400 });
    }
    const removed = getUserById(userId);
    const result = deleteUser(userId);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    logActivity(actor.username, 'utenti', userId, `Eliminato utente @${removed?.username || userId}`);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Errore eliminazione utente' }, { status: 500 });
  }
}
