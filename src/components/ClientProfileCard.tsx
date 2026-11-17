'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Save, Check, NotebookPen } from 'lucide-react';

interface Profile {
  name: string;
  company: string;
  contacts: Array<{ label: string; value: string }>;
  address: string;
  notes: string;
  tags: string[];
}

const empty = (name: string): Profile => ({ name, company: '', contacts: [], address: '', notes: '', tags: [] });

/** Scheda anagrafica del cliente: azienda, recapiti multipli, indirizzo, etichette e note interne. */
export default function ClientProfileCard({ name, knownContacts }: { name: string; knownContacts: string[] }) {
  const [p, setP] = useState<Profile>(empty(name));
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/clients?name=${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        const base = d.profile || empty(name);
        // Recapiti già presenti nei lavori, proposti se la scheda è vuota
        if (!d.profile && knownContacts.length) base.contacts = knownContacts.map(v => ({ label: v.includes('@') ? 'Email' : 'Telefono', value: v }));
        setP(base);
        setDirty(false);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => { cancelled = true; };
  }, [name, knownContacts]);

  const upd = (patch: Partial<Profile>) => { setP(prev => ({ ...prev, ...patch })); setDirty(true); setSaved(false); };

  const save = async () => {
    setSaving(true);
    const res = await fetch('/api/clients', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
    setSaving(false);
    if (res.ok) { setDirty(false); setSaved(true); }
  };

  if (!loaded) return <div className="h-40 rounded-xl bg-raised animate-pulse" aria-hidden="true" />;

  return (
    <section className="rounded-xl border border-line bg-surface p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><NotebookPen className="h-4 w-4 text-ink-faint" /> Scheda</h3>
        <button onClick={save} disabled={!dirty || saving} className="btn btn-secondary btn-sm">
          {saved && !dirty ? <><Check className="h-3.5 w-3.5 text-accent" /> Salvata</> : <><Save className="h-3.5 w-3.5" /> {saving ? 'Salvataggio…' : 'Salva'}</>}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="cp-company" className="label">Azienda</label>
          <input id="cp-company" className="field" value={p.company} onChange={e => upd({ company: e.target.value })} />
        </div>
        <div>
          <label htmlFor="cp-tags" className="label">Etichette</label>
          <input id="cp-tags" className="field" value={p.tags.join(', ')} onChange={e => upd({ tags: e.target.value.split(',').map(t => t.trim()) })} aria-describedby="cp-tags-help" />
          <p id="cp-tags-help" className="mt-1 text-xs text-ink-faint">Separate da virgola, es. ricorrente, B2B</p>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="cp-address" className="label">Indirizzo</label>
          <input id="cp-address" className="field" value={p.address} onChange={e => upd({ address: e.target.value })} />
        </div>
      </div>

      <div className="space-y-2">
        <p className="label mb-0">Recapiti</p>
        {p.contacts.map((c, i) => (
          <div key={i} className="grid grid-cols-[110px_1fr_auto] gap-2">
            <input aria-label="Tipo recapito" className="field" value={c.label} onChange={e => upd({ contacts: p.contacts.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            <input aria-label="Recapito" className="field font-mono" value={c.value} onChange={e => upd({ contacts: p.contacts.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
            <button onClick={() => upd({ contacts: p.contacts.filter((_, j) => j !== i) })} aria-label="Rimuovi recapito" className="grid h-10 w-10 place-items-center rounded-lg text-ink-faint hover:bg-danger-soft hover:text-danger-ink"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <button onClick={() => upd({ contacts: [...p.contacts, { label: 'Telefono', value: '' }] })} className="btn btn-secondary btn-sm"><Plus className="h-3.5 w-3.5" /> Recapito</button>
      </div>

      <div>
        <label htmlFor="cp-notes" className="label">Note interne</label>
        <textarea id="cp-notes" rows={3} className="field" value={p.notes} onChange={e => upd({ notes: e.target.value })} aria-describedby="cp-notes-help" />
        <p id="cp-notes-help" className="mt-1 text-xs text-ink-faint">Preferenze, accordi sui prezzi, materiali abituali. Non sono visibili al cliente.</p>
      </div>
    </section>
  );
}
