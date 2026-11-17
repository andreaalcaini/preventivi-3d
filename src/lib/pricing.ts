/**
 * Listino e stime: logica pura, usata dal server (stima per il portale) e dalla pagina Listino.
 * I valori predefiniti riproducono la formula usata finora dal portale richieste.
 */

export interface MaterialPrice {
  key: string;
  label: string;
  /** Parole che, trovate nel nome del materiale, selezionano questa voce (es. "ASA" per "ASA Nero"). */
  match: string[];
  pricePerKg: number;
  /** g/cm³ */
  density: number;
  /** Supplemento percentuale per materiali tecnici. */
  surchargePct: number;
}

export interface QuantityTier {
  minQty: number;
  discountPct: number;
}

export interface PricingConfig {
  materials: MaterialPrice[];
  machineRatePerHour: number;
  setupFee: number;
  marginPct: number;
  minPrice: number;
  roundTo: number;
  multicolorWasteFactor: number;
  multicolorSurchargePct: number;
  urgencySurchargePct: number;
  quantityTiers: QuantityTier[];
  buildVolume: { x: number; y: number; z: number };
  estimation: {
    wallMm: number;
    infillPct: number;
    throughputGPerHour: number;
    layerHeightMm: number;
    secondsPerLayer: number;
    minBaseAreaMm2: number;
  };
  calibration: {
    gramsFactor: number;
    timeFactor: number;
    samples: number;
    updatedAt: string | null;
  };
}

export const DEFAULT_PRICING: PricingConfig = {
  materials: [
    { key: 'pla', label: 'PLA', match: ['PLA'], pricePerKg: 25, density: 1.24, surchargePct: 0 },
    { key: 'petg', label: 'PETG', match: ['PETG'], pricePerKg: 25, density: 1.27, surchargePct: 0 },
    { key: 'asa', label: 'ASA / ABS', match: ['ASA', 'ABS'], pricePerKg: 30, density: 1.07, surchargePct: 10 },
    { key: 'tpu', label: 'TPU / flessibile', match: ['TPU', 'FLESSIBILE'], pricePerKg: 38, density: 1.21, surchargePct: 15 },
    { key: 'cf', label: 'Caricati carbonio (CF)', match: ['CF', 'CARBON'], pricePerKg: 50, density: 1.3, surchargePct: 15 },
  ],
  machineRatePerHour: 0.48,
  setupFee: 2,
  marginPct: 35,
  minPrice: 3.5,
  roundTo: 0.1,
  multicolorWasteFactor: 1.25,
  multicolorSurchargePct: 0,
  urgencySurchargePct: 30,
  quantityTiers: [
    { minQty: 10, discountPct: 5 },
    { minQty: 50, discountPct: 10 },
  ],
  buildVolume: { x: 256, y: 256, z: 256 },
  estimation: {
    wallMm: 1.2,
    infillPct: 15,
    throughputGPerHour: 18,
    layerHeightMm: 0.2,
    secondsPerLayer: 2,
    minBaseAreaMm2: 60,
  },
  calibration: { gramsFactor: 1, timeFactor: 1, samples: 0, updatedAt: null },
};

export function mergePricing(saved: Partial<PricingConfig> | null | undefined): PricingConfig {
  const s = saved || {};
  return {
    ...DEFAULT_PRICING,
    ...s,
    materials: Array.isArray(s.materials) && s.materials.length ? s.materials : DEFAULT_PRICING.materials,
    quantityTiers: Array.isArray(s.quantityTiers) ? s.quantityTiers : DEFAULT_PRICING.quantityTiers,
    buildVolume: { ...DEFAULT_PRICING.buildVolume, ...(s.buildVolume || {}) },
    estimation: { ...DEFAULT_PRICING.estimation, ...(s.estimation || {}) },
    calibration: { ...DEFAULT_PRICING.calibration, ...(s.calibration || {}) },
  };
}

export function findMaterial(cfg: PricingConfig, name: string): MaterialPrice {
  const up = (name || '').toUpperCase();
  const tokens = up.split(/[^A-Z0-9]+/).filter(Boolean);
  // Vince la parola chiave più lunga trovata nel nome; a parità i caricati carbonio (es. "PLA-CF")
  let best: { mat: MaterialPrice; score: number } | null = null;
  for (const mat of cfg.materials) {
    for (const kw of mat.match) {
      const k = kw.toUpperCase().trim();
      if (!k || !(tokens.includes(k) || (k.length > 3 && up.includes(k)))) continue;
      const score = k.length + (mat.key === 'cf' ? 10 : 0);
      if (!best || score > best.score) best = { mat, score };
    }
  }
  return best?.mat || cfg.materials[0];
}

export interface MeshInput {
  volumeCm3: number;
  surfaceCm2: number;
  sizeMm: { x: number; y: number; z: number };
}

