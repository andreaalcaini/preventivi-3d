'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Copy, Check, Plus, Ban, Trash2, TriangleAlert, FileJson } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scope: 'read' | 'write';
  createdBy: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

const EXPIRY_OPTIONS = [
  { value: '', label: 'Nessuna scadenza' },
  { value: '30', label: '30 giorni' },
  { value: '90', label: '90 giorni' },
  { value: '365', label: '1 anno' },
];

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function keyState(k: ApiKey): { label: string; cls: string } {
  if (k.revokedAt) return { label: 'Revocata', cls: 'bg-danger-soft text-danger-ink border-danger-line' };
  if (k.expiresAt && Date.parse(k.expiresAt) < Date.now()) return { label: 'Scaduta', cls: 'bg-warn-soft text-warn-ink border-warn-line' };
  return { label: 'Attiva', cls: 'bg-accent-soft text-accent-ink border-accent-line' };
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

const GUIDES = ['curl', 'Agenti AI', 'n8n e Make'] as const;

export default function IntegrazioniPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'read' | 'write'>('read');
  const [expiry, setExpiry] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [newSecret, setNewSecret] = useState<{ name: string; secret: string } | null>(null);
  const [guide, setGuide] = useState<(typeof GUIDES)[number]>('curl');
  const [origin, setOrigin] = useState('https://il-tuo-server');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/api-keys');
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
        setCanManage(Boolean(data.canManage));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, scope, expiresInDays: expiry ? Number(expiry) : null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Impossibile creare la chiave');
        return;
      }
      setNewSecret({ name: data.key.name, secret: data.secret });
      setName('');
      setScope('read');
      setExpiry('');
      load();
    } catch {
      setError('Errore di rete, riprova');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (k: ApiKey) => {
    if (!confirm(`Revocare la chiave "${k.name}"? I sistemi che la usano smetteranno subito di funzionare.`)) return;
    await fetch('/api/api-keys', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: k.id, action: 'revoke' }),
    });
    load();
  };

  const handleDelete = async (k: ApiKey) => {
    if (!confirm(`Eliminare definitivamente la chiave "${k.name}" dall'elenco?`)) return;
    await fetch(`/api/api-keys?id=${encodeURIComponent(k.id)}`, { method: 'DELETE' });
    load();
  };

  const openapiUrl = `${origin}/api/public/openapi.json`;
  const sampleKey = newSecret?.secret || 'p3d_LA_TUA_CHIAVE';

  const guides: Record<(typeof GUIDES)[number], React.ReactNode> = {
    curl: (
      <div className="space-y-3">
        <p className="text-sm text-ink-muted">Lavori in attesa, dal più recente:</p>
        <CodeBlock code={`curl -H "Authorization: Bearer ${sampleKey}" \\\n  "${origin}/api/v1/quotes?status=in_attesa"`} />
        <p className="text-sm text-ink-muted">Segna un lavoro come in stampa (serve una chiave con scrittura):</p>
        <CodeBlock code={`curl -X PATCH -H "Authorization: Bearer ${sampleKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"status":"in_stampa"}' \\\n  "${origin}/api/v1/quotes/ID_PREVENTIVO"`} />
      </div>
    ),
    'Agenti AI': (
      <div className="space-y-3 text-sm text-ink-muted max-w-[70ch]">
        <p>
          ChatGPT (GPT Actions), Claude con un bridge OpenAPI verso MCP, LangChain, LlamaIndex e la maggior parte dei framework per agenti
          leggono una specifica OpenAPI e trasformano ogni endpoint in uno strumento. Importa questo indirizzo:
        </p>
        <CodeBlock code={openapiUrl} />
        <p>
          Come autenticazione scegli <span className="font-medium text-ink">API key</span>, tipo <span className="font-medium text-ink">Bearer</span>,
          e incolla la chiave. Per un assistente che deve solo rispondere a domande usa una chiave in sola lettura.
        </p>
        <p>Per dare contesto all&apos;agente puoi usare un prompt di sistema come questo:</p>
        <CodeBlock code={`Hai accesso al gestionale di stampa 3D del laboratorio tramite gli strumenti listQuotes, getQuote, getInventory, getAnalytics e getMaintenance. Gli stati dei lavori sono: richiesta, in_attesa, in_stampa, pronto, saldato. I prezzi sono in euro e i pesi in grammi. Prima di cambiare lo stato di un lavoro chiedi conferma.`} />
      </div>
    ),
    'n8n e Make': (
      <div className="space-y-3 text-sm text-ink-muted max-w-[70ch]">
        <p>
          Usa un nodo HTTP Request. Metodo GET, URL <span className="font-mono text-ink">{origin}/api/v1/quotes</span>, header
          <span className="font-mono text-ink"> Authorization</span> con valore <span className="font-mono text-ink">Bearer {sampleKey}</span>.
        </p>
        <p>Esempio: ogni mattina leggi i lavori con stato <span className="font-mono text-ink">pronto</span> e manda un promemoria ai clienti.</p>
        <CodeBlock code={`GET ${origin}/api/v1/quotes?status=pronto\nAuthorization: Bearer ${sampleKey}`} />
      </div>
    ),
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-8 lg:py-10 space-y-10">
      <header className="max-w-[70ch]">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">Integrazioni API</h1>
        <p className="mt-2 text-ink-muted leading-relaxed">
          Crea chiavi per collegare il gestionale ad assistenti AI, automazioni e script. Ogni chiave vale solo per le API e non può gestire utenti, chiavi o backup.
        </p>
      </header>

      {newSecret && (
        <section className="rounded-xl border border-accent-line bg-accent-soft p-5 sm:p-6" aria-live="polite">
          <div className="flex items-start gap-3">
            <KeyRound className="h-5 w-5 text-accent-ink mt-0.5 shrink-0" strokeWidth={1.75} />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <h2 className="font-semibold text-ink">Chiave &quot;{newSecret.name}&quot; creata</h2>
                <p className="text-sm text-ink-muted mt-1">Copiala adesso: per sicurezza non verrà più mostrata.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <code className="flex-1 min-w-0 break-all rounded-lg border border-accent-line bg-surface px-3 py-2.5 font-mono text-sm text-ink">
                  {newSecret.secret}
                </code>
                <CopyButton text={newSecret.secret} label="Copia chiave" />
              </div>
              <button onClick={() => setNewSecret(null)} className="text-sm font-medium text-accent-ink underline underline-offset-4">
                L&apos;ho salvata, nascondi
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="font-semibold text-ink">Chiavi</h2>
            <span className="text-sm text-ink-faint">{keys.filter(k => keyState(k).label === 'Attiva').length} attive</span>
          </div>

          {loading ? (
            <div className="divide-y divide-line">
              {[0, 1, 2].map(i => (
                <div key={i} className="px-5 py-4 flex items-center gap-4">
                  <div className="h-4 w-32 rounded bg-raised animate-pulse" />
                  <div className="h-4 w-24 rounded bg-raised animate-pulse" />
                </div>
              ))}
            </div>
          ) : keys.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <KeyRound className="mx-auto h-6 w-6 text-ink-faint" strokeWidth={1.5} />
              <p className="mt-3 font-medium text-ink">Nessuna chiave</p>
              <p className="mt-1 text-sm text-ink-muted">
                {canManage ? 'Crea la prima chiave con il modulo qui accanto.' : 'Chiedi a un amministratore di crearne una.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {keys.map(k => {
                const st = keyState(k);
                const inactive = st.label !== 'Attiva';
                return (
                  <li key={k.id} className={`px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 ${inactive ? 'opacity-70' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink truncate">{k.name}</span>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                        <span className="inline-flex items-center rounded-full border border-line bg-raised px-2 py-0.5 text-xs text-ink-muted">
                          {k.scope === 'write' ? 'Lettura e scrittura' : 'Sola lettura'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-ink-faint">
                        <span className="font-mono text-ink-muted">{k.prefix}…</span>
                        {' · '}creata da {k.createdBy} il {formatDate(k.createdAt)}
                      </p>
                      <p className="text-sm text-ink-faint">
                        {k.lastUsedAt ? `Ultimo uso ${formatDate(k.lastUsedAt)}` : 'Mai usata'}
                        {k.expiresAt && !k.revokedAt ? ` · scade il ${formatDate(k.expiresAt)}` : ''}
                      </p>
                    </div>
                    {canManage && (
                      <div className="flex gap-2 shrink-0">
                        {!k.revokedAt ? (
                          <button onClick={() => handleRevoke(k)} className="btn btn-danger btn-sm">
                            <Ban className="h-3.5 w-3.5" strokeWidth={1.75} /> Revoca
                          </button>
                        ) : (
                          <button onClick={() => handleDelete(k)} className="btn btn-secondary btn-sm">
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} /> Elimina
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="panel p-5">
          <h2 className="font-semibold text-ink">Nuova chiave</h2>
          {canManage ? (
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label htmlFor="key-name" className="label">Nome</label>
                <input
                  id="key-name"
                  className="field"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={60}
                  required
                  aria-describedby="key-name-help"
                />
                <p id="key-name-help" className="mt-1.5 text-xs text-ink-faint">Dove la userai, per esempio &quot;Assistente ChatGPT&quot;.</p>
              </div>

              <fieldset>
                <legend className="label">Permessi</legend>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-sunken p-1">
                  {(['read', 'write'] as const).map(s => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setScope(s)}
                      aria-pressed={scope === s}
                      className={`min-h-9 rounded-md text-sm transition-colors ${scope === s ? 'bg-surface text-ink font-medium shadow-sm ring-1 ring-line' : 'text-ink-muted hover:text-ink'}`}
                    >
                      {s === 'read' ? 'Sola lettura' : 'Scrittura'}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink-faint">
                  {scope === 'read' ? 'Può leggere preventivi, magazzino e statistiche.' : 'Può anche cambiare lo stato dei lavori e modificare i dati.'}
                </p>
              </fieldset>

              <div>
                <label htmlFor="key-expiry" className="label">Scadenza</label>
                <select id="key-expiry" className="field" value={expiry} onChange={e => setExpiry(e.target.value)}>
                  {EXPIRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {error && (
                <p className="flex items-start gap-2 text-sm text-danger-ink" role="alert">
                  <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={1.75} /> {error}
                </p>
              )}

              <button type="submit" disabled={creating || !name.trim()} className="btn btn-primary w-full">
                <Plus className="h-4 w-4" strokeWidth={2} /> {creating ? 'Creazione…' : 'Crea chiave'}
              </button>
            </form>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">Solo un amministratore può creare o revocare chiavi.</p>
          )}
        </div>
      </section>

      <section className="space-y-5">
        <div className="max-w-[70ch]">
          <h2 className="text-lg font-semibold text-ink">Come collegarsi</h2>
          <p className="mt-1 text-sm text-ink-muted leading-relaxed">
            Invia la chiave nell&apos;header <span className="font-mono text-ink">Authorization: Bearer</span> oppure in <span className="font-mono text-ink">X-API-Key</span>.
          </p>
        </div>

        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
            <div className="flex gap-1" role="tablist">
              {GUIDES.map(g => (
                <button
                  key={g}
                  role="tab"
                  aria-selected={guide === g}
                  onClick={() => setGuide(g)}
                  className={`min-h-9 rounded-lg px-3 text-sm transition-colors ${guide === g ? 'bg-raised text-ink font-medium' : 'text-ink-muted hover:text-ink'}`}
                >
                  {g}
                </button>
              ))}
            </div>
            <a href="/api/public/openapi.json" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-ink hover:underline underline-offset-4">
              <FileJson className="h-4 w-4" strokeWidth={1.75} /> Specifica OpenAPI
            </a>
          </div>
          <div className="p-5">{guides[guide]}</div>
        </div>

        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-sunken text-left text-ink-faint">
              <tr>
                <th className="px-5 py-2.5 font-medium">Endpoint</th>
                <th className="px-5 py-2.5 font-medium hidden sm:table-cell">Cosa fa</th>
                <th className="px-5 py-2.5 font-medium text-right">Permesso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[
                ['GET', '/api/v1/quotes', 'Elenco lavori, filtri per stato, cliente e testo', 'read'],
                ['GET', '/api/v1/quotes/{id}', 'Dettaglio completo di un preventivo', 'read'],
                ['PATCH', '/api/v1/quotes/{id}', 'Cambia lo stato e scarica il magazzino', 'write'],
                ['GET', '/api/v1/inventory', 'Bobine e componenti, filtro sotto scorta', 'read'],
                ['GET', '/api/analytics', 'Fatturato, margini, ore di stampa', 'read'],
                ['GET', '/api/maintenance', 'Stampanti e interventi', 'read'],
              ].map(([method, path, desc, perm]) => (
                <tr key={method + path}>
                  <td className="px-5 py-3 font-mono text-[13px] text-ink whitespace-nowrap">
                    <span className={`mr-2 inline-block w-12 font-medium ${method === 'GET' ? 'text-accent-ink' : 'text-warn-ink'}`}>{method}</span>
                    {path}
                  </td>
                  <td className="px-5 py-3 text-ink-muted hidden sm:table-cell">{desc}</td>
                  <td className="px-5 py-3 text-right text-ink-faint">{perm === 'write' ? 'Scrittura' : 'Lettura'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
