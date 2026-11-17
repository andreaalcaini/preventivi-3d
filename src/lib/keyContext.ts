import type { NextRequest } from 'next/server';
import type { KeyContext } from '@/lib/apiKeys';

/** Contesto della chiave API impostato dal proxy (le intestazioni x-p3d-* in ingresso vengono scartate). */
export function getKeyContext(request: NextRequest | Request): KeyContext | null {
  const raw = request.headers.get('x-p3d-key');
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as KeyContext;
  } catch {
    return null;
  }
}

/** Etichetta di chi ha fatto la modifica, per lo storico dei lavori. */
export function actorLabel(request: NextRequest | Request): string {
  const key = getKeyContext(request);
  return key ? `api:${key.name} (${key.ownerUsername})` : 'gestionale';
}
