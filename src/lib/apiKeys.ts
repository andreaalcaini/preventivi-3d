import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getAllUsers, type User } from '@/lib/auth';
import {
  normalizeScopes, scopeAllowedForRole, requiredScope, RATE_LIMIT_OPTIONS,
  type Scope, type Role,
} from '@/lib/apiScopes';

/**
 * Chiavi API personali per integrare Preventivi 3D con agenti AI, automazioni e script.
 * - Ogni chiave appartiene a un utente e non può mai superare i permessi del suo ruolo attuale.
 * - Permessi per risorsa (lettura/scrittura), IP consentiti, limite di richieste al minuto, scadenza.
 * - Su disco resta solo l'hash SHA-256: la chiave in chiaro si vede una volta, alla creazione o rigenerazione.
 */

export interface ApiKeyRecord {
  id: string;
  name: string;
  description: string;
  prefix: string;
  hash: string;
  ownerId: string;
  ownerUsername: string;
  scopes: Scope[];
  allowedIps: string[];
  rateLimitPerMinute: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  rotatedAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

export type PublicApiKey = Omit<ApiKeyRecord, 'hash'> & { ownerActive: boolean; usage: KeyUsageSummary };

export interface UsageEvent { at: string; method: string; path: string; ip: string; status: number }
interface KeyUsage { total: number; denied: number; daily: Record<string, number>; recent: UsageEvent[] }
export interface KeyUsageSummary { total: number; denied: number; last7Days: number[]; recent: UsageEvent[] }

export interface Actor { id: string; username: string; role: Role }

export const API_KEY_PREFIX = 'p3d_';
const DEFAULT_RATE_LIMIT = 120;

const dataDir = path.join(process.cwd(), 'data');
const keysFilePath = path.join(dataDir, 'api_keys.json');
const usageFilePath = path.join(dataDir, 'api_key_usage.json');

/* ---------------- persistenza ---------------- */

function atomicWrite(file: string, value: unknown) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

/** Converte anche le chiavi della prima versione (scope "read" | "write", senza proprietario). */
function migrate(raw: Record<string, unknown>, users: User[]): ApiKeyRecord {
  const legacyScope = raw.scope as string | undefined;
  let scopes = normalizeScopes(raw.scopes);
  if (!Array.isArray(raw.scopes) && legacyScope) {
    scopes = normalizeScopes(legacyScope === 'write'
      ? ['quotes:write', 'clients:read', 'inventory:write', 'maintenance:write', 'analytics:read']
      : ['quotes:read', 'clients:read', 'inventory:read', 'maintenance:read', 'analytics:read']);
  }
  const owner = users.find(u => u.id === raw.ownerId) || users.find(u => u.username === raw.createdBy);
  const created = String(raw.createdAt || new Date().toISOString());
  return {
    id: String(raw.id),
    name: String(raw.name || 'Chiave'),
    description: String(raw.description || ''),
    prefix: String(raw.prefix || ''),
    hash: String(raw.hash || ''),
    ownerId: owner?.id || String(raw.ownerId || ''),
    ownerUsername: owner?.username || String(raw.ownerUsername || raw.createdBy || ''),
    scopes,
    allowedIps: Array.isArray(raw.allowedIps) ? (raw.allowedIps as string[]) : [],
    rateLimitPerMinute: Number(raw.rateLimitPerMinute) || DEFAULT_RATE_LIMIT,
    createdBy: String(raw.createdBy || ''),
    createdAt: created,
    updatedAt: String(raw.updatedAt || created),
    rotatedAt: (raw.rotatedAt as string) || null,
    lastUsedAt: (raw.lastUsedAt as string) || null,
    lastUsedIp: (raw.lastUsedIp as string) || null,
    expiresAt: (raw.expiresAt as string) || null,
    revokedAt: (raw.revokedAt as string) || null,
  };
}

function readKeys(): ApiKeyRecord[] {
  try {
    if (!fs.existsSync(keysFilePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(keysFilePath, 'utf-8'));
    if (!Array.isArray(parsed)) return [];
    const users = getAllUsers();
    return parsed.map(k => migrate(k, users));
  } catch {
    return [];
  }
}

function writeKeys(keys: ApiKeyRecord[]) {
  atomicWrite(keysFilePath, keys);
}

/* ---------------- statistiche d'uso (in memoria, salvate a intervalli) ---------------- */

const g = globalThis as unknown as {
  __p3dUsage?: Record<string, KeyUsage>;
  __p3dUsageTimer?: NodeJS.Timeout | null;
  __p3dRate?: Map<string, number[]>;
  __p3dLastSeenWrite?: Map<string, number>;
};

function usageStore(): Record<string, KeyUsage> {
  if (!g.__p3dUsage) {
    try {
      g.__p3dUsage = fs.existsSync(usageFilePath) ? JSON.parse(fs.readFileSync(usageFilePath, 'utf-8')) : {};
    } catch {
      g.__p3dUsage = {};
    }
  }
  return g.__p3dUsage!;
}

function scheduleUsageFlush() {
  if (g.__p3dUsageTimer) return;
  g.__p3dUsageTimer = setTimeout(() => {
    g.__p3dUsageTimer = null;
    try { atomicWrite(usageFilePath, usageStore()); } catch { /* non bloccante */ }
  }, 3000);
}

function recordUsage(keyId: string, event: UsageEvent) {
  const store = usageStore();
  const u = (store[keyId] ||= { total: 0, denied: 0, daily: {}, recent: [] });
  if (event.status < 400) u.total++; else u.denied++;
  const day = event.at.slice(0, 10);
  u.daily[day] = (u.daily[day] || 0) + 1;
  const days = Object.keys(u.daily).sort();
  while (days.length > 30) delete u.daily[days.shift()!];
  u.recent.unshift(event);
  u.recent.length = Math.min(u.recent.length, 50);
  scheduleUsageFlush();
}

function summarizeUsage(keyId: string): KeyUsageSummary {
  const u = usageStore()[keyId];
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86_400_000).toISOString().slice(0, 10);
    return u?.daily[d] || 0;
  });
  return { total: u?.total || 0, denied: u?.denied || 0, last7Days, recent: u?.recent.slice(0, 20) || [] };
}

/* ---------------- limite di richieste ---------------- */

function checkRateLimit(keyId: string, limit: number): { ok: boolean; remaining: number; retryAfter: number } {
  const rate = (g.__p3dRate ||= new Map<string, number[]>());
  const now = Date.now();
  const hits = (rate.get(keyId) || []).filter(t => now - t < 60_000);
  if (hits.length >= limit) {
    rate.set(keyId, hits);
    return { ok: false, remaining: 0, retryAfter: Math.ceil((60_000 - (now - hits[0])) / 1000) };
  }
  hits.push(now);
  rate.set(keyId, hits);
  return { ok: true, remaining: limit - hits.length, retryAfter: 0 };
}

/* ---------------- IP consentiti ---------------- */

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!/^\d+$/.test(p) || v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

export function validateIpRule(rule: string): boolean {
  const [ip, bits] = rule.split('/');
  if (bits !== undefined) return ipv4ToInt(ip) !== null && /^\d+$/.test(bits) && Number(bits) <= 32;
  return ipv4ToInt(ip) !== null || /^[0-9a-f:]+$/i.test(ip);
}

function ipMatches(ip: string, rule: string): boolean {
  const clean = ip.replace(/^::ffff:/, '');
  if (!rule.includes('/')) return clean === rule || ip === rule;
  const [base, bitsStr] = rule.split('/');
  const a = ipv4ToInt(clean), b = ipv4ToInt(base);
  if (a === null || b === null) return false;
  const bits = Number(bitsStr);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return ((a & mask) >>> 0) === ((b & mask) >>> 0);
}

export function clientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0].trim() || headers.get('x-real-ip')?.trim() || 'sconosciuto';
}

/* ---------------- vista pubblica ---------------- */

function toPublic(k: ApiKeyRecord, users: User[]): PublicApiKey {
  const { hash: _hash, ...rest } = k;
  return { ...rest, ownerActive: users.some(u => u.id === k.ownerId), usage: summarizeUsage(k.id) };
}

function canManage(actor: Actor, key: ApiKeyRecord) {
  return actor.role === 'admin' || key.ownerId === actor.id;
}

/* ---------------- operazioni ---------------- */

