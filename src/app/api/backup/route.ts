import { NextRequest, NextResponse } from 'next/server';
import { createBackupZip, createLocalSnapshot, listLocalSnapshots, restoreFromZip } from '@/lib/backup';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const download = searchParams.get('download');
    const action = searchParams.get('action');

    if (action === 'snapshot') {
      const filename = await createLocalSnapshot();
      return NextResponse.json({ success: true, filename });
    }

    if (download === '1') {
      const zipBuffer = await createBackupZip();
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `printquote_backup_${dateStr}.zip`;

      const headers = new Headers();
      headers.set('Content-Disposition', `attachment; filename="${filename}"`);
      headers.set('Content-Type', 'application/zip');
      headers.set('Content-Length', zipBuffer.length.toString());

      return new NextResponse(new Uint8Array(zipBuffer), {
        status: 200,
        headers
      });
    }

    const snapshots = listLocalSnapshots();
    return NextResponse.json({ snapshots });
  } catch (err) {
    return NextResponse.json({ 
      error: 'Errore gestione backup', 
      details: err instanceof Error ? err.message : String(err) 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nessun file di backup selezionato' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await restoreFromZip(buffer);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Errore ripristino' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      restoredFiles: result.restoredFiles,
      message: 'Database ripristinato con successo!' 
    });
  } catch (err) {
    return NextResponse.json({ 
      error: 'Errore durante il caricamento del file di ripristino',
      details: err instanceof Error ? err.message : String(err)
    }, { status: 500 });
  }
}
