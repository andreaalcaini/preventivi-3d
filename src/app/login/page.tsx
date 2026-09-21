'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Package, Search, Sparkles, Send, Lock, User, ArrowRight, 
  AlertCircle, CheckCircle2, X
} from 'lucide-react';
import Link from 'next/link';

function PortalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';
  const hasRedirect = Boolean(searchParams.get('redirect'));

  // Stato per tracciamento rapido ordine
  const [trackingCode, setTrackingCode] = useState('');

  // Modal login operatore
  const [showAdminLogin, setShowAdminLogin] = useState(hasRedirect);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingCode.trim()) {
      router.push(`/ordine?code=${encodeURIComponent(trackingCode.trim())}`);
    } else {
      router.push('/ordine');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
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
      setError('Si è verificato un errore di connessione');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full max-w-5xl mx-auto flex flex-col justify-between items-center py-6 sm:py-10 px-4 sm:px-6 relative z-10">
      
      {/* Intestazione Principale con Eyebrow Pill */}
      <div className="text-center pt-4 sm:pt-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono uppercase tracking-[0.2em] mb-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
          <Sparkles className="w-3 h-3 text-emerald-400" strokeWidth={1.75} />
          <span>Laboratorio di Fabbricazione Digitale</span>
        </div>
        
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
          Cosa desideri realizzare?
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-2.5 max-w-md mx-auto leading-relaxed">
          Monitora lo stato di produzione della tua commessa in tempo reale oppure richiedi un preventivo per il tuo file 3D.
        </p>
      </div>

      {/* Griglia Asimmetrica & Double-Bezel Architecture */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 w-full my-auto max-w-4xl pt-6 pb-8">
        
        {/* CARD 1: TRACCIA ORDINE (Doppelrand Outer Shell) */}
        <div className="p-1.5 rounded-[2rem] bg-white/[0.03] border border-white/10 ring-1 ring-white/5 shadow-2xl hover:border-cyan-500/30 transition-all duration-500 group">
          {/* Inner Core */}
          <div className="p-6 sm:p-7 rounded-[calc(2rem-0.375rem)] bg-slate-950/85 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] flex flex-col justify-between h-full">
            <div>
              {/* Concentric Icon Island */}
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 ring-1 ring-white/5 text-cyan-400 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                <Package className="w-5 h-5" strokeWidth={1.75} />
              </div>

              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                Traccia il tuo Ordine
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
                Hai già una commessa attiva in laboratorio? Inserisci il codice per verificare lo stato dei piatti e il ritiro.
              </p>

              <form onSubmit={handleTrack} className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
                  <input 
                    type="text"
                    value={trackingCode}
                    onChange={e => setTrackingCode(e.target.value)}
                    placeholder="Es. ORD-1049..."
                    className="w-full bg-white/[0.03] border border-white/10 rounded-full pl-11 pr-4 py-3 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all font-mono"
                  />
                </div>

                {/* Nested Island Button (Button-in-Button) */}
                <button
                  type="submit"
                  className="w-full py-2.5 pl-5 pr-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs sm:text-sm rounded-full transition-all shadow-lg shadow-cyan-950/40 flex items-center justify-between active:scale-[0.98] group/btn"
                >
                  <span>Verifica Avanzamento</span>
                  <div className="w-7 h-7 rounded-full bg-slate-950/15 flex items-center justify-center group-hover/btn:translate-x-1 transition-transform">
                    <ArrowRight className="w-3.5 h-3.5 text-slate-950" strokeWidth={2.5} />
                  </div>
                </button>
              </form>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 text-center">
              <Link 
                href="/ordine"
                className="text-xs text-slate-400 hover:text-cyan-300 transition-colors inline-flex items-center gap-1.5 font-medium"
              >
                <span>Accedi alla ricerca ordini multipli</span>
                <ArrowRight className="w-3 h-3" strokeWidth={1.75} />
              </Link>
            </div>
          </div>
        </div>

        {/* CARD 2: RICHIEDI PREVENTIVO (Doppelrand Outer Shell) */}
        <div className="p-1.5 rounded-[2rem] bg-white/[0.03] border border-white/10 ring-1 ring-white/5 shadow-2xl hover:border-emerald-500/30 transition-all duration-500 group">
          {/* Inner Core */}
          <div className="p-6 sm:p-7 rounded-[calc(2rem-0.375rem)] bg-slate-950/85 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] flex flex-col justify-between h-full">
            <div>
              {/* Concentric Icon Island */}
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 ring-1 ring-white/5 text-emerald-400 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                <Send className="w-5 h-5" strokeWidth={1.75} />
              </div>

              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                Richiedi un Preventivo
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-4">
                Inviaci un file STL/3MF o incolla un link MakerWorld per calcolare all&apos;istante tempi, materiale e costi stimati.
              </p>

              <div className="space-y-2 mb-6 text-xs text-slate-300">
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2} />
                  </div>
                  <span>Viewer 3D con quote millimetriche in tempo reale</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2} />
                  </div>
                  <span>Supporto per filamenti tecnici (PLA, PETG, TPU, ASA, CF)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2} />
                  </div>
                  <span>Stima trasparente e verifica tecnica d&apos;estrusione</span>
                </div>
              </div>
            </div>

            <div>
              {/* Nested Island Button (Button-in-Button) */}
              <Link
                href="/richiedi-preventivo"
                className="w-full py-2.5 pl-5 pr-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm rounded-full transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-between active:scale-[0.98] group/btn"
              >
                <span>Configura e Invia File</span>
                <div className="w-7 h-7 rounded-full bg-slate-950/15 flex items-center justify-center group-hover/btn:translate-x-1 transition-transform">
                  <ArrowRight className="w-3.5 h-3.5 text-slate-950" strokeWidth={2.5} />
                </div>
              </Link>

              <div className="mt-6 pt-4 border-t border-white/5 text-center">
                <span className="text-[11px] text-slate-500">
                  Valutazione gratuita e risposta celere
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Accesso Riservato Operatore */}
      <div className="w-full text-center pb-2">
        <button
          onClick={() => setShowAdminLogin(true)}
          className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors py-1.5 px-4 rounded-full bg-white/[0.02] border border-white/5 hover:border-white/10 active:scale-[0.98]"
        >
          <Lock className="w-3 h-3 text-slate-500" strokeWidth={1.75} />
          <span>Accesso Riservato Operatore</span>
        </button>
      </div>

      {/* Modal Login Operatore con Doppelrand e Glass Blur */}
      {showAdminLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="p-1.5 rounded-[2rem] bg-white/[0.04] border border-white/15 ring-1 ring-white/10 shadow-2xl w-full max-w-sm">
            <div className="p-6 rounded-[calc(2rem-0.375rem)] bg-slate-950/95 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]">
              
              <div className="flex items-center justify-between pb-3 mb-5 border-b border-white/10">
                <div className="flex items-center gap-2.5 text-sm font-semibold text-white">
                  <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                    <Lock className="w-4 h-4" strokeWidth={1.75} />
                  </div>
                  <span>Accesso Operatore</span>
                </div>
                <button
                  onClick={() => setShowAdminLogin(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Chiudi finestra"
                >
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.75} /> Username
                  </label>
                  <input 
                    type="text"
                    required
                    autoFocus
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.75} /> Password
                  </label>
                  <input 
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAdminLogin(false)}
                    className="py-2 px-3 text-xs text-slate-400 hover:text-white"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="py-2.5 px-5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm rounded-full transition-all flex items-center gap-2 shadow-sm active:scale-[0.98]"
                  >
                    <span>{loading ? 'Accesso in corso...' : 'Entra'}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-950" strokeWidth={2.5} />
                  </button>
                </div>
              </form>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[100dvh] w-full bg-slate-950 flex flex-col justify-center items-center text-slate-200 relative overflow-x-hidden">
      <Suspense fallback={<div className="text-xs text-slate-500 font-mono">Caricamento portale...</div>}>
        <PortalContent />
      </Suspense>
    </div>
  );
}
