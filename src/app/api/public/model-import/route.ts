import { NextRequest, NextResponse } from 'next/server';
import { importModel } from '@/lib/modelImport';

/** GET /api/public/model-import?url=...: metadati e file di un modello da Printables, Thingiverse, MyMiniFactory o altri siti. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Link mancante' }, { status: 400 });
  try {
    const model = await importModel(url);
    // Il browser scarica i file attraverso il nostro proxy (stesso dominio, niente blocchi CORS)
    const files = model.files.map(f => ({
      name: f.name,
      size: f.size,
      proxyUrl: `/api/public/model-import/file?u=${encodeURIComponent(f.url)}&name=${encodeURIComponent(f.name)}`,
    }));
    return NextResponse.json({ ...model, files }, { headers: { 'Cache-Control': 'private, max-age=300' } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Importazione non riuscita' }, { status: 422 });
  }
}
