import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const quotesFilePath = path.join(process.cwd(), 'data', 'quotes.json');

interface RawQuote {
  id: string;
  name: string;
  clientName: string;
  material: string;
  savedAt: string;
  totalCalculated: number;
  status?: string;
  multiColor?: boolean;
  extraBom?: Array<{ name: string; qty: number | string }>;
  makerWorldUrl?: string;
  modelUrl?: string;
  modelFileName?: string;
  [key: string]: unknown;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const codesParam = searchParams.get('codes') || searchParams.get('code');

    if (!codesParam || !codesParam.trim()) {
      return NextResponse.json({ error: 'Codice ordine mancante' }, { status: 400 });
    }

    const targetCodes = codesParam
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);

    if (targetCodes.length === 0) {
      return NextResponse.json({ error: 'Nessun codice valido fornito' }, { status: 400 });
    }

    if (!fs.existsSync(quotesFilePath)) {
      return NextResponse.json({ error: 'Nessun ordine registrato nel sistema' }, { status: 404 });
    }

    const raw = fs.readFileSync(quotesFilePath, 'utf-8');
    const quotes: RawQuote[] = JSON.parse(raw);

    // Trova tutti gli ordini corrispondenti ai codici richiesti
    const foundQuotes = quotes.filter(q => q.id && targetCodes.includes(q.id.toString().trim()));
    if (foundQuotes.length === 0) {
      return NextResponse.json({ error: 'Nessun ordine trovato con i codici inseriti.' }, { status: 404 });
    }

    // Ordina i pezzi mantenendo l'ordine dei codici richiesti oppure cronologico
    foundQuotes.sort((a, b) => {
      const idxA = targetCodes.indexOf(a.id.toString().trim());
      const idxB = targetCodes.indexOf(b.id.toString().trim());
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return (b.savedAt || '').localeCompare(a.savedAt || '');
    });

    // Restituisce unicamente i dati visibili al cliente - NESSUN dato interno di profitto, costo orario o filamento
    const sanitize = (q: RawQuote) => ({
      id: q.id,
      name: q.name || 'Oggetto di stampa 3D',
      clientName: q.clientName || 'Cliente',
      material: q.material || 'Standard',
      savedAt: q.savedAt || '',
      status: q.status || 'in_attesa',
      totalCalculated: typeof q.totalCalculated === 'number' ? q.totalCalculated : 0,
      multiColor: Boolean(q.multiColor),
      extraBom: Array.isArray(q.extraBom) ? q.extraBom.map(b => ({ name: b.name, qty: b.qty })) : [],
      makerWorldUrl: q.makerWorldUrl || '',
      modelUrl: q.modelUrl || '',
      modelFileName: q.modelFileName || ''
    });

    const sanitizedOrders = foundQuotes.map(sanitize);
    const totalAll = sanitizedOrders.reduce((sum, o) => sum + o.totalCalculated, 0);
    const totalDue = sanitizedOrders
      .filter(o => o.status !== 'saldato')
      .reduce((sum, o) => sum + o.totalCalculated, 0);

    return NextResponse.json({ 
      order: sanitizedOrders[0],
      orders: sanitizedOrders,
      totalAll,
      totalDue,
      clientName: sanitizedOrders[0]?.clientName || 'Cliente'
    });
  } catch {
    return NextResponse.json({ error: 'Errore durante la ricerca dell\'ordine' }, { status: 500 });
  }
}
