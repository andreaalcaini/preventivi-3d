'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyRound, Copy, Check, Plus, Ban, Trash2, TriangleAlert, FileJson, X, Pencil, RefreshCw,
  ShieldCheck, Globe, Gauge, Activity, ChevronRight,
} from 'lucide-react';
import {
  RESOURCES, PRESETS, RATE_LIMIT_OPTIONS, accessFor, scopeAllowedForRole, normalizeScopes,
  type Access, type Scope, type Role,
} from '@/lib/apiScopes';

interface UsageEvent { at: string; method: string; path: string; ip: string; status: number }
interface ApiKey {
  id: string;
  name: string;
  description: string;
  prefix: string;
  ownerId: string;
  ownerUsername: string;
  ownerActive: boolean;
  scopes: Scope[];
  allowedIps: string[];
  rateLimitPerMinute: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  rotatedAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  usage: { total: number; denied: number; last7Days: number[]; recent: UsageEvent[] };
}
interface Actor { id: string; username: string; role: Role }
interface UserOption { id: string; username: string; displayName: string; role: Role }

const EXPIRY_OPTIONS = [
  { value: '', label: 'Nessuna scadenza' },
  { value: '7', label: '7 giorni' },
  { value: '30', label: '30 giorni' },
  { value: '90', label: '90 giorni' },
  { value: '365', label: '1 anno' },
];

function formatDate(iso: string | null, withTime = true) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

