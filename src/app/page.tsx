'use client';

import React, { useState, useEffect, useSyncExternalStore, useMemo, useRef } from 'react';
import { 
  Settings, Calculator, Clock, Wrench, Share2, 
  Plus, Trash2, ChevronDown, ChevronUp, CheckCircle2, 
  Save, FolderOpen, FilePlus2, ExternalLink, Link as LinkIcon,
  User, UserPlus, Layers, FileText, Pencil, X, Box as BoxIcon
} from 'lucide-react';
import Link from 'next/link';
import StlViewer from '@/components/StlViewer';

interface BomItem {
  name: string;
  qty: number;
  cost: number;
}

type PricingType = 'amico' | 'collega' | 'commerciale';

interface QuoteState {
  id: string;
  name: string;
  clientName: string;
  pricingType: PricingType;
  makerWorldUrl?: string;
  material: string;
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
  modelUrl?: string;
  modelFileName?: string;
}

interface SavedQuote extends QuoteState {
  savedAt: string;
  totalCalculated: number;
  estimatedProfit: number;
  status?: 'in_attesa' | 'in_stampa' | 'pronto' | 'saldato';
  inventoryDeducted?: boolean;
}

interface AppSettings {
  powerCost: number;
  watt: number;
  wearCost: number;
  laborRate: number;
  risk: number;
  markup: number;
}

interface SpoolInventory {
  id: string;
  brand: string;
  material: string;
  color: string;
  cost: number;
  weightRemaining: number;
}

interface HardwareInventory {
  id: string;
  name: string;
  qty: number;
  cost: number;
}

const defaultSettings: AppSettings = {
  powerCost: 0.25,
  watt: 100,
  wearCost: 0.50,
  laborRate: 15.00,
  risk: 10,
  markup: 30
};

const emptyQuote: QuoteState = {
  id: '',
  name: '',
  clientName: '',
  pricingType: 'collega',
  makerWorldUrl: '',
  material: 'PETG',
  spoolId: '',
  spoolCost: 20,
  weight: 0,
  multiColor: false,
  colorChanges: 0,
  purgeWeight: 0,
  hours: 0,
  mins: 0,
  prepMins: 0,
  postMins: 0,
  extraBom: [],
  cadCost: 0,
  urgencyCost: 0,
  discount: 0,
  modelUrl: '',
  modelFileName: ''
};

