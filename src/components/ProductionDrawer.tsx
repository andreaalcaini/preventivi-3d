'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, CalendarClock, Scale, TriangleAlert, ClipboardCheck, Camera, Trash2, Plus, Check } from 'lucide-react';
import {
  QC_LABELS, EMPTY_QC, estimatedGrams, estimatedMinutes, plannedEnd, isLate, realCost, wasteGrams,
  type ProductionQuote, type QualityCheck,
} from '@/lib/production';

interface Printer { id: string; name: string; status?: string }
interface Spool { id: string; brand: string; material: string; color: string; cost: number; weightTotal: number; weightRemaining: number }

function toLocalInput(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 font-semibold text-ink"><Icon className="h-4 w-4 text-ink-faint" strokeWidth={1.75} /> {title}</h3>
      {children}
    </section>
  );
}

export default function ProductionDrawer({ quote, onClose, onSaved }: {
  quote: ProductionQuote;
  onClose: () => void;
  onSaved: (q: ProductionQuote) => void;
}) {
  const [q, setQ] = useState<ProductionQuote>(quote);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [spools, setSpools] = useState<Spool[]>([]);
  const [rates, setRates] = useState({ machineRatePerHour: 0.48, setupFee: 2, defaultCostPerKg: 25 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [actualGrams, setActualGrams] = useState(String(quote.actual?.grams ?? ''));
  const [actualHours, setActualHours] = useState(String(quote.actual?.hours ?? ''));
  const [failure, setFailure] = useState({ grams: '', minutes: '', reason: '' });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch('/api/maintenance').then(r => r.json()).then(d => setPrinters(d.printers || [])).catch(() => {});
    fetch('/api/inventory').then(r => r.json()).then(d => setSpools(d.spools || [])).catch(() => {});
    fetch('/api/pricing').then(r => r.json()).then(d => {
      if (d.pricing) setRates({ machineRatePerHour: d.pricing.machineRatePerHour, setupFee: d.pricing.setupFee, defaultCostPerKg: d.pricing.materials?.[0]?.pricePerKg || 25 });
    }).catch(() => {});
  }, []);

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/production', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: q.id, ...body }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Salvataggio non riuscito'); return; }
      setQ(data.quote);
      onSaved(data.quote);
    } catch {
      setError('Errore di connessione');
    } finally {
      setSaving(false);
    }
  };

  const spool = spools.find(s => s.id === q.spoolId);
  const costPerKg = spool && spool.weightTotal ? (spool.cost / spool.weightTotal) * 1000 : rates.defaultCostPerKg;
  const real = useMemo(() => realCost(q, { costPerKg, machineRatePerHour: rates.machineRatePerHour, setupFee: rates.setupFee }), [q, costPerKg, rates]);
  const end = plannedEnd(q);
  const late = isLate(q);
  const qc: QualityCheck = { ...EMPTY_QC, ...(q.production?.qc || {}) };
  const estG = estimatedGrams(q);
  const estMin = estimatedMinutes(q);

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('quoteId', q.id);
      const res = await fetch('/api/qc-photo', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Caricamento non riuscito'); return; }
      await patch({ qc: { photos: [...qc.photos, data.url] } });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="prod-title">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-canvas border-l border-line shadow-lg animate-slide-in">
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line px-6">
          <div className="min-w-0">
            <h2 id="prod-title" className="truncate text-lg font-semibold text-ink">{q.name}</h2>
            <p className="truncate text-xs text-ink-faint">{q.clientName || 'Cliente'} · codice {q.id} · {q.quantity && q.quantity > 1 ? `${q.quantity} pezzi` : '1 pezzo'}</p>
          </div>
          <button onClick={onClose} aria-label="Chiudi" className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-raised"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {error && <p className="flex items-center gap-2 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger-ink" role="alert"><TriangleAlert className="h-4 w-4" /> {error}</p>}

          <Section icon={CalendarClock} title="Pianificazione">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="p-printer" className="label">Stampante</label>
                <select id="p-printer" className="field" value={q.production?.printerId || ''} onChange={e => patch({ production: { printerId: e.target.value || null } })}>
                  <option value="">Non assegnata</option>
                  {printers.map(p => <option key={p.id} value={p.id}>{p.name}{p.status && p.status !== 'operativa' ? ` (${p.status.replace('_', ' ')})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="p-spool" className="label">Bobina usata</label>
                <select id="p-spool" className="field" value={q.spoolId || ''} onChange={e => patch({ spoolId: e.target.value || null })}>
                  <option value="">Nessuna</option>
                  {spools.map(s => <option key={s.id} value={s.id}>{s.brand} {s.material} {s.color} ({s.weightRemaining} g)</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="p-start" className="label">Inizio stampa</label>
                <input id="p-start" type="datetime-local" className="field" value={toLocalInput(q.production?.plannedStart)}
                  onChange={e => patch({ production: { plannedStart: e.target.value ? new Date(e.target.value).toISOString() : null } })} />
              </div>
              <div>
                <label htmlFor="p-due" className="label">Consegna promessa</label>
                <input id="p-due" type="date" className="field" value={q.production?.dueDate || ''} onChange={e => patch({ production: { dueDate: e.target.value || null } })} />
              </div>
            </div>
            <p className={`text-sm ${late ? 'text-danger-ink' : 'text-ink-muted'}`}>
              Durata prevista {fmtMinutes(estMin)}
              {end ? ` · fine ${end.toLocaleString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
              {late ? ' · oltre la consegna promessa' : ''}
            </p>
          </Section>

          <Section icon={Scale} title="Consuntivo">
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] items-end">
              <div>
                <label htmlFor="a-g" className="label">Grammi reali (tutto il lavoro)</label>
                <input id="a-g" type="number" min={0} className="field font-mono" value={actualGrams} onChange={e => setActualGrams(e.target.value)} placeholder={String(estG)} />
              </div>
              <div>
                <label htmlFor="a-h" className="label">Ore reali</label>
                <input id="a-h" type="number" min={0} step={0.1} className="field font-mono" value={actualHours} onChange={e => setActualHours(e.target.value)} placeholder={(estMin / 60).toFixed(1)} />
              </div>
              <button disabled={saving} onClick={() => patch({ actual: actualGrams || actualHours ? { grams: Number(actualGrams) || 0, hours: Number(actualHours) || 0 } : null })} className="btn btn-primary">
                <Check className="h-4 w-4" /> Registra
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="rounded-lg bg-raised p-3"><p className="text-ink-faint text-xs">Preventivo</p><p className="font-mono text-ink">{estG} g · {fmtMinutes(estMin)}</p></div>
              <div className="rounded-lg bg-raised p-3"><p className="text-ink-faint text-xs">Reale + scarti</p><p className="font-mono text-ink">{real.grams} g · {fmtMinutes(real.hours * 60)}</p></div>
              <div className="rounded-lg bg-raised p-3"><p className="text-ink-faint text-xs">Costo reale</p><p className="font-mono text-ink">€{real.cost.toFixed(2)}</p></div>
              <div className="rounded-lg bg-raised p-3"><p className="text-ink-faint text-xs">Margine reale</p><p className={`font-mono ${real.margin < 0 ? 'text-danger-ink' : 'text-accent-ink'}`}>€{real.margin.toFixed(2)} ({real.marginPct}%)</p></div>
            </div>
            {!q.actual && <p className="text-xs text-ink-faint">Senza consuntivo il costo usa i valori del preventivo. I consuntivi registrati migliorano anche la stima automatica (Listino → Calibrazione).</p>}
          </Section>

          <Section icon={TriangleAlert} title="Tentativi falliti e scarti">
            {(q.production?.failures || []).length > 0 ? (
              <ul className="divide-y divide-line rounded-lg border border-line">
                {(q.production?.failures || []).map(f => (
                  <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-mono text-ink">{f.grams} g · {fmtMinutes(f.minutes)}</span>
                      <span className="text-ink-muted"> · {f.reason || 'senza motivo'} · {new Date(f.at).toLocaleDateString('it-IT')}</span>
                    </span>
                    <button onClick={() => patch({ removeFailure: f.id })} aria-label="Rimuovi" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-faint hover:bg-danger-soft hover:text-danger-ink"><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-muted">Nessun tentativo fallito registrato.</p>}
            <div className="grid gap-3 sm:grid-cols-[90px_90px_1fr_auto] items-end">
              <div><label htmlFor="f-g" className="label">Grammi</label><input id="f-g" type="number" min={0} className="field font-mono" value={failure.grams} onChange={e => setFailure({ ...failure, grams: e.target.value })} /></div>
              <div><label htmlFor="f-m" className="label">Minuti</label><input id="f-m" type="number" min={0} className="field font-mono" value={failure.minutes} onChange={e => setFailure({ ...failure, minutes: e.target.value })} /></div>
              <div><label htmlFor="f-r" className="label">Motivo</label><input id="f-r" className="field" value={failure.reason} onChange={e => setFailure({ ...failure, reason: e.target.value })} /></div>
              <button disabled={saving || !(Number(failure.grams) > 0 || Number(failure.minutes) > 0)} className="btn btn-secondary"
                onClick={async () => { await patch({ addFailure: { grams: Number(failure.grams) || 0, minutes: Number(failure.minutes) || 0, reason: failure.reason } }); setFailure({ grams: '', minutes: '', reason: '' }); }}>
                <Plus className="h-4 w-4" /> Aggiungi
              </button>
            </div>
            <p className="text-xs text-ink-faint">
              {spool ? `I grammi vengono scaricati dalla bobina ${spool.brand} ${spool.color}.` : 'Scegli la bobina sopra per scaricare dal magazzino anche il filamento sprecato.'}
              {wasteGrams(q) > 0 && ` Scarto totale: ${wasteGrams(q)} g.`}
            </p>
          </Section>

          <Section icon={ClipboardCheck} title="Controllo qualità">
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(QC_LABELS) as Array<keyof QualityCheck['checklist']>).map(k => (
                <label key={k} className="flex items-center gap-2.5 rounded-lg border border-line px-3 min-h-10 text-sm text-ink cursor-pointer hover:bg-raised">
                  <input type="checkbox" className="h-4 w-4 accent-accent" checked={qc.checklist[k]} onChange={e => patch({ qc: { checklist: { [k]: e.target.checked } } })} />
                  {QC_LABELS[k]}
                </label>
              ))}
            </div>
            <div className="inline-grid grid-flow-col gap-1 rounded-lg border border-line bg-sunken p-1" role="radiogroup" aria-label="Esito">
              {([['ok', 'Superato'], ['ristampa', 'Da ristampare'], ['scarto', 'Scartato']] as const).map(([v, l]) => (
                <button key={v} role="radio" aria-checked={qc.result === v} onClick={() => patch({ qc: { result: qc.result === v ? null : v } })}
                  className={`min-h-9 rounded-md px-3 text-sm ${qc.result === v ? (v === 'ok' ? 'bg-accent text-on-accent' : v === 'ristampa' ? 'bg-warn text-on-accent' : 'bg-danger text-on-accent') : 'text-ink-muted hover:text-ink'}`}>
                  {l}
                </button>
              ))}
            </div>
            {qc.at && <p className="text-xs text-ink-faint">Esito registrato da {qc.by} il {new Date(qc.at).toLocaleString('it-IT')}</p>}
            <div>
              <label htmlFor="qc-notes" className="label">Note</label>
              <textarea id="qc-notes" rows={2} className="field" defaultValue={qc.notes} onBlur={e => e.target.value !== qc.notes && patch({ qc: { notes: e.target.value } })} />
            </div>
            <div className="flex flex-wrap gap-2">
              {qc.photos.map(url => (
                <div key={url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Foto controllo qualità" className="h-20 w-20 rounded-lg border border-line object-cover" /></a>
                  <button onClick={() => patch({ qc: { photos: qc.photos.filter(p => p !== url) } })} aria-label="Rimuovi foto" className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border border-line bg-surface text-ink-faint hover:text-danger-ink"><X className="h-3 w-3" /></button>
                </div>
              ))}
              <label className={`grid h-20 w-20 cursor-pointer place-items-center rounded-lg border border-dashed border-line-strong text-ink-faint hover:bg-raised ${uploading ? 'opacity-50' : ''}`}>
                <span className="flex flex-col items-center gap-1 text-xs"><Camera className="h-5 w-5" /> {uploading ? '…' : 'Foto'}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" disabled={uploading}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ''; }} />
              </label>
            </div>
          </Section>
        </div>

        <div className="shrink-0 border-t border-line px-6 py-3 text-xs text-ink-faint">
          {saving ? 'Salvataggio…' : 'Le modifiche si salvano subito.'}
        </div>
      </div>
    </div>
  );
}
