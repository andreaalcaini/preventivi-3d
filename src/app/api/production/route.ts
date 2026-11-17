import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifySessionToken, SESSION_COOKIE_NAME, getUserById } from '@/lib/auth';
import { readQuotes, writeQuotes, readInventory, writeInventory } from '@/lib/labData';
import { EMPTY_QC, type ProductionInfo, type QualityCheck } from '@/lib/production';
import { logActivity } from '@/lib/activity';

function actor(request: NextRequest) {
  const s = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  return s ? getUserById(s.userId) : null;
}

const num = (v: unknown, min = 0, max = 1e7) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0;
};

/**
 * PATCH /api/production
 * { id, production?: {printerId, plannedStart, plannedMinutes, dueDate}, spoolId?, actual?: {grams, hours} | null,
 *   addFailure?: {grams, minutes, reason, spoolId?}, removeFailure?: id, qc?: Partial<QualityCheck> }
 * Aggiorna un solo lavoro sul server (non l'intero elenco) e restituisce il lavoro aggiornato.
 */
export async function PATCH(request: NextRequest) {
  const user = actor(request);
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const quotes = readQuotes();
  const q = quotes.find(x => String(x.id) === String(body?.id));
  if (!q) return NextResponse.json({ error: 'Lavoro non trovato' }, { status: 404 });

  const prod: ProductionInfo = { ...((q.production as ProductionInfo) || {}) };
  const changes: string[] = [];

  if (body.production && typeof body.production === 'object') {
    const p = body.production;
    if ('printerId' in p) { prod.printerId = p.printerId ? String(p.printerId) : undefined; changes.push('stampante'); }
    if ('plannedStart' in p) {
      prod.plannedStart = p.plannedStart && !Number.isNaN(Date.parse(p.plannedStart)) ? new Date(p.plannedStart).toISOString() : null;
      changes.push('pianificazione');
    }
    if ('plannedMinutes' in p) prod.plannedMinutes = p.plannedMinutes ? Math.round(num(p.plannedMinutes, 1, 100000)) : null;
    if ('dueDate' in p) {
      prod.dueDate = typeof p.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.dueDate) ? p.dueDate : null;
      changes.push('consegna');
    }
  }

  if ('spoolId' in (body || {})) { q.spoolId = body.spoolId ? String(body.spoolId) : ''; changes.push('bobina'); }

  if ('actual' in (body || {})) {
    q.actual = body.actual && (num(body.actual.grams) > 0 || num(body.actual.hours) > 0)
      ? { grams: Math.round(num(body.actual.grams)), hours: Math.round(num(body.actual.hours, 0, 10000) * 100) / 100, recordedAt: new Date().toISOString() }
      : null;
    changes.push('consuntivo');
  }

  if (body?.addFailure) {
    const f = body.addFailure;
    const grams = Math.round(num(f.grams, 0, 100000));
    const spoolId = f.spoolId ? String(f.spoolId) : (q.spoolId as string | undefined);
    prod.failures = [
      ...(prod.failures || []),
      {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        grams,
        minutes: Math.round(num(f.minutes, 0, 100000)),
        reason: String(f.reason || '').slice(0, 200),
        spoolId,
        printerId: prod.printerId,
      },
    ];
    // Il filamento sprecato esce davvero dal magazzino
    if (spoolId && grams > 0) {
      const inv = readInventory();
      inv.spools = inv.spools.map(s => (s.id === spoolId ? { ...s, weightRemaining: Math.max(0, Number(s.weightRemaining) - grams) } : s));
      writeInventory(inv);
    }
    changes.push('tentativo fallito');
  }

  if (body?.removeFailure) {
    prod.failures = (prod.failures || []).filter(f => f.id !== body.removeFailure);
    changes.push('rimosso tentativo');
  }

  if (body?.qc && typeof body.qc === 'object') {
    const cur: QualityCheck = { ...EMPTY_QC, ...(prod.qc || {}) };
    const qc = body.qc as Partial<QualityCheck>;
    const next: QualityCheck = {
      result: qc.result === 'ok' || qc.result === 'ristampa' || qc.result === 'scarto' ? qc.result : qc.result === null ? null : cur.result,
      checklist: { ...cur.checklist, ...(qc.checklist || {}) },
      notes: typeof qc.notes === 'string' ? qc.notes.slice(0, 1000) : cur.notes,
      photos: Array.isArray(qc.photos) ? qc.photos.filter(p => typeof p === 'string' && p.startsWith('/api/qc-photo?')).slice(0, 12) : cur.photos,
      at: cur.at,
      by: cur.by,
    };
    if (next.result !== cur.result) { next.at = new Date().toISOString(); next.by = user.displayName; }
    prod.qc = next;
    changes.push('controllo qualità');
  }

  q.production = prod;
  writeQuotes(quotes);
  if (changes.length) logActivity(user.username, 'produzione', String(q.id), `${q.name}: ${[...new Set(changes)].join(', ')}`);
  return NextResponse.json({ quote: q });
}
