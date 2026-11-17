'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Search, Lock, ArrowRight, AlertCircle, X, Upload } from 'lucide-react';
import Link from 'next/link';

function PortalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';
  const hasRedirect = Boolean(searchParams.get('redirect'));

  const [trackingCode, setTrackingCode] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(hasRedirect);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    const code = trackingCode.trim();
    router.push(code ? `/ordine?code=${encodeURIComponent(code)}` : '/ordine');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Credenziali non valide');
        setLoading(false);
        return;
      }
      router.push(redirectUrl);
      router.refresh();
    } catch {
      setError('Connessione non riuscita, riprova');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col">
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-canvas">
            <Box className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="text-sm font-semibold tracking-tight text-ink">Preventivi 3D</span>
        </div>
        <button onClick={() => setShowAdminLogin(true)} className="btn btn-secondary btn-sm">
          <Lock className="h-3.5 w-3.5" strokeWidth={1.75} /> Area operatori
        </button>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 pt-10 sm:pt-16 pb-12 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16 items-start">
        <section className="max-w-xl">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tighter text-ink leading-[1.05]">
            Stampa 3D su misura, dal file al pezzo finito.
          </h1>
          <p className="mt-5 text-lg text-ink-muted leading-relaxed max-w-[48ch]">
            Carica un modello per ricevere una stima di tempi e costi, oppure segui il tuo ordine in produzione.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/richiedi-preventivo" className="btn btn-primary min-h-11 px-5">
              <Upload className="h-4 w-4" strokeWidth={1.75} /> Richiedi un preventivo
            </Link>
          </div>
          <p className="mt-3 text-sm text-ink-faint">STL, 3MF o link MakerWorld. La valutazione è gratuita.</p>
        </section>

        <section className="panel p-6 sm:p-7">
          <h2 className="text-lg font-semibold text-ink">Segui un ordine</h2>
          <p className="mt-1 text-sm text-ink-muted">Inserisci il codice che hai ricevuto con la conferma.</p>
          <form onSubmit={handleTrack} className="mt-5 space-y-3">
            <label htmlFor="tracking" className="label">Codice ordine</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" strokeWidth={1.75} />
              <input
                id="tracking"
                type="text"
                value={trackingCode}
                onChange={e => setTrackingCode(e.target.value)}
                className="field pl-9 font-mono"
                autoComplete="off"
              />
            </div>
            <button type="submit" className="btn btn-secondary w-full">
              Controlla lo stato <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </form>
          <div className="mt-6 border-t border-line pt-5 grid grid-cols-3 gap-3 text-sm">
            {[
              ['In attesa', 'Ricevuto e in coda'],
              ['In stampa', 'Sul piatto ora'],
              ['Pronto', 'Da ritirare'],
            ].map(([t, d]) => (
              <div key={t}>
                <p className="font-medium text-ink">{t}</p>
                <p className="text-ink-faint text-xs mt-0.5">{d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {showAdminLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim" role="dialog" aria-modal="true" aria-labelledby="login-title">
          <div className="panel w-full max-w-sm p-6 shadow-lg">
            <div className="flex items-center justify-between mb-5">
              <h2 id="login-title" className="text-base font-semibold text-ink">Accesso operatori</h2>
              <button
                onClick={() => setShowAdminLogin(false)}
                className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-raised hover:text-ink"
                aria-label="Chiudi"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="username" className="label">Username</label>
                <input id="username" type="text" required autoFocus autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} className="field" />
              </div>
              <div>
                <label htmlFor="password" className="label">Password</label>
                <input id="password" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="field" />
              </div>

              {error && (
                <p className="flex items-start gap-2 text-sm text-danger-ink" role="alert">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={1.75} /> {error}
                </p>
              )}

              <div className="pt-1 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setShowAdminLogin(false)} className="btn btn-secondary">Annulla</button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? 'Accesso…' : 'Entra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[100dvh] w-full bg-canvas text-ink">
      <Suspense fallback={<div className="p-8 text-sm text-ink-faint">Caricamento…</div>}>
        <PortalContent />
      </Suspense>
    </div>
  );
}
