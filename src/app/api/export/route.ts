import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { readQuotes, readInventory } from '@/lib/labData';
import { readProfiles, clientKey } from '@/lib/clientProfiles';

/** Valore CSV per Excel in italiano: separatore ";", decimali con la virgola, testo tra virgolette se serve. */
function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(Math.round(v * 100) / 100).replace('.', ',') : '';
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(headers: string[], rows: unknown[][]): string {
  return '﻿' + [headers, ...rows].map(r => r.map(cell).join(';')).join('\r\n');
}

const STATUS: Record<string, string> = { richiesta: 'Richiesta', in_attesa: 'In attesa', in_stampa: 'In stampa', pronto: 'Pronto', saldato: 'Saldato' };

/** GET /api/export?type=lavori|magazzino|clienti: esportazione CSV. */
export async function GET(request: NextRequest) {
  if (!verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }
  const type = request.nextUrl.searchParams.get('type') || 'lavori';
  const date = new Date().toISOString().slice(0, 10);
  let body = '';

  if (type === 'lavori') {
    body = csv(
      ['Codice', 'Data', 'Lavoro', 'Cliente', 'Contatto', 'Stato', 'Materiale', 'Pezzi', 'Grammi/pz', 'Ore/pz', 'Totale €', 'Utile stimato €', 'Grammi reali', 'Ore reali'],
      readQuotes().map(q => {
        const actual = q.actual as { grams?: number; hours?: number } | undefined;
        return [
          q.id, q.savedAt, q.name, q.clientName, q.clientContact, STATUS[q.status || 'in_attesa'] || q.status, q.material,
          Number(q.quantity) || 1, Number(q.weight) || 0, (Number(q.hours) || 0) + (Number(q.mins) || 0) / 60,
          Number(q.totalCalculated) || 0, Number(q.estimatedProfit) || 0, actual?.grams ?? '', actual?.hours ?? '',
        ];
      }),
    );
  } else if (type === 'magazzino') {
    const inv = readInventory();
    body = csv(
      ['Tipo', 'Marca / Nome', 'Materiale', 'Colore', 'Rimanente', 'Totale', 'Costo €'],
      [
        ...inv.spools.map(s => ['Bobina', s.brand, s.material, s.color, Number(s.weightRemaining) || 0, Number(s.weightTotal) || 0, Number(s.cost) || 0]),
        ...inv.hardware.map(h => ['Componente', h.name, '', '', Number(h.qty) || 0, '', Number(h.cost) || 0]),
      ],
    );
  } else if (type === 'clienti') {
    const profiles = readProfiles();
    const map = new Map<string, { name: string; contact: string; jobs: number; total: number; due: number }>();
    for (const q of readQuotes()) {
      const name = String(q.clientName || '').trim() || 'Senza nome';
      const e = map.get(clientKey(name)) || { name, contact: '', jobs: 0, total: 0, due: 0 };
      e.jobs++;
      e.total += Number(q.totalCalculated) || 0;
      if ((q.status || 'in_attesa') !== 'saldato') e.due += Number(q.totalCalculated) || 0;
      if (!e.contact && q.clientContact) e.contact = String(q.clientContact);
      map.set(clientKey(name), e);
    }
    body = csv(
      ['Cliente', 'Azienda', 'Contatti', 'Indirizzo', 'Etichette', 'Lavori', 'Totale €', 'Da saldare €', 'Note'],
      [...map.values()].map(c => {
        const p = profiles[clientKey(c.name)];
        const contacts = p?.contacts?.length ? p.contacts.map(x => `${x.label}: ${x.value}`).join(' | ') : c.contact;
        return [c.name, p?.company || '', contacts, p?.address || '', (p?.tags || []).join(', '), c.jobs, c.total, c.due, p?.notes || ''];
      }),
    );
  } else {
    return NextResponse.json({ error: 'Tipo non valido: lavori, magazzino o clienti' }, { status: 400 });
  }

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="preventivi3d-${type}-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
