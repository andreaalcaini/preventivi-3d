/**
 * Produzione: pianificazione, tracciabilità, consuntivo, scarti e controllo qualità di un lavoro.
 * Tipi e calcoli puri, usati sia dal server sia dall'interfaccia.
 */

export interface FailedAttempt {
  id: string;
  at: string;
  grams: number;
  minutes: number;
  reason: string;
  spoolId?: string;
  printerId?: string;
}

export interface QualityCheck {
  result: 'ok' | 'ristampa' | 'scarto' | null;
  checklist: { dimensioni: boolean; superficie: boolean; pulizia: boolean; quantita: boolean };
  notes: string;
  photos: string[];
  at: string | null;
  by: string | null;
}

export interface ProductionInfo {
  printerId?: string;
  /** ISO, inizio pianificato */
  plannedStart?: string | null;
  /** Durata pianificata in minuti (predefinita: tempo di stampa × quantità) */
  plannedMinutes?: number | null;
  /** Data di consegna promessa al cliente (YYYY-MM-DD) */
  dueDate?: string | null;
  failures?: FailedAttempt[];
  qc?: QualityCheck;
}

export interface ActualUsage {
  grams: number;
  hours: number;
  recordedAt: string;
}

export interface ProductionQuote {
  id: string;
  name: string;
  clientName?: string;
  status?: string;
  material?: string;
  spoolId?: string;
  quantity?: number;
  weight?: number | string;
  purgeWeight?: number | string;
  hours?: number | string;
  mins?: number | string;
  totalCalculated?: number;
  estimatedProfit?: number;
  urgent?: boolean;
  savedAt?: string;
  production?: ProductionInfo;
  actual?: ActualUsage | null;
}

export const EMPTY_QC: QualityCheck = {
  result: null,
  checklist: { dimensioni: false, superficie: false, pulizia: false, quantita: false },
  notes: '',
  photos: [],
  at: null,
  by: null,
};

export const QC_LABELS: Record<keyof QualityCheck['checklist'], string> = {
  dimensioni: 'Misure e incastri verificati',
  superficie: 'Superficie e layer senza difetti',
  pulizia: 'Supporti rimossi e pezzo pulito',
  quantita: 'Numero di pezzi corretto',
};

export function qty(q: ProductionQuote) {
  return Math.max(1, Number(q.quantity) || 1);
}

/** Minuti di stampa previsti per l'intero lavoro (tutti i pezzi). */
export function estimatedMinutes(q: ProductionQuote) {
  return Math.max(1, Math.round(((Number(q.hours) || 0) * 60 + (Number(q.mins) || 0)) * qty(q)));
}

export function estimatedGrams(q: ProductionQuote) {
  return Math.round(((parseFloat(String(q.weight ?? 0)) || 0) + (parseFloat(String(q.purgeWeight ?? 0)) || 0)) * qty(q));
}

export function plannedMinutes(q: ProductionQuote) {
  return Math.max(1, Number(q.production?.plannedMinutes) || estimatedMinutes(q));
}

export function plannedEnd(q: ProductionQuote): Date | null {
  const start = q.production?.plannedStart;
  if (!start) return null;
  return new Date(Date.parse(start) + plannedMinutes(q) * 60_000);
}

/** true se la fine pianificata supera la consegna promessa (fine giornata). */
export function isLate(q: ProductionQuote): boolean {
  const end = plannedEnd(q);
  const due = q.production?.dueDate;
  if (!end || !due) return false;
  return end.getTime() > Date.parse(`${due}T23:59:59`);
}

export function wasteGrams(q: ProductionQuote) {
  return (q.production?.failures || []).reduce((s, f) => s + (Number(f.grams) || 0), 0);
}

export function wasteMinutes(q: ProductionQuote) {
  return (q.production?.failures || []).reduce((s, f) => s + (Number(f.minutes) || 0), 0);
}

/**
 * Costo reale: filamento consumato (pezzi + tentativi falliti) al prezzo della bobina
 * e ore macchina (stampa reale + tentativi falliti) alla tariffa del listino.
 */
export function realCost(q: ProductionQuote, opts: { costPerKg: number; machineRatePerHour: number; setupFee: number }) {
  const grams = (q.actual?.grams ?? estimatedGrams(q)) + wasteGrams(q);
  const hours = (q.actual?.hours ?? estimatedMinutes(q) / 60) + wasteMinutes(q) / 60;
  const material = (grams / 1000) * opts.costPerKg;
  const machine = hours * opts.machineRatePerHour;
  const setup = opts.setupFee * qty(q);
  const total = material + machine + setup;
  const revenue = Number(q.totalCalculated) || 0;
  return {
    grams: Math.round(grams),
    hours: Math.round(hours * 100) / 100,
    cost: Math.round(total * 100) / 100,
    margin: Math.round((revenue - total) * 100) / 100,
    marginPct: revenue > 0 ? Math.round(((revenue - total) / revenue) * 1000) / 10 : 0,
  };
}

/**
 * Pianificazione automatica: ordina i lavori da fare (urgenti, poi per consegna, poi per data di arrivo)
 * e li assegna alla stampante operativa che si libera prima, a partire da `from`.
 * I lavori già pianificati occupano le loro fasce e non vengono spostati.
 */
export function autoSchedule(
  quotes: ProductionQuote[],
  printers: Array<{ id: string; status?: string }>,
  from: Date,
): Array<{ id: string; printerId: string; plannedStart: string }> {
  const active = printers.filter(p => !p.status || p.status === 'operativa');
  if (active.length === 0) return [];
  const freeAt = new Map<string, number>(active.map(p => [p.id, from.getTime()]));

  for (const q of quotes) {
    const pid = q.production?.printerId;
    const end = plannedEnd(q);
    if (pid && end && freeAt.has(pid) && end.getTime() > freeAt.get(pid)!) freeAt.set(pid, end.getTime());
  }

  const todo = quotes
    .filter(q => (q.status === 'in_attesa' || q.status === 'richiesta') && !q.production?.plannedStart && estimatedMinutes(q) > 1)
    .sort((a, b) => {
      if (Boolean(b.urgent) !== Boolean(a.urgent)) return Number(Boolean(b.urgent)) - Number(Boolean(a.urgent));
      const da = a.production?.dueDate || '9999-12-31';
      const db = b.production?.dueDate || '9999-12-31';
      if (da !== db) return da.localeCompare(db);
      return String(a.savedAt || '').localeCompare(String(b.savedAt || ''));
    });

  const out: Array<{ id: string; printerId: string; plannedStart: string }> = [];
  for (const q of todo) {
    const preferred = q.production?.printerId && freeAt.has(q.production.printerId) ? q.production.printerId : null;
    const [pid, at] = preferred
      ? [preferred, freeAt.get(preferred)!]
      : [...freeAt.entries()].sort((a, b) => a[1] - b[1])[0];
    out.push({ id: q.id, printerId: pid, plannedStart: new Date(at).toISOString() });
    freeAt.set(pid, at + plannedMinutes(q) * 60_000);
  }
  return out;
}
