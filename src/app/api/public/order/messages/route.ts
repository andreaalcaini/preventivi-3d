import { NextRequest, NextResponse } from 'next/server';
import { readQuotes } from '@/lib/labData';
import { getMessages, addMessage, markRead, allowPublicMessage } from '@/lib/orderMessages';
import { broadcastLabNotification } from '@/lib/notification-bus';
import { sendPushNotificationToAll } from '@/lib/push';

/** Il codice ordine è la "chiave" del cliente: senza un codice esistente non si legge né si scrive nulla. */
function findOrder(code: string | null | undefined) {
  const id = String(code || '').trim().toUpperCase();
  if (!id) return null;
  return readQuotes().find(q => String(q.id).toUpperCase() === id) || null;
}

const publicView = (orderId: string) =>
  getMessages(orderId).map(m => ({ id: m.id, author: m.author, authorName: m.authorName, text: m.text, at: m.at }));

/** GET /api/public/order/messages?code=ID: conversazione dell'ordine; segna come letti i messaggi del laboratorio. */
export async function GET(request: NextRequest) {
  const order = findOrder(request.nextUrl.searchParams.get('code'));
  if (!order) return NextResponse.json({ error: 'Ordine non trovato' }, { status: 404 });
  markRead(String(order.id), 'cliente');
  return NextResponse.json({ messages: publicView(String(order.id)) }, { headers: { 'Cache-Control': 'no-store' } });
}

/** POST /api/public/order/messages { code, text }: messaggio del cliente al laboratorio. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const order = findOrder(body?.code);
  if (!order) return NextResponse.json({ error: 'Ordine non trovato' }, { status: 404 });

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'sconosciuto';
  if (!allowPublicMessage(`${ip}:${order.id}`)) {
    return NextResponse.json({ error: 'Hai inviato molti messaggi: riprova tra qualche minuto' }, { status: 429 });
  }

  const result = addMessage({
    orderId: String(order.id),
    author: 'cliente',
    authorName: order.clientName || 'Cliente',
    text: String(body?.text ?? ''),
  });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const preview = result.message.text.length > 90 ? `${result.message.text.slice(0, 90)}…` : result.message.text;
  try {
    broadcastLabNotification({
      type: 'order_message',
      title: 'Nuovo messaggio dal cliente',
      projectName: `${order.name}: ${preview}`,
      clientName: order.clientName || 'Cliente',
      clientContact: '',
      totalCalculated: 0,
      material: '',
      dateStr: new Date().toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      trackingUrl: `/ordine?code=${order.id}`,
    });
  } catch { /* l'avviso in-app non deve bloccare l'invio */ }
  try {
    await sendPushNotificationToAll({
      title: `Messaggio da ${order.clientName || 'un cliente'}`,
      body: `${order.name}: ${preview}`,
      url: '/preventivi',
      tag: `msg-${order.id}`,
    });
  } catch { /* push facoltative */ }

  return NextResponse.json({ messages: publicView(String(order.id)) }, { status: 201 });
}
