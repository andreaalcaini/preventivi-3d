import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';

const baseDir = path.join(process.cwd(), 'data', 'qc');
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX = 8 * 1024 * 1024;

function authed(request: NextRequest) {
  return Boolean(verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value));
}

/** POST multipart { file, quoteId }: foto del controllo qualità (JPG/PNG/WebP, max 8 MB). */
export async function POST(request: NextRequest) {
  if (!authed(request)) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const quoteId = String(form?.get('quoteId') || '').replace(/[^\w-]/g, '').slice(0, 60);
  if (!(file instanceof File) || !quoteId) return NextResponse.json({ error: 'File o lavoro mancante' }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: 'Formato non supportato: usa JPG, PNG o WebP' }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: 'Foto troppo grande (massimo 8 MB)' }, { status: 413 });
  const dir = path.join(baseDir, quoteId);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ url: `/api/qc-photo?q=${quoteId}&f=${name}` }, { status: 201 });
}

/** GET ?q=<lavoro>&f=<file>: restituisce la foto (solo con sessione). */
export async function GET(request: NextRequest) {
  if (!authed(request)) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  const q = (request.nextUrl.searchParams.get('q') || '').replace(/[^\w-]/g, '');
  const f = request.nextUrl.searchParams.get('f') || '';
  if (!q || !/^[\w-]+\.(jpg|png|webp)$/.test(f)) return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 });
  const file = path.join(baseDir, q, f);
  if (!file.startsWith(baseDir) || !fs.existsSync(file)) return NextResponse.json({ error: 'Foto non trovata' }, { status: 404 });
  const type = f.endsWith('png') ? 'image/png' : f.endsWith('webp') ? 'image/webp' : 'image/jpeg';
  return new NextResponse(fs.readFileSync(file), { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=86400' } });
}
