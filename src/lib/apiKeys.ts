import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Chiavi API per integrare Preventivi 3D in sistemi esterni (agenti AI, n8n, Zapier, script).
 * La chiave in chiaro viene mostrata una sola volta alla creazione: su disco resta solo l'hash SHA-256.
 */

export type ApiKeyScope = 'read' | 'write';

export interface ApiKeyRecord {
  id: string;
  name: string;
  /** Primi caratteri della chiave, mostrati in elenco per riconoscerla (es. "p3d_a1b2c3d4"). */
  prefix: string;
  hash: string;
  scope: ApiKeyScope;
  createdBy: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

export type PublicApiKey = Omit<ApiKeyRecord, 'hash'>;

export const API_KEY_PREFIX = 'p3d_';

const dataDir = path.join(process.cwd(), 'data');
const keysFilePath = path.join(dataDir, 'api_keys.json');

/** Percorsi che una chiave API non può mai raggiungere: gestione utenti, chiavi e backup restano alla sessione. */
const FORBIDDEN_FOR_KEYS = ['/api/users', '/api/api-keys', '/api/backup', '/api/auth', '/api/push'];

function readKeys(): ApiKeyRecord[] {
  try {
    if (!fs.existsSync(keysFilePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(keysFilePath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeKeys(keys: ApiKeyRecord[]) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const tmp = `${keysFilePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(keys, null, 2), 'utf-8');
  fs.renameSync(tmp, keysFilePath);
}

function hashKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

function toPublic({ hash: _hash, ...rest }: ApiKeyRecord): PublicApiKey {
  return rest;
}

export function listApiKeys(): PublicApiKey[] {
  return readKeys()
    .map(toPublic)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createApiKey(input: {
  name: string;
  scope: ApiKeyScope;
  createdBy: string;
  expiresInDays?: number | null;
}): { key: PublicApiKey; secret: string } | { error: string } {
  const name = input.name.trim();
  if (!name || name.length > 60) {
    return { error: 'Dai alla chiave un nome tra 1 e 60 caratteri' };
  }
  if (input.scope !== 'read' && input.scope !== 'write') {
    return { error: 'Permesso non valido: usa "read" o "write"' };
  }

  const secret = `${API_KEY_PREFIX}${crypto.randomBytes(24).toString('base64url')}`;
  const days = input.expiresInDays && input.expiresInDays > 0 ? Math.min(input.expiresInDays, 3650) : null;

  const record: ApiKeyRecord = {
    id: crypto.randomUUID(),
    name,
    prefix: secret.slice(0, API_KEY_PREFIX.length + 8),
    hash: hashKey(secret),
    scope: input.scope,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    expiresAt: days ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
    revokedAt: null,
  };

  writeKeys([...readKeys(), record]);
  return { key: toPublic(record), secret };
}

export function revokeApiKey(id: string): boolean {
  const keys = readKeys();
  const target = keys.find(k => k.id === id);
  if (!target || target.revokedAt) return false;
  target.revokedAt = new Date().toISOString();
  writeKeys(keys);
  return true;
}

export function deleteApiKey(id: string): boolean {
  const keys = readKeys();
  const filtered = keys.filter(k => k.id !== id);
  if (filtered.length === keys.length) return false;
  writeKeys(filtered);
  return true;
}

/** Estrae la chiave da `Authorization: Bearer p3d_...` oppure da `X-API-Key`. */
export function extractApiKey(headers: Headers): string | null {
  const auth = headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) {
    const value = auth.slice(7).trim();
    if (value.startsWith(API_KEY_PREFIX)) return value;
  }
  const header = headers.get('x-api-key')?.trim();
  if (header?.startsWith(API_KEY_PREFIX)) return header;
  return null;
}

export type ApiKeyCheck =
  | { ok: true; key: PublicApiKey }
  | { ok: false; status: 401 | 403; error: string };

/** Verifica una chiave per un dato percorso e metodo HTTP. Aggiorna `lastUsedAt` al massimo una volta al minuto. */
export function authorizeApiKey(rawKey: string, pathname: string, method: string): ApiKeyCheck {
  const keys = readKeys();
  const hashed = Buffer.from(hashKey(rawKey), 'hex');
  const record = keys.find(k => {
    const candidate = Buffer.from(k.hash, 'hex');
    return candidate.length === hashed.length && crypto.timingSafeEqual(candidate, hashed);
  });

  if (!record || record.revokedAt) {
    return { ok: false, status: 401, error: 'Chiave API non valida o revocata' };
  }
  if (record.expiresAt && Date.parse(record.expiresAt) < Date.now()) {
    return { ok: false, status: 401, error: 'Chiave API scaduta' };
  }
  if (!pathname.startsWith('/api/')) {
    return { ok: false, status: 403, error: 'Le chiavi API valgono solo per gli endpoint /api' };
  }
  if (FORBIDDEN_FOR_KEYS.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
    return { ok: false, status: 403, error: 'Questo endpoint richiede un accesso con utente e password' };
  }
  const isRead = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  if (!isRead && record.scope !== 'write') {
    return { ok: false, status: 403, error: 'Chiave in sola lettura: serve il permesso "write"' };
  }

  const now = Date.now();
  if (!record.lastUsedAt || now - Date.parse(record.lastUsedAt) > 60_000) {
    record.lastUsedAt = new Date(now).toISOString();
    try {
      writeKeys(keys);
    } catch {
      // l'aggiornamento di lastUsedAt non deve bloccare la richiesta
    }
  }

  return { ok: true, key: toPublic(record) };
}
