import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { readCatalog, writeCatalog, type CatalogItem } from '@/lib/catalog';
import { readQuotes, writeQuotes } from '@/lib/labData';
import { newOrderCode } from '@/lib/orderCode';
import { logActivity } from '@/lib/activity';

function session(request: NextRequest) {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}

const num = (v: unknown, max = 1e6) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0;
};

function sanitize(input: Partial<CatalogItem>, prev?: CatalogItem): CatalogItem {
  const now = new Date().toISOString();
  return {
    id: prev?.id || crypto.randomUUID(),
    name: String(input.name ?? prev?.name ?? 'Pezzo').trim().slice(0, 120) || 'Pezzo',
    description: String(input.description ?? prev?.description ?? '').slice(0, 1000),
    category: String(input.category ?? prev?.category ?? '').trim().slice(0, 60),
    material: String(input.material ?? prev?.material ?? 'PLA').slice(0, 60),
    color: String(input.color ?? prev?.color ?? '').slice(0, 60),
    weight: num(input.weight ?? prev?.weight),
    hours: Math.round(num(input.hours ?? prev?.hours, 10000)),
    mins: Math.round(num(input.mins ?? prev?.mins, 59)),
    price: Math.round(num(input.price ?? prev?.price) * 100) / 100,
    modelUrl: String(input.modelUrl ?? prev?.modelUrl ?? '').startsWith('/api/public/model?') ? String(input.modelUrl ?? prev?.modelUrl) : '',
    modelFileName: String(input.modelFileName ?? prev?.modelFileName ?? '').slice(0, 200),
    sourceQuoteId: String(input.sourceQuoteId ?? prev?.sourceQuoteId ?? ''),
    timesUsed: prev?.timesUsed || 0,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  };
}

export async function GET(request: NextRequest) {
  if (!session(request)) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  return NextResponse.json({ items: readCatalog() });
}

/**
 * POST /api/catalog
 * - { fromQuoteId }: crea una voce dal lavoro indicato
 * - { item }: crea o aggiorna una voce (con item.id esistente)
 * - { use: { id, clientName, clientContact, quantity } }: crea un nuovo lavoro dal catalogo a prezzo fisso
 */
export async function POST(request: NextRequest) {
  const s = session(request);
  if (!s) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const items = readCatalog();

  if (body?.fromQuoteId) {
    const q = readQuotes().find(x => String(x.id) === String(body.fromQuoteId));
    if (!q) return NextResponse.json({ error: 'Lavoro non trovato' }, { status: 404 });
    const qty = Math.max(1, Number(q.quantity) || 1);
    const item = sanitize({
      name: q.name,
      material: String(q.material || 'PLA'),
      color: String(q.preferredColor || ''),
      weight: Number(q.weight) || 0,
      hours: Number(q.hours) || 0,
      mins: Number(q.mins) || 0,
      price: (Number(q.totalCalculated) || 0) / qty,
      modelUrl: String(q.modelUrl || ''),
      modelFileName: String(q.modelFileName || ''),
      sourceQuoteId: String(q.id),
    });
    writeCatalog([item, ...items]);
    logActivity(s.username, 'catalogo', item.id, `Aggiunto al catalogo: ${item.name}`);
    return NextResponse.json({ item }, { status: 201 });
  }

  if (body?.item) {
    const prev = items.find(i => i.id === body.item.id);
    const item = sanitize(body.item, prev);
    writeCatalog(prev ? items.map(i => (i.id === item.id ? item : i)) : [item, ...items]);
    logActivity(s.username, 'catalogo', item.id, `${prev ? 'Modificato' : 'Aggiunto'} nel catalogo: ${item.name}`);
    return NextResponse.json({ item }, { status: prev ? 200 : 201 });
  }

  if (body?.use) {
    const item = items.find(i => i.id === body.use.id);
    if (!item) return NextResponse.json({ error: 'Voce non trovata' }, { status: 404 });
    const clientName = String(body.use.clientName || '').trim();
    if (!clientName) return NextResponse.json({ error: 'Indica il cliente' }, { status: 400 });
    const quantity = Math.max(1, Math.round(Number(body.use.quantity) || 1));
    const quotes = readQuotes();
    const id = newOrderCode(new Set(quotes.map(q => String(q.id))));
    const savedAt = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const quote = {
      id, name: item.name, clientName, clientContact: String(body.use.clientContact || '').slice(0, 120),
      pricingType: 'commerciale', makerWorldUrl: '', material: item.material, preferredColor: item.color, spoolId: '', spoolCost: 0,
      weight: item.weight, multiColor: false, colorChanges: 0, purgeWeight: 0, hours: item.hours, mins: item.mins,
      prepMins: 0, postMins: 0, extraBom: [], cadCost: 0, urgencyCost: 0, discount: 0, roundingMode: 'none', roundingStep: 0.5,
      modelUrl: item.modelUrl, modelFileName: item.modelFileName, quantity, savedAt,
      totalCalculated: Math.round(item.price * quantity * 100) / 100, estimatedProfit: 0,
      status: 'in_attesa' as const, inventoryDeducted: false, catalogItemId: item.id, weightSource: 'slicer',
    };
    writeQuotes([quote, ...quotes]);
    item.timesUsed += 1;
    writeCatalog(items);
    logActivity(s.username, 'lavori', id, `Nuovo lavoro dal catalogo: ${item.name} × ${quantity} per ${clientName}`);
    return NextResponse.json({ quote }, { status: 201 });
  }

  return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const s = session(request);
  if (!s) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  const id = request.nextUrl.searchParams.get('id');
  const items = readCatalog();
  const item = items.find(i => i.id === id);
  if (!item) return NextResponse.json({ error: 'Voce non trovata' }, { status: 404 });
  writeCatalog(items.filter(i => i.id !== id));
  logActivity(s.username, 'catalogo', item.id, `Rimosso dal catalogo: ${item.name}`);
  return NextResponse.json({ success: true });
}