function subscribeToStorage(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getSettingsSnapshot(): string {
  return localStorage.getItem('3dQuoteSettings') || '';
}

function getSettingsServerSnapshot(): string {
  return '';
}

function getPrivacySnapshot(): string {
  return localStorage.getItem('printquote_privacy') || 'false';
}

export default function QuoteCalculator() {
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showStlViewer, setShowStlViewer] = useState(false);
  const [uploadingModel, setUploadingModel] = useState(false);

  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const clientInputContainerRef = useRef<HTMLDivElement>(null);

  const [spools, setSpools] = useState<SpoolInventory[]>([]);
  const [hardwareStock, setHardwareStock] = useState<HardwareInventory[]>([]);

  const rawSavedSettings = useSyncExternalStore(
    subscribeToStorage,
    getSettingsSnapshot,
    getSettingsServerSnapshot
  );

  const rawPrivacy = useSyncExternalStore(
    subscribeToStorage,
    getPrivacySnapshot,
    getSettingsServerSnapshot
  );

  const isPrivacyMode = rawPrivacy === 'true';

  const [settingsOverride, setSettingsOverride] = useState<AppSettings | null>(null);

  const settings: AppSettings = settingsOverride ?? (() => {
    if (rawSavedSettings) {
      try {
        return JSON.parse(rawSavedSettings);
      } catch {
        return defaultSettings;
      }
    }
    return defaultSettings;
  })();

  const [quote, setQuote] = useState<QuoteState>(emptyQuote);
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);

  useEffect(() => {
    let isCancelled = false;

    fetch('/api/quotes')
      .then(res => res.json())
      .then((data: SavedQuote[]) => {
        if (!isCancelled && Array.isArray(data)) {
          setSavedQuotes(data);

          if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const idParam = params.get('id');
            const clientParam = params.get('client');

            if (idParam) {
              const target = data.find(q => q.id === idParam);
              if (target) {
                setQuote({
                  id: target.id,
                  name: target.name || '',
                  clientName: target.clientName || '',
                  pricingType: target.pricingType || 'collega',
                  makerWorldUrl: target.makerWorldUrl || '',
                  material: target.material || 'PETG',
                  spoolId: target.spoolId || '',
                  spoolCost: target.spoolCost || 20,
                  weight: target.weight || 0,
                  multiColor: target.multiColor || false,
                  colorChanges: target.colorChanges || 0,
                  purgeWeight: target.purgeWeight || 0,
                  hours: target.hours || 0,
                  mins: target.mins || 0,
                  prepMins: target.prepMins || 0,
                  postMins: target.postMins || 0,
                  extraBom: target.extraBom || [],
                  cadCost: target.cadCost || 0,
                  urgencyCost: target.urgencyCost || 0,
                  discount: target.discount || 0,
                  modelUrl: target.modelUrl || '',
                  modelFileName: target.modelFileName || ''
                });
                if (target.modelUrl) {
                  setShowStlViewer(true);
                }
              }
            } else if (clientParam) {
              setQuote(prev => ({ ...prev, clientName: clientParam }));
            }
          }
        }
      })
      .catch(err => console.error("Errore recupero preventivi", err));

    fetch('/api/inventory')
      .then(res => res.json())
      .then(data => {
        if (!isCancelled && data) {
          if (Array.isArray(data.spools)) setSpools(data.spools);
          if (Array.isArray(data.hardware)) setHardwareStock(data.hardware);
        }
      })
      .catch(err => console.error("Errore recupero inventario", err));

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (clientInputContainerRef.current && !clientInputContainerRef.current.contains(event.target as Node)) {
        setClientDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateSetting = (key: keyof AppSettings, value: string | number) => {
    const newSettings: AppSettings = { ...settings, [key]: parseFloat(value.toString()) || 0 };
    setSettingsOverride(newSettings);
    localStorage.setItem('3dQuoteSettings', JSON.stringify(newSettings));
    window.dispatchEvent(new Event('storage'));
  };

  const updateQuote = <K extends keyof QuoteState>(key: K, value: QuoteState[K]) => {
    setQuote(prev => ({ ...prev, [key]: value }));
  };

  const calcTotals = () => {
    const materialCost = ((parseFloat(quote.weight.toString()) || 0) + (parseFloat(quote.purgeWeight.toString()) || 0)) * ((parseFloat(quote.spoolCost.toString()) || 0) / 1000);
    const printTimeHours = (parseFloat(quote.hours.toString()) || 0) + ((parseFloat(quote.mins.toString()) || 0) / 60);
    const energyCost = (settings.watt / 1000) * printTimeHours * settings.powerCost;
    const wearCost = printTimeHours * settings.wearCost;
    
    const laborTimeHours = ((parseFloat(quote.prepMins.toString()) || 0) + (parseFloat(quote.postMins.toString()) || 0)) / 60;
    const laborCost = laborTimeHours * settings.laborRate;
    
    const extraHardwareCost = quote.extraBom.reduce((sum, item) => sum + ((parseFloat(item.qty.toString()) || 0) * (parseFloat(item.cost.toString()) || 0)), 0);
    const servicesCost = (parseFloat(quote.cadCost.toString()) || 0) + (parseFloat(quote.urgencyCost.toString()) || 0);

    const subtotalVivo = materialCost + energyCost + wearCost + laborCost + extraHardwareCost + servicesCost;
    const costWithRisk = subtotalVivo * (1 + (settings.risk / 100));
    
    const baseFinal = costWithRisk * (1 + (settings.markup / 100));
    const discountAmount = baseFinal * ((parseFloat(quote.discount.toString()) || 0) / 100);
    const finalPrice = Math.max(0, baseFinal - discountAmount);

    const estimatedProfit = Math.max(0, finalPrice - (materialCost + energyCost + wearCost + extraHardwareCost));

    return {
      materialCost, energyCost, wearCost, laborCost, extraHardwareCost, servicesCost,
      subtotalVivo, costWithRisk, baseFinal, discountAmount, finalPrice, estimatedProfit, printTimeHours
    };
  };

  const totals = calcTotals();

  const persistQuotesToFile = async (list: SavedQuote[]) => {
    try {
      await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(list)
      });
    } catch (err) {
      console.error("Errore salvataggio su file del progetto:", err);
    }
  };

  const handleModelUpload = async (file: File) => {
    setUploadingModel(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (quote.id) {
        formData.append('quoteId', quote.id);
      }
      const res = await fetch('/api/public/model', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setQuote(prev => ({
          ...prev,
          modelUrl: data.url,
          modelFileName: data.fileName
        }));
      } else {
        console.error('Errore risposta server upload:', data.error);
      }
    } catch (e) {
      console.error('Errore upload modello 3D:', e);
    } finally {
      setUploadingModel(false);
    }
  };

  const handleRemoveModel = () => {
    setQuote(prev => ({
      ...prev,
      modelUrl: '',
      modelFileName: ''
    }));
  };

  const saveCurrentQuote = async () => {
    const isEditing = Boolean(quote.id);
    const currentId = quote.id || crypto.randomUUID();

    const existingItem = savedQuotes.find(q => q.id === currentId);

    const itemToSave: SavedQuote = {
      ...quote,
      id: currentId,
      name: quote.name.trim() || 'Oggetto senza nome',
      clientName: quote.clientName.trim() || 'Cliente Anonimo',
      makerWorldUrl: quote.makerWorldUrl?.trim() || '',
      savedAt: existingItem ? existingItem.savedAt : new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      totalCalculated: totals.finalPrice,
      estimatedProfit: totals.estimatedProfit,
      status: existingItem?.status || 'in_attesa',
      inventoryDeducted: existingItem?.inventoryDeducted || false
    };

    let updatedList: SavedQuote[];

    if (isEditing) {
      updatedList = savedQuotes.map(q => q.id === currentId ? itemToSave : q);
    } else {
      updatedList = [itemToSave, ...savedQuotes];
      setQuote(prev => ({ ...prev, id: currentId }));
    }

    setSavedQuotes(updatedList);
    await persistQuotesToFile(updatedList);

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const resetQuote = () => {
    setQuote(emptyQuote);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
    }
  };

  const applyPreset = (type: PricingType) => {
    updateQuote('pricingType', type);
    switch(type) {
      case 'amico':
        setSettingsOverride({ ...settings, laborRate: 0, risk: 0, markup: 0 });
        updateQuote('discount', 0);
        updateQuote('cadCost', 0);
        break;
      case 'collega':
        setSettingsOverride({ ...settings, laborRate: 0, risk: 5, markup: 20 });
        updateQuote('discount', 0);
        break;
      case 'commerciale':
        setSettingsOverride({ ...settings, laborRate: 15, risk: 10, markup: 50 });
        break;
    }
  };

  const addBomItem = (fromStock?: HardwareInventory) => {
    if (fromStock) {
      updateQuote('extraBom', [...quote.extraBom, { name: fromStock.name, qty: 1, cost: fromStock.cost }]);
    } else {
      updateQuote('extraBom', [...quote.extraBom, { name: 'Componente custom', qty: 1, cost: 0.10 }]);
    }
  };

  const removeBomItem = (index: number) => {
    const newBom = [...quote.extraBom];
    newBom.splice(index, 1);
    updateQuote('extraBom', newBom);
  };

  const updateBomItem = <K extends keyof BomItem>(index: number, field: K, value: BomItem[K]) => {
    const newBom = [...quote.extraBom];
    newBom[index] = { ...newBom[index], [field]: value };
    updateQuote('extraBom', newBom);
  };

  const handleExportText = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const clientStr = quote.clientName ? `\n- Cliente: ${quote.clientName}` : '';
    const trackingStr = quote.id ? `- Codice ordine: ${quote.id}\n🔗 Traccia qui: ${origin}/ordine?code=${quote.id}\n` : '';
    const text = `*Preventivo Stampa 3D: ${quote.name || 'Progetto'}*${clientStr}
- Tipo: ${quote.pricingType.toUpperCase()}
- Materiale: ${quote.material}
- Tempo stimato: ${quote.hours}h ${quote.mins}m
- Peso totale: ${(parseFloat(quote.weight.toString()) || 0) + (parseFloat(quote.purgeWeight.toString()) || 0)}g
${quote.extraBom.length > 0 ? `- Componenti: ${quote.extraBom.map(b => `${b.qty}x ${b.name}`).join(', ')}\n` : ''}${quote.makerWorldUrl ? `- Modello 3D: ${quote.makerWorldUrl}\n` : ''}${trackingStr}*Totale: €${totals.finalPrice.toFixed(2)}*`;
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clientStats = useMemo(() => {
    const stats: Record<string, { count: number; totalSpent: number; totalProfit: number; lastType?: PricingType }> = {};
    savedQuotes.forEach(q => {
      const c = (q.clientName || 'Anonimo').trim();
      if (!stats[c]) {
        stats[c] = { count: 0, totalSpent: 0, totalProfit: 0, lastType: q.pricingType };
      }
      stats[c].count += 1;
      stats[c].totalSpent += (q.totalCalculated || 0);
      stats[c].totalProfit += (q.estimatedProfit || 0);
    });
    return stats;
  }, [savedQuotes]);

  const clientSuggestions = useMemo(() => {
    const query = quote.clientName.trim().toLowerCase();
    const allClients = Object.keys(clientStats).filter(name => name.toLowerCase() !== 'cliente anonimo' && name.toLowerCase() !== 'anonimo');
    if (!query) return allClients;
    return allClients.filter(name => name.toLowerCase().includes(query));
  }, [quote.clientName, clientStats]);

  const exactClientMatch = useMemo(() => {
    const current = quote.clientName.trim().toLowerCase();
    return Object.keys(clientStats).find(name => name.toLowerCase() === current);
  }, [quote.clientName, clientStats]);

  const activeClientStat = exactClientMatch ? clientStats[exactClientMatch] : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      
      {/* FOGLIO DI LAVORO / RICEVUTA PDF MINIMALE */}
      <div className="hidden print:block text-black bg-white p-8 max-w-2xl mx-auto font-sans">
        <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">Ricevuta / Foglio di Lavoro</h1>
            <p className="text-xs text-gray-600 mt-1">Laboratorio Stampa 3D FDM & Prototipazione</p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold">Data: {new Date().toLocaleDateString('it-IT')}</p>
            <p className="text-gray-600">Doc ID: {quote.id || 'NEW-JOB'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
          <div className="p-3 border border-gray-300 rounded">
            <span className="text-gray-500 uppercase font-semibold text-[10px] block">Cliente</span>
            <p className="text-sm font-bold mt-0.5">{quote.clientName || 'Cliente / Richiedente'}</p>
          </div>
          <div className="p-3 border border-gray-300 rounded">
            <span className="text-gray-500 uppercase font-semibold text-[10px] block">Oggetto / Commessa</span>
            <p className="text-sm font-bold mt-0.5">{quote.name || 'Progetto 3D'}</p>
          </div>
        </div>

        <h3 className="text-xs font-bold uppercase tracking-wider border-b border-gray-300 pb-1 mb-3">Dettagli di Fabbricazione</h3>
        <table className="w-full text-xs text-left mb-6">
          <tbody className="divide-y divide-gray-200">
            <tr>
              <td className="py-2 text-gray-600">Materiale / Filamento</td>
              <td className="py-2 font-medium text-right">{quote.material}</td>
            </tr>
            <tr>
              <td className="py-2 text-gray-600">Tempo Macchina Stimato</td>
              <td className="py-2 font-medium text-right">{quote.hours} ore e {quote.mins} minuti</td>
            </tr>
            <tr>
              <td className="py-2 text-gray-600">Peso Totale Estruso</td>
              <td className="py-2 font-medium text-right">{(parseFloat(quote.weight.toString()) || 0) + (parseFloat(quote.purgeWeight.toString()) || 0)} grammi</td>
            </tr>
            {quote.multiColor && (
              <tr>
                <td className="py-2 text-gray-600">Configurazione</td>
                <td className="py-2 font-medium text-right">Multi-colore AMS ({quote.colorChanges} cambi)</td>
              </tr>
            )}
          </tbody>
        </table>

        {quote.extraBom.length > 0 && (
          <>
            <h3 className="text-xs font-bold uppercase tracking-wider border-b border-gray-300 pb-1 mb-2">Hardware & Viteria Inclusi</h3>
            <ul className="text-xs space-y-1 mb-6 list-disc list-inside text-gray-800">
              {quote.extraBom.map((item, i) => (
                <li key={i}>{item.qty}x {item.name}</li>
              ))}
            </ul>
          </>
        )}

        <div className="border-t-2 border-black pt-4 flex justify-between items-baseline">
          <span className="text-sm font-bold uppercase">Totale Dovuto</span>
          <span className="text-3xl font-black">€{totals.finalPrice.toFixed(2)}</span>
        </div>

        <div className="mt-12 pt-4 border-t border-gray-200 text-[10px] text-gray-500 text-center">
          Documento generato tramite PrintQuote Pro • Grazie per il supporto al maker lab
        </div>
      </div>

      {/* SCHERMATA STANDARD WEB */}
      <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 pb-32 lg:pb-12 print:hidden font-sans">
        
        {/* BANNER NOTIFICA SE STAI MODIFICANDO UN PREVENTIVO */}
        {quote.id && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-amber-950/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                <Pencil className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Modalità Modifica Attiva
                  <span className="text-xs font-mono font-normal text-amber-400">({quote.name || 'Senza nome'})</span>
                </h3>
                <p className="text-xs text-slate-400">Stai modificando un preventivo salvato in precedenza.</p>
              </div>
            </div>

            <button 
              onClick={resetQuote}
              className="px-3.5 py-1.5 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors self-end sm:self-auto"
            >
              <X className="w-3.5 h-3.5" /> Esci dalla Modifica (Crea Nuovo)
            </button>
          </div>
        )}

        {/* HEADER RESPONSIVE CON PRESET A PILLOLE */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 sm:mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/20 shadow-md shadow-emerald-950/30">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Calcolatore Preventivi FDM</h1>
              <p className="text-slate-400 text-xs sm:text-sm">
                {isPrivacyMode && <span className="text-amber-400 font-semibold mr-2">[Modalità Cliente]</span>}
                {quote.id ? <span className="text-amber-400 font-mono">Modifica preventivo attivo</span> : 'Inserisci i parametri dallo slicer per determinare il prezzo'}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto justify-between lg:justify-end">
            <div className="flex items-center gap-2">
              <button 
                onClick={resetQuote} 
                className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 text-slate-300 text-xs sm:text-sm flex items-center gap-1.5 transition-colors shadow-sm"
                title="Azzera campi e crea nuovo preventivo"
              >
                <FilePlus2 className="w-4 h-4 text-blue-400" /> 
                <span>Nuovo</span>
              </button>

              <Link 
                href="/preventivi"
                className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 text-slate-300 text-xs sm:text-sm flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <FolderOpen className="w-4 h-4 text-emerald-400" /> 
                <span>Lavori ({savedQuotes.length})</span>
              </Link>
            </div>

            {/* Segmented Pill Selector for Pricing Presets */}
            <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl gap-1 shadow-sm">
              <button 
                onClick={() => applyPreset('amico')} 
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  quote.pricingType === 'amico' 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                Amico
              </button>
              <button 
                onClick={() => applyPreset('collega')} 
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  quote.pricingType === 'collega' 
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                Collega
              </button>
              <button 
                onClick={() => applyPreset('commerciale')} 
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  quote.pricingType === 'commerciale' 
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                Azienda
              </button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT: FORM PRINCIPALE */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* PARAMETRI GLOBALI */}
            {!isPrivacyMode && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className="w-full px-6 py-4 flex justify-between items-center bg-slate-900 hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-slate-300 font-medium text-sm">
                    <Settings className="w-4 h-4 text-slate-400" /> Parametri Stampante & Costi Base
                  </div>
                  {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {showSettings && (
                  <div className="p-6 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-900/50">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Costo Energia (€/kWh)</label>
                      <input type="number" step="0.01" value={settings.powerCost} onChange={e => updateSetting('powerCost', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Potenza Stampante (Watt)</label>
                      <input type="number" value={settings.watt} onChange={e => updateSetting('watt', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Ammortamento (€/h)</label>
                      <input type="number" step="0.10" value={settings.wearCost} onChange={e => updateSetting('wearCost', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Tariffa Operatore (€/h)</label>
                      <input type="number" step="1" value={settings.laborRate} onChange={e => updateSetting('laborRate', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Tasso Rischio/Scarto (%)</label>
                      <input type="number" value={settings.risk} onChange={e => updateSetting('risk', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Ricarico / Margine (%)</label>
                      <input type="number" value={settings.markup} onChange={e => updateSetting('markup', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* QUOTE FORM */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              
              {/* NOME OGGETTO, CLIENTE & PROFILO */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Descrizione Oggetto / File</label>
                  <input 
                    type="text" 
                    value={quote.name} 
                    onChange={e => updateQuote('name', e.target.value)} 
                    placeholder="Es. Case ESP32, Staffa..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm" 
                  />
                </div>

                <div ref={clientInputContainerRef} className="relative">
                  <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-emerald-400" /> Nome Cliente
                    </span>
                    {activeClientStat && <span className="text-[10px] text-emerald-400">Riconosciuto ✓</span>}
                  </label>
                  
                  <input 
                    type="text" 
                    value={quote.clientName} 
                    onFocus={() => setClientDropdownOpen(true)}
                    onChange={e => {
                      updateQuote('clientName', e.target.value);
                      setClientDropdownOpen(true);
                    }} 
                    placeholder="Nome amico o collega..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm" 
                  />

                  {clientDropdownOpen && quote.clientName.trim().length > 0 && (
                    <div className="absolute left-0 right-0 top-[68px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 overflow-hidden max-h-56 overflow-y-auto">
                      {clientSuggestions.map((client) => {
                        const stat = clientStats[client];
                        return (
                          <div 
                            key={client}
                            onClick={() => {
                              updateQuote('clientName', client);
                              if (stat.lastType) applyPreset(stat.lastType);
                              setClientDropdownOpen(false);
                            }}
                            className="p-3 hover:bg-slate-800 cursor-pointer border-b border-slate-800/60 transition-colors"
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold text-white text-sm">{client}</span>
                              <span className="text-xs text-emerald-400 font-medium">Tot: €{stat.totalSpent.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400">
                              <span>Ordini: <strong className="text-slate-200">{stat.count}</strong></span>
                              {!isPrivacyMode && <span>Netto: <strong className="text-blue-400">€{stat.totalProfit.toFixed(2)}</strong></span>}
                            </div>
                          </div>
                        );
                      })}

                      {!exactClientMatch && quote.clientName.trim() && (
                        <div 
                          onClick={() => setClientDropdownOpen(false)}
                          className="p-3 bg-slate-950/80 hover:bg-slate-800 text-emerald-400 cursor-pointer flex items-center gap-2 text-xs font-medium border-t border-slate-700/50"
                        >
                          <UserPlus className="w-4 h-4 text-emerald-400" />
                          <span>Inserisci &quot;{quote.clientName.trim()}&quot; come nuovo cliente</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tipo Tariffa</label>
                  <select 
                    value={quote.pricingType} 
                    onChange={e => applyPreset(e.target.value as PricingType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm font-medium"
                  >
                    <option value="amico">Amico (Prezzo Vivo)</option>
                    <option value="collega">Collega (Margine Leggero)</option>
                    <option value="commerciale">Azienda / Commerciale</option>
                  </select>
                </div>
              </div>

              {/* LINK MAKERWORLD */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-emerald-400" /> Link MakerWorld / Modello 3D
                  </label>
                  <span className="text-[11px] text-slate-500">Opzionale</span>
                </div>
                <div className="relative flex items-center">
                  <input 
                    type="url" 
                    value={quote.makerWorldUrl || ''} 
                    onChange={e => updateQuote('makerWorldUrl', e.target.value)} 
                    placeholder="https://makerworld.com/it/models/..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3.5 pr-10 py-2.5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm placeholder:text-slate-600" 
                  />
                  {quote.makerWorldUrl && (
                    <a href={quote.makerWorldUrl} target="_blank" rel="noreferrer" className="absolute right-3 p-1 text-slate-400 hover:text-emerald-400">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>

              {/* VIEWER 3D INTERATTIVO STL & 3MF */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowStlViewer(!showStlViewer)}
                    className="text-xs font-semibold text-slate-300 hover:text-emerald-400 transition-colors flex items-center gap-1.5"
                  >
                    <BoxIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {showStlViewer 
                        ? 'Nascondi Visualizzatore 3D (.STL / .3MF)' 
                        : (quote.modelFileName ? `Mostra Modello 3D (${quote.modelFileName})` : 'Mostra Visualizzatore 3D (Carica file .STL o .3MF)')
                      }
                    </span>
                    {showStlViewer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <div className="flex items-center gap-2">
                    {uploadingModel && (
                      <span className="text-[11px] text-amber-400 animate-pulse flex items-center gap-1">
                        Salvataggio file 3D sul server...
                      </span>
                    )}

                    {quote.modelFileName && !uploadingModel && (
                      <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-lg text-emerald-400 text-[11px]">
                        <span className="font-medium truncate max-w-[150px]" title={quote.modelFileName}>
                          📎 {quote.modelFileName}
                        </span>
                        <button
                          type="button"
                          onClick={handleRemoveModel}
                          className="hover:text-red-400 ml-1 text-slate-400 font-bold"
                          title="Rimuovi file 3D da questo preventivo"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">Three.js WebGL</span>
                  </div>
                </div>

                {showStlViewer && (
                  <div className="space-y-2 pt-1">
                    <StlViewer 
                      height={280}
                      url={quote.modelUrl}
                      fileName={quote.modelFileName}
                      initialColor={quote.material.includes('PLA') ? '#10b981' : quote.material.includes('PETG') ? '#06b6d4' : '#a855f7'}
                      onFileSelected={handleModelUpload}
                    />
                    <p className="text-[11px] text-slate-500 leading-tight">
                      💡 Il file 3D caricato (<strong>.STL</strong> o <strong>.3MF</strong>) viene memorizzato nel preventivo e visualizzato al cliente nella schermata di tracking dell&apos;ordine.
                    </p>
                  </div>
                )}
              </div>

              {/* SEZIONE FILAMENTO */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
                  <h3 className="text-xs font-semibold text-emerald-400 flex items-center gap-2 uppercase tracking-wider">
                    <Layers className="w-4 h-4" /> Filamento & Peso
                  </h3>

                  {spools.length > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">Bobina reale:</span>
                      <select 
                        value={quote.spoolId || ""}
                        onChange={(e) => {
                          const chosen = spools.find(s => s.id === e.target.value);
                          if (chosen) {
                            updateQuote('spoolId', chosen.id);
                            updateQuote('material', `${chosen.brand} ${chosen.material} (${chosen.color})`);
                            updateQuote('spoolCost', chosen.cost);
                          }
                        }}
                        className="bg-slate-950 border border-emerald-500/40 text-emerald-300 rounded-lg px-2.5 py-1 text-xs outline-none cursor-pointer"
                      >
                        <option value="">Nessuna / Manuale</option>
                        {spools.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.brand} - {s.material} {s.color} ({s.weightRemaining}g rimasti)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Nome Materiale / Profilo</label>
                    <input 
                      type="text" 
                      value={quote.material}
                      onChange={e => updateQuote('material', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Costo Bobina (€/kg)</label>
                    <input 
                      type="number" 
                      step="0.10" 
                      value={quote.spoolCost} 
                      onChange={e => updateQuote('spoolCost', parseFloat(e.target.value) || 0)} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Peso Pezzo (grammi netti)</label>
                    <input 
                      type="number" 
                      value={quote.weight} 
                      onChange={e => updateQuote('weight', parseFloat(e.target.value) || 0)} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" 
                    />
                  </div>
                </div>

                <div className="pt-3">
                  <label className="flex items-center gap-2 cursor-pointer mb-3">
                    <input type="checkbox" checked={quote.multiColor} onChange={e => updateQuote('multiColor', e.target.checked)} className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500" />
                    <span className="text-sm font-medium text-slate-300">Stampa Multi-colore (AMS / Spurghi)</span>
                  </label>
                  
                  {quote.multiColor && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-slate-950/50 rounded-lg border border-slate-800/50">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Cambi Filamento</label>
                        <input type="number" value={quote.colorChanges} onChange={e => updateQuote('colorChanges', parseInt(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Torre Spurgo (g)</label>
                        <input type="number" value={quote.purgeWeight} onChange={e => updateQuote('purgeWeight', parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* TEMPI SLICER */}
              <div className="pt-2 border-t border-slate-800/80">
                <h3 className="text-xs font-semibold text-blue-400 flex items-center gap-2 uppercase tracking-wider mb-3">
                  <Clock className="w-4 h-4"/> Tempi di Lavorazione
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Ore Stampa</label>
                    <input type="number" value={quote.hours} onChange={e => updateQuote('hours', parseInt(e.target.value) || 0)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Minuti Stampa</label>
                    <input type="number" max="59" value={quote.mins} onChange={e => updateQuote('mins', parseInt(e.target.value) || 0)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Prep / Slicing (min)</label>
                    <input type="number" value={quote.prepMins} onChange={e => updateQuote('prepMins', parseInt(e.target.value) || 0)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Post-processing (min)</label>
                    <input type="number" value={quote.postMins} onChange={e => updateQuote('postMins', parseInt(e.target.value) || 0)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" />
                  </div>
                </div>
              </div>

              {/* HARDWARE EXTRA */}
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <h3 className="text-xs font-semibold text-purple-400 flex items-center gap-2 uppercase tracking-wider">
                    <Wrench className="w-4 h-4"/> Hardware & Viteria (BOM)
                  </h3>

                  <div className="flex items-center gap-2">
                    {hardwareStock.length > 0 && (
                      <select 
                        onChange={(e) => {
                          const chosen = hardwareStock.find(h => h.id === e.target.value);
                          if (chosen) addBomItem(chosen);
                          e.target.value = "";
                        }}
                        defaultValue=""
                        className="bg-slate-950 border border-purple-500/40 text-purple-300 rounded-lg px-2.5 py-1 text-xs outline-none cursor-pointer"
                      >
                        <option value="" disabled>+ Dal cassetto...</option>
                        {hardwareStock.map(h => (
                          <option key={h.id} value={h.id}>{h.name} (€{h.cost.toFixed(2)})</option>
                        ))}
                      </select>
                    )}

                    <button 
                      onClick={() => addBomItem()} 
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Riga Libera
                    </button>
                  </div>
                </div>
                
                {quote.extraBom.length > 0 && (
                  <div className="space-y-2">
                    {quote.extraBom.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input type="text" value={item.name} onChange={e => updateBomItem(index, 'name', e.target.value)} placeholder="Descrizione" className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs outline-none" />
                        <input type="number" value={item.qty} onChange={e => updateBomItem(index, 'qty', parseInt(e.target.value) || 0)} placeholder="Qtà" className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-center outline-none" />
                        <input type="number" step="0.01" value={item.cost} onChange={e => updateBomItem(index, 'cost', parseFloat(e.target.value) || 0)} placeholder="€ cad." className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-center outline-none" />
                        <button onClick={() => removeBomItem(index)} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SERVIZI E SCONTO */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80">
                 <div>
                    <label className="block text-xs text-slate-400 mb-1">Disegno CAD / Reverse (€)</label>
                    <input type="number" value={quote.cadCost} onChange={e => updateQuote('cadCost', parseFloat(e.target.value) || 0)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" />
                 </div>
                 <div>
                    <label className="block text-xs text-slate-400 mb-1">Supplemento Urgenza (€)</label>
                    <input type="number" value={quote.urgencyCost} onChange={e => updateQuote('urgencyCost', parseFloat(e.target.value) || 0)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" />
                 </div>
                 <div>
                    <label className="block text-xs text-emerald-400 mb-1">Sconto Finale (%)</label>
                    <input type="number" value={quote.discount} onChange={e => updateQuote('discount', parseFloat(e.target.value) || 0)} className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg px-3 py-2 text-sm outline-none font-bold" />
                 </div>
              </div>

            </div>
          </div>

          {/* RIGHT: RIEPILOGO STICKY & SALVATAGGIO */}
          <div className="lg:col-span-4 relative">
            <div className="sticky top-20 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
              
              <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-white">Riepilogo Costi</h2>
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Tariffa {quote.pricingType}</span>
                </div>
                <button 
                  onClick={saveCurrentQuote}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-md shadow-emerald-950"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savedSuccess ? 'Salvato!' : quote.id ? 'Aggiorna Modifiche' : 'Salva nei Lavori'}
                </button>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Filamento ({(parseFloat(quote.weight.toString()) || 0) + (parseFloat(quote.purgeWeight.toString()) || 0)}g)</span>
                  <span className="font-medium">€{totals.materialCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Energia & Consumo Macchina</span>
                  <span className="font-medium">€{(totals.energyCost + totals.wearCost).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Lavoro Operatore</span>
                  <span className="font-medium">€{totals.laborCost.toFixed(2)}</span>
                </div>
                {totals.extraHardwareCost > 0 && (
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Componenti Hardware Extra</span>
                    <span className="font-medium">€{totals.extraHardwareCost.toFixed(2)}</span>
                  </div>
                )}
                {totals.servicesCost > 0 && (
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Servizi Extra (CAD/Urgenza)</span>
                    <span className="font-medium">€{totals.servicesCost.toFixed(2)}</span>
                  </div>
                )}
                
                {!isPrivacyMode && (
                  <div className="pt-3 border-t border-slate-800">
                    <div className="flex justify-between items-center text-slate-400 text-xs mb-1">
                      <span>Subtotale Costi Vivi</span>
                      <span>€{totals.subtotalVivo.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400 text-xs mb-1">
                      <span>Quota Rischio ({settings.risk}%)</span>
                      <span>+ €{(totals.costWithRisk - totals.subtotalVivo).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400 text-xs">
                      <span>Margine Guadagno ({settings.markup}%)</span>
                      <span>+ €{(totals.baseFinal - totals.costWithRisk).toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {totals.discountAmount > 0 && (
                  <div className="flex justify-between items-center text-emerald-400 font-medium pt-2 border-t border-slate-800">
                    <span>Sconto Applicato</span>
                    <span>- €{totals.discountAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-700">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-slate-400 text-sm font-medium">Prezzo Finale</span>
                  <span className="text-4xl font-bold text-white tracking-tight">€{totals.finalPrice.toFixed(2)}</span>
                </div>

                {!isPrivacyMode && (
                  <div className="flex justify-between items-center text-xs text-emerald-400/90 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                    <span>Guadagno netto stimato per te:</span>
                    <span className="font-bold">€{totals.estimatedProfit.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2">
                <button 
                  onClick={handleExportText}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                  {copied ? 'Copiato negli Appunti!' : 'Copia Riepilogo per WhatsApp'}
                </button>
                <button 
                  onClick={() => window.print()}
                  className="w-full bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors"
                >
                  <FileText className="w-4 h-4 text-emerald-400" /> Stampa Ricevuta PDF Minimale
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* FLOATING BOTTOM BAR PER DISPOSITIVI MOBILI (visibile solo su < lg) */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-4 py-3 shadow-2xl pb-safe">
          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                Prezzo Stimato
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-white tracking-tight">€{totals.finalPrice.toFixed(2)}</span>
                {!isPrivacyMode && totals.estimatedProfit > 0 && (
                  <span className="text-[10px] text-emerald-400 font-mono font-medium">
                    (+€{totals.estimatedProfit.toFixed(2)})
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={handleExportText}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors border border-slate-700/60"
                title="Copia riepilogo WhatsApp"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              </button>

              <button 
                type="button"
                onClick={saveCurrentQuote}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-950 whitespace-nowrap"
              >
                <Save className="w-4 h-4" />
                <span>{savedSuccess ? 'Salvato!' : quote.id ? 'Aggiorna' : 'Salva Lavoro'}</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}