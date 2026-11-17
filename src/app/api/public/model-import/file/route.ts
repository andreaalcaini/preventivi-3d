import { NextRequest, NextResponse } from 'next/server';
import { ALLOWED_FILE_HOSTS, safeFetch } from '@/lib/modelImport';

const MAX_BYTES = 60 * 1024 * 1024;

/** Proxy di download per i file importati: solo host dei siti supportati, solo STL/3MF, massimo 60 MB. */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('u') || '';
  const name = (request.nextUrl.searchParams.get('name') || 'modello.stl').replace(/[^\w.\- ]+/g, '_').slice(0, 120);
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: 'Link non valido' }, { status: 400 });
  }
  if (target.protocol !== 'https:' || !ALLOWED_FILE_HOSTS.includes(target.hostname)) {
    return NextResponse.json({ error: 'Origine del file non consentita' }, { status: 403 });
  }
  if (!/\.(stl|3mf)$/i.test(name)) {
    return NextResponse.json({ error: 'Sono ammessi solo file STL o 3MF' }, { status: 400 });
  }
  try {
    const res = await safeFetch(target.toString(), { signal: AbortSignal.timeout(60000) });
    if (!res.ok || !res.body) return NextResponse.json({ error: `Download non riuscito (${res.status})` }, { status: 502 });
    const len = Number(res.headers.get('content-length') || 0);
    if (len > MAX_BYTES) return NextResponse.json({ error: 'File troppo grande (massimo 60 MB)' }, { status: 413 });
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return NextResponse.json({ error: 'File troppo grande (massimo 60 MB)' }, { status: 413 });
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'private, max-age=600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Download non riuscito' }, { status: 502 });
  }
}
