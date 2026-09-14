import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const MODELS_DIR = path.join(process.cwd(), 'data', 'models');

function ensureModelsDir() {
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }
}

function sanitizeFileName(name: string): string {
  // Rimuovi caratteri pericolosi o tentativi di path traversal
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileNameParam = searchParams.get('file');
    const quoteIdParam = searchParams.get('id');

    ensureModelsDir();

    let targetFileName = '';

    if (fileNameParam) {
      targetFileName = sanitizeFileName(path.basename(fileNameParam));
    } else if (quoteIdParam) {
      const cleanId = sanitizeFileName(quoteIdParam.trim());
      // Cerca se esiste un file con questo prefisso ID
      const files = fs.readdirSync(MODELS_DIR);
      const match = files.find(f => f.startsWith(cleanId));
      if (match) {
        targetFileName = match;
      }
    }

    if (!targetFileName) {
      return NextResponse.json({ error: 'Specifica un parametro file o id valido' }, { status: 400 });
    }

    const filePath = path.join(MODELS_DIR, targetFileName);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Modello 3D non trovato' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(targetFileName).toLowerCase();

    let contentType = 'application/octet-stream';
    if (ext === '.stl') {
      contentType = 'model/stl';
    } else if (ext === '.3mf') {
      contentType = 'model/3mf';
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${targetFileName}"`,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    console.error('Errore lettura modello 3D:', err);
    return NextResponse.json({ error: 'Errore interno nel recupero del modello' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureModelsDir();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const quoteId = (formData.get('quoteId') as string) || Date.now().toString();

    if (!file) {
      return NextResponse.json({ error: 'Nessun file fornito' }, { status: 400 });
    }

    const originalName = file.name || 'model.stl';
    const ext = path.extname(originalName).toLowerCase();

    if (ext !== '.stl' && ext !== '.3mf') {
      return NextResponse.json({ error: 'Formato file non supportato. Carica un file .STL o .3MF' }, { status: 400 });
    }

    // Costruisci nome file sicuro: {quoteId}_{sanitizedOriginalName}
    const safeOriginal = sanitizeFileName(originalName);
    const cleanQuoteId = sanitizeFileName(quoteId);
    const savedFileName = `${cleanQuoteId}_${safeOriginal}`;
    const filePath = path.join(MODELS_DIR, savedFileName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    fs.writeFileSync(filePath, buffer);

    const modelUrl = `/api/public/model?file=${encodeURIComponent(savedFileName)}`;

    return NextResponse.json({
      success: true,
      url: modelUrl,
      fileName: originalName,
      savedFileName,
      sizeBytes: buffer.length,
      format: ext.replace('.', '')
    });
  } catch (err) {
    console.error('Errore salvataggio modello 3D:', err);
    return NextResponse.json({ error: 'Errore durante il caricamento del file 3D' }, { status: 500 });
  }
}
