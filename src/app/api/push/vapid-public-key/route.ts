import { NextResponse } from 'next/server';
import { getVapidKeys } from '@/lib/push';

export async function GET() {
  try {
    const keys = getVapidKeys();
    return NextResponse.json({
      publicKey: keys.publicKey,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Impossibile recuperare la chiave pubblica VAPID', details: String(err) },
      { status: 500 }
    );
  }
}
