import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME, getUserById } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = verifySessionToken(token);

  if (!payload) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const user = getUserById(payload.userId);
  if (!user) {
    return NextResponse.json({ error: 'Utente non trovato' }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role
    }
  });
}
