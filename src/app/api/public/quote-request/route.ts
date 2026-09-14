import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const quotesFilePath = path.join(process.cwd(), 'data', 'quotes.json');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, 
      contact, 
      projectName, 
      description, 
      material, 
      color, 
      quantity, 
      makerWorldUrl,
      stlDimensions,
      modelUrl,
      modelFileName
    } = body;

    if (!name || !contact || !projectName) {
      return NextResponse.json({ error: 'Compila tutti i campi obbligatori (Nome, Contatto, Progetto)' }, { status: 400 });
    }

    const orderId = Date.now().toString();
    const now = new Date();
    const savedAt = now.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const newQuote = {
      id: orderId,
      name: projectName.trim(),
      clientName: name.trim(),
      clientContact: contact.trim(),
      description: description ? description.trim() : '',
      pricingType: 'richiesta_cliente',
      makerWorldUrl: makerWorldUrl ? makerWorldUrl.trim() : '',
      material: material || 'PLA Standard',
      preferredColor: color || 'Da concordare',
      quantity: Number(quantity) || 1,
      spoolCost: 0,
      weight: 0,
      multiColor: false,
      colorChanges: 0,
      purgeWeight: 0,
      hours: 0,
      mins: 0,
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
      stlDimensions: stlDimensions || null,
      modelUrl: modelUrl || '',
      modelFileName: modelFileName || '',
      inventoryDeducted: false
    };

    let quotes = [];
    if (fs.existsSync(quotesFilePath)) {
      try {
        const raw = fs.readFileSync(quotesFilePath, 'utf-8');
        quotes = JSON.parse(raw);
      } catch {
        quotes = [];
      }
    }

    quotes.unshift(newQuote);
    fs.writeFileSync(quotesFilePath, JSON.stringify(quotes, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      orderId,
      message: 'Richiesta di preventivo inviata con successo!',
      trackingUrl: `/ordine?code=${orderId}`
    });
  } catch (err) {
    return NextResponse.json({
      error: 'Errore salvataggio richiesta',
      details: err instanceof Error ? err.message : String(err)
    }, { status: 500 });
  }
}
