'use client';

import React, { useState, useEffect } from 'react';
import { 
  Box, Plus, Trash2, Layers, Wrench, Search, 
  CheckCircle2, Scale, Pencil, X, AlertTriangle, 
  Info, Sparkles, RefreshCw, SlidersHorizontal, QrCode,
  Printer, CheckSquare
} from 'lucide-react';
import { 
  SPOOL_TARE_PRESETS, 
  findSuggestedTare, 
  calculateNetFilamentWeight, 
  SpoolTarePreset 
} from '@/data/spoolTares';
import QrLabelModal, { SpoolLabelData } from '@/components/QrLabelModal';
import BatchLabelModal from '@/components/BatchLabelModal';

export interface Spool {
  id: string;
  brand: string;
  material: string;
  color: string;
  cost: number;
  weightTotal: number;
  weightRemaining: number;
  spoolTare?: number;
  spoolType?: string;
  colorHex?: string;
  notes?: string;
}

interface HardwareItem {
  id: string;
  name: string;
  qty: number;
  cost: number;
}

interface InventoryData {
  spools: Spool[];
  hardware: HardwareItem[];
}

export default function MagazzinoPage() {
  const [activeTab, setActiveTab] = useState<'spools' | 'hardware'>('spools');
  const [inventory, setInventory] = useState<InventoryData>({ spools: [], hardware: [] });
  const [search, setSearch] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Form nuova bobina
  const [newSpool, setNewSpool] = useState<Omit<Spool, 'id'>>({
    brand: '',
    material: 'PLA',
    color: '',
    cost: 20,
    weightTotal: 1000,
    weightRemaining: 1000,
    spoolTare: 130,
    spoolType: 'Sunlu Plastica Standard (130g)',
    colorHex: '#10b981',
    notes: ''
  });

  // Stato Modale MODIFICA BOBINA
  const [editingSpool, setEditingSpool] = useState<Spool | null>(null);

  // Stato Modale PESA BOBINA (CALCOLATORE TARA)
  const [weighingSpool, setWeighingSpool] = useState<Spool | null>(null);
  const [grossWeightInput, setGrossWeightInput] = useState<number | ''>('');
  const [activeTareWeight, setActiveTareWeight] = useState<number>(200);
  const [activeTareModel, setActiveTareModel] = useState<string>('Personalizzata');
  const [tareSearchFilter, setTareSearchFilter] = useState('');
  const [activeSpoolLabel, setActiveSpoolLabel] = useState<SpoolLabelData | null>(null);
  const [showBatchLabels, setShowBatchLabels] = useState(false);
  const [selectedSpoolIds, setSelectedSpoolIds] = useState<string[]>([]);

  // Form nuovo componente hardware
  const [newHardware, setNewHardware] = useState<Omit<HardwareItem, 'id'>>({
    name: '',
    qty: 50,
    cost: 0.10
  });

  useEffect(() => {
    fetch('/api/inventory')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.spools) && Array.isArray(data.hardware)) {
          setInventory(data);
        }
      })
      .catch(err => console.error("Errore recupero magazzino", err));
  }, []);

  const triggerToast = (msg: string) => {
    setFeedbackMsg(msg);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setFeedbackMsg('');
    }, 2800);
  };

  const persistInventory = async (data: InventoryData, message = "Modifiche salvate") => {
    setInventory(data);
    try {
      await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      triggerToast(message);
    } catch (e) {
      console.error("Errore salvataggio magazzino", e);
    }
  };

  // Aggiornamento marca nel form nuova bobina con auto-suggerimento tara
  const handleBrandChange = (brand: string) => {
    const suggested = findSuggestedTare(brand);
    if (suggested) {
      setNewSpool(prev => ({
        ...prev,
        brand,
        spoolTare: suggested.tareWeight,
        spoolType: `${suggested.brand} - ${suggested.model} (${suggested.tareWeight}g)`
      }));
    } else {
      setNewSpool(prev => ({ ...prev, brand }));
    }
  };

  // --- AZIONI BOBINE ---
  const handleAddSpool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpool.material.trim()) return;

    const finalBrand = newSpool.brand.trim() || 'Generico';
    const suggested = findSuggestedTare(finalBrand);

    const spoolItem: Spool = {
      ...newSpool,
      id: crypto.randomUUID(),
      brand: finalBrand,
      color: newSpool.color.trim() || 'Standard',
      spoolTare: newSpool.spoolTare ?? (suggested?.tareWeight || 200),
      spoolType: newSpool.spoolType || (suggested ? `${suggested.brand} ${suggested.model}` : 'Generico (200g)')
    };

    const updated = {
      ...inventory,
      spools: [spoolItem, ...inventory.spools]
    };

    persistInventory(updated, "Nuova bobina aggiunta al magazzino");
    setNewSpool({
      brand: '',
      material: 'PLA',
      color: '',
      cost: 20,
      weightTotal: 1000,
      weightRemaining: 1000,
      spoolTare: 130,
      spoolType: 'Sunlu Plastica Standard (130g)',
      colorHex: '#10b981',
      notes: ''
    });
  };

  const handleUpdateSpoolWeight = (id: string, weight: number) => {
    const updatedSpools = inventory.spools.map(s => s.id === id ? { ...s, weightRemaining: Math.max(0, weight) } : s);
    persistInventory({ ...inventory, spools: updatedSpools }, "Giacenza aggiornata");
  };

  const handleDeleteSpool = (id: string) => {
    if (!confirm("Rimuovere questa bobina dal magazzino?")) return;
    const updatedSpools = inventory.spools.filter(s => s.id !== id);
    persistInventory({ ...inventory, spools: updatedSpools }, "Bobina rimossa");
    if (editingSpool?.id === id) setEditingSpool(null);
    if (weighingSpool?.id === id) setWeighingSpool(null);
  };

  // --- APRI MODALE MODIFICA ---
  const openEditModal = (spool: Spool) => {
    setEditingSpool({ ...spool });
  };

  const handleSaveEditedSpool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSpool) return;

    const updatedSpools = inventory.spools.map(s => s.id === editingSpool.id ? editingSpool : s);
    persistInventory({ ...inventory, spools: updatedSpools }, "Parametri bobina aggiornati");
    setEditingSpool(null);
  };

  // --- APRI MODALE PESA BOBINA ---
  const openWeighModal = (spool: Spool) => {
    setWeighingSpool(spool);
    const suggested = findSuggestedTare(spool.brand);
    const tare = spool.spoolTare ?? (suggested?.tareWeight || 200);
    const model = spool.spoolType || (suggested ? `${suggested.brand} - ${suggested.model}` : 'Generico');
    setActiveTareWeight(tare);
    setActiveTareModel(model);
    setTareSearchFilter('');

    // Preimposta il peso lordo suggerito (peso rimanente attuale + tara)
    setGrossWeightInput(spool.weightRemaining + tare);
  };

  // Rileva scansione QR Code Bobina da fotocamera smartphone (?spoolId=...&weigh=1)
  useEffect(() => {
    if (typeof window === 'undefined' || inventory.spools.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const targetSpoolId = params.get('spoolId');
    const shouldWeigh = params.get('weigh') === '1';

    if (targetSpoolId && shouldWeigh) {
      const targetSpool = inventory.spools.find(s => s.id === targetSpoolId);
      if (targetSpool) {
        openWeighModal(targetSpool);
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }
    }
  }, [inventory.spools]);

  const handleApplyWeighedWeight = () => {
    if (!weighingSpool) return;
    const gross = typeof grossWeightInput === 'number' ? grossWeightInput : 0;
    const net = calculateNetFilamentWeight(gross, activeTareWeight);

    const updatedSpools = inventory.spools.map(s => {
      if (s.id === weighingSpool.id) {
        return {
          ...s,
          weightRemaining: net,
          spoolTare: activeTareWeight,
          spoolType: activeTareModel
        };
      }
      return s;
    });

    persistInventory({ ...inventory, spools: updatedSpools }, `Bobina pesata: ${net}g netti registrati!`);
    setWeighingSpool(null);
  };

  // --- AZIONI HARDWARE ---
  const handleAddHardware = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHardware.name.trim()) return;

    const hwItem: HardwareItem = {
      ...newHardware,
      id: crypto.randomUUID()
    };

    const updated = {
      ...inventory,
      hardware: [hwItem, ...inventory.hardware]
    };

    persistInventory(updated, "Componente aggiunto al magazzino");
    setNewHardware({ name: '', qty: 50, cost: 0.10 });
  };

  const handleUpdateHardwareQty = (id: string, qty: number) => {
    const updatedHw = inventory.hardware.map(h => h.id === id ? { ...h, qty: Math.max(0, qty) } : h);
    persistInventory({ ...inventory, hardware: updatedHw }, "Quantità aggiornata");
  };

  const handleDeleteHardware = (id: string) => {
    if (!confirm("Rimuovere questo articolo dalla minuteria?")) return;
    const updatedHw = inventory.hardware.filter(h => h.id !== id);
    persistInventory({ ...inventory, hardware: updatedHw }, "Componente eliminato");
  };

  // Filtri ricerca
  const filteredSpools = inventory.spools.filter(s => 
    s.brand.toLowerCase().includes(search.toLowerCase()) ||
    s.material.toLowerCase().includes(search.toLowerCase()) ||
    s.color.toLowerCase().includes(search.toLowerCase()) ||
    (s.notes && s.notes.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredHardware = inventory.hardware.filter(h => 
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  // Preset filtrati per la modale di pesatura
  const filteredTarePresets = SPOOL_TARE_PRESETS.filter(p => 
    p.brand.toLowerCase().includes(tareSearchFilter.toLowerCase()) ||
    p.model.toLowerCase().includes(tareSearchFilter.toLowerCase()) ||
    p.description.toLowerCase().includes(tareSearchFilter.toLowerCase())
  );

  // Calcolo valori pesata in tempo reale
  const currentGross = typeof grossWeightInput === 'number' ? grossWeightInput : 0;
  const currentNet = calculateNetFilamentWeight(currentGross, activeTareWeight);
  const isGrossLessThanTare = currentGross > 0 && currentGross < activeTareWeight;
  const netPercentage = weighingSpool ? Math.min(100, Math.round((currentNet / (weighingSpool.weightTotal || 1000)) * 100)) : 0;
  const remainingValue = weighingSpool ? ((currentNet / (weighingSpool.weightTotal || 1000)) * weighingSpool.cost).toFixed(2) : '0.00';

  return (
    <div className="h-full max-h-full overflow-hidden bg-slate-950 text-slate-200 p-2 sm:p-3 font-sans flex flex-col">
      <div className="max-w-7xl mx-auto w-full flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
        
        {/* HEADER */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Box className="w-5 h-5 text-emerald-400" />
              Magazzino & Materiali
            </h1>
            <p className="text-slate-400 text-xs">
              Gestione bobine, tara produttori, pesatura e scorte minuteria
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            {savedSuccess && (
              <span className="text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-lg flex items-center gap-1 animate-in fade-in duration-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> {feedbackMsg || "Modifiche salvate"}
              </span>
            )}
            
            {/* TABS SELECTOR RESPONSIVE */}
            <div className="flex bg-slate-900 border border-slate-800 p-0.5 rounded-lg shadow-sm">
              <button
                onClick={() => setActiveTab('spools')}
                className={`flex items-center justify-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'spools' ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Bobine ({inventory.spools.length})
              </button>
              <button
                onClick={() => setActiveTab('hardware')}
                className={`flex items-center justify-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'hardware' ? 'bg-purple-600 text-white shadow-sm shadow-purple-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" /> Minuteria ({inventory.hardware.length})
              </button>
            </div>
          </div>
        </div>

        {/* CONTENUTO TAB 1: BOBINE */}
        {activeTab === 'spools' && (
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden">
            
            {/* FORM AGGIUNTA BOBINA (4 COLONNE) */}
            <div className="lg:col-span-4 flex flex-col min-h-0 overflow-y-auto">
              <form onSubmit={handleAddSpool} className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                    <Plus className="w-4 h-4 text-emerald-400" /> Aggiungi Bobina
                  </h2>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                    Tara Automatica
                  </span>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Marca / Produttore</label>
                  <input 
                    type="text" 
                    value={newSpool.brand} 
                    onChange={e => handleBrandChange(e.target.value)} 
                    placeholder="Es. Bambu Lab, Sunlu, eSUN, Prusament..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 outline-none"
                    required
                  />
                  <div className="mt-1 flex flex-wrap gap-1">
                    {['Bambu Lab', 'Sunlu', 'eSUN', 'Polymaker', 'Creality', 'Prusament'].map(b => (
                      <button
                        type="button"
                        key={b}
                        onClick={() => handleBrandChange(b)}
                        className="text-[10px] bg-slate-800/80 hover:bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded transition-colors"
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Materiale</label>
                    <select 
                      value={newSpool.material}
                      onChange={e => setNewSpool({ ...newSpool, material: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 outline-none"
                    >
                      <option value="PLA">PLA</option>
                      <option value="PLA+">PLA+</option>
                      <option value="PLA Matte">PLA Matte</option>
                      <option value="PLA CF">PLA CF (Carbon)</option>
                      <option value="PETG">PETG</option>
                      <option value="PETG CF">PETG CF</option>
                      <option value="TPU 95A">TPU 95A</option>
                      <option value="ABS">ABS</option>
                      <option value="ASA">ASA</option>
                      <option value="PC">PC (Policarbonato)</option>
                      <option value="Nylon/PA">Nylon / PA</option>
                      <option value="Altro">Altro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Colore</label>
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="text" 
                        value={newSpool.color} 
                        onChange={e => setNewSpool({ ...newSpool, color: e.target.value })} 
                        placeholder="Es. Nero, Ash Grey"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 outline-none"
                        required
                      />
                      <input 
                        type="color" 
                        value={newSpool.colorHex || '#10b981'}
                        onChange={e => setNewSpool({ ...newSpool, colorHex: e.target.value })}
                        className="w-7 h-8 bg-transparent cursor-pointer rounded border-0"
                        title="Seleziona colore visuale"
                      />
                    </div>
                  </div>
                </div>

                {/* TARA PREIMPOSTATA & MODELLO ROCHETTO */}
                <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-medium flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-emerald-400" /> Tara Rocchetto Vuoto
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">{newSpool.spoolTare || 0}g</span>
                  </div>

                  <select
                    value={newSpool.spoolType || ''}
                    onChange={e => {
                      const selected = SPOOL_TARE_PRESETS.find(p => p.id === e.target.value);
                      if (selected) {
                        setNewSpool({
                          ...newSpool,
                          spoolType: `${selected.brand} - ${selected.model}`,
                          spoolTare: selected.tareWeight
                        });
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 outline-none focus:border-emerald-500"
                  >
                    <option value="">Seleziona produttore/modello...</option>
                    {SPOOL_TARE_PRESETS.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.brand} - {p.model} ({p.tareWeight}g)
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2 pt-1">
                    <label className="text-[10px] text-slate-500 whitespace-nowrap">Tara personalizzata:</label>
                    <input 
                      type="number"
                      value={newSpool.spoolTare ?? 0}
                      onChange={e => setNewSpool({ ...newSpool, spoolTare: parseInt(e.target.value) || 0 })}
                      className="w-20 bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-xs text-white font-mono text-center outline-none focus:border-emerald-500"
                    />
                    <span className="text-[11px] text-slate-500">grammi</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Prezzo Bobina (€)</label>
                    <input 
                      type="number" 
                      step="0.10"
                      value={newSpool.cost} 
                      onChange={e => setNewSpool({ ...newSpool, cost: parseFloat(e.target.value) || 0 })} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Peso Iniziale (g)</label>
                    <input 
                      type="number" 
                      value={newSpool.weightTotal} 
                      onChange={e => {
                        const val = parseInt(e.target.value) || 1000;
                        setNewSpool({ ...newSpool, weightTotal: val, weightRemaining: val });
                      }} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Note (opzionali)</label>
                  <input 
                    type="text" 
                    value={newSpool.notes || ''} 
                    onChange={e => setNewSpool({ ...newSpool, notes: e.target.value })} 
                    placeholder="Es. Ripiano A2, temp ideale 220°C..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-emerald-950"
                >
                  <Plus className="w-4 h-4" /> Salva Bobina in Magazzino
                </button>
              </form>
            </div>

            {/* LISTA BOBINE ATTIVE (8 COLONNE) */}
            <div className="lg:col-span-8 flex flex-col min-h-0 space-y-2 overflow-hidden">
              
              {/* BARRA RICERCA & STATISTICHE RAPIDE */}
              <div className="flex-shrink-0 flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input 
                    type="text" 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Cerca bobina per marca, materiale, colore o note..." 
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="bg-slate-900/80 border border-slate-800 px-3 py-1 rounded-lg flex items-center gap-3 text-xs flex-shrink-0">
                  <div>
                    <span className="text-slate-500 text-[9px] block uppercase">Totale Filamento</span>
                    <strong className="text-white font-mono text-xs">
                      {(inventory.spools.reduce((acc, s) => acc + (s.weightRemaining || 0), 0) / 1000).toFixed(2)} kg
                    </strong>
                  </div>
                  <div className="h-5 w-px bg-slate-800" />
                  <div>
                    <span className="text-slate-500 text-[9px] block uppercase">Valore Giacenza</span>
                    <strong className="text-emerald-400 font-mono text-xs">
                      €{inventory.spools.reduce((acc, s) => acc + (((s.weightRemaining || 0) / (s.weightTotal || 1000)) * s.cost), 0).toFixed(2)}
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBatchLabels(true)}
                  className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm flex-shrink-0 cursor-pointer"
                  title="Stampa foglio unico A4 con etichette multiple (anti-spreco carta)"
                >
                  <Printer className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Stampa Foglio A4</span>
                  <span className="sm:hidden">Foglio A4</span>
                  {selectedSpoolIds.length > 0 && (
                    <span className="bg-cyan-500 text-slate-950 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                      {selectedSpoolIds.length}
                    </span>
                  )}
                </button>
              </div>

              {/* GRIGLIA CARDS DELLE BOBINE */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredSpools.length === 0 ? (
                  <div className="col-span-2 text-center py-16 bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-500 text-sm flex flex-col items-center justify-center gap-2">
                    <Box className="w-8 h-8 text-slate-600" />
                    <span>Nessuna bobina trovata nel magazzino.</span>
                  </div>
                ) : (
                  filteredSpools.map((spool) => {
                    const pct = Math.round((spool.weightRemaining / (spool.weightTotal || 1000)) * 100);
                    const isLow = pct <= 20;
                    const tare = spool.spoolTare ?? (findSuggestedTare(spool.brand)?.tareWeight || 200);

                    return (
                      <div 
                        key={spool.id} 
                        className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all rounded-2xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden group"
                      >
                        {/* Indicatore colore laterale decorativo */}
                        {spool.colorHex && (
                          <div 
                            className="absolute top-0 left-0 bottom-0 w-1 opacity-70"
                            style={{ backgroundColor: spool.colorHex }}
                          />
                        )}

                        <div>
                          {/* INTESTAZIONE CARD: MARCA, MATERIALE, BADGE PREZZO */}
                          <div className="flex justify-between items-start mb-2 pl-1.5">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                                  {spool.brand}
                                </span>
                                {spool.spoolType && (
                                  <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded">
                                    {spool.spoolType.replace(spool.brand, '').trim() || 'Standard'}
                                  </span>
                                )}
                              </div>
                              <h3 className="font-bold text-white text-sm flex items-center gap-2 mt-0.5">
                                {spool.colorHex && (
                                  <span 
                                    className="w-2.5 h-2.5 rounded-full inline-block border border-white/20 shadow-sm"
                                    style={{ backgroundColor: spool.colorHex }}
                                  />
                                )}
                                {spool.material} • {spool.color}
                              </h3>
                            </div>

                            <div className="text-right">
                              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                                €{spool.cost.toFixed(2)}
                              </span>
                              <span className="block text-[9px] text-slate-500 font-mono mt-0.5">
                                {spool.weightTotal}g orig.
                              </span>
                            </div>
                          </div>

                          {/* BADGE TARA BOBINA VUOTA */}
                          <div className="flex items-center justify-between text-[11px] bg-slate-950/70 border border-slate-800/80 px-2.5 py-1 rounded-lg my-2 pl-2">
                            <span className="text-slate-400 flex items-center gap-1">
                              <Scale className="w-3 h-3 text-emerald-400" />
                              Tara rocchetto: <strong className="text-slate-300 font-mono">{tare}g</strong>
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Lordo est.: ~{spool.weightRemaining + tare}g
                            </span>
                          </div>

                          {/* BARRA AVANZAMENTO LIVELLO FILAMENTO */}
                          <div className="my-2.5 space-y-1 pl-1">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-400">
                                Rimanente: <strong className="text-white font-mono">{spool.weightRemaining}g</strong> / {spool.weightTotal}g
                              </span>
                              <span className={`font-mono font-bold ${isLow ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {pct}%
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                              <div 
                                className={`h-full transition-all duration-300 ${isLow ? 'bg-amber-500 shadow-amber-500/50 shadow-sm' : 'bg-emerald-500 shadow-emerald-500/50 shadow-sm'}`} 
                                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                              />
                            </div>
                          </div>

                          {/* NOTE BOBINA (SE PRESENTI) */}
                          {spool.notes && (
                            <p className="text-[11px] text-slate-400 italic bg-slate-950/40 px-2 py-1 rounded border border-slate-800/40 mb-2 truncate">
                              📌 {spool.notes}
                            </p>
                          )}
                        </div>

                        {/* FOOTER AZIONI: PESA ALLA BILANCIA, MODIFICA COMPLETA, AGGIORNAMENTO RAPIDO GRAMMI, ELIMINA */}
                        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                          {/* PULSANTI RAPIDI PESA, MODIFICA & ETICHETTA QR */}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => openWeighModal(spool)}
                              className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                              title="Pesa questa bobina alla bilancia e scala la tara"
                            >
                              <Scale className="w-3.5 h-3.5" />
                              <span>Pesa</span>
                            </button>

                            <button
                              onClick={() => setActiveSpoolLabel({
                                type: 'spool',
                                id: spool.id,
                                brand: spool.brand,
                                material: spool.material,
                                color: spool.color,
                                colorHex: spool.colorHex,
                                weightRemaining: spool.weightRemaining,
                                weightTotal: spool.weightTotal || 1000,
                                tareWeight: spool.spoolTare ?? 200,
                                cost: spool.cost,
                              })}
                              className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                              title="Stampa etichetta adesiva QR con tara e link di pesata istantanea"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>QR</span>
                            </button>

                            <button
                              onClick={() => openEditModal(spool)}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Modifica tutti i parametri della bobina"
                            >
                              <Pencil className="w-3.5 h-3.5 text-slate-400" />
                              <span>Modifica</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSpoolIds(prev => 
                                  prev.includes(spool.id) ? prev.filter(id => id !== spool.id) : [...prev, spool.id]
                                );
                              }}
                              className={`px-2 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                selectedSpoolIds.includes(spool.id)
                                  ? 'bg-cyan-500/25 border-cyan-500 text-cyan-300'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                              title={selectedSpoolIds.includes(spool.id) ? "Rimuovi da selezione foglio A4" : "Seleziona per stampa foglio A4"}
                            >
                              <CheckSquare className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">{selectedSpoolIds.includes(spool.id) ? 'Selezionata' : 'Foglio'}</span>
                            </button>
                          </div>

                          {/* INPUT RAPIDO GRAMMI RIMANENTI + CESTINO */}
                          <div className="flex items-center gap-1.5">
                            <input 
                              type="number" 
                              value={spool.weightRemaining}
                              onChange={e => handleUpdateSpoolWeight(spool.id, parseInt(e.target.value) || 0)}
                              className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-1 text-xs text-center font-mono text-white outline-none focus:border-emerald-500"
                              title="Modifica rapida grammi rimanenti"
                            />
                            <span className="text-[11px] text-slate-500">g</span>

                            <button 
                              onClick={() => handleDeleteSpool(spool.id)}
                              className="p-1.5 hover:bg-red-500/20 rounded-lg text-slate-500 hover:text-red-400 transition-colors ml-1"
                              title="Elimina bobina"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                      </div>
                    );
                  })
                )}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* CONTENUTO TAB 2: HARDWARE & BOM */}
        {activeTab === 'hardware' && (
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden">
            
            {/* FORM AGGIUNTA HARDWARE (4 COLONNE) */}
            <div className="lg:col-span-4 flex flex-col min-h-0 overflow-y-auto">
              <form onSubmit={handleAddHardware} className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-3 shadow-xl">
                <h2 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <Plus className="w-3.5 h-3.5 text-purple-400" /> Aggiungi Componente
                </h2>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Nome Articolo / Specifiche</label>
                  <input 
                    type="text" 
                    value={newHardware.name} 
                    onChange={e => setNewHardware({ ...newHardware, name: e.target.value })} 
                    placeholder="Es. Inserti M3, Cuscinetti 608, Viti..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:ring-1 focus:ring-purple-500 outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-0.5">Quantità a Scorta</label>
                    <input 
                      type="number" 
                      value={newHardware.qty} 
                      onChange={e => setNewHardware({ ...newHardware, qty: parseInt(e.target.value) || 0 })} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:ring-1 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-0.5">Costo Unitario (€)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={newHardware.cost} 
                      onChange={e => setNewHardware({ ...newHardware, cost: parseFloat(e.target.value) || 0 })} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:ring-1 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-1 transition-colors shadow-md shadow-purple-950"
                >
                  <Plus className="w-3.5 h-3.5" /> Salva nel Cassetto Hardware
                </button>
              </form>
            </div>

            {/* TABELLA HARDWARE (8 COLONNE) */}
            <div className="lg:col-span-8 flex flex-col min-h-0 space-y-2 overflow-hidden">
              <div className="relative flex-shrink-0">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input 
                  type="text" 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cerca viteria, dadi, inserti, magneti..." 
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex-1 min-h-0 bg-slate-900 border border-slate-800 rounded-xl overflow-y-auto shadow-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3.5 font-semibold">Descrizione Componente</th>
                      <th className="p-3.5 font-semibold">Giacenza</th>
                      <th className="p-3.5 font-semibold">Costo Unitario</th>
                      <th className="p-3.5 font-semibold text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredHardware.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-12 text-slate-500">
                          Nessun componente hardware registrato.
                        </td>
                      </tr>
                    ) : (
                      filteredHardware.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-3.5 font-medium text-white">{item.name}</td>
                          <td className="p-3.5">
                            <input 
                              type="number" 
                              value={item.qty}
                              onChange={e => handleUpdateHardwareQty(item.id, parseInt(e.target.value) || 0)}
                              className="w-16 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-center font-mono text-white outline-none focus:border-purple-500"
                            />
                            <span className="ml-1 text-slate-500 text-[11px]">pz</span>
                          </td>
                          <td className="p-3.5 font-mono text-purple-300">€{item.cost.toFixed(2)}</td>
                          <td className="p-3.5 text-right">
                            <button 
                              onClick={() => handleDeleteHardware(item.id)}
                              className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-red-400 transition-colors"
                              title="Elimina"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* MODALE 1: MODIFICA COMPLETA PARAMETRI BOBINA                              */}
        {/* ========================================================================= */}
        {editingSpool && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5">
              
              {/* HEADER MODALE */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <Pencil className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Modifica Parametri Bobina</h2>
                    <p className="text-xs text-slate-400">Aggiorna qualsiasi specifica tecnica, prezzo, rimanenza o tara</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingSpool(null)}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* FORM MODIFICA */}
              <form onSubmit={handleSaveEditedSpool} className="space-y-4">
                
                {/* MARCA & AUTO-SUGGERIMENTO */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Marca / Produttore</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={editingSpool.brand} 
                      onChange={e => {
                        const newBrand = e.target.value;
                        const suggested = findSuggestedTare(newBrand);
                        setEditingSpool(prev => prev ? ({
                          ...prev,
                          brand: newBrand,
                          spoolTare: suggested ? suggested.tareWeight : prev.spoolTare,
                          spoolType: suggested ? `${suggested.brand} - ${suggested.model}` : prev.spoolType
                        }) : null);
                      }} 
                      placeholder="Es. Bambu Lab, Sunlu, eSUN..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 outline-none"
                      required
                    />
                  </div>
                </div>

                {/* MATERIALE E COLORE */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Materiale</label>
                    <input 
                      type="text" 
                      value={editingSpool.material} 
                      onChange={e => setEditingSpool({ ...editingSpool, material: e.target.value })} 
                      placeholder="Es. PLA, PETG, TPU 95A, PA-CF..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Colore & Badge Visivo</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={editingSpool.color} 
                        onChange={e => setEditingSpool({ ...editingSpool, color: e.target.value })} 
                        placeholder="Es. Nero, Grigio Cenere"
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 outline-none"
                        required
                      />
                      <input 
                        type="color" 
                        value={editingSpool.colorHex || '#10b981'}
                        onChange={e => setEditingSpool({ ...editingSpool, colorHex: e.target.value })}
                        className="w-8 h-8 bg-transparent cursor-pointer rounded border-0"
                        title="Seleziona colore esadecimale"
                      />
                    </div>
                  </div>
                </div>

                {/* PREZZO E PESO INIZIALE */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Costo di Acquisto (€)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={editingSpool.cost} 
                      onChange={e => setEditingSpool({ ...editingSpool, cost: parseFloat(e.target.value) || 0 })} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 outline-none font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Peso Iniziale Matassa (g)</label>
                    <input 
                      type="number" 
                      value={editingSpool.weightTotal} 
                      onChange={e => setEditingSpool({ ...editingSpool, weightTotal: parseInt(e.target.value) || 1000 })} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 outline-none font-mono"
                      required
                    />
                  </div>
                </div>

                {/* PESO RIMANENTE ATTUALE */}
                <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-white">Filamento Rimanente (g)</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {editingSpool.weightRemaining}g / {editingSpool.weightTotal}g ({Math.round((editingSpool.weightRemaining / (editingSpool.weightTotal || 1000)) * 100)}%)
                    </span>
                  </div>
                  <input 
                    type="number" 
                    value={editingSpool.weightRemaining} 
                    onChange={e => setEditingSpool({ ...editingSpool, weightRemaining: Math.max(0, parseInt(e.target.value) || 0) })} 
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-emerald-500 outline-none"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Valore residuo: €{(((editingSpool.weightRemaining || 0) / (editingSpool.weightTotal || 1000)) * editingSpool.cost).toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => setEditingSpool({ ...editingSpool, weightRemaining: editingSpool.weightTotal })}
                      className="text-emerald-400 hover:underline"
                    >
                      Ripristina al 100% (Nuova)
                    </button>
                  </div>
                </div>

                {/* TARA BOBINA VUOTA & PRESET PRODUTTORI */}
                <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-emerald-400" />
                      Rocchetto Vuoto & Tara (g)
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">{editingSpool.spoolTare || 0}g</span>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Preset Produttore:</label>
                    <select
                      value={editingSpool.spoolType || ''}
                      onChange={e => {
                        const selected = SPOOL_TARE_PRESETS.find(p => p.id === e.target.value);
                        if (selected) {
                          setEditingSpool({
                            ...editingSpool,
                            spoolType: `${selected.brand} - ${selected.model}`,
                            spoolTare: selected.tareWeight
                          });
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-emerald-500"
                    >
                      <option value="">Seleziona tara da database...</option>
                      {SPOOL_TARE_PRESETS.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.brand} - {p.model} ({p.tareWeight}g)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex-1">
                      <label className="block text-[10px] text-slate-400 mb-0.5">Tara personalizzata (g):</label>
                      <input 
                        type="number" 
                        value={editingSpool.spoolTare ?? 0} 
                        onChange={e => setEditingSpool({ ...editingSpool, spoolTare: parseInt(e.target.value) || 0 })} 
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] text-slate-400 mb-0.5">Nome/Tipo rocchetto:</label>
                      <input 
                        type="text" 
                        value={editingSpool.spoolType || ''} 
                        onChange={e => setEditingSpool({ ...editingSpool, spoolType: e.target.value })} 
                        placeholder="Es. Plastica Sunlu, Cartone..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* NOTE EXTRA */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Note Aggiuntive</label>
                  <textarea 
                    rows={2}
                    value={editingSpool.notes || ''} 
                    onChange={e => setEditingSpool({ ...editingSpool, notes: e.target.value })} 
                    placeholder="Es. Temperatura consigliata 215°C/60°C, ripiano magazzino, note di essiccazione..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 outline-none resize-none"
                  />
                </div>

                {/* BOTTONI CONFERMA */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingSpool(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-950"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Salva Tutte le Modifiche
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODALE 2: PESA BOBINA ALLA BILANCIA & SCALA TARA AUTOMATICA              */}
        {/* ========================================================================= */}
        {weighingSpool && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5">
              
              {/* HEADER MODALE */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <Scale className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      Pesa Bobina alla Bilancia
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">
                        Tara Automatica
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Metti la bobina sulla bilancia: al peso lordo verrà scalata la tara del rocchetto vuoto
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setWeighingSpool(null)}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* RIEPILOGO BOBINA SELEZIONATA */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{weighingSpool.brand}</span>
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    {weighingSpool.colorHex && (
                      <span 
                        className="w-2.5 h-2.5 rounded-full inline-block border border-white/20"
                        style={{ backgroundColor: weighingSpool.colorHex }}
                      />
                    )}
                    {weighingSpool.material} • {weighingSpool.color}
                  </h3>
                </div>
                <div className="text-right text-xs">
                  <span className="text-slate-400 block text-[11px]">Rimanenza Attuale:</span>
                  <strong className="text-emerald-400 font-mono text-sm">{weighingSpool.weightRemaining}g</strong>
                </div>
              </div>

              {/* SELEZIONE TARA / ROCHETTO VUOTO */}
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                    Tara Rocchetto Vuoto Applicata:
                  </label>
                  <span className="text-sm font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
                    -{activeTareWeight}g
                  </span>
                </div>

                {/* SELETTORE PRESET CON RICERCA */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={tareSearchFilter}
                      onChange={e => setTareSearchFilter(e.target.value)}
                      placeholder="Cerca produttore (Bambu, Sunlu, eSun, Polymaker...)"
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
                    />
                    {tareSearchFilter && (
                      <button 
                        type="button" 
                        onClick={() => setTareSearchFilter('')}
                        className="text-xs text-slate-400 hover:text-white px-2"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  <select
                    value={activeTareModel}
                    onChange={e => {
                      const selected = SPOOL_TARE_PRESETS.find(p => p.model === e.target.value);
                      if (selected) {
                        setActiveTareModel(selected.model);
                        setActiveTareWeight(selected.tareWeight);
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-emerald-500 font-mono"
                  >
                    <optgroup label="Preset Produttori Riconosciuti Online">
                      {filteredTarePresets.map(p => (
                        <option key={p.id} value={p.model}>
                          {p.brand}: {p.model} ({p.tareWeight}g)
                        </option>
                      ))}
                    </optgroup>
                  </select>

                  {/* TARA MANUALE DI PRECISIONE */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-slate-400">Tara manuale bilancia:</span>
                    <input 
                      type="number" 
                      value={activeTareWeight} 
                      onChange={e => {
                        const v = parseInt(e.target.value) || 0;
                        setActiveTareWeight(v);
                        setActiveTareModel('Personalizzata');
                      }}
                      className="w-20 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-center font-mono text-white outline-none focus:border-emerald-500"
                    />
                    <span className="text-xs text-slate-500">g</span>
                  </div>
                </div>
              </div>

              {/* INPUT PESO LORDO BILANCIA (BOX PRINCIPALE IN EVIDENZA) */}
              <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-emerald-500/40 rounded-2xl p-5 space-y-4 shadow-xl">
                <div>
                  <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Peso Lordo Letto sulla Bilancia (g)</span>
                    <span className="text-[10px] text-slate-400 lowercase font-normal">bobina intera + filamento</span>
                  </label>
                  
                  <div className="relative">
                    <input 
                      type="number" 
                      autoFocus
                      placeholder="Es. 830"
                      value={grossWeightInput} 
                      onChange={e => setGrossWeightInput(e.target.value === '' ? '' : parseInt(e.target.value) || 0)} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-2xl font-mono font-bold text-white text-center focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                    />
                    <span className="absolute right-4 top-4 text-slate-500 font-mono text-sm">grammi</span>
                  </div>
                </div>

                {/* AVVISO SE PESO LORDO < TARA */}
                {isGrossLessThanTare && (
                  <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-950/40 border border-amber-800/60 p-2.5 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>Attenzione: il peso lordo ({currentGross}g) è inferiore al solo rocchetto vuoto ({activeTareWeight}g)!</span>
                  </div>
                )}

                {/* FORMULA E CALCOLO NETTO IN TEMPO REALE */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono pb-2 border-b border-slate-800/80">
                    <span>Formula di Calcolo:</span>
                    <span>{currentGross}g (Lordo) - {activeTareWeight}g (Tara)</span>
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-xs text-slate-400 block">Filamento Netto Rimanente:</span>
                      <div className="text-3xl font-extrabold text-white font-mono flex items-baseline gap-1.5">
                        <span className={currentNet > 0 ? "text-emerald-400" : "text-slate-400"}>{currentNet}</span>
                        <span className="text-base text-slate-500 font-normal">grammi</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Percentuale & Valore:</span>
                      <div className="font-mono font-bold text-sm text-white">
                        <span className={netPercentage <= 20 ? 'text-amber-400' : 'text-emerald-400'}>{netPercentage}%</span>
                        <span className="text-slate-500 mx-1.5">•</span>
                        <span className="text-emerald-400">€{remainingValue}</span>
                      </div>
                    </div>
                  </div>

                  {/* MINI BARRA LIVELLO */}
                  <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div 
                      className={`h-full transition-all duration-300 ${netPercentage <= 20 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, Math.max(0, netPercentage))}%` }}
                    />
                  </div>
                </div>

              </div>

              {/* PULSANTI CONFERMA E APPLICA */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setWeighingSpool(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Annulla
                </button>

                <button
                  type="button"
                  onClick={handleApplyWeighedWeight}
                  disabled={currentGross <= 0}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-950"
                >
                  <Scale className="w-4 h-4" />
                  <span>Applica {currentNet}g e Salva nel Magazzino</span>
                </button>
              </div>

            </div>
          </div>
        )}

        {/* MODALE ETICHETTA QR BOBINA / BILANCIA */}
        {activeSpoolLabel && (
          <QrLabelModal 
            data={activeSpoolLabel} 
            onClose={() => setActiveSpoolLabel(null)} 
          />
        )}

        {/* MODALE STAMPA FOGLIO A4 ETICHETTE MULTIPLE */}
        {showBatchLabels && (
          <BatchLabelModal
            spools={inventory.spools}
            preselectedIds={selectedSpoolIds.length > 0 ? selectedSpoolIds : undefined}
            onClose={() => setShowBatchLabels(false)}
          />
        )}

      </div>
    </div>
  );
}