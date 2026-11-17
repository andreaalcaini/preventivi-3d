import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createBackupZip, restoreFromZip } from '@/lib/backup';
import { logActivity } from '@/lib/activity';

/**
 * Backup su Google Drive con OAuth 2.0 e permesso "drive.file":
 * l'app vede e gestisce solo i file che ha creato lei, non il resto del Drive.
 * Credenziali OAuth: variabili GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET oppure impostate dalla pagina Backup.
 * Il refresh token resta in data/drive.json (mai in Git, mai restituito al browser).
 */

export type DriveSchedule = 'off' | 'daily' | 'weekly';

interface DriveConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accountEmail: string;
  folderId: string;
  schedule: DriveSchedule;
  hour: number;
  keep: number;
  lastUploadAt: string | null;
  lastFileName: string | null;
  lastError: string | null;
  pendingState: { value: string; exp: number } | null;
}

export interface DriveStatus {
  configured: boolean;
  credentialsFromEnv: boolean;
  clientId: string;
  hasSecret: boolean;
  connected: boolean;
  accountEmail: string;
  schedule: DriveSchedule;
  hour: number;
  keep: number;
  lastUploadAt: string | null;
  lastFileName: string | null;
  lastError: string | null;
}

const SCOPE = 'https://www.googleapis.com/auth/drive.file openid email';
const FOLDER_NAME = 'Preventivi 3D Backup';
const filePath = path.join(process.cwd(), 'data', 'drive.json');

const DEFAULTS: DriveConfig = {
  clientId: '', clientSecret: '', refreshToken: '', accountEmail: '', folderId: '',
  schedule: 'daily', hour: 3, keep: 30, lastUploadAt: null, lastFileName: null, lastError: null, pendingState: null,
};

function read(): DriveConfig {
  try {
    if (fs.existsSync(filePath)) return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(filePath, 'utf-8')) };
  } catch { /* file danneggiato: valori predefiniti */ }
  return { ...DEFAULTS };
}

function write(cfg: DriveConfig) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), { encoding: 'utf-8', mode: 0o600 });
  fs.renameSync(tmp, filePath);
}

function credentials(cfg = read()) {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || cfg.clientId,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || cfg.clientSecret,
    fromEnv: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  };
}

export function driveStatus(): DriveStatus {
  const cfg = read();
  const c = credentials(cfg);
  return {
    configured: Boolean(c.clientId && c.clientSecret),
    credentialsFromEnv: c.fromEnv,
    clientId: c.clientId,
    hasSecret: Boolean(c.clientSecret),
    connected: Boolean(cfg.refreshToken),
    accountEmail: cfg.accountEmail,
    schedule: cfg.schedule,
    hour: cfg.hour,
    keep: cfg.keep,
    lastUploadAt: cfg.lastUploadAt,
    lastFileName: cfg.lastFileName,
    lastError: cfg.lastError,
  };
}

export function updateDriveSettings(input: { clientId?: string; clientSecret?: string; schedule?: string; hour?: number; keep?: number }) {
  const cfg = read();
  if (typeof input.clientId === 'string' && !process.env.GOOGLE_CLIENT_ID) {
    const id = input.clientId.trim();
    if (id && id !== cfg.clientId) { cfg.refreshToken = ''; cfg.accountEmail = ''; cfg.folderId = ''; }
    cfg.clientId = id.slice(0, 200);
  }
  if (typeof input.clientSecret === 'string' && input.clientSecret.trim() && !process.env.GOOGLE_CLIENT_SECRET) {
    cfg.clientSecret = input.clientSecret.trim().slice(0, 200);
  }
  if (input.schedule === 'off' || input.schedule === 'daily' || input.schedule === 'weekly') cfg.schedule = input.schedule;
  if (Number.isFinite(Number(input.hour))) cfg.hour = Math.min(23, Math.max(0, Math.round(Number(input.hour))));
  if (Number.isFinite(Number(input.keep))) cfg.keep = Math.min(365, Math.max(1, Math.round(Number(input.keep))));
  write(cfg);
  return driveStatus();
}

/* ---------- OAuth ---------- */

