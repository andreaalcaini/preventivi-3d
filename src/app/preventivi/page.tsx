'use client';

import React, { useState, useEffect, useMemo, useSyncExternalStore } from 'react';
import { 
  FolderKanban, Search, Trash2, ExternalLink, 
  Share2, CheckCircle2, User, Box, Check, Pencil, Link as LinkIcon
} from 'lucide-react';
import Link from 'next/link';

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
  savedAt: string;
  totalCalculated: number;
  estimatedProfit: number;
  status?: JobStatus;
  inventoryDeducted?: boolean;
  modelUrl?: string;
  modelFileName?: string;
}

const statusConfig: Record<JobStatus, { label: string; text: string; border: string }> = {
  richiesta: { label: 'Richiesta Cliente', text: 'text-amber-300', border: 'border-amber-400/40' },
  in_attesa: { label: 'In Attesa', text: 'text-amber-400', border: 'border-amber-500/30' },
  in_stampa: { label: 'In Stampa', text: 'text-blue-400', border: 'border-blue-500/30' },
  pronto: { label: 'Pronto / Da Ritirare', text: 'text-purple-400', border: 'border-purple-500/30' },
  saldato: { label: 'Consegnato & Saldato', text: 'text-emerald-400', border: 'border-emerald-500/30' },
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

export default function PreventiviPage() {
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | JobStatus>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

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
    const grams = (parseFloat(item.weight?.toString() || '0') + parseFloat(item.purgeWeight?.toString() || '0'));
    try {
      await fetch('/api/inventory/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spoolId: item.spoolId,
          gramsUsed: grams,
          bomItems: item.extraBom || []
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
    const text = `*Preventivo Stampa 3D: ${item.name}*
- Cliente: ${item.clientName || 'Anonimo'}
- Materiale: ${item.material}
- Tempo stimato: ${item.hours}h ${item.mins}m
- Peso totale: ${(parseFloat(item.weight?.toString() || '0') + parseFloat(item.purgeWeight?.toString() || '0'))}g
${item.extraBom && item.extraBom.length > 0 ? `- Componenti: ${item.extraBom.map(b => `${b.qty}x ${b.name}`).join(', ')}\n` : ''}${item.makerWorldUrl ? `- Modello: ${item.makerWorldUrl}\n` : ''}- Codice ordine: ${item.id}
🔗 Traccia qui: ${origin}/ordine?code=${item.id}
*Totale: €${item.totalCalculated?.toFixed(2)}*`;

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER & METRICHE */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <FolderKanban className="w-6 h-6 text-emerald-400" />
              Gestione Lavori & Coda Stampe
            </h1>
            <p className="text-slate-400 text-sm">Traccia avanzamento commesse e modifica preventivi esistenti</p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full md:w-auto">
            <div className="bg-slate-900 border border-slate-800 p-2.5 sm:px-4 sm:py-2.5 rounded-xl text-center md:text-left">
              <span className="text-[10px] sm:text-[11px] text-slate-400 block truncate">Da Saldare</span>
              <span className="text-sm sm:text-lg font-bold text-amber-400">€{stats.pendingValue.toFixed(2)}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-2.5 sm:px-4 sm:py-2.5 rounded-xl text-center md:text-left">
              <span className="text-[10px] sm:text-[11px] text-slate-400 block truncate">In Stampa</span>
              <span className="text-sm sm:text-lg font-bold text-blue-400">{stats.printingCount} pezzi</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-2.5 sm:px-4 sm:py-2.5 rounded-xl text-center md:text-left">
              <span className="text-[10px] sm:text-[11px] text-slate-400 block truncate">Incassato</span>
              <span className="text-sm sm:text-lg font-bold text-emerald-400">€{stats.completedTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Banner Nuove Richieste dal Portale Clienti */}
        {quotes.filter(q => q.status === 'richiesta').length > 0 && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-amber-950/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 text-amber-300 rounded-xl text-lg">
                🔔
              </div>
              <div>
                <h3 className="font-bold text-amber-300 text-sm">
                  {quotes.filter(q => q.status === 'richiesta').length} {quotes.filter(q => q.status === 'richiesta').length === 1 ? 'Nuova Richiesta di Preventivo' : 'Nuove Richieste di Preventivo'} dal Portale Clienti!
                </h3>
                <p className="text-xs text-amber-400/80">
                  I clienti hanno inviato una richiesta da /richiedi-preventivo. Aprila nel calcolatore per impostare peso e tempo.
                </p>
              </div>
            </div>
            <button
              onClick={() => setStatusFilter('richiesta')}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all whitespace-nowrap shadow-sm self-end sm:self-auto"
            >
              Visualizza Richieste ({quotes.filter(q => q.status === 'richiesta').length})
            </button>
          </div>
        )}

        {/* BARRA FILTRI RESPONSIVE */}
        <div className="bg-slate-900 border border-slate-800 p-3 sm:p-4 rounded-2xl flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input 
              type="text" 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca per pezzo, cliente, materiale..." 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
            {quotes.filter(q => q.status === 'richiesta').length > 0 && (
              <button 
                onClick={() => setStatusFilter('richiesta')} 
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border whitespace-nowrap transition-all ${
                  statusFilter === 'richiesta' 
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500/40' 
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                }`}
              >
                🔔 Richieste ({quotes.filter(q => q.status === 'richiesta').length})
              </button>
            )}
            <button onClick={() => setStatusFilter('all')} className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border transition-all ${statusFilter === 'all' ? 'bg-slate-800 border-slate-700 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>Tutti ({quotes.length})</button>
            <button onClick={() => setStatusFilter('in_attesa')} className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border transition-all ${statusFilter === 'in_attesa' ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'border-transparent text-slate-400 hover:text-amber-400'}`}>In Attesa</button>
            <button onClick={() => setStatusFilter('in_stampa')} className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border transition-all ${statusFilter === 'in_stampa' ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'border-transparent text-slate-400 hover:text-blue-400'}`}>In Stampa</button>
            <button onClick={() => setStatusFilter('pronto')} className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border transition-all ${statusFilter === 'pronto' ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' : 'border-transparent text-slate-400 hover:text-purple-400'}`}>Pronti</button>
            <button onClick={() => setStatusFilter('saldato')} className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border transition-all ${statusFilter === 'saldato' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'border-transparent text-slate-400 hover:text-emerald-400'}`}>Saldati</button>
          </div>
        </div>

        {/* LISTA SCHEDE LAVORI */}
        {filteredQuotes.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
            <p className="text-slate-500 text-sm">Nessun lavoro trovato.</p>
            <Link href="/" className="inline-block mt-3 text-emerald-400 hover:underline text-xs">
              + Crea un nuovo preventivo nel calcolatore
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredQuotes.map((item) => {
              const currentStatus: JobStatus = item.status || 'in_attesa';
              const conf = statusConfig[currentStatus];
              const cardBorder = 
                currentStatus === 'richiesta' ? 'border-amber-500/40 shadow-amber-950/20' :
                currentStatus === 'in_stampa' ? 'border-blue-500/30 shadow-blue-950/20' :
                currentStatus === 'pronto' ? 'border-purple-500/30 shadow-purple-950/20' :
                currentStatus === 'saldato' ? 'border-emerald-500/30 shadow-emerald-950/20' : 'border-slate-800';

              return (
                <div 
                  key={item.id} 
                  className={`bg-slate-900 border ${cardBorder} hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all shadow-xl`}
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-white text-base truncate">{item.name}</h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <User className="w-3 h-3 text-slate-500" />
                          {item.clientName ? (
                            <Link 
                              href={`/clienti?client=${encodeURIComponent(item.clientName)}`}
                              className="font-medium text-slate-300 hover:text-emerald-400 hover:underline transition-colors"
                              title="Vedi scheda e conto cliente"
                            >
                              {item.clientName}
                            </Link>
                          ) : (
                            <span className="font-medium text-slate-500">Cliente Anonimo</span>
                          )}
                          {item.clientContact && (
                            <span className="text-slate-500 text-[11px]">• {item.clientContact}</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        {item.status === 'richiesta' && (!item.totalCalculated || item.totalCalculated === 0) ? (
                          <span className="text-[11px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded block">
                            Da Quantificare
                          </span>
                        ) : (
                          <span className="text-lg font-bold text-white block">€{item.totalCalculated?.toFixed(2)}</span>
                        )}
                        {!isPrivacyMode && item.estimatedProfit > 0 && (
                          <span className="text-[10px] text-emerald-400/90 font-medium">netto: €{item.estimatedProfit?.toFixed(2)}</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 my-3 p-2.5 bg-slate-950/60 border border-slate-800/60 rounded-xl text-xs text-slate-400">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Materiale / Colore</span>
                        <span className="text-slate-200 font-medium truncate block">
                          {item.material} {item.preferredColor ? `(${item.preferredColor})` : ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Tempo & Peso</span>
                        <span className="text-slate-200 font-medium">
                          {item.hours || 0}h {item.mins || 0}m • {(parseFloat(item.weight?.toString() || '0') + parseFloat(item.purgeWeight?.toString() || '0'))}g
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs">
                      <div className="flex items-center gap-2">
                        {item.modelUrl && (
                          <Link
                            href={`/?id=${encodeURIComponent(item.id)}`}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-lg hover:bg-purple-500/20 transition-colors"
                            title="Apri e visualizza modello 3D nel calcolatore"
                          >
                            <Box className="w-3 h-3 text-purple-400" />
                            <span className="truncate max-w-[120px]">{item.modelFileName || 'Modello 3D'}</span>
                          </Link>
                        )}

                        {item.makerWorldUrl && (
                          <a href={item.makerWorldUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-slate-400 hover:text-emerald-400 truncate max-w-[140px]">
                            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" /> MakerWorld
                          </a>
                        )}
                      </div>

                      {item.inventoryDeducted ? (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
                          <Check className="w-3 h-3" /> Magazzino Scalato
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Box className="w-3 h-3" /> Non scalato
                        </span>
                      )}
                    </div>
                  </div>

                  {/* BARRA AZIONI CON TASTO MODIFICA */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <select 
                      value={currentStatus}
                      onChange={(e) => handleStatusChange(item.id, e.target.value as JobStatus)}
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border outline-none bg-slate-950 cursor-pointer ${conf.text} ${conf.border}`}
                    >
                      <option value="richiesta" className="bg-slate-900 text-amber-300">🟠 Nuova Richiesta</option>
                      <option value="in_attesa" className="bg-slate-900 text-amber-400">🟡 In Attesa</option>
                      <option value="in_stampa" className="bg-slate-900 text-blue-400">🔵 In Stampa</option>
                      <option value="pronto" className="bg-slate-900 text-purple-400">🟣 Pronto</option>
                      <option value="saldato" className="bg-slate-900 text-emerald-400">🟢 Saldato</option>
                    </select>

                    <div className="flex items-center gap-1">
                      {/* Tasto Modifica Preventivo */}
                      <Link
                        href={`/?id=${encodeURIComponent(item.id)}`}
                        className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors"
                        title="Modifica parametri preventivo nel calcolatore"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>

                      {/* Tasto Copia Link Tracciamento */}
                      <button 
                        onClick={() => handleCopyTrackingLink(item.id)}
                        className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors"
                        title="Copia link diretto di tracciamento per il cliente"
                      >
                        {copiedLinkId === item.id ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <LinkIcon className="w-4 h-4" />}
                      </button>

                      <button 
                        onClick={() => handleCopyText(item)}
                        className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                        title="Copia testo per WhatsApp"
                      >
                        {copiedId === item.id ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                      </button>

                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
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
        )}

      </div>
    </div>
  );
}