'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Package, Search, Sparkles, Send, Lock, User, ArrowRight, 
  AlertCircle, ShieldCheck, ChevronDown, ChevronUp, CheckCircle2
} from 'lucide-react';
import Link from 'next/link';

function PortalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';
  const hasRedirect = Boolean(searchParams.get('redirect'));

  // Stato per tracciamento rapido ordine
  const [trackingCode, setTrackingCode] = useState('');

  // Stato login admin (aperto di default solo se reindirizzati da pagina protetta)
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
    <div className="relative w-full max-w-4xl mx-auto px-4 py-8">
      
      {/* Intestazione Principale */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-4 shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Laboratorio di Stampa 3D & Prototipazione</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
          Cosa desideri fare oggi?
        </h1>
        <p className="text-slate-400 text-sm sm:text-base mt-2.5 max-w-xl mx-auto">
          Traccia lo stato di avanzamento della tua stampa in tempo reale oppure inviaci una richiesta per realizzare il tuo progetto.
        </p>
      </div>

      {/* Sezioni Principali per Clienti (2 Card in evidenza) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        
        {/* CARD 1: TRACCIA ORDINE */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 shadow-xl group">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
              <Package className="w-6 h-6" />
            </div>

            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              Traccia il tuo Ordine
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
              Hai già concordato un lavoro? Inserisci il codice per verificare lo stato di avanzamento della stampa, foto, parametri e ritiro.
            </p>

            <form onSubmit={handleTrack} className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  value={trackingCode}
                  onChange={e => setTrackingCode(e.target.value)}
                  placeholder="Inserisci codice ordine..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-cyan-950 flex items-center justify-center gap-2 group-hover:shadow-cyan-900/50"
              >
                <span>Cerca Ordine</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
            <Link 
              href="/ordine"
              className="text-xs text-slate-400 hover:text-cyan-400 transition-colors inline-flex items-center gap-1 font-medium"
            >
              <span>Accedi alla pagina di ricerca ordini completa</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* CARD 2: RICHIEDI PREVENTIVO */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 shadow-xl group">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
              <Send className="w-6 h-6" />
            </div>

            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              Richiedi un Preventivo
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
              Hai un file 3D da stampare o un'idea da prototipare? Carica il file o incolla un link (MakerWorld, Printables) per una stima precisa.
            </p>

            <div className="space-y-2.5 mb-6 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Supporto diretto file STL, 3MF e modelli da remoto</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Ampia gamma di materiali: PLA, PETG, TPU, ASA, ABS</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Calcolo rapido e consulenza di fabbricazione</span>
              </div>
            </div>
          </div>

          <div>
            <Link
              href="/richiedi-preventivo"
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-emerald-950 flex items-center justify-center gap-2 group-hover:shadow-emerald-900/50"
            >
              <span>Invia Richiesta Preventivo</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
              <span className="text-[11px] text-slate-500">
                Preventivo gratuito senza impegno • Risposta in giornata
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ACCESSO ADMIN / OPERATORE (IN PICCOLO) */}
      <div className="border-t border-slate-800/80 pt-6 max-w-lg mx-auto">
        {!showAdminLogin ? (
          <div className="text-center">
            <button
              onClick={() => setShowAdminLogin(true)}
              className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors py-1.5 px-3 rounded-lg hover:bg-slate-900/80"
            >
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Accesso Amministrazione & Gestione Laboratorio</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        ) : (
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-lg animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800/60">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Accesso Operatore / Admin</span>
              </div>
              <button
                onClick={() => setShowAdminLogin(false)}
                className="text-[11px] text-slate-400 hover:text-slate-200"
              >
                Nascondi
              </button>
            </div>

            {error && (
              <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" /> Utente
                  </label>
                  <input 
                    type="text"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-400" /> Password
                  </label>
                  <input 
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 gap-2">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> Predefinito: admin / admin
                </span>

                <button
                  type="submit"
                  disabled={loading}
                  className="py-1.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
                >
                  {loading ? 'Accesso...' : 'Entra'}
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 text-slate-200">
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

