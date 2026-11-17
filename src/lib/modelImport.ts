/**
 * Importazione modelli dai principali siti di file 3D.
 * - Printables: API GraphQL pubblica (metadati e download STL/3MF), nessuna chiave.
 * - Thingiverse: API ufficiale, richiede THINGIVERSE_TOKEN (gratuito, da thingiverse.com/developers).
 * - MyMiniFactory: API ufficiale, richiede MYMINIFACTORY_API_KEY.
 * - Altri siti (Cults3D, Thangs, ...): titolo e immagine dai metadati Open Graph, senza file.
 * MakerWorld resta gestito da /api/makerworld, che legge anche tempi e grammi dei profili.
 */

import { lookup } from 'dns/promises';
import net from 'net';

export type ImportSource = 'printables' | 'thingiverse' | 'myminifactory' | 'cults3d' | 'thangs' | 'generic';

export interface ImportedFile {
  name: string;
  size: number | null;
  /** URL sorgente; il browser lo scarica tramite /api/public/model-import/file (proxy con lista di host consentiti). */
  url: string;
}

export interface ImportedModel {
  source: ImportSource;
  sourceLabel: string;
  url: string;
  title: string;
  author: string;
  license: string;
  summary: string;
  images: string[];
  files: ImportedFile[];
  /** Spiega perché non ci sono file (es. token mancante o sito senza API pubblica). */
  note?: string;
}

const UA = 'Mozilla/5.0 (compatible; Preventivi3D/1.0)';

/** Host da cui il proxy può scaricare file 3D. */
export const ALLOWED_FILE_HOSTS = [
  'files.printables.com',
  'cdn.thingiverse.com',
  'thingiverse-production-new.s3.amazonaws.com',
  'cdn.thingiverse.com',
  'dl.myminifactory.com',
  'www.myminifactory.com',
];

export const SOURCE_LABELS: Record<ImportSource, string> = {
  printables: 'Printables',
  thingiverse: 'Thingiverse',
  myminifactory: 'MyMiniFactory',
  cults3d: 'Cults3D',
  thangs: 'Thangs',
  generic: 'Sito web',
};

export function detectSource(raw: string): { source: ImportSource; id: string | null } | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.replace(/^www\./, '');
  if (host.endsWith('printables.com')) {
    const m = u.pathname.match(/\/model\/(\d+)/);
    return { source: 'printables', id: m?.[1] ?? null };
  }
  if (host.endsWith('thingiverse.com')) {
    const m = u.pathname.match(/thing:(\d+)/) || u.href.match(/thing:(\d+)/);
    return { source: 'thingiverse', id: m?.[1] ?? null };
  }
  if (host.endsWith('myminifactory.com')) {
    const m = u.pathname.match(/-(\d+)\/?$/) || u.pathname.match(/\/(\d+)\/?$/);
    return { source: 'myminifactory', id: m?.[1] ?? null };
  }
  if (host.endsWith('cults3d.com')) return { source: 'cults3d', id: null };
  if (host.endsWith('thangs.com')) return { source: 'thangs', id: null };
  if (host.endsWith('makerworld.com')) return null;
  return { source: 'generic', id: null };
}

const isModelFile = (name: string) => /\.(stl|3mf)$/i.test(name);

async function fetchJson(url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers || {}) }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ---------- Printables ---------- */
const PRINTABLES_GQL = 'https://api.printables.com/graphql/';
const PRINTABLES_MEDIA = 'https://media.printables.com/';

