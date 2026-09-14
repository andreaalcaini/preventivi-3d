'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Search, Package, Clock, CheckCircle2, 
  ExternalLink, Layers, AlertCircle, Wrench, Lock, Link as LinkIcon, Copy,
  Box as BoxIcon, ChevronDown, ChevronUp
} from 'lucide-react';
import Link from 'next/link';
import StlViewer from '@/components/StlViewer';

interface PublicOrder {
  id: string;
  name: string;
  clientName: string;
  material: string;
  savedAt: string;
  status: 'in_attesa' | 'in_stampa' | 'pronto' | 'saldato';
  totalCalculated: number;
  multiColor?: boolean;
  extraBom?: Array<{ name: string; qty: number | string }>;
  makerWorldUrl?: string;
  modelUrl?: string;
  modelFileName?: string;
}

const statusSteps = [
  { key: 'in_attesa', label: 'In Coda / Ricevuto', desc: 'Ordine inserito nel programma di stampa' },
  { key: 'in_stampa', label: 'In Stampa', desc: 'Piatto occupato, pezzo in fase di estrusione' },
  { key: 'pronto', label: 'Pronto per il Ritiro', desc: 'Stampa terminata, pezzo pulito e pronto' },
  { key: 'saldato', label: 'Consegnato & Saldato', desc: 'Lavoro completato con successo' }
];

function OrdineClienteContent() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get('codes') || searchParams.get('code') || '';

  const [code, setCode] = useState(initialCode);
  const [orders, setOrders] = useState<PublicOrder[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [copiedAllLink, setCopiedAllLink] = useState(false);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const [show3dViewer, setShow3dViewer] = useState(false);
  const [expandedViewerId, setExpandedViewerId] = useState<string | null>(null);

  const handleCopyBundleLink = () => {
    if (typeof window !== 'undefined' && orders.length > 0) {
      const codes = orders.map(o => o.id).join(',');
      const url = `${window.location.origin}/ordine?codes=${encodeURIComponent(codes)}`;
      navigator.clipboard.writeText(url);
      setCopiedAllLink(true);
      setTimeout(() => setCopiedAllLink(false), 2000);
    }
  };

  const handleCopySingleLink = (orderId: string) => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/ordine?code=${encodeURIComponent(orderId)}`;
      navigator.clipboard.writeText(url);
      setCopiedItemId(orderId);
      setTimeout(() => setCopiedItemId(null), 2000);
    }
  };

  const fetchOrders = async (orderCodes: string) => {
    const clean = orderCodes.trim();
    if (!clean) return;

    setLoading(true);
    setError('');
    setHasSearched(true);

    try {
      const res = await fetch(`/api/public/order?codes=${encodeURIComponent(clean)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Nessun ordine trovato con i codici inseriti.');
        setOrders([]);
      } else {
        const orderList = Array.isArray(data.orders) ? data.orders : (data.order ? [data.order] : []);
        setOrders(orderList);
        setTotalDue(typeof data.totalDue === 'number' ? data.totalDue : (data.order?.totalCalculated || 0));
        setTotalAll(typeof data.totalAll === 'number' ? data.totalAll : (data.order?.totalCalculated || 0));
        setClientName(data.clientName || orderList[0]?.clientName || 'Cliente');

        // Se è presente un modello 3D allegato per il singolo ordine, apri l'anteprima
        if (orderList.length === 1 && orderList[0].modelUrl) {
          setShow3dViewer(true);
        }
      }
    } catch {
      setError('Errore di connessione al server.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      fetchOrders(initialCode);
    }
  }, [initialCode]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        url.searchParams.set('codes', code.trim());
        window.history.replaceState({}, '', url.toString());
      }
      fetchOrders(code);
    }
  };

  const getStepIndex = (status: string) => {
    switch (status) {
      case 'in_attesa': return 0;
      case 'in_stampa': return 1;
      case 'pronto': return 2;
      case 'saldato': return 3;
      default: return 0;
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full">
      
      <header className="flex justify-between items-center pb-6 border-b border-slate-800/80 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Portale Ordini Stampa 3D</h1>
            <p className="text-slate-400 text-xs">Traccia lo stato di produzione del tuo pezzo e il totale dovuto</p>
          </div>
        </div>

        <Link
          href="/login"
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 transition-colors"
          title="Area riservata per il laboratorio"
        >
          <Lock className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Area Venditore</span>
        </Link>
      </header>

      {/* Barra Ricerca Codice Univoco */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl mb-8">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
            <input 
              type="text" 
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Inserisci uno o più codici ordine separati da virgola"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="py-3 px-6 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-emerald-950 flex items-center justify-center gap-2"
          >
            {loading ? 'Ricerca in corso...' : 'Verifica Ordini'}
          </button>
        </form>

        <p className="text-[11px] text-slate-500 mt-2.5">
          Il codice univoco ti è stato fornito dal laboratorio nel messaggio di preventivo o riepilogo conto.
        </p>
      </div>

      {/* Messaggio Errore */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm flex items-center gap-3 mb-8">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* CASO 1: SINGOLO ORDINE */}
      {orders.length === 1 && (() => {
        const order = orders[0];
        const currentStep = getStepIndex(order.status);
        return (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
              
              {/* Header scheda ordine */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                      Codice Ordine #{order.id}
                    </span>
                    <button
                      onClick={() => handleCopySingleLink(order.id)}
                      className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      title="Copia link diretto di questo ordine"
                    >
                      {copiedItemId === order.id ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <LinkIcon className="w-3 h-3" />}
                      <span>{copiedItemId === order.id ? 'Link copiato!' : 'Copia link'}</span>
                    </button>
                  </div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">{order.name}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Destinatario: <strong className="text-slate-200">{order.clientName}</strong> • Registrato il {order.savedAt}</p>
                </div>

                <div className="text-left sm:text-right bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Totale Dovuto</span>
                  <span className="text-2xl font-black text-white block leading-tight">€{order.totalCalculated.toFixed(2)}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider inline-block mt-0.5 px-2 py-0.5 rounded border ${
                    order.status === 'saldato' 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {order.status === 'saldato' ? '✓ Pagamento Saldato' : '⏳ In attesa di saldo'}
                  </span>
                </div>
              </div>

              {/* Timeline Avanzamento */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" /> Stato di Avanzamento
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {statusSteps.map((step, idx) => {
                    const isPassed = idx <= currentStep;
                    const isCurrent = idx === currentStep;
                    return (
                      <div 
                        key={step.key}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isCurrent 
                            ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/30' 
                            : isPassed 
                              ? 'bg-slate-950/70 border-slate-800 text-slate-300' 
                              : 'bg-slate-950/30 border-slate-800/40 opacity-40'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                            isCurrent 
                              ? 'bg-emerald-500 text-slate-950' 
                              : isPassed 
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                : 'bg-slate-800 text-slate-500'
                          }`}>
                            {isPassed && !isCurrent ? '✓' : idx + 1}
                          </div>
                          <span className="text-xs font-bold text-white">{step.label}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">{step.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dettagli Tecnici */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
                  <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" /> Materiale & Configurazione
                  </span>
                  <p className="text-sm font-semibold text-white">{order.material}</p>
                  {order.multiColor && (
                    <span className="inline-block text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded">
                      Stampa multi-colore
                    </span>
                  )}
                </div>

                {order.extraBom && order.extraBom.length > 0 ? (
                  <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
                    <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-purple-400" /> Minuteria & Componenti Inclusi
                    </span>
                    <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                      {order.extraBom.map((item, i) => (
                        <li key={i}>{item.qty}x {item.name}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
                    <span className="text-xs text-slate-400 font-medium">Modello 3D di Riferimento</span>
                    {order.makerWorldUrl ? (
                      <a 
                        href={order.makerWorldUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <span>Visualizza file sorgente (MakerWorld)</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <p className="text-xs text-slate-500">Nessun link esterno associato</p>
                    )}
                  </div>
                )}
              </div>

              {/* Box Viewer 3D Interattivo per il Cliente */}
              <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShow3dViewer(!show3dViewer)}
                    className="text-xs font-semibold text-slate-300 hover:text-emerald-400 transition-colors flex items-center gap-1.5"
                  >
                    <BoxIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {order.modelUrl 
                        ? (show3dViewer ? 'Nascondi Modello 3D del Pezzo' : `Visualizza Modello 3D di Produzione (${order.modelFileName || 'STL/3MF'})`)
                        : (show3dViewer ? 'Nascondi Visualizzatore 3D' : 'Visualizzatore 3D (Carica file .STL o .3MF per ispezione)')
                      }
                    </span>
                    {show3dViewer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <div className="flex items-center gap-2">
                    {order.modelUrl && (
                      <a
                        href={order.modelUrl}
                        download={order.modelFileName || 'modello-3d'}
                        className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20"
                        title="Scarica file originale del pezzo"
                      >
                        <span>Scarica {order.modelFileName?.toLowerCase().endsWith('.3mf') ? '.3MF' : '.STL'}</span>
                      </a>
                    )}
                    <span className="text-[10px] text-slate-500 font-mono">Three.js WebGL</span>
                  </div>
                </div>

                {show3dViewer && (
                  <div className="pt-1">
                    <StlViewer 
                      url={order.modelUrl}
                      fileName={order.modelFileName}
                      height={320}
                      initialColor={order.material?.includes('PLA') ? '#10b981' : '#06b6d4'}
                      allowUpload={!order.modelUrl}
                    />
                  </div>
                )}
              </div>

              {/* Informazioni Ritiro e Pagamento */}
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <p className="font-bold text-white text-sm mb-0.5">Indicazioni per il Ritiro & Pagamento</p>
                  <p className="text-slate-300 leading-relaxed">
                    Quando il tuo ordine raggiunge lo stato <strong>&quot;Pronto per il Ritiro&quot;</strong>, puoi concordare giorno e ora di consegna con il maker. Il saldo di <strong>€{order.totalCalculated.toFixed(2)}</strong> potrà essere corrisposto al momento del ritiro (o secondo gli accordi stabiliti).
                  </p>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* CASO 2: ORDINI MULTIPLI (BUNDLE) */}
      {orders.length > 1 && (
        <div className="space-y-6">
          
          {/* Box Riepilogativo Complessivo Cliente */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Riepilogo Multi-Ordine Cliente
                </span>
                <h2 className="text-2xl font-bold text-white tracking-tight">{clientName}</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Visualizzazione unificata di <strong>{orders.length} pezzi di stampa</strong>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleCopyBundleLink}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-950"
                  title="Copia link che include tutti questi pezzi"
                >
                  {copiedAllLink ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedAllLink ? 'Link Riepilogo Copiato!' : 'Copia Link Riepilogo'}</span>
                </button>
              </div>
            </div>

            {/* Metriche Totali */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400 block mb-0.5">Totale Ancora da Saldare</span>
                <span className="text-2xl font-black text-amber-400 block leading-tight">€{totalDue.toFixed(2)}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider inline-block mt-1 px-2 py-0.5 rounded border ${
                  totalDue === 0
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {totalDue === 0 ? '✓ Tutti i lavori saldati' : '⏳ In attesa di saldo'}
                </span>
              </div>

              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400 block mb-0.5">Valore Complessivo Lavori Inclusi</span>
                <span className="text-2xl font-black text-white block leading-tight">€{totalAll.toFixed(2)}</span>
                <span className="text-[10px] text-slate-400 block mt-1">
                  {orders.filter(o => o.status === 'saldato').length} di {orders.length} pezzi già completati e saldati
                </span>
              </div>
            </div>
          </div>

          {/* Elenco Schede per Ciascun Pezzo */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              Dettaglio Pezzi in Produzione ({orders.length})
            </h3>

            {orders.map((order) => {
              const currentStep = getStepIndex(order.status);
              const isCopied = copiedItemId === order.id;

              return (
                <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                  
                  {/* Header singolo pezzo */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-mono text-emerald-400 font-semibold uppercase">
                          Codice #{order.id}
                        </span>
                        <button
                          onClick={() => handleCopySingleLink(order.id)}
                          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          title="Copia link diretto solo per questo pezzo"
                        >
                          {isCopied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <LinkIcon className="w-3 h-3" />}
                          <span>{isCopied ? 'Copiato' : 'Copia link'}</span>
                        </button>
                      </div>
                      <h4 className="text-lg font-bold text-white tracking-tight">{order.name}</h4>
                      <p className="text-[11px] text-slate-400">Data: {order.savedAt || '-'}</p>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-lg font-black text-white block">€{order.totalCalculated.toFixed(2)}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border inline-block ${
                        order.status === 'saldato' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {order.status === 'saldato' ? '✓ Saldato' : '⏳ Da saldare'}
                      </span>
                    </div>
                  </div>

                  {/* Avanzamento pezzo */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {statusSteps.map((step, idx) => {
                      const isPassed = idx <= currentStep;
                      const isCurrent = idx === currentStep;
                      return (
                        <div 
                          key={step.key}
                          className={`p-2.5 rounded-xl border text-xs transition-all ${
                            isCurrent 
                              ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/30' 
                              : isPassed 
                                ? 'bg-slate-950/70 border-slate-800 text-slate-300' 
                                : 'bg-slate-950/30 border-slate-800/40 opacity-40'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isCurrent 
                                ? 'bg-emerald-500 text-slate-950' 
                                : isPassed 
                                  ? 'bg-emerald-500/20 text-emerald-400' 
                                  : 'bg-slate-800 text-slate-500'
                            }`}>
                              {isPassed && !isCurrent ? '✓' : idx + 1}
                            </span>
                            <span className="font-bold text-white text-[11px] truncate">{step.label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Specifiche pezzo */}
                  <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" /> {order.material}
                    </span>
                    {order.multiColor && (
                      <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2.5 py-1 rounded-lg">
                        Multi-colore
                      </span>
                    )}
                    {order.extraBom && order.extraBom.length > 0 && (
                      <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300">
                        {order.extraBom.map(b => `${b.qty}x ${b.name}`).join(', ')}
                      </span>
                    )}
                    {order.makerWorldUrl && (
                      <a 
                        href={order.makerWorldUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-emerald-400 hover:underline flex items-center gap-1 ml-auto"
                      >
                        <span>MakerWorld</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}

                    {order.modelUrl && (
                      <button
                        type="button"
                        onClick={() => setExpandedViewerId(expandedViewerId === order.id ? null : order.id)}
                        className={`text-[11px] font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors ${
                          order.makerWorldUrl ? '' : 'ml-auto'
                        } ${
                          expandedViewerId === order.id 
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                            : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                        }`}
                      >
                        <BoxIcon className="w-3 h-3 text-emerald-400" />
                        <span>{expandedViewerId === order.id ? 'Chiudi 3D' : `Vedi Modello 3D (${order.modelFileName || 'Allegato'})`}</span>
                      </button>
                    )}
                  </div>

                  {/* Viewer 3D Espandibile nel Multi-ordine */}
                  {order.modelUrl && expandedViewerId === order.id && (
                    <div className="pt-2 border-t border-slate-800">
                      <StlViewer
                        url={order.modelUrl}
                        fileName={order.modelFileName}
                        height={260}
                        initialColor={order.material?.includes('PLA') ? '#10b981' : '#06b6d4'}
                        allowUpload={false}
                      />
                    </div>
                  )}

                </div>
              );
            })}
          </div>

          {/* Box Ritiro per Multi-ordine */}
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400 mt-0.5" />
            <div>
              <p className="font-bold text-white text-sm mb-0.5">Indicazioni per il Ritiro & Pagamento</p>
              <p className="text-slate-300 leading-relaxed">
                Appena i pezzi raggiungono lo stato <strong>&quot;Pronto per il Ritiro&quot;</strong> potrai concordare il ritiro con il laboratorio. Il totale rimanente da saldare è di <strong>€{totalDue.toFixed(2)}</strong>.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* Stato Iniziale se non ha ancora cercato */}
      {orders.length === 0 && !error && !hasSearched && (
        <div className="text-center py-16 px-4 bg-slate-900/40 border border-slate-800/60 rounded-2xl">
          <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">Hai un codice ordine?</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Inserisci il codice univoco nel campo sopra per visualizzare subito lo stato del tuo pezzo in stampa e il riepilogo del costo.
          </p>
        </div>
      )}

    </div>
  );
}

export default function OrdineClientePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 md:p-8 flex flex-col justify-between">
      <Suspense fallback={<div className="max-w-3xl mx-auto text-xs text-slate-500 py-12 text-center">Caricamento portale...</div>}>
        <OrdineClienteContent />
      </Suspense>

      {/* Footer */}
      <footer className="max-w-3xl mx-auto w-full pt-12 pb-4 text-center text-xs text-slate-600 border-t border-slate-900 mt-12">
        <p>PrintQuote Lab • Sistema di gestione e preventivazione per maker di stampa 3D FDM</p>
      </footer>
    </div>
  );
}
