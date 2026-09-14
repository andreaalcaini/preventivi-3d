'use client';

import React, { useState, useEffect } from 'react';
import { 
  Wrench, Plus, CheckCircle2, AlertTriangle, 
  Trash2, Edit3, Clock, Layers, ShieldAlert,
  ChevronDown, ChevronUp, History
} from 'lucide-react';

interface MaintenanceLog {
  id: string;
  date: string;
  printerId: string;
  type: 'nozzle' | 'lubrificazione' | 'pulizia' | 'cinghie' | 'altro';
  description: string;
  hoursAtLog: number;
}

interface Printer {
  id: string;
  name: string;
  model: string;
  nozzleType: string;
  totalPrintHours: number;
  nozzleInstalledAtHours: number;
  nozzleLifespanHours: number;
  lastLubricationHours: number;
  lubricationIntervalHours: number;
  lastBeltsCheckHours: number;
  beltsCheckIntervalHours: number;
  status: 'operativa' | 'in_manutenzione' | 'ferma';
  notes?: string;
  logs: MaintenanceLog[];
}

export default function ManutenzionePage() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [totalFleetHours, setTotalFleetHours] = useState(0);
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  // Modali
  const [showAddPrinterModal, setShowAddPrinterModal] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [hoursModalPrinterId, setHoursModalPrinterId] = useState<string | null>(null);
  const [hoursToAdd, setHoursToAdd] = useState('10');
  const [customLogPrinterId, setCustomLogPrinterId] = useState<string | null>(null);
  const [customLogText, setCustomLogText] = useState('');
  const [customLogType, setCustomLogType] = useState<MaintenanceLog['type']>('pulizia');

  // Form nuovo / modifica stampante
  const [formName, setFormName] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formNozzleType, setFormNozzleType] = useState('0.4mm Acciaio Temperato');
  const [formTotalHours, setFormTotalHours] = useState('0');
  const [formNozzleLifespan, setFormNozzleLifespan] = useState('1000');
  const [formLubeInterval, setFormLubeInterval] = useState('250');
  const [formNotes, setFormNotes] = useState('');

  const fetchPrinters = async () => {
    try {
      const res = await fetch('/api/maintenance');
      const data = await res.json();
      if (data.printers) {
        setPrinters(data.printers);
        setTotalFleetHours(data.totalFleetHours || 0);
      }
    } catch {
      console.error('Errore caricamento stampanti');
    }
  };

  useEffect(() => {
    fetchPrinters();
  }, []);

  const handleOpenAddModal = () => {
    setEditingPrinter(null);
    setFormName('');
    setFormModel('Bambu Lab P1S');
    setFormNozzleType('0.4mm Acciaio Temperato');
    setFormTotalHours('0');
    setFormNozzleLifespan('1000');
    setFormLubeInterval('250');
    setFormNotes('');
    setShowAddPrinterModal(true);
  };

  const handleOpenEditModal = (p: Printer) => {
    setEditingPrinter(p);
    setFormName(p.name);
    setFormModel(p.model);
    setFormNozzleType(p.nozzleType);
    setFormTotalHours(p.totalPrintHours.toString());
    setFormNozzleLifespan(p.nozzleLifespanHours.toString());
    setFormLubeInterval(p.lubricationIntervalHours.toString());
    setFormNotes(p.notes || '');
    setShowAddPrinterModal(true);
  };

  const handleSavePrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    const action = editingPrinter ? 'edit_printer' : 'add_printer';
    const payload = {
      action,
      printerId: editingPrinter?.id,
      name: formName,
      model: formModel,
      nozzleType: formNozzleType,
      totalPrintHours: Number(formTotalHours) || 0,
      nozzleLifespanHours: Number(formNozzleLifespan) || 500,
      lubricationIntervalHours: Number(formLubeInterval) || 250,
      notes: formNotes
    };

    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowAddPrinterModal(false);
        fetchPrinters();
      }
    } catch {
      alert('Errore salvataggio stampante');
    }
  };

  const handleDeletePrinter = async (id: string, name: string) => {
    if (!confirm(`Sei sicuro di voler eliminare la stampante "${name}" e tutti i suoi log?`)) return;
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_printer', printerId: id })
      });
      if (res.ok) fetchPrinters();
    } catch {
      alert('Errore eliminazione stampante');
    }
  };

  const handleQuickAction = async (action: string, printerId: string, description?: string) => {
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, printerId, description })
      });
      if (res.ok) fetchPrinters();
    } catch {
      alert('Errore esecuzione azione');
    }
  };

  const handleAddHours = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hoursModalPrinterId) return;
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_hours',
          printerId: hoursModalPrinterId,
          hours: Number(hoursToAdd) || 0
        })
      });
      if (res.ok) {
        setHoursModalPrinterId(null);
        fetchPrinters();
      }
    } catch {
      alert('Errore aggiunta ore');
    }
  };

  const handleAddCustomLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customLogPrinterId || !customLogText.trim()) return;
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_log',
          printerId: customLogPrinterId,
          type: customLogType,
          description: customLogText.trim()
        })
      });
      if (res.ok) {
        setCustomLogPrinterId(null);
        setCustomLogText('');
        fetchPrinters();
      }
    } catch {
      alert('Errore registrazione intervento');
    }
  };

  return (
    <div className="h-full max-h-full overflow-hidden bg-slate-950 text-slate-200 p-2 sm:p-3 font-sans flex flex-col">
      <div className="max-w-7xl mx-auto w-full flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
        
        {/* Header Sezione */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Wrench className="w-5 h-5 text-emerald-400" />
              Registro Manutenzioni & Usura Nozzle
            </h1>
            <p className="text-slate-400 text-xs">
              Monitora l&apos;usura degli estrusori, programma la lubrificazione e registra la flotta stampanti
            </p>
          </div>

          <div className="flex flex-row items-center gap-2.5">
            <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-center shadow-sm">
              <span className="text-[10px] text-slate-400 block">Ore Flotta</span>
              <span className="text-sm font-bold text-emerald-400">{totalFleetHours.toFixed(1)} h</span>
            </div>

            <button
              onClick={handleOpenAddModal}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-950 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Aggiungi Stampante</span>
            </button>
          </div>
        </div>

        {/* Elenco Stampanti */}
        {printers.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-500 text-sm">
            Nessuna stampante registrata nel laboratorio. Clicca su &quot;Aggiungi Stampante&quot; per iniziare.
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {printers.map((printer) => {
              // Calcoli usura Nozzle
              const nozzleHours = Math.max(0, +(printer.totalPrintHours - printer.nozzleInstalledAtHours).toFixed(1));
              const nozzleLifespan = printer.nozzleLifespanHours || 500;
              const nozzlePct = Math.min(100, Math.round((nozzleHours / nozzleLifespan) * 100));
              const isNozzleCritical = nozzlePct >= 85;

              // Calcoli Lubrificazione
              const lubeHours = Math.max(0, +(printer.totalPrintHours - printer.lastLubricationHours).toFixed(1));
              const lubeInterval = printer.lubricationIntervalHours || 250;
              const lubePct = Math.min(100, Math.round((lubeHours / lubeInterval) * 100));
              const isLubeDue = lubePct >= 90;

              // Calcoli Cinghie
              const beltsHours = Math.max(0, +(printer.totalPrintHours - printer.lastBeltsCheckHours).toFixed(1));
              const beltsInterval = printer.beltsCheckIntervalHours || 500;
              const beltsPct = Math.min(100, Math.round((beltsHours / beltsInterval) * 100));

              const isLogsExpanded = Boolean(expandedLogs[printer.id]);

              return (
                <div 
                  key={printer.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 flex flex-col justify-between"
                >
                  <div>
                    {/* Intestazione Card Stampante */}
                    <div className="flex justify-between items-start gap-3 pb-4 border-b border-slate-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-white">{printer.name}</h3>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            printer.status === 'operativa'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : printer.status === 'in_manutenzione'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}>
                            {printer.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">
                          Modello: <strong className="text-slate-300">{printer.model}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setHoursModalPrinterId(printer.id);
                            setHoursToAdd('5');
                          }}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                          title="Aggiungi ore di stampa cumulate"
                        >
                          <Clock className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{printer.totalPrintHours} h</span>
                        </button>

                        <button
                          onClick={() => handleOpenEditModal(printer)}
                          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                          title="Modifica parametri stampante"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeletePrinter(printer.id, printer.name)}
                          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                          title="Rimuovi stampante"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Indicatori Usura & Manutenzione */}
                    <div className="space-y-4 pt-4">
                      
                      {/* 1. Usura Nozzle */}
                      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-amber-400" />
                            Usura Nozzle ({printer.nozzleType})
                          </span>
                          <span className={`font-mono font-bold ${
                            isNozzleCritical ? 'text-red-400' : nozzlePct >= 60 ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {nozzlePct}% ({nozzleHours} / {nozzleLifespan} h)
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${
                              isNozzleCritical 
                                ? 'bg-red-500' 
                                : nozzlePct >= 60 
                                  ? 'bg-amber-500' 
                                  : 'bg-emerald-500'
                            }`}
                            style={{ width: `${nozzlePct}%` }}
                          />
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-1 gap-1 text-[11px]">
                          <span className="text-slate-500">
                            {isNozzleCritical 
                              ? '⚠️ Ugello prossimo all\'usura critica, consigliata sostituzione' 
                              : `Rimangono circa ${(nozzleLifespan - nozzleHours).toFixed(1)} ore di estrusione`}
                          </span>

                          <button
                            onClick={() => {
                              if (confirm(`Confermi di aver sostituito il nozzle su "${printer.name}"? Il conteggio ore dell'ugello verrà azzerato.`)) {
                                handleQuickAction('replace_nozzle', printer.id);
                              }
                            }}
                            className="text-xs text-amber-400 hover:text-amber-300 hover:underline font-medium self-end sm:self-auto"
                          >
                            Sostituisci Nozzle
                          </button>
                        </div>
                      </div>

                      {/* 2. Lubrificazione Guide & Viti Z */}
                      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                            <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                            Lubrificazione Guide Lineari & Viti Z
                          </span>
                          <span className={`font-mono font-bold ${isLubeDue ? 'text-amber-400' : 'text-slate-300'}`}>
                            {lubeHours} / {lubeInterval} h
                          </span>
                        </div>

                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${isLubeDue ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${lubePct}%` }}
                          />
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-1 gap-1 text-[11px]">
                          <span className="text-slate-500">
                            {isLubeDue 
                              ? '⚠️ Intervallo raggiunto: pulire e ingrassare le guide' 
                              : `Prossimo controllo tra ${(lubeInterval - lubeHours).toFixed(1)} ore`}
                          </span>

                          <button
                            onClick={() => {
                              if (confirm(`Segnare come eseguita la lubrificazione guide su "${printer.name}"?`)) {
                                handleQuickAction('mark_lubricated', printer.id);
                              }
                            }}
                            className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline font-medium self-end sm:self-auto"
                          >
                            Segna Fatta
                          </button>
                        </div>
                      </div>

                      {/* 3. Controllo Cinghie */}
                      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                            Tensione Cinghie & Allineamento Assi
                          </span>
                          <span className="font-mono font-bold text-slate-300">
                            {beltsHours} / {beltsInterval} h
                          </span>
                        </div>

                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-purple-500 transition-all"
                            style={{ width: `${beltsPct}%` }}
                          />
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-1 gap-1 text-[11px]">
                          <span className="text-slate-500">Controllo periodico tensione e allineamento piatti</span>
                          <button
                            onClick={() => {
                              if (confirm(`Segnare come controllate le cinghie su "${printer.name}"?`)) {
                                handleQuickAction('mark_belts', printer.id);
                              }
                            }}
                            className="text-xs text-purple-400 hover:text-purple-300 hover:underline font-medium self-end sm:self-auto"
                          >
                            Segna Controllato
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Storico Interventi Log */}
                  <div className="pt-4 border-t border-slate-800">
                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => {
                          setExpandedLogs(prev => ({ ...prev, [printer.id]: !prev[printer.id] }));
                        }}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        <History className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Storico Interventi ({printer.logs?.length || 0})</span>
                        {isLogsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => {
                          setCustomLogPrinterId(printer.id);
                          setCustomLogText('');
                        }}
                        className="text-xs text-emerald-400 hover:underline font-medium flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Nuovo Intervento</span>
                      </button>
                    </div>

                    {/* Elenco log se espanso */}
                    {isLogsExpanded && (
                      <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                        {printer.logs && printer.logs.length > 0 ? (
                          printer.logs.map((log) => (
                            <div key={log.id} className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-lg text-xs space-y-0.5">
                              <div className="flex justify-between text-slate-400 text-[10px]">
                                <span className="font-semibold uppercase text-emerald-400">{log.type}</span>
                                <span>{log.date} • {log.hoursAtLog}h</span>
                              </div>
                              <p className="text-slate-200">{log.description}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-[11px] text-slate-500 italic py-2">Nessun log registrato per questa macchina.</p>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
            </div>
          </div>
        )}

        {/* MODALE AGGIUNGI / MODIFICA STAMPANTE */}
        {showAddPrinterModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <h3 className="text-base font-bold text-white">
                {editingPrinter ? 'Modifica Stampante' : 'Nuova Stampante del Laboratorio'}
              </h3>

              <form onSubmit={handleSavePrinter} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Nome Identificativo</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="Es. P1S #1 (Reparto Prototipazione)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1">Modello Macchina</label>
                    <input
                      type="text"
                      required
                      value={formModel}
                      onChange={e => setFormModel(e.target.value)}
                      placeholder="Es. Bambu Lab P1S"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Ore Attuali</label>
                    <input
                      type="number"
                      value={formTotalHours}
                      onChange={e => setFormTotalHours(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Tipo Nozzle Installato</label>
                  <input
                    type="text"
                    value={formNozzleType}
                    onChange={e => setFormNozzleType(e.target.value)}
                    placeholder="Es. 0.4mm Hardened Steel"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1">Durata Nozzle (ore)</label>
                    <input
                      type="number"
                      value={formNozzleLifespan}
                      onChange={e => setFormNozzleLifespan(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Intervallo Lubrif. (ore)</label>
                    <input
                      type="number"
                      value={formLubeInterval}
                      onChange={e => setFormLubeInterval(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Note Opzionali</label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    placeholder="Es. Piatto liscio, ugello CHT, camera riscaldata..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddPrinterModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg"
                  >
                    Salva
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODALE AGGIUNGI ORE DI STAMPA */}
        {hoursModalPrinterId && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" /> Aggiungi Ore di Stampa
              </h3>
              <p className="text-xs text-slate-400">
                Inserisci il numero di ore di lavoro eseguite da sommare al totale della macchina:
              </p>

              <form onSubmit={handleAddHours} className="space-y-4">
                <input
                  type="number"
                  step="0.1"
                  required
                  autoFocus
                  value={hoursToAdd}
                  onChange={e => setHoursToAdd(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-lg font-bold text-white text-center focus:outline-none focus:border-emerald-500"
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setHoursModalPrinterId(null)}
                    className="px-3.5 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs"
                  >
                    Conferma Ore
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODALE REGISTRA NUOVO INTERVENTO */}
        {customLogPrinterId && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-emerald-400" /> Registra Intervento di Manutenzione
              </h3>

              <form onSubmit={handleAddCustomLog} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Tipo di Intervento</label>
                  <select
                    value={customLogType}
                    onChange={e => setCustomLogType(e.target.value as MaintenanceLog['type'])}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="pulizia">Pulizia Piatto / Camera</option>
                    <option value="lubrificazione">Lubrificazione Guide e Barre</option>
                    <option value="nozzle">Sostituzione o Pulizia Ugello</option>
                    <option value="cinghie">Controllo o Tensionamento Cinghie</option>
                    <option value="altro">Altro / Riparazione</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Descrizione Lavoro Svolto</label>
                  <textarea
                    rows={3}
                    required
                    value={customLogText}
                    onChange={e => setCustomLogText(e.target.value)}
                    placeholder="Es. Sostituito hotend completo dopo intasamento filamento caricato fibra di carbonio..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500 leading-relaxed"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setCustomLogPrinterId(null)}
                    className="px-3.5 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs"
                  >
                    Salva Intervento
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
