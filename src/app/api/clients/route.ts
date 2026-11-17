import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { readProfiles, saveProfile, clientKey } from '@/lib/clientProfiles';
import { logActivity } from '@/lib/activity';

function session(request: NextRequest) {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}

/** GET /api/clients?name=Mario: profilo di un cliente (o tutti i profili senza parametro). */
export async function GET(request: NextRequest) {
  if (!session(request)) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  const all = readProfiles();
  const name = request.nextUrl.searchParams.get('name');
  if (name) return NextResponse.json({ profile: all[clientKey(name)] || null });
  return NextResponse.json({ profiles: all });
}

/** PUT /api/clients { name, company, contacts, address, notes, tags } */
export async function PUT(request: NextRequest) {
  const s = session(request);
  if (!s) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body?.name || typeof body.name !== 'string') return NextResponse.json({ error: 'Nome cliente mancante' }, { status: 400 });
  const profile = saveProfile(body);
  logActivity(s.username, 'clienti', profile.name, `Scheda cliente aggiornata: ${profile.name}`);
  return NextResponse.json({ profile });
}