async function importPrintables(id: string, url: string): Promise<ImportedModel> {
  const data = await fetchJson(PRINTABLES_GQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'query($id: ID!){ print(id:$id){ id name summary user{ publicUsername } license{ name } image{ filePath } images{ filePath } stls{ id name fileSize } } }',
      variables: { id },
    }),
  });
  const p = data?.data?.print;
  if (!p) throw new Error('Modello Printables non trovato');

  const candidates = (p.stls || []).filter((f: { name: string }) => isModelFile(f.name)).slice(0, 10);
  const files: ImportedFile[] = [];
  for (const f of candidates) {
    try {
      const link = await fetchJson(PRINTABLES_GQL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'mutation($id: ID!, $printId: ID!){ getDownloadLink(id:$id, printId:$printId, fileType: stl, source: model_detail){ ok output { link } } }',
          variables: { id: f.id, printId: id },
        }),
      });
      const href = link?.data?.getDownloadLink?.output?.link;
      if (href) files.push({ name: f.name, size: Number(f.fileSize) || null, url: href });
    } catch {
      // un file non scaricabile non blocca gli altri
    }
  }

  const images = [p.image, ...(p.images || [])]
    .filter(Boolean)
    .map((i: { filePath: string }) => PRINTABLES_MEDIA + i.filePath);

  return {
    source: 'printables',
    sourceLabel: SOURCE_LABELS.printables,
    url,
    title: p.name || 'Modello Printables',
    author: p.user?.publicUsername || '',
    license: p.license?.name || '',
    summary: p.summary || '',
    images: [...new Set(images)].slice(0, 8) as string[],
    files,
    note: files.length === 0 ? 'Nessun file STL o 3MF scaricabile per questo modello.' : undefined,
  };
}

/* ---------- Thingiverse ---------- */
async function importThingiverse(id: string, url: string): Promise<ImportedModel> {
  const token = process.env.THINGIVERSE_TOKEN;
  if (!token) {
    const og = await importOpenGraph(url, 'thingiverse').catch(() => null);
    return {
      ...(og || emptyModel('thingiverse', url)),
      note: 'Per scaricare i file da Thingiverse serve un token API: impostalo nella variabile THINGIVERSE_TOKEN del server.',
    };
  }
  const auth = { Authorization: `Bearer ${token}` };
  let thing;
  try {
    thing = await fetchJson(`https://api.thingiverse.com/things/${id}`, { headers: auth });
  } catch {
    // Thingiverse a volte risponde con la verifica anti-bot di Cloudflare: niente file, ma un messaggio chiaro
    return {
      ...emptyModel('thingiverse', url),
      title: `Thingiverse thing:${id}`,
      note: 'Thingiverse in questo momento blocca le richieste automatiche: scarica il file STL dalla pagina del modello e caricalo qui.',
    };
  }
  const list = await fetchJson(`https://api.thingiverse.com/things/${id}/files`, { headers: auth }).catch(() => []);
  const files: ImportedFile[] = (Array.isArray(list) ? list : [])
    .filter((f: { name: string }) => isModelFile(f.name))
    .slice(0, 10)
    .map((f: { name: string; size?: number; direct_url?: string; download_url?: string }) => ({
      name: f.name,
      size: f.size ?? null,
      url: f.direct_url || `${f.download_url}?access_token=${encodeURIComponent(token)}`,
    }));
  return {
    source: 'thingiverse',
    sourceLabel: SOURCE_LABELS.thingiverse,
    url,
    title: thing.name || 'Modello Thingiverse',
    author: thing.creator?.name || '',
    license: thing.license || '',
    summary: String(thing.description || '').slice(0, 400),
    images: [thing.default_image?.url || thing.thumbnail].filter(Boolean),
    files,
    note: files.length === 0 ? 'Nessun file STL o 3MF disponibile per questo modello.' : undefined,
  };
}

