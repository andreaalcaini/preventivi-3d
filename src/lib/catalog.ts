import fs from 'fs';
import path from 'path';

/** Catalogo di pezzi ricorrenti con prezzo fisso, riusabili per nuovi lavori. */
export interface CatalogItem {
  id: string;
  name: string;
  description: string;
  category: string;
  material: string;
  color: string;
  weight: number;
  hours: number;
  mins: number;
  price: number;
  modelUrl: string;
  modelFileName: string;
  sourceQuoteId: string;
  timesUsed: number;
  createdAt: string;
  updatedAt: string;
}

const filePath = path.join(process.cwd(), 'data', 'catalog.json');

export function readCatalog(): CatalogItem[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCatalog(items: CatalogItem[]) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2), 'utf-8');
  fs.renameSync(tmp, filePath);
}
