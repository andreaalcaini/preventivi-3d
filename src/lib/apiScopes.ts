/**
 * Catalogo dei permessi delle chiavi API. Condiviso tra server e interfaccia (nessuna dipendenza Node).
 * Un permesso è "risorsa:azione". La scrittura include sempre la lettura della stessa risorsa.
 */

export type Role = 'admin' | 'operatore';
export type Access = 'none' | 'read' | 'write';

export interface ResourceDef {
  id: string;
  label: string;
  description: string;
  /** Azioni disponibili per la risorsa. */
  actions: Array<'read' | 'write'>;
  /** Ruolo minimo che può concedere ciascuna azione a una chiave. */
  minRole: { read: Role; write: Role };
}

export const RESOURCES: ResourceDef[] = [
  {
    id: 'quotes',
    label: 'Preventivi e lavori',
    description: 'Elenco, dettaglio e stato dei lavori; con scrittura crea richieste e cambia stato.',
    actions: ['read', 'write'],
    minRole: { read: 'operatore', write: 'operatore' },
  },
  {
    id: 'clients',
    label: 'Clienti',
    description: 'Anagrafica clienti ricavata dai lavori, con totali e saldo.',
    actions: ['read'],
    minRole: { read: 'operatore', write: 'admin' },
  },
  {
    id: 'inventory',
    label: 'Magazzino',
    description: 'Bobine e componenti; con scrittura aggiorna il peso residuo delle bobine.',
    actions: ['read', 'write'],
    minRole: { read: 'operatore', write: 'operatore' },
  },
  {
    id: 'maintenance',
    label: 'Manutenzione',
    description: 'Stampanti, contatori ore e interventi.',
    actions: ['read', 'write'],
    minRole: { read: 'operatore', write: 'operatore' },
  },
  {
    id: 'analytics',
    label: 'Statistiche e margini',
    description: 'Fatturato, utile e margini: dati economici riservati agli amministratori.',
    actions: ['read'],
    minRole: { read: 'admin', write: 'admin' },
  },
];

export type Scope = `${string}:${'read' | 'write'}`;

export const ALL_SCOPES: Scope[] = RESOURCES.flatMap(r => r.actions.map(a => `${r.id}:${a}` as Scope));

const ROLE_RANK: Record<Role, number> = { operatore: 1, admin: 2 };

export function scopeAllowedForRole(scope: Scope, role: Role): boolean {
  const [res, action] = scope.split(':') as [string, 'read' | 'write'];
  const def = RESOURCES.find(r => r.id === res);
  if (!def || !def.actions.includes(action)) return false;
  return ROLE_RANK[role] >= ROLE_RANK[def.minRole[action]];
}

/** Permessi validi, deduplicati, con la lettura aggiunta dove c'è la scrittura. */
export function normalizeScopes(input: unknown): Scope[] {
  if (!Array.isArray(input)) return [];
  const set = new Set<Scope>();
  for (const raw of input) {
    if (typeof raw !== 'string' || !ALL_SCOPES.includes(raw as Scope)) continue;
    set.add(raw as Scope);
    if (raw.endsWith(':write')) set.add(raw.replace(':write', ':read') as Scope);
  }
  return ALL_SCOPES.filter(s => set.has(s));
}

export function accessFor(scopes: Scope[], resource: string): Access {
  if (scopes.includes(`${resource}:write` as Scope)) return 'write';
  if (scopes.includes(`${resource}:read` as Scope)) return 'read';
  return 'none';
}

export interface Preset {
  id: string;
  label: string;
  description: string;
  scopes: Scope[];
}

export const PRESETS: Preset[] = [
  {
    id: 'assistant',
    label: 'Assistente AI',
    description: 'Risponde a domande su lavori, clienti e magazzino senza modificare nulla.',
    scopes: ['quotes:read', 'clients:read', 'inventory:read', 'maintenance:read'],
  },
  {
    id: 'production',
    label: 'Automazione produzione',
    description: 'Aggiorna lo stato dei lavori e scarica il magazzino.',
    scopes: ['quotes:read', 'quotes:write', 'inventory:read', 'inventory:write'],
  },
  {
    id: 'reporting',
    label: 'Report economici',
    description: 'Statistiche, margini e clienti in sola lettura.',
    scopes: ['analytics:read', 'clients:read', 'quotes:read'],
  },
  {
    id: 'full',
    label: 'Accesso completo',
    description: 'Tutto quello che il tuo ruolo consente.',
    scopes: ALL_SCOPES,
  },
];

export const RATE_LIMIT_OPTIONS = [30, 60, 120, 300, 600];

/**
 * Permesso richiesto da una richiesta API. `null` = endpoint non raggiungibile con una chiave.
 * `'*'` = basta una chiave valida (es. /api/v1/me).
 */
export function requiredScope(pathname: string, method: string): Scope | '*' | null {
  const write = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  const a = write ? 'write' : 'read';
  const p = pathname.replace(/\/+$/, '');

  if (p === '/api/v1/me' || p === '/api/v1') return write ? null : '*';
  if (p === '/api/v1/quotes' || p.startsWith('/api/v1/quotes/') || p === '/api/quotes') return `quotes:${a}`;
  if (p === '/api/v1/clients' || p.startsWith('/api/v1/clients/')) return write ? null : 'clients:read';
  if (p === '/api/v1/inventory' || p.startsWith('/api/v1/inventory/') || p === '/api/inventory' || p === '/api/inventory/consume') return `inventory:${a}`;
  if (p === '/api/v1/maintenance' || p === '/api/maintenance') return `maintenance:${a}`;
  if (p === '/api/v1/analytics' || p === '/api/analytics') return write ? null : 'analytics:read';
  return null;
}
