import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Messaggi tra cliente e laboratorio su un ordine.
 * File separato da quotes.json: la pagina Preventivi salva l'intero elenco lavori e sovrascriverebbe i messaggi arrivati nel frattempo.
 */

export type MessageAuthor = 'cliente' | 'laboratorio';

export interface OrderMessage {
  id: string;
  orderId: string;
  author: MessageAuthor;
  authorName: string;
  text: string;
  at: string;
  /** Solo per i messaggi del cliente: letto dal laboratorio. */
  readByLab?: boolean;
  /** Solo per i messaggi del laboratorio: letto dal cliente (aperto il tracking). */
  readByClient?: boolean;
}

export const MAX_MESSAGE_LENGTH = 1000;
const MAX_MESSAGES_PER_ORDER = 200;

const dataDir = path.join(process.cwd(), 'data');
const filePath = path.join(dataDir, 'order_messages.json');

function readAll(): OrderMessage[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(messages: OrderMessage[]) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(messages, null, 2), 'utf-8');
  fs.renameSync(tmp, filePath);
}

export function getMessages(orderId: string): OrderMessage[] {
  return readAll().filter(m => m.orderId === orderId).sort((a, b) => a.at.localeCompare(b.at));
}

export function addMessage(input: { orderId: string; author: MessageAuthor; authorName: string; text: string }):
  { message: OrderMessage } | { error: string } {
  const text = input.text.replace(/\r\n/g, '\n').trim();
  if (!text) return { error: 'Scrivi un messaggio' };
  if (text.length > MAX_MESSAGE_LENGTH) return { error: `Massimo ${MAX_MESSAGE_LENGTH} caratteri` };

  const all = readAll();
  if (all.filter(m => m.orderId === input.orderId).length >= MAX_MESSAGES_PER_ORDER) {
    return { error: 'Questa conversazione ha raggiunto il numero massimo di messaggi' };
  }
  const message: OrderMessage = {
    id: crypto.randomUUID(),
    orderId: input.orderId,
    author: input.author,
    authorName: input.authorName.trim().slice(0, 60),
    text,
    at: new Date().toISOString(),
    ...(input.author === 'cliente' ? { readByLab: false } : { readByClient: false }),
  };
  writeAll([...all, message]);
  return { message };
}

/** Segna come letti i messaggi dell'altra parte. */
export function markRead(orderId: string, reader: MessageAuthor) {
  const all = readAll();
  let changed = false;
  for (const m of all) {
    if (m.orderId !== orderId) continue;
    if (reader === 'laboratorio' && m.author === 'cliente' && !m.readByLab) { m.readByLab = true; changed = true; }
    if (reader === 'cliente' && m.author === 'laboratorio' && !m.readByClient) { m.readByClient = true; changed = true; }
  }
  if (changed) writeAll(all);
}

/** Riepilogo per il gestionale: numero di messaggi e non letti per ordine. */
export function summaryByOrder(): Record<string, { total: number; unread: number; lastAt: string; lastAuthor: MessageAuthor }> {
  const out: Record<string, { total: number; unread: number; lastAt: string; lastAuthor: MessageAuthor }> = {};
  for (const m of readAll()) {
    const s = (out[m.orderId] ||= { total: 0, unread: 0, lastAt: '', lastAuthor: m.author });
    s.total++;
    if (m.author === 'cliente' && !m.readByLab) s.unread++;
    if (m.at > s.lastAt) { s.lastAt = m.at; s.lastAuthor = m.author; }
  }
  return out;
}

export function deleteMessagesForOrder(orderId: string) {
  const all = readAll();
  const kept = all.filter(m => m.orderId !== orderId);
  if (kept.length !== all.length) writeAll(kept);
}

/* ---------- limite anti-abuso per i messaggi pubblici ---------- */
const g = globalThis as unknown as { __p3dMsgRate?: Map<string, number[]> };
export function allowPublicMessage(key: string, limit = 8, windowMs = 10 * 60_000): boolean {
  const rate = (g.__p3dMsgRate ||= new Map<string, number[]>());
  const now = Date.now();
  const hits = (rate.get(key) || []).filter(t => now - t < windowMs);
  if (hits.length >= limit) {
    rate.set(key, hits);
    return false;
  }
  hits.push(now);
  rate.set(key, hits);
  return true;
}
