'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Search, TrendingUp, Wallet, 
  Package, ChevronRight, AlertCircle, ExternalLink,
  Share2, Printer, Download, CheckCircle2, MessageSquare, 
  Receipt, Copy, X, FileText, Link as LinkIcon, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

type JobStatus = 'in_attesa' | 'in_stampa' | 'pronto' | 'saldato';

interface BomItem {
  name: string;
  qty: number | string;
  cost: number | string;
}

interface SavedQuote {
  id: string;
  name: string;
  clientName: string;
  pricingType: 'amico' | 'collega' | 'commerciale';
  makerWorldUrl?: string;
  material: string;
  savedAt: string;
  totalCalculated: number;
  estimatedProfit: number;
  status?: JobStatus;
  weight?: number | string;
  purgeWeight?: number | string;
  hours?: number | string;
  mins?: number | string;
  extraBom?: BomItem[];
}

interface ClientSummary {
  name: string;
  totalOrders: number;
  totalSpent: number;
  totalProfit: number;
  pendingPayment: number;
  completedOrders: number;
  quotes: SavedQuote[];
}

export default function ClientiPage() {
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [search, setSearch] = useState('');
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'list' | 'detail'>('list');

  // Stato Modale di Esportazione
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFilter, setExportFilter] = useState<'unpaid' | 'all'>('unpaid');
  const [paymentNote, setPaymentNote] = useState('Pagamento in contanti o Satispay al ritiro');
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [copiedSingleId, setCopiedSingleId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [copiedDirectLink, setCopiedDirectLink] = useState(false);

  useEffect(() => {
    // Supporto per aprire subito un cliente tramite ?client=Nome
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const clientParam = params.get('client');
      if (clientParam) {
        setSelectedClientName(clientParam);
        setMobileTab('detail');
      }
    }

    fetch('/api/quotes')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setQuotes(data);
        }
      })
      .catch(err => console.error("Errore lettura clienti", err));
  }, []);

  // Aggrega i dati per singolo cliente
  const clientsData = useMemo(() => {
    const map: Record<string, ClientSummary> = {};

    quotes.forEach(q => {
      const name = (q.clientName || 'Cliente Anonimo').trim();
      if (!map[name]) {
        map[name] = {
          name,
          totalOrders: 0,
          totalSpent: 0,
          totalProfit: 0,
          pendingPayment: 0,
          completedOrders: 0,
          quotes: []
        };
      }

      const total = q.totalCalculated || 0;
      const profit = q.estimatedProfit || 0;
      const status = q.status || 'in_attesa';

      map[name].totalOrders += 1;
      map[name].totalSpent += total;
      map[name].totalProfit += profit;
      map[name].quotes.push(q);

      if (status === 'saldato') {
        map[name].completedOrders += 1;
      } else {
        map[name].pendingPayment += total;
      }
    });

    return Object.values(map);
  }, [quotes]);

  // Totali Generali Laboratorio
  const overallStats = useMemo(() => {
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalPending = 0;

    clientsData.forEach(c => {
      totalRevenue += c.totalSpent;
      totalProfit += c.totalProfit;
      totalPending += c.pendingPayment;
    });

    return { totalRevenue, totalProfit, totalPending, clientCount: clientsData.length };
  }, [clientsData]);

  // Filtro ricerca clienti
  const filteredClients = useMemo(() => {
    const q = search.toLowerCase();
    return clientsData.filter(c => c.name.toLowerCase().includes(q));
  }, [clientsData, search]);

  const activeClient = useMemo(() => {
    if (!selectedClientName) return filteredClients[0] || null;
    return clientsData.find(c => c.name === selectedClientName) || null;
  }, [selectedClientName, filteredClients, clientsData]);

  // Calcoli per la modale di esportazione del cliente selezionato
  const modalTargetQuotes = useMemo(() => {
    if (!activeClient) return [];
    if (exportFilter === 'unpaid') {
      return activeClient.quotes.filter(q => q.status !== 'saldato');
    }
    return activeClient.quotes;
  }, [activeClient, exportFilter]);

  const modalTargetCodes = useMemo(() => {
    return modalTargetQuotes.map(q => q.id).filter(Boolean).join(',');
  }, [modalTargetQuotes]);

  const modalTotalDue = useMemo(() => {
    if (!activeClient) return 0;
    return activeClient.pendingPayment;
  }, [activeClient]);

  const modalTotalIncluded = useMemo(() => {
    return modalTargetQuotes.reduce((sum, q) => sum + (q.totalCalculated || 0), 0);
  }, [modalTargetQuotes]);

  // Generatore Testo WhatsApp Formattato
  const whatsAppText = useMemo(() => {
    if (!activeClient) return '';

    let text = `*Riepilogo Ordini Stampa 3D - ${activeClient.name}*\n`;
    text += `Ciao ${activeClient.name}! Ecco il resoconto dei tuoi pezzi di stampa:\n\n`;

    if (modalTargetQuotes.length === 0) {
      text += `Non ci sono ordini in sospeso al momento! Tutti i lavori risultano saldati. 🎉\n\n`;
    } else {
      text += `📦 *Dettaglio Lavori:*\n`;
      modalTargetQuotes.forEach((q, idx) => {
        const statusLabel = q.status === 'saldato' 
          ? '✅ Saldato' 
          : q.status === 'pronto' 
            ? '🟣 Pronto per il ritiro' 
            : q.status === 'in_stampa' 
              ? '🔵 In stampa' 
              : '🟡 In lavorazione / In coda';
        
        const extra = q.extraBom && q.extraBom.length > 0 
          ? ` + ${q.extraBom.map(b => `${b.qty}x ${b.name}`).join(', ')}` 
          : '';
        
        text += `${idx + 1}. *${q.name}*\n`;
        text += `   • Materiale: ${q.material}${extra}\n`;
        text += `   • Stato: ${statusLabel}\n`;
        text += `   • Importo: €${(q.totalCalculated || 0).toFixed(2)}\n`;
        text += `   • Codice ordine: \`${q.id}\`\n\n`;
      });
    }

    text += `💰 *TOTALE DA SALDARE: €${modalTotalDue.toFixed(2)}*\n`;
    if (exportFilter === 'all') {
      text += `(Totale complessivo storico ordini: €${activeClient.totalSpent.toFixed(2)})\n`;
    }

    if (paymentNote.trim()) {
      text += `\nℹ️ *Nota / Pagamento:* ${paymentNote.trim()}\n`;
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (modalTargetCodes) {
      text += `\n🔗 Traccia ${modalTargetQuotes.length > 1 ? 'i tuoi ordini' : 'il tuo ordine'} in tempo reale:\n${origin}/ordine?codes=${modalTargetCodes}\n`;
    }

    text += `\nGrazie mille! Per qualsiasi chiarimento o per concordare il ritiro, resto a disposizione.`;
    return text;
  }, [activeClient, modalTargetQuotes, modalTargetCodes, modalTotalDue, exportFilter, paymentNote]);

  const handleCopyWhatsApp = () => {
    navigator.clipboard.writeText(whatsAppText);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 2000);
  };

  const handleOpenWhatsAppWeb = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(whatsAppText)}`;
    window.open(url, '_blank');
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleDownloadCSV = () => {
    if (!activeClient) return;
    const headers = ['Data', 'Nome Progetto', 'Materiale', 'Stato', 'Importo (EUR)'];
    const rows = modalTargetQuotes.map(q => [
      `"${q.savedAt || ''}"`,
      `"${(q.name || '').replace(/"/g, '""')}"`,
      `"${(q.material || '').replace(/"/g, '""')}"`,
      `"${q.status || 'in_attesa'}"`,
      (q.totalCalculated || 0).toFixed(2)
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ordini_${activeClient.name.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopySingle = (q: SavedQuote) => {
    const statusLabel = q.status === 'saldato' 
      ? 'Saldato' 
      : q.status === 'pronto' 
        ? 'Pronto per il ritiro' 
        : q.status === 'in_stampa' 
          ? 'In stampa' 
          : 'In lavorazione';

    const extra = q.extraBom && q.extraBom.length > 0 ? `\n- Componenti: ${q.extraBom.map(b => `${b.qty}x ${b.name}`).join(', ')}` : '';
    const makerLink = q.makerWorldUrl ? `\n- Modello 3D: ${q.makerWorldUrl}` : '';

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const text = `*Preventivo Stampa 3D: ${q.name}*
- Cliente: ${q.clientName || 'Anonimo'}
- Materiale: ${q.material}
- Stato: ${statusLabel}${extra}${makerLink}
- Codice ordine: ${q.id}
🔗 Traccia qui: ${origin}/ordine?code=${q.id}
*Totale da pagare: €${(q.totalCalculated || 0).toFixed(2)}*`;

    navigator.clipboard.writeText(text);
    setCopiedSingleId(q.id);
    setTimeout(() => setCopiedSingleId(null), 2000);
  };

  const handleCopyTrackingLink = (id: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/ordine?code=${encodeURIComponent(id)}`;
    navigator.clipboard.writeText(link);
    setCopiedLinkId(id);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  return (
    <div className="h-full max-h-full overflow-hidden bg-slate-950 text-slate-200 p-2 sm:p-3 font-sans flex flex-col">
      
      {/* 1. SEZIONE RICEVUTA PDF / ESTRATTO CONTO PER LA STAMPA (@media print) */}
      {activeClient && (
        <div className="hidden print:block text-black bg-white p-8 max-w-3xl mx-auto font-sans">
          <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">Riepilogo Ordini & Estratto Conto</h1>
              <p className="text-xs text-gray-600 mt-1">Laboratorio Stampa 3D FDM & Prototipazione</p>
            </div>
            <div className="text-right text-xs">
              <p className="font-bold">Data: {new Date().toLocaleDateString('it-IT')}</p>
              <p className="text-gray-600">Doc: STAT-{activeClient.name.toUpperCase().replace(/\s+/g, '')}</p>
            </div>
          </div>

          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg flex justify-between items-center text-xs">
            <div>
              <span className="text-gray-500 uppercase font-semibold text-[10px] block">Cliente</span>
              <p className="text-base font-bold text-gray-900">{activeClient.name}</p>
            </div>
            <div className="text-right">
              <span className="text-gray-500 uppercase font-semibold text-[10px] block">Filtro Documento</span>
              <p className="font-medium text-gray-800">
                {exportFilter === 'unpaid' ? 'Solo ordini da saldare' : 'Tutti gli ordini'} ({modalTargetQuotes.length} pezzi)
              </p>
            </div>
          </div>

          <h3 className="text-xs font-bold uppercase tracking-wider border-b border-gray-300 pb-1 mb-3">
            Elenco Dettagliato Lavori
          </h3>
          
          <table className="w-full text-xs text-left mb-6">
            <thead>
              <tr className="border-b border-gray-300 text-gray-600 uppercase text-[10px]">
                <th className="py-2">Data</th>
                <th className="py-2">Descrizione Pezzo</th>
                <th className="py-2">Materiale / Note</th>
                <th className="py-2 text-center">Stato</th>
                <th className="py-2 text-right">Prezzo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {modalTargetQuotes.map((q, idx) => (
                <tr key={idx}>
                  <td className="py-2 text-gray-600">{q.savedAt || '-'}</td>
                  <td className="py-2 font-medium">{q.name}</td>
                  <td className="py-2 text-gray-600">
                    {q.material}
                    {q.extraBom && q.extraBom.length > 0 && ` (+ ${q.extraBom.map(b => `${b.qty}x ${b.name}`).join(', ')})`}
                  </td>
                  <td className="py-2 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      q.status === 'saldato' ? 'bg-gray-100 text-gray-700' : 'bg-gray-200 text-gray-900 font-bold'
                    }`}>
                      {q.status === 'saldato' ? 'Saldato' : q.status === 'pronto' ? 'Pronto' : q.status === 'in_stampa' ? 'In stampa' : 'In attesa'}
                    </span>
                  </td>
                  <td className="py-2 font-bold text-right">€{(q.totalCalculated || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t-2 border-black pt-4 flex flex-col items-end">
            <div className="w-72 space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Totale Pezzi Inclusi:</span>
                <span className="font-semibold">€{modalTotalIncluded.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Ordini Storici Già Saldati:</span>
                <span className="font-semibold text-gray-800">
                  €{(activeClient.totalSpent - activeClient.pendingPayment).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-t-2 border-gray-300 pt-2 text-base font-black">
                <span>TOTALE DA SALDARE:</span>
                <span className="text-xl">€{activeClient.pendingPayment.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {paymentNote && (
            <div className="mt-6 p-3 bg-gray-50 border border-gray-200 rounded text-xs">
              <span className="font-bold block text-[10px] uppercase text-gray-600 mb-0.5">Indicazioni di Pagamento:</span>
              <p className="text-gray-800">{paymentNote}</p>
            </div>
          )}

          <div className="mt-12 pt-4 border-t border-gray-200 text-[10px] text-gray-500 text-center">
            Documento generato tramite PrintQuote Pro • Grazie per il supporto al nostro maker lab!
          </div>
        </div>
      )}

      {/* 2. SCHERMATA WEB STANDARD */}
      <div className="max-w-7xl mx-auto w-full flex-1 min-h-0 flex flex-col gap-2 print:hidden overflow-hidden">
        
        {/* HEADER & METRICHE GLOBALI */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              Rubrica Clienti & Guadagni
            </h1>
            <p className="text-slate-400 text-xs">Monitora volumi, esporta resoconti e verifica i pagamenti</p>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
            <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-center sm:text-left">
              <span className="text-[10px] text-slate-400 flex items-center justify-center sm:justify-start gap-1 truncate">
                <Wallet className="w-3 h-3 text-slate-400 flex-shrink-0" /> Incassato
              </span>
              <span className="text-xs sm:text-sm font-bold text-white">€{overallStats.totalRevenue.toFixed(2)}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-center sm:text-left">
              <span className="text-[10px] text-slate-400 flex items-center justify-center sm:justify-start gap-1 truncate">
                <TrendingUp className="w-3 h-3 text-emerald-400 flex-shrink-0" /> Netto
              </span>
              <span className="text-xs sm:text-sm font-bold text-emerald-400">€{overallStats.totalProfit.toFixed(2)}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-center sm:text-left">
              <span className="text-[10px] text-slate-400 flex items-center justify-center sm:justify-start gap-1 truncate">
                <AlertCircle className="w-3 h-3 text-amber-400 flex-shrink-0" /> Sospeso
              </span>
              <span className="text-xs sm:text-sm font-bold text-amber-400">€{overallStats.totalPending.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* LAYOUT A 2 COLONNE: LISTA CLIENTI A SINISTRA, DETTAGLIO A DESTRA */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden">
          
          {/* COLONNA SINISTRA: ELENCO CLIENTI (5 COLONNE) */}
          <div className={`lg:col-span-5 flex flex-col min-h-0 space-y-2 overflow-hidden ${mobileTab === 'detail' ? 'hidden lg:flex' : 'flex'}`}>
            <div className="relative flex-shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input 
                type="text" 
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cerca cliente..." 
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1.5">
              {filteredClients.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-500 text-sm">
                  Nessun cliente registrato nei preventivi.
                </div>
              ) : (
                filteredClients.map((client) => {
                  const isSelected = activeClient?.name === client.name;
                  return (
                    <div 
                      key={client.name}
                      onClick={() => {
                        setSelectedClientName(client.name);
                        setExportFilter(client.pendingPayment > 0 ? 'unpaid' : 'all');
                        setMobileTab('detail');
                      }}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected 
                          ? 'bg-emerald-950/20 border-emerald-500/50 shadow-md' 
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white text-sm">{client.name}</h3>
                          {client.pendingPayment > 0 && (
                            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded text-[10px] font-medium">
                              In sospeso: €{client.pendingPayment.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                          <span>{client.totalOrders} {client.totalOrders === 1 ? 'stampa' : 'stampe'}</span>
                          <span>•</span>
                          <span className="text-slate-300">Speso: <strong>€{client.totalSpent.toFixed(2)}</strong></span>
                        </p>
                      </div>

                      <div className="text-right flex items-center gap-2">
                        <div>
                          <span className="text-xs text-emerald-400 font-bold block">+€{client.totalProfit.toFixed(2)}</span>
                          <span className="text-[10px] text-slate-500">margine netto</span>
                        </div>
                        <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-emerald-400' : 'text-slate-600'}`} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* COLONNA DESTRA: DETTAGLIO CLIENTE & AZIONI ESPORTAZIONE (7 COLONNE) */}
          <div className={`lg:col-span-7 flex flex-col min-h-0 overflow-y-auto ${mobileTab === 'list' ? 'hidden lg:flex' : 'flex'}`}>
            {activeClient ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 space-y-4">
                
                {/* Mobile Back Button (visibile solo su schermi < lg quando in detail mode) */}
                <div className="lg:hidden flex items-center justify-between pb-3 border-b border-slate-800">
                  <button
                    onClick={() => setMobileTab('list')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 text-emerald-400" />
                    <span>Torna ai Clienti</span>
                  </button>
                  <span className="text-xs font-bold text-white truncate max-w-[160px]">{activeClient.name}</span>
                </div>

                {/* Header Profilo Cliente */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">{activeClient.name}</h2>
                    <span className="text-xs text-slate-400">Scheda cliente e resoconto commesse</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Tasto principale ESPORTA / INVIA CONTO */}
                    <button
                      onClick={() => {
                        setExportFilter(activeClient.pendingPayment > 0 ? 'unpaid' : 'all');
                        setExportModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-950"
                      title="Esporta il resoconto ordini e importi per il cliente"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Invia / Esporta Conto</span>
                    </button>

                    <Link 
                      href={`/?client=${encodeURIComponent(activeClient.name)}`}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      + Nuovo Preventivo
                    </Link>
                  </div>
                </div>

                {/* Box Statistiche Singolo Cliente */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                    <span className="text-[11px] text-slate-400 block">Stampe Totali</span>
                    <span className="text-base font-bold text-white">{activeClient.totalOrders} pezzi</span>
                  </div>
                  <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                    <span className="text-[11px] text-slate-400 block">Incasso Complessivo</span>
                    <span className="text-base font-bold text-emerald-400">€{activeClient.totalSpent.toFixed(2)}</span>
                  </div>
                  <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                    <span className="text-[11px] text-slate-400 block">Debito In Sospeso</span>
                    <span className={`text-base font-bold ${activeClient.pendingPayment > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                      €{activeClient.pendingPayment.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Banner Rapido se il cliente deve pagare */}
                {activeClient.pendingPayment > 0 && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-white">
                          Ci sono <strong>€{activeClient.pendingPayment.toFixed(2)}</strong> da saldare per questo cliente
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {activeClient.quotes.filter(q => q.status !== 'saldato').length} ordini in sospeso
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setExportFilter('unpaid');
                        setExportModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold rounded-lg transition-colors border border-amber-500/40 flex items-center gap-1.5"
                    >
                      <Share2 className="w-3.5 h-3.5" /> Invia Promemoria
                    </button>
                  </div>
                )}

                {/* Lista Stampe Fatte per questo Cliente */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-emerald-400" /> Storico Pezzi Stampati ({activeClient.quotes.length})
                    </h3>
                  </div>

                  <div className="space-y-2 max-h-[44vh] overflow-y-auto pr-1">
                    {activeClient.quotes.map((q) => {
                      const isPaid = q.status === 'saldato';
                      return (
                        <div 
                          key={q.id}
                          className="p-3 bg-slate-950/60 border border-slate-800/70 hover:border-slate-700 rounded-xl flex items-center justify-between gap-3 text-xs transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-200 truncate">{q.name}</span>
                              {q.makerWorldUrl && (
                                <a 
                                  href={q.makerWorldUrl} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="text-slate-500 hover:text-emerald-400"
                                  title="Apri modello MakerWorld"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-slate-500 text-[11px] mt-0.5">
                              <span>{q.material}</span>
                              <span>•</span>
                              <span>{q.savedAt}</span>
                              {q.extraBom && q.extraBom.length > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-purple-400/90">{q.extraBom.length} parti extra</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="text-right whitespace-nowrap flex items-center gap-2.5">
                            <div>
                              <span className="font-bold text-white block">€{q.totalCalculated?.toFixed(2)}</span>
                              <span className="text-[10px] text-emerald-400/90">+€{q.estimatedProfit?.toFixed(2)}</span>
                            </div>

                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                              isPaid 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}>
                              {isPaid ? 'Saldato' : 'In attesa'}
                            </span>

                            {/* Tasto copia link tracciamento singolo */}
                            <button
                              onClick={() => handleCopyTrackingLink(q.id)}
                              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors"
                              title="Copia link diretto di tracciamento per il cliente"
                            >
                              {copiedLinkId === q.id ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <LinkIcon className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* Tasto copia preventivo singolo */}
                            <button
                              onClick={() => handleCopySingle(q)}
                              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                              title="Copia testo singolo preventivo per WhatsApp"
                            >
                              {copiedSingleId === q.id ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-12 bg-slate-900 border border-slate-800 rounded-2xl text-slate-500 text-sm">
                Seleziona un cliente dalla lista per visualizzare i dettagli.
              </div>
            )}
          </div>

        </div>

      </div>

      {/* 3. MODALE DI ESPORTAZIONE CONTO CLIENTE */}
      {exportModalOpen && activeClient && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Esporta Conto per {activeClient.name}</h3>
                  <p className="text-xs text-slate-400">Genera il riepilogo da inviare al cliente indicando il totale dovuto</p>
                </div>
              </div>

              <button 
                onClick={() => setExportModalOpen(false)}
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5">
              
              {/* Opzioni di Inclusione Ordini */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setExportFilter('unpaid')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    exportFilter === 'unpaid'
                      ? 'bg-amber-500/10 border-amber-500/50 text-amber-300 ring-1 ring-amber-500/40'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="font-bold text-sm block text-white mb-0.5">Solo da saldare ({activeClient.quotes.filter(q => q.status !== 'saldato').length})</span>
                  <span className="text-xs text-slate-400">Invia solo i pezzi non ancora pagati</span>
                </button>

                <button
                  onClick={() => setExportFilter('all')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    exportFilter === 'all'
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/40'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="font-bold text-sm block text-white mb-0.5">Tutti gli ordini ({activeClient.quotes.length})</span>
                  <span className="text-xs text-slate-400">Riepilogo completo dello storico pezzi</span>
                </button>
              </div>

              {/* Riquadro Totale Evidenziato */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">Totale Dovuto da Richiedere</span>
                  <span className="text-xs text-slate-500">
                    {modalTargetQuotes.length} pezzi inclusi nel riepilogo
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-400">€{modalTotalDue.toFixed(2)}</span>
                </div>
              </div>

              {/* Box Link Diretto di Tracciamento Multi-ordine */}
              {modalTargetQuotes.length > 0 && (
                <div className="p-4 bg-slate-950/80 border border-emerald-500/30 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5 text-emerald-400" />
                      Link Tracciamento Cliente ({exportFilter === 'unpaid' ? 'Solo pezzi da saldare' : 'Tutti gli ordini'} • {modalTargetQuotes.length} {modalTargetQuotes.length === 1 ? 'pezzo' : 'pezzi'})
                    </span>
                    <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {modalTargetQuotes.length > 1 ? 'Multi-ordine' : 'Singolo'}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={typeof window !== 'undefined' && modalTargetCodes ? `${window.location.origin}/ordine?codes=${modalTargetCodes}` : ''}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono select-all focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() => {
                        if (typeof window !== 'undefined' && modalTargetCodes) {
                          const url = `${window.location.origin}/ordine?codes=${modalTargetCodes}`;
                          navigator.clipboard.writeText(url);
                          setCopiedDirectLink(true);
                          setTimeout(() => setCopiedDirectLink(false), 2000);
                        }
                      }}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm shadow-emerald-950"
                      title="Copia solo il link di tracciamento per il cliente"
                    >
                      {copiedDirectLink ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedDirectLink ? 'Link copiato!' : 'Copia Solo Link'}</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Invia questo link al cliente: aprirà direttamente il portale con {exportFilter === 'unpaid' ? 'tutti i pezzi ancora da saldare' : 'tutti i suoi ordini'}, lo stato di avanzamento e l&apos;importo dovuto.
                  </p>
                </div>
              )}

              {/* Campo Nota Pagamento Personalizzabile */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Indicazioni di Pagamento o Nota (facoltativa)
                </label>
                <input 
                  type="text" 
                  value={paymentNote}
                  onChange={e => setPaymentNote(e.target.value)}
                  placeholder="Es. Satispay, contanti al ritiro, IBAN..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Anteprima Testo WhatsApp */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" /> Anteprima Messaggio WhatsApp
                  </span>
                  <span className="text-[11px] text-slate-500">Testo pronto per l&apos;invio</span>
                </label>
                
                <textarea 
                  readOnly
                  value={whatsAppText}
                  rows={8}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 font-mono leading-relaxed outline-none select-all"
                />
              </div>

            </div>

            {/* Modal Footer Azioni */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
              
              <div className="flex items-center gap-2">
                {/* Scarica CSV */}
                <button
                  onClick={handleDownloadCSV}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                  title="Scarica foglio Excel/CSV con gli ordini"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>

                {/* Stampa PDF */}
                <button
                  onClick={handlePrintReceipt}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                  title="Stampa foglio cartaceo o esporta come PDF"
                >
                  <Printer className="w-3.5 h-3.5" /> Stampa / PDF
                </button>

                {/* Copia solo Link Tracciamento */}
                {modalTargetQuotes.length > 0 && (
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined' && modalTargetCodes) {
                        const url = `${window.location.origin}/ordine?codes=${modalTargetCodes}`;
                        navigator.clipboard.writeText(url);
                        setCopiedLinkId('modal-target');
                        setTimeout(() => setCopiedLinkId(null), 2000);
                      }
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                    title="Copia link diretto di tracciamento per il cliente"
                  >
                    {copiedLinkId === 'modal-target' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <LinkIcon className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedLinkId === 'modal-target' ? 'Link copiato!' : 'Copia Link'}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Apri WhatsApp Web */}
                <button
                  onClick={handleOpenWhatsAppWeb}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 border border-emerald-500/30"
                  title="Invia direttamente aprendo WhatsApp"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Apri su WhatsApp
                </button>

                {/* Copia Testo Negli Appunti */}
                <button
                  onClick={handleCopyWhatsApp}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-950"
                >
                  {copiedWhatsApp ? <CheckCircle2 className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedWhatsApp ? 'Copiato negli appunti!' : 'Copia per WhatsApp'}</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}