import { NextRequest, NextResponse } from 'next/server';
import { readQuotes } from '@/lib/labData';

/**
 * GET /api/v1/clients?q=mario: clienti ricavati dai lavori, con numero di lavori, totale e importo da saldare.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.toLowerCase();
  const map = new Map<string, { name: string; contact: string; jobs: number; total: number; due: number; openJobs: number; lastJobAt: string }>();

  for (const quote of readQuotes()) {
    const name = (quote.clientName || '').trim() || 'Senza nome';
    const key = name.toLowerCase();
    const entry = map.get(key) || { name, contact: '', jobs: 0, total: 0, due: 0, openJobs: 0, lastJobAt: '' };
    const total = Number(quote.totalCalculated) || 0;
    entry.jobs++;
    entry.total += total;
    if ((quote.status || 'in_attesa') !== 'saldato') {
      entry.due += total;
      entry.openJobs++;
    }
    if (quote.clientContact && !entry.contact) entry.contact = String(quote.clientContact);
    if (quote.savedAt) entry.lastJobAt = String(quote.savedAt);
    map.set(key, entry);
  }

  const items = [...map.values()]
    .filter(c => (q ? `${c.name} ${c.contact}`.toLowerCase().includes(q) : true))
    .map(c => ({ ...c, total: Math.round(c.total * 100) / 100, due: Math.round(c.due * 100) / 100 }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({ total: items.length, items });
}
