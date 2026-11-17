import { NextRequest, NextResponse } from 'next/server';
import { readQuotes, writeQuotes, consumeForQuote, JOB_STATUSES, type JobStatus } from '@/lib/labData';

/** GET /api/v1/quotes/{id}: dettaglio completo di un preventivo. */
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/v1/quotes/[id]'>) {
  const { id } = await ctx.params;
  const quote = readQuotes().find(q => q.id === id);
  if (!quote) return NextResponse.json({ error: 'Preventivo non trovato' }, { status: 404 });
  return NextResponse.json(quote);
}

/**
 * PATCH /api/v1/quotes/{id} con { "status": "in_stampa" }
 * Aggiorna lo stato del lavoro. Come nel gestionale, il primo passaggio a in_stampa o saldato scarica il magazzino.
 */
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/v1/quotes/[id]'>) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const status = body?.status as JobStatus | undefined;

  if (!status || !JOB_STATUSES.includes(status)) {
    return NextResponse.json({ error: `Indica status tra: ${JOB_STATUSES.join(', ')}` }, { status: 400 });
  }

  const quotes = readQuotes();
  const quote = quotes.find(q => q.id === id);
  if (!quote) return NextResponse.json({ error: 'Preventivo non trovato' }, { status: 404 });

  if ((status === 'in_stampa' || status === 'saldato') && !quote.inventoryDeducted) {
    consumeForQuote(quote);
    quote.inventoryDeducted = true;
  }
  quote.status = status;
  writeQuotes(quotes);

  return NextResponse.json({ success: true, id, status, inventoryDeducted: quote.inventoryDeducted === true });
}
