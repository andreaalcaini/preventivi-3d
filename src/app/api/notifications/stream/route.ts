import { subscribeToLabNotifications } from '@/lib/notification-bus';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let keepAliveTimer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Evento iniziale di connessione riuscita
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: 'connected', timestamp: Date.now() })}\n\n`)
      );

      // Ascolto eventi da broadcastLabNotification
      unsubscribe = subscribeToLabNotifications((notification) => {
        try {
          const data = `event: quote\ndata: ${JSON.stringify(notification)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          // Il client si è disconnesso
        }
      });

      // Heartbeat periodico per mantenere attiva la connessione SSE
      keepAliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          // Errore invio heartbeat
        }
      }, 25000);
    },
    cancel() {
      if (unsubscribe) {
        unsubscribe();
      }
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
