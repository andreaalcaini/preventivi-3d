'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  Package, Send, CheckCircle2, AlertCircle, 
  ExternalLink, Layers, Sparkles, Lock, ArrowRight, Loader2, Copy, UploadCloud, X
} from 'lucide-react';
import MakerWorldModelViewer from '@/components/MakerWorldModelViewer';
import type { MakerWorldPlateInfo, MakerWorldPicture } from '@/app/api/makerworld/route';
import { parseSlicerFiles, isSlicerFileName } from '@/lib/slicerParser';

const MODEL_FILE_ACCEPT = '.stl,.3mf';

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

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
  // Più file 3D per richiesta: quello attivo è mostrato nel viewer, le quote sono salvate per file
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [dimensionsByFile, setDimensionsByFile] = useState<Record<string, { x: number; y: number; z: number }>>({});
  const [fileError, setFileError] = useState('');

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

  const slicerRequestRef = useRef(0);
  const activeFile = selectedFiles[activeFileIndex] || null;
  const stlDimensions = selectedFiles.length > 0 ? dimensionsByFile[fileKey(selectedFiles[0])] || null : null;

  const addFiles = (incoming: File[]) => {
    const valid = incoming.filter(f => /\.(stl|3mf)$/i.test(f.name));
    setFileError(valid.length < incoming.length ? 'Alcuni file sono stati ignorati: formati supportati .STL e .3MF' : '');
    if (valid.length === 0) return;

    const known = new Set(selectedFiles.map(fileKey));
    const fresh = valid.filter(f => !known.has(fileKey(f)));
    const next = [...selectedFiles, ...fresh];
    // Mostra nel viewer il primo file appena aggiunto (o quello già presente se duplicato)
    const target = fresh[0] || valid[0];
    setSelectedFiles(next);
    setActiveFileIndex(next.findIndex(f => fileKey(f) === fileKey(target)));
    if (fresh.length > 0) refreshSlicerInfo(next);

    if (!projectName) {
      const cleanName = valid[0].name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
      setProjectName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }
  };

  const removeFile = (index: number) => {
    const removed = selectedFiles[index];
    const next = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(next);
    refreshSlicerInfo(next);
    setDimensionsByFile(prev => {
      const next = { ...prev };
      delete next[fileKey(removed)];
      return next;
    });
    setActiveFileIndex(prev => (index < prev ? prev - 1 : index === prev ? 0 : prev));
  };

  // Ricalcola tempo/peso sommando tutti i file slicer (.3mf con G-Code integrato) presenti
  const refreshSlicerInfo = (files: File[]) => {
    const requestId = ++slicerRequestRef.current;
    const slicerFiles = files.filter(f => isSlicerFileName(f.name));
    if (slicerFiles.length === 0) {
      setSlicerInfo(null);
      return;
    }

    parseSlicerFiles(slicerFiles).then(({ merged, parsed, errors }) => {
      // Ignora risultati superati da un'aggiunta/rimozione successiva
      if (requestId !== slicerRequestRef.current) return;
      errors.forEach(er => console.warn(`File 3D senza dati di slicing (${er.fileName}):`, er.message));
      if (!merged || (merged.hours === 0 && merged.mins === 0 && merged.weightGrams === 0)) {
        setSlicerInfo(null);
        return;
      }
      setSlicerInfo({
        title: parsed.length > 1 ? `${parsed.length} file slicer` : parsed[0].fileName.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
        printHours: merged.hours,
        printMinutes: merged.mins,
        weightGrams: merged.weightGrams,
        material: merged.material,
        needAms: Boolean(merged.multiColor),
        slicerName: merged.slicerName
      });
      if (merged.material) {
        setMaterial(merged.material);
      }
    });
  };

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

  // "Richiedi di nuovo" dal tracking: /richiedi-preventivo?riordina=<codice>
  const [reorderFrom, setReorderFrom] = useState<string | null>(null);
  const reorderLoaded = useRef(false);
  useEffect(() => {
    if (reorderLoaded.current) return;
    reorderLoaded.current = true;
    const code = new URLSearchParams(window.location.search).get('riordina');
    if (!code) return;
    (async () => {
      try {
        const res = await fetch(`/api/public/order?code=${encodeURIComponent(code)}`);
        if (!res.ok) return;
        const { order } = await res.json();
        if (!order) return;
        setReorderFrom(order.id);
        setProjectName(order.name || '');
        if (order.material) setMaterial(order.material);
        if (order.color) setColor(order.color);
        setQuantity(String(order.quantity || 1));
        setDescription(`Riordino dell'ordine ${order.id}.`);
        if (order.makerWorldUrl) {
          await handleMakerWorldUrlChange(order.makerWorldUrl);
          setProjectName(order.name || '');
        }
        const files: File[] = [];
        for (const f of order.modelFiles || []) {
          const r = await fetch(f.url);
          if (!r.ok) continue;
          const blob = await r.blob();
          files.push(new File([blob], f.fileName || 'modello.stl', { type: blob.type || 'application/octet-stream' }));
        }
        if (files.length) addFiles(files);
      } catch {
        // se il riordino non si carica, il modulo resta vuoto e utilizzabile
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const modelFiles: Array<{ url: string; fileName: string; stlDimensions: { x: number; y: number; z: number } | null }> = [];
      const failedUploads: string[] = [];

      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch('/api/public/model', {
          method: 'POST',
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData.success) {
          modelFiles.push({
            url: uploadData.url,
            fileName: uploadData.fileName,
            stlDimensions: dimensionsByFile[fileKey(file)] || null
          });
        } else {
          failedUploads.push(file.name);
        }
      }

      if (failedUploads.length > 0) {
        setError(`Caricamento non riuscito per: ${failedUploads.join(', ')}. Rimuovi il file o riprova.`);
        return;
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
          modelUrl: modelFiles[0]?.url || '',
          modelFileName: modelFiles[0]?.fileName || '',
          modelFiles,
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
    <div className="min-h-[100dvh] bg-sunken text-ink p-3 sm:p-6 font-sans flex flex-col justify-between relative">
      
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col gap-6">
        
        <header className="flex items-center justify-between gap-3 h-16">
          <Link href="/login" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-canvas">
              <Package className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="text-sm font-semibold tracking-tight text-ink">Preventivi 3D</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/ordine" className="btn btn-secondary btn-sm">
              Segui un ordine
            </Link>
            <Link
              href="/login"
              className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-ink-muted hover:text-ink"
              title="Area operatori"
            >
              <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="sr-only">Area operatori</span>
            </Link>
          </div>
        </header>

        {!successData && (
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink">Richiedi un preventivo</h1>
            <p className="mt-2 text-ink-muted max-w-[60ch]">Carica i file del modello, scegli materiale e quantità: ricevi subito una stima e il laboratorio ti risponde con il prezzo definitivo.</p>
            {reorderFrom && (
              <p className="mt-3 inline-flex rounded-lg border border-accent-line bg-accent-soft px-3 py-1.5 text-sm text-accent-ink">
                Riordino dell&apos;ordine {reorderFrom}: file e impostazioni sono già caricati, controlla e invia.
              </p>
            )}
          </div>
        )}

        {/* Schermata di Successo con Ricevuta Digitale Aptica */}
        {successData ? (
          <div className="flex-1 flex items-center justify-center py-6">
            <div className="rounded-xl bg-surface border border-accent-line shadow-sm max-w-xl w-full">
              <div className="p-8 sm:p-10 text-center space-y-6">
                
                <div className="w-16 h-16 bg-accent-soft border border-accent-line rounded-xl flex items-center justify-center text-accent-ink mx-auto ">
                  <CheckCircle2 className="w-8 h-8" strokeWidth={2} />
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-mono text-accent-ink font-semibold">
                    Ricezione Confermata
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
                    Richiesta Inviata al Laboratorio
                  </h2>
                  <p className="text-xs sm:text-sm text-ink-muted max-w-md mx-auto leading-relaxed">
                    Abbiamo ricevuto le specifiche per <strong>{projectName}</strong>. Il nostro team analizzerà la geometria del pezzo e ti risponderà al recapito <strong>{contact}</strong>.
                  </p>
                </div>

                {/* Codice Tracciamento Box con Copia Rapida */}
                <div className="p-4 bg-raised border border-line rounded-xl max-w-md mx-auto space-y-2">
                  <span className="text-[11px] text-ink-faint font-mono font-bold block">
                    Codice Univoco Commessa
                  </span>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl sm:text-3xl font-mono font-semibold text-accent-ink">
                      #{successData.orderId}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="p-1.5 rounded-lg bg-muted hover:bg-muted text-ink-muted hover:text-ink transition-colors"
                      title="Copia codice negli appunti"
                    >
                      {copiedCode ? <CheckCircle2 className="w-4 h-4 text-accent-ink" /> : <Copy className="w-4 h-4" strokeWidth={1.75} />}
                    </button>
                  </div>
                </div>

                {estimate && (
                  <div className="p-4 bg-accent-soft border border-accent-line rounded-xl max-w-md mx-auto text-xs text-ink-muted space-y-1.5">
                    <span className="text-[11px] text-accent-ink font-mono font-bold block">
                      Stima Economica Registrata
                    </span>
                    <span className="text-2xl font-semibold text-ink font-mono block">
                      ~€{estimate.total.toFixed(2)}
                    </span>
                    <span className="text-[11px] text-ink-muted block">
                      {numQuantity} {numQuantity === 1 ? 'pezzo' : 'pezzi'} • Tempo: {mwInfo?.printHours || activeModelInfo?.hours || 0}h {mwInfo?.printMinutes || activeModelInfo?.mins || 0}m • Filamento: ~{(mwInfo?.weightGrams || activeModelInfo?.weight || 0) * numQuantity}g ({material || mwInfo?.material})
                    </span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-2">
                  <Link
                    href={successData.trackingUrl}
                    className="btn btn-primary w-full sm:w-auto justify-center rounded-lg"
                  >
                    <span>Segui Avanzamento Ordine</span>
                      <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
                  </Link>
                  <button
                    onClick={() => {
                      setSuccessData(null);
                      setProjectName('');
                      setDescription('');
                    }}
                    className="w-full sm:w-auto px-6 py-3 bg-raised hover:bg-muted text-ink-muted font-medium text-xs rounded-lg border border-line transition-colors"
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
              
              <div className="rounded-xl bg-surface border border-line shadow-sm">
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-line">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-accent-ink" strokeWidth={1.75} />
                      <h2 className="text-sm font-bold text-ink tracking-tight">
                        Anteprima Modello 3D
                      </h2>
                    </div>
                    <span className="text-[11px] font-mono text-ink-faint">
                      WebGL & G-Code
                    </span>
                  </div>

                  <p className="text-xs text-ink-muted leading-relaxed">
                    Trascina qui uno o più file <strong>.STL</strong> o <strong>.3MF</strong> per ispezionare le quote millimetriche o visualizzare i piatti MakerWorld.
                  </p>

                  {/* 3D Model & MakerWorld Viewer */}
                  <MakerWorldModelViewer 
                    makerWorldUrl={makerWorldUrl}
                    modelTitle={activeModelInfo?.title}
                    coverUrl={activeModelInfo?.coverUrl}
                    authorName={activeModelInfo?.author}
                    plates={mwInfo?.plates}
                    pictures={mwInfo?.pictures}
                    modelFile={activeFile}
                    modelFileName={activeFile?.name}
                    material={material || activeModelInfo?.material || 'PLA'}
                    height={320}
                    allowUpload={true}
                    onDimensionsCalculated={(dim) => {
                      // I .gcode.3mf senza mesh restituiscono 0×0×0: non sono quote utili
                      if (!activeFile || (dim.x === 0 && dim.y === 0 && dim.z === 0)) return;
                      const key = fileKey(activeFile);
                      setDimensionsByFile(prev => {
                        const old = prev[key];
                        if (old && old.x === dim.x && old.y === dim.y && old.z === dim.z) return prev;
                        return { ...prev, [key]: { x: dim.x, y: dim.y, z: dim.z } };
                      });
                    }}
                    onFileSelected={(file) => addFiles([file])}
                  />

                  {/* Elenco file caricati: click per visualizzarlo nel viewer */}
                  <div className="space-y-2">
                    {selectedFiles.length > 0 && (
                      <ul className="space-y-1.5">
                        {selectedFiles.map((file, index) => {
                          const dims = dimensionsByFile[fileKey(file)];
                          const isActive = index === activeFileIndex;
                          return (
                            <li
                              key={fileKey(file)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${
                                isActive
                                  ? 'bg-accent-soft border-accent-line text-accent-ink'
                                  : 'bg-raised border-line text-ink-muted hover:border-line-strong'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setActiveFileIndex(index)}
                                className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer"
                                title="Mostra nel viewer 3D"
                              >
                                <Layers className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.75} />
                                <span className="truncate font-medium">{file.name}</span>
                                {dims && (
                                  <span className="ml-auto font-mono text-[10px] text-ink-faint flex-shrink-0 hidden sm:inline">
                                    {dims.x} × {dims.y} × {dims.z} mm
                                  </span>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeFile(index)}
                                className="p-1 rounded-lg text-ink-faint hover:text-danger-ink hover:bg-danger-soft transition-colors flex-shrink-0 cursor-pointer"
                                title="Rimuovi file"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    <label className="cursor-pointer w-full px-3 py-2 rounded-xl border border-dashed border-accent-line hover:border-accent-line bg-accent-soft hover:bg-accent-soft text-accent-ink text-xs font-semibold flex items-center justify-center gap-1.5 transition-all">
                      <UploadCloud className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>{selectedFiles.length > 0 ? 'Aggiungi altri file 3D' : 'Carica uno o più file 3D'}</span>
                      <input
                        type="file"
                        accept={MODEL_FILE_ACCEPT}
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          addFiles(Array.from(e.target.files || []));
                          e.target.value = '';
                        }}
                      />
                    </label>

                    {fileError && (
                      <p className="text-[11px] text-warn-ink flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        {fileError}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Box Link MakerWorld in Doppelrand */}
              <div className="rounded-xl bg-surface border border-line shadow-sm">
                <div className="p-5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.75} />
                      Link Progetto MakerWorld
                    </label>
                    {makerWorldUrl.includes('makerworld.com/') && (
                      <span className="text-[10px] bg-accent-soft text-accent-ink border border-accent-line px-2.5 py-0.5 rounded-full font-mono font-medium">
                        Profilo Riconosciuto
                      </span>
                    )}
                  </div>
                  
                  <input
                    type="url"
                    value={makerWorldUrl}
                    onChange={e => handleMakerWorldUrlChange(e.target.value)}
                    placeholder="https://makerworld.com/it/models/..."
                    className="w-full bg-surface border border-line-strong rounded-xl p-3 text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 transition-all font-mono"
                  />

                  {loadingMw && (
                    <div className="flex items-center gap-2 text-xs text-accent-ink animate-pulse pt-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Estrazione specifiche tecniche e calcolo stima in corso...</span>
                    </div>
                  )}

                  {mwError && (
                    <p className="text-xs text-danger-ink bg-danger-soft border border-danger-line p-2.5 rounded-xl">
                      {mwError}
                    </p>
                  )}

                  {activeModelInfo && !loadingMw && (
                    <div className="p-4 bg-accent-soft border border-accent-line rounded-xl space-y-3 text-xs">
                      <div className="flex items-center gap-3">
                        {activeModelInfo.coverUrl && (
                          <img 
                            src={activeModelInfo.coverUrl} 
                            alt={activeModelInfo.title} 
                            className="w-12 h-12 object-cover rounded-xl border border-line flex-shrink-0 bg-surface shadow-sm" 
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="text-[11px] text-accent-ink font-mono font-bold block">
                            {activeModelInfo.badge}
                          </span>
                          <p className="text-ink font-bold truncate text-xs mt-0.5">{activeModelInfo.title}</p>
                          {activeModelInfo.author && <p className="text-[10px] text-ink-muted truncate">di {activeModelInfo.author}</p>}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-line flex items-center justify-between">
                        <div className="text-[11px] text-ink-muted font-mono">
                          <span>~{activeModelInfo.hours}h {activeModelInfo.mins}m</span>
                          <span className="mx-2">•</span>
                          <span>~{activeModelInfo.weight}g</span>
                        </div>
                        {estimate && (
                          <div className="text-right">
                            <span className="text-[10px] text-ink-muted block leading-tight">Stima pezzo:</span>
                            <span className="text-sm font-bold text-accent-ink font-mono">
                              ~€{estimate.singlePrice.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-ink-faint leading-relaxed">
                    Incollando l&apos;URL, il sistema estrae in automatico i piatti, il consumo di filo e la durata del lavoro.
                  </p>
                </div>
              </div>

            </div>

            {/* Colonna Destra: Specifiche e Invio (7 Colonne) */}
            <div className="lg:col-span-7">
              <div className="rounded-xl bg-surface border border-line shadow-sm">
                <div className="p-6 sm:p-8 space-y-6">
                  
                  <div>
                    <span className="text-[11px] font-mono text-accent-ink font-semibold">
                      Specifiche Tecniche
                    </span>
                    <h2 className="text-xl font-bold text-ink tracking-tight mt-0.5">
                      Dati della Commessa
                    </h2>
                    <p className="text-xs text-ink-muted mt-1">
                      Definisci i requisiti di produzione per ricevere la quotazione finale ottimizzata.
                    </p>
                  </div>

                  {error && (
                    <div className="p-4 bg-danger-soft border border-danger-line rounded-xl text-danger-ink text-xs flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                    
                    {/* Contatti */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-ink-muted font-medium mb-1.5">
                          Nome e Cognome / Azienda *
                        </label>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={e => setName(e.target.value)}
                          placeholder="Es. Marco Rossi"
                          className="w-full bg-surface border border-line-strong rounded-xl p-3 text-ink focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-ink-muted font-medium mb-1.5">
                          Telefono / WhatsApp o Email *
                        </label>
                        <input
                          type="text"
                          required
                          value={contact}
                          onChange={e => setContact(e.target.value)}
                          placeholder="Es. 333 1234567 o email@..."
                          className="w-full bg-surface border border-line-strong rounded-xl p-3 text-ink focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 transition-all"
                        />
                      </div>
                    </div>

                    {/* Nome Pezzo */}
                    <div>
                      <label className="block text-ink-muted font-medium mb-1.5">
                        Nome del Pezzo / Progetto *
                      </label>
                      <input
                        type="text"
                        required
                        value={projectName}
                        onChange={e => setProjectName(e.target.value)}
                        placeholder="Es. Supporto telefono da scrivania, Manopola ricambio..."
                        className="w-full bg-surface border border-line-strong rounded-xl p-3 text-ink focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 transition-all"
                      />
                    </div>

                    {/* Specifiche Materiale & Quantità */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div>
                        <label className="block text-ink-muted font-medium mb-1.5">
                          Materiale Preferito
                        </label>
                        <select
                          value={material}
                          onChange={e => setMaterial(e.target.value)}
                          className="w-full bg-surface border border-line-strong rounded-xl p-3 text-ink focus:outline-none focus:border-accent"
                        >
                          <option value="PLA Standard">PLA Standard (Uso generale)</option>
                          <option value="PETG Resistente">PETG (Meccanico / Termico)</option>
                          <option value="TPU Flessibile">TPU Flessibile / Gomma</option>
                          <option value="ABS / ASA">ASA / ABS (Resistente UV esterno)</option>
                          <option value="Consigliato dal Maker">Consigliato dal Maker</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-ink-muted font-medium mb-1.5">
                          Colore Desiderato
                        </label>
                        <input
                          type="text"
                          value={color}
                          onChange={e => setColor(e.target.value)}
                          placeholder="Es. Nero, Bianco..."
                          className="w-full bg-surface border border-line-strong rounded-xl p-3 text-ink focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-ink-muted font-medium mb-1.5">
                          Quantità (Pezzi)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={quantity}
                          onChange={e => setQuantity(e.target.value)}
                          className="w-full bg-surface border border-line-strong rounded-xl p-3 text-ink focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 transition-all font-mono"
                        />
                      </div>
                    </div>

                    {/* Descrizione / Destinazione d'uso */}
                    <div>
                      <label className="block text-ink-muted font-medium mb-1.5">
                        Note applicative e requisiti d&apos;uso (facoltativo)
                      </label>
                      <textarea
                        rows={3}
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Es. Il componente deve resistere all'esterno, o richiede tolleranze dimensionali strette..."
                        className="w-full bg-surface border border-line-strong rounded-xl p-3 text-ink focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 transition-all leading-relaxed"
                      />
                    </div>

                    {/* BOX RIEPILOGO STIMA ISTANTANEA */}
                    {activeModelInfo && estimate ? (
                      <div className="p-5 border border-accent-line rounded-xl space-y-3 shadow-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-accent-ink flex items-center gap-1.5 font-mono">
                            <Sparkles className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.75} /> Stima Economica Indicativa
                          </span>
                          <span className="text-[10px] bg-accent-soft text-accent-ink px-3 py-0.5 rounded-full font-semibold border border-accent-line">
                            {activeModelInfo.badge}
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 pt-3 border-t border-line">
                          <div>
                            <span className="text-xs text-ink-muted block">Totale stimato:</span>
                            <div className="text-3xl font-semibold text-ink font-mono flex items-baseline gap-2">
                              <span className="text-accent-ink">€{estimate.total.toFixed(2)}</span>
                              <span className="text-xs text-ink-muted font-normal">
                                {numQuantity > 1 ? `(${numQuantity} pezzi a ~€${estimate.singlePrice.toFixed(2)} cad.)` : '(1 pezzo)'}
                              </span>
                            </div>
                          </div>

                          <div className="text-xs text-ink-muted space-y-1 sm:text-right bg-raised px-3.5 py-2.5 rounded-xl border border-line w-full sm:w-auto font-mono">
                            <div>Stampa: <strong className="text-ink">{activeModelInfo.hours}h {activeModelInfo.mins}m</strong> {numQuantity > 1 ? `x ${numQuantity}pz` : ''}</div>
                            <div>Filamento: <strong className="text-ink">{activeModelInfo.weight * numQuantity}g</strong> ({material || activeModelInfo.material})</div>
                            {activeModelInfo.needAms && <div className="text-warn-ink text-[11px]">Multicolore AMS</div>}
                          </div>
                        </div>

                        <p className="text-[11px] text-ink-muted italic pt-1 leading-relaxed">
                          La stima considera tempi macchina e consumo estrusione. Il laboratorio confermerà la fattibilità prima della messa in stampa.
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 bg-raised border border-dashed border-line rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-ink-muted flex items-center gap-1.5 font-mono">
                            <Sparkles className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.75} /> Stima Economica
                          </span>
                          <span className="text-[10px] bg-raised text-ink-faint px-3 py-0.5 rounded-full border border-line">
                            In attesa file 3D
                          </span>
                        </div>
                        <p className="text-xs text-ink-muted leading-relaxed">
                          Incolla un link MakerWorld oppure carica un file <strong>.3MF</strong> nel pannello a sinistra per calcolare istantaneamente i costi e i tempi di lavorazione.
                        </p>
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => handleMakerWorldUrlChange('https://makerworld.com/it/models/2464216-bambu-lab-a1-series-ams-hub-mount-bracket?from=recommend#profileId-2705075')}
                            className="text-xs text-accent-ink hover:text-accent-ink font-medium bg-accent-soft border border-accent-line px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5"
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
                        className="btn btn-primary w-full disabled:opacity-50 justify-between rounded-lg"
                      >
                        <span>
                          {loading 
                            ? 'Invio richiesta in corso...' 
                            : (activeModelInfo && estimate) 
                              ? `Invia Richiesta con Stima (~€${estimate.total.toFixed(2)})` 
                              : 'Invia Richiesta al Laboratorio'}
                        </span>
                          <Send className="w-4 h-4" strokeWidth={2} />
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
      <footer className="max-w-7xl mx-auto w-full pt-4 pb-2 text-center text-[11px] text-ink-faint border-t border-line flex-shrink-0">
        <p>Preventivi 3D • Piattaforma di fabbricazione digitale FDM / SLA per maker e laboratori</p>
      </footer>

    </div>
  );
}
