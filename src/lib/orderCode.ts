import crypto from 'crypto';

/**
 * Codici ordine casuali e leggibili (es. "K7QF-M2XA-9H"): circa 50 bit di entropia,
 * senza caratteri ambigui (0/O, 1/I/L). Sostituiscono i codici basati sull'ora, indovinabili.
 * I vecchi codici numerici restano validi.
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function newOrderCode(existing?: Set<string>): string {
  for (;;) {
    const bytes = crypto.randomBytes(10);
    let raw = '';
    for (const b of bytes) raw += ALPHABET[b % ALPHABET.length];
    const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 10)}`;
    if (!existing?.has(code)) return code;
  }
}
