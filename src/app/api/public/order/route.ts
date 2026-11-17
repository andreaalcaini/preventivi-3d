import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getMessages } from '@/lib/orderMessages';

const quotesFilePath = path.join(process.cwd(), 'data', 'quotes.json');

interface RawQuote {
  id: string;
  name: string;
  clientName: string;
  material: string;
  savedAt: string;
  totalCalculated: number;
  status?: string;
  quantity?: number;
  multiColor?: boolean;
  extraBom?: Array<{ name: string; qty: number | string }>;
  makerWorldUrl?: string;
  modelUrl?: string;
  modelFileName?: string;
  modelFiles?: Array<{ url: string; fileName?: string }>;
  clientContact?: string;
  preferredColor?: string;
  description?: string;
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
      .map(c => c.trim().toUpperCase())
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
    const foundQuotes = quotes.filter(q => q.id && targetCodes.includes(q.id.toString().trim().toUpperCase()));
    if (foundQuotes.length === 0) {
      return NextResponse.json({ error: 'Nessun ordine trovato con i codici inseriti.' }, { status: 404 });
    }

    // Ordina i pezzi mantenendo l'ordine dei codici richiesti oppure cronologico
    foundQuotes.sort((a, b) => {
      const idxA = targetCodes.indexOf(a.id.toString().trim().toUpperCase());
      const idxB = targetCodes.indexOf(b.id.toString().trim().toUpperCase());
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
      quantity: typeof q.quantity === 'number' && q.quantity > 0 ? q.quantity : 1,
      totalCalculated: typeof q.totalCalculated === 'number' ? q.totalCalculated : 0,
      multiColor: Boolean(q.multiColor),
      extraBom: Array.isArray(q.extraBom) ? q.extraBom.map(b => ({ name: b.name, qty: b.qty })) : [],
      makerWorldUrl: q.makerWorldUrl || '',
      color: typeof q.preferredColor === 'string' ? q.preferredColor : '',
      messageCount: getMessages(String(q.id)).length,
      unreadMessages: getMessages(String(q.id)).filter(m => m.author === 'laboratorio' && !m.readByClient).length,
      modelUrl: q.modelUrl || '',
      modelFileName: q.modelFileName || '',
      // Le richieste salvate prima del supporto multi-file hanno solo modelUrl
      modelFiles: Array.isArray(q.modelFiles) && q.modelFiles.length > 0
        ? q.modelFiles.map(f => ({ url: f.url, fileName: f.fileName || '' }))
        : q.modelUrl
          ? [{ url: q.modelUrl, fileName: q.modelFileName || '' }]
          : []
    });

    const sanitizedOrders = foundQuotes.map(sanitize);
    const totalAll = sanitizedOrders.reduce((sum, o) => sum + o.totalCalculated, 0);
    const totalDue = sanitizedOrders
      .filter(o => o.status !== 'saldato')
      .reduce((sum, o) => sum + o.totalCalculated, 0);

    // Storico: altri ordini con lo stesso contatto (telefono o email), mai il contatto stesso.
    // Serve un codice valido per vederli, quindi chi non ha un ordine non può elencare quelli altrui.
    const normalize = (c: unknown) => {
      const v = String(c || '').trim().toLowerCase();
      if (!v) return '';
      if (v.includes('@')) return v;
      const digits = v.replace(/\D/g, '').replace(/^(0039|39)(?=\d{9,10}$)/, '');
      return digits.length >= 6 ? digits : '';
    };
    const contacts = new Set(foundQuotes.map(q => normalize(q.clientContact)).filter(Boolean));
    const requested = new Set(foundQuotes.map(q => String(q.id)));
    const history = contacts.size === 0 ? [] : quotes
      .filter(q => q.id && !requested.has(String(q.id)) && contacts.has(normalize(q.clientContact)))
      .slice(0, 50)
      .map(q => ({
        id: String(q.id),
        name: q.name || 'Oggetto di stampa 3D',
        material: q.material || '',
        quantity: typeof q.quantity === 'number' && q.quantity > 0 ? q.quantity : 1,
        savedAt: q.savedAt || '',
        status: q.status || 'in_attesa',
      }));

    return NextResponse.json({ 
      history,
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
