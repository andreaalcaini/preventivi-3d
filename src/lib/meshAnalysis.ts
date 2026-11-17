'use client';

import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';

/**
 * Analisi geometrica di un file STL/3MF nel browser: volume, superficie, ingombro,
 * orientamento consigliato (faccia d'appoggio più ampia) e controlli di stampabilità.
 * I valori vengono inviati al server, che calcola grammi, ore e prezzo con il listino.
 */

export interface MeshStats {
  volumeCm3: number;
  surfaceCm2: number;
  /** Ingombro nell'orientamento consigliato, in mm (z = altezza di stampa). */
  sizeMm: { x: number; y: number; z: number };
  /** Area di appoggio sul piatto nell'orientamento consigliato, in mm². */
  baseAreaMm2: number;
  triangles: number;
  /** Spigoli che non sono condivisi da esattamente due triangoli: mesh non chiusa o difettosa. */
  openEdges: number;
  /** Rotazione applicata per l'orientamento consigliato. */
  orientation: 'originale' | 'ruotato';
}

function collectPositions(object: THREE.Object3D | THREE.BufferGeometry): Float32Array {
  if (object instanceof THREE.BufferGeometry) {
    const g = object.index ? object.toNonIndexed() : object;
    return g.attributes.position.array as Float32Array;
  }
  const parts: Float32Array[] = [];
  object.updateMatrixWorld(true);
  object.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const g = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()) as THREE.BufferGeometry;
    g.applyMatrix4(mesh.matrixWorld);
    parts.push(g.attributes.position.array as Float32Array);
  });
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Float32Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** Sei orientamenti assiali: si sceglie quello con la base più ampia, a parità quello più basso. */
const ROTATIONS: Array<(x: number, y: number, z: number) => [number, number, number]> = [
  (x, y, z) => [x, y, z],
  (x, y, z) => [x, -y, -z],
  (x, y, z) => [x, z, -y],
  (x, y, z) => [x, -z, y],
  (x, y, z) => [z, y, -x],
  (x, y, z) => [-z, y, x],
];

export function analyzePositions(pos: Float32Array): MeshStats {
  const n = Math.floor(pos.length / 9);
  let volume = 0;
  let area = 0;
  const edges = new Map<string, number>();
  const key = (i: number) => `${pos[i].toFixed(3)},${pos[i + 1].toFixed(3)},${pos[i + 2].toFixed(3)}`;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), cross = new THREE.Vector3();

  for (let t = 0; t < n; t++) {
    const i = t * 9;
    a.set(pos[i], pos[i + 1], pos[i + 2]);
    b.set(pos[i + 3], pos[i + 4], pos[i + 5]);
    c.set(pos[i + 6], pos[i + 7], pos[i + 8]);
    volume += a.dot(cross.crossVectors(b, c)) / 6;
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    area += cross.crossVectors(ab, ac).length() / 2;
    if (n <= 400_000) {
      const ka = key(i), kb = key(i + 3), kc = key(i + 6);
      for (const [p, q] of [[ka, kb], [kb, kc], [kc, ka]]) {
        const k = p < q ? `${p}|${q}` : `${q}|${p}`;
        edges.set(k, (edges.get(k) || 0) + 1);
      }
    }
  }
  let openEdges = 0;
  for (const count of edges.values()) if (count !== 2) openEdges++;

  // Orientamento: area delle facce rivolte verso il basso vicine al punto più basso
  let best = { idx: 0, base: -1, size: { x: 0, y: 0, z: 0 } };
  ROTATIONS.forEach((rot, idx) => {
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    const rotated = new Float32Array(n * 9);
    for (let i = 0; i < n * 9; i += 3) {
      const [x, y, z] = rot(pos[i], pos[i + 1], pos[i + 2]);
      rotated[i] = x; rotated[i + 1] = y; rotated[i + 2] = z;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    let base = 0;
    const tol = Math.max(0.05, (maxZ - minZ) * 0.002);
    for (let i = 0; i < n * 9; i += 9) {
      if (rotated[i + 2] - minZ > tol || rotated[i + 5] - minZ > tol || rotated[i + 8] - minZ > tol) continue;
      a.set(rotated[i], rotated[i + 1], rotated[i + 2]);
      b.set(rotated[i + 3], rotated[i + 4], rotated[i + 5]);
      c.set(rotated[i + 6], rotated[i + 7], rotated[i + 8]);
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      base += cross.crossVectors(ab, ac).length() / 2;
    }
    const size = { x: maxX - minX, y: maxY - minY, z: maxZ - minZ };
    const better = base > best.base * 1.05 || (Math.abs(base - best.base) <= best.base * 0.05 && size.z < best.size.z);
    if (best.base < 0 || better) best = { idx, base, size };
  });

  const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
  return {
    volumeCm3: round(Math.abs(volume) / 1000, 2),
    surfaceCm2: round(area / 100, 1),
    sizeMm: { x: round(best.size.x), y: round(best.size.y), z: round(best.size.z) },
    baseAreaMm2: round(best.base, 0),
    triangles: n,
    openEdges,
    orientation: best.idx === 0 ? 'originale' : 'ruotato',
  };
}

export async function analyzeModelFile(file: File | Blob, fileName: string): Promise<MeshStats | null> {
  try {
    const buffer = await file.arrayBuffer();
    if (/\.stl$/i.test(fileName)) {
      return analyzePositions(collectPositions(new STLLoader().parse(buffer)));
    }
    if (/\.3mf$/i.test(fileName)) {
      const group = new ThreeMFLoader().parse(buffer);
      const pos = collectPositions(group);
      return pos.length ? analyzePositions(pos) : null;
    }
  } catch {
    // file illeggibile: nessuna analisi, il laboratorio valuterà a mano
  }
  return null;
}

/** Somma più file (pezzi diversi della stessa richiesta). */
export function combineStats(list: MeshStats[]): MeshStats | null {
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  return {
    volumeCm3: Math.round(list.reduce((s, m) => s + m.volumeCm3, 0) * 100) / 100,
    surfaceCm2: Math.round(list.reduce((s, m) => s + m.surfaceCm2, 0) * 10) / 10,
    sizeMm: {
      x: Math.max(...list.map(m => m.sizeMm.x)),
      y: Math.max(...list.map(m => m.sizeMm.y)),
      z: Math.max(...list.map(m => m.sizeMm.z)),
    },
    baseAreaMm2: Math.min(...list.map(m => m.baseAreaMm2)),
    triangles: list.reduce((s, m) => s + m.triangles, 0),
    openEdges: list.reduce((s, m) => s + m.openEdges, 0),
    orientation: list.some(m => m.orientation === 'ruotato') ? 'ruotato' : 'originale',
  };
}
