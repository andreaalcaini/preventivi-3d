import { NextRequest, NextResponse } from 'next/server';
import { 
  verifySessionToken, 
  SESSION_COOKIE_NAME, 
  getAllPublicUsers, 
  createUser, 
  updateUserPassword, 
  deleteUser 
} from '@/lib/auth';

function checkAuth(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export async function GET(request: NextRequest) {
  const session = checkAuth(request);
  if (!session) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const users = getAllPublicUsers();
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const session = checkAuth(request);
  if (!session) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = createUser(body);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, user: result.user });
  } catch {
    return NextResponse.json({ error: 'Errore creazione utente' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = checkAuth(request);
  if (!session) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  try {
    const { userId, newPassword } = await request.json();
    if (!userId || !newPassword) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    const result = updateUserPassword(userId, newPassword);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Errore aggiornamento password' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = checkAuth(request);
  if (!session) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'ID utente richiesto' }, { status: 400 });
    }

    if (userId === session.userId) {
      return NextResponse.json({ error: 'Non puoi eliminare il tuo stesso account' }, { status: 400 });
    }

    const result = deleteUser(userId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Errore eliminazione utente' }, { status: 500 });
  }
}