function relative(iso: string | null) {
  if (!iso) return 'mai';
  const diff = Date.now() - Date.parse(iso);
  const m = Math.round(diff / 60000);
  if (m < 1) return 'adesso';
  if (m < 60) return `${m} min fa`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h fa`;
  return `${Math.round(h / 24)} g fa`;
}

function keyState(k: ApiKey): { label: string; cls: string; active: boolean } {
  if (k.revokedAt) return { label: 'Revocata', cls: 'bg-danger-soft text-danger-ink border-danger-line', active: false };
  if (!k.ownerActive) return { label: 'Proprietario rimosso', cls: 'bg-danger-soft text-danger-ink border-danger-line', active: false };
  if (k.expiresAt && Date.parse(k.expiresAt) < Date.now()) return { label: 'Scaduta', cls: 'bg-warn-soft text-warn-ink border-warn-line', active: false };
  return { label: 'Attiva', cls: 'bg-accent-soft text-accent-ink border-accent-line', active: true };
}

function CopyButton({ text, label = 'Copia' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
      className="btn btn-secondary btn-sm shrink-0"
    >
      {done ? <Check className="h-3.5 w-3.5 text-accent" strokeWidth={2} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />}
      {done ? 'Copiata' : label}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative rounded-lg border border-line bg-sunken">
      <div className="absolute right-2 top-2"><CopyButton text={code} /></div>
      <pre className="overflow-x-auto p-4 pr-28 text-[13px] leading-relaxed font-mono text-ink"><code>{code}</code></pre>
    </div>
  );
}

function ScopeBadges({ scopes }: { scopes: Scope[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {RESOURCES.map(r => {
        const a = accessFor(scopes, r.id);
        if (a === 'none') return null;
        return (
          <span key={r.id} className="inline-flex items-center gap-1 rounded-full border border-line bg-raised px-2 py-0.5 text-xs text-ink-muted">
            {r.label}
            <span className={a === 'write' ? 'font-medium text-warn-ink' : 'text-ink-faint'}>{a === 'write' ? 'scrittura' : 'lettura'}</span>
          </span>
        );
      })}
    </div>
  );
}

function UsageBars({ days }: { days: number[] }) {
  const max = Math.max(1, ...days);
  return (
    <div className="flex items-end gap-1 h-12" aria-label={`Richieste negli ultimi 7 giorni: ${days.join(', ')}`}>
      {days.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col justify-end h-full" title={`${d} richieste`}>
          <div className={`rounded-sm ${d ? 'bg-accent' : 'bg-muted'}`} style={{ height: `${Math.max(6, (d / max) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}

/* ---------------- editor (creazione e modifica) ---------------- */

interface EditorState {
  mode: 'create' | 'edit';
  id?: string;
  name: string;
  description: string;
  ownerId: string;
  scopes: Scope[];
  allowedIps: string;
  rateLimitPerMinute: number;
  expiry: string;
}

function KeyEditor({
  state, actor, users, onClose, onSaved,
}: {
  state: EditorState;
  actor: Actor;
  users: UserOption[];
  onClose: () => void;
  onSaved: (result: { secret?: string; name: string }) => void;
}) {
  const [s, setS] = useState<EditorState>(state);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const ownerRole: Role = users.find(u => u.id === s.ownerId)?.role || actor.role;

  const setAccess = (resource: string, access: Access) => {
    const rest = s.scopes.filter(sc => !sc.startsWith(`${resource}:`));
    const add: Scope[] = access === 'write' ? [`${resource}:read`, `${resource}:write`] : access === 'read' ? [`${resource}:read`] : [];
    setS({ ...s, scopes: normalizeScopes([...rest, ...add]) });
  };

  const applyPreset = (scopes: Scope[]) => {
    setS({ ...s, scopes: normalizeScopes(scopes.filter(sc => scopeAllowedForRole(sc, ownerRole))) });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const payload = {
      name: s.name,
      description: s.description,
      scopes: s.scopes,
      allowedIps: s.allowedIps,
      rateLimitPerMinute: s.rateLimitPerMinute,
      ...(s.expiry !== 'keep' ? { expiresInDays: s.expiry ? Number(s.expiry) : 0 } : {}),
    };
    try {
      const res = await fetch('/api/api-keys', s.mode === 'create'
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, ownerId: s.ownerId }) }
        : { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, id: s.id, action: 'update' }) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Salvataggio non riuscito');
        return;
      }
      onSaved({ secret: data.secret, name: data.key.name });
    } catch {
      setError('Errore di rete, riprova');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="editor-title">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} />
      <form onSubmit={submit} className="relative flex h-full w-full max-w-2xl flex-col bg-canvas border-l border-line shadow-lg animate-slide-in">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-6">
          <h2 id="editor-title" className="text-lg font-semibold text-ink">{s.mode === 'create' ? 'Nuova chiave API' : 'Modifica chiave'}</h2>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-raised hover:text-ink">
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="k-name" className="label">Nome</label>
              <input id="k-name" className="field" value={s.name} maxLength={60} required onChange={e => setS({ ...s, name: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="k-desc" className="label">Uso previsto <span className="font-normal text-ink-faint">(facoltativo)</span></label>
              <textarea id="k-desc" rows={2} maxLength={280} className="field" value={s.description} onChange={e => setS({ ...s, description: e.target.value })} />
            </div>
            {s.mode === 'create' && actor.role === 'admin' && users.length > 0 && (
              <div className="sm:col-span-2">
                <label htmlFor="k-owner" className="label">Proprietario</label>
                <select id="k-owner" className="field" value={s.ownerId} onChange={e => {
                  // Cambiando proprietario si tolgono i permessi che il suo ruolo non consente
                  const role = users.find(u => u.id === e.target.value)?.role || 'operatore';
                  setS({ ...s, ownerId: e.target.value, scopes: s.scopes.filter(sc => scopeAllowedForRole(sc, role)) });
                }}>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.displayName} (@{u.username}, {u.role === 'admin' ? 'amministratore' : 'operatore'})
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-ink-faint">La chiave non potrà mai fare più di quanto consente il ruolo del proprietario, e smette di funzionare se l&apos;utente viene eliminato.</p>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-semibold text-ink">Permessi</h3>
              <span className="text-xs text-ink-faint">Ruolo proprietario: {ownerRole === 'admin' ? 'amministratore' : 'operatore'}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(p => (
                <button key={p.id} type="button" onClick={() => applyPreset(p.scopes)} title={p.description}
                  className="rounded-full border border-line bg-surface px-3 min-h-8 text-sm text-ink-muted hover:border-line-strong hover:text-ink">
                  {p.label}
                </button>
              ))}
            </div>
            <div className="panel divide-y divide-line">
              {RESOURCES.map(r => {
                const current = accessFor(s.scopes, r.id);
                const options: Access[] = ['none', 'read', ...(r.actions.includes('write') ? ['write' as Access] : [])];
                return (
                  <div key={r.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{r.label}</p>
                      <p className="text-xs text-ink-faint mt-0.5">{r.description}</p>
                    </div>
                    <div className="inline-grid shrink-0 grid-flow-col gap-1 rounded-lg border border-line bg-sunken p-1" role="radiogroup" aria-label={r.label}>
                      {options.map(o => {
                        const allowed = o === 'none' || scopeAllowedForRole(`${r.id}:${o}` as Scope, ownerRole);
                        return (
                          <button
                            key={o}
                            type="button"
                            role="radio"
                            aria-checked={current === o}
                            disabled={!allowed}
                            onClick={() => setAccess(r.id, o)}
                            title={allowed ? undefined : 'Non consentito dal ruolo del proprietario'}
                            className={`min-h-8 rounded-md px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                              current === o ? 'bg-surface text-ink font-medium shadow-sm ring-1 ring-line' : 'text-ink-muted hover:text-ink'
                            }`}
                          >
                            {o === 'none' ? 'Nessuno' : o === 'read' ? 'Lettura' : 'Scrittura'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <h3 className="sm:col-span-2 font-semibold text-ink">Limiti e restrizioni</h3>
            <div>
              <label htmlFor="k-rate" className="label">Richieste al minuto</label>
              <select id="k-rate" className="field" value={s.rateLimitPerMinute} onChange={e => setS({ ...s, rateLimitPerMinute: Number(e.target.value) })}>
                {RATE_LIMIT_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="k-exp" className="label">Scadenza</label>
              <select id="k-exp" className="field" value={s.expiry} onChange={e => setS({ ...s, expiry: e.target.value })}>
                {s.mode === 'edit' && <option value="keep">Non modificare</option>}
                {EXPIRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value && s.mode === 'edit' ? `${o.label} da oggi` : o.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="k-ips" className="label">IP consentiti <span className="font-normal text-ink-faint">(facoltativo)</span></label>
              <textarea id="k-ips" rows={2} className="field font-mono" value={s.allowedIps} onChange={e => setS({ ...s, allowedIps: e.target.value })} aria-describedby="k-ips-help" />
              <p id="k-ips-help" className="mt-1.5 text-xs text-ink-faint">
                Un indirizzo o una rete per riga, per esempio 192.168.1.0/24. Vuoto = da qualsiasi IP. Dietro un reverse proxy conta l&apos;indirizzo in X-Forwarded-For.
              </p>
            </div>
          </section>
        </div>

        <div className="shrink-0 border-t border-line px-6 py-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {error ? (
            <p className="flex items-start gap-2 text-sm text-danger-ink" role="alert">
              <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={1.75} /> {error}
            </p>
          ) : (
            <p className="text-sm text-ink-faint">{s.scopes.length} permessi selezionati</p>
          )}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="btn btn-secondary">Annulla</button>
            <button type="submit" disabled={saving || !s.name.trim() || s.scopes.length === 0} className="btn btn-primary">
              {saving ? 'Salvataggio…' : s.mode === 'create' ? 'Crea chiave' : 'Salva modifiche'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ---------------- dettaglio chiave ---------------- */

function KeyDetail({
  k, onClose, onEdit, onRotate, onRevoke, onDelete,
}: {
  k: ApiKey;
  onClose: () => void;
  onEdit: () => void;
  onRotate: () => void;
  onRevoke: () => void;
  onDelete: () => void;
}) {
  const st = keyState(k);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-2xl flex-col bg-canvas border-l border-line shadow-lg animate-slide-in">
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line px-6">
          <div className="min-w-0 flex items-center gap-2">
            <h2 id="detail-title" className="truncate text-lg font-semibold text-ink">{k.name}</h2>
            <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-raised hover:text-ink">
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {k.description && <p className="text-ink-muted leading-relaxed">{k.description}</p>}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div><dt className="text-ink-faint">Chiave</dt><dd className="font-mono text-ink mt-0.5">{k.prefix}…</dd></div>
            <div><dt className="text-ink-faint">Proprietario</dt><dd className="text-ink mt-0.5">@{k.ownerUsername}</dd></div>
            <div><dt className="text-ink-faint">Creata</dt><dd className="text-ink mt-0.5">{formatDate(k.createdAt)} da {k.createdBy}</dd></div>
            <div><dt className="text-ink-faint">Scadenza</dt><dd className="text-ink mt-0.5">{k.expiresAt ? formatDate(k.expiresAt, false) : 'Nessuna'}</dd></div>
            <div><dt className="text-ink-faint">Ultimo uso</dt><dd className="text-ink mt-0.5">{k.lastUsedAt ? `${relative(k.lastUsedAt)} da ${k.lastUsedIp}` : 'Mai usata'}</dd></div>
            <div><dt className="text-ink-faint">Rigenerata</dt><dd className="text-ink mt-0.5">{k.rotatedAt ? formatDate(k.rotatedAt) : 'Mai'}</dd></div>
          </dl>

          <section className="space-y-3">
            <h3 className="flex items-center gap-2 font-semibold text-ink"><ShieldCheck className="h-4 w-4 text-ink-faint" strokeWidth={1.75} /> Permessi</h3>
            <ScopeBadges scopes={k.scopes} />
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="panel p-4">
              <p className="flex items-center gap-2 text-sm text-ink-faint"><Gauge className="h-4 w-4" strokeWidth={1.75} /> Limite</p>
              <p className="mt-1 text-ink"><span className="font-mono text-lg font-semibold">{k.rateLimitPerMinute}</span> richieste/min</p>
            </div>
            <div className="panel p-4">
              <p className="flex items-center gap-2 text-sm text-ink-faint"><Globe className="h-4 w-4" strokeWidth={1.75} /> IP consentiti</p>
              <p className="mt-1 text-ink font-mono text-sm break-words">{k.allowedIps.length ? k.allowedIps.join(', ') : 'Qualsiasi'}</p>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="flex items-center gap-2 font-semibold text-ink"><Activity className="h-4 w-4 text-ink-faint" strokeWidth={1.75} /> Utilizzo</h3>
            <div className="panel p-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <p className="text-xs text-ink-faint mb-2">Ultimi 7 giorni</p>
                <UsageBars days={k.usage.last7Days} />
              </div>
              <div className="flex gap-6 text-sm">
                <div><p className="text-ink-faint">Riuscite</p><p className="font-mono text-lg font-semibold text-ink">{k.usage.total}</p></div>
                <div><p className="text-ink-faint">Rifiutate</p><p className={`font-mono text-lg font-semibold ${k.usage.denied ? 'text-danger-ink' : 'text-ink'}`}>{k.usage.denied}</p></div>
              </div>
            </div>
            {k.usage.recent.length > 0 ? (
              <div className="panel overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-sunken text-left text-ink-faint">
                    <tr>
                      <th className="px-4 py-2 font-medium">Quando</th>
                      <th className="px-4 py-2 font-medium">Richiesta</th>
                      <th className="px-4 py-2 font-medium hidden sm:table-cell">IP</th>
                      <th className="px-4 py-2 font-medium text-right">Esito</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {k.usage.recent.map((e, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-ink-muted whitespace-nowrap">{relative(e.at)}</td>
                        <td className="px-4 py-2 font-mono text-[13px] text-ink truncate max-w-[220px]">{e.method} {e.path}</td>
                        <td className="px-4 py-2 font-mono text-[13px] text-ink-muted hidden sm:table-cell">{e.ip}</td>
                        <td className={`px-4 py-2 text-right font-mono text-[13px] ${e.status < 400 ? 'text-accent-ink' : 'text-danger-ink'}`}>{e.status < 400 ? 'ok' : e.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-ink-faint">Nessuna richiesta registrata.</p>
            )}
          </section>
        </div>

        <div className="shrink-0 border-t border-line px-6 py-4 flex flex-wrap gap-2 justify-end">
          {!k.revokedAt ? (
            <>
              <button onClick={onRevoke} className="btn btn-danger mr-auto"><Ban className="h-4 w-4" strokeWidth={1.75} /> Revoca</button>
              <button onClick={onRotate} className="btn btn-secondary"><RefreshCw className="h-4 w-4" strokeWidth={1.75} /> Rigenera</button>
              <button onClick={onEdit} className="btn btn-primary"><Pencil className="h-4 w-4" strokeWidth={1.75} /> Modifica</button>
            </>
          ) : (
            <button onClick={onDelete} className="btn btn-secondary"><Trash2 className="h-4 w-4" strokeWidth={1.75} /> Elimina dall&apos;elenco</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- pagina ---------------- */

const GUIDES = ['curl', 'Agenti AI', 'n8n e Make'] as const;

const ENDPOINTS: Array<[string, string, string, string]> = [
  ['GET', '/api/v1/me', 'Chi sei e quali permessi hai', 'nessuno'],
  ['GET', '/api/v1/quotes', 'Elenco lavori con filtri', 'quotes:read'],
  ['POST', '/api/v1/quotes', 'Registra una nuova richiesta', 'quotes:write'],
  ['GET', '/api/v1/quotes/{id}', 'Dettaglio di un lavoro', 'quotes:read'],
  ['PATCH', '/api/v1/quotes/{id}', 'Cambia stato e scarica il magazzino', 'quotes:write'],
  ['GET', '/api/v1/clients', 'Clienti, totali e saldo', 'clients:read'],
  ['GET', '/api/v1/inventory', 'Bobine e componenti', 'inventory:read'],
  ['PATCH', '/api/v1/inventory/spools/{id}', 'Aggiorna il peso di una bobina', 'inventory:write'],
  ['GET', '/api/v1/maintenance', 'Stampanti e interventi', 'maintenance:read'],
  ['GET', '/api/v1/analytics', 'Fatturato e margini', 'analytics:read'],
];

export default function IntegrazioniPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [actor, setActor] = useState<Actor | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{ name: string; secret: string; rotated?: boolean } | null>(null);
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const [guide, setGuide] = useState<(typeof GUIDES)[number]>('curl');
  const [origin, setOrigin] = useState('https://il-tuo-server');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/api-keys');
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
        setActor(data.actor);
        setUsers(data.users || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    load();
  }, [load]);

  const detail = keys.find(k => k.id === detailId) || null;
  const visible = useMemo(() => keys.filter(k => filter === 'all' || keyState(k).active), [keys, filter]);
  const activeCount = keys.filter(k => keyState(k).active).length;
  const requests7d = keys.reduce((s, k) => s + k.usage.last7Days.reduce((a, b) => a + b, 0), 0);

  const openCreate = () => {
    if (!actor) return;
    setEditor({
      mode: 'create', name: '', description: '', ownerId: actor.id,
      scopes: PRESETS[0].scopes, allowedIps: '', rateLimitPerMinute: 120, expiry: '90',
    });
  };

  const openEdit = (k: ApiKey) => {
    setDetailId(null);
    setEditor({
      mode: 'edit', id: k.id, name: k.name, description: k.description, ownerId: k.ownerId,
      scopes: k.scopes, allowedIps: k.allowedIps.join('\n'), rateLimitPerMinute: k.rateLimitPerMinute, expiry: 'keep',
    });
  };

  const act = async (k: ApiKey, action: 'rotate' | 'revoke') => {
    const msg = action === 'rotate'
      ? `Rigenerare "${k.name}"? La chiave attuale smette subito di funzionare e ne riceverai una nuova con gli stessi permessi.`
      : `Revocare "${k.name}"? I sistemi che la usano smetteranno subito di funzionare.`;
    if (!confirm(msg)) return;
    const res = await fetch('/api/api-keys', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: k.id, action }),
    });
    const data = await res.json().catch(() => ({}));
    if (action === 'rotate' && res.ok) {
      setDetailId(null);
      setRevealed({ name: k.name, secret: data.secret, rotated: true });
    }
    load();
  };

  const remove = async (k: ApiKey) => {
    if (!confirm(`Eliminare definitivamente "${k.name}" e il suo storico di utilizzo?`)) return;
    await fetch(`/api/api-keys?id=${encodeURIComponent(k.id)}`, { method: 'DELETE' });
    setDetailId(null);
    load();
  };

  const sampleKey = revealed?.secret || 'p3d_LA_TUA_CHIAVE';

  const guides: Record<(typeof GUIDES)[number], React.ReactNode> = {
    curl: (
      <div className="space-y-3">
        <p className="text-sm text-ink-muted">Controlla chi sei e quali permessi hai:</p>
        <CodeBlock code={`curl -H "Authorization: Bearer ${sampleKey}" ${origin}/api/v1/me`} />
        <p className="text-sm text-ink-muted">Lavori in attesa e passaggio in stampa:</p>
        <CodeBlock code={`curl -H "Authorization: Bearer ${sampleKey}" \\\n  "${origin}/api/v1/quotes?status=in_attesa"\n\ncurl -X PATCH -H "Authorization: Bearer ${sampleKey}" \\\n  -H "Content-Type: application/json" -d '{"status":"in_stampa"}' \\\n  "${origin}/api/v1/quotes/ID_LAVORO"`} />
      </div>
    ),
    'Agenti AI': (
      <div className="space-y-3 text-sm text-ink-muted max-w-[72ch]">
        <p>
          ChatGPT (GPT Actions), Claude con un bridge OpenAPI verso MCP, LangChain, LlamaIndex e la maggior parte dei framework per agenti
          trasformano ogni endpoint della specifica in uno strumento. Importa questo indirizzo e scegli autenticazione Bearer con la chiave:
        </p>
        <CodeBlock code={`${origin}/api/public/openapi.json`} />
        <p>Ogni operazione dichiara il permesso che richiede (<span className="font-mono text-ink">x-required-scope</span>), così l&apos;agente sa cosa può fare. Prompt di sistema consigliato:</p>
        <CodeBlock code={`Hai accesso al gestionale di stampa 3D del laboratorio tramite strumenti API. All'inizio chiama getMe per conoscere i tuoi permessi e non tentare operazioni che non hai. Stati dei lavori: richiesta, in_attesa, in_stampa, pronto, saldato. Prezzi in euro, pesi in grammi, tempi in minuti. Prima di cambiare lo stato di un lavoro o il magazzino chiedi conferma all'utente. Se ricevi 429 aspetta i secondi indicati in Retry-After.`} />
      </div>
    ),
    'n8n e Make': (
      <div className="space-y-3 text-sm text-ink-muted max-w-[72ch]">
        <p>
          Usa un nodo HTTP Request con header <span className="font-mono text-ink">Authorization</span> = <span className="font-mono text-ink">Bearer {sampleKey}</span>.
          Esempio: ogni mattina leggi i lavori pronti e manda un promemoria ai clienti; ogni sera controlla le bobine sotto scorta.
        </p>
        <CodeBlock code={`GET ${origin}/api/v1/quotes?status=pronto\nGET ${origin}/api/v1/inventory?lowStock=true\nAuthorization: Bearer ${sampleKey}`} />
      </div>
    ),
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-8 lg:py-10 space-y-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-[64ch]">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">Integrazioni API</h1>
          <p className="mt-2 text-ink-muted leading-relaxed">
            Chiavi personali per collegare il gestionale ad assistenti AI, automazioni e script, con permessi per area, limiti e registro di utilizzo.
          </p>
        </div>
        <button onClick={openCreate} disabled={!actor} className="btn btn-primary shrink-0">
          <Plus className="h-4 w-4" strokeWidth={2} /> Nuova chiave
        </button>
      </header>

      {revealed && (
        <section className="rounded-xl border border-accent-line bg-accent-soft p-5 sm:p-6" aria-live="polite">
          <div className="flex items-start gap-3">
            <KeyRound className="h-5 w-5 text-accent-ink mt-0.5 shrink-0" strokeWidth={1.75} />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <h2 className="font-semibold text-ink">{revealed.rotated ? `Chiave "${revealed.name}" rigenerata` : `Chiave "${revealed.name}" creata`}</h2>
                <p className="text-sm text-ink-muted mt-1">Copiala adesso: per sicurezza non verrà più mostrata.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <code className="flex-1 min-w-0 break-all rounded-lg border border-accent-line bg-surface px-3 py-2.5 font-mono text-sm text-ink">{revealed.secret}</code>
                <CopyButton text={revealed.secret} label="Copia chiave" />
              </div>
              <button onClick={() => setRevealed(null)} className="text-sm font-medium text-accent-ink underline underline-offset-4">L&apos;ho salvata, nascondi</button>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-muted">
            <span className="font-medium text-ink">{activeCount}</span> attive · <span className="font-medium text-ink">{requests7d}</span> richieste negli ultimi 7 giorni
            {actor?.role === 'admin' ? ' · vedi le chiavi di tutti gli utenti' : ' · vedi solo le tue chiavi'}
          </p>
          <div className="inline-grid grid-flow-col gap-1 rounded-lg border border-line bg-sunken p-1">
            {(['active', 'all'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
                className={`min-h-8 rounded-md px-3 text-sm ${filter === f ? 'bg-surface text-ink font-medium shadow-sm ring-1 ring-line' : 'text-ink-muted hover:text-ink'}`}>
                {f === 'active' ? 'Attive' : 'Tutte'}
              </button>
            ))}
          </div>
        </div>

        <div className="panel overflow-hidden">
          {loading ? (
            <div className="divide-y divide-line">
              {[0, 1, 2].map(i => (
                <div key={i} className="px-5 py-5 flex items-center gap-4">
                  <div className="h-4 w-40 rounded bg-raised animate-pulse" />
                  <div className="h-4 w-56 rounded bg-raised animate-pulse" />
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <KeyRound className="mx-auto h-6 w-6 text-ink-faint" strokeWidth={1.5} />
              <p className="mt-3 font-medium text-ink">{keys.length ? 'Nessuna chiave attiva' : 'Nessuna chiave'}</p>
              <p className="mt-1 text-sm text-ink-muted">Crea una chiave e scegli solo i permessi che servono all&apos;integrazione.</p>
              <button onClick={openCreate} className="btn btn-secondary mt-5"><Plus className="h-4 w-4" strokeWidth={2} /> Nuova chiave</button>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {visible.map(k => {
                const st = keyState(k);
                const week = k.usage.last7Days.reduce((a, b) => a + b, 0);
                return (
                  <li key={k.id}>
                    <button onClick={() => setDetailId(k.id)} className={`w-full text-left px-5 py-4 grid gap-3 hover:bg-raised transition-colors md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_auto] md:items-center ${st.active ? '' : 'opacity-70'}`}>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-ink truncate">{k.name}</span>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                        </div>
                        <p className="mt-1 text-sm text-ink-faint truncate">
                          <span className="font-mono text-ink-muted">{k.prefix}…</span> · @{k.ownerUsername} · usata {relative(k.lastUsedAt)}
                        </p>
                      </div>
                      <ScopeBadges scopes={k.scopes} />
                      <div className="flex items-center gap-4 justify-between md:justify-end">
                        <div className="w-24"><UsageBars days={k.usage.last7Days} /></div>
                        <span className="font-mono text-sm text-ink-muted w-10 text-right">{week}</span>
                        <ChevronRight className="h-4 w-4 text-ink-faint" strokeWidth={1.75} />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-5">
        <div className="max-w-[70ch]">
          <h2 className="text-lg font-semibold text-ink">Come collegarsi</h2>
          <p className="mt-1 text-sm text-ink-muted leading-relaxed">
            Invia la chiave in <span className="font-mono text-ink">Authorization: Bearer</span> oppure <span className="font-mono text-ink">X-API-Key</span>.
            Ogni risposta riporta il limite residuo in <span className="font-mono text-ink">X-RateLimit-Remaining</span>.
          </p>
        </div>

        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
            <div className="flex gap-1" role="tablist">
              {GUIDES.map(gd => (
                <button key={gd} role="tab" aria-selected={guide === gd} onClick={() => setGuide(gd)}
                  className={`min-h-9 rounded-lg px-3 text-sm transition-colors ${guide === gd ? 'bg-raised text-ink font-medium' : 'text-ink-muted hover:text-ink'}`}>
                  {gd}
                </button>
              ))}
            </div>
            <a href="/api/public/openapi.json" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-ink hover:underline underline-offset-4">
              <FileJson className="h-4 w-4" strokeWidth={1.75} /> Specifica OpenAPI
            </a>
          </div>
          <div className="p-5">{guides[guide]}</div>
        </div>

        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sunken text-left text-ink-faint">
              <tr>
                <th className="px-5 py-2.5 font-medium">Endpoint</th>
                <th className="px-5 py-2.5 font-medium hidden md:table-cell">Cosa fa</th>
                <th className="px-5 py-2.5 font-medium text-right">Permesso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ENDPOINTS.map(([method, p, desc, perm]) => (
                <tr key={method + p}>
                  <td className="px-5 py-3 font-mono text-[13px] text-ink whitespace-nowrap">
                    <span className={`mr-2 inline-block w-12 font-medium ${method === 'GET' ? 'text-accent-ink' : 'text-warn-ink'}`}>{method}</span>
                    {p}
                  </td>
                  <td className="px-5 py-3 text-ink-muted hidden md:table-cell">{desc}</td>
                  <td className="px-5 py-3 text-right font-mono text-[13px] text-ink-faint whitespace-nowrap">{perm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editor && actor && (
        <KeyEditor
          state={editor}
          actor={actor}
          users={users}
          onClose={() => setEditor(null)}
          onSaved={({ secret, name }) => {
            setEditor(null);
            if (secret) setRevealed({ name, secret });
            load();
          }}
        />
      )}

      {detail && (
        <KeyDetail
          k={detail}
          onClose={() => setDetailId(null)}
          onEdit={() => openEdit(detail)}
          onRotate={() => act(detail, 'rotate')}
          onRevoke={() => act(detail, 'revoke')}
          onDelete={() => remove(detail)}
        />
      )}
    </div>
  );
}
