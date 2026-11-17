'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Save, RotateCcw, Gauge, Check, TriangleAlert } from 'lucide-react';
import { priceFromUsage, estimateUsageFromMesh, type PricingConfig } from '@/lib/pricing';

function NumberField({ label, value, onChange, step = 0.01, suffix, help, disabled }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string; help?: string; disabled?: boolean;
}) {
  const id = `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        <input
          id={id}
          type="number"
          step={step}
          value={Number.isFinite(value) ? value : 0}
          disabled={disabled}
          onChange={e => onChange(parseFloat(e.target.value))}
          className={`field font-mono ${suffix ? 'pr-14' : ''}`}
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint">{suffix}</span>}
      </div>
      {help && <p className="mt-1 text-xs text-ink-faint">{help}</p>}
    </div>
  );
}

export default function ListinoPage() {
  const [cfg, setCfg] = useState<PricingConfig | null>(null);
  const [defaults, setDefaults] = useState<PricingConfig | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // Anteprima: pezzo di prova
  const [sample, setSample] = useState({ grams: 50, hours: 2, qty: 1, material: 'PLA', volume: 40, surface: 90, height: 30 });

  useEffect(() => {
    fetch('/api/pricing').then(r => r.json()).then(d => {
      setCfg(d.pricing);
      setDefaults(d.defaults);
      setCanEdit(Boolean(d.canEdit));
    });
  }, []);

  const preview = useMemo(() => {
    if (!cfg) return null;
    const fromSlicer = priceFromUsage({ hours: sample.hours, grams: sample.grams, qty: sample.qty, material: sample.material }, cfg);
    const usage = estimateUsageFromMesh({ volumeCm3: sample.volume, surfaceCm2: sample.surface, sizeMm: { x: 50, y: 50, z: sample.height } }, sample.material, cfg);
    const fromMesh = priceFromUsage({ ...usage, qty: sample.qty, material: sample.material }, cfg);
    return { fromSlicer, usage, fromMesh };
  }, [cfg, sample]);

  if (!cfg) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-10 space-y-4" aria-hidden="true">
        <div className="h-8 w-48 rounded bg-raised animate-pulse" />
        <div className="h-64 rounded-xl bg-raised animate-pulse" />
      </div>
    );
  }

  const set = <K extends keyof PricingConfig>(k: K, v: PricingConfig[K]) => setCfg({ ...cfg, [k]: v });
  const setEst = (k: keyof PricingConfig['estimation'], v: number) => setCfg({ ...cfg, estimation: { ...cfg.estimation, [k]: v } });

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/pricing', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
      const data = await res.json();
      if (!res.ok) setMessage({ ok: false, text: data.error || 'Salvataggio non riuscito' });
      else {
        setCfg(data.pricing);
        setMessage({ ok: true, text: 'Listino salvato: le nuove stime del portale lo usano già.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const recalibrate = async () => {
    const res = await fetch('/api/pricing/calibrate', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      setCfg(data.pricing);
      const c = data.pricing.calibration;
      setMessage({ ok: true, text: c.samples >= 3 ? `Calibrazione aggiornata su ${c.samples} lavori.` : `Servono almeno 3 lavori con dati reali: per ora ${c.samples}.` });
    } else setMessage({ ok: false, text: data.error || 'Calibrazione non riuscita' });
  };

  const dis = !canEdit;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-8 lg:py-10 space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-[64ch]">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">Listino</h1>
          <p className="mt-2 text-ink-muted leading-relaxed">
            Regole di prezzo usate per le stime automatiche del portale clienti. Il calcolatore interno mantiene le sue impostazioni.
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => defaults && setCfg({ ...defaults, calibration: cfg.calibration })} className="btn btn-secondary">
              <RotateCcw className="h-4 w-4" strokeWidth={1.75} /> Valori predefiniti
            </button>
            <button onClick={save} disabled={saving} className="btn btn-primary">
              <Save className="h-4 w-4" strokeWidth={1.75} /> {saving ? 'Salvataggio…' : 'Salva listino'}
            </button>
          </div>
        )}
      </header>

      {message && (
        <p className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${message.ok ? 'border-accent-line bg-accent-soft text-accent-ink' : 'border-danger-line bg-danger-soft text-danger-ink'}`} role="status">
          {message.ok ? <Check className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />} {message.text}
        </p>
      )}
      {!canEdit && <p className="text-sm text-ink-muted">Solo un amministratore può modificare il listino.</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="space-y-6">
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="font-semibold text-ink">Materiali</h2>
              {canEdit && (
                <button
                  onClick={() => set('materials', [...cfg.materials, { key: `mat${Date.now()}`, label: 'Nuovo materiale', match: ['NOME'], pricePerKg: 25, density: 1.24, surchargePct: 0 }])}
                  className="btn btn-secondary btn-sm"
                >
                  <Plus className="h-3.5 w-3.5" /> Aggiungi
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-sunken text-left text-ink-faint">
                  <tr>
                    <th className="px-4 py-2 font-medium">Nome</th>
                    <th className="px-4 py-2 font-medium">Riconosce</th>
                    <th className="px-4 py-2 font-medium">€/kg</th>
                    <th className="px-4 py-2 font-medium">g/cm³</th>
                    <th className="px-4 py-2 font-medium">Suppl. %</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {cfg.materials.map((m, i) => {
                    const upd = (patch: Partial<typeof m>) => set('materials', cfg.materials.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                    return (
                      <tr key={m.key}>
                        <td className="px-4 py-2"><input aria-label="Nome" disabled={dis} className="field" value={m.label} onChange={e => upd({ label: e.target.value })} /></td>
                        <td className="px-4 py-2"><input aria-label="Parole chiave" disabled={dis} className="field font-mono" value={m.match.join(', ')} onChange={e => upd({ match: e.target.value.split(',').map(x => x.trim()) })} /></td>
                        <td className="px-4 py-2 w-24"><input aria-label="Prezzo al kg" disabled={dis} type="number" step="0.5" className="field font-mono" value={m.pricePerKg} onChange={e => upd({ pricePerKg: parseFloat(e.target.value) })} /></td>
                        <td className="px-4 py-2 w-24"><input aria-label="Densità" disabled={dis} type="number" step="0.01" className="field font-mono" value={m.density} onChange={e => upd({ density: parseFloat(e.target.value) })} /></td>
                        <td className="px-4 py-2 w-24"><input aria-label="Supplemento" disabled={dis} type="number" step="1" className="field font-mono" value={m.surchargePct} onChange={e => upd({ surchargePct: parseFloat(e.target.value) })} /></td>
                        <td className="px-2 py-2">
                          {canEdit && cfg.materials.length > 1 && (
                            <button onClick={() => set('materials', cfg.materials.filter((_, j) => j !== i))} className="grid h-9 w-9 place-items-center rounded-lg text-ink-faint hover:bg-danger-soft hover:text-danger-ink" aria-label={`Rimuovi ${m.label}`}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="px-5 py-3 text-xs text-ink-faint border-t border-line">
              &quot;Riconosce&quot; elenca le parole cercate nel nome del materiale scelto dal cliente (es. PETG, ASA). Il primo materiale vale come predefinito.
            </p>
          </section>

          <section className="panel p-5 space-y-4">
            <h2 className="font-semibold text-ink">Costi e margine</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField disabled={dis} label="Costo macchina" suffix="€/h" value={cfg.machineRatePerHour} onChange={v => set('machineRatePerHour', v)} help="Corrente e ammortamento" />
              <NumberField disabled={dis} label="Avvio lavoro" suffix="€" value={cfg.setupFee} onChange={v => set('setupFee', v)} help="Preparazione e distacco, per pezzo" />
              <NumberField disabled={dis} label="Margine" suffix="%" step={1} value={cfg.marginPct} onChange={v => set('marginPct', v)} />
              <NumberField disabled={dis} label="Prezzo minimo" suffix="€" value={cfg.minPrice} onChange={v => set('minPrice', v)} help="Per pezzo" />
              <NumberField disabled={dis} label="Arrotonda a" suffix="€" value={cfg.roundTo} onChange={v => set('roundTo', v)} />
              <NumberField disabled={dis} label="Urgenza" suffix="%" step={1} value={cfg.urgencySurchargePct} onChange={v => set('urgencySurchargePct', v)} />
              <NumberField disabled={dis} label="Spreco multicolore" suffix="×" value={cfg.multicolorWasteFactor} onChange={v => set('multicolorWasteFactor', v)} help="Moltiplica i grammi (spurghi AMS)" />
              <NumberField disabled={dis} label="Supplemento multicolore" suffix="%" step={1} value={cfg.multicolorSurchargePct} onChange={v => set('multicolorSurchargePct', v)} />
            </div>
          </section>

          <section className="panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-ink">Sconti per quantità</h2>
              {canEdit && (
                <button onClick={() => set('quantityTiers', [...cfg.quantityTiers, { minQty: 100, discountPct: 15 }])} className="btn btn-secondary btn-sm">
                  <Plus className="h-3.5 w-3.5" /> Scaglione
                </button>
              )}
            </div>
            {cfg.quantityTiers.length === 0 && <p className="text-sm text-ink-muted">Nessuno sconto: il prezzo unitario non cambia con la quantità.</p>}
            <ul className="space-y-2">
              {cfg.quantityTiers.map((t, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                  <span>Da</span>
                  <input aria-label="Quantità minima" disabled={dis} type="number" className="field w-24 font-mono" value={t.minQty}
                    onChange={e => set('quantityTiers', cfg.quantityTiers.map((x, j) => (j === i ? { ...x, minQty: parseInt(e.target.value, 10) } : x)))} />
                  <span>pezzi, sconto</span>
                  <input aria-label="Sconto" disabled={dis} type="number" className="field w-20 font-mono" value={t.discountPct}
                    onChange={e => set('quantityTiers', cfg.quantityTiers.map((x, j) => (j === i ? { ...x, discountPct: parseFloat(e.target.value) } : x)))} />
                  <span>%</span>
                  {canEdit && (
                    <button onClick={() => set('quantityTiers', cfg.quantityTiers.filter((_, j) => j !== i))} className="grid h-9 w-9 place-items-center rounded-lg text-ink-faint hover:bg-danger-soft hover:text-danger-ink" aria-label="Rimuovi scaglione">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="panel p-5 space-y-4">
            <h2 className="font-semibold text-ink">Stampante e stima dal modello</h2>
            <p className="text-sm text-ink-muted max-w-[70ch]">
              Quando il cliente carica un STL senza dati dello slicer, grammi e ore si ricavano da volume e superficie con questi parametri, poi si correggono con la calibrazione.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField disabled={dis} label="Piano X" suffix="mm" step={1} value={cfg.buildVolume.x} onChange={v => set('buildVolume', { ...cfg.buildVolume, x: v })} />
              <NumberField disabled={dis} label="Piano Y" suffix="mm" step={1} value={cfg.buildVolume.y} onChange={v => set('buildVolume', { ...cfg.buildVolume, y: v })} />
              <NumberField disabled={dis} label="Altezza Z" suffix="mm" step={1} value={cfg.buildVolume.z} onChange={v => set('buildVolume', { ...cfg.buildVolume, z: v })} />
              <NumberField disabled={dis} label="Pareti" suffix="mm" step={0.1} value={cfg.estimation.wallMm} onChange={v => setEst('wallMm', v)} help="Spessore perimetri + superfici" />
              <NumberField disabled={dis} label="Riempimento" suffix="%" step={1} value={cfg.estimation.infillPct} onChange={v => setEst('infillPct', v)} />
              <NumberField disabled={dis} label="Velocità media" suffix="g/h" step={1} value={cfg.estimation.throughputGPerHour} onChange={v => setEst('throughputGPerHour', v)} />
              <NumberField disabled={dis} label="Altezza layer" suffix="mm" step={0.02} value={cfg.estimation.layerHeightMm} onChange={v => setEst('layerHeightMm', v)} />
              <NumberField disabled={dis} label="Tempo per layer" suffix="s" step={0.5} value={cfg.estimation.secondsPerLayer} onChange={v => setEst('secondsPerLayer', v)} help="Cambi layer e spostamenti" />
              <NumberField disabled={dis} label="Base minima" suffix="mm²" step={10} value={cfg.estimation.minBaseAreaMm2} onChange={v => setEst('minBaseAreaMm2', v)} help="Sotto: avviso supporti/brim" />
            </div>
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6">
          <section className="panel p-5 space-y-3">
            <h2 className="flex items-center gap-2 font-semibold text-ink"><Gauge className="h-4 w-4 text-ink-faint" /> Calibrazione</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-ink-faint">Grammi</dt><dd className="font-mono text-lg text-ink">× {cfg.calibration.gramsFactor}</dd></div>
              <div><dt className="text-ink-faint">Tempo</dt><dd className="font-mono text-lg text-ink">× {cfg.calibration.timeFactor}</dd></div>
            </dl>
            <p className="text-sm text-ink-muted">
              {cfg.calibration.samples >= 3
                ? `Basata su ${cfg.calibration.samples} lavori con dati reali.`
                : 'Non ancora attiva: servono almeno 3 lavori con geometria e grammi/ore reali (dallo slicer o dal consuntivo).'}
            </p>
            {canEdit && <button onClick={recalibrate} className="btn btn-secondary w-full"><RotateCcw className="h-4 w-4" /> Ricalcola ora</button>}
          </section>

          {preview && (
            <section className="panel p-5 space-y-4">
              <h2 className="font-semibold text-ink">Prova il listino</h2>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Grammi" step={1} value={sample.grams} onChange={v => setSample({ ...sample, grams: v })} />
                <NumberField label="Ore" step={0.25} value={sample.hours} onChange={v => setSample({ ...sample, hours: v })} />
                <NumberField label="Pezzi" step={1} value={sample.qty} onChange={v => setSample({ ...sample, qty: Math.max(1, v) })} />
                <div>
                  <label htmlFor="sample-mat" className="label">Materiale</label>
                  <select id="sample-mat" className="field" value={sample.material} onChange={e => setSample({ ...sample, material: e.target.value })}>
                    {cfg.materials.map(m => <option key={m.key} value={m.match[0] || m.label}>{m.label}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-sm text-ink-muted">
                Con dati dello slicer: <strong className="font-mono text-ink">€{preview.fromSlicer.singlePrice.toFixed(2)}</strong> al pezzo,
                totale <strong className="font-mono text-ink">€{preview.fromSlicer.total.toFixed(2)}</strong>
                {preview.fromSlicer.discountPct > 0 && ` (sconto ${preview.fromSlicer.discountPct}%)`}.
              </p>
              <div className="border-t border-line pt-3 grid grid-cols-3 gap-3">
                <NumberField label="Volume" suffix="cm³" step={1} value={sample.volume} onChange={v => setSample({ ...sample, volume: v })} />
                <NumberField label="Superficie" suffix="cm²" step={1} value={sample.surface} onChange={v => setSample({ ...sample, surface: v })} />
                <NumberField label="Altezza" suffix="mm" step={1} value={sample.height} onChange={v => setSample({ ...sample, height: v })} />
              </div>
              <p className="text-sm text-ink-muted">
                Da STL: circa <strong className="font-mono text-ink">{preview.usage.grams} g</strong> e{' '}
                <strong className="font-mono text-ink">{Math.floor(preview.usage.hours)}h {Math.round((preview.usage.hours % 1) * 60)}m</strong>,
                {' '}<strong className="font-mono text-ink">€{preview.fromMesh.singlePrice.toFixed(2)}</strong> al pezzo.
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
