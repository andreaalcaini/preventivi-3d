import { NextResponse } from 'next/server';
import { sendPushNotificationToAll } from '@/lib/push';
import { broadcastLabNotification } from '@/lib/notification-bus';

export async function POST() {
  try {
    const nowStr = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    // 1. Broadcast per il popup in-app sul sito aperto
    const labItem = broadcastLabNotification({
      type: 'quote_request',
      title: 'Notifica di Prova!',
      projectName: 'Test Stampante 3D',
      clientName: 'Andrea (Maker)',
      clientContact: 'andrea@lab.local',
      totalCalculated: 18.50,
      material: 'PETG Carbon',
      dateStr: nowStr,
      trackingUrl: '/preventivi',
    });

    // 2. Invio Web Push allo smartphone
    const pushResult = await sendPushNotificationToAll({
      title: 'Test Notifiche PWA 3D!',
      body: `Le notifiche push del tuo laboratorio funzionano perfettamente (${nowStr})!`,
      url: '/preventivi',
      tag: 'test-notification',
    });

    return NextResponse.json({
      success: true,
      message: 'Notifica di test inviata con successo!',
      pushResult,
      toastEmitted: labItem,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Errore durante l\'invio del test', details: String(err) },
      { status: 500 }
    );
  }
}
