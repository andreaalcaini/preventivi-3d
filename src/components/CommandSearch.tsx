'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FolderKanban, User, Box, Printer, CornerDownLeft, FileText } from 'lucide-react';

interface Result { type: 'lavoro' | 'cliente' | 'bobina' | 'stampante' | 'pagina'; title: string; subtitle: string; href: string }

const PAGES: Result[] = [
  ['Calcolatore', '/'], ['Preventivi', '/preventivi'], ['Clienti', '/clienti'], ['Listino', '/listino'], ['Catalogo', '/catalogo'],
  ['Produzione', '/produzione'], ['Magazzino', '/magazzino'], ['Manutenzione', '/manutenzione'], ['Statistiche', '/dashboard'],
  ['Attività', '/attivita'], ['Integrazioni API', '/integrazioni'], ['Utenti', '/utenti'], ['Backup', '/backup'],
].map(([title, href]) => ({ type: 'pagina', title, subtitle: 'Pagina', href }));

const ICONS = { lavoro: FolderKanban, cliente: User, bobina: Box, stampante: Printer, pagina: FileText };

/** Ricerca globale: Ctrl+K / Cmd+K da qualsiasi pagina del gestionale. */
export default function CommandSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    const term = q.trim().toLowerCase();
    const pages = PAGES.filter(p => term && p.title.toLowerCase().includes(term));
    if (term.length < 2) { setResults(pages); setActive(0); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then(r => r.json())
        .then(d => { setResults([...pages, ...(d.results || [])]); setActive(0); })
        .catch(() => {});
    }, 150);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  if (!open) return null;

  const go = (r: Result) => {
    onOpenChange(false);
    setQ('');
    router.push(r.href);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Cerca">
      <div className="absolute inset-0 bg-scrim" onClick={() => onOpenChange(false)} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 text-ink-faint" />
          <label htmlFor="global-search" className="sr-only">Cerca lavori, clienti, bobine</label>
          <input
            ref={inputRef}
            id="global-search"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') onOpenChange(false);
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
              if (e.key === 'Enter' && results[active]) go(results[active]);
            }}
            placeholder="Cerca lavori, codici, clienti, bobine…"
            className="h-14 flex-1 bg-transparent text-base text-ink outline-none"
          />
          <kbd className="hidden sm:inline rounded border border-line px-1.5 py-0.5 font-mono text-xs text-ink-faint">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto py-2" role="listbox">
          {q.trim().length < 2 && results.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-ink-muted">Scrivi almeno 2 caratteri: nome del pezzo, codice ordine, cliente, colore della bobina…</li>
          )}
          {q.trim().length >= 2 && results.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-ink-muted">Nessun risultato per &quot;{q}&quot;.</li>
          )}
          {results.map((r, i) => {
            const Icon = ICONS[r.type];
            return (
              <li key={`${r.type}-${r.href}-${i}`} role="option" aria-selected={i === active}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${i === active ? 'bg-raised' : ''}`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{r.title}</span>
                    <span className="block truncate text-xs text-ink-faint">{r.type !== 'pagina' ? `${r.type} · ` : ''}{r.subtitle}</span>
                  </span>
                  {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-ink-faint" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
