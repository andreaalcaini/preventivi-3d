import { NextRequest, NextResponse } from 'next/server';
import { saveSubscription, removeSubscription, getStoredSubscriptions } from '@/lib/push';

export async function GET() {
  const subscriptions = getStoredSubscriptions();
  return NextResponse.json({
    activeSubscriptionsCount: subscriptions.length,
    devices: subscriptions.map(s => ({
      userAgent: s.userAgent,
      subscribedAt: s.subscribedAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { error: 'Dati di sottoscrizione non validi' },
        { status: 400 }
      );
    }

    const userAgent = request.headers.get('user-agent') || 'Dispositivo Sconosciuto';
    saveSubscription(subscription, userAgent);

    return NextResponse.json({
      success: true,
      message: 'Dispositivo registrato con successo per le notifiche push!',
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Errore durante la registrazione della sottoscrizione', details: String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint non specificato' },
        { status: 400 }
      );
    }

    removeSubscription(endpoint);

    return NextResponse.json({
      success: true,
      message: 'Dispositivo rimosso dalle notifiche push',
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Errore durante la rimozione', details: String(err) },
      { status: 500 }
    );
  }
}
