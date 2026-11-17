import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME, getUserById } from '@/lib/auth';
import { completeAuth } from '@/lib/googleDrive';
import { requestOrigin } from '@/lib/requestOrigin';
import { logActivity } from '@/lib/activity';

/** Ritorno dal consenso Google: salva il collegamento e torna alla pagina Backup. */
export async function GET(request: NextRequest) {
  const origin = requestOrigin(request);
  const back = (q: string) => NextResponse.redirect(`${origin}/backup?drive=${q}`);
  const s = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const user = s ? getUserById(s.userId) : null;
  if (user?.role !== 'admin') return back('permesso');

  const sp = request.nextUrl.searchParams;
  if (sp.get('error')) return back('annullato');
  const code = sp.get('code');
  const state = sp.get('state');
  if (!code || !state) return back('errore');
  try {
    await completeAuth(code, state, `${origin}/api/backup/drive/callback`);
    logActivity(user.username, 'sistema', '', 'Google Drive collegato per i backup');
    return back('collegato');
  } catch {
    return back('errore');
  }
}
