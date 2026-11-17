'use client';

import React, { useState, useEffect, useMemo, useSyncExternalStore } from 'react';
import { 
  FolderKanban, Search, Trash2, ExternalLink, 
  Share2, CheckCircle2, User, Box, Check, Pencil, Link as LinkIcon,
  MessageSquare, QrCode, MessagesSquare, X as CloseIcon
} from 'lucide-react';
import OrderThread from '@/components/OrderThread';
import Link from 'next/link';
import { getWhatsAppUrl } from '@/lib/whatsapp';
import QrLabelModal, { ParcelLabelData } from '@/components/QrLabelModal';

export type JobStatus = 'richiesta' | 'in_attesa' | 'in_stampa' | 'pronto' | 'saldato';
type PricingType = 'amico' | 'collega' | 'commerciale' | 'richiesta_cliente';

interface BomItem {
  name: string;
  qty: number;
  cost: number;
}

interface SavedQuote {
  id: string;
  name: string;
  clientName: string;
  clientContact?: string;
  pricingType: PricingType;
  makerWorldUrl?: string;
  material: string;
  preferredColor?: string;
  quantity?: number;
  spoolId?: string;
  spoolCost: number;
  weight: number;
  multiColor: boolean;
  colorChanges: number;
  purgeWeight: number;
  hours: number;
  mins: number;
  prepMins: number;
  postMins: number;
  extraBom: BomItem[];
  cadCost: number;
  urgencyCost: number;
  discount: number;
  roundingMode?: 'none' | 'excess' | 'defect' | 'nearest';
  roundingStep?: number;
  savedAt: string;
  totalCalculated: number;
  estimatedProfit: number;
  status?: JobStatus;
  inventoryDeducted?: boolean;
  modelUrl?: string;
  modelFileName?: string;
  modelFiles?: Array<{ url: string; fileName: string }>;
}

const statusConfig: Record<JobStatus, { label: string; text: string; border: string }> = {
  richiesta: { label: 'Richiesta Cliente', text: 'text-warn-ink', border: 'border-warn-line' },
  in_attesa: { label: 'In Attesa', text: 'text-warn-ink', border: 'border-warn-line' },
  in_stampa: { label: 'In Stampa', text: 'text-info-ink', border: 'border-info-line' },
  pronto: { label: 'Pronto / Da Ritirare', text: 'text-info-ink', border: 'border-info-line' },
  saldato: { label: 'Consegnato & Saldato', text: 'text-accent-ink', border: 'border-accent-line' },
};

