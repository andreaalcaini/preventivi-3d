import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME, getUserById } from '@/lib/auth';
import { readQuotes } from '@/lib/labData';
import { getMessages, addMessage, markRead, summaryByOrder } from '@/lib/orderMessages';

function getActor(request: NextRequest) {
  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  return session ? getUserById(session.userId) : null;
}

/**
 * GET /api/order-messages: riepilogo per ordine (totale, non letti).
 * GET /api/order-messages?id=ID: conversazione completa; la segna come letta dal laboratorio.
 */
export async function GET(request: NextRequest) {
  if (!getActor(request)) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ summary: summaryByOrder() }, { headers: { 'Cache-Control': 'no-store' } });
  markRead(id, 'laboratorio');
  return NextResponse.json({ messages: getMessages(id) }, { headers: { 'Cache-Control': 'no-store' } });
}

/** POST /api/order-messages { id, text }: risposta del laboratorio, visibile al cliente nel tracking. */
export async function POST(request: NextRequest) {
  const actor = getActor(request);
  if (!actor) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const id = String(body?.id || '');
  if (!readQuotes().some(q => String(q.id) === id)) {
    return NextResponse.json({ error: 'Ordine non trovato' }, { status: 404 });
  }
  const result = addMessage({ orderId: id, author: 'laboratorio', authorName: actor.displayName || 'Laboratorio', text: String(body?.text ?? '') });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
  markRead(id, 'laboratorio');
  return NextResponse.json({ messages: getMessages(id) }, { status: 201 });
}