export function authUrl(redirectUri: string): string {
  const cfg = read();
  const { clientId, clientSecret } = credentials(cfg);
  if (!clientId || !clientSecret) throw new Error('Inserisci prima Client ID e Client Secret di Google');
  const state = crypto.randomBytes(24).toString('base64url');
  cfg.pendingState = { value: state, exp: Date.now() + 10 * 60_000 };
  write(cfg);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function completeAuth(code: string, state: string, redirectUri: string) {
  const cfg = read();
  if (!cfg.pendingState || cfg.pendingState.value !== state || cfg.pendingState.exp < Date.now()) {
    throw new Error('Richiesta di collegamento scaduta o non valida: riprova');
  }
  const { clientId, clientSecret } = credentials(cfg);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();
  if (!res.ok || !data.refresh_token) throw new Error(data.error_description || data.error || 'Google non ha restituito il token');
  let email = '';
  try {
    email = JSON.parse(Buffer.from(String(data.id_token).split('.')[1], 'base64url').toString('utf-8')).email || '';
  } catch { /* email facoltativa */ }
  cfg.refreshToken = data.refresh_token;
  cfg.accountEmail = email;
  cfg.folderId = '';
  cfg.pendingState = null;
  cfg.lastError = null;
  write(cfg);
  tokenCache = null;
}

export async function disconnectDrive() {
  const cfg = read();
  if (cfg.refreshToken) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(cfg.refreshToken)}`, { method: 'POST', signal: AbortSignal.timeout(10000) }).catch(() => {});
  }
  cfg.refreshToken = '';
  cfg.accountEmail = '';
  cfg.folderId = '';
  write(cfg);
  tokenCache = null;
}

let tokenCache: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const cfg = read();
  if (!cfg.refreshToken) throw new Error('Google Drive non è collegato');
  const { clientId, clientSecret } = credentials(cfg);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: cfg.refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();
  if (!res.ok) {
    if (data.error === 'invalid_grant') {
      cfg.refreshToken = '';
      cfg.lastError = 'Accesso a Google revocato o scaduto: collega di nuovo Drive';
      write(cfg);
    }
    throw new Error(data.error_description || data.error || 'Rinnovo del token non riuscito');
  }
  tokenCache = { token: data.access_token, exp: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
  return tokenCache.token;
}

async function gapi(url: string, init: RequestInit = {}) {
  const token = await accessToken();
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) }, signal: AbortSignal.timeout(120000) });
  if (!res.ok) {
    const text = await res.text();
    let msg = `Google Drive ${res.status}`;
    try { msg = JSON.parse(text).error?.message || msg; } catch { /* testo non JSON */ }
    throw new Error(msg);
  }
  return res;
}

async function ensureFolder(): Promise<string> {
  const cfg = read();
  if (cfg.folderId) {
    try {
      const r = await gapi(`https://www.googleapis.com/drive/v3/files/${cfg.folderId}?fields=id,trashed`);
      const f = await r.json();
      if (!f.trashed) return cfg.folderId;
    } catch { /* cartella eliminata: se ne crea una nuova */ }
  }
  const r = await gapi('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  const folder = await r.json();
  const fresh = read();
  fresh.folderId = folder.id;
  write(fresh);
  return folder.id;
}

export interface DriveBackupFile { id: string; name: string; size: number; createdTime: string }

export async function listDriveBackups(): Promise<DriveBackupFile[]> {
  const folderId = await ensureFolder();
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const r = await gapi(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&pageSize=200&fields=files(id,name,size,createdTime)`);
  const data = await r.json();
  return (data.files || []).map((f: { id: string; name: string; size?: string; createdTime: string }) => ({ ...f, size: Number(f.size) || 0 }));
}

/** Crea lo ZIP dei dati, lo carica su Drive e cancella le copie oltre il numero da conservare. */
export async function uploadBackupToDrive(trigger: 'manuale' | 'automatico', who = 'sistema') {
  const cfg = read();
  if (!cfg.refreshToken) throw new Error('Google Drive non è collegato');
  try {
    const folderId = await ensureFolder();
    const buffer = await createBackupZip();
    const name = `preventivi3d_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.zip`;
    const boundary = `p3d${crypto.randomBytes(12).toString('hex')}`;
    const meta = JSON.stringify({ name, parents: [folderId], mimeType: 'application/zip' });
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/zip\r\n\r\n`),
      buffer,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    await gapi('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });

    const files = await listDriveBackups();
    for (const old of files.slice(cfg.keep)) {
      await gapi(`https://www.googleapis.com/drive/v3/files/${old.id}`, { method: 'DELETE' }).catch(() => {});
    }

    const fresh = read();
    fresh.lastUploadAt = new Date().toISOString();
    fresh.lastFileName = name;
    fresh.lastError = null;
    write(fresh);
    logActivity(who, 'sistema', '', `Backup su Google Drive (${trigger}): ${name}, ${Math.round(buffer.length / 1024)} KB`);
    return { name, sizeBytes: buffer.length };
  } catch (err) {
    const fresh = read();
    fresh.lastError = err instanceof Error ? err.message : String(err);
    write(fresh);
    logActivity(who, 'sistema', '', `Backup su Google Drive non riuscito: ${fresh.lastError}`);
    throw err;
  }
}

export async function restoreFromDrive(fileId: string) {
  if (!/^[\w-]{10,}$/.test(fileId)) throw new Error('File non valido');
  const files = await listDriveBackups();
  if (!files.some(f => f.id === fileId)) throw new Error('Il file non è nella cartella dei backup');
  const r = await gapi(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
  return restoreFromZip(Buffer.from(await r.arrayBuffer()));
}

/* ---------- pianificazione automatica ---------- */

export function isBackupDue(now = new Date()): boolean {
  const cfg = read();
  if (cfg.schedule === 'off' || !cfg.refreshToken || !credentials(cfg).clientId) return false;
  if (now.getHours() < cfg.hour) return false;
  const last = cfg.lastUploadAt ? Date.parse(cfg.lastUploadAt) : 0;
  const minGap = cfg.schedule === 'daily' ? 20 * 3600_000 : 6.5 * 86_400_000;
  return now.getTime() - last >= minGap;
}

const g = globalThis as unknown as { __p3dDriveTimer?: NodeJS.Timeout };

/** Avviato una volta all'avvio del server (instrumentation.ts): controlla ogni 15 minuti se è ora del backup. */
export function startDriveScheduler() {
  if (g.__p3dDriveTimer) return;
  const tick = () => {
    if (isBackupDue()) uploadBackupToDrive('automatico').catch(() => { /* errore già registrato */ });
  };
  g.__p3dDriveTimer = setInterval(tick, 15 * 60_000);
  setTimeout(tick, 60_000);
}
