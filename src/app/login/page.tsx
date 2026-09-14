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
    <div className="h-full w-full max-w-5xl mx-auto flex flex-col justify-between items-center py-2 sm:py-4 px-4">
      
      {/* Intestazione Principale */}
      <div className="text-center pt-2 sm:pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] sm:text-xs font-semibold uppercase tracking-wider mb-2 sm:mb-3 shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Laboratorio di Stampa 3D & Prototipazione</span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
          Cosa desideri fare oggi?
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1.5 max-w-lg mx-auto">
          Traccia lo stato della tua commessa in tempo reale oppure inviaci una richiesta per realizzare il tuo progetto 3D.
        </p>
      </div>

      {/* Sezioni Principali per Clienti (2 Card in evidenza) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full my-auto max-w-4xl">
        
        {/* CARD 1: TRACCIA ORDINE */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 shadow-xl group">
          <div>
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-105 transition-transform">
              <Package className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-white mb-1.5 flex items-center gap-2">
              Traccia il tuo Ordine
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-4">
              Hai già un ordine attivo? Inserisci il codice per verificare lo stato di avanzamento della stampa e il ritiro.
            </p>

            <form onSubmit={handleTrack} className="space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  value={trackingCode}
                  onChange={e => setTrackingCode(e.target.value)}
                  placeholder="Inserisci codice ordine..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-cyan-950 flex items-center justify-center gap-2 group-hover:shadow-cyan-900/50"
              >
                <span>Cerca Ordine</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-center">
            <Link 
              href="/ordine"
              className="text-xs text-slate-400 hover:text-cyan-400 transition-colors inline-flex items-center gap-1 font-medium"
            >
              <span>Accedi alla ricerca ordini completa</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* CARD 2: RICHIEDI PREVENTIVO */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 shadow-xl group">
          <div>
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-105 transition-transform">
              <Send className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-white mb-1.5 flex items-center gap-2">
              Richiedi un Preventivo
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-3">
              Hai un file STL/3MF o un link MakerWorld/Printables? Inviacelo per una stima rapida e trasparente.
            </p>

            <div className="space-y-1.5 mb-4 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>Caricamento diretto file 3D con viewer interattivo</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>Materiali standard e tecnici (PLA, PETG, TPU, ASA)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>Stima accurata dei costi e consulenza inclusa</span>
              </div>
            </div>
          </div>

          <div>
            <Link
              href="/richiedi-preventivo"
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-emerald-950 flex items-center justify-center gap-2 group-hover:shadow-emerald-900/50"
            >
              <span>Invia Richiesta Preventivo</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <div className="mt-4 pt-3 border-t border-slate-800/80 text-center">
              <span className="text-[11px] text-slate-500">
                Preventivo gratuito senza impegno • Risposta celere
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ACCESSO ADMIN / OPERATORE (IN PICCOLO) */}
      <div className="w-full text-center pb-2">
        <button
          onClick={() => setShowAdminLogin(true)}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors py-1 px-3 rounded-lg hover:bg-slate-900/60"
        >
          <Lock className="w-3 h-3 text-slate-500" />
          <span>Accesso Operatore</span>
        </button>
      </div>

      {/* MODAL LOGIN OPERATORE */}
      {showAdminLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400">
                  <Lock className="w-4 h-4" />
                </div>
                <span>Accesso Operatore</span>
              </div>
              <button
                onClick={() => setShowAdminLogin(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" /> Username
                </label>
                <input 
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-500" /> Password
                </label>
                <input 
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdminLogin(false)}
                  className="py-2 px-3 text-xs text-slate-400 hover:text-slate-200"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
                >
                  {loading ? 'Accesso...' : 'Entra'}
                  <ArrowRight className="w-3.5 h-3.5" />
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
    <div className="h-screen w-screen max-h-screen max-w-full overflow-hidden bg-slate-950 flex flex-col justify-center items-center text-slate-200">
      {/* Sfondo decorativo con gradienti */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <Suspense fallback={<div className="text-xs text-slate-500">Caricamento portale...</div>}>
        <PortalContent />
      </Suspense>
    </div>
  );
}


