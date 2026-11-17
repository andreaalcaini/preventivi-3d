'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Wand2, ChevronLeft, ChevronRight, TriangleAlert, Scale } from 'lucide-react';
import ProductionDrawer from '@/components/ProductionDrawer';
import {
  plannedEnd, plannedMinutes, isLate, estimatedGrams, estimatedMinutes, realCost, wasteGrams,
  type ProductionQuote,
} from '@/lib/production';

interface Printer { id: string; name: string; model?: string; status?: string }

const DAY = 86_400_000;
const STATUS_LABEL: Record<string, string> = { richiesta: 'Richiesta', in_attesa: 'In attesa', in_stampa: 'In stampa', pronto: 'Pronto', saldato: 'Saldato' };

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fmtMin(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default function ProduzionePage() {
  const [quotes, setQuotes] = useState<ProductionQuote[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [rates, setRates] = useState({ machineRatePerHour: 0.48, setupFee: 2, costPerKg: 25 });
  const [spoolCost, setSpoolCost] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'calendario' | 'consuntivi'>('calendario');
  const [weekOffset, setWeekOffset] = useState(0);
  const [open, setOpen] = useState<ProductionQuote | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [scheduling, setScheduling] = useState(false);

  const load = useCallback(async () => {
    const [q, m, p, inv] = await Promise.all([
      fetch('/api/quotes').then(r => r.json()).catch(() => []),
      fetch('/api/maintenance').then(r => r.json()).catch(() => ({})),
      fetch('/api/pricing').then(r => r.json()).catch(() => ({})),
      fetch('/api/inventory').then(r => r.json()).catch(() => ({})),
    ]);
    setQuotes(Array.isArray(q) ? q : []);
    setPrinters(m.printers || []);
    if (p.pricing) setRates({ machineRatePerHour: p.pricing.machineRatePerHour, setupFee: p.pricing.setupFee, costPerKg: p.pricing.materials?.[0]?.pricePerKg || 25 });
    const costs: Record<string, number> = {};
    for (const s of inv.spools || []) if (s.weightTotal) costs[s.id] = (s.cost / s.weightTotal) * 1000;
    setSpoolCost(costs);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const rangeStart = useMemo(() => new Date(startOfDay(new Date()).getTime() + weekOffset * 7 * DAY), [weekOffset]);
  const rangeEnd = new Date(rangeStart.getTime() + 7 * DAY);
  const days = Array.from({ length: 7 }, (_, i) => new Date(rangeStart.getTime() + i * DAY));

  const active = quotes.filter(q => ['richiesta', 'in_attesa', 'in_stampa'].includes(q.status || 'in_attesa'));
  const unplanned = active.filter(q => !q.production?.plannedStart);
  const late = quotes.filter(q => isLate(q) && q.status !== 'saldato' && q.status !== 'pronto');
  const [now] = useState(() => Date.now());

  const scheduleAll = async () => {
    setScheduling(true);
    setMessage(null);
    const res = await fetch('/api/production/schedule', { method: 'POST' });
    const data = await res.json();
    setScheduling(false);
    if (!res.ok) { setMessage({ ok: false, text: data.error || 'Pianificazione non riuscita' }); return; }
    setQuotes(data.quotes);
    setMessage({ ok: true, text: data.scheduled ? `Pianificati ${data.scheduled} lavori sulle stampanti operative.` : 'Nessun lavoro da pianificare.' });
  };

  const actuals = quotes.filter(q => q.actual);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8 lg:py-10 space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-[64ch]">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">Produzione</h1>
          <p className="mt-2 text-ink-muted leading-relaxed">Chi stampa cosa e quando, consegne a rischio e confronto tra stime e consuntivi.</p>
        </div>
        <div className="inline-grid grid-flow-col gap-1 rounded-lg border border-line bg-sunken p-1" role="tablist">
          {(['calendario', 'consuntivi'] as const).map(t => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`min-h-9 rounded-md px-4 text-sm capitalize ${tab === t ? 'bg-surface text-ink font-medium shadow-sm ring-1 ring-line' : 'text-ink-muted hover:text-ink'}`}>
              {t}
            </button>
          ))}
        </div>
      </header>

      {message && (
        <p className={`rounded-lg border px-4 py-3 text-sm ${message.ok ? 'border-accent-line bg-accent-soft text-accent-ink' : 'border-danger-line bg-danger-soft text-danger-ink'}`} role="status">{message.text}</p>
      )}

      {loading ? (
        <div className="h-72 rounded-xl bg-raised animate-pulse" aria-hidden="true" />
      ) : tab === 'calendario' ? (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="panel p-4"><p className="text-sm text-ink-faint">Lavori attivi</p><p className="mt-1 text-2xl font-semibold text-ink font-mono">{active.length}</p></div>
            <div className="panel p-4"><p className="text-sm text-ink-faint">Da pianificare</p><p className="mt-1 text-2xl font-semibold text-ink font-mono">{unplanned.length}</p></div>
            <div className="panel p-4"><p className="text-sm text-ink-faint">Consegne a rischio</p><p className={`mt-1 text-2xl font-semibold font-mono ${late.length ? 'text-danger-ink' : 'text-ink'}`}>{late.length}</p></div>
          </section>

          {printers.length === 0 ? (
            <section className="panel px-5 py-12 text-center">
              <CalendarClock className="mx-auto h-6 w-6 text-ink-faint" strokeWidth={1.5} />
              <p className="mt-3 font-medium text-ink">Nessuna stampante</p>
              <p className="mt-1 text-sm text-ink-muted">Aggiungi le stampanti nella pagina <Link href="/manutenzione" className="text-accent-ink underline underline-offset-4">Manutenzione</Link> per pianificare i lavori.</p>
            </section>
          ) : (
            <section className="panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => setWeekOffset(w => w - 1)} aria-label="Settimana precedente" className="grid h-9 w-9 place-items-center rounded-lg border border-line hover:bg-raised"><ChevronLeft className="h-4 w-4" /></button>
                  <button onClick={() => setWeekOffset(0)} className="btn btn-secondary btn-sm">Oggi</button>
                  <button onClick={() => setWeekOffset(w => w + 1)} aria-label="Settimana successiva" className="grid h-9 w-9 place-items-center rounded-lg border border-line hover:bg-raised"><ChevronRight className="h-4 w-4" /></button>
                  <span className="ml-2 text-sm text-ink-muted">
                    {rangeStart.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} – {new Date(rangeEnd.getTime() - 1).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <button onClick={scheduleAll} disabled={scheduling || unplanned.length === 0} className="btn btn-primary btn-sm">
                  <Wand2 className="h-4 w-4" /> {scheduling ? 'Pianificazione…' : 'Pianifica automaticamente'}
                </button>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-[160px_1fr] border-b border-line bg-sunken text-xs text-ink-faint">
                    <div className="px-4 py-2">Stampante</div>
                    <div className="grid grid-cols-7">
                      {days.map(d => (
                        <div key={d.toISOString()} className={`px-2 py-2 border-l border-line ${startOfDay(new Date()).getTime() === d.getTime() ? 'text-accent-ink font-medium' : ''}`}>
                          {d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' })}
                        </div>
                      ))}
                    </div>
                  </div>
                  {printers.map(p => {
                    const jobs = quotes.filter(q => q.production?.printerId === p.id && q.production?.plannedStart)
                      .filter(q => { const s = Date.parse(q.production!.plannedStart!); const e = plannedEnd(q)!.getTime(); return e > rangeStart.getTime() && s < rangeEnd.getTime(); });
                    return (
                      <div key={p.id} className="grid grid-cols-[160px_1fr] border-b border-line last:border-b-0">
                        <div className="px-4 py-3">
                          <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                          <p className={`text-xs ${p.status && p.status !== 'operativa' ? 'text-warn-ink' : 'text-ink-faint'}`}>{(p.status || 'operativa').replace('_', ' ')}</p>
                        </div>
                        <div className="relative h-16 grid grid-cols-7">
                          {days.map(d => <div key={d.toISOString()} className="border-l border-line" />)}
                          {now > rangeStart.getTime() && now < rangeEnd.getTime() && (
                            <div className="absolute inset-y-0 w-px bg-accent" style={{ left: `${((now - rangeStart.getTime()) / (7 * DAY)) * 100}%` }} aria-hidden="true" />
                          )}
                          {jobs.map(q => {
                            const s = Math.max(Date.parse(q.production!.plannedStart!), rangeStart.getTime());
                            const e = Math.min(plannedEnd(q)!.getTime(), rangeEnd.getTime());
                            const left = ((s - rangeStart.getTime()) / (7 * DAY)) * 100;
                            const width = Math.max(1.2, ((e - s) / (7 * DAY)) * 100);
                            const cls = isLate(q) ? 'bg-danger-soft border-danger-line text-danger-ink'
                              : q.status === 'in_stampa' ? 'bg-accent-soft border-accent-line text-accent-ink'
                              : q.urgent ? 'bg-warn-soft border-warn-line text-warn-ink'
                              : 'bg-info-soft border-info-line text-info-ink';
                            return (
                              <button key={q.id} onClick={() => setOpen(q)}
                                title={`${q.name} · ${q.clientName || ''} · ${fmtMin(plannedMinutes(q))}`}
                                className={`absolute top-2 bottom-2 overflow-hidden rounded-md border px-2 text-left text-xs ${cls}`}
                                style={{ left: `${left}%`, width: `${width}%` }}>
                                <span className="block truncate font-medium">{q.name}</span>
                                <span className="block truncate opacity-80">{fmtMin(plannedMinutes(q))}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          <section className="panel overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <h2 className="font-semibold text-ink">Da pianificare</h2>
              <p className="text-sm text-ink-muted mt-0.5">Lavori attivi senza inizio stampa: aprili per assegnarli, oppure usa la pianificazione automatica (urgenti e consegne più vicine per primi).</p>
            </div>
            {unplanned.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-muted">Tutti i lavori attivi sono pianificati.</p>
            ) : (
              <ul className="divide-y divide-line">
                {unplanned.map(q => (
                  <li key={q.id}>
                    <button onClick={() => setOpen(q)} className="w-full px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-left hover:bg-raised">
                      <span className="min-w-0">
                        <span className="block font-medium text-ink truncate">{q.name}</span>
                        <span className="block text-sm text-ink-faint">{q.clientName} · {STATUS_LABEL[q.status || 'in_attesa']} · {fmtMin(estimatedMinutes(q))}{q.production?.dueDate ? ` · consegna ${new Date(q.production.dueDate).toLocaleDateString('it-IT')}` : ''}</span>
                      </span>
                      {q.urgent && <span className="rounded-full border border-warn-line bg-warn-soft px-2 py-0.5 text-xs text-warn-ink">Urgente</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {late.length > 0 && (
            <section className="rounded-xl border border-danger-line bg-danger-soft p-5">
              <h2 className="flex items-center gap-2 font-semibold text-danger-ink"><TriangleAlert className="h-4 w-4" /> Consegne a rischio</h2>
              <ul className="mt-2 space-y-1 text-sm text-danger-ink">
                {late.map(q => (
                  <li key={q.id}>
                    <button onClick={() => setOpen(q)} className="underline underline-offset-4">{q.name}</button>: fine prevista {plannedEnd(q)!.toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}, promessa {new Date(q.production!.dueDate!).toLocaleDateString('it-IT')}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <section className="panel overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="flex items-center gap-2 font-semibold text-ink"><Scale className="h-4 w-4 text-ink-faint" /> Stime e consuntivi</h2>
            <p className="text-sm text-ink-muted mt-0.5">Lavori con grammi e ore reali registrati. Differenze positive: hai consumato più del previsto.</p>
          </div>
          {actuals.length === 0 ? (
            <p className="px-5 py-8 text-sm text-ink-muted">Nessun consuntivo ancora. Registralo dal pannello Produzione di un lavoro (pulsante a forma di fabbrica in Preventivi).</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead className="bg-sunken text-left text-ink-faint">
                  <tr>
                    <th className="px-4 py-2 font-medium">Lavoro</th>
                    <th className="px-4 py-2 font-medium text-right">Grammi stima → reali</th>
                    <th className="px-4 py-2 font-medium text-right">Tempo stima → reale</th>
                    <th className="px-4 py-2 font-medium text-right">Scarti</th>
                    <th className="px-4 py-2 font-medium text-right">Margine stimato</th>
                    <th className="px-4 py-2 font-medium text-right">Margine reale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {actuals.map(q => {
                    const eg = estimatedGrams(q), em = estimatedMinutes(q);
                    const rg = q.actual!.grams, rm = q.actual!.hours * 60;
                    const dg = eg ? Math.round(((rg - eg) / eg) * 100) : 0;
                    const dm = em ? Math.round(((rm - em) / em) * 100) : 0;
                    const rc = realCost(q, { costPerKg: (q.spoolId && spoolCost[q.spoolId]) || rates.costPerKg, machineRatePerHour: rates.machineRatePerHour, setupFee: rates.setupFee });
                    const delta = (v: number) => <span className={Math.abs(v) >= 15 ? (v > 0 ? 'text-danger-ink' : 'text-accent-ink') : 'text-ink-faint'}>{v > 0 ? '+' : ''}{v}%</span>;
                    return (
                      <tr key={q.id} className="hover:bg-raised cursor-pointer" onClick={() => setOpen(q)}>
                        <td className="px-4 py-2.5"><span className="font-medium text-ink">{q.name}</span><span className="block text-xs text-ink-faint">{q.clientName}</span></td>
                        <td className="px-4 py-2.5 text-right font-mono">{eg} → {rg} g {delta(dg)}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{fmtMin(em)} → {fmtMin(rm)} {delta(dm)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-ink-muted">{wasteGrams(q) ? `${wasteGrams(q)} g` : '–'}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-ink-muted">€{(Number(q.estimatedProfit) || 0).toFixed(2)}</td>
                        <td className={`px-4 py-2.5 text-right font-mono ${rc.margin < 0 ? 'text-danger-ink' : 'text-ink'}`}>€{rc.margin.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {open && (
        <ProductionDrawer
          quote={open}
          onClose={() => { setOpen(null); load(); }}
          onSaved={updated => setQuotes(prev => prev.map(x => (x.id === updated.id ? updated : x)))}
        />
      )}
    </div>
  );
}