function subscribeToStorage(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getPrivacySnapshot(): string {
  return localStorage.getItem('printquote_privacy') || 'false';
}

function getSettingsServerSnapshot(): string {
  return '';
}

/** Elementi per pagina; 0 = tutti. Multipli di 3 per riempire la griglia a 3 colonne. */
const PAGE_SIZE_OPTIONS = [6, 12, 24, 48, 0];
const PAGE_SIZE_KEY = 'p3d_quotes_page_size';
const DEFAULT_PAGE_SIZE = 6;

function getPageSizeSnapshot(): string {
  return localStorage.getItem(PAGE_SIZE_KEY) || String(DEFAULT_PAGE_SIZE);
}

function getPageSizeServerSnapshot(): string {
  return String(DEFAULT_PAGE_SIZE);
}

export default function PreventiviPage() {
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | JobStatus>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const storedPageSize = Number(useSyncExternalStore(subscribeToStorage, getPageSizeSnapshot, getPageSizeServerSnapshot));
  const pageSizeChoice = PAGE_SIZE_OPTIONS.includes(storedPageSize) ? storedPageSize : DEFAULT_PAGE_SIZE;
  const changePageSize = (value: number) => {
    localStorage.setItem(PAGE_SIZE_KEY, String(value));
    window.dispatchEvent(new Event('storage'));
    setCurrentPage(1);
  };
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [activeParcelLabel, setActiveParcelLabel] = useState<ParcelLabelData | null>(null);
  const [threadFor, setThreadFor] = useState<SavedQuote | null>(null);
  const [msgSummary, setMsgSummary] = useState<Record<string, { total: number; unread: number }>>({});
  const loadMsgSummary = React.useCallback(() => {
    fetch('/api/order-messages', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.summary) setMsgSummary(d.summary); })
      .catch(() => {});
  }, []);
  useEffect(() => {
    loadMsgSummary();
    const t = setInterval(loadMsgSummary, 60_000);
    return () => clearInterval(t);
  }, [loadMsgSummary]);

  const rawPrivacy = useSyncExternalStore(
    subscribeToStorage,
    getPrivacySnapshot,
    getSettingsServerSnapshot
  );
  const isPrivacyMode = rawPrivacy === 'true';

  useEffect(() => {
    fetch('/api/quotes')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setQuotes(data.map(q => ({
            ...q,
            status: q.status || 'in_attesa',
            inventoryDeducted: q.inventoryDeducted || false
          })));
        }
      })
      .catch(err => console.error("Errore lettura preventivi", err));
  }, []);

  const saveQuotes = async (updated: SavedQuote[]) => {
    setQuotes(updated);
    try {
      await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (e) {
      console.error("Errore salvataggio file", e);
    }
  };

  const deductFromInventory = async (item: SavedQuote) => {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const unitGrams = (parseFloat(item.weight?.toString() || '0') + parseFloat(item.purgeWeight?.toString() || '0'));
    const grams = unitGrams * qty;
    const scaledBom = (item.extraBom || []).map(b => ({
      ...b,
      qty: (parseFloat(b.qty?.toString() || '1') || 1) * qty
    }));

    try {
      await fetch('/api/inventory/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spoolId: item.spoolId,
          gramsUsed: grams,
          bomItems: scaledBom
        })
      });
    } catch (e) {
      console.error("Errore scarico inventario", e);
    }
  };

  const handleStatusChange = async (id: string, newStatus: JobStatus) => {
    const item = quotes.find(q => q.id === id);
    let wasDeducted = item?.inventoryDeducted || false;

    if ((newStatus === 'in_stampa' || newStatus === 'saldato') && !wasDeducted && item) {
      await deductFromInventory(item);
      wasDeducted = true;
    }

    const updated = quotes.map(q => q.id === id ? { ...q, status: newStatus, inventoryDeducted: wasDeducted } : q);
    saveQuotes(updated);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Eliminare definitivamente questo lavoro dal file?")) return;
    const updated = quotes.filter(q => q.id !== id);
    saveQuotes(updated);
  };

  const handleCopyText = (item: SavedQuote) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const qtyStr = item.quantity && item.quantity > 1 ? `\n- Quantità: ${item.quantity} pezzi` : '';
    const text = `*Preventivo Stampa 3D: ${item.name}*
- Cliente: ${item.clientName || 'Anonimo'}
- Materiale: ${item.material}${qtyStr}
- Tempo stimato: ${item.hours}h ${item.mins}m
- Peso totale: ${(parseFloat(item.weight?.toString() || '0') + parseFloat(item.purgeWeight?.toString() || '0')) * (item.quantity || 1)}g
${item.extraBom && item.extraBom.length > 0 ? `- Componenti: ${item.extraBom.map(b => `${b.qty}x ${b.name}`).join(', ')}\n` : ''}${item.makerWorldUrl ? `- Modello: ${item.makerWorldUrl}\n` : ''}- Codice ordine: ${item.id}
🔗 Traccia qui: ${origin}/ordine?code=${item.id}
*Totale: €${item.totalCalculated?.toFixed(2)}*${item.quantity && item.quantity > 1 ? ` (€${(item.totalCalculated / item.quantity).toFixed(2)} cad.)` : ''}`;

    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyTrackingLink = (id: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/ordine?code=${encodeURIComponent(id)}`;
    navigator.clipboard.writeText(link);
    setCopiedLinkId(id);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  const stats = useMemo(() => {
    let pendingValue = 0;
    let printingCount = 0;
    let completedTotal = 0;

    quotes.forEach(q => {
      const tot = q.totalCalculated || 0;
      if (q.status === 'in_attesa' || q.status === 'in_stampa' || q.status === 'pronto') {
        pendingValue += tot;
      }
      if (q.status === 'in_stampa') {
        printingCount += 1;
      }
      if (q.status === 'saldato') {
        completedTotal += tot;
      }
    });

    return { pendingValue, printingCount, completedTotal };
  }, [quotes]);

  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      const matchesStatus = statusFilter === 'all' ? true : (q.status || 'in_attesa') === statusFilter;
      const term = search.toLowerCase();
      const matchesSearch = 
        q.name.toLowerCase().includes(term) ||
        (q.clientName && q.clientName.toLowerCase().includes(term)) ||
        q.material.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [quotes, statusFilter, search]);

  const pageSize = pageSizeChoice === 0 ? Math.max(1, filteredQuotes.length) : pageSizeChoice;
  const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedQuotes = useMemo(() => {
    return filteredQuotes.slice((safePage - 1) * pageSize, safePage * pageSize);
  }, [filteredQuotes, safePage, pageSize]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-sunken text-ink p-2 sm:p-4 font-sans relative">
      <div className="max-w-7xl mx-auto w-full flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
        
        {/* HEADER & METRICHE */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-ink tracking-tight flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-accent-ink" />
              Gestione Lavori & Coda Stampe
            </h1>
            <p className="text-ink-muted text-xs">Traccia avanzamento commesse e modifica preventivi esistenti</p>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
            <div className="bg-surface border border-line px-3 py-1.5 rounded-xl text-center sm:text-left">
              <span className="text-[10px] text-ink-muted block truncate">Da Saldare</span>
              <span className="text-xs sm:text-sm font-bold text-warn-ink">€{stats.pendingValue.toFixed(2)}</span>
            </div>
            <div className="bg-surface border border-line px-3 py-1.5 rounded-xl text-center sm:text-left">
              <span className="text-[10px] text-ink-muted block truncate">In Stampa</span>
              <span className="text-xs sm:text-sm font-bold text-info-ink">{stats.printingCount} pezzi</span>
            </div>
            <div className="bg-surface border border-line px-3 py-1.5 rounded-xl text-center sm:text-left">
              <span className="text-[10px] text-ink-muted block truncate">Incassato</span>
              <span className="text-xs sm:text-sm font-bold text-accent-ink">€{stats.completedTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Banner Nuove Richieste dal Portale Clienti */}
        {quotes.filter(q => q.status === 'richiesta').length > 0 && (
          <div className="flex-shrink-0 p-2.5 bg-warn-soft border border-warn-line rounded-xl flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              
              <div>
                <h3 className="font-bold text-warn-ink text-xs">
                  {quotes.filter(q => q.status === 'richiesta').length} Nuove Richieste dal Portale Clienti!
                </h3>
                <p className="text-[11px] text-warn-ink">
                  Apri le richieste nel calcolatore per impostare peso e tempi di stampa.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setStatusFilter('richiesta');
                setCurrentPage(1);
              }}
              className="px-3 py-1 bg-warn hover:bg-warn text-on-accent font-bold text-xs rounded-lg transition-all whitespace-nowrap shadow-sm flex-shrink-0"
            >
              Vedi Richieste ({quotes.filter(q => q.status === 'richiesta').length})
            </button>
          </div>
        )}

        {/* BARRA FILTRI RESPONSIVE */}
        <div className="flex-shrink-0 bg-surface border border-line p-2 rounded-xl flex flex-col lg:flex-row gap-2 items-stretch lg:items-center justify-between">
          <div className="relative w-full lg:w-72">
            <Search className="w-3.5 h-3.5 text-ink-faint absolute left-3 top-2.5" />
            <input 
              type="text" 
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cerca per pezzo, cliente, materiale..." 
              className="w-full bg-surface border border-line-strong rounded-lg pl-9 pr-3 py-1.5 text-xs text-ink focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto w-full lg:w-auto pb-0.5 lg:pb-0">
            {quotes.filter(q => q.status === 'richiesta').length > 0 && (
              <button 
                onClick={() => { setStatusFilter('richiesta'); setCurrentPage(1); }} 
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border whitespace-nowrap transition-all ${
                  statusFilter === 'richiesta' 
                    ? 'bg-warn-soft border-warn text-warn-ink ring-1 ring-warn/30' 
                    : 'bg-warn-soft border-warn-line text-warn-ink hover:bg-warn-soft'
                }`}
              >
                Richieste ({quotes.filter(q => q.status === 'richiesta').length})
              </button>
            )}
            <button onClick={() => { setStatusFilter('all'); setCurrentPage(1); }} className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap border transition-all ${statusFilter === 'all' ? 'bg-raised border-line-strong text-ink' : 'border-transparent text-ink-muted hover:text-ink'}`}>Tutti ({quotes.length})</button>
            <button onClick={() => { setStatusFilter('in_attesa'); setCurrentPage(1); }} className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap border transition-all ${statusFilter === 'in_attesa' ? 'bg-warn-soft border-warn-line text-warn-ink' : 'border-transparent text-ink-muted hover:text-warn-ink'}`}>In Attesa</button>
            <button onClick={() => { setStatusFilter('in_stampa'); setCurrentPage(1); }} className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap border transition-all ${statusFilter === 'in_stampa' ? 'bg-info-soft border-info-line text-info-ink' : 'border-transparent text-ink-muted hover:text-info-ink'}`}>In Stampa</button>
            <button onClick={() => { setStatusFilter('pronto'); setCurrentPage(1); }} className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap border transition-all ${statusFilter === 'pronto' ? 'bg-info-soft border-info-line text-info-ink' : 'border-transparent text-ink-muted hover:text-info-ink'}`}>Pronti</button>
            <button onClick={() => { setStatusFilter('saldato'); setCurrentPage(1); }} className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap border transition-all ${statusFilter === 'saldato' ? 'bg-accent-soft border-accent-line text-accent-ink' : 'border-transparent text-ink-muted hover:text-accent-ink'}`}>Saldati</button>
          </div>
        </div>

        {/* LISTA SCHEDE LAVORI */}
        {filteredQuotes.length === 0 ? (
          <div className="text-center py-20 bg-surface border border-line rounded-xl">
            <p className="text-ink-faint text-sm">Nessun lavoro trovato.</p>
            <Link href="/" className="inline-block mt-3 text-accent-ink hover:underline text-xs">
              + Crea un nuovo preventivo nel calcolatore
            </Link>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {paginatedQuotes.map((item) => {
              const currentStatus: JobStatus = item.status || 'in_attesa';
              const conf = statusConfig[currentStatus];
              const cardBorder = 
                currentStatus === 'richiesta' ? 'border-warn-line ' :
                currentStatus === 'in_stampa' ? 'border-info-line ' :
                currentStatus === 'pronto' ? 'border-info-line ' :
                currentStatus === 'saldato' ? 'border-accent-line ' : 'border-line';

              return (
                <div 
                  key={item.id} 
                  className={`bg-surface border ${cardBorder} hover:border-line-strong rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-all shadow-lg`}
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-ink text-base truncate">{item.name}</h3>
                          {item.quantity && item.quantity > 1 && (
                            <span className="text-[10px] bg-info-soft text-info-ink border border-info-line px-1.5 py-0.5 rounded font-mono font-bold flex-shrink-0" title={`Lotto di ${item.quantity} pezzi`}>
                              x{item.quantity} pz
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-ink-muted flex items-center gap-1.5 mt-0.5">
                          <User className="w-3 h-3 text-ink-faint" />
                          {item.clientName ? (
                            <Link 
                              href={`/clienti?client=${encodeURIComponent(item.clientName)}`}
                              className="font-medium text-ink-muted hover:text-accent-ink hover:underline transition-colors"
                              title="Vedi scheda e conto cliente"
                            >
                              {item.clientName}
                            </Link>
                          ) : (
                            <span className="font-medium text-ink-faint">Cliente Anonimo</span>
                          )}
                          {item.clientContact && (
                            <span className="text-ink-faint text-[11px]">• {item.clientContact}</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        {item.status === 'richiesta' && (!item.totalCalculated || item.totalCalculated === 0) ? (
                          <span className="text-[11px] font-bold text-warn-ink bg-warn-soft border border-warn-line px-2 py-0.5 rounded block">
                            Da Quantificare
                          </span>
                        ) : (
                          <>
                            <span className="text-lg font-bold text-ink block">€{item.totalCalculated?.toFixed(2)}</span>
                            {item.quantity && item.quantity > 1 && (
                              <span className="text-[10px] text-ink-muted font-mono block">
                                €{(item.totalCalculated / item.quantity).toFixed(2)} /pz
                              </span>
                            )}
                          </>
                        )}
                        {!isPrivacyMode && item.estimatedProfit > 0 && (
                          <span className="text-[10px] text-accent-ink font-medium">netto: €{item.estimatedProfit?.toFixed(2)}</span>
                        )}
                        {item.roundingMode && item.roundingMode !== 'none' && (
                          <span className="text-[9px] text-info-ink bg-info-soft px-1.5 py-0.5 rounded border border-info-line block text-right mt-0.5 font-medium">
                            {item.roundingMode === 'excess' ? '+' : item.roundingMode === 'defect' ? '-' : '≈'} Arrot. (€{(item.roundingStep ?? 0.50).toFixed(2)})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 my-3 p-2.5 bg-sunken border border-line rounded-xl text-xs text-ink-muted">
                      <div>
                        <span className="text-[10px] text-ink-faint block">Materiale / Colore</span>
                        <span className="text-ink font-medium truncate block">
                          {item.material} {item.preferredColor ? `(${item.preferredColor})` : ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-ink-faint block">
                          Tempo & Peso {item.quantity && item.quantity > 1 ? `(x${item.quantity} pz)` : ''}
                        </span>
                        <span className="text-ink font-medium">
                          {item.hours || 0}h {item.mins || 0}m • {((parseFloat(item.weight?.toString() || '0') + parseFloat(item.purgeWeight?.toString() || '0')) * (item.quantity || 1)).toFixed(0)}g
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs">
                      <div className="flex items-center gap-2">
                        {item.modelUrl && (
                          <Link
                            href={`/?id=${encodeURIComponent(item.id)}`}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-info-ink bg-info-soft border border-info-line px-2 py-0.5 rounded-lg hover:bg-info-soft transition-colors"
                            title="Apri e visualizza modello 3D nel calcolatore"
                          >
                            <Box className="w-3 h-3 text-info-ink" />
                            <span className="truncate max-w-[120px]">{item.modelFileName || 'Modello 3D'}</span>
                          </Link>
                        )}

                        {/* File aggiuntivi delle richieste multi-file (il primo è già aperto nel calcolatore) */}
                        {item.modelFiles?.slice(1).map((f, index) => (
                          <a
                            key={f.url}
                            href={f.url}
                            download={f.fileName || `modello-3d-${index + 2}`}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-info-ink bg-info-soft border border-info-line px-2 py-0.5 rounded-lg hover:bg-info-soft transition-colors"
                            title="Scarica file 3D"
                          >
                            <Box className="w-3 h-3 text-info-ink" />
                            <span className="truncate max-w-[120px]">{f.fileName || `Modello ${index + 2}`}</span>
                          </a>
                        ))}

                        {item.makerWorldUrl && (
                          <a href={item.makerWorldUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink-muted hover:text-accent-ink truncate max-w-[140px]">
                            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" /> MakerWorld
                          </a>
                        )}
                      </div>

                      {item.inventoryDeducted ? (
                        <span className="text-[10px] bg-accent-soft text-accent-ink border border-accent-line px-2 py-0.5 rounded flex items-center gap-1 font-medium">
                          <Check className="w-3 h-3" /> Magazzino Scalato
                        </span>
                      ) : (
                        <span className="text-[10px] text-ink-faint flex items-center gap-1">
                          <Box className="w-3 h-3" /> Non scalato
                        </span>
                      )}
                    </div>
                  </div>

                  {/* BARRA AZIONI CON TASTO MODIFICA */}
                  <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
                    <select 
                      value={currentStatus}
                      onChange={(e) => handleStatusChange(item.id, e.target.value as JobStatus)}
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border outline-none bg-sunken cursor-pointer ${conf.text} ${conf.border}`}
                    >
                      <option value="richiesta" className="bg-surface text-warn-ink">Nuova richiesta</option>
                      <option value="in_attesa" className="bg-surface text-warn-ink">In attesa</option>
                      <option value="in_stampa" className="bg-surface text-info-ink">In stampa</option>
                      <option value="pronto" className="bg-surface text-info-ink">Pronto</option>
                      <option value="saldato" className="bg-surface text-accent-ink">Saldato</option>
                    </select>

                    <div className="flex items-center gap-1">
                      {/* Tasto Invia su WhatsApp */}
                      <a
                        href={getWhatsAppUrl({
                          phone: item.clientContact,
                          clientName: item.clientName,
                          projectName: item.name,
                          material: item.material,
                          totalCalculated: item.totalCalculated,
                          orderCode: item.id,
                          status: item.status,
                          quantity: item.quantity
                        })}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 hover:bg-accent-soft text-accent-ink rounded-lg transition-colors"
                        title={item.clientContact ? `Invia aggiornamento su WhatsApp a ${item.clientName || 'Cliente'}` : `Invia su WhatsApp`}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </a>

                      {/* Conversazione con il cliente (visibile nel tracking) */}
                      <button
                        onClick={() => setThreadFor(item)}
                        className="relative p-2 hover:bg-raised text-ink-muted hover:text-ink rounded-lg transition-colors"
                        title={msgSummary[item.id]?.unread ? `${msgSummary[item.id].unread} messaggi non letti dal cliente` : 'Messaggi con il cliente'}
                      >
                        <MessagesSquare className="w-4 h-4" />
                        {msgSummary[item.id]?.unread ? (
                          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-accent text-on-accent text-[10px] font-semibold leading-4 text-center">
                            {msgSummary[item.id].unread}
                          </span>
                        ) : null}
                      </button>

                      {/* Tasto Stampa Etichetta Pacco QR */}
                      <button
                        onClick={() => setActiveParcelLabel({
                          type: 'parcel',
                          orderId: item.id,
                          clientName: item.clientName || 'Cliente',
                          projectName: item.name || 'Progetto 3D',
                          material: item.material,
                          savedAt: item.savedAt,
                          totalCalculated: item.totalCalculated || 0
                        })}
                        className="p-2 hover:bg-info-soft text-info-ink rounded-lg transition-colors"
                        title="Stampa Etichetta Pacco QR per scatola/busta"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>

                      {/* Tasto Modifica Preventivo */}
                      <Link
                        href={`/?id=${encodeURIComponent(item.id)}`}
                        className="p-2 hover:bg-raised rounded-lg text-ink-muted hover:text-accent-ink transition-colors"
                        title="Modifica parametri preventivo nel calcolatore"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>

                      {/* Tasto Copia Link Tracciamento */}
                      <button 
                        onClick={() => handleCopyTrackingLink(item.id)}
                        className="p-2 hover:bg-raised rounded-lg text-ink-muted hover:text-accent-ink transition-colors"
                        title="Copia link diretto di tracciamento per il cliente"
                      >
                        {copiedLinkId === item.id ? <CheckCircle2 className="w-4 h-4 text-accent-ink" /> : <LinkIcon className="w-4 h-4" />}
                      </button>

                      <button 
                        onClick={() => handleCopyText(item)}
                        className="p-2 hover:bg-raised rounded-lg text-ink-muted hover:text-ink transition-colors"
                        title="Copia testo per chat"
                      >
                        {copiedId === item.id ? <CheckCircle2 className="w-4 h-4 text-accent-ink" /> : <Share2 className="w-4 h-4" />}
                      </button>

                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 hover:bg-raised rounded-lg text-ink-muted hover:text-danger-ink transition-colors"
                        title="Elimina"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
            </div>
          </div>
        )}

        {/* FOOTER PAGINAZIONE */}
        {filteredQuotes.length > 0 && (
          <div className="flex-shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-3 border-t border-line text-sm text-ink-muted">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span>
                <strong className="text-ink font-medium">{((safePage - 1) * pageSize) + 1}-{Math.min(safePage * pageSize, filteredQuotes.length)}</strong> di <strong className="text-ink font-medium">{filteredQuotes.length}</strong> lavori
              </span>
              <label className="flex items-center gap-2">
                <span>Per pagina</span>
                <select
                  value={pageSizeChoice}
                  onChange={e => changePageSize(Number(e.target.value))}
                  className="min-h-9 rounded-lg border border-line-strong bg-surface px-2.5 text-sm text-ink focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
                >
                  {PAGE_SIZE_OPTIONS.map(n => (
                    <option key={n} value={n}>{n === 0 ? 'Tutti' : n}</option>
                  ))}
                </select>
              </label>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                  disabled={safePage <= 1}
                  className="btn btn-secondary btn-sm"
                >
                  Precedente
                </button>
                <span className="font-mono text-ink-muted text-sm px-1">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                  disabled={safePage >= totalPages}
                  className="btn btn-secondary btn-sm"
                >
                  Successivo
                </button>
              </div>
            )}
          </div>
        )}

        {threadFor && (
          <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Messaggi: ${threadFor.name}`}>
            <div className="absolute inset-0 bg-scrim" onClick={() => { setThreadFor(null); loadMsgSummary(); }} />
            <div className="relative flex h-full w-full max-w-lg flex-col bg-canvas border-l border-line shadow-lg animate-slide-in">
              <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line px-5">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{threadFor.name}</p>
                  <p className="truncate text-xs text-ink-faint">{threadFor.clientName || 'Cliente'} · codice {threadFor.id}</p>
                </div>
                <button onClick={() => { setThreadFor(null); loadMsgSummary(); }} aria-label="Chiudi" className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-raised">
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <OrderThread
                  orderId={threadFor.id}
                  side="laboratorio"
                  onRead={() => setMsgSummary(prev => ({ ...prev, [threadFor.id]: { ...(prev[threadFor.id] || { total: 0 }), unread: 0 } }))}
                />
              </div>
            </div>
          </div>
        )}

        {/* MODAL ETICHETTA QR PACCO */}
        {activeParcelLabel && (
          <QrLabelModal 
            data={activeParcelLabel} 
            onClose={() => setActiveParcelLabel(null)} 
          />
        )}

      </div>
    </div>
  );
}