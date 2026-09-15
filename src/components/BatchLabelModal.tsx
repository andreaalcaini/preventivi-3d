'use client';

import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import { 
  Printer, X, Search, CheckSquare, Square, 
  SlidersHorizontal, AlertCircle, FileText
} from 'lucide-react';
import { Spool } from '@/app/magazzino/page';
import { findSuggestedTare } from '@/data/spoolTares';

interface Props {
  spools: Spool[];
  preselectedIds?: string[];
  onClose: () => void;
}

export type SheetLayout = '2x4' | '3x6' | '3x7';

export default function BatchLabelModal({ spools, preselectedIds, onClose }: Props) {
  // Mappa di quantità etichette selezionate per ciascuna bobina
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    if (preselectedIds && preselectedIds.length > 0) {
      preselectedIds.forEach(id => { initial[id] = 1; });
    } else {
      // Di default seleziona tutte le bobine con almeno 1 etichetta
      spools.forEach(s => { initial[s.id] = 1; });
    }
    return initial;
  });

  // Filtri ricerca
  const [search, setSearch] = useState('');
  const [filterMaterial, setFilterMaterial] = useState<string>('all');
  const [filterBrand, setFilterBrand] = useState<string>('all');

  // Opzioni Layout Foglio A4
  const [layout, setLayout] = useState<SheetLayout>('3x6');
  const [showTare, setShowTare] = useState(true);
  const [showCost, setShowCost] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const [showCutLines, setShowCutLines] = useState(true);

  // Mappa QR data URLs
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [, setLoadingQrs] = useState(true);

  // Lista materiali e marche uniche per filtri
  const uniqueMaterials = useMemo(() => {
    return Array.from(new Set(spools.map(s => s.material))).filter(Boolean).sort();
  }, [spools]);

  const uniqueBrands = useMemo(() => {
    return Array.from(new Set(spools.map(s => s.brand))).filter(Boolean).sort();
  }, [spools]);

  // Bobine filtrate
  const filteredSpools = useMemo(() => {
    return spools.filter(s => {
      const matchSearch = !search || 
        s.brand.toLowerCase().includes(search.toLowerCase()) ||
        s.material.toLowerCase().includes(search.toLowerCase()) ||
        s.color.toLowerCase().includes(search.toLowerCase()) ||
        (s.notes && s.notes.toLowerCase().includes(search.toLowerCase()));
      
      const matchMaterial = filterMaterial === 'all' || s.material.toUpperCase() === filterMaterial.toUpperCase();
      const matchBrand = filterBrand === 'all' || s.brand.toLowerCase() === filterBrand.toLowerCase();

      return matchSearch && matchMaterial && matchBrand;
    });
  }, [spools, search, filterMaterial, filterBrand]);

  // Genera tutti i QR code una sola volta
  useEffect(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    let isCancelled = false;

    const generateQrs = async () => {
      setLoadingQrs(true);
      const newMap: Record<string, string> = {};
      
      for (const spool of spools) {
        if (isCancelled) return;
        const targetUrl = `${origin}/magazzino?spoolId=${encodeURIComponent(spool.id)}&weigh=1`;
        try {
          const dataUrl = await QRCode.toDataURL(targetUrl, {
            width: 180,
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' }
          });
          newMap[spool.id] = dataUrl;
        } catch (e) {
          console.error('Errore QR per bobina', spool.id, e);
        }
      }

      if (!isCancelled) {
        setQrMap(newMap);
        setLoadingQrs(false);
      }
    };

    generateQrs();
    return () => { isCancelled = true; };
  }, [spools]);

  // Conteggi e calcoli fogli
  const flatLabelsToPrint = useMemo(() => {
    const list: Spool[] = [];
    spools.forEach(spool => {
      const qty = selectedQuantities[spool.id] || 0;
      for (let i = 0; i < qty; i++) {
        list.push(spool);
      }
    });
    return list;
  }, [spools, selectedQuantities]);

  const labelsPerPage = layout === '2x4' ? 8 : layout === '3x6' ? 18 : 21;
  const totalSheetsNeeded = Math.ceil(flatLabelsToPrint.length / labelsPerPage) || 1;

  // Toggle singola bobina
  const toggleSpool = (id: string) => {
    setSelectedQuantities(prev => {
      const copy = { ...prev };
      if (copy[id] && copy[id] > 0) {
        delete copy[id];
      } else {
        copy[id] = 1;
      }
      return copy;
    });
  };

  // Seleziona tutti i visibili
  const handleSelectAllVisible = () => {
    setSelectedQuantities(prev => {
      const copy = { ...prev };
      filteredSpools.forEach(s => {
        copy[s.id] = copy[s.id] && copy[s.id] > 0 ? copy[s.id] : 1;
      });
      return copy;
    });
  };

  // Deseleziona tutti i visibili
  const handleDeselectAllVisible = () => {
    setSelectedQuantities(prev => {
      const copy = { ...prev };
      filteredSpools.forEach(s => {
        delete copy[s.id];
      });
      return copy;
    });
  };

  // Modifica quantità copie per bobina
  const setQuantity = (id: string, delta: number) => {
    setSelectedQuantities(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      const copy = { ...prev };
      if (next === 0) {
        delete copy[id];
      } else {
        copy[id] = next;
      }
      return copy;
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      
      {/* Box Principale */}
      <div className="relative w-full max-w-6xl max-h-[95vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* HEADER MODALE (Nascosto in stampa) */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Stampa Foglio Etichette A4 Multiplo
                <span className="text-xs font-normal text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  Zero Spreco Carta
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Stampa più etichette contemporaneamente su un unico foglio per evitare sprechi.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={flatLabelsToPrint.length === 0}
              className="py-1.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white text-xs font-bold transition-all shadow-md shadow-cyan-950 flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Stampa Foglio ({flatLabelsToPrint.length} Etichette)</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CORPO MODALE DIVISO: SINISTRA SELEZIONE / DESTRA ANTEPRIMA FOGLIO A4 (Nascosto in stampa) */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 overflow-hidden print:hidden">
          
          {/* COLONNA SINISTRA: SELEZIONE BOBINE & OPZIONI (4 Colonne) */}
          <div className="lg:col-span-4 p-4 flex flex-col min-h-0 space-y-3 overflow-y-auto">
            
            {/* Opzioni di Layout & Formato */}
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
              <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Formato Foglio A4
              </span>
              
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setLayout('2x4')}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    layout === '2x4'
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold">2 x 4</div>
                  <div className="text-[10px] opacity-75">8 per foglio</div>
                  <div className="text-[9px] text-slate-500">Grandi (~95x65)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setLayout('3x6')}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    layout === '3x6'
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold">3 x 6</div>
                  <div className="text-[10px] opacity-75">18 per foglio</div>
                  <div className="text-[9px] text-slate-500">Standard (~65x45)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setLayout('3x7')}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    layout === '3x7'
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold">3 x 7</div>
                  <div className="text-[10px] opacity-75">21 per foglio</div>
                  <div className="text-[9px] text-slate-500">Avery (~65x38)</div>
                </button>
              </div>

              {/* Toggle Campi Inclusi */}
              <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px]">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={showQr}
                    onChange={e => setShowQr(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                  />
                  <span>Includi QR Code</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={showTare}
                    onChange={e => setShowTare(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                  />
                  <span>Includi Tara Vuoto</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={showCost}
                    onChange={e => setShowCost(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                  />
                  <span>Includi Prezzo</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={showCutLines}
                    onChange={e => setShowCutLines(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                  />
                  <span>Linee di Taglio</span>
                </label>
              </div>
            </div>

            {/* Ricerca & Filtri Bobine */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cerca bobine..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <select
                  value={filterMaterial}
                  onChange={e => setFilterMaterial(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none"
                >
                  <option value="all">Tutti i Materiali</option>
                  {uniqueMaterials.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>

                <select
                  value={filterBrand}
                  onChange={e => setFilterBrand(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none"
                >
                  <option value="all">Tutte le Marche</option>
                  {uniqueBrands.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllVisible}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <CheckSquare className="w-3 h-3" /> Seleziona visibili
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllVisible}
                    className="text-[11px] text-slate-400 hover:text-slate-300 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Square className="w-3 h-3" /> Deseleziona
                  </button>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {filteredSpools.length} bobine
                </span>
              </div>
            </div>

            {/* Lista Selezionabile Bobine */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 border-t border-slate-800 pt-2">
              {filteredSpools.map(spool => {
                const count = selectedQuantities[spool.id] || 0;
                const isSelected = count > 0;

                return (
                  <div
                    key={spool.id}
                    className={`p-2 rounded-xl border transition-all flex items-center justify-between gap-2 text-xs ${
                      isSelected
                        ? 'bg-slate-950 border-cyan-500/50'
                        : 'bg-slate-950/40 border-slate-800/60 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div 
                      className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1"
                      onClick={() => toggleSpool(spool.id)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSpool(spool.id)}
                        className="rounded bg-slate-900 border-slate-700 text-cyan-500 cursor-pointer"
                      />
                      {spool.colorHex && (
                        <span 
                          className="w-3 h-3 rounded-full border border-white/20 flex-shrink-0"
                          style={{ backgroundColor: spool.colorHex }}
                        />
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate">
                          {spool.brand} {spool.material}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {spool.color} • {spool.weightRemaining}g rem.
                        </div>
                      </div>
                    </div>

                    {/* Contatore copie etichetta */}
                    {isSelected && (
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => setQuantity(spool.id, -1)}
                          className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white rounded hover:bg-slate-800 text-xs font-bold cursor-pointer"
                        >
                          -
                        </button>
                        <span className="text-xs font-mono font-bold w-4 text-center text-cyan-300">
                          {count}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(spool.id, 1)}
                          className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white rounded hover:bg-slate-800 text-xs font-bold cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Riepilogo Etichette e Fogli */}
            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs flex items-center justify-between text-slate-300">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Etichette Selezionate</span>
                <strong className="text-white text-sm font-mono">{flatLabelsToPrint.length}</strong>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase block">Fogli A4 Necessari</span>
                <strong className="text-cyan-400 text-sm font-mono">
                  {totalSheetsNeeded} {totalSheetsNeeded === 1 ? 'foglio' : 'fogli'}
                </strong>
              </div>
            </div>

          </div>

          {/* COLONNA DESTRA: ANTEPRIMA LIVE FOGLIO A4 A VIDEO (8 Colonne) */}
          <div className="lg:col-span-8 p-4 bg-slate-950/70 flex flex-col min-h-0 overflow-y-auto items-center">
            <div className="flex items-center justify-between w-full max-w-[650px] mb-2 text-xs text-slate-400">
              <span className="font-semibold flex items-center gap-1 text-slate-300">
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                Anteprima Foglio A4 ({layout} • {labelsPerPage} slot per foglio)
              </span>
              <span className="text-[11px] text-slate-500">
                {flatLabelsToPrint.length % labelsPerPage === 0 
                  ? 'Foglio pieno al 100%' 
                  : `${labelsPerPage - (flatLabelsToPrint.length % labelsPerPage)} slot liberi nell'ultimo foglio`}
              </span>
            </div>

            {flatLabelsToPrint.length === 0 ? (
              <div className="m-auto text-center py-20 text-slate-500 text-sm space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-600 mx-auto" />
                <p>Nessuna etichetta selezionata.</p>
                <button
                  type="button"
                  onClick={handleSelectAllVisible}
                  className="text-xs text-cyan-400 underline hover:text-cyan-300 cursor-pointer"
                >
                  Seleziona tutte le bobine visibili
                </button>
              </div>
            ) : (
              /* FOGLIO BIANCO SIMULATO A4 */
              <div className="w-full max-w-[680px] bg-white text-black p-4 rounded-xl shadow-2xl border border-slate-300 font-sans">
                
                <div 
                  className={`grid gap-2 ${
                    layout === '2x4' 
                      ? 'grid-cols-2' 
                      : 'grid-cols-3'
                  }`}
                >
                  {flatLabelsToPrint.map((spool, idx) => {
                    const tare = spool.spoolTare ?? (findSuggestedTare(spool.brand)?.tareWeight || 200);
                    const qrUrl = qrMap[spool.id];

                    return (
                      <div
                        key={`${spool.id}-${idx}`}
                        className={`p-2 rounded flex flex-col justify-between text-left text-black ${
                          showCutLines ? 'border border-dashed border-gray-400' : 'border border-gray-200'
                        } ${
                          layout === '2x4' ? 'min-h-[120px]' : layout === '3x6' ? 'min-h-[92px]' : 'min-h-[80px]'
                        }`}
                      >
                        {/* Riga Header: Marca, Materiale, Colore */}
                        <div className="border-b border-black pb-0.5 mb-1 flex items-baseline justify-between leading-tight">
                          <div>
                            <span className="font-black text-[10px] uppercase tracking-wider block">
                              {spool.brand}
                            </span>
                            <span className="text-[9px] font-bold text-gray-800 uppercase">
                              {spool.material}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1 text-[9px]">
                            <span className="truncate max-w-[65px] font-medium">{spool.color}</span>
                            {spool.colorHex && (
                              <span 
                                className="w-2.5 h-2.5 rounded-full border border-black inline-block flex-shrink-0"
                                style={{ backgroundColor: spool.colorHex }}
                              />
                            )}
                          </div>
                        </div>

                        {/* Centro: QR Code + Dati Peso */}
                        <div className="flex items-center gap-2 my-0.5">
                          {showQr && (
                            qrUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={qrUrl}
                                alt="QR"
                                className={`${layout === '2x4' ? 'w-14 h-14' : 'w-10 h-10'} border border-black p-0.5 rounded flex-shrink-0`}
                              />
                            ) : (
                              <div className={`${layout === '2x4' ? 'w-14 h-14' : 'w-10 h-10'} bg-gray-200 animate-pulse rounded flex-shrink-0`} />
                            )
                          )}

                          <div className="text-[9px] leading-tight space-y-0.5 min-w-0">
                            <div>
                              <span className="text-[7px] text-gray-500 uppercase block">Residuo:</span>
                              <strong className="text-[11px] font-black text-black">{spool.weightRemaining}g</strong>
                            </div>

                            {showTare && (
                              <div>
                                <span className="text-[7px] text-gray-500 uppercase block">Tara rocchetto:</span>
                                <span className="font-bold text-gray-800">{tare}g</span>
                              </div>
                            )}

                            {showCost && (
                              <div className="text-[8px] text-gray-700">
                                Costo: <strong>€{spool.cost.toFixed(2)}</strong>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Footer Etichetta */}
                        <div className="mt-1 pt-0.5 border-t border-gray-300 flex justify-between items-center text-[7px] text-gray-500 font-mono">
                          <span>Inquadra QR per pesare</span>
                          <span>ID:{spool.id.slice(0, 6)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            )}
          </div>

        </div>

      </div>

      {/* BLOCCO DEDICATO ALLA STAMPA REALE (VISIBILE SOLO IN WINDOW.PRINT) */}
      <div id="printable-batch-sheet" className="hidden print:block text-black bg-white font-sans w-full">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm 6mm;
            }
            body {
              background: white !important;
              color: black !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            body * {
              visibility: hidden;
            }
            #printable-batch-sheet, #printable-batch-sheet * {
              visibility: visible;
            }
            #printable-batch-sheet {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              display: block !important;
            }
            .page-break-label {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
          }
        `}} />

        <div 
          className={`grid gap-2 w-full ${
            layout === '2x4' 
              ? 'grid-cols-2' 
              : 'grid-cols-3'
          }`}
        >
          {flatLabelsToPrint.map((spool, idx) => {
            const tare = spool.spoolTare ?? (findSuggestedTare(spool.brand)?.tareWeight || 200);
            const qrUrl = qrMap[spool.id];

            return (
              <div
                key={`print-${spool.id}-${idx}`}
                className={`page-break-label p-2 flex flex-col justify-between text-left text-black ${
                  showCutLines ? 'border border-dashed border-gray-400' : 'border border-gray-200'
                } ${
                  layout === '2x4' ? 'h-[65mm]' : layout === '3x6' ? 'h-[44mm]' : 'h-[37mm]'
                }`}
              >
                {/* Header Marca / Materiale */}
                <div className="border-b border-black pb-0.5 mb-1 flex items-baseline justify-between leading-tight">
                  <div>
                    <span className="font-black text-xs uppercase tracking-wider block">
                      {spool.brand}
                    </span>
                    <span className="text-[10px] font-bold text-gray-800 uppercase">
                      {spool.material}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="font-semibold">{spool.color}</span>
                    {spool.colorHex && (
                      <span 
                        className="w-3 h-3 rounded-full border border-black inline-block flex-shrink-0" 
                        style={{ backgroundColor: spool.colorHex }}
                      />
                    )}
                  </div>
                </div>

                {/* Centro: QR Code + Dati */}
                <div className="flex items-center gap-2.5 my-1">
                  {showQr && qrUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrUrl}
                      alt="QR"
                      className={`${layout === '2x4' ? 'w-16 h-16' : 'w-12 h-12'} border border-black p-0.5 rounded flex-shrink-0`}
                    />
                  )}

                  <div className="text-[10px] leading-tight space-y-0.5 min-w-0">
                    <div>
                      <span className="text-[8px] text-gray-500 uppercase block">Residuo Filamento:</span>
                      <strong className="text-sm font-black text-black">{spool.weightRemaining}g</strong>
                    </div>

                    {showTare && (
                      <div>
                        <span className="text-[8px] text-gray-500 uppercase block">Tara rocchetto:</span>
                        <span className="font-bold text-gray-800">{tare}g</span>
                      </div>
                    )}

                    {showCost && (
                      <div className="text-[9px] text-gray-700">
                        Costo: <strong>€{spool.cost.toFixed(2)}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Etichetta */}
                <div className="mt-1 pt-0.5 border-t border-gray-300 flex justify-between items-center text-[8px] text-gray-600 font-mono">
                  <span>Inquadra QR per pesare</span>
                  <span>ID: {spool.id.slice(0, 8)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
