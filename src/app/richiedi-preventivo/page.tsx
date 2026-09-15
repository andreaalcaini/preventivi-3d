'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Package, Send, CheckCircle2, AlertCircle, 
  ExternalLink, Layers, Sparkles, Lock, ArrowRight, Loader2
} from 'lucide-react';
import MakerWorldModelViewer from '@/components/MakerWorldModelViewer';
import type { MakerWorldPlateInfo, MakerWorldPicture } from '@/app/api/makerworld/route';
import { parseSlicerFile } from '@/lib/slicerParser';

export function calculateClientEstimate(
  hours: number,
  mins: number,
  weightGrams: number,
  qty: number,
  materialName: string,
  isAms: boolean
) {
  const printHours = Math.max(0.1, hours + (mins / 60));
  const grams = Math.max(1, weightGrams);

  const matUpper = (materialName || '').toUpperCase();
  let costPerGram = 0.025; // Base PLA/PETG (~25€/kg)
  if (matUpper.includes('TPU') || matUpper.includes('FLESSIBILE')) costPerGram = 0.038;
  else if (matUpper.includes('ABS') || matUpper.includes('ASA')) costPerGram = 0.030;
  else if (matUpper.includes('CF') || matUpper.includes('CARBON')) costPerGram = 0.050;

  const effectiveGrams = isAms ? grams * 1.25 : grams;
  const materialCost = effectiveGrams * costPerGram;
  const machineCost = printHours * 0.48; // Corrente + ammortamento macchina
  const laborBase = 2.00; // Avvio piatto, preparazione e distacco

  const rawCost = (materialCost + machineCost + laborBase) * 1.35; // Margine servizio
  const singlePrice = Math.max(3.50, Math.round(rawCost * 10) / 10);
  const total = Math.round(singlePrice * Math.max(1, qty) * 100) / 100;

  return { singlePrice, total, printHours, effectiveGrams };
}

