'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calculator, Lock, User, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

      // Reindirizza alla pagina richiesta o alla home
      router.push(redirectUrl);
      router.refresh();
    } catch {
      setError('Si è verificato un errore di connessione');
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full max-w-md">
      
      {/* Logo & Header */}
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 mb-3 shadow-lg shadow-emerald-950">
          <Calculator className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">PrintQuote Lab</h1>
        <p className="text-slate-400 text-xs mt-1">Area Riservata Venditore & Gestione Laboratorio</p>
      </div>

      {/* Card Login */}
      <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-md rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
        
        <div className="border-b border-slate-800/80 pb-3">
          <h2 className="text-base font-semibold text-white">Accesso Operatore</h2>
          <p className="text-xs text-slate-400">Inserisci le credenziali per accedere al calcolatore e al magazzino</p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" /> Username
            </label>
            <input 
              type="text"
              required
              autoFocus
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Es. admin"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-500" /> Password
            </label>
            <input 
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-emerald-950 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Accesso in corso...</span>
            ) : (
              <>
                <span>Accedi al Laboratorio</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Suggerimento primo accesso */}
        <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/70" /> Primo accesso: admin / admin
          </span>
        </div>

      </div>

      {/* Link verso il Portale Cliente */}
      <div className="mt-6 text-center">
        <Link 
          href="/ordine" 
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition-colors py-2 px-4 rounded-xl bg-slate-900/50 border border-slate-800/60"
        >
          <span>Sei un cliente? Controlla il tuo ordine con il codice univoco</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 text-slate-200">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <Suspense fallback={<div className="text-xs text-slate-500">Caricamento...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
