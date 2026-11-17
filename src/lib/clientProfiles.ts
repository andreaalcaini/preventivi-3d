import fs from 'fs';
import path from 'path';

/** Dati anagrafici aggiuntivi dei clienti (i totali restano calcolati dai lavori). Chiave: nome normalizzato. */
export interface ClientProfile {
  name: string;
  company: string;
  contacts: Array<{ label: string; value: string }>;
  address: string;
  notes: string;
  tags: string[];
  updatedAt: string;
}

const filePath = path.join(process.cwd(), 'data', 'clients.json');
export const clientKey = (name: string) => name.trim().toLowerCase();

export function readProfiles(): Record<string, ClientProfile> {
  try {
    if (!fs.existsSync(filePath)) return {};
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveProfile(input: Partial<ClientProfile> & { name: string }): ClientProfile {
  const all = readProfiles();
  const key = clientKey(input.name);
  const prev = all[key];
  const profile: ClientProfile = {
    name: input.name.trim().slice(0, 120),
    company: String(input.company ?? prev?.company ?? '').slice(0, 120),
    contacts: (Array.isArray(input.contacts) ? input.contacts : prev?.contacts || [])
      .map(c => ({ label: String(c.label || '').slice(0, 30), value: String(c.value || '').slice(0, 120) }))
      .filter(c => c.value.trim())
      .slice(0, 10),
    address: String(input.address ?? prev?.address ?? '').slice(0, 300),
    notes: String(input.notes ?? prev?.notes ?? '').slice(0, 4000),
    tags: (Array.isArray(input.tags) ? input.tags : prev?.tags || []).map(t => String(t).trim().slice(0, 30)).filter(Boolean).slice(0, 10),
    updatedAt: new Date().toISOString(),
  };
  all[key] = profile;
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(all, null, 2), 'utf-8');
  fs.renameSync(tmp, filePath);
  return profile;
}
