import { NextRequest, NextResponse } from 'next/server';
import { readQuotes, summarizeQuote, JOB_STATUSES, type JobStatus } from '@/lib/labData';

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
