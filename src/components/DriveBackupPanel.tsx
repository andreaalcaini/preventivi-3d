'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Cloud, CloudUpload, Link2, Unlink, RotateCcw, Copy, Check, TriangleAlert } from 'lucide-react';

interface Status {
  configured: boolean; credentialsFromEnv: boolean; clientId: string; hasSecret: boolean; connected: boolean;
  accountEmail: string; schedule: 'off' | 'daily' | 'weekly'; hour: number; keep: number;
  lastUploadAt: string | null; lastFileName: string | null; lastError: string | null;
}
interface DriveFile { id: string; name: string; size: number; createdTime: string }

const NOTICES: Record<string, { ok: boolean; text: string }> = {
  collegato: { ok: true, text: 'Google Drive collegato. Il primo backup parte all\'orario impostato, oppure caricalo subito.' },
  annullato: { ok: false, text: 'Collegamento annullato su Google.' },
  errore: { ok: false, text: 'Collegamento non riuscito: controlla Client ID, Client Secret e URI di reindirizzamento, poi riprova.' },
  permesso: { ok: false, text: 'Solo un amministratore può collegare Google Drive.' },
};

function when(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'mai';
}

/** Backup su Google Drive: configurazione OAuth, collegamento, caricamento automatico e ripristino. */
export default function DriveBackupPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [redirectUri, setRedirectUri] = useState('');
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [listError, setListError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/backup/drive?list=1');
    if (res.status === 403) { setForbidden(true); return; }
    const d = await res.json();
    setStatus(d.status);
    setRedirectUri(d.redirectUri);
    setFiles(d.files || []);
    setListError(d.listError || '');
    setClientId(d.status.clientId || '');
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('drive');
    if (q && NOTICES[q]) setNotice(NOTICES[q]);
    load();
  }, [load]);

  const call = async (method: 'PUT' | 'POST', body: Record<string, unknown>, label: string) => {
    setBusy(label);
    setNotice(null);
    try {
      const res = await fetch('/api/backup/drive', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) { setNotice({ ok: false, text: d.error || 'Operazione non riuscita' }); return null; }
      return d;
    } finally {
      setBusy('');
    }
  };

  if (forbidden) return null;
  if (!status) return <div className="h-32 rounded-xl bg-raised animate-pulse flex-shrink-0" aria-hidden="true" />;

  return (
    <section className="rounded-xl border border-line bg-surface p-5 space-y-5 flex-shrink-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-ink"><Cloud className="h-4 w-4 text-ink-faint" /> Backup su Google Drive</h2>
          <p className="mt-1 text-sm text-ink-muted max-w-[70ch]">
            {status.connected
              ? <>Collegato a <strong className="text-ink">{status.accountEmail || 'account Google'}</strong>. Ultimo backup: {when(status.lastUploadAt)}.</>
              : 'Copia automatica dei dati in una cartella "Preventivi 3D Backup" del tuo Drive. L\'app vede solo i file che crea lei.'}
          </p>
        </div>
        {status.connected && (
          <div className="flex flex-wrap gap-2">
            <button disabled={!!busy} className="btn btn-primary btn-sm" onClick={async () => {
              const d = await call('POST', { action: 'upload' }, 'upload');
              if (d) { setNotice({ ok: true, text: `Backup caricato: ${d.name} (${Math.round(d.sizeBytes / 1024)} KB).` }); load(); }
            }}>
              <CloudUpload className="h-4 w-4" /> {busy === 'upload' ? 'Caricamento…' : 'Carica ora'}
            </button>
            <button disabled={!!busy} className="btn btn-danger btn-sm" onClick={async () => {
              if (!confirm('Scollegare Google Drive? I backup già caricati restano nel tuo Drive.')) return;
              if (await call('POST', { action: 'disconnect' }, 'disconnect')) load();
            }}>
              <Unlink className="h-4 w-4" /> Scollega
            </button>
          </div>
        )}
      </div>

      {notice && (
        <p className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${notice.ok ? 'border-accent-line bg-accent-soft text-accent-ink' : 'border-danger-line bg-danger-soft text-danger-ink'}`} role="status">
          {notice.ok ? <Check className="h-4 w-4 mt-0.5" /> : <TriangleAlert className="h-4 w-4 mt-0.5" />} {notice.text}
        </p>
      )}
      {status.lastError && !notice && (
        <p className="flex items-start gap-2 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger-ink"><TriangleAlert className="h-4 w-4 mt-0.5" /> Ultimo tentativo non riuscito: {status.lastError}</p>
      )}

      {!status.connected && (
        <div className="grid gap-5 lg:grid-cols-2">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-muted">
            <li>Apri <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-accent-ink underline underline-offset-4">Google Cloud Console → Credenziali</a> con il tuo account e crea un progetto.</li>
            <li>Attiva la <strong className="text-ink">Google Drive API</strong> e configura la schermata di consenso (tipo Esterno, aggiungi il tuo indirizzo come utente di test).</li>
            <li>Crea credenziali <strong className="text-ink">ID client OAuth</strong> di tipo <strong className="text-ink">Applicazione web</strong> con questo URI di reindirizzamento autorizzato:</li>
            <li className="list-none -ml-5">
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 break-all rounded-lg border border-line bg-sunken px-3 py-2 font-mono text-xs text-ink">{redirectUri}</code>
                <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={async () => { await navigator.clipboard.writeText(redirectUri); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copia
                </button>
              </div>
            </li>
            <li>Incolla qui Client ID e Client Secret, salva e premi &quot;Collega Google Drive&quot;.</li>
          </ol>

          <form className="space-y-3" onSubmit={async e => {
            e.preventDefault();
            const d = await call('PUT', { clientId, clientSecret }, 'save');
            if (d) { setClientSecret(''); setStatus(d.status); setNotice({ ok: true, text: 'Credenziali salvate.' }); }
          }}>
            {status.credentialsFromEnv ? (
              <p className="text-sm text-ink-muted">Credenziali lette dalle variabili GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET del server.</p>
            ) : (
              <>
                <div>
                  <label htmlFor="g-id" className="label">Client ID</label>
                  <input id="g-id" className="field font-mono text-xs" value={clientId} onChange={e => setClientId(e.target.value)} autoComplete="off" />
                </div>
                <div>
                  <label htmlFor="g-secret" className="label">Client Secret</label>
                  <input id="g-secret" type="password" className="field font-mono text-xs" value={clientSecret} onChange={e => setClientSecret(e.target.value)} autoComplete="off" aria-describedby="g-secret-help" />
                  <p id="g-secret-help" className="mt-1 text-xs text-ink-faint">{status.hasSecret ? 'Già salvato: lascia vuoto per non cambiarlo.' : 'Resta solo sul server, non viene mai mostrato.'}</p>
                </div>
                <button type="submit" disabled={!!busy || !clientId.trim()} className="btn btn-secondary">Salva credenziali</button>
              </>
            )}
            <button type="button" disabled={!!busy || !status.configured} className="btn btn-primary w-full" onClick={async () => {
              const d = await call('POST', { action: 'connect' }, 'connect');
              if (d?.url) window.location.href = d.url;
            }}>
              <Link2 className="h-4 w-4" /> Collega Google Drive
            </button>
          </form>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="g-sched" className="label">Backup automatico</label>
          <select id="g-sched" className="field" value={status.schedule} onChange={async e => { const d = await call('PUT', { schedule: e.target.value }, 'sched'); if (d) setStatus(d.status); }}>
            <option value="daily">Ogni giorno</option>
            <option value="weekly">Ogni settimana</option>
            <option value="off">Disattivato</option>
          </select>
        </div>
        <div>
          <label htmlFor="g-hour" className="label">Dalle ore</label>
          <select id="g-hour" className="field" value={status.hour} onChange={async e => { const d = await call('PUT', { hour: Number(e.target.value) }, 'hour'); if (d) setStatus(d.status); }}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="g-keep" className="label">Copie da conservare</label>
          <input id="g-keep" type="number" min={1} max={365} className="field font-mono" defaultValue={status.keep}
            onBlur={async e => { const d = await call('PUT', { keep: Number(e.target.value) }, 'keep'); if (d) setStatus(d.status); }} />
        </div>
      </div>

      {status.connected && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-ink">Backup su Drive ({files.length})</h3>
          {listError && <p className="text-sm text-danger-ink">{listError}</p>}
          {files.length === 0 && !listError ? (
            <p className="text-sm text-ink-muted">Ancora nessun backup caricato.</p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line max-h-64 overflow-y-auto">
              {files.map(f => (
                <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-xs text-ink">{f.name}</span>
                    <span className="block text-xs text-ink-faint">{when(f.createdTime)} · {Math.round(f.size / 1024)} KB</span>
                  </span>
                  <button disabled={!!busy} className="btn btn-secondary btn-sm shrink-0" onClick={async () => {
                    if (!confirm(`Ripristinare i dati da ${f.name}? Prima viene salvata una copia locale dello stato attuale.`)) return;
                    const d = await call('POST', { action: 'restore', fileId: f.id }, 'restore');
                    if (d) setNotice({ ok: true, text: `Ripristinati: ${d.restoredFiles.join(', ')}. Ricarica le pagine aperte.` });
                  }}>
                    <RotateCcw className="h-3.5 w-3.5" /> Ripristina
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
