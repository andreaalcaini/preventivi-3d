import { NextRequest, NextResponse } from 'next/server';
import { readQuotes, writeQuotes, summarizeQuote, JOB_STATUSES, type JobStatus, type QuoteRecord } from '@/lib/labData';
import { broadcastLabNotification } from '@/lib/notification-bus';
import { actorLabel } from '@/lib/keyContext';

/**
 * GET /api/v1/quotes?status=in_attesa&client=mario&q=supporto&limit=50
 * Elenco preventivi e lavori, dal più recente.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const status = params.get('status');
  const client = params.get('client')?.toLowerCase();
  const query = params.get('q')?.toLowerCase();
  const limit = Math.min(Math.max(Number(params.get('limit')) || 50, 1), 500);

  if (status && !JOB_STATUSES.includes(status as JobStatus)) {
    return NextResponse.json({ error: `status non valido, valori ammessi: ${JOB_STATUSES.join(', ')}` }, { status: 400 });
  }

  const items = readQuotes()
    .map(summarizeQuote)
    .filter(q => (status ? q.status === status : true))
    .filter(q => (client ? q.clientName.toLowerCase().includes(client) : true))
    .filter(q => (query ? `${q.name} ${q.material} ${q.clientName}`.toLowerCase().includes(query) : true))
    .reverse();

  return NextResponse.json({ total: items.length, items: items.slice(0, limit) });
}

/**
 * POST /api/v1/quotes: registra una nuova richiesta (stato "richiesta") da quotare nel calcolatore.
 * Campi: name*, clientName*, clientContact, material, color, quantity, description, weightGrams, printTimeMinutes, makerWorldUrl
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const clientName = typeof body?.clientName === 'string' ? body.clientName.trim() : '';
  if (!name || !clientName) {
    return NextResponse.json({ error: 'name e clientName sono obbligatori' }, { status: 400 });
  }

  const minutes = Math.max(0, Number(body.printTimeMinutes) || 0);
  const now = new Date();
  const savedAt = now.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const id = Date.now().toString();

  const quote: QuoteRecord = {
    id,
    name: name.slice(0, 120),
    clientName: clientName.slice(0, 120),
    clientContact: String(body.clientContact || '').slice(0, 120),
    description: String(body.description || '').slice(0, 2000),
    pricingType: 'richiesta_cliente',
    makerWorldUrl: String(body.makerWorldUrl || ''),
    material: String(body.material || 'PLA'),
    preferredColor: String(body.color || 'Da concordare'),
    quantity: Math.max(1, Math.round(Number(body.quantity) || 1)),
    spoolCost: 0,
    weight: Math.max(0, Number(body.weightGrams) || 0),
    multiColor: false,
    colorChanges: 0,
    purgeWeight: 0,
    hours: Math.floor(minutes / 60),
    mins: Math.round(minutes % 60),
    prepMins: 0,
    postMins: 0,
    extraBom: [],
    cadCost: 0,
    urgencyCost: 0,
    discount: 0,
    savedAt,
    totalCalculated: 0,
    estimatedProfit: 0,
    status: 'richiesta',
    inventoryDeducted: false,
    source: actorLabel(request),
  };

  writeQuotes([quote, ...readQuotes()]);

  try {
    broadcastLabNotification({
      type: 'quote_request',
      title: 'Nuova richiesta via API',
      projectName: quote.name,
      clientName: quote.clientName || '',
      clientContact: quote.clientContact || '',
      totalCalculated: 0,
      material: quote.material || '',
      dateStr: savedAt,
      trackingUrl: `/ordine?code=${id}`,
    });
  } catch {
    // la notifica in-app non deve far fallire la creazione
  }

  return NextResponse.json({ success: true, id, trackingUrl: `/ordine?code=${id}`, quote: summarizeQuote(quote) }, { status: 201 });
}
