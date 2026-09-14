'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
  RotateCw, Eye, Maximize2, Palette, 
  UploadCloud, AlertCircle, Box as BoxIcon, FileCode
} from 'lucide-react';

export interface ModelDimensions {
  x: number;
  y: number;
  z: number;
  triangles: number;
}

interface StlViewerProps {
  file?: File | Blob | null;
  url?: string;
  fileName?: string;
  initialColor?: string;
  height?: number | string;
  onDimensionsCalculated?: (dim: ModelDimensions) => void;
  onFileSelected?: (file: File) => void;
  allowUpload?: boolean;
}

const PALETTE_COLORS = [
  { name: 'Smeraldo', hex: '#10b981' },
  { name: 'Ciano', hex: '#06b6d4' },
  { name: 'Arancione', hex: '#f97316' },
  { name: 'Viola', hex: '#a855f7' },
  { name: 'Grigio FDM', hex: '#94a3b8' },
  { name: 'Nero Opaco', hex: '#334155' },
  { name: 'Bianco Perla', hex: '#f1f5f9' },
  { name: 'Rosso Fuoco', hex: '#ef4444' }
];

export default function StlViewer({
  file,
  url,
  fileName,
  initialColor = '#10b981',
  height = 360,
  onDimensionsCalculated,
  onFileSelected,
  allowUpload = true
}: StlViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const currentObjectRef = useRef<THREE.Object3D | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState(initialColor);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [dimensions, setDimensions] = useState<ModelDimensions | null>(null);
  const [activeFile, setActiveFile] = useState<File | Blob | null>(file || null);
  const [activeFormat, setActiveFormat] = useState<'STL' | '3MF' | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>(fileName || '');

  useEffect(() => {
    if (file) {
      setActiveFile(file);
      if (file instanceof File) {
        setCurrentFileName(file.name);
      }
    }
  }, [file]);

  useEffect(() => {
    if (fileName) {
      setCurrentFileName(fileName);
    }
  }, [fileName]);

  // Gestione rotazione automatica
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
      controlsRef.current.autoRotateSpeed = 2.5;
    }
  }, [autoRotate]);

  // Gestione colore materiale
  useEffect(() => {
    if (currentObjectRef.current) {
      currentObjectRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => {
              const m = mat as THREE.MeshStandardMaterial;
              if (m.color && typeof m.color.set === 'function') {
                m.color.set(color);
              }
            });
          } else if (mesh.material) {
            const m = mesh.material as THREE.MeshStandardMaterial;
            if (m.color && typeof m.color.set === 'function') {
              m.color.set(color);
            }
          }
        }
      });
    }
  }, [color]);

  // Gestione wireframe
  useEffect(() => {
    if (currentObjectRef.current) {
      currentObjectRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => {
              if ('wireframe' in mat) (mat as THREE.MeshStandardMaterial).wireframe = wireframe;
            });
          } else if (mesh.material && 'wireframe' in mesh.material) {
            (mesh.material as THREE.MeshStandardMaterial).wireframe = wireframe;
          }
        }
      });
    }
  }, [wireframe]);

  // Rimuove l'oggetto precedente e ripulisce le geometrie
  const clearCurrentObject = useCallback(() => {
    if (currentObjectRef.current && sceneRef.current) {
      sceneRef.current.remove(currentObjectRef.current);
      currentObjectRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else if (m.material) {
            m.material.dispose();
          }
        }
      });
      currentObjectRef.current = null;
    }
  }, []);

  // Adatta camera e griglia all'oggetto inserito
  const setupObjectInScene = useCallback((object: THREE.Object3D, totalTriangles: number) => {
    if (!sceneRef.current || !cameraRef.current || !controlsRef.current) return;

    clearCurrentObject();

    sceneRef.current.add(object);
    currentObjectRef.current = object;

    // Calcola Bounding Box finale
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);

    const dim: ModelDimensions = {
      x: +(size.x).toFixed(1),
      y: +(size.y).toFixed(1),
      z: +(size.z).toFixed(1),
      triangles: Math.round(totalTriangles)
    };

    setDimensions(dim);
    if (onDimensionsCalculated) {
      onDimensionsCalculated(dim);
    }

    // Posiziona la griglia alla base dell'oggetto
    if (gridRef.current) {
      gridRef.current.position.y = -size.y / 2 - 0.2;
    }

    // Adatta la camera alla dimensione del pezzo
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = cameraRef.current.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ = Math.max(cameraZ * 2.2, 40);

    cameraRef.current.position.set(cameraZ * 0.8, cameraZ * 0.7, cameraZ);
    cameraRef.current.lookAt(0, 0, 0);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();

    setLoading(false);
    setError(null);
  }, [clearCurrentObject, onDimensionsCalculated]);

  // Caricamento geometria STL
  const loadStlGeometry = useCallback((geometry: THREE.BufferGeometry) => {
    geometry.computeVertexNormals();
    geometry.center();
    geometry.computeBoundingBox();

    const triangles = geometry.attributes.position.count / 3;

    // Materiale PBR FDM
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.35,
      metalness: 0.1,
      wireframe
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    setActiveFormat('STL');
    setupObjectInScene(mesh, triangles);
  }, [color, wireframe, setupObjectInScene]);

  // Caricamento gruppo 3MF
  const load3mfGroup = useCallback((group: THREE.Group) => {
    // 3MF usa solitamente la convenzione Z-up, convertiamo a Y-up per Three.js
    group.rotation.x = -Math.PI / 2;
    group.updateMatrixWorld(true);

    // Centra il gruppo rispetto all'origine
    const box = new THREE.Box3().setFromObject(group);
    const center = new THREE.Vector3();
    box.getCenter(center);
    group.position.x -= center.x;
    group.position.y -= center.y;
    group.position.z -= center.z;
    group.updateMatrixWorld(true);

    let triangles = 0;
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (mesh.geometry?.attributes?.position) {
          triangles += mesh.geometry.attributes.position.count / 3;
        }

        // Se il materiale originale non ha colore o se desideriamo applicare wireframe
        if (wireframe) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => { if ('wireframe' in m) (m as THREE.MeshStandardMaterial).wireframe = true; });
          } else if (mesh.material && 'wireframe' in mesh.material) {
            (mesh.material as THREE.MeshStandardMaterial).wireframe = true;
          }
        }
      }
    });

    setActiveFormat('3MF');
    setupObjectInScene(group, triangles);
  }, [wireframe, setupObjectInScene]);

  // Funzione unificata di parsing dell'ArrayBuffer (STL o 3MF)
  const parseBuffer = useCallback((buffer: ArrayBuffer, nameHint?: string) => {
    try {
      // Ispezione header per identificare il formato
      // I file .3mf sono archivi ZIP che iniziano obbligatoriamente con 'PK' [0x50, 0x4B, 0x03, 0x04]
      const headerBytes = new Uint8Array(buffer.slice(0, 4));
      const isZip = headerBytes[0] === 0x50 && headerBytes[1] === 0x4b;
      const lowerName = (nameHint || currentFileName || url || '').toLowerCase();
      const is3mf = isZip || lowerName.endsWith('.3mf');

      if (is3mf) {
        const loader = new ThreeMFLoader();
        const group = loader.parse(buffer);
        load3mfGroup(group);
      } else {
        const loader = new STLLoader();
        const geometry = loader.parse(buffer);
        loadStlGeometry(geometry);
      }
    } catch (err) {
      console.error('Errore parsing modello 3D:', err);
      setError('Impossibile interpretare il modello 3D. Verifica che sia un file .STL o .3MF valido.');
      setLoading(false);
    }
  }, [currentFileName, url, load3mfGroup, loadStlGeometry]);

  // Caricamento da File (Blob) o URL
  useEffect(() => {
    if (activeFile) {
      setLoading(true);
      setError(null);

      const fileNameHint = activeFile instanceof File ? activeFile.name : currentFileName;
      if (activeFile instanceof File) {
        setCurrentFileName(activeFile.name);
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        if (buffer) {
          parseBuffer(buffer, fileNameHint);
        } else {
          setError('Errore nella lettura dei dati del file.');
          setLoading(false);
        }
      };
      reader.onerror = () => {
        setError('Errore durante la lettura del file dal computer.');
        setLoading(false);
      };
      reader.readAsArrayBuffer(activeFile);
    } else if (url) {
      setLoading(true);
      setError(null);

      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP error ${res.status}`);
          return res.arrayBuffer();
        })
        .then((buffer) => {
          parseBuffer(buffer, fileName || url);
        })
        .catch((err) => {
          console.error('Errore download modello:', err);
          setError('Impossibile scaricare il modello 3D dal server.');
          setLoading(false);
        });
    }
  }, [activeFile, url, fileName, parseBuffer, currentFileName]);

  // Inizializzazione Three.js Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const computedHeight = typeof height === 'number' ? height : 360;

    // Scena
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030712'); // Slate 950
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / computedHeight, 0.1, 3000);
    camera.position.set(120, 100, 160);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, computedHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // Controlli Orbita
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 2500;
    controls.minDistance = 5;
    controlsRef.current = controls;

    // Luci da studio fotografico
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.3);
    dirLight1.position.set(200, 250, 200);
    dirLight1.castShadow = true;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x6ee7b7, 0.6); // Emerald rim light
    dirLight2.position.set(-200, -100, -200);
    scene.add(dirLight2);

    const dirLight3 = new THREE.DirectionalLight(0x93c5fd, 0.4); // Subtle blue fill
    dirLight3.position.set(0, -200, 100);
    scene.add(dirLight3);

    // Griglia Piatto di Stampa FDM
    const grid = new THREE.GridHelper(260, 26, 0x10b981, 0x1e293b);
    grid.position.y = -0.5;
    gridRef.current = grid;
    scene.add(grid);

    // Loop di rendering
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize observer
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      camera.aspect = newWidth / computedHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, computedHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [height]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      const lower = droppedFile.name.toLowerCase();
      if (lower.endsWith('.stl') || lower.endsWith('.3mf')) {
        setActiveFile(droppedFile);
        setCurrentFileName(droppedFile.name);
        if (onFileSelected) onFileSelected(droppedFile);
      } else {
        setError('Formato non supportato. Trascina un file con estensione .STL o .3MF');
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setActiveFile(f);
      setCurrentFileName(f.name);
      if (onFileSelected) onFileSelected(f);
    }
  };

  const handleResetCamera = () => {
    if (controlsRef.current && currentObjectRef.current && cameraRef.current) {
      const box = new THREE.Box3().setFromObject(currentObjectRef.current);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const dist = Math.max(maxDim * 2.2, 40);
      cameraRef.current.position.set(dist * 0.8, dist * 0.7, dist);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  return (
    <div 
      className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex flex-col"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Barra Superiore Controlli */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-1.5 pointer-events-auto bg-slate-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-800 shadow-lg text-xs max-w-full overflow-hidden">
          <BoxIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="font-semibold text-white truncate">
            {currentFileName ? currentFileName : 'Viewer 3D WebGL'}
          </span>

          {activeFormat && (
            <span className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded uppercase ${
              activeFormat === '3MF' 
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {activeFormat}
            </span>
          )}

          {dimensions && (
            <span className="font-mono text-[11px] text-slate-400 border-l border-slate-700 pl-1.5 ml-1 hidden sm:inline">
              {dimensions.x} × {dimensions.y} × {dimensions.z} mm
            </span>
          )}
        </div>

        {/* Toolbar Azioni */}
        <div className="flex items-center gap-1 pointer-events-auto bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-800 shadow-lg">
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1.5 rounded-lg transition-colors text-xs flex items-center gap-1 ${
              autoRotate ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white'
            }`}
            title="Attiva rotazione automatica piatto"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setWireframe(!wireframe)}
            className={`p-1.5 rounded-lg transition-colors text-xs flex items-center gap-1 ${
              wireframe ? 'bg-purple-500/20 text-purple-400' : 'text-slate-400 hover:text-white'
            }`}
            title="Visualizza mesh wireframe (fil di ferro)"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleResetCamera}
            className="p-1.5 rounded-lg transition-colors text-slate-400 hover:text-white text-xs"
            title="Ripristina punto di vista telecamera"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas Three.js Container */}
      <div 
        ref={containerRef} 
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
        className="w-full cursor-grab active:cursor-grabbing touch-none select-none"
      />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
          <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-300 font-medium">
            Elaborazione modello 3D ({activeFormat || 'STL/3MF'})...
          </span>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-20">
          <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
          <p className="text-xs text-red-300 font-medium mb-3">{error}</p>
          {allowUpload && (
            <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white rounded-lg cursor-pointer">
              Carica un altro file 3D (.STL o .3MF)
              <input type="file" accept=".stl,.3mf" onChange={handleFileInput} className="hidden" />
            </label>
          )}
        </div>
      )}

      {/* Empty State / Upload Prompt if no active file or URL */}
      {!activeFile && !url && !loading && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-10 pointer-events-auto">
          <UploadCloud className="w-10 h-10 text-emerald-400 mb-2 opacity-80" />
          <h4 className="text-sm font-bold text-white mb-1">Trascina qui il tuo file 3D (.STL o .3MF)</h4>
          <p className="text-xs text-slate-400 max-w-xs mb-4">
            Visualizza l&apos;anteprima 3D, calcola le quote millimetriche e ispeziona la geometria del pezzo
          </p>
          {allowUpload && (
            <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-md shadow-emerald-950 transition-all flex items-center gap-1.5">
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Seleziona file .STL o .3MF</span>
              <input type="file" accept=".stl,.3mf" onChange={handleFileInput} className="hidden" />
            </label>
          )}
        </div>
      )}

      {/* Barra Inferiore: Selettore Colore Filamento & Dettagli */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 flex items-center gap-1 text-[11px]">
            <Palette className="w-3 h-3 text-emerald-400" /> Tinta Filamento:
          </span>
          <div className="flex items-center gap-1.5">
            {PALETTE_COLORS.map((c) => (
              <button
                key={c.hex}
                onClick={() => setColor(c.hex)}
                className={`w-4 h-4 rounded-full border transition-transform ${
                  color === c.hex ? 'scale-125 border-white ring-1 ring-emerald-500' : 'border-slate-700 hover:scale-110'
                }`}
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {allowUpload && (activeFile || url) && (
            <label className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 cursor-pointer transition-colors">
              <FileCode className="w-3 h-3" />
              <span>Cambia file 3D</span>
              <input type="file" accept=".stl,.3mf" onChange={handleFileInput} className="hidden" />
            </label>
          )}

          {dimensions && (
            <div className="text-[11px] text-slate-400 font-mono">
              Triangoli: <strong className="text-slate-200">{dimensions.triangles.toLocaleString()}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
