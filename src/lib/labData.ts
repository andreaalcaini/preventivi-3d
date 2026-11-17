import fs from 'fs';
import path from 'path';

/** Accesso server-side ai file dati del laboratorio, usato dall'API v1 per le integrazioni. */

const dataDir = path.join(process.cwd(), 'data');
const quotesPath = path.join(dataDir, 'quotes.json');
const inventoryPath = path.join(dataDir, 'inventory.json');

export const JOB_STATUSES = ['richiesta', 'in_attesa', 'in_stampa', 'pronto', 'saldato'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface QuoteRecord {
  id: string;
  name: string;
  clientName?: string;
  clientContact?: string;
  material?: string;
  spoolId?: string;
  weight?: number | string;
  purgeWeight?: number | string;
  hours?: number | string;
  mins?: number | string;
  quantity?: number;
  extraBom?: Array<{ name: string; qty: number | string; cost?: number }>;
  savedAt?: string;
  totalCalculated?: number;
  estimatedProfit?: number;
  status?: JobStatus;
  inventoryDeducted?: boolean;
  [key: string]: unknown;
}

interface InventoryData {
  spools: Array<{ id: string; weightRemaining: number; [key: string]: unknown }>;
  hardware: Array<{ id: string; name: string; qty: number; [key: string]: unknown }>;
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf-8');
}

export function readQuotes(): QuoteRecord[] {
  const quotes = readJson<QuoteRecord[]>(quotesPath, []);
  return Array.isArray(quotes) ? quotes : [];
}

export function writeQuotes(quotes: QuoteRecord[]) {
  writeJson(quotesPath, quotes);
}

export function readInventory(): InventoryData {
  const inv = readJson<InventoryData>(inventoryPath, { spools: [], hardware: [] });
  return { spools: inv.spools || [], hardware: inv.hardware || [] };
}

/** Stessa regola del gestionale: passando a "in_stampa" o "saldato" il materiale viene scaricato una sola volta. */
export function consumeForQuote(quote: QuoteRecord) {
  const qty = Math.max(1, Number(quote.quantity) || 1);
  const grams = ((parseFloat(String(quote.weight ?? 0)) || 0) + (parseFloat(String(quote.purgeWeight ?? 0)) || 0)) * qty;
  const inventory = readInventory();

  if (quote.spoolId && grams > 0) {
    inventory.spools = inventory.spools.map(s =>
      s.id === quote.spoolId ? { ...s, weightRemaining: Math.max(0, s.weightRemaining - grams) } : s
    );
  }
  for (const item of quote.extraBom || []) {
    const used = (parseFloat(String(item.qty)) || 1) * qty;
    inventory.hardware = inventory.hardware.map(hw =>
      hw.name.trim().toLowerCase() === item.name.trim().toLowerCase() ? { ...hw, qty: Math.max(0, hw.qty - used) } : hw
    );
  }
  writeJson(inventoryPath, inventory);
}

/** Vista compatta di un preventivo, pensata per agenti AI e automazioni. */
export function summarizeQuote(q: QuoteRecord) {
  return {
    id: q.id,
    name: q.name,
    clientName: q.clientName || '',
    clientContact: q.clientContact || '',
    material: q.material || '',
    quantity: Number(q.quantity) || 1,
    weightGrams: parseFloat(String(q.weight ?? 0)) || 0,
    printTimeMinutes: (Number(q.hours) || 0) * 60 + (Number(q.mins) || 0),
    total: Math.round((Number(q.totalCalculated) || 0) * 100) / 100,
    status: q.status || 'in_attesa',
    savedAt: q.savedAt || '',
  };
}
