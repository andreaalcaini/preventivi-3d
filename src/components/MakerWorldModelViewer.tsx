'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layers, 
  Sparkles, 
  Box as BoxIcon, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  ImageIcon,
  Maximize2,
  Download
} from 'lucide-react';
import StlViewer, { ModelDimensions } from './StlViewer';
import type { 
  MakerWorldPlateInfo, 
  MakerWorldPicture, 
  MakerWorldProfileSummary, 
  MakerWorldResponseData 
} from '@/app/api/makerworld/route';

export interface MakerWorldModelViewerProps {
  makerWorldUrl?: string | null;
  modelTitle?: string;
  coverUrl?: string;
  authorName?: string;
  plates?: MakerWorldPlateInfo[];
  pictures?: MakerWorldPicture[];
  modelUrl?: string | null;
  modelFileName?: string | null;
  material?: string;
  height?: number;
  allowUpload?: boolean;
  onFileSelected?: (file: File) => void;
  onDimensionsCalculated?: (dim: ModelDimensions) => void;
  onRemoveModel?: () => void;
  autoLoadMakerWorld?: boolean;
  className?: string;
}

export default function MakerWorldModelViewer({
  makerWorldUrl,
  modelTitle,
  coverUrl,
  authorName,
  plates: initialPlates,
  pictures: initialPictures,
  modelUrl,
  modelFileName,
  material = 'PLA',
  height = 320,
  allowUpload = true,
  onFileSelected,
  onDimensionsCalculated,
  onRemoveModel,
  autoLoadMakerWorld = true,
  className = ''
}: MakerWorldModelViewerProps) {
  // Dati MakerWorld dinamici se non passati come prop
  const [fetchedPlates, setFetchedPlates] = useState<MakerWorldPlateInfo[] | null>(null);
  const [fetchedPictures, setFetchedPictures] = useState<MakerWorldPicture[] | null>(null);
  const [fetchedTitle, setFetchedTitle] = useState<string>('');
  const [fetchedCover, setFetchedCover] = useState<string>('');
  const [loadingMw, setLoadingMw] = useState<boolean>(false);
  const [mwError, setMwError] = useState<string>('');

  // Unisci le prop con i dati scaricati via API
  const plates = initialPlates && initialPlates.length > 0 ? initialPlates : fetchedPlates;
  const pictures = initialPictures && initialPictures.length > 0 ? initialPictures : fetchedPictures;
  const displayTitle = modelTitle || fetchedTitle;
  const displayCover = coverUrl || fetchedCover;

  // Stato modalità: 'plate' | 'gallery' | 'mesh'
  const [viewMode, setViewMode] = useState<'plate' | 'gallery' | 'mesh'>('mesh');
  const [activePlateIndex, setActivePlateIndex] = useState<number>(1);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState<number>(0);

  // Auto-fetch MakerWorld se viene fornito un link ma non le plate/foto
  useEffect(() => {
    if (!autoLoadMakerWorld) return;
    if (!makerWorldUrl || !makerWorldUrl.includes('makerworld.com/')) {
      setFetchedPlates(null);
      setFetchedPictures(null);
      setFetchedTitle('');
      setFetchedCover('');
      return;
    }

    // Se abbiamo già plates e pictures passate da prop, non refetchare
    if (initialPlates && initialPlates.length > 0 && initialPictures && initialPictures.length > 0) {
      return;
    }

    let isMounted = true;
    setLoadingMw(true);
    setMwError('');

    fetch(`/api/makerworld?url=${encodeURIComponent(makerWorldUrl.trim())}`)
      .then(res => res.json())
      .then((data: MakerWorldResponseData) => {
        if (!isMounted) return;
        if (data.success) {
          setFetchedTitle(data.modelTitle || '');
          setFetchedCover(data.coverUrl || '');
          if (data.selectedProfile?.plates && data.selectedProfile.plates.length > 0) {
            setFetchedPlates(data.selectedProfile.plates);
            setActivePlateIndex(data.selectedProfile.plates[0].index);
          }
          if (data.pictures && data.pictures.length > 0) {
            setFetchedPictures(data.pictures);
          }
        } else {
          setMwError('Impossibile caricare anteprima MakerWorld');
        }
      })
      .catch(err => {
        if (!isMounted) return;
        console.error('Errore caricamento MakerWorld viewer:', err);
        setMwError('Errore di connessione a MakerWorld');
      })
      .finally(() => {
        if (isMounted) setLoadingMw(false);
      });

    return () => {
      isMounted = false;
    };
  }, [makerWorldUrl, autoLoadMakerWorld, initialPlates, initialPictures]);

  // Seleziona la modalità predefinita più sensata all'arrivo dei dati
  useEffect(() => {
    if (plates && plates.length > 0) {
      setViewMode('plate');
    } else if (pictures && pictures.length > 0) {
      setViewMode('gallery');
    } else if (modelUrl || modelFileName) {
      setViewMode('mesh');
    }
  }, [plates, pictures, modelUrl, modelFileName]);

  const hasPlates = Boolean(plates && plates.length > 0);
  const hasPictures = Boolean(pictures && pictures.length > 0);
  const hasMesh = Boolean(modelUrl || modelFileName || allowUpload);

  const currentPlate = useMemo(() => {
    if (!plates || plates.length === 0) return null;
    return plates.find(p => p.index === activePlateIndex) || plates[0];
  }, [plates, activePlateIndex]);

  const currentPicture = useMemo(() => {
    if (!pictures || pictures.length === 0) {
      return displayCover ? { url: displayCover, name: displayTitle || 'Copertina' } : null;
    }
    return pictures[activeGalleryIndex] || pictures[0];
  }, [pictures, activeGalleryIndex, displayCover, displayTitle]);

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col ${className}`}>
      {/* Barra Superiore: Titolo & Switcher Modalità */}
      <div className="p-2.5 bg-slate-950/70 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 truncate">
            <BoxIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="truncate">{displayTitle || modelFileName || 'Visualizzatore Modello'}</span>
          </span>

          {loadingMw && (
            <span className="text-[10px] text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>MakerWorld...</span>
            </span>
          )}
        </div>

        {/* Tab Switcher: [ 📐 Piatto 3D ] [ 📸 Foto & Renders ] [ 🧊 Mesh 3D ] */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg flex-wrap">
          {hasPlates && (
            <button
              type="button"
              onClick={() => setViewMode('plate')}
              className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'plate'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3 h-3 text-emerald-400" />
              <span>Piatto 3D</span>
            </button>
          )}

          {hasPictures && (
            <button
              type="button"
              onClick={() => setViewMode('gallery')}
              className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'gallery'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ImageIcon className="w-3 h-3 text-purple-400" />
              <span>Foto ({pictures?.length || 0})</span>
            </button>
          )}

          {hasMesh && (
            <button
              type="button"
              onClick={() => setViewMode('mesh')}
              className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'mesh'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BoxIcon className="w-3 h-3 text-cyan-400" />
              <span>Mesh 3D {modelFileName ? '✓' : ''}</span>
            </button>
          )}
        </div>

        {modelFileName && onRemoveModel && (
          <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-emerald-400 text-[11px]">
            <span className="font-medium truncate max-w-[120px]" title={modelFileName}>
              📎 {modelFileName}
            </span>
            <button
              type="button"
              onClick={onRemoveModel}
              className="hover:text-red-400 text-slate-400 font-bold ml-1 cursor-pointer"
              title="Rimuovi file 3D"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Area Contenuto Visualizzatore */}
      <div className="relative flex-1 bg-slate-950 flex flex-col justify-center">
        {/* VISTA 1: PIATTO 3D CON RENDERING DELLA LASTRA DI STAMPA */}
        {viewMode === 'plate' && currentPlate && (
          <div className="space-y-2 p-2">
            <div 
              style={{ minHeight: `${height}px` }} 
              className="relative bg-slate-950 border border-slate-800/80 rounded-xl overflow-hidden flex flex-col items-center justify-center p-3 select-none"
            >
              {/* Texture reticolo del piatto di stampa */}
              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:18px_18px]" />

              {/* Immagine Piatto 3D */}
              {(() => {
                const imgUrl = currentPlate.topPictureUrl || currentPlate.thumbnailUrl || displayCover;
                return imgUrl ? (
                  <div className="relative z-10 flex flex-col items-center max-h-full max-w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={imgUrl} 
                      alt={currentPlate.name || `Piatto ${currentPlate.index}`}
                      className="max-h-[250px] w-auto object-contain rounded-lg shadow-2xl drop-shadow-[0_12px_24px_rgba(0,0,0,0.85)] transition-transform hover:scale-[1.02]" 
                    />
                  </div>
                ) : (
                  <div className="text-slate-500 text-xs py-12 flex flex-col items-center gap-1.5">
                    <Layers className="w-8 h-8 opacity-40" />
                    <span>Render del piatto non disponibile per questo profilo</span>
                  </div>
                );
              })()}

              {/* Badge info sopra l'immagine: Nome piatto, peso stimato, tempo */}
              <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 flex-wrap">
                <span className="bg-slate-900/90 backdrop-blur-md border border-slate-700 px-2 py-0.5 rounded-md text-[11px] font-bold text-white shadow">
                  {currentPlate.name || `Piatto ${currentPlate.index}`}
                </span>
                {currentPlate.weightGrams > 0 && (
                  <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold">
                    ~{currentPlate.weightGrams}g
                  </span>
                )}
                {currentPlate.predictionSeconds > 0 && (
                  <span className="bg-slate-900/90 border border-slate-700/80 text-slate-300 px-2 py-0.5 rounded-md text-[10px] font-mono">
                    ⏱️ {Math.floor(currentPlate.predictionSeconds / 3600)}h {Math.round((currentPlate.predictionSeconds % 3600) / 60)}m
                  </span>
                )}
              </div>

              {/* Tag Filamenti del piatto (tipo e colore) */}
              {currentPlate.filaments && currentPlate.filaments.length > 0 && (
                <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 max-w-[55%] flex-wrap justify-end">
                  {currentPlate.filaments.map((f, i) => (
                    <div 
                      key={i} 
                      className="flex items-center gap-1 bg-slate-900/95 border border-slate-700/80 px-2 py-0.5 rounded-md text-[10px] text-slate-200 shadow"
                    >
                      <span 
                        className="w-2.5 h-2.5 rounded-full border border-black/40 shadow-inner flex-shrink-0" 
                        style={{ backgroundColor: f.color || '#10b981' }} 
                      />
                      <span className="font-semibold">{f.type || 'PLA'}</span>
                      {f.usedG ? <span className="text-slate-400 font-mono text-[9px]">({f.usedG}g)</span> : null}
                    </div>
                  ))}
                </div>
              )}

              {/* Pulsante Vista HD a piena risoluzione */}
              {(currentPlate.topPictureUrl || currentPlate.thumbnailUrl || displayCover) && (
                <a 
                  href={currentPlate.topPictureUrl || currentPlate.thumbnailUrl || displayCover} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="absolute bottom-2.5 right-2.5 z-20 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white text-[10px] px-2.5 py-1 rounded-md border border-slate-700 flex items-center gap-1 transition-colors shadow"
                  title="Apri immagine ad alta risoluzione"
                >
                  <Maximize2 className="w-3 h-3 text-emerald-400" />
                  <span>Zoom HD</span>
                </a>
              )}
            </div>

            {/* Selettore Piatti (se sono presenti più piatti nel profilo) */}
            {plates && plates.length > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5 px-1">
                <span className="text-[11px] text-slate-400 font-medium mr-1 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-emerald-400" />
                  Seleziona Piatto ({plates.length}):
                </span>
                {plates.map((plate) => (
                  <button
                    key={plate.index}
                    type="button"
                    onClick={() => setActivePlateIndex(plate.index)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      activePlateIndex === plate.index
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{plate.name || `Piatto ${plate.index}`}</span>
                    {plate.weightGrams > 0 && (
                      <span className="font-mono text-[10px] opacity-75">({plate.weightGrams}g)</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VISTA 2: CAROSELLO FOTO & RENDERS AD ALTA RISOLUZIONE */}
        {viewMode === 'gallery' && (
          <div className="space-y-2 p-2">
            <div 
              style={{ minHeight: `${height}px` }} 
              className="relative bg-slate-950 border border-slate-800/80 rounded-xl overflow-hidden flex flex-col items-center justify-center p-3 select-none"
            >
              {currentPicture?.url ? (
                <div className="relative z-10 flex flex-col items-center justify-center max-h-full max-w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentPicture.url}
                    alt={currentPicture.name || 'Foto Modello'}
                    className="max-h-[250px] w-auto object-contain rounded-lg shadow-xl transition-all"
                  />
                </div>
              ) : (
                <div className="text-slate-500 text-xs py-12 flex flex-col items-center gap-1.5">
                  <ImageIcon className="w-8 h-8 opacity-40" />
                  <span>Nessuna foto disponibile per questo modello</span>
                </div>
              )}

              {/* Frecce Carosello Avanti / Indietro */}
              {pictures && pictures.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveGalleryIndex(prev => (prev > 0 ? prev - 1 : pictures.length - 1))}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 bg-slate-900/85 hover:bg-slate-800 text-white rounded-full border border-slate-700 transition-all shadow-lg hover:scale-105 cursor-pointer z-20"
                    title="Foto precedente"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveGalleryIndex(prev => (prev < pictures.length - 1 ? prev + 1 : 0))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 bg-slate-900/85 hover:bg-slate-800 text-white rounded-full border border-slate-700 transition-all shadow-lg hover:scale-105 cursor-pointer z-20"
                    title="Foto successiva"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}

              {/* Contatore immagini */}
              {pictures && pictures.length > 0 && (
                <div className="absolute bottom-2.5 left-2.5 z-20 bg-slate-900/90 backdrop-blur-md text-slate-300 text-[10px] px-2.5 py-1 rounded-md border border-slate-700 font-mono flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  <span>{activeGalleryIndex + 1} / {pictures.length}</span>
                </div>
              )}

              {/* Bottone HD Link */}
              {currentPicture?.url && (
                <a
                  href={currentPicture.url}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute bottom-2.5 right-2.5 z-20 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white text-[10px] px-2.5 py-1 rounded-md border border-slate-700 flex items-center gap-1 transition-colors shadow"
                  title="Apri immagine ad alta risoluzione"
                >
                  <ExternalLink className="w-3 h-3 text-purple-400" />
                  <span>HD</span>
                </a>
              )}
            </div>

            {/* Striscia miniature con scroll orizzontale */}
            {pictures && pictures.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 px-1">
                {pictures.map((pic, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveGalleryIndex(idx)}
                    className={`w-12 h-12 rounded-lg border overflow-hidden flex-shrink-0 transition-all cursor-pointer ${
                      activeGalleryIndex === idx
                        ? 'border-purple-500 ring-2 ring-purple-500/50 scale-105 shadow-md'
                        : 'border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-700'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pic.url} alt={`Miniatura ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VISTA 3: MESH 3D THREE.JS (STL / 3MF) */}
        {viewMode === 'mesh' && (
          <div className="p-1">
            <StlViewer
              height={height}
              url={modelUrl || undefined}
              fileName={modelFileName || undefined}
              initialColor={material.includes('PLA') ? '#10b981' : material.includes('PETG') ? '#06b6d4' : '#a855f7'}
              allowUpload={allowUpload}
              onFileSelected={onFileSelected}
              onDimensionsCalculated={onDimensionsCalculated}
            />
          </div>
        )}
      </div>

      {/* Footer informativo con link a MakerWorld se presente */}
      {makerWorldUrl && (
        <div className="p-2 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs flex-wrap gap-2 px-3">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] truncate">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="truncate">
              Modello originale MakerWorld {authorName ? `di ${authorName}` : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={makerWorldUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 transition-colors"
            >
              <span>Vedi su MakerWorld</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
