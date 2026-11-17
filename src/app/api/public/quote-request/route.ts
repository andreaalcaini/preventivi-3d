import { NextRequest, NextResponse } from 'next/server';
import { logActivity } from '@/lib/activity';
import fs from 'fs';
import path from 'path';
import { broadcastLabNotification } from '@/lib/notification-bus';
import { sendPushNotificationToAll } from '@/lib/push';
import { newOrderCode } from '@/lib/orderCode';

const quotesFilePath = path.join(process.cwd(), 'data', 'quotes.json');

function sanitizeMesh(m: unknown) {
  if (!m || typeof m !== 'object') return null;
  const o = m as Record<string, unknown>;
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : 0);
  const size = (o.sizeMm || {}) as Record<string, unknown>;
  if (!(n(o.volumeCm3) > 0)) return null;
  return {
    volumeCm3: n(o.volumeCm3),
    surfaceCm2: n(o.surfaceCm2),
    sizeMm: { x: n(size.x), y: n(size.y), z: n(size.z) },
    baseAreaMm2: n(o.baseAreaMm2),
    openEdges: Math.round(n(o.openEdges)),
  };
}

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
      modelFileName,
      modelFiles,
      hours,
      mins,
      weight,
      multiColor,
      totalCalculated,
      weightSource,
      meshStats,
      urgent,
      privacyConsent
    } = body;

    if (!privacyConsent) {
      return NextResponse.json({ error: 'Serve il consenso al trattamento dei dati per inviare la richiesta' }, { status: 400 });
    }

    if (!name || !contact || !projectName) {
      return NextResponse.json({ error: 'Compila tutti i campi obbligatori (Nome, Contatto, Progetto)' }, { status: 400 });
    }

    // Più file 3D per richiesta: si accettano solo URL interni prodotti da /api/public/model
    const sanitizedModelFiles = Array.isArray(modelFiles)
      ? modelFiles
          .filter((f: unknown): f is { url: string; fileName?: string; stlDimensions?: unknown } =>
            typeof f === 'object' && f !== null &&
            typeof (f as { url?: unknown }).url === 'string' &&
            (f as { url: string }).url.startsWith('/api/public/model?')
          )
          .slice(0, 20)
          .map(f => ({
            url: f.url,
            fileName: typeof f.fileName === 'string' ? f.fileName : '',
            stlDimensions: f.stlDimensions || null
          }))
      : [];

    const orderId = newOrderCode();
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
      weight: Number(weight) || 0,
      multiColor: Boolean(multiColor),
      colorChanges: multiColor ? 1 : 0,
      purgeWeight: multiColor ? Math.round((Number(weight) || 0) * 0.25) : 0,
      hours: Number(hours) || 0,
      mins: Number(mins) || 0,
      prepMins: 0,
      postMins: 0,
      extraBom: [],
      cadCost: 0,
      urgencyCost: 0,
      discount: 0,
      savedAt,
      totalCalculated: Number(totalCalculated) || 0,
      estimatedProfit: 0,
      status: 'richiesta',
      stlDimensions: stlDimensions || null,
      modelUrl: modelUrl || '',
      modelFileName: modelFileName || '',
      modelFiles: sanitizedModelFiles,
      inventoryDeducted: false,
      weightSource: weightSource === 'slicer' || weightSource === 'geometria' ? weightSource : '',
      meshStats: sanitizeMesh(meshStats),
      urgent: Boolean(urgent),
      privacyConsentAt: privacyConsent ? now.toISOString() : null
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
    logActivity('portale', 'lavori', orderId, `Richiesta dal portale: "${newQuote.name}" da ${newQuote.clientName}`);
    fs.writeFileSync(quotesFilePath, JSON.stringify(quotes, null, 2), 'utf-8');

    // 1. Broadcast real-time per le schede aperte del sito (Popup in-app + Suono)
    try {
      broadcastLabNotification({
        type: 'quote_request',
        title: 'Nuova Richiesta Preventivo!',
        projectName: newQuote.name,
        clientName: newQuote.clientName,
        clientContact: newQuote.clientContact,
        totalCalculated: newQuote.totalCalculated,
        material: newQuote.material,
        dateStr: savedAt,
        trackingUrl: `/ordine?code=${orderId}`
      });
    } catch (broadcastErr) {
      console.error('Errore broadcast notifica in-app:', broadcastErr);
    }

    // 2. Invio Web Push allo smartphone dell'operatore (anche ad app/schermo chiuso)
    try {
      const formattedTotal = newQuote.totalCalculated > 0 ? ` (€${newQuote.totalCalculated.toFixed(2)})` : '';
      await sendPushNotificationToAll({
        title: 'Nuova Richiesta Preventivo!',
        body: `${newQuote.clientName} ha richiesto "${newQuote.name}" [${newQuote.material}]${formattedTotal}`,
        url: `/preventivi`,
        tag: `quote-${orderId}`
      });
    } catch (pushErr) {
      console.error('Errore invio Web Push:', pushErr);
    }

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
