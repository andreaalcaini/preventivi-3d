import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/** Registro attività: chi ha cambiato cosa e quando. Ultime 2000 voci in data/activity.json. */

export interface ActivityEntry {
  id: string;
  at: string;
  user: string;
  area: 'lavori' | 'produzione' | 'magazzino' | 'listino' | 'utenti' | 'chiavi' | 'clienti' | 'catalogo' | 'sistema';
  ref: string;
  text: string;
}

const filePath = path.join(process.cwd(), 'data', 'activity.json');
const MAX_ENTRIES = 2000;

export function readActivity(): ActivityEntry[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function logActivity(user: string, area: ActivityEntry['area'], ref: string, text: string) {
  try {
    const entries = readActivity();
    entries.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), user, area, ref, text: text.slice(0, 300) });
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(entries.slice(0, MAX_ENTRIES), null, 2), 'utf-8');
    fs.renameSync(tmp, filePath);
  } catch {
    // il registro non deve mai bloccare l'operazione principale
  }
}
