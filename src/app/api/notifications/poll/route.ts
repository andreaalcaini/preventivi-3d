import { NextRequest, NextResponse } from 'next/server';
import { getRecentLabNotifications } from '@/lib/notification-bus';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const since = Number(searchParams.get('since')) || 0;

  const recent = getRecentLabNotifications(10);
  const filtered = since > 0 ? recent.filter(n => n.timestamp > since) : recent;

  return NextResponse.json({
    notifications: filtered,
    serverTime: Date.now(),
  });
}
