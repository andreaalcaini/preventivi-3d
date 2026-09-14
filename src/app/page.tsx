'use client';

import React, { useState, useEffect, useSyncExternalStore, useMemo, useRef } from 'react';
import { 
  Settings, Calculator, Clock, Wrench, Share2, 
  Plus, Trash2, ChevronDown, ChevronUp, CheckCircle2, 
  Save, FolderOpen, FilePlus2, ExternalLink, Link as LinkIcon,
  User, UserPlus, Layers, FileText, Pencil, X, Box as BoxIcon,
  MessageSquare, Phone, QrCode, FileCode2, UploadCloud, AlertCircle,
  Sparkles, RefreshCw, Loader2
} from 'lucide-react';
import Link from 'next/link';
import StlViewer from '@/components/StlViewer';
import { parseSlicerFile } from '@/lib/slicerParser';
import { getWhatsAppUrl } from '@/lib/whatsapp';
import QrLabelModal, { ParcelLabelData } from '@/components/QrLabelModal';

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
  clientContact?: string;
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
  clientContact: '',
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
  const [calcTab, setCalcTab] = useState<'print' | 'costs' | 'extra'>('print');
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showStlViewer, setShowStlViewer] = useState(false);
  const [uploadingModel, setUploadingModel] = useState(false);

  // Slicer parser & WhatsApp / Label states
  const [parsingSlicer, setParsingSlicer] = useState(false);
  const [slicerFeedback, setSlicerFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activeParcelLabel, setActiveParcelLabel] = useState<ParcelLabelData | null>(null);

  // MakerWorld auto-fetch state
  const [loadingMakerWorld, setLoadingMakerWorld] = useState(false);
  const [makerWorldInfo, setMakerWorldInfo] = useState<{
    modelTitle: string;
    coverUrl?: string;
    authorName?: string;
    selectedProfile: any;
    availableProfiles: any[];
  } | null>(null);
  const [makerWorldError, setMakerWorldError] = useState<string | null>(null);

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

  const handleSlicerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsingSlicer(true);
    setSlicerFeedback(null);
    try {
      const parsed = await parseSlicerFile(file);
      setQuote(prev => ({
        ...prev,
        name: prev.name.trim() ? prev.name : file.name.replace(/\.(gcode|3mf|gco|g)$/i, ''),
        hours: parsed.hours,
        mins: parsed.mins,
        weight: parsed.weightGrams,
        material: parsed.material || prev.material,
        multiColor: parsed.multiColor ?? prev.multiColor,
        colorChanges: parsed.colorCount ? Math.max(0, parsed.colorCount - 1) : prev.colorChanges,
        purgeWeight: (parsed.multiColor && prev.purgeWeight === 0) ? Math.round(parsed.weightGrams * 0.25) : prev.purgeWeight
      }));
      setSlicerFeedback({
        type: 'success',
        message: `Dati importati con successo da ${parsed.slicerName || 'Slicer'}: ${parsed.hours}h ${parsed.mins}m • ${parsed.weightGrams}g${parsed.material ? ` ${parsed.material}` : ''}${parsed.multiColor ? ` • AMS (${parsed.colorCount} colori)` : ''}`
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore durante la lettura del file slicer';
      setSlicerFeedback({ type: 'error', message: msg });
    } finally {
      setParsingSlicer(false);
      e.target.value = '';
    }
  };

  const handleFetchMakerWorld = async (overrideUrl?: string, targetProfileId?: number) => {
    const urlToFetch = (overrideUrl !== undefined ? overrideUrl : quote.makerWorldUrl)?.trim();
    if (!urlToFetch) return;

    setLoadingMakerWorld(true);
    setMakerWorldError(null);

    try {
      let endpoint = `/api/makerworld?url=${encodeURIComponent(urlToFetch)}`;
      if (targetProfileId) {
        endpoint += `&profileId=${targetProfileId}`;
      }

      const res = await fetch(endpoint);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Impossibile recuperare dati da MakerWorld');
      }

      setMakerWorldInfo({
        modelTitle: data.modelTitle,
        coverUrl: data.coverUrl,
        authorName: data.authorName,
        selectedProfile: data.selectedProfile,
        availableProfiles: data.availableProfiles || []
      });

      const prof = data.selectedProfile;
      if (prof) {
        setQuote(prev => ({
          ...prev,
          name: (!prev.name || prev.name.trim() === 'Stampa 3D Custom') ? data.modelTitle : prev.name,
          hours: prof.printHours,
          mins: prof.printMinutes,
          weight: prof.weightGrams,
          material: prof.material || prev.material,
          multiColor: prof.needAms ?? prev.multiColor,
          colorChanges: prof.needAms ? Math.max(1, prev.colorChanges) : prev.colorChanges,
          purgeWeight: (prof.needAms && prev.purgeWeight === 0) ? Math.round(prof.weightGrams * 0.25) : prev.purgeWeight
        }));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore durante il recupero da MakerWorld';
      setMakerWorldError(msg);
    } finally {
      setLoadingMakerWorld(false);
    }
  };

  const handleSelectMakerWorldProfile = (profileId: number) => {
    if (!makerWorldInfo) return;
    const target = makerWorldInfo.availableProfiles.find(p => p.id === profileId);
    if (!target) return;

    setMakerWorldInfo(prev => prev ? { ...prev, selectedProfile: target } : null);
    setQuote(prev => ({
      ...prev,
      hours: target.printHours,
      mins: target.printMinutes,
      weight: target.weightGrams,
      material: target.material || prev.material,
      multiColor: target.needAms ?? prev.multiColor,
      colorChanges: target.needAms ? Math.max(1, prev.colorChanges) : prev.colorChanges,
      purgeWeight: (target.needAms && prev.purgeWeight === 0) ? Math.round(target.weightGrams * 0.25) : prev.purgeWeight
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
    const stats: Record<string, { count: number; totalSpent: number; totalProfit: number; lastType?: PricingType; phone?: string }> = {};
    savedQuotes.forEach(q => {
      const c = (q.clientName || 'Anonimo').trim();
      if (!stats[c]) {
        stats[c] = { count: 0, totalSpent: 0, totalProfit: 0, lastType: q.pricingType, phone: q.clientContact };
      }
      if (!stats[c].phone && q.clientContact) {
        stats[c].phone = q.clientContact;
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
    <div className="h-full max-h-full overflow-hidden bg-slate-950 text-slate-200 p-2 sm:p-3 font-sans flex flex-col">
      
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

      {/* SCHERMATA STANDARD WEB RIGIDA SENZA SCORRIMENTO */}
      <div className="max-w-7xl mx-auto w-full flex-1 min-h-0 flex flex-col print:hidden font-sans overflow-hidden">
        
        {/* BANNER NOTIFICA SE STAI MODIFICANDO UN PREVENTIVO */}
        {quote.id && (
          <div className="flex-shrink-0 mb-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1 bg-amber-500/20 rounded-lg text-amber-400 flex-shrink-0">
                <Pencil className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-1.5 text-xs truncate">
                <span className="font-bold text-white">Modalità Modifica:</span>
                <span className="font-mono text-amber-400 truncate">{quote.name || 'Senza nome'}</span>
              </div>
            </div>

            <button 
              onClick={resetQuote}
              className="px-2.5 py-1 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-lg flex items-center gap-1 transition-colors flex-shrink-0"
            >
              <X className="w-3 h-3" /> Esci
            </button>
          </div>
        )}

        {/* HEADER COMPATTO CON PRESET A PILLOLE */}
        <header className="flex-shrink-0 flex items-center justify-between mb-2 gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20 shadow-sm flex-shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight leading-tight truncate">
                Calcolatore Preventivi FDM
              </h1>
              <p className="text-slate-400 text-[11px] truncate">
                {isPrivacyMode && <span className="text-amber-400 font-semibold mr-1">[Cliente]</span>}
                {quote.id ? 'Modifica preventivo attivo' : 'Parametri per determinare il prezzo'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button 
              onClick={resetQuote} 
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 text-slate-300 text-xs flex items-center gap-1 transition-colors shadow-sm"
              title="Azzera campi e crea nuovo preventivo"
            >
              <FilePlus2 className="w-3.5 h-3.5 text-blue-400" /> 
              <span className="hidden sm:inline">Nuovo</span>
            </button>

            <Link 
              href="/preventivi"
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 text-slate-300 text-xs flex items-center gap-1 transition-colors shadow-sm"
            >
              <FolderOpen className="w-3.5 h-3.5 text-emerald-400" /> 
              <span>Lavori ({savedQuotes.length})</span>
            </Link>

            <div className="flex bg-slate-900 border border-slate-800 p-0.5 rounded-lg gap-0.5 shadow-sm">
              <button 
                onClick={() => applyPreset('amico')} 
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  quote.pricingType === 'amico' 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                Amico
              </button>
              <button 
                onClick={() => applyPreset('collega')} 
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  quote.pricingType === 'collega' 
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                Collega
              </button>
              <button 
                onClick={() => applyPreset('commerciale')} 
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
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

        {/* GRIGLIA PRINCIPALE BLOCCATA A 100VH */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden">
          
          {/* LEFT: FORM PRINCIPALE A SCHEDE */}
          <div className="lg:col-span-8 flex flex-col min-h-0 bg-slate-900 border border-slate-800 rounded-xl p-3 overflow-hidden">
            
            {/* TABS HEADER */}
            <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-800 pb-2 mb-2 gap-2 flex-wrap">
              <div className="flex bg-slate-950 border border-slate-800 p-0.5 rounded-lg gap-0.5">
                <button
                  type="button"
                  onClick={() => setCalcTab('print')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    calcTab === 'print'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>1. Stampa & Slicer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCalcTab('costs')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    calcTab === 'costs'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>2. Tempi & Tariffe</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCalcTab('extra')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    calcTab === 'extra'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>3. Hardware & 3D {quote.extraBom.length > 0 ? `(${quote.extraBom.length})` : ''}</span>
                </button>
              </div>

              {!isPrivacyMode && (
                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 ${
                    showSettings 
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Mostra / Nascondi parametri base stampante (kWh, Watt, Ammortamento)"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Costi Base</span>
                  {showSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>

            {/* CONTENITORE CONTENUTO TAB SCROLLABILE INTERNAMENTE SE NECESSARIO */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
              
              {/* ACCORDION PARAMETRI STAMPANTE (SE APERTO) */}
              {!isPrivacyMode && showSettings && (
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl mb-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Settings className="w-3.5 h-3.5 text-emerald-400" /> Parametri Stampante & Costi Base
                    </span>
                    <span className="text-[10px] text-slate-500">Salvati in memoria</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5 truncate">Energia (€/kWh)</label>
                      <input type="number" step="0.01" value={settings.powerCost} onChange={e => updateSetting('powerCost', e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs outline-none text-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5 truncate">Potenza (Watt)</label>
                      <input type="number" value={settings.watt} onChange={e => updateSetting('watt', e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs outline-none text-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5 truncate">Ammort. (€/h)</label>
                      <input type="number" step="0.10" value={settings.wearCost} onChange={e => updateSetting('wearCost', e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs outline-none text-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5 truncate">Operatore (€/h)</label>
                      <input type="number" step="1" value={settings.laborRate} onChange={e => updateSetting('laborRate', e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs outline-none text-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5 truncate">Rischio (%)</label>
                      <input type="number" value={settings.risk} onChange={e => updateSetting('risk', e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs outline-none text-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5 truncate">Margine (%)</label>
                      <input type="number" value={settings.markup} onChange={e => updateSetting('markup', e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs outline-none text-white" />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 1: STAMPA & SLICER */}
              {calcTab === 'print' && (
                <div className="space-y-3">
                  {/* Riga Nome, Cliente, Cellulare, Tariffa */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Descrizione Oggetto / File</label>
                      <input 
                        type="text" 
                        value={quote.name} 
                        onChange={e => updateQuote('name', e.target.value)} 
                        placeholder="Es. Case ESP32, Staffa..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 focus:border-emerald-500 outline-none text-xs text-white" 
                      />
                    </div>

                    <div ref={clientInputContainerRef} className="relative">
                      <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-emerald-400" /> Nome Cliente
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
                        placeholder="Nome cliente..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 focus:border-emerald-500 outline-none text-xs text-white" 
                      />

                      {clientDropdownOpen && quote.clientName.trim().length > 0 && (
                        <div className="absolute left-0 right-0 top-[58px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 overflow-hidden max-h-56 overflow-y-auto">
                          {clientSuggestions.map((client) => {
                            const stat = clientStats[client];
                            return (
                              <div 
                                key={client}
                                onClick={() => {
                                  updateQuote('clientName', client);
                                  if (stat.phone && !quote.clientContact) {
                                    updateQuote('clientContact', stat.phone);
                                  }
                                  if (stat.lastType) applyPreset(stat.lastType);
                                  setClientDropdownOpen(false);
                                }}
                                className="p-2.5 hover:bg-slate-800 cursor-pointer border-b border-slate-800/60 transition-colors"
                              >
                                <div className="flex justify-between items-center mb-0.5">
                                  <span className="font-semibold text-white text-xs">{client}</span>
                                  <span className="text-[11px] text-emerald-400 font-medium">Tot: €{stat.totalSpent.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-400">
                                  <span>Ordini: <strong className="text-slate-200">{stat.count}</strong></span>
                                  {stat.phone && <span className="text-emerald-400 font-mono">{stat.phone}</span>}
                                </div>
                              </div>
                            );
                          })}

                          {!exactClientMatch && quote.clientName.trim() && (
                            <div 
                              onClick={() => setClientDropdownOpen(false)}
                              className="p-2.5 bg-slate-950/80 hover:bg-slate-800 text-emerald-400 cursor-pointer flex items-center gap-1.5 text-xs font-medium border-t border-slate-700/50"
                            >
                              <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Inserisci &quot;{quote.clientName.trim()}&quot; come nuovo</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-400" /> WhatsApp
                      </label>
                      <input 
                        type="tel" 
                        value={quote.clientContact || ''} 
                        onChange={e => updateQuote('clientContact', e.target.value)} 
                        placeholder="Es. 340 1234567..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 focus:border-emerald-500 outline-none text-xs text-white" 
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Tipo Tariffa</label>
                      <select 
                        value={quote.pricingType} 
                        onChange={e => applyPreset(e.target.value as PricingType)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 focus:border-emerald-500 outline-none text-xs font-medium text-white"
                      >
                        <option value="amico">Amico (Prezzo Vivo)</option>
                        <option value="collega">Collega (Margine Leggero)</option>
                        <option value="commerciale">Azienda / Commerciale</option>
                      </select>
                    </div>
                  </div>

                  {/* MakerWorld Link & Import */}
                  <div className="space-y-1.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-medium text-slate-400 flex items-center gap-1">
                        <LinkIcon className="w-3 h-3 text-emerald-400" /> Link MakerWorld / Modello 3D
                      </label>
                      {quote.makerWorldUrl?.includes('makerworld.com') && (
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Stima automatica disponibile
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <div className="relative flex-1 flex items-center">
                        <input 
                          type="url" 
                          value={quote.makerWorldUrl || ''} 
                          onChange={e => {
                            updateQuote('makerWorldUrl', e.target.value);
                            setMakerWorldError(null);
                          }} 
                          onKeyDown={e => {
                            if (e.key === 'Enter' && quote.makerWorldUrl?.includes('makerworld.com')) {
                              e.preventDefault();
                              handleFetchMakerWorld();
                            }
                          }}
                          placeholder="https://makerworld.com/it/models/..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-8 py-1.5 focus:border-emerald-500 outline-none text-xs text-white placeholder:text-slate-600" 
                        />
                        {quote.makerWorldUrl && (
                          <a href={quote.makerWorldUrl} target="_blank" rel="noreferrer" className="absolute right-2 p-1 text-slate-400 hover:text-emerald-400" title="Apri su MakerWorld">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleFetchMakerWorld()}
                        disabled={loadingMakerWorld || !quote.makerWorldUrl?.includes('makerworld.com')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
                      >
                        {loadingMakerWorld ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Analisi...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            <span>Importa Stima</span>
                          </>
                        )}
                      </button>
                    </div>

                    {makerWorldError && (
                      <div className="p-2 bg-red-950/40 border border-red-800/60 rounded-lg text-[11px] text-red-300 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                        <span>{makerWorldError}</span>
                      </div>
                    )}

                    {makerWorldInfo && (
                      <div className="p-2.5 bg-emerald-950/30 border border-emerald-800/50 rounded-lg space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {makerWorldInfo.coverUrl && (
                              <img 
                                src={makerWorldInfo.coverUrl} 
                                alt={makerWorldInfo.modelTitle} 
                                className="w-8 h-8 object-cover rounded-md border border-emerald-700/50 flex-shrink-0 bg-slate-900" 
                              />
                            )}
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-white truncate">
                                {makerWorldInfo.modelTitle}
                              </h4>
                              <span className="text-[10px] text-slate-400 truncate block">di {makerWorldInfo.authorName}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setMakerWorldInfo(null)}
                            className="p-1 text-slate-400 hover:text-white rounded"
                            title="Chiudi"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>

                        {makerWorldInfo.selectedProfile && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
                            <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                              <span className="text-[9px] text-slate-400 block">Tempo stimato:</span>
                              <span className="font-mono font-bold text-emerald-300">
                                {makerWorldInfo.selectedProfile.printHours}h {makerWorldInfo.selectedProfile.printMinutes}m
                              </span>
                            </div>
                            <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                              <span className="text-[9px] text-slate-400 block">Filamento:</span>
                              <span className="font-mono font-bold text-emerald-300">
                                ~{makerWorldInfo.selectedProfile.weightGrams}g
                              </span>
                            </div>
                            <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                              <span className="text-[9px] text-slate-400 block">Materiale:</span>
                              <span className="font-bold text-white truncate block">
                                {makerWorldInfo.selectedProfile.material}
                              </span>
                            </div>
                            <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                              <span className="text-[9px] text-slate-400 block">Multi-Colore:</span>
                              <span className="font-bold text-white">
                                {makerWorldInfo.selectedProfile.needAms ? '🎨 Sì (AMS)' : '⚪ Singolo'}
                              </span>
                            </div>
                          </div>
                        )}

                        {makerWorldInfo.availableProfiles.length > 1 && (
                          <div className="flex items-center gap-1.5 text-xs pt-1">
                            <span className="text-slate-400 text-[10px] whitespace-nowrap">Profilo:</span>
                            <select
                              value={makerWorldInfo.selectedProfile?.id || ''}
                              onChange={e => handleSelectMakerWorldProfile(Number(e.target.value))}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-xs text-white focus:border-emerald-500 outline-none"
                            >
                              {makerWorldInfo.availableProfiles.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.title} — {p.printHours}h {p.printMinutes}m ({p.weightGrams}g, {p.material})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Slicer File Import */}
                  <div className="p-2.5 bg-slate-950/60 border border-dashed border-cyan-500/30 hover:border-cyan-500/60 rounded-xl transition-all">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex-shrink-0">
                          <FileCode2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-white block leading-tight">Importa da Slicer (.3mf / .gcode)</span>
                          <span className="text-[10px] text-slate-400 truncate block">
                            Bambu Studio, OrcaSlicer, PrusaSlicer, Cura
                          </span>
                        </div>
                      </div>

                      <label className="cursor-pointer px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all shadow-sm flex-shrink-0">
                        <UploadCloud className="w-3 h-3" />
                        <span>{parsingSlicer ? 'Lettura...' : 'Carica File'}</span>
                        <input 
                          type="file" 
                          accept=".3mf,.gcode,.gco,.g" 
                          onChange={handleSlicerFile} 
                          className="hidden" 
                          disabled={parsingSlicer}
                        />
                      </label>
                    </div>

                    {slicerFeedback && (
                      <div className={`mt-2 p-2 rounded-lg text-[11px] flex items-center gap-1.5 ${
                        slicerFeedback.type === 'success' 
                          ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                          : 'bg-red-500/10 border border-red-500/30 text-red-400'
                      }`}>
                        {slicerFeedback.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                        <span>{slicerFeedback.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Filamento & Materiale */}
                  <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <Layers className="w-3.5 h-3.5" /> Filamento & Peso
                      </h3>

                      {spools.length > 0 && (
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="text-slate-500">Bobina:</span>
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
                            className="bg-slate-900 border border-emerald-500/40 text-emerald-300 rounded px-2 py-0.5 text-xs outline-none cursor-pointer max-w-[200px] truncate"
                          >
                            <option value="">Manuale</option>
                            {spools.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.brand} - {s.material} {s.color} ({s.weightRemaining}g)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5">Nome Materiale</label>
                        <input 
                          type="text" 
                          value={quote.material}
                          onChange={e => updateQuote('material', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white outline-none" 
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5">Costo Bobina (€/kg)</label>
                        <input 
                          type="number" 
                          step="0.10" 
                          value={quote.spoolCost} 
                          onChange={e => updateQuote('spoolCost', parseFloat(e.target.value) || 0)} 
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white outline-none" 
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5">Peso Pezzo (g netti)</label>
                        <input 
                          type="number" 
                          value={quote.weight} 
                          onChange={e => updateQuote('weight', parseFloat(e.target.value) || 0)} 
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white outline-none" 
                        />
                      </div>
                    </div>

                    {/* AMS / Multi-colore */}
                    <div className="pt-1 border-t border-slate-800/60">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={quote.multiColor} onChange={e => updateQuote('multiColor', e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500" />
                        <span className="text-xs font-medium text-slate-300">Stampa Multi-colore (AMS / Spurghi)</span>
                      </label>
                      
                      {quote.multiColor && (
                        <div className="grid grid-cols-2 gap-2 mt-2 p-2 bg-slate-900/60 rounded-lg border border-slate-800/60">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">Cambi Filamento</label>
                            <input type="number" value={quote.colorChanges} onChange={e => updateQuote('colorChanges', parseInt(e.target.value) || 0)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white outline-none" />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">Torre Spurgo (g)</label>
                            <input type="number" value={quote.purgeWeight} onChange={e => updateQuote('purgeWeight', parseFloat(e.target.value) || 0)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white outline-none" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: TEMPI & TARIFFE */}
              {calcTab === 'costs' && (
                <div className="space-y-3">
                  {/* Tempi Lavorazione */}
                  <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
                    <h3 className="text-xs font-semibold text-blue-400 flex items-center gap-1.5 uppercase tracking-wider">
                      <Clock className="w-3.5 h-3.5"/> Tempi di Produzione
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5">Ore Stampa</label>
                        <input type="number" value={quote.hours} onChange={e => updateQuote('hours', parseInt(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white outline-none" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5">Minuti Stampa</label>
                        <input type="number" max="59" value={quote.mins} onChange={e => updateQuote('mins', parseInt(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white outline-none" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5">Prep/Slicing (min)</label>
                        <input type="number" value={quote.prepMins} onChange={e => updateQuote('prepMins', parseInt(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white outline-none" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5">Post-process (min)</label>
                        <input type="number" value={quote.postMins} onChange={e => updateQuote('postMins', parseInt(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white outline-none" />
                      </div>
                    </div>
                  </div>

                  {/* Servizi & Sconto */}
                  <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
                    <h3 className="text-xs font-semibold text-purple-400 flex items-center gap-1.5 uppercase tracking-wider">
                      Servizi Aggiuntivi & Sconto
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5">Disegno CAD / Reverse (€)</label>
                        <input type="number" value={quote.cadCost} onChange={e => updateQuote('cadCost', parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white outline-none" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5">Supplemento Urgenza (€)</label>
                        <input type="number" value={quote.urgencyCost} onChange={e => updateQuote('urgencyCost', parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white outline-none" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-emerald-400 mb-0.5 font-bold">Sconto Finale (%)</label>
                        <input type="number" value={quote.discount} onChange={e => updateQuote('discount', parseFloat(e.target.value) || 0)} className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded px-2.5 py-1 text-xs outline-none font-bold" />
                      </div>
                    </div>
                  </div>

                  {/* Riepilogo Tariffe Macchina in uso */}
                  <div className="p-3 bg-slate-950/40 border border-slate-800/60 rounded-xl text-xs space-y-1.5">
                    <span className="font-bold text-slate-300 block text-[11px] uppercase tracking-wider">Parametri Macchinario Applicati:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-400 text-[11px]">
                      <div>Energia: <strong className="text-white">€{settings.powerCost}/kWh ({settings.watt}W)</strong></div>
                      <div>Ammortamento: <strong className="text-white">€{settings.wearCost}/h</strong></div>
                      <div>Manodopera: <strong className="text-white">€{settings.laborRate}/h</strong></div>
                      <div>Rischio scarto: <strong className="text-white">{settings.risk}%</strong></div>
                      <div>Margine applicato: <strong className="text-white">{settings.markup}%</strong></div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: HARDWARE BOM & 3D VIEWER */}
              {calcTab === 'extra' && (
                <div className="space-y-3">
                  {/* Hardware BOM */}
                  <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h3 className="text-xs font-semibold text-purple-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <Wrench className="w-3.5 h-3.5"/> Hardware & Viteria (BOM)
                      </h3>

                      <div className="flex items-center gap-1.5">
                        {hardwareStock.length > 0 && (
                          <select 
                            onChange={(e) => {
                              const chosen = hardwareStock.find(h => h.id === e.target.value);
                              if (chosen) addBomItem(chosen);
                              e.target.value = "";
                            }}
                            defaultValue=""
                            className="bg-slate-900 border border-purple-500/40 text-purple-300 rounded px-2 py-0.5 text-xs outline-none cursor-pointer max-w-[150px] truncate"
                          >
                            <option value="" disabled>+ Da magazzino...</option>
                            {hardwareStock.map(h => (
                              <option key={h.id} value={h.id}>{h.name} (€{h.cost.toFixed(2)})</option>
                            ))}
                          </select>
                        )}

                        <button 
                          onClick={() => addBomItem()} 
                          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Riga Libera
                        </button>
                      </div>
                    </div>
                    
                    {quote.extraBom.length === 0 ? (
                      <p className="text-xs text-slate-500 py-2 text-center">Nessuna viteria o inserto aggiunto a questo preventivo.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {quote.extraBom.map((item, index) => (
                          <div key={index} className="flex items-center gap-1.5">
                            <input type="text" value={item.name} onChange={e => updateBomItem(index, 'name', e.target.value)} placeholder="Descrizione" className="flex-1 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white outline-none" />
                            <input type="number" value={item.qty} onChange={e => updateBomItem(index, 'qty', parseInt(e.target.value) || 0)} placeholder="Qtà" className="w-14 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white text-center outline-none" />
                            <input type="number" step="0.01" value={item.cost} onChange={e => updateBomItem(index, 'cost', parseFloat(e.target.value) || 0)} placeholder="€ cad." className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white text-center outline-none" />
                            <button onClick={() => removeBomItem(index)} className="p-1 text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3D Viewer Three.js */}
                  <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <BoxIcon className="w-3.5 h-3.5 text-emerald-400" />
                        Visualizzatore 3D (.STL / .3MF)
                      </span>

                      <div className="flex items-center gap-2">
                        {uploadingModel && (
                          <span className="text-[11px] text-amber-400 animate-pulse">
                            Caricamento file...
                          </span>
                        )}

                        {quote.modelFileName && !uploadingModel && (
                          <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-emerald-400 text-[11px]">
                            <span className="font-medium truncate max-w-[130px]" title={quote.modelFileName}>
                              📎 {quote.modelFileName}
                            </span>
                            <button
                              type="button"
                              onClick={handleRemoveModel}
                              className="hover:text-red-400 text-slate-400 font-bold ml-1"
                              title="Rimuovi file"
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <StlViewer 
                      height={230}
                      url={quote.modelUrl}
                      fileName={quote.modelFileName}
                      initialColor={quote.material.includes('PLA') ? '#10b981' : quote.material.includes('PETG') ? '#06b6d4' : '#a855f7'}
                      onFileSelected={handleModelUpload}
                    />
                    <p className="text-[10px] text-slate-500 leading-tight">
                      💡 Il file 3D caricato viene memorizzato nel preventivo e visualizzato al cliente nel tracking ordine.
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* RIGHT: RIEPILOGO COSTI & AZIONI RAPIDE */}
          <div className="lg:col-span-4 flex flex-col min-h-0 bg-slate-900 border border-slate-800 rounded-xl p-3 justify-between overflow-y-auto">
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <div>
                  <h2 className="text-sm font-bold text-white leading-tight">Riepilogo Costi</h2>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Tariffa {quote.pricingType}</span>
                </div>
                <button 
                  onClick={saveCurrentQuote}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg flex items-center gap-1 transition-colors shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savedSuccess ? 'Salvato!' : quote.id ? 'Aggiorna' : 'Salva Lavoro'}
                </button>
              </div>
              
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Filamento ({(parseFloat(quote.weight.toString()) || 0) + (parseFloat(quote.purgeWeight.toString()) || 0)}g)</span>
                  <span className="font-medium">€{totals.materialCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Energia & Macchina</span>
                  <span className="font-medium">€{(totals.energyCost + totals.wearCost).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Lavoro Operatore</span>
                  <span className="font-medium">€{totals.laborCost.toFixed(2)}</span>
                </div>
                {totals.extraHardwareCost > 0 && (
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Hardware Extra</span>
                    <span className="font-medium">€{totals.extraHardwareCost.toFixed(2)}</span>
                  </div>
                )}
                {totals.servicesCost > 0 && (
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Servizi (CAD/Urgenza)</span>
                    <span className="font-medium">€{totals.servicesCost.toFixed(2)}</span>
                  </div>
                )}
                
                {!isPrivacyMode && (
                  <div className="pt-2 border-t border-slate-800 text-[11px]">
                    <div className="flex justify-between items-center text-slate-400 mb-0.5">
                      <span>Costi Vivi</span>
                      <span>€{totals.subtotalVivo.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400 mb-0.5">
                      <span>Rischio ({settings.risk}%)</span>
                      <span>+ €{(totals.costWithRisk - totals.subtotalVivo).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Margine ({settings.markup}%)</span>
                      <span>+ €{(totals.baseFinal - totals.costWithRisk).toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {totals.discountAmount > 0 && (
                  <div className="flex justify-between items-center text-emerald-400 font-medium pt-1.5 border-t border-slate-800">
                    <span>Sconto Applicato</span>
                    <span>- €{totals.discountAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800">
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-400 text-xs font-medium">Prezzo Finale</span>
                  <span className="text-2xl font-black text-white tracking-tight">€{totals.finalPrice.toFixed(2)}</span>
                </div>

                {!isPrivacyMode && (
                  <div className="flex justify-between items-center text-[11px] text-emerald-400/90 bg-emerald-500/10 p-1.5 rounded-md border border-emerald-500/20 mt-1">
                    <span>Utile netto stimato:</span>
                    <span className="font-bold font-mono">€{totals.estimatedProfit.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5 pt-3 border-t border-slate-800">
              <a 
                href={getWhatsAppUrl({
                  phone: quote.clientContact,
                  clientName: quote.clientName,
                  projectName: quote.name,
                  material: quote.material,
                  totalCalculated: totals.finalPrice,
                  orderCode: quote.id,
                  status: 'in_attesa'
                })}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 text-xs transition-all shadow-sm"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Invia WhatsApp
              </a>

              <button 
                onClick={handleExportText}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 text-xs transition-colors"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                {copied ? 'Copiato!' : 'Copia Testo Chat'}
              </button>

              <div className="grid grid-cols-2 gap-1.5">
                <button 
                  onClick={() => {
                    const currentId = quote.id || crypto.randomUUID();
                    if (!quote.id) setQuote(prev => ({ ...prev, id: currentId }));
                    setActiveParcelLabel({
                      type: 'parcel',
                      orderId: currentId,
                      clientName: quote.clientName || 'Cliente',
                      projectName: quote.name || 'Progetto 3D',
                      material: quote.material,
                      savedAt: new Date().toLocaleDateString('it-IT'),
                      totalCalculated: totals.finalPrice
                    });
                  }}
                  className="bg-slate-950 border border-slate-800 hover:bg-slate-800 text-cyan-400 font-medium py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 text-[11px] transition-colors"
                >
                  <QrCode className="w-3 h-3 text-cyan-400" /> Etichetta QR
                </button>

                <button 
                  onClick={() => window.print()}
                  className="bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 font-medium py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 text-[11px] transition-colors"
                >
                  <FileText className="w-3 h-3" /> Ricevuta PDF
                </button>
              </div>
            </div>

          </div>

        </div>

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