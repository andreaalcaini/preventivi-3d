'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Search, Package, Clock, CheckCircle2, 
  ExternalLink, Layers, AlertCircle, Wrench, Lock, Link as LinkIcon, Copy,
  Box as BoxIcon, ChevronDown, ChevronUp, ArrowRight, Sparkles
} from 'lucide-react';
import Link from 'next/link';
import MakerWorldModelViewer from '@/components/MakerWorldModelViewer';

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
  { key: 'in_attesa', label: 'In Coda', desc: 'Ordine inserito nel programma di stampa' },
  { key: 'in_stampa', label: 'In Stampa', desc: 'Piatto occupato, estrusione in corso' },
  { key: 'pronto', label: 'Pronto al Ritiro', desc: 'Stampa ultimata e controllata' },
  { key: 'saldato', label: 'Consegnato', desc: 'Lavoro saldato e ritirato con successo' }
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

        if (orderList.length === 1 && (orderList[0].modelUrl || orderList[0].makerWorldUrl)) {
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
    <div className="max-w-4xl mx-auto w-full space-y-6 pb-6">
      
      {/* Floating Island Header */}
      <header className="bg-slate-950/80 backdrop-blur-2xl border border-white/10 ring-1 ring-white/5 rounded-2xl sm:rounded-full px-4 sm:px-6 py-3 flex items-center justify-between shadow-2xl shadow-black/80">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
            <Package className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-[0.2em] font-semibold">
                Monitoraggio Commesse
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Portale Ordini Stampa 3D
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/richiedi-preventivo"
            className="text-xs text-slate-300 hover:text-white px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all font-medium"
          >
            Nuovo Preventivo
          </Link>
          <Link
            href="/login"
            className="text-slate-400 hover:text-white p-2 rounded-full bg-white/[0.03] border border-white/5 hover:border-white/15 transition-all"
            title="Area Riservata Operatore"
          >
            <Lock className="w-3.5 h-3.5" strokeWidth={1.75} />
          </Link>
        </div>
      </header>

      {/* Barra Ricerca Codice con Architettura Button-in-Button */}
      <div className="p-1.5 rounded-[2rem] bg-white/[0.03] border border-white/10 ring-1 ring-white/5 shadow-2xl">
        <div className="p-5 sm:p-6 rounded-[calc(2rem-0.375rem)] bg-slate-950/85 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] space-y-3">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
              <input 
                type="text" 
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="Inserisci uno o più codici ordine (es. ORD-1049, ORD-1050)"
                className="w-full bg-white/[0.03] border border-white/10 rounded-full pl-11 pr-4 py-3 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all font-mono"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="py-3 pl-6 pr-3 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm rounded-full transition-all shadow-lg shadow-cyan-950/40 flex items-center justify-center gap-3 active:scale-[0.98] group"
            >
              <span>{loading ? 'Ricerca in corso...' : 'Verifica Ordini'}</span>
              <div className="w-7 h-7 rounded-full bg-slate-950/15 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                <ArrowRight className="w-3.5 h-3.5 text-slate-950" strokeWidth={2.5} />
              </div>
            </button>
          </form>

          <p className="text-[11px] text-slate-500 pl-2">
            Il codice univoco ti è stato fornito dal laboratorio nel messaggio di preventivo o riepilogo commessa.
          </p>
        </div>
      </div>

      {/* Messaggio Errore */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
          <span>{error}</span>
        </div>
      )}

      {/* CASO 1: SINGOLO ORDINE IN ARCHITETTURA DOPPELRAND */}
      {orders.length === 1 && (() => {
        const order = orders[0];
        const currentStep = getStepIndex(order.status);
        return (
          <div className="p-1.5 rounded-[2.5rem] bg-white/[0.03] border border-white/10 ring-1 ring-white/5 shadow-2xl">
            <div className="p-6 sm:p-8 rounded-[calc(2.5rem-0.375rem)] bg-slate-950/85 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] space-y-6">
              
              {/* Header scheda ordine */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="text-[11px] font-mono text-emerald-400 font-semibold uppercase tracking-wider bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      Codice #{order.id}
                    </span>
                    <button
                      onClick={() => handleCopySingleLink(order.id)}
                      className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/10 transition-colors"
                      title="Copia link diretto di questo ordine"
                    >
                      {copiedItemId === order.id ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <LinkIcon className="w-3.5 h-3.5" strokeWidth={1.75} />}
                      <span>{copiedItemId === order.id ? 'Link copiato!' : 'Copia link'}</span>
                    </button>
                  </div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">{order.name}</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Committente: <strong className="text-slate-200">{order.clientName}</strong> • Registrato il {order.savedAt}
                  </p>
                </div>

                <div className="text-left sm:text-right bg-white/[0.03] p-4 rounded-2xl border border-white/10 min-w-[170px]">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono block">
                    Totale Dovuto
                  </span>
                  <span className="text-2xl font-black text-white block leading-tight font-mono my-0.5">
                    €{order.totalCalculated.toFixed(2)}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider inline-block px-2.5 py-0.5 rounded-full border ${
                    order.status === 'saldato' 
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}>
                    {order.status === 'saldato' ? '✓ Pagamento Saldato' : '⏳ In attesa di saldo'}
                  </span>
                </div>
              </div>

              {/* Timeline Avanzamento Stepper */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-[0.15em] mb-4 flex items-center gap-2 font-mono">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.75} /> 
                  <span>Stato di Produzione</span>
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {statusSteps.map((step, idx) => {
                    const isPassed = idx <= currentStep;
                    const isCurrent = idx === currentStep;
                    return (
                      <div 
                        key={step.key}
                        className={`p-4 rounded-2xl border transition-all duration-300 ${
                          isCurrent 
                            ? 'bg-emerald-950/40 border-emerald-500/50 ring-1 ring-emerald-500/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]' 
                            : isPassed 
                              ? 'bg-white/[0.03] border-white/10 text-slate-300' 
                              : 'bg-white/[0.01] border-white/5 opacity-40'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono ${
                            isCurrent 
                              ? 'bg-emerald-500 text-slate-950' 
                              : isPassed 
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                : 'bg-white/10 text-slate-500'
                          }`}>
                            {isPassed && !isCurrent ? '✓' : idx + 1}
                          </div>
                          <span className="text-xs font-bold text-white tracking-tight">{step.label}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">{step.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dettagli Tecnici & Minuteria */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/10">
                <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl space-y-2">
                  <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.75} /> Materiale & Configurazione
                  </span>
                  <p className="text-sm font-semibold text-white">{order.material}</p>
                  {order.multiColor && (
                    <span className="inline-block text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2.5 py-0.5 rounded-full font-mono">
                      Stampa multi-colore
                    </span>
                  )}
                </div>

                {order.extraBom && order.extraBom.length > 0 ? (
                  <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl space-y-2">
                    <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-cyan-400" strokeWidth={1.75} /> Minuteria & Componenti Inclusi
                    </span>
                    <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                      {order.extraBom.map((item, i) => (
                        <li key={i}>{item.qty}x {item.name}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl space-y-2">
                    <span className="text-xs text-slate-400 font-medium">Riferimento Sorgente</span>
                    {order.makerWorldUrl ? (
                      <a 
                        href={order.makerWorldUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-medium"
                      >
                        <span>Visualizza su MakerWorld</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <p className="text-xs text-slate-500">Nessun link esterno associato</p>
                    )}
                  </div>
                )}
              </div>

              {/* Box Viewer 3D Interattivo per il Cliente */}
              <div className="p-5 bg-white/[0.02] border border-white/10 rounded-2xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShow3dViewer(!show3dViewer)}
                    className="text-xs font-semibold text-slate-300 hover:text-emerald-400 transition-colors flex items-center gap-2"
                  >
                    <BoxIcon className="w-4 h-4 text-emerald-400" strokeWidth={1.75} />
                    <span>
                      {order.makerWorldUrl 
                        ? (show3dViewer ? 'Nascondi Anteprima Modello 3D / MakerWorld' : 'Visualizza Anteprima Modello 3D (Piatti & Foto MakerWorld)')
                        : order.modelUrl 
                        ? (show3dViewer ? 'Nascondi Modello 3D del Pezzo' : `Visualizza Modello 3D di Produzione (${order.modelFileName || 'STL/3MF'})`)
                        : (show3dViewer ? 'Nascondi Visualizzatore 3D' : 'Visualizzatore 3D (Ispezione geometrica)')
                      }
                    </span>
                    {show3dViewer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <div className="flex items-center gap-2">
                    {order.modelUrl && (
                      <a
                        href={order.modelUrl}
                        download={order.modelFileName || 'modello-3d'}
                        className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20"
                        title="Scarica file originale del pezzo"
                      >
                        <span>Scarica {order.modelFileName?.toLowerCase().endsWith('.3mf') ? '.3MF' : '.STL'}</span>
                      </a>
                    )}
                    {order.makerWorldUrl && (
                      <a
                        href={order.makerWorldUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20"
                      >
                        <span>MakerWorld</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                {show3dViewer && (
                  <div className="pt-2">
                    <MakerWorldModelViewer 
                      makerWorldUrl={order.makerWorldUrl}
                      modelUrl={order.modelUrl}
                      modelFileName={order.modelFileName}
                      modelTitle={order.name || order.id}
                      material={order.material || 'PLA'}
                      height={320}
                      allowUpload={!order.modelUrl}
                    />
                  </div>
                )}
              </div>

              {/* Informazioni Ritiro e Pagamento */}
              <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-300 flex items-start gap-3.5">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400 mt-0.5" strokeWidth={1.75} />
                <div>
                  <p className="font-bold text-white text-sm mb-0.5">Indicazioni per il Ritiro & Pagamento</p>
                  <p className="text-slate-300 leading-relaxed">
                    Quando il tuo ordine raggiunge lo stato <strong>&quot;Pronto al Ritiro&quot;</strong>, puoi concordare giorno e ora di consegna con il laboratorio. L&apos;importo di <strong>€{order.totalCalculated.toFixed(2)}</strong> potrà essere saldato direttamente al momento del ritiro.
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
          <div className="p-1.5 rounded-[2.5rem] bg-white/[0.03] border border-white/10 ring-1 ring-white/5 shadow-2xl">
            <div className="p-6 sm:p-8 rounded-[calc(2.5rem-0.375rem)] bg-slate-950/85 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-white/10">
                <div>
                  <span className="text-[10px] font-mono font-semibold text-emerald-400 uppercase tracking-[0.2em] block">
                    Riepilogo Multi-Commessa
                  </span>
                  <h2 className="text-2xl font-bold text-white tracking-tight">{clientName}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Visualizzazione unificata di <strong>{orders.length} pezzi di stampa</strong>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCopyBundleLink}
                    className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-950/50 active:scale-[0.98]"
                    title="Copia link che include tutti questi pezzi"
                  >
                    {copiedAllLink ? <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" /> : <Copy className="w-3.5 h-3.5 text-slate-950" strokeWidth={2} />}
                    <span>{copiedAllLink ? 'Link Riepilogo Copiato!' : 'Copia Link Unificato'}</span>
                  </button>
                </div>
              </div>

              {/* Metriche Totali */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 bg-white/[0.02] border border-white/10 rounded-2xl">
                  <span className="text-xs text-slate-400 block mb-1">Totale da Saldare</span>
                  <span className="text-3xl font-black text-amber-400 block leading-tight font-mono">
                    €{totalDue.toFixed(2)}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider inline-block mt-2 px-2.5 py-0.5 rounded-full border ${
                    totalDue === 0
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {totalDue === 0 ? '✓ Tutti i lavori saldati' : '⏳ In attesa di saldo'}
                  </span>
                </div>

                <div className="p-5 bg-white/[0.02] border border-white/10 rounded-2xl">
                  <span className="text-xs text-slate-400 block mb-1">Valore Totale Ordini</span>
                  <span className="text-3xl font-black text-white block leading-tight font-mono">
                    €{totalAll.toFixed(2)}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-2">
                    {orders.filter(o => o.status === 'saldato').length} di {orders.length} pezzi già consegnati e saldati
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Elenco Schede per Ciascun Pezzo */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 font-mono">
              Dettaglio Pezzi ({orders.length})
            </h3>

            {orders.map((order) => {
              const currentStep = getStepIndex(order.status);
              const isCopied = copiedItemId === order.id;

              return (
                <div key={order.id} className="p-1.5 rounded-[2rem] bg-white/[0.03] border border-white/10 ring-1 ring-white/5 shadow-xl">
                  <div className="p-5 sm:p-6 rounded-[calc(2rem-0.375rem)] bg-slate-950/85 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] space-y-4">
                    
                    {/* Header singolo pezzo */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-white/10">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono text-emerald-400 font-semibold uppercase bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            #{order.id}
                          </span>
                          <button
                            onClick={() => handleCopySingleLink(order.id)}
                            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 transition-colors border border-white/10"
                            title="Copia link diretto solo per questo pezzo"
                          >
                            {isCopied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <LinkIcon className="w-3 h-3" />}
                            <span>{isCopied ? 'Copiato' : 'Copia link'}</span>
                          </button>
                        </div>
                        <h4 className="text-lg font-bold text-white tracking-tight">{order.name}</h4>
                        <p className="text-[11px] text-slate-400">Data: {order.savedAt || 'Registrato'}</p>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-xl font-black text-white block font-mono">€{order.totalCalculated.toFixed(2)}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border inline-block ${
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
                            className={`p-3 rounded-xl border text-xs transition-all ${
                              isCurrent 
                                ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/30' 
                                : isPassed 
                                  ? 'bg-white/[0.03] border-white/10 text-slate-300' 
                                  : 'bg-white/[0.01] border-white/5 opacity-40'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${
                                isCurrent 
                                  ? 'bg-emerald-500 text-slate-950' 
                                  : isPassed 
                                    ? 'bg-emerald-500/20 text-emerald-400' 
                                    : 'bg-white/10 text-slate-500'
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
                      <span className="flex items-center gap-1 bg-white/[0.02] px-3 py-1 rounded-full border border-white/10 text-slate-300">
                        <Layers className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.75} /> {order.material}
                      </span>
                      {order.multiColor && (
                        <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-3 py-1 rounded-full font-mono text-[10px]">
                          Multi-colore
                        </span>
                      )}
                      {order.extraBom && order.extraBom.length > 0 && (
                        <span className="bg-white/[0.02] px-3 py-1 rounded-full border border-white/10 text-slate-300">
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

                      {(order.modelUrl || order.makerWorldUrl) && (
                        <button
                          type="button"
                          onClick={() => setExpandedViewerId(expandedViewerId === order.id ? null : order.id)}
                          className={`text-[11px] font-semibold flex items-center gap-1.5 px-3 py-1 rounded-full border transition-colors ${
                            expandedViewerId === order.id 
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                              : 'bg-white/[0.03] hover:bg-white/[0.07] text-slate-300 border-white/10'
                          }`}
                        >
                          <BoxIcon className="w-3 h-3 text-emerald-400" />
                          <span>
                            {expandedViewerId === order.id 
                              ? 'Chiudi Anteprima' 
                              : (order.makerWorldUrl 
                                  ? 'Vedi Anteprima 3D' 
                                  : `Vedi Modello 3D (${order.modelFileName || 'File'})`
                                )
                            }
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Viewer 3D Espandibile nel Multi-ordine */}
                    {(order.modelUrl || order.makerWorldUrl) && expandedViewerId === order.id && (
                      <div className="pt-3 border-t border-white/10">
                        <MakerWorldModelViewer
                          makerWorldUrl={order.makerWorldUrl}
                          modelUrl={order.modelUrl}
                          modelFileName={order.modelFileName}
                          modelTitle={order.name || order.id}
                          material={order.material || 'PLA'}
                          height={280}
                          allowUpload={false}
                        />
                      </div>
                    )}

                  </div>
                </div>
              );
            })}
          </div>

          {/* Box Ritiro per Multi-ordine */}
          <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-300 flex items-start gap-3.5">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400 mt-0.5" strokeWidth={1.75} />
            <div>
              <p className="font-bold text-white text-sm mb-0.5">Indicazioni per il Ritiro & Pagamento</p>
              <p className="text-slate-300 leading-relaxed">
                Appena i pezzi raggiungono lo stato <strong>&quot;Pronto al Ritiro&quot;</strong> potrai concordare il ritiro con il laboratorio. Il totale rimanente da saldare è di <strong>€{totalDue.toFixed(2)}</strong>.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* Stato Iniziale se non ha ancora cercato */}
      {orders.length === 0 && !error && !hasSearched && (
        <div className="p-1.5 rounded-[2.5rem] bg-white/[0.03] border border-white/10 ring-1 ring-white/5 shadow-2xl">
          <div className="text-center py-16 px-6 rounded-[calc(2.5rem-0.375rem)] bg-slate-950/85 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 ring-1 ring-white/5 flex items-center justify-center mx-auto mb-4 text-slate-500">
              <Package className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-bold text-white mb-1.5">Hai un codice ordine?</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              Inserisci il codice univoco nel campo sopra per visualizzare lo stato di lavorazione del tuo modello e il riepilogo del saldo.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}

export default function OrdineClientePage() {
  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 font-sans p-3 sm:p-6 flex flex-col justify-between relative">
      <Suspense fallback={<div className="max-w-4xl mx-auto text-xs text-slate-500 py-10 text-center font-mono">Caricamento portale ordini...</div>}>
        <div className="flex-1 flex flex-col">
          <OrdineClienteContent />
        </div>
      </Suspense>

      <footer className="max-w-4xl mx-auto w-full pt-4 pb-2 text-center text-[11px] text-slate-600 border-t border-white/5 flex-shrink-0">
        <p>Preventivi 3D • Portale Tracciamento e Fabbricazione Digitale</p>
      </footer>
    </div>
  );
}