export function listApiKeys(actor: Actor): PublicApiKey[] {
  const users = getAllUsers();
  return readKeys()
    .filter(k => actor.role === 'admin' || k.ownerId === actor.id)
    .map(k => toPublic(k, users))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface KeyInput {
  name?: string;
  description?: string;
  scopes?: unknown;
  allowedIps?: unknown;
  rateLimitPerMinute?: unknown;
  expiresInDays?: unknown;
  ownerId?: unknown;
}

function validate(input: KeyInput, ownerRole: Role, partial: boolean):
  { error: string } | { values: Partial<ApiKeyRecord> } {
  const values: Partial<ApiKeyRecord> = {};

  if (!partial || input.name !== undefined) {
    const name = String(input.name ?? '').trim();
    if (!name || name.length > 60) return { error: 'Dai alla chiave un nome tra 1 e 60 caratteri' };
    values.name = name;
  }
  if (input.description !== undefined) {
    values.description = String(input.description).trim().slice(0, 280);
  }
  if (!partial || input.scopes !== undefined) {
    const scopes = normalizeScopes(input.scopes);
    if (scopes.length === 0) return { error: 'Seleziona almeno un permesso' };
    const denied = scopes.filter(s => !scopeAllowedForRole(s, ownerRole));
    if (denied.length) return { error: `Il ruolo ${ownerRole} non può concedere: ${denied.join(', ')}` };
    values.scopes = scopes;
  }
  if (input.allowedIps !== undefined) {
    const list = (Array.isArray(input.allowedIps) ? input.allowedIps : String(input.allowedIps).split(/[\s,]+/))
      .map(s => String(s).trim()).filter(Boolean);
    const bad = list.find(r => !validateIpRule(r));
    if (bad) return { error: `Indirizzo o rete non valida: ${bad}` };
    if (list.length > 20) return { error: 'Massimo 20 indirizzi consentiti' };
    values.allowedIps = list;
  }
  if (!partial || input.rateLimitPerMinute !== undefined) {
    const rl = Number(input.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT);
    values.rateLimitPerMinute = RATE_LIMIT_OPTIONS.includes(rl) ? rl : DEFAULT_RATE_LIMIT;
  }
  if (input.expiresInDays !== undefined) {
    const days = Number(input.expiresInDays);
    values.expiresAt = days > 0 ? new Date(Date.now() + Math.min(days, 3650) * 86_400_000).toISOString() : null;
  }
  return { values };
}

function newSecret() {
  const secret = `${API_KEY_PREFIX}${crypto.randomBytes(24).toString('base64url')}`;
  return { secret, prefix: secret.slice(0, API_KEY_PREFIX.length + 8), hash: hashKey(secret) };
}

function hashKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

export function createApiKey(actor: Actor, input: KeyInput): { key: PublicApiKey; secret: string } | { error: string } {
  const users = getAllUsers();
  // Un amministratore può creare una chiave a nome di un altro utente; gli operatori solo per sé
  const ownerId = actor.role === 'admin' && typeof input.ownerId === 'string' && input.ownerId ? input.ownerId : actor.id;
  const owner = users.find(u => u.id === ownerId);
  if (!owner) return { error: 'Utente proprietario non trovato' };

  const v = validate(input, owner.role, false);
  if ('error' in v) return v;

  const { secret, prefix, hash } = newSecret();
  const now = new Date().toISOString();
  const record: ApiKeyRecord = {
    id: crypto.randomUUID(),
    name: v.values.name!,
    description: v.values.description || '',
    prefix,
    hash,
    ownerId: owner.id,
    ownerUsername: owner.username,
    scopes: v.values.scopes!,
    allowedIps: v.values.allowedIps || [],
    rateLimitPerMinute: v.values.rateLimitPerMinute || DEFAULT_RATE_LIMIT,
    createdBy: actor.username,
    createdAt: now,
    updatedAt: now,
    rotatedAt: null,
    lastUsedAt: null,
    lastUsedIp: null,
    expiresAt: v.values.expiresAt ?? null,
    revokedAt: null,
  };
  writeKeys([...readKeys(), record]);
  return { key: toPublic(record, users), secret };
}

export function updateApiKey(actor: Actor, id: string, input: KeyInput): { key: PublicApiKey } | { error: string; status: number } {
  const keys = readKeys();
  const key = keys.find(k => k.id === id);
  if (!key || !canManage(actor, key)) return { error: 'Chiave non trovata', status: 404 };
  if (key.revokedAt) return { error: 'Una chiave revocata non si può modificare', status: 409 };

  const users = getAllUsers();
  const owner = users.find(u => u.id === key.ownerId);
  const v = validate(input, owner?.role || 'operatore', true);
  if ('error' in v) return { error: v.error, status: 400 };

  Object.assign(key, v.values, { updatedAt: new Date().toISOString() });
  writeKeys(keys);
  return { key: toPublic(key, users) };
}

export function rotateApiKey(actor: Actor, id: string): { key: PublicApiKey; secret: string } | { error: string; status: number } {
  const keys = readKeys();
  const key = keys.find(k => k.id === id);
  if (!key || !canManage(actor, key)) return { error: 'Chiave non trovata', status: 404 };
  if (key.revokedAt) return { error: 'Una chiave revocata non si può rigenerare', status: 409 };
  const { secret, prefix, hash } = newSecret();
  const now = new Date().toISOString();
  Object.assign(key, { prefix, hash, rotatedAt: now, updatedAt: now });
  writeKeys(keys);
  return { key: toPublic(key, getAllUsers()), secret };
}

export function revokeApiKey(actor: Actor, id: string): boolean {
  const keys = readKeys();
  const key = keys.find(k => k.id === id);
  if (!key || key.revokedAt || !canManage(actor, key)) return false;
  key.revokedAt = new Date().toISOString();
  key.updatedAt = key.revokedAt;
  writeKeys(keys);
  return true;
}

export function deleteApiKey(actor: Actor, id: string): boolean {
  const keys = readKeys();
  const key = keys.find(k => k.id === id);
  if (!key || !canManage(actor, key)) return false;
  writeKeys(keys.filter(k => k.id !== id));
  const store = usageStore();
  delete store[id];
  scheduleUsageFlush();
  return true;
}

/* ---------------- verifica delle richieste ---------------- */

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

export interface KeyContext {
  id: string;
  name: string;
  ownerId: string;
  ownerUsername: string;
  ownerRole: Role;
  scopes: Scope[];
  rateLimitPerMinute: number;
  expiresAt: string | null;
}

export type ApiKeyCheck =
  | { ok: true; key: KeyContext; rate: { limit: number; remaining: number } }
  | { ok: false; status: 401 | 403 | 429; error: string; retryAfter?: number; rate?: { limit: number; remaining: number } };

export function authorizeApiKey(rawKey: string, pathname: string, method: string, ip: string): ApiKeyCheck {
  const keys = readKeys();
  const hashed = Buffer.from(hashKey(rawKey), 'hex');
  const record = keys.find(k => {
    const candidate = Buffer.from(k.hash, 'hex');
    return candidate.length === hashed.length && crypto.timingSafeEqual(candidate, hashed);
  });

  if (!record || record.revokedAt) return { ok: false, status: 401, error: 'Chiave API non valida o revocata' };

  const log = (status: number) =>
    recordUsage(record.id, { at: new Date().toISOString(), method, path: pathname, ip, status });

  if (record.expiresAt && Date.parse(record.expiresAt) < Date.now()) {
    log(401);
    return { ok: false, status: 401, error: 'Chiave API scaduta' };
  }

  const owner = getAllUsers().find(u => u.id === record.ownerId);
  if (!owner) {
    log(401);
    return { ok: false, status: 401, error: "L'utente proprietario della chiave non esiste più" };
  }

  if (record.allowedIps.length && !record.allowedIps.some(rule => ipMatches(ip, rule))) {
    log(403);
    return { ok: false, status: 403, error: `Indirizzo ${ip} non autorizzato per questa chiave` };
  }

  // I permessi effettivi seguono il ruolo attuale del proprietario
  const effective = record.scopes.filter(s => scopeAllowedForRole(s, owner.role));
  const needed = requiredScope(pathname, method);
  if (needed === null) {
    log(403);
    return { ok: false, status: 403, error: 'Endpoint non disponibile con una chiave API' };
  }
  if (needed !== '*' && !effective.includes(needed)) {
    log(403);
    return { ok: false, status: 403, error: `Permesso mancante: ${needed}` };
  }

  const rl = checkRateLimit(record.id, record.rateLimitPerMinute);
  if (!rl.ok) {
    log(429);
    return { ok: false, status: 429, error: 'Troppe richieste, riprova più tardi', retryAfter: rl.retryAfter, rate: { limit: record.rateLimitPerMinute, remaining: 0 } };
  }

  log(200);
  const lastSeen = (g.__p3dLastSeenWrite ||= new Map<string, number>());
  const now = Date.now();
  if (now - (lastSeen.get(record.id) || 0) > 60_000 || record.lastUsedIp !== ip) {
    lastSeen.set(record.id, now);
    record.lastUsedAt = new Date(now).toISOString();
    record.lastUsedIp = ip;
    try { writeKeys(keys); } catch { /* non bloccante */ }
  }

  return {
    ok: true,
    key: {
      id: record.id, name: record.name, ownerId: owner.id, ownerUsername: owner.username, ownerRole: owner.role,
      scopes: effective, rateLimitPerMinute: record.rateLimitPerMinute, expiresAt: record.expiresAt,
    },
    rate: { limit: record.rateLimitPerMinute, remaining: rl.remaining },
  };
}