/** Grammi e ore stimati dalla geometria, poi corretti con i fattori di calibrazione. */
export function estimateUsageFromMesh(mesh: MeshInput, materialName: string, cfg: PricingConfig, applyCalibration = true) {
  const mat = findMaterial(cfg, materialName);
  const e = cfg.estimation;
  const shellCm3 = Math.min(mesh.volumeCm3, (mesh.surfaceCm2 * e.wallMm) / 10);
  const solidCm3 = shellCm3 + Math.max(0, mesh.volumeCm3 - shellCm3) * (e.infillPct / 100);
  const gramsRaw = solidCm3 * mat.density;
  const layers = Math.max(1, mesh.sizeMm.z / e.layerHeightMm);
  const hoursRaw = gramsRaw / e.throughputGPerHour + (layers * e.secondsPerLayer) / 3600;
  const g = applyCalibration ? cfg.calibration.gramsFactor : 1;
  const t = applyCalibration ? cfg.calibration.timeFactor : 1;
  return { grams: Math.max(1, Math.round(gramsRaw * g)), hours: Math.max(0.05, hoursRaw * t) };
}

export interface PriceInput {
  hours: number;
  grams: number;
  qty: number;
  material: string;
  multicolor?: boolean;
  urgent?: boolean;
}

export function priceFromUsage(input: PriceInput, cfg: PricingConfig) {
  const mat = findMaterial(cfg, input.material);
  const qty = Math.max(1, Math.round(input.qty || 1));
  const grams = Math.max(1, input.grams) * (input.multicolor ? cfg.multicolorWasteFactor : 1);
  const materialCost = (grams / 1000) * mat.pricePerKg;
  const machineCost = Math.max(0.1, input.hours) * cfg.machineRatePerHour;
  let unit = (materialCost + machineCost + cfg.setupFee) * (1 + cfg.marginPct / 100);
  unit *= 1 + mat.surchargePct / 100;
  if (input.multicolor) unit *= 1 + cfg.multicolorSurchargePct / 100;
  if (input.urgent) unit *= 1 + cfg.urgencySurchargePct / 100;

  const tier = [...cfg.quantityTiers].sort((a, b) => b.minQty - a.minQty).find(t => qty >= t.minQty);
  const discountPct = tier?.discountPct || 0;
  unit *= 1 - discountPct / 100;

  const step = cfg.roundTo > 0 ? cfg.roundTo : 0.01;
  const singlePrice = Math.max(cfg.minPrice, Math.round(unit / step) * step);
  const total = Math.round(singlePrice * qty * 100) / 100;
  return {
    singlePrice: Math.round(singlePrice * 100) / 100,
    total,
    discountPct,
    materialLabel: mat.label,
    grams: Math.round(grams),
    hours: Math.round(input.hours * 100) / 100,
  };
}

export interface PrintabilityWarning {
  level: 'errore' | 'avviso';
  text: string;
}

export function checkPrintability(
  mesh: MeshInput & { baseAreaMm2?: number; openEdges?: number },
  cfg: PricingConfig,
): PrintabilityWarning[] {
  const out: PrintabilityWarning[] = [];
  const dims = [mesh.sizeMm.x, mesh.sizeMm.y, mesh.sizeMm.z].sort((a, b) => b - a);
  const vol = [cfg.buildVolume.x, cfg.buildVolume.y, cfg.buildVolume.z].sort((a, b) => b - a);
  if (dims[0] > vol[0] || dims[1] > vol[1] || dims[2] > vol[2]) {
    out.push({
      level: 'errore',
      text: `Il pezzo (${mesh.sizeMm.x} × ${mesh.sizeMm.y} × ${mesh.sizeMm.z} mm) supera il volume di stampa (${cfg.buildVolume.x} × ${cfg.buildVolume.y} × ${cfg.buildVolume.z} mm): andrà diviso in più parti.`,
    });
  }
  if ((mesh.openEdges || 0) > 0) {
    out.push({ level: 'avviso', text: 'Il modello ha superfici aperte o difettose: il laboratorio lo riparerà prima della stampa, se possibile.' });
  }
  if (mesh.baseAreaMm2 !== undefined && mesh.baseAreaMm2 < cfg.estimation.minBaseAreaMm2 && mesh.sizeMm.z > 20) {
    out.push({ level: 'avviso', text: 'La base d\'appoggio è piccola rispetto all\'altezza: potrebbero servire supporti o un bordo (brim).' });
  }
  const minSide = Math.min(mesh.sizeMm.x, mesh.sizeMm.y, mesh.sizeMm.z);
  if (minSide > 0 && minSide < 1.2) {
    out.push({ level: 'avviso', text: 'Una dimensione è sotto 1,2 mm: dettagli o pareti così sottili potrebbero non stamparsi bene.' });
  }
  if (mesh.volumeCm3 <= 0.01) {
    out.push({ level: 'errore', text: 'Volume nullo: il file non sembra un solido stampabile.' });
  }
  return out;
}
