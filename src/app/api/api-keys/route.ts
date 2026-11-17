import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { listApiKeys, createApiKey, revokeApiKey, deleteApiKey, type ApiKeyScope } from '@/lib/apiKeys';

function getSession(request: NextRequest) {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}

export async function GET(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  return NextResponse.json({ keys: listApiKeys(), canManage: session.role === 'admin' });
}

export async function POST(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Solo un amministratore può creare chiavi API' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const result = createApiKey({
      name: String(body?.name ?? ''),
      scope: (body?.scope === 'write' ? 'write' : 'read') as ApiKeyScope,
      createdBy: session.username,
      expiresInDays: body?.expiresInDays ? Number(body.expiresInDays) : null,
    });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 });
  }
}

/** PATCH { id, action: "revoke" } revoca la chiave senza cancellarne la traccia. */
export async function PATCH(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Solo un amministratore può revocare chiavi API' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (body?.action !== 'revoke' || typeof body?.id !== 'string') {
    return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 });
  }
  if (!revokeApiKey(body.id)) return NextResponse.json({ error: 'Chiave non trovata o già revocata' }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Solo un amministratore può eliminare chiavi API' }, { status: 403 });
  }
  const id = request.nextUrl.searchParams.get('id');
  if (!id || !deleteApiKey(id)) return NextResponse.json({ error: 'Chiave non trovata' }, { status: 404 });
  return NextResponse.json({ success: true });
}
