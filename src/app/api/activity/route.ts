import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { readActivity } from '@/lib/activity';

/** GET /api/activity?area=lavori&q=testo&limit=200: registro attività, dal più recente. */
export async function GET(request: NextRequest) {
  if (!verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }
  const sp = request.nextUrl.searchParams;
  const area = sp.get('area');
  const q = sp.get('q')?.toLowerCase();
  const ref = sp.get('ref');
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 200, 1), 2000);
  const items = readActivity()
    .filter(e => (area ? e.area === area : true))
    .filter(e => (ref ? e.ref === ref : true))
    .filter(e => (q ? `${e.user} ${e.text}`.toLowerCase().includes(q) : true))
    .slice(0, limit);
  return NextResponse.json({ items });
}
