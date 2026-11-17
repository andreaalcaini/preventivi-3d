import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifySessionToken, SESSION_COOKIE_NAME, getUserById } from '@/lib/auth';
import { readQuotes, writeQuotes } from '@/lib/labData';
import { autoSchedule, type ProductionQuote, type ProductionInfo } from '@/lib/production';
import { logActivity } from '@/lib/activity';

/** POST /api/production/schedule: pianifica automaticamente i lavori in coda sulle stampanti operative. */
export async function POST(request: NextRequest) {
  const s = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const user = s ? getUserById(s.userId) : null;
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

  let printers: Array<{ id: string; status?: string }> = [];
  try {
    const file = path.join(process.cwd(), 'data', 'maintenance.json');
    if (fs.existsSync(file)) printers = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    printers = [];
  }
  if (!printers.length) return NextResponse.json({ error: 'Aggiungi prima le stampanti nella pagina Manutenzione' }, { status: 400 });

  const quotes = readQuotes();
  const plan = autoSchedule(quotes as unknown as ProductionQuote[], printers, new Date());
  for (const p of plan) {
    const q = quotes.find(x => String(x.id) === p.id);
    if (!q) continue;
    q.production = { ...((q.production as ProductionInfo) || {}), printerId: p.printerId, plannedStart: p.plannedStart };
  }
  writeQuotes(quotes);
  if (plan.length) logActivity(user.username, 'produzione', '', `Pianificazione automatica di ${plan.length} lavori`);
  return NextResponse.json({ scheduled: plan.length, quotes });
}