export default function RichiediPreventivoPage() {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [makerWorldUrl, setMakerWorldUrl] = useState('');
  const [material, setMaterial] = useState('PLA Standard');
  const [color, setColor] = useState('Nero');
  const [quantity, setQuantity] = useState('1');
  const [stlDimensions, setStlDimensions] = useState<{ x: number; y: number; z: number } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState<{ orderId: string; trackingUrl: string } | null>(null);

  // MakerWorld auto-preview state
  const [loadingMw, setLoadingMw] = useState(false);
  const [mwError, setMwError] = useState('');
  const [mwInfo, setMwInfo] = useState<{
    modelTitle: string;
    coverUrl?: string;
    authorName?: string;
    printHours: number;
    printMinutes: number;
    weightGrams: number;
    material: string;
    needAms: boolean;
    plates?: MakerWorldPlateInfo[];
    pictures?: MakerWorldPicture[];
  } | null>(null);

  // Slicer file auto-preview state (.3mf / .gcode)
  const [slicerInfo, setSlicerInfo] = useState<{
    title: string;
    printHours: number;
    printMinutes: number;
    weightGrams: number;
    material?: string;
    needAms?: boolean;
    slicerName?: string;
  } | null>(null);

  const handleMakerWorldUrlChange = async (url: string) => {
    setMakerWorldUrl(url);
    setMwError('');
    if (!url.trim()) {
      setMwInfo(null);
      return;
    }
    if (!url.includes('makerworld.com/')) {
      setMwInfo(null);
      return;
    }

    setLoadingMw(true);
    try {
      const res = await fetch(`/api/makerworld?url=${encodeURIComponent(url.trim())}`);
      const data = await res.json();
      if (res.ok && data.success && data.selectedProfile) {
        const prof = data.selectedProfile;
        setMwInfo({
          modelTitle: data.modelTitle,
          coverUrl: data.coverUrl,
          authorName: data.authorName,
          printHours: prof.printHours,
          printMinutes: prof.printMinutes,
          weightGrams: prof.weightGrams,
          material: prof.material,
          needAms: prof.needAms,
          plates: prof.plates,
          pictures: data.pictures,
        });

        // Precompila il nome progetto se vuoto
        if (!projectName.trim()) {
          setProjectName(data.modelTitle);
        }
        if (prof.material) {
          setMaterial(prof.material);
        }
      } else {
        setMwError(data.error || 'Impossibile estrarre le specifiche dal link MakerWorld');
      }
    } catch (e) {
      console.error('Errore anteprima MakerWorld:', e);
      setMwError('Errore di connessione a MakerWorld');
    } finally {
      setLoadingMw(false);
    }
  };

  const numQuantity = Math.max(1, parseInt(quantity, 10) || 1);

  const activeModelInfo = mwInfo ? {
    title: mwInfo.modelTitle,
    hours: mwInfo.printHours,
    mins: mwInfo.printMinutes,
    weight: mwInfo.weightGrams,
    material: mwInfo.material,
    needAms: mwInfo.needAms,
    badge: 'Profilo MakerWorld',
    coverUrl: mwInfo.coverUrl,
    author: mwInfo.authorName
  } : slicerInfo ? {
    title: slicerInfo.title,
    hours: slicerInfo.printHours,
    mins: slicerInfo.printMinutes,
    weight: slicerInfo.weightGrams,
    material: slicerInfo.material || material,
    needAms: Boolean(slicerInfo.needAms),
    badge: slicerInfo.slicerName || 'File Slicer .3MF',
    coverUrl: undefined,
    author: undefined
  } : null;

  const estimate = useMemo(() => {
    if (!activeModelInfo) return null;
    return calculateClientEstimate(
      activeModelInfo.hours,
      activeModelInfo.mins,
      activeModelInfo.weight,
      numQuantity,
      material || activeModelInfo.material,
      activeModelInfo.needAms
    );
  }, [activeModelInfo, numQuantity, material]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let modelUrl = '';
      let modelFileName = '';

      // Se il cliente ha selezionato un file STL o 3MF, caricalo sul server
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const uploadRes = await fetch('/api/public/model', {
          method: 'POST',
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData.success) {
          modelUrl = uploadData.url;
          modelFileName = uploadData.fileName;
        }
      }

      const res = await fetch('/api/public/quote-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          contact,
          projectName,
          description,
          makerWorldUrl,
          material,
          color,
          quantity: numQuantity,
          stlDimensions,
          modelUrl,
          modelFileName,
          hours: activeModelInfo?.hours || 0,
          mins: activeModelInfo?.mins || 0,
          weight: activeModelInfo?.weight || 0,
          multiColor: Boolean(activeModelInfo?.needAms),
          totalCalculated: estimate?.total || 0
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Errore durante l\'invio della richiesta');
      } else {
        setSuccessData({
          orderId: data.orderId,
          trackingUrl: data.trackingUrl
        });
      }
    } catch {
      setError('Errore di connessione al server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full max-h-full overflow-hidden bg-slate-950 text-slate-200 p-2 sm:p-4 font-sans flex flex-col justify-between">
      
      <div className="max-w-6xl mx-auto w-full flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
        
        {/* Header Pubblico */}
        <header className="flex justify-between items-center pb-2.5 border-b border-slate-800/80 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Richiesta Preventivo Stampa 3D</h1>
              <p className="text-slate-400 text-xs">Carica il tuo modello 3D o incolla il link per ricevere un preventivo rapido</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/ordine"
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 transition-colors"
            >
              Traccia un Ordine
            </Link>
            <Link
              href="/login"
              className="text-xs text-slate-500 hover:text-slate-300 p-1.5"
              title="Area Venditore"
            >
              <Lock className="w-3.5 h-3.5" />
            </Link>
          </div>
        </header>

        {/* Schermata di Successo */}
        {successData ? (
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex items-center justify-center">
            <div className="max-w-2xl mx-auto bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 shadow-2xl text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-9 h-9" />
              </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white">Richiesta Inviata con Successo!</h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Abbiamo ricevuto la tua richiesta di stampa per <strong>{projectName}</strong>. Il laboratorio analizzerà la geometria del pezzo e ti ricontatterà al <strong>{contact}</strong>.
              </p>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl max-w-md mx-auto space-y-1">
              <span className="text-[11px] text-slate-500 block uppercase tracking-wider font-semibold">
                Tuo Codice Univoco di Tracciamento
              </span>
              <span className="text-xl font-mono font-bold text-emerald-400 block">
                #{successData.orderId}
              </span>
            </div>

            {estimate && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl max-w-md mx-auto text-xs text-slate-300 space-y-1.5 text-center">
                <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block">
                  Stima Preventivo Registrata
                </span>
                <span className="text-2xl font-black text-white font-mono block">
                  ~€{estimate.total.toFixed(2)}
                </span>
                <span className="text-[11px] text-slate-400 block">
                  {numQuantity} {numQuantity === 1 ? 'pezzo' : 'pezzi'} • Tempo: {mwInfo?.printHours}h {mwInfo?.printMinutes}m • Filamento: ~{(mwInfo?.weightGrams || 0) * numQuantity}g ({material || mwInfo?.material})
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-2">
              <Link
                href={successData.trackingUrl}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-950 flex items-center justify-center gap-2"
              >
                <span>Visualizza Stato del tuo Ordine</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => {
                  setSuccessData(null);
                  setProjectName('');
                  setDescription('');
                }}
                className="w-full sm:w-auto px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition-colors"
              >
                Invia un&apos;altra richiesta
              </button>
            </div>
          </div>
          </div>
        ) : (
          /* Form Richiesta a 2 Colonne */
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* Colonna Sinistra: 3D Viewer & Modello (5 Colonne) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  Anteprima Modello 3D
                </h2>
                <p className="text-xs text-slate-400">
                  Trascina qui il file .STL o .3MF per visualizzare le quote millimetriche in tempo reale
                </p>
              </div>

              {/* 3D Model & MakerWorld Viewer */}
              <MakerWorldModelViewer 
                makerWorldUrl={makerWorldUrl}
                modelTitle={activeModelInfo?.title}
                coverUrl={activeModelInfo?.coverUrl}
                authorName={activeModelInfo?.author}
                plates={mwInfo?.plates}
                pictures={mwInfo?.pictures}
                modelFileName={selectedFile?.name}
                material={material || activeModelInfo?.material || 'PLA'}
                height={320}
                allowUpload={true}
                onDimensionsCalculated={(dim) => {
                  setStlDimensions({ x: dim.x, y: dim.y, z: dim.z });
                }}
                onFileSelected={async (file) => {
                  setSelectedFile(file);
                  const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
                  if (!projectName) {
                    // Imposta il nome progetto dal nome del file
                    setProjectName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
                  }
                  // Se è un file .3mf o .gcode, analizziamo i metadati di stampa
                  if (file.name.toLowerCase().endsWith('.3mf') || file.name.toLowerCase().endsWith('.gcode')) {
                    try {
                      const parsed = await parseSlicerFile(file);
                      if (parsed && (parsed.hours > 0 || parsed.mins > 0 || parsed.weightGrams > 0)) {
                        setSlicerInfo({
                          title: cleanName,
                          printHours: parsed.hours,
                          printMinutes: parsed.mins,
                          weightGrams: parsed.weightGrams,
                          material: parsed.material || material,
                          needAms: Boolean(parsed.multiColor),
                          slicerName: parsed.slicerName
                        });
                        if (parsed.material) {
                          setMaterial(parsed.material);
                        }
                      }
                    } catch (err) {
                      console.warn('File 3D non contiene gcode integrato:', err);
                    }
                  }
                }}
              />

              {/* Box Link MakerWorld */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Incolla Link Modello MakerWorld
                  </label>
                  {makerWorldUrl.includes('makerworld.com/') && (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                      MakerWorld Riconosciuto
                    </span>
                  )}
                </div>
                
                <input
                  type="url"
                  value={makerWorldUrl}
                  onChange={e => handleMakerWorldUrlChange(e.target.value)}
                  placeholder="Incolla link (es. https://makerworld.com/it/models/...)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />

                {/* Feedback caricamento MakerWorld */}
                {loadingMw && (
                  <div className="flex items-center gap-2 text-[11px] text-emerald-400 animate-pulse pt-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Recupero specifiche modello e calcolo stima in corso...</span>
                  </div>
                )}

                {/* Feedback errore MakerWorld */}
                {mwError && (
                  <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
                    {mwError}
                  </p>
                )}

                {/* Card Modello Riconosciuto & Stima Istantanea */}
                {activeModelInfo && !loadingMw && (
                  <div className="p-3.5 bg-gradient-to-b from-emerald-950/60 to-slate-900 border border-emerald-500/40 rounded-xl space-y-2.5 text-xs animate-in fade-in">
                    <div className="flex items-center gap-3">
                      {activeModelInfo.coverUrl && (
                        <img 
                          src={activeModelInfo.coverUrl} 
                          alt={activeModelInfo.title} 
                          className="w-12 h-12 object-cover rounded-lg border border-emerald-700/50 flex-shrink-0 bg-slate-900" 
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> {activeModelInfo.badge}
                        </span>
                        <p className="text-white font-bold truncate text-xs mt-0.5">{activeModelInfo.title}</p>
                        {activeModelInfo.author && <p className="text-[10px] text-slate-400 truncate">di {activeModelInfo.author}</p>}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-emerald-900/60 flex items-center justify-between">
                      <div className="text-[11px] text-slate-300">
                        <span>⏱️ ~{activeModelInfo.hours}h {activeModelInfo.mins}m</span>
                        <span className="mx-1.5">•</span>
                        <span>⚖️ ~{activeModelInfo.weight}g</span>
                      </div>
                      {estimate && (
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block leading-tight">Stima indicativa:</span>
                          <span className="text-sm font-bold text-emerald-400 font-mono">
                            ~€{estimate.singlePrice.toFixed(2)} {numQuantity > 1 ? 'cad.' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Incollando un link MakerWorld, il sistema estrae in automatico tempo di stampa, grammi di filamento e materiale per fornirti una <strong>stima immediata e trasparente</strong>.
                </p>
              </div>
            </div>

            {/* Colonna Destra: Modulo Dati e Requisiti (7 Colonne) */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
              
              <div>
                <h2 className="text-lg font-bold text-white">Dettagli della Commessa</h2>
                <p className="text-xs text-slate-400">Compila i campi sottostanti per aiutarci a formulare il preventivo ottimale</p>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                
                {/* Dati Contatto */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Tuo Nome e Cognome / Azienda *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Es. Marco Rossi"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Telefono / WhatsApp o Email *
                    </label>
                    <input
                      type="text"
                      required
                      value={contact}
                      onChange={e => setContact(e.target.value)}
                      placeholder="Es. 333 1234567 o email@..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Nome Pezzo */}
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Nome del Pezzo / Progetto *
                  </label>
                  <input
                    type="text"
                    required
                    value={projectName}
                    onChange={e => setProjectName(e.target.value)}
                    placeholder="Es. Supporto telefono da scrivania, Manopola ricambio..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Specifiche Materiale & Colore */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Materiale Preferito
                    </label>
                    <select
                      value={material}
                      onChange={e => setMaterial(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="PLA Standard">PLA Standard (Uso generale)</option>
                      <option value="PETG Resistente">PETG (Resistente a urti e calore)</option>
                      <option value="TPU Flessibile">TPU Flessibile / Gomma</option>
                      <option value="ABS / ASA">ASA / ABS (Resistente UV esterno)</option>
                      <option value="Consigliato dal Maker">Non saprei (Consigliami tu)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Colore Desiderato
                    </label>
                    <input
                      type="text"
                      value={color}
                      onChange={e => setColor(e.target.value)}
                      placeholder="Es. Nero, Bianco, Arancione..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Quantità (Pezzi)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Descrizione / Requisiti d'Uso */}
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Note aggiuntive / Destinazione d&apos;uso (facoltativo)
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Es. Deve resistere in auto al sole estivo, o necessita di inserti filettati, o finitura liscia..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500 leading-relaxed"
                  />
                </div>

                {/* BOX RIEPILOGO STIMA (SEMPRE VISIBILE) */}
                {activeModelInfo && estimate ? (
                  <div className="p-4 bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 border-2 border-emerald-500/50 rounded-2xl space-y-3 shadow-xl animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-400" /> Stima Preventivo Istantanea
                      </span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-semibold border border-emerald-500/30">
                        {activeModelInfo.badge}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 pt-2 border-t border-emerald-900/60">
                      <div>
                        <span className="text-xs text-slate-400 block">Totale indicativo stimato:</span>
                        <div className="text-3xl font-extrabold text-white font-mono flex items-baseline gap-1.5">
                          <span className="text-emerald-400">€{estimate.total.toFixed(2)}</span>
                          <span className="text-xs text-slate-400 font-normal">
                            {numQuantity > 1 ? `(${numQuantity} pezzi a ~€${estimate.singlePrice.toFixed(2)} cad.)` : '(1 pezzo)'}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-slate-300 space-y-1 sm:text-right bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800 w-full sm:w-auto">
                        <div>⏱️ Stampa: <strong className="text-white font-mono">{activeModelInfo.hours}h {activeModelInfo.mins}m</strong> {numQuantity > 1 ? `x ${numQuantity}pz` : ''}</div>
                        <div>⚖️ Filamento: <strong className="text-white font-mono">{activeModelInfo.weight * numQuantity}g</strong> ({material || activeModelInfo.material})</div>
                        {activeModelInfo.needAms && <div className="text-amber-300 text-[11px]">🎨 Multi-colore con AMS</div>}
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-800/80 leading-relaxed">
                      💡 <strong>Stima trasparente:</strong> calcolata all&apos;istante in base ai parametri del modello (tempo, peso e materiale). Il laboratorio verificherà e confermerà l&apos;importo prima di avviare la stampa.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-950/70 border border-dashed border-slate-800 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-400/60" /> Stima Preventivo Istantanea
                      </span>
                      <span className="text-[10px] bg-slate-900 text-slate-500 px-2.5 py-0.5 rounded-full border border-slate-800">
                        In attesa di modello
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Incolla un <strong>link MakerWorld</strong> nel campo a sinistra oppure carica un file <strong>.3MF</strong> per calcolare all&apos;istante la stima dei costi e dei tempi di stampa.
                    </p>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => handleMakerWorldUrlChange('https://makerworld.com/it/models/2464216-bambu-lab-a1-series-ams-hub-mount-bracket?from=recommend#profileId-2705075')}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-medium bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Clicca qui per fare una prova con un modello MakerWorld</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-emerald-950 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {loading 
                        ? 'Invio in corso...' 
                        : (activeModelInfo && estimate) 
                          ? `Invia Richiesta con Stima (~€${estimate.total.toFixed(2)})` 
                          : 'Invia Richiesta di Preventivo'}
                    </span>
                  </button>
                </div>

              </form>

            </div>

          </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full pt-2 pb-2 text-center text-[11px] text-slate-600 border-t border-slate-900 flex-shrink-0">
        <p>PrintQuote Lab • Sistema di gestione e preventivazione per maker di stampa 3D FDM</p>
      </footer>

    </div>
  );
}
