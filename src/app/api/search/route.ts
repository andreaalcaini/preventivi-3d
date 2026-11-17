import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { readQuotes, readInventory } from '@/lib/labData';

export interface SearchResult {
  type: 'lavoro' | 'cliente' | 'bobina' | 'stampante';
  title: string;
  subtitle: string;
  href: string;
}

/** GET /api/search?q=...: ricerca rapida tra lavori (nome, codice, cliente), clienti, bobine e stampanti. */
export async function GET(request: NextRequest) {
  if (!verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }
  const q = (request.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
  if (q.length < 2) return NextResponse.json({ results: [] });
  const hit = (...parts: unknown[]) => parts.some(p => String(p ?? '').toLowerCase().includes(q));
  const results: SearchResult[] = [];

  const quotes = readQuotes();
  for (const x of quotes) {
    if (hit(x.name, x.id, x.clientName, x.clientContact, x.material)) {
      results.push({
        type: 'lavoro',
        title: String(x.name || 'Lavoro'),
        subtitle: `${x.clientName || 'Cliente'} · ${x.id} · €${(Number(x.totalCalculated) || 0).toFixed(2)}`,
        href: `/preventivi?cerca=${encodeURIComponent(String(x.id))}`,
      });
    }
  }
  const clients = new Map<string, number>();
  for (const x of quotes) {
    const c = String(x.clientName || '').trim();
    if (c && hit(c, x.clientContact)) clients.set(c, (clients.get(c) || 0) + 1);
  }
  for (const [name, n] of clients) {
    results.push({ type: 'cliente', title: name, subtitle: `${n} ${n === 1 ? 'lavoro' : 'lavori'}`, href: `/clienti?cerca=${encodeURIComponent(name)}` });
  }
  for (const s of readInventory().spools) {
    if (hit(s.brand, s.material, s.color)) {
      results.push({ type: 'bobina', title: `${s.brand} ${s.material} ${s.color}`, subtitle: `${s.weightRemaining} g rimasti`, href: '/magazzino' });
    }
  }
  try {
    const file = path.join(process.cwd(), 'data', 'maintenance.json');
    if (fs.existsSync(file)) {
      for (const p of JSON.parse(fs.readFileSync(file, 'utf-8')) as Array<{ name: string; model?: string; status?: string }>) {
        if (hit(p.name, p.model)) results.push({ type: 'stampante', title: p.name, subtitle: `${p.model || ''} · ${p.status || 'operativa'}`, href: '/manutenzione' });
      }
    }
  } catch { /* stampanti facoltative */ }

  return NextResponse.json({ results: results.slice(0, 30) });
}
