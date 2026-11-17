'use client';

import React, { useEffect, useState } from 'react';
import { History, Search } from 'lucide-react';

interface Entry { id: string; at: string; user: string; area: string; ref: string; text: string }

const AREAS: Array<[string, string]> = [
  ['', 'Tutto'], ['lavori', 'Lavori'], ['produzione', 'Produzione'], ['magazzino', 'Magazzino'],
  ['listino', 'Listino'], ['clienti', 'Clienti'], ['catalogo', 'Catalogo'], ['utenti', 'Utenti'], ['chiavi', 'Chiavi API'],
];

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'Oggi';
  if (d.toDateString() === y.toDateString()) return 'Ieri';
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function AttivitaPage() {
  const [items, setItems] = useState<Entry[] | null>(null);
  const [area, setArea] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      const sp = new URLSearchParams({ limit: '500' });
      if (area) sp.set('area', area);
      if (query.trim()) sp.set('q', query.trim());
      fetch(`/api/activity?${sp}`, { signal: ctrl.signal }).then(r => r.json()).then(d => setItems(d.items || [])).catch(() => {});
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [area, query]);

  const groups: Array<[string, Entry[]]> = [];
  for (const e of items || []) {
    const label = dayLabel(e.at);
    const last = groups[groups.length - 1];
    if (last && last[0] === label) last[1].push(e); else groups.push([label, [e]]);
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-8 lg:py-10 space-y-6">
      <header className="max-w-[64ch]">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">Attività</h1>
        <p className="mt-2 text-ink-muted leading-relaxed">Chi ha cambiato cosa e quando: lavori, produzione, magazzino, listino, utenti e chiavi API.</p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1" role="tablist">
          {AREAS.map(([v, l]) => (
            <button key={v} role="tab" aria-selected={area === v} onClick={() => setArea(v)}
              className={`min-h-9 rounded-lg px-3 text-sm ${area === v ? 'bg-surface text-ink font-medium shadow-sm ring-1 ring-line' : 'text-ink-muted hover:text-ink hover:bg-raised'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <label htmlFor="act-q" className="sr-only">Cerca nel registro</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input id="act-q" className="field pl-9" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cerca…" />
        </div>
      </div>

      {items === null ? (
        <div className="h-60 rounded-xl bg-raised animate-pulse" aria-hidden="true" />
      ) : items.length === 0 ? (
        <section className="panel px-5 py-12 text-center">
          <History className="mx-auto h-6 w-6 text-ink-faint" strokeWidth={1.5} />
          <p className="mt-3 font-medium text-ink">Nessuna attività</p>
          <p className="mt-1 text-sm text-ink-muted">Le modifiche compariranno qui da ora in avanti.</p>
        </section>
      ) : (
        <div className="space-y-6">
          {groups.map(([label, list]) => (
            <section key={label}>
              <h2 className="mb-2 text-sm font-medium text-ink-faint capitalize">{label}</h2>
              <ol className="panel divide-y divide-line">
                {list.map(e => (
                  <li key={e.id} className="flex items-start gap-4 px-5 py-3 text-sm">
                    <time className="w-12 shrink-0 font-mono text-ink-faint" dateTime={e.at}>
                      {new Date(e.at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    </time>
                    <div className="min-w-0 flex-1">
                      <p className="text-ink break-words">{e.text}</p>
                      <p className="text-xs text-ink-faint">{e.user} · {e.area}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
