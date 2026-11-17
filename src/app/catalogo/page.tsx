'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookMarked, Plus, Pencil, Trash2, X, PackagePlus, Search, Check } from 'lucide-react';

interface Item {
  id: string; name: string; description: string; category: string; material: string; color: string;
  weight: number; hours: number; mins: number; price: number; modelUrl: string; modelFileName: string;
  timesUsed: number; updatedAt: string;
}
interface QuoteLite { id: string; name: string; clientName?: string; totalCalculated?: number; quantity?: number }

const blank: Partial<Item> = { name: '', description: '', category: '', material: 'PLA', color: '', weight: 0, hours: 0, mins: 0, price: 0 };

export default function CatalogoPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [quotes, setQuotes] = useState<QuoteLite[]>([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Partial<Item> | null>(null);
  const [using, setUsing] = useState<Item | null>(null);
  const [use, setUse] = useState({ clientName: '', clientContact: '', quantity: '1' });
  const [fromQuote, setFromQuote] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string; href?: string } | null>(null);

  const load = () => fetch('/api/catalog').then(r => r.json()).then(d => setItems(d.items || []));
  useEffect(() => {
    load();
    fetch('/api/quotes').then(r => r.json()).then(d => setQuotes(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (items || []).filter(i => !t || `${i.name} ${i.category} ${i.material} ${i.color}`.toLowerCase().includes(t));
  }, [items, q]);
  const categories = [...new Set((items || []).map(i => i.category).filter(Boolean))];

  const post = async (body: unknown) => {
    const res = await fetch('/api/catalog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { setMessage({ ok: false, text: data.error || 'Operazione non riuscita' }); return null; }
    return data;
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-8 lg:py-10 space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-[64ch]">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">Catalogo</h1>
          <p className="mt-2 text-ink-muted leading-relaxed">Pezzi che stampi spesso, con prezzo fisso: crei un nuovo lavoro per un cliente in un clic.</p>
        </div>
        <button onClick={() => setEditing({ ...blank })} className="btn btn-primary"><Plus className="h-4 w-4" /> Nuovo pezzo</button>
      </header>

      {message && (
        <p className={`flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3 text-sm ${message.ok ? 'border-accent-line bg-accent-soft text-accent-ink' : 'border-danger-line bg-danger-soft text-danger-ink'}`} role="status">
          {message.ok && <Check className="h-4 w-4" />} {message.text}
          {message.href && <Link href={message.href} className="font-medium underline underline-offset-4">Apri</Link>}
        </p>
      )}

      <section className="panel p-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="from-quote" className="label">Aggiungi da un lavoro già fatto</label>
          <select id="from-quote" className="field" value={fromQuote} onChange={e => setFromQuote(e.target.value)}>
            <option value="">Scegli un lavoro…</option>
            {quotes.slice(0, 200).map(x => (
              <option key={x.id} value={x.id}>{x.name} · {x.clientName || 'Cliente'} · €{((x.totalCalculated || 0) / Math.max(1, x.quantity || 1)).toFixed(2)}/pz</option>
            ))}
          </select>
        </div>
        <button disabled={!fromQuote} className="btn btn-secondary" onClick={async () => {
          const d = await post({ fromQuoteId: fromQuote });
          if (d) { setFromQuote(''); setMessage({ ok: true, text: `"${d.item.name}" aggiunto al catalogo.` }); load(); }
        }}>
          <BookMarked className="h-4 w-4" /> Aggiungi
        </button>
      </section>

      <div className="relative sm:w-72">
        <label htmlFor="cat-q" className="sr-only">Cerca nel catalogo</label>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input id="cat-q" className="field pl-9" value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca nel catalogo…" />
      </div>

      {items === null ? (
        <div className="h-48 rounded-xl bg-raised animate-pulse" aria-hidden="true" />
      ) : filtered.length === 0 ? (
        <section className="panel px-5 py-12 text-center">
          <BookMarked className="mx-auto h-6 w-6 text-ink-faint" strokeWidth={1.5} />
          <p className="mt-3 font-medium text-ink">{items.length ? 'Nessun risultato' : 'Catalogo vuoto'}</p>
          <p className="mt-1 text-sm text-ink-muted">Aggiungi un pezzo da un lavoro già fatto o creane uno nuovo.</p>
        </section>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(i => (
            <li key={i.id} className="panel p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink truncate">{i.name}</p>
                  <p className="text-sm text-ink-faint truncate">{[i.category, i.material, i.color].filter(Boolean).join(' · ')}</p>
                </div>
                <p className="font-mono text-lg font-semibold text-ink shrink-0">€{i.price.toFixed(2)}</p>
              </div>
              {i.description && <p className="text-sm text-ink-muted line-clamp-2">{i.description}</p>}
              <p className="text-xs text-ink-faint">{i.weight} g · {i.hours}h {i.mins}m · usato {i.timesUsed} {i.timesUsed === 1 ? 'volta' : 'volte'}{i.modelFileName ? ` · ${i.modelFileName}` : ''}</p>
              <div className="mt-auto flex gap-2">
                <button onClick={() => { setUsing(i); setUse({ clientName: '', clientContact: '', quantity: '1' }); }} className="btn btn-primary btn-sm flex-1"><PackagePlus className="h-3.5 w-3.5" /> Nuovo lavoro</button>
                <button onClick={() => setEditing(i)} aria-label={`Modifica ${i.name}`} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-ink-muted hover:bg-raised"><Pencil className="h-3.5 w-3.5" /></button>
                <button aria-label={`Rimuovi ${i.name}`} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-ink-muted hover:bg-danger-soft hover:text-danger-ink"
                  onClick={async () => { if (!confirm(`Rimuovere "${i.name}" dal catalogo?`)) return; await fetch(`/api/catalog?id=${i.id}`, { method: 'DELETE' }); load(); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {categories.length > 0 && <datalist id="cat-categories">{categories.map(c => <option key={c} value={c} />)}</datalist>}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="edit-title">
          <div className="absolute inset-0 bg-scrim" onClick={() => setEditing(null)} />
          <form className="relative panel w-full max-w-lg p-6 space-y-4 shadow-lg" onSubmit={async e => {
            e.preventDefault();
            const d = await post({ item: editing });
            if (d) { setEditing(null); setMessage({ ok: true, text: `"${d.item.name}" salvato.` }); load(); }
          }}>
            <div className="flex items-center justify-between">
              <h2 id="edit-title" className="text-lg font-semibold text-ink">{editing.id ? 'Modifica pezzo' : 'Nuovo pezzo'}</h2>
              <button type="button" onClick={() => setEditing(null)} aria-label="Chiudi" className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-raised"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><label htmlFor="e-name" className="label">Nome</label><input id="e-name" required className="field" value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><label htmlFor="e-cat" className="label">Categoria</label><input id="e-cat" list="cat-categories" className="field" value={editing.category || ''} onChange={e => setEditing({ ...editing, category: e.target.value })} /></div>
              <div><label htmlFor="e-price" className="label">Prezzo al pezzo (€)</label><input id="e-price" type="number" step="0.01" min={0} className="field font-mono" value={editing.price ?? 0} onChange={e => setEditing({ ...editing, price: parseFloat(e.target.value) })} /></div>
              <div><label htmlFor="e-mat" className="label">Materiale</label><input id="e-mat" className="field" value={editing.material || ''} onChange={e => setEditing({ ...editing, material: e.target.value })} /></div>
              <div><label htmlFor="e-col" className="label">Colore</label><input id="e-col" className="field" value={editing.color || ''} onChange={e => setEditing({ ...editing, color: e.target.value })} /></div>
              <div><label htmlFor="e-w" className="label">Grammi</label><input id="e-w" type="number" min={0} className="field font-mono" value={editing.weight ?? 0} onChange={e => setEditing({ ...editing, weight: parseFloat(e.target.value) })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label htmlFor="e-h" className="label">Ore</label><input id="e-h" type="number" min={0} className="field font-mono" value={editing.hours ?? 0} onChange={e => setEditing({ ...editing, hours: parseInt(e.target.value, 10) })} /></div>
                <div><label htmlFor="e-m" className="label">Min</label><input id="e-m" type="number" min={0} max={59} className="field font-mono" value={editing.mins ?? 0} onChange={e => setEditing({ ...editing, mins: parseInt(e.target.value, 10) })} /></div>
              </div>
              <div className="sm:col-span-2"><label htmlFor="e-desc" className="label">Descrizione</label><textarea id="e-desc" rows={2} className="field" value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="btn btn-secondary">Annulla</button>
              <button type="submit" className="btn btn-primary">Salva</button>
            </div>
          </form>
        </div>
      )}

      {using && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="use-title">
          <div className="absolute inset-0 bg-scrim" onClick={() => setUsing(null)} />
          <form className="relative panel w-full max-w-md p-6 space-y-4 shadow-lg" onSubmit={async e => {
            e.preventDefault();
            const d = await post({ use: { id: using.id, ...use } });
            if (d) {
              setUsing(null);
              setMessage({ ok: true, text: `Lavoro ${d.quote.id} creato: ${d.quote.name} × ${d.quote.quantity}, €${d.quote.totalCalculated.toFixed(2)}.`, href: `/preventivi?cerca=${encodeURIComponent(d.quote.id)}` });
              load();
            }
          }}>
            <div className="flex items-center justify-between">
              <h2 id="use-title" className="text-lg font-semibold text-ink">Nuovo lavoro: {using.name}</h2>
              <button type="button" onClick={() => setUsing(null)} aria-label="Chiudi" className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-raised"><X className="h-4 w-4" /></button>
            </div>
            <div><label htmlFor="u-client" className="label">Cliente</label><input id="u-client" required className="field" list="u-clients" value={use.clientName} onChange={e => setUse({ ...use, clientName: e.target.value })} />
              <datalist id="u-clients">{[...new Set(quotes.map(x => x.clientName).filter(Boolean))].map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div><label htmlFor="u-contact" className="label">Contatto <span className="font-normal text-ink-faint">(facoltativo)</span></label><input id="u-contact" className="field" value={use.clientContact} onChange={e => setUse({ ...use, clientContact: e.target.value })} /></div>
            <div><label htmlFor="u-qty" className="label">Pezzi</label><input id="u-qty" type="number" min={1} className="field font-mono" value={use.quantity} onChange={e => setUse({ ...use, quantity: e.target.value })} /></div>
            <p className="text-sm text-ink-muted">Totale: <strong className="font-mono text-ink">€{(using.price * Math.max(1, parseInt(use.quantity, 10) || 1)).toFixed(2)}</strong></p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setUsing(null)} className="btn btn-secondary">Annulla</button>
              <button type="submit" className="btn btn-primary"><PackagePlus className="h-4 w-4" /> Crea lavoro</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
