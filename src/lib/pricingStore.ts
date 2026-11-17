import fs from 'fs';
import path from 'path';
import { mergePricing, estimateUsageFromMesh, type PricingConfig, type MeshInput } from '@/lib/pricing';
import { readQuotes } from '@/lib/labData';

const filePath = path.join(process.cwd(), 'data', 'pricing.json');

export function readPricing(): PricingConfig {
  try {
    if (fs.existsSync(filePath)) return mergePricing(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
  } catch {
    // file danneggiato: si usano i valori predefiniti
  }
  return mergePricing(null);
}

export function writePricing(cfg: PricingConfig) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf-8');
  fs.renameSync(tmp, filePath);
}

function median(values: number[]) {
  const v = [...values].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/**
 * Calibrazione: confronta la stima geometrica con i dati reali dei lavori che hanno sia la geometria
 * sia grammi/ore affidabili (consuntivo a fine lavoro oppure dati dello slicer). Usa la mediana dei rapporti.
 */
export function calibrate(cfg: PricingConfig) {
  const gRatios: number[] = [];
  const tRatios: number[] = [];
  for (const q of readQuotes()) {
    const mesh = q.meshStats as (MeshInput & { volumeCm3: number }) | undefined;
    if (!mesh || !(mesh.volumeCm3 > 0)) continue;
    const qty = Math.max(1, Number(q.quantity) || 1);
    const actual = q.actual as { grams?: number; hours?: number } | undefined;
    const fromSlicer = q.weightSource === 'slicer';
    const realGrams = actual?.grams ? actual.grams / qty : fromSlicer ? Number(q.weight) : 0;
    const realHours = actual?.hours ? actual.hours / qty : fromSlicer ? (Number(q.hours) || 0) + (Number(q.mins) || 0) / 60 : 0;
    const est = estimateUsageFromMesh(mesh, String(q.material || ''), cfg, false);
    if (realGrams > 0) gRatios.push(realGrams / est.grams);
    if (realHours > 0) tRatios.push(realHours / est.hours);
  }
  const clamp = (v: number) => Math.min(3, Math.max(0.33, v));
  const samples = Math.min(gRatios.length, tRatios.length);
  return {
    gramsFactor: gRatios.length >= 3 ? Math.round(clamp(median(gRatios)) * 1000) / 1000 : 1,
    timeFactor: tRatios.length >= 3 ? Math.round(clamp(median(tRatios)) * 1000) / 1000 : 1,
    samples,
    updatedAt: new Date().toISOString(),
  };
}
