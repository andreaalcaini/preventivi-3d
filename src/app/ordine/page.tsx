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
  quantity?: number;
  totalCalculated: number;
  multiColor?: boolean;
  extraBom?: Array<{ name: string; qty: number | string }>;
  makerWorldUrl?: string;
  modelUrl?: string;
  modelFileName?: string;
  modelFiles?: Array<{ url: string; fileName: string }>;
}

function getModelFiles(order: PublicOrder) {
  if (order.modelFiles && order.modelFiles.length > 0) return order.modelFiles;
  return order.modelUrl ? [{ url: order.modelUrl, fileName: order.modelFileName || '' }] : [];
}

function ModelFileList({ files, activeIndex, onSelect }: {
  files: Array<{ url: string; fileName: string }>;
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  if (files.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {files.map((f, index) => (
        <div
          key={f.url}
          className={`flex items-center gap-1 text-[11px] rounded-full border pl-2.5 pr-1 py-0.5 transition-colors ${
            index === activeIndex
              ? 'bg-accent-soft text-accent-ink border-accent-line'
              : 'bg-raised text-ink-muted border-line hover:border-line-strong'
          }`}
        >
          <button type="button" onClick={() => onSelect(index)} className="truncate max-w-[160px] cursor-pointer" title="Mostra nel viewer 3D">
            {f.fileName || `Modello ${index + 1}`}
          </button>
          <a
            href={f.url}
            download={f.fileName || `modello-3d-${index + 1}`}
            className="px-1.5 py-0.5 rounded-full text-accent-ink hover:bg-accent-soft"
            title="Scarica file"
          >
            ↓
          </a>
        </div>
      ))}
    </div>
  );
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
  const [activeModelByOrder, setActiveModelByOrder] = useState<Record<string, number>>({});

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
      
      <header className="flex items-center justify-between gap-3 h-16">
        <Link href="/login" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-canvas">
            <Package className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="text-sm font-semibold tracking-tight text-ink">Preventivi 3D</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/richiedi-preventivo" className="btn btn-secondary btn-sm">
            Nuovo preventivo
          </Link>
          <Link
            href="/login"
            className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-ink-muted hover:text-ink"
            title="Area operatori"
          >
            <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="sr-only">Area operatori</span>
          </Link>
        </div>
      </header>

      <div className="pt-4">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink">Stato del tuo ordine</h1>
        <p className="mt-2 text-ink-muted max-w-[60ch]">Inserisci uno o più codici ricevuti dal laboratorio, separati da virgola.</p>
      </div>

      {/* Barra Ricerca Codice con Architettura Button-in-Button */}
      <div className="rounded-xl bg-surface border border-line shadow-sm">
        <div className="p-5 sm:p-6 space-y-3">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-ink-faint absolute left-4 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
              <input 
                type="text" 
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="Inserisci uno o più codici ordine (es. ORD-1049, ORD-1050)"
                className="w-full bg-surface border border-line-strong rounded-lg pl-11 pr-4 py-3 text-xs sm:text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 transition-all font-mono"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary disabled:opacity-50 justify-center rounded-lg"
            >
              <span>{loading ? 'Ricerca in corso...' : 'Verifica Ordini'}</span>
                <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </form>

          <p className="text-[11px] text-ink-faint pl-2">
            Il codice univoco ti è stato fornito dal laboratorio nel messaggio di preventivo o riepilogo commessa.
          </p>
        </div>
      </div>

      {/* Messaggio Errore */}
      {error && (
        <div className="p-4 bg-danger-soft border border-danger-line rounded-xl text-danger-ink text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
          <span>{error}</span>
        </div>
      )}

      {/* CASO 1: SINGOLO ORDINE IN ARCHITETTURA DOPPELRAND */}
      {orders.length === 1 && (() => {
        const order = orders[0];
        const currentStep = getStepIndex(order.status);
        return (
          <div className="rounded-xl bg-surface border border-line shadow-sm">
            <div className="p-6 sm:p-8 space-y-6">
              
              {/* Header scheda ordine */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-line">
                <div>
                  <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                    <span className="text-[11px] font-mono text-accent-ink font-semibold bg-accent-soft px-2.5 py-0.5 rounded-full border border-accent-line">
                      Codice #{order.id}
                    </span>
                    {order.quantity && order.quantity > 1 && (
                      <span className="text-[11px] font-mono text-info-ink font-semibold bg-info-soft px-2.5 py-0.5 rounded-full border border-info-line">
                        Lotto da {order.quantity} pezzi
                      </span>
                    )}
                    <button
                      onClick={() => handleCopySingleLink(order.id)}
                      className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-raised hover:bg-muted text-ink-muted hover:text-ink border border-line transition-colors"
                      title="Copia link diretto di questo ordine"
                    >
                      {copiedItemId === order.id ? <CheckCircle2 className="w-3.5 h-3.5 text-accent-ink" /> : <LinkIcon className="w-3.5 h-3.5" strokeWidth={1.75} />}
                      <span>{copiedItemId === order.id ? 'Link copiato!' : 'Copia link'}</span>
                    </button>
                  </div>
                  <h2 className="text-2xl font-bold text-ink tracking-tight">{order.name}</h2>
                  <p className="text-xs text-ink-muted mt-1">
                    Committente: <strong className="text-ink">{order.clientName}</strong> • Registrato il {order.savedAt}
                  </p>
                </div>

                <div className="text-left sm:text-right bg-raised p-4 rounded-xl border border-line min-w-[170px]">
                  <span className="text-[11px] text-ink-muted font-mono block">
                    Totale Dovuto
                  </span>
                  <span className="text-2xl font-semibold text-ink block leading-tight font-mono my-0.5">
                    €{order.totalCalculated.toFixed(2)}
                  </span>
                  {order.quantity && order.quantity > 1 && (
                    <span className="text-[11px] text-ink-muted font-mono block mb-1">
                      (€{(order.totalCalculated / order.quantity).toFixed(2)} / pz)
                    </span>
                  )}
                  <span className={`text-[11px] font-bold inline-block px-2.5 py-0.5 rounded-full border ${
                    order.status === 'saldato' 
                      ? 'bg-accent-soft text-accent-ink border-accent-line' 
                      : 'bg-warn-soft text-warn-ink border-warn-line'
                  }`}>
                    {order.status === 'saldato' ? 'Pagamento saldato' : 'In attesa di saldo'}
                  </span>
                </div>
              </div>

              {/* Timeline Avanzamento Stepper */}
              <div>
                <h3 className="text-xs font-semibold text-ink-muted mb-4 flex items-center gap-2 font-mono">
                  <Clock className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.75} /> 
                  <span>Stato di Produzione</span>
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {statusSteps.map((step, idx) => {
                    const isPassed = idx <= currentStep;
                    const isCurrent = idx === currentStep;
                    return (
                      <div 
                        key={step.key}
                        className={`p-4 rounded-xl border transition-all duration-300 ${
                          isCurrent 
                            ? 'bg-accent-soft border-accent-line ring-1 ring-accent/30 ' 
                            : isPassed 
                              ? 'bg-raised border-line text-ink-muted' 
                              : 'bg-raised border-line opacity-40'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono ${
                            isCurrent 
                              ? 'bg-accent text-on-accent' 
                              : isPassed 
                                ? 'bg-accent-soft text-accent-ink border border-accent-line' 
                                : 'bg-muted text-ink-faint'
                          }`}>
                            {isPassed && !isCurrent ? '✓' : idx + 1}
                          </div>
                          <span className="text-xs font-bold text-ink tracking-tight">{step.label}</span>
                        </div>
                        <p className="text-[11px] text-ink-muted leading-relaxed">{step.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dettagli Tecnici & Minuteria */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-line">
                <div className="p-4 bg-raised border border-line rounded-xl space-y-2">
                  <span className="text-xs text-ink-muted font-medium flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.75} /> Materiale & Configurazione
                  </span>
                  <p className="text-sm font-semibold text-ink">{order.material}</p>
                  {order.multiColor && (
                    <span className="inline-block text-[10px] bg-info-soft text-info-ink border border-info-line px-2.5 py-0.5 rounded-full font-mono">
                      Stampa multi-colore
                    </span>
                  )}
                </div>

                {order.extraBom && order.extraBom.length > 0 ? (
                  <div className="p-4 bg-raised border border-line rounded-xl space-y-2">
                    <span className="text-xs text-ink-muted font-medium flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-info-ink" strokeWidth={1.75} /> Minuteria & Componenti Inclusi
                    </span>
                    <ul className="text-xs text-ink-muted space-y-1 list-disc list-inside">
                      {order.extraBom.map((item, i) => (
                        <li key={i}>{item.qty}x {item.name}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="p-4 bg-raised border border-line rounded-xl space-y-2">
                    <span className="text-xs text-ink-muted font-medium">Riferimento Sorgente</span>
                    {order.makerWorldUrl ? (
                      <a 
                        href={order.makerWorldUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs text-accent-ink hover:underline flex items-center gap-1 font-medium"
                      >
                        <span>Visualizza su MakerWorld</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <p className="text-xs text-ink-faint">Nessun link esterno associato</p>
                    )}
                  </div>
                )}
              </div>

              {/* Box Viewer 3D Interattivo per il Cliente */}
              <div className="p-5 bg-raised border border-line rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShow3dViewer(!show3dViewer)}
                    className="text-xs font-semibold text-ink-muted hover:text-accent-ink transition-colors flex items-center gap-2"
                  >
                    <BoxIcon className="w-4 h-4 text-accent-ink" strokeWidth={1.75} />
                    <span>
                      {order.makerWorldUrl 
                        ? (show3dViewer ? 'Nascondi Anteprima Modello 3D / MakerWorld' : 'Visualizza Anteprima Modello 3D (Piatti & Foto MakerWorld)')
                        : order.modelUrl 
                        ? (show3dViewer ? 'Nascondi Modello 3D del Pezzo' : `Visualizza Modello 3D di Produzione (${getModelFiles(order).length > 1 ? `${getModelFiles(order).length} file` : order.modelFileName || 'STL/3MF'})`)
                        : (show3dViewer ? 'Nascondi Visualizzatore 3D' : 'Visualizzatore 3D (Ispezione geometrica)')
                      }
                    </span>
                    {show3dViewer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <div className="flex items-center gap-2">
                    {order.modelUrl && getModelFiles(order).length < 2 && (
                      <a
                        href={order.modelUrl}
                        download={order.modelFileName || 'modello-3d'}
                        className="text-[11px] text-accent-ink hover:underline flex items-center gap-1 bg-accent-soft px-2.5 py-1 rounded-full border border-accent-line"
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
                        className="text-[11px] text-accent-ink hover:underline flex items-center gap-1 bg-accent-soft px-2.5 py-1 rounded-full border border-accent-line"
                      >
                        <span>MakerWorld</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                <ModelFileList
                  files={getModelFiles(order)}
                  activeIndex={activeModelByOrder[order.id] || 0}
                  onSelect={(index) => {
                    setActiveModelByOrder(prev => ({ ...prev, [order.id]: index }));
                    setShow3dViewer(true);
                  }}
                />

                {show3dViewer && (
                  <div className="pt-2">
                    <MakerWorldModelViewer
                      makerWorldUrl={order.makerWorldUrl}
                      modelUrl={getModelFiles(order)[activeModelByOrder[order.id] || 0]?.url || order.modelUrl}
                      modelFileName={getModelFiles(order)[activeModelByOrder[order.id] || 0]?.fileName || order.modelFileName}
                      modelTitle={order.name || order.id}
                      material={order.material || 'PLA'}
                      height={320}
                      allowUpload={!order.modelUrl}
                    />
                  </div>
                )}
              </div>

              {/* Informazioni Ritiro e Pagamento */}
              <div className="p-5 bg-accent-soft border border-accent-line rounded-xl text-xs text-accent-ink flex items-start gap-3.5">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-accent-ink mt-0.5" strokeWidth={1.75} />
                <div>
                  <p className="font-bold text-ink text-sm mb-0.5">Indicazioni per il Ritiro & Pagamento</p>
                  <p className="text-ink-muted leading-relaxed">
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
          <div className="rounded-xl bg-surface border border-line shadow-sm">
            <div className="p-6 sm:p-8 space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-line">
                <div>
                  <span className="text-[11px] font-mono font-semibold text-accent-ink block">
                    Riepilogo Multi-Commessa
                  </span>
                  <h2 className="text-2xl font-bold text-ink tracking-tight">{clientName}</h2>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Visualizzazione unificata di <strong>{orders.length} pezzi di stampa</strong>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCopyBundleLink}
                    className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-on-accent transition-all shadow-md active:scale-[0.98]"
                    title="Copia link che include tutti questi pezzi"
                  >
                    {copiedAllLink ? <CheckCircle2 className="w-3.5 h-3.5 text-ink" /> : <Copy className="w-3.5 h-3.5 text-ink" strokeWidth={2} />}
                    <span>{copiedAllLink ? 'Link Riepilogo Copiato!' : 'Copia Link Unificato'}</span>
                  </button>
                </div>
              </div>

              {/* Metriche Totali */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 bg-raised border border-line rounded-xl">
                  <span className="text-xs text-ink-muted block mb-1">Totale da Saldare</span>
                  <span className="text-3xl font-semibold text-warn-ink block leading-tight font-mono">
                    €{totalDue.toFixed(2)}
                  </span>
                  <span className={`text-[11px] font-bold inline-block mt-2 px-2.5 py-0.5 rounded-full border ${
                    totalDue === 0
                      ? 'bg-accent-soft text-accent-ink border-accent-line' 
                      : 'bg-warn-soft text-warn-ink border-warn-line'
                  }`}>
                    {totalDue === 0 ? 'Tutti i lavori saldati' : 'In attesa di saldo'}
                  </span>
                </div>

                <div className="p-5 bg-raised border border-line rounded-xl">
                  <span className="text-xs text-ink-muted block mb-1">Valore Totale Ordini</span>
                  <span className="text-3xl font-semibold text-ink block leading-tight font-mono">
                    €{totalAll.toFixed(2)}
                  </span>
                  <span className="text-[11px] text-ink-muted block mt-2">
                    {orders.filter(o => o.status === 'saldato').length} di {orders.length} pezzi già consegnati e saldati
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Elenco Schede per Ciascun Pezzo */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-ink-muted px-2 font-mono">
              Dettaglio Pezzi ({orders.length})
            </h3>

            {orders.map((order) => {
              const currentStep = getStepIndex(order.status);
              const isCopied = copiedItemId === order.id;

              return (
                <div key={order.id} className="rounded-xl bg-surface border border-line shadow-sm">
                  <div className="p-5 sm:p-6 space-y-4">
                    
                    {/* Header singolo pezzo */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-line">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[11px] font-mono text-accent-ink font-semibold bg-accent-soft px-2 py-0.5 rounded-full border border-accent-line">
                            #{order.id}
                          </span>
                          {order.quantity && order.quantity > 1 && (
                            <span className="text-[10px] font-mono text-info-ink font-semibold bg-info-soft px-2 py-0.5 rounded-full border border-info-line">
                              {order.quantity} pz
                            </span>
                          )}
                          <button
                            onClick={() => handleCopySingleLink(order.id)}
                            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-raised hover:bg-muted text-ink-muted transition-colors border border-line"
                            title="Copia link diretto solo per questo pezzo"
                          >
                            {isCopied ? <CheckCircle2 className="w-3 h-3 text-accent-ink" /> : <LinkIcon className="w-3 h-3" />}
                            <span>{isCopied ? 'Copiato' : 'Copia link'}</span>
                          </button>
                        </div>
                        <h4 className="text-lg font-bold text-ink tracking-tight">{order.name}</h4>
                        <p className="text-[11px] text-ink-muted">Data: {order.savedAt || 'Registrato'}</p>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-xl font-semibold text-ink block font-mono">€{order.totalCalculated.toFixed(2)}</span>
                        {order.quantity && order.quantity > 1 && (
                          <span className="text-[10px] text-ink-muted font-mono block mb-0.5">
                            (€{(order.totalCalculated / order.quantity).toFixed(2)} / pz)
                          </span>
                        )}
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border inline-block ${
                          order.status === 'saldato' 
                            ? 'bg-accent-soft text-accent-ink border-accent-line' 
                            : 'bg-warn-soft text-warn-ink border-warn-line'
                        }`}>
                          {order.status === 'saldato' ? 'Saldato' : 'Da saldare'}
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
                                ? 'bg-accent-soft border-accent-line ring-1 ring-accent/30' 
                                : isPassed 
                                  ? 'bg-raised border-line text-ink-muted' 
                                  : 'bg-raised border-line opacity-40'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${
                                isCurrent 
                                  ? 'bg-accent text-on-accent' 
                                  : isPassed 
                                    ? 'bg-accent-soft text-accent-ink' 
                                    : 'bg-muted text-ink-faint'
                              }`}>
                                {isPassed && !isCurrent ? '✓' : idx + 1}
                              </span>
                              <span className="font-bold text-ink text-[11px] truncate">{step.label}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Specifiche pezzo */}
                    <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-ink-muted">
                      <span className="flex items-center gap-1 bg-raised px-3 py-1 rounded-full border border-line text-ink-muted">
                        <Layers className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.75} /> {order.material}
                      </span>
                      {order.multiColor && (
                        <span className="bg-info-soft text-info-ink border border-info-line px-3 py-1 rounded-full font-mono text-[10px]">
                          Multi-colore
                        </span>
                      )}
                      {order.extraBom && order.extraBom.length > 0 && (
                        <span className="bg-raised px-3 py-1 rounded-full border border-line text-ink-muted">
                          {order.extraBom.map(b => `${b.qty}x ${b.name}`).join(', ')}
                        </span>
                      )}
                      {order.makerWorldUrl && (
                        <a 
                          href={order.makerWorldUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-accent-ink hover:underline flex items-center gap-1 ml-auto"
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
                              ? 'bg-accent-soft text-accent-ink border-accent-line' 
                              : 'bg-raised hover:bg-raised text-ink-muted border-line'
                          }`}
                        >
                          <BoxIcon className="w-3 h-3 text-accent-ink" />
                          <span>
                            {expandedViewerId === order.id 
                              ? 'Chiudi Anteprima' 
                              : (order.makerWorldUrl 
                                  ? 'Vedi Anteprima 3D' 
                                  : `Vedi Modello 3D (${getModelFiles(order).length > 1 ? `${getModelFiles(order).length} file` : order.modelFileName || 'File'})`
                                )
                            }
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Viewer 3D Espandibile nel Multi-ordine */}
                    {(order.modelUrl || order.makerWorldUrl) && expandedViewerId === order.id && (
                      <div className="pt-3 border-t border-line space-y-2">
                        <ModelFileList
                          files={getModelFiles(order)}
                          activeIndex={activeModelByOrder[order.id] || 0}
                          onSelect={(index) => setActiveModelByOrder(prev => ({ ...prev, [order.id]: index }))}
                        />
                        <MakerWorldModelViewer
                          makerWorldUrl={order.makerWorldUrl}
                          modelUrl={getModelFiles(order)[activeModelByOrder[order.id] || 0]?.url || order.modelUrl}
                          modelFileName={getModelFiles(order)[activeModelByOrder[order.id] || 0]?.fileName || order.modelFileName}
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
          <div className="p-5 bg-accent-soft border border-accent-line rounded-xl text-xs text-accent-ink flex items-start gap-3.5">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-accent-ink mt-0.5" strokeWidth={1.75} />
            <div>
              <p className="font-bold text-ink text-sm mb-0.5">Indicazioni per il Ritiro & Pagamento</p>
              <p className="text-ink-muted leading-relaxed">
                Appena i pezzi raggiungono lo stato <strong>&quot;Pronto al Ritiro&quot;</strong> potrai concordare il ritiro con il laboratorio. Il totale rimanente da saldare è di <strong>€{totalDue.toFixed(2)}</strong>.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* Stato Iniziale se non ha ancora cercato */}
      {orders.length === 0 && !error && !hasSearched && (
        <div className="rounded-xl bg-surface border border-line shadow-sm">
          <div className="text-center py-16 px-6 ">
            <div className="w-16 h-16 rounded-xl bg-raised border border-line flex items-center justify-center mx-auto mb-4 text-ink-faint">
              <Package className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-bold text-ink mb-1.5">Hai un codice ordine?</h3>
            <p className="text-xs sm:text-sm text-ink-muted max-w-md mx-auto leading-relaxed">
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
    <div className="min-h-[100dvh] bg-sunken text-ink font-sans p-3 sm:p-6 flex flex-col justify-between relative">
      <Suspense fallback={<div className="max-w-4xl mx-auto text-xs text-ink-faint py-10 text-center font-mono">Caricamento portale ordini...</div>}>
        <div className="flex-1 flex flex-col">
          <OrdineClienteContent />
        </div>
      </Suspense>

      <footer className="max-w-4xl mx-auto w-full pt-4 pb-2 text-center text-[11px] text-ink-faint border-t border-line flex-shrink-0">
        <p>Preventivi 3D • Portale Tracciamento e Fabbricazione Digitale</p>
      </footer>
    </div>
  );
}
