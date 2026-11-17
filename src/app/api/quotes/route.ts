import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

const dataDir = path.join(process.cwd(), 'data');
const filePath = path.join(dataDir, 'quotes.json');

type Quote = { id: string; name?: string; status?: string; totalCalculated?: number; production?: unknown; actual?: unknown; [k: string]: unknown };

const STATUS_LABEL: Record<string, string> = { richiesta: 'richiesta', in_attesa: 'in attesa', in_stampa: 'in stampa', pronto: 'pronto', saldato: 'saldato' };

function ensureFileExists() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify([]), 'utf-8');
}

function readCurrent(): Quote[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    ensureFileExists();
    return NextResponse.json(readCurrent());
  } catch {
    return NextResponse.json({ error: 'Errore lettura file preventivi' }, { status: 500 });
  }
}

/**
 * POST: salva l'elenco completo (calcolatore e Preventivi).
 * - Produzione e consuntivo si modificano solo da /api/production: qui si tiene sempre la versione del server,
 *   così una pagina aperta da tempo non cancella dati registrati nel frattempo.
 * - Le differenze (nuovi, eliminati, cambi di stato e di prezzo) finiscono nel registro attività.
 */
export async function POST(request: NextRequest) {
  try {
    ensureFileExists();
    const incoming = await request.json();
    if (!Array.isArray(incoming)) return NextResponse.json({ error: 'Formato non valido' }, { status: 400 });

    const current = readCurrent();
    const byId = new Map(current.map(q => [String(q.id), q]));
    const merged: Quote[] = incoming.map((q: Quote) => {
      const prev = byId.get(String(q.id));
      if (!prev) return q;
      const out = { ...q };
      if (prev.production !== undefined) out.production = prev.production;
      if (prev.actual !== undefined) out.actual = prev.actual;
      return out;
    });

    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf-8');

    const session = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    const who = session?.username || (request.headers.get('x-p3d-key') ? 'chiave API' : 'sistema');
    const nextIds = new Set(merged.map(q => String(q.id)));
    for (const q of merged) {
      const prev = byId.get(String(q.id));
      if (!prev) { logActivity(who, 'lavori', String(q.id), `Nuovo lavoro "${q.name}"`); continue; }
      if ((prev.status || 'in_attesa') !== (q.status || 'in_attesa')) {
        logActivity(who, 'lavori', String(q.id), `"${q.name}": ${STATUS_LABEL[prev.status || 'in_attesa'] || prev.status} → ${STATUS_LABEL[q.status || 'in_attesa'] || q.status}`);
      }
      const p0 = Number(prev.totalCalculated) || 0, p1 = Number(q.totalCalculated) || 0;
      if (Math.abs(p0 - p1) >= 0.01) logActivity(who, 'lavori', String(q.id), `"${q.name}": prezzo €${p0.toFixed(2)} → €${p1.toFixed(2)}`);
    }
    for (const prev of current) {
      if (!nextIds.has(String(prev.id))) logActivity(who, 'lavori', String(prev.id), `Eliminato "${prev.name}"`);
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Errore salvataggio file preventivi' }, { status: 500 });
  }
}
