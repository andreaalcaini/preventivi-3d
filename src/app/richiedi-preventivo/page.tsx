'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Package, Send, CheckCircle2, AlertCircle, 
  ExternalLink, Layers, Sparkles, Lock, ArrowRight, Loader2, Copy
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
  const [copiedCode, setCopiedCode] = useState(false);

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

  const handleCopyCode = () => {
    if (successData?.orderId) {
      navigator.clipboard.writeText(successData.orderId);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 p-3 sm:p-6 font-sans flex flex-col justify-between relative">
      
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col gap-6">
        
        {/* Floating Island Top Header */}
        <header className="bg-slate-950/80 backdrop-blur-2xl border border-white/10 ring-1 ring-white/5 rounded-2xl sm:rounded-full px-4 sm:px-6 py-3 flex items-center justify-between shadow-2xl shadow-black/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
              <Package className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.75} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-[0.2em] font-semibold">
                  Configuratore Rapido
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Richiesta Preventivo Stampa 3D
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/ordine"
              className="text-xs text-slate-300 hover:text-white px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all font-medium"
            >
              Traccia un Ordine
            </Link>
            <Link
              href="/login"
              className="text-slate-400 hover:text-white p-2 rounded-full bg-white/[0.03] border border-white/5 hover:border-white/15 transition-all"
              title="Area Riservata Operatore"
            >
              <Lock className="w-3.5 h-3.5" strokeWidth={1.75} />
            </Link>
          </div>
        </header>

        {/* Schermata di Successo con Ricevuta Digitale Aptica */}
        {successData ? (
          <div className="flex-1 flex items-center justify-center py-6">
            <div className="p-1.5 rounded-[2.5rem] bg-white/[0.04] border border-emerald-500/30 ring-1 ring-emerald-500/20 shadow-2xl max-w-xl w-full">
              <div className="p-8 sm:p-10 rounded-[calc(2.5rem-0.375rem)] bg-slate-950/95 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] text-center space-y-6">
                
                <div className="w-16 h-16 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-400 mx-auto shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                  <CheckCircle2 className="w-8 h-8" strokeWidth={2} />
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-[0.2em] font-semibold">
                    Ricezione Confermata
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    Richiesta Inviata al Laboratorio
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                    Abbiamo ricevuto le specifiche per <strong>{projectName}</strong>. Il nostro team analizzerà la geometria del pezzo e ti risponderà al recapito <strong>{contact}</strong>.
                  </p>
                </div>

                {/* Codice Tracciamento Box con Copia Rapida */}
                <div className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl max-w-md mx-auto space-y-2">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold block">
                    Codice Univoco Commessa
                  </span>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl sm:text-3xl font-mono font-black text-emerald-400">
                      #{successData.orderId}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
                      title="Copia codice negli appunti"
                    >
                      {copiedCode ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" strokeWidth={1.75} />}
                    </button>
                  </div>
                </div>

                {estimate && (
                  <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl max-w-md mx-auto text-xs text-slate-300 space-y-1.5">
                    <span className="text-[10px] text-emerald-400 uppercase font-mono font-bold tracking-wider block">
                      Stima Economica Registrata
                    </span>
                    <span className="text-2xl font-black text-white font-mono block">
                      ~€{estimate.total.toFixed(2)}
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      {numQuantity} {numQuantity === 1 ? 'pezzo' : 'pezzi'} • Tempo: {mwInfo?.printHours || activeModelInfo?.hours || 0}h {mwInfo?.printMinutes || activeModelInfo?.mins || 0}m • Filamento: ~{(mwInfo?.weightGrams || activeModelInfo?.weight || 0) * numQuantity}g ({material || mwInfo?.material})
                    </span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-2">
                  <Link
                    href={successData.trackingUrl}
                    className="w-full sm:w-auto py-3 pl-6 pr-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-full transition-all shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-3 active:scale-[0.98] group"
                  >
                    <span>Segui Avanzamento Ordine</span>
                    <div className="w-7 h-7 rounded-full bg-slate-950/15 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                      <ArrowRight className="w-3.5 h-3.5 text-slate-950" strokeWidth={2.5} />
                    </div>
                  </Link>
                  <button
                    onClick={() => {
                      setSuccessData(null);
                      setProjectName('');
                      setDescription('');
                    }}
                    className="w-full sm:w-auto px-6 py-3 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 font-medium text-xs rounded-full border border-white/10 transition-colors"
                  >
                    Nuova richiesta
                  </button>
                </div>

              </div>
            </div>
          </div>
        ) : (
          /* Form Richiesta in Griglia Bento Asimmetrica */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-6">
            
            {/* Colonna Sinistra: 3D Model Viewer & MakerWorld (5 Colonne) */}
            <div className="lg:col-span-5 space-y-5">
              
              <div className="p-1.5 rounded-[2rem] bg-white/[0.03] border border-white/10 ring-1 ring-white/5 shadow-2xl">
                <div className="p-5 rounded-[calc(2rem-0.375rem)] bg-slate-950/85 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400" strokeWidth={1.75} />
                      <h2 className="text-sm font-bold text-white tracking-tight">
                        Anteprima Modello 3D
                      </h2>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                      WebGL & G-Code
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    Trascina qui un file <strong>.STL</strong> o <strong>.3MF</strong> per ispezionare le quote millimetriche o visualizzare i piatti MakerWorld.
                  </p>

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
                        setProjectName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
                      }
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
                </div>
              </div>

              {/* Box Link MakerWorld in Doppelrand */}
              <div className="p-1.5 rounded-[2rem] bg-white/[0.03] border border-white/10 ring-1 ring-white/5 shadow-xl">
                <div className="p-5 rounded-[calc(2rem-0.375rem)] bg-slate-950/85 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.75} />
                      Link Progetto MakerWorld
                    </label>
                    {makerWorldUrl.includes('makerworld.com/') && (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-mono font-medium">
                        Profilo Riconosciuto
                      </span>
                    )}
                  </div>
                  
                  <input
                    type="url"
                    value={makerWorldUrl}
                    onChange={e => handleMakerWorldUrlChange(e.target.value)}
                    placeholder="https://makerworld.com/it/models/..."
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono"
                  />

                  {loadingMw && (
                    <div className="flex items-center gap-2 text-xs text-emerald-400 animate-pulse pt-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Estrazione specifiche tecniche e calcolo stima in corso...</span>
                    </div>
                  )}

                  {mwError && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">
                      {mwError}
                    </p>
                  )}

                  {activeModelInfo && !loadingMw && (
                    <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl space-y-3 text-xs">
                      <div className="flex items-center gap-3">
                        {activeModelInfo.coverUrl && (
                          <img 
                            src={activeModelInfo.coverUrl} 
                            alt={activeModelInfo.title} 
                            className="w-12 h-12 object-cover rounded-xl border border-white/10 flex-shrink-0 bg-slate-900 shadow-sm" 
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] text-emerald-400 font-mono font-bold uppercase tracking-wider block">
                            {activeModelInfo.badge}
                          </span>
                          <p className="text-white font-bold truncate text-xs mt-0.5">{activeModelInfo.title}</p>
                          {activeModelInfo.author && <p className="text-[10px] text-slate-400 truncate">di {activeModelInfo.author}</p>}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                        <div className="text-[11px] text-slate-300 font-mono">
                          <span>⏱️ ~{activeModelInfo.hours}h {activeModelInfo.mins}m</span>
                          <span className="mx-2">•</span>
                          <span>⚖️ ~{activeModelInfo.weight}g</span>
                        </div>
                        {estimate && (
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block leading-tight">Stima pezzo:</span>
                            <span className="text-sm font-bold text-emerald-400 font-mono">
                              ~€{estimate.singlePrice.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Incollando l&apos;URL, il sistema estrae in automatico i piatti, il consumo di filo e la durata del lavoro.
                  </p>
                </div>
              </div>

            </div>

            {/* Colonna Destra: Specifiche e Invio (7 Colonne) */}
            <div className="lg:col-span-7">
              <div className="p-1.5 rounded-[2rem] bg-white/[0.03] border border-white/10 ring-1 ring-white/5 shadow-2xl">
                <div className="p-6 sm:p-8 rounded-[calc(2rem-0.375rem)] bg-slate-950/85 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] space-y-6">
                  
                  <div>
                    <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-[0.2em] font-semibold">
                      Specifiche Tecniche
                    </span>
                    <h2 className="text-xl font-bold text-white tracking-tight mt-0.5">
                      Dati della Commessa
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Definisci i requisiti di produzione per ricevere la quotazione finale ottimizzata.
                    </p>
                  </div>

                  {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                    
                    {/* Contatti */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-slate-300 font-medium mb-1.5">
                          Nome e Cognome / Azienda *
                        </label>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={e => setName(e.target.value)}
                          placeholder="Es. Marco Rossi"
                          className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-medium mb-1.5">
                          Telefono / WhatsApp o Email *
                        </label>
                        <input
                          type="text"
                          required
                          value={contact}
                          onChange={e => setContact(e.target.value)}
                          placeholder="Es. 333 1234567 o email@..."
                          className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        />
                      </div>
                    </div>

                    {/* Nome Pezzo */}
                    <div>
                      <label className="block text-slate-300 font-medium mb-1.5">
                        Nome del Pezzo / Progetto *
                      </label>
                      <input
                        type="text"
                        required
                        value={projectName}
                        onChange={e => setProjectName(e.target.value)}
                        placeholder="Es. Supporto telefono da scrivania, Manopola ricambio..."
                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      />
                    </div>

                    {/* Specifiche Materiale & Quantità */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div>
                        <label className="block text-slate-300 font-medium mb-1.5">
                          Materiale Preferito
                        </label>
                        <select
                          value={material}
                          onChange={e => setMaterial(e.target.value)}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="PLA Standard">PLA Standard (Uso generale)</option>
                          <option value="PETG Resistente">PETG (Meccanico / Termico)</option>
                          <option value="TPU Flessibile">TPU Flessibile / Gomma</option>
                          <option value="ABS / ASA">ASA / ABS (Resistente UV esterno)</option>
                          <option value="Consigliato dal Maker">Consigliato dal Maker</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-medium mb-1.5">
                          Colore Desiderato
                        </label>
                        <input
                          type="text"
                          value={color}
                          onChange={e => setColor(e.target.value)}
                          placeholder="Es. Nero, Bianco..."
                          className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-medium mb-1.5">
                          Quantità (Pezzi)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={quantity}
                          onChange={e => setQuantity(e.target.value)}
                          className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono"
                        />
                      </div>
                    </div>

                    {/* Descrizione / Destinazione d'uso */}
                    <div>
                      <label className="block text-slate-300 font-medium mb-1.5">
                        Note applicative e requisiti d&apos;uso (facoltativo)
                      </label>
                      <textarea
                        rows={3}
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Es. Il componente deve resistere all'esterno, o richiede tolleranze dimensionali strette..."
                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all leading-relaxed"
                      />
                    </div>

                    {/* BOX RIEPILOGO STIMA ISTANTANEA */}
                    {activeModelInfo && estimate ? (
                      <div className="p-5 bg-gradient-to-br from-emerald-950/40 via-slate-950 to-slate-950 border border-emerald-500/40 rounded-2xl space-y-3 shadow-xl">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.75} /> Stima Economica Indicativa
                          </span>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-3 py-0.5 rounded-full font-semibold border border-emerald-500/30">
                            {activeModelInfo.badge}
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 pt-3 border-t border-white/10">
                          <div>
                            <span className="text-xs text-slate-400 block">Totale stimato:</span>
                            <div className="text-3xl font-black text-white font-mono flex items-baseline gap-2">
                              <span className="text-emerald-400">€{estimate.total.toFixed(2)}</span>
                              <span className="text-xs text-slate-400 font-normal">
                                {numQuantity > 1 ? `(${numQuantity} pezzi a ~€${estimate.singlePrice.toFixed(2)} cad.)` : '(1 pezzo)'}
                              </span>
                            </div>
                          </div>

                          <div className="text-xs text-slate-300 space-y-1 sm:text-right bg-white/[0.03] px-3.5 py-2.5 rounded-xl border border-white/10 w-full sm:w-auto font-mono">
                            <div>⏱️ Stampa: <strong className="text-white">{activeModelInfo.hours}h {activeModelInfo.mins}m</strong> {numQuantity > 1 ? `x ${numQuantity}pz` : ''}</div>
                            <div>⚖️ Filamento: <strong className="text-white">{activeModelInfo.weight * numQuantity}g</strong> ({material || activeModelInfo.material})</div>
                            {activeModelInfo.needAms && <div className="text-amber-300 text-[11px]">🎨 Multi-colore AMS</div>}
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-400 italic pt-1 leading-relaxed">
                          La stima considera tempi macchina e consumo estrusione. Il laboratorio confermerà la fattibilità prima della messa in stampa.
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400/60" strokeWidth={1.75} /> Stima Economica
                          </span>
                          <span className="text-[10px] bg-white/[0.05] text-slate-500 px-3 py-0.5 rounded-full border border-white/10">
                            In attesa file 3D
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Incolla un link MakerWorld oppure carica un file <strong>.3MF</strong> nel pannello a sinistra per calcolare istantaneamente i costi e i tempi di lavorazione.
                        </p>
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => handleMakerWorldUrlChange('https://makerworld.com/it/models/2464216-bambu-lab-a1-series-ams-hub-mount-bracket?from=recommend#profileId-2705075')}
                            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full transition-colors inline-flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />
                            <span>Carica modello di test MakerWorld</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Pulsante Nested Button-in-Button */}
                    <div className="pt-3">
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 pl-6 pr-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm rounded-full transition-all shadow-xl shadow-emerald-950/50 flex items-center justify-between active:scale-[0.98] group/btn"
                      >
                        <span>
                          {loading 
                            ? 'Invio richiesta in corso...' 
                            : (activeModelInfo && estimate) 
                              ? `Invia Richiesta con Stima (~€${estimate.total.toFixed(2)})` 
                              : 'Invia Richiesta al Laboratorio'}
                        </span>
                        <div className="w-7 h-7 rounded-full bg-slate-950/15 flex items-center justify-center group-hover/btn:translate-x-1 transition-transform">
                          <Send className="w-3.5 h-3.5 text-slate-950" strokeWidth={2} />
                        </div>
                      </button>
                    </div>

                  </form>

                </div>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Minimalistic Clean Footer */}
      <footer className="max-w-7xl mx-auto w-full pt-4 pb-2 text-center text-[11px] text-slate-600 border-t border-white/5 flex-shrink-0">
        <p>Preventivi 3D • Piattaforma di fabbricazione digitale FDM / SLA per maker e laboratori</p>
      </footer>

    </div>
  );
}