/* ---------- MyMiniFactory ---------- */
async function importMyMiniFactory(id: string, url: string): Promise<ImportedModel> {
  const key = process.env.MYMINIFACTORY_API_KEY;
  if (!key) {
    const og = await importOpenGraph(url, 'myminifactory').catch(() => null);
    return { ...(og || emptyModel('myminifactory', url)), note: 'Per i file da MyMiniFactory serve la chiave MYMINIFACTORY_API_KEY sul server.' };
  }
  const obj = await fetchJson(`https://www.myminifactory.com/api/v2/objects/${id}?key=${encodeURIComponent(key)}`);
  const files: ImportedFile[] = (obj.files?.items || [])
    .filter((f: { filename: string }) => isModelFile(f.filename))
    .slice(0, 10)
    .map((f: { filename: string; size?: number; download_url?: string }) => ({ name: f.filename, size: f.size ?? null, url: f.download_url || '' }))
    .filter((f: ImportedFile) => f.url);
  return {
    source: 'myminifactory',
    sourceLabel: SOURCE_LABELS.myminifactory,
    url,
    title: obj.name || 'Modello MyMiniFactory',
    author: obj.designer?.name || obj.designer?.username || '',
    license: obj.license || '',
    summary: String(obj.description || '').replace(/<[^>]+>/g, '').slice(0, 400),
    images: (obj.images || []).map((i: { original?: { url?: string } }) => i.original?.url).filter(Boolean).slice(0, 8),
    files,
    note: files.length === 0 ? 'Il modello non ha file scaricabili pubblicamente (potrebbe essere a pagamento).' : undefined,
  };
}

/* ---------- protezione SSRF: solo host pubblici ---------- */
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (!/^https?:$/.test(u.protocol)) throw new Error('Solo link http/https');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!host.includes('.') || /\.(local|lan|home|internal|mesh)$/i.test(host)) throw new Error('Indirizzo non consentito');
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addrs.length === 0 || addrs.some(a => isPrivateIp(a.address))) throw new Error('Indirizzo non consentito');
  return u;
}

/** fetch che segue i redirect a mano, verificando ogni destinazione. */
export async function safeFetch(raw: string, init: RequestInit = {}, maxRedirects = 3): Promise<Response> {
  let current = raw;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublicUrl(current);
    const res = await fetch(current, { ...init, redirect: 'manual' });
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      current = new URL(loc, current).toString();
      continue;
    }
    return res;
  }
  throw new Error('Troppi reindirizzamenti');
}

/* ---------- Open Graph (qualsiasi sito) ---------- */
function emptyModel(source: ImportSource, url: string): ImportedModel {
  return { source, sourceLabel: SOURCE_LABELS[source], url, title: '', author: '', license: '', summary: '', images: [], files: [] };
}

async function importOpenGraph(url: string, source: ImportSource): Promise<ImportedModel> {
  const res = await safeFetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = (await res.text()).slice(0, 400_000);
  const meta = (prop: string) =>
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1] ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))?.[1] || '';
  const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const title = decode(meta('og:title') || html.match(/<title>([^<]+)<\/title>/i)?.[1] || '');
  const image = decode(meta('og:image'));
  return {
    ...emptyModel(source, url),
    title: title.trim(),
    summary: decode(meta('og:description')).slice(0, 400),
    images: image ? [image] : [],
    note: 'Da questo sito si importano solo titolo e immagine: scarica il file STL o 3MF e caricalo qui.',
  };
}

export async function importModel(rawUrl: string): Promise<ImportedModel> {
  const detected = detectSource(rawUrl);
  if (!detected) throw new Error('Link non riconosciuto');
  const url = rawUrl.trim();
  switch (detected.source) {
    case 'printables':
      if (!detected.id) throw new Error('Link Printables senza ID modello');
      return importPrintables(detected.id, url);
    case 'thingiverse':
      if (!detected.id) throw new Error('Link Thingiverse senza ID (thing:123)');
      return importThingiverse(detected.id, url);
    case 'myminifactory':
      if (!detected.id) throw new Error('Link MyMiniFactory senza ID modello');
      return importMyMiniFactory(detected.id, url);
    default:
      try {
        return await importOpenGraph(url, detected.source);
      } catch (err) {
        if (err instanceof Error && err.message === 'Indirizzo non consentito') throw err;
        return {
          ...emptyModel(detected.source, url),
          note: `${SOURCE_LABELS[detected.source]} non permette la lettura automatica: scarica il file STL o 3MF dal sito e caricalo qui.`,
        };
      }
  }
}
