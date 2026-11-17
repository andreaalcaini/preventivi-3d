import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME, getUserById } from '@/lib/auth';
import {
  driveStatus, updateDriveSettings, authUrl, disconnectDrive, uploadBackupToDrive, listDriveBackups, restoreFromDrive,
} from '@/lib/googleDrive';
import { requestOrigin } from '@/lib/requestOrigin';
import { logActivity } from '@/lib/activity';

function admin(request: NextRequest) {
  const s = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const user = s ? getUserById(s.userId) : null;
  return user?.role === 'admin' ? user : null;
}

const forbidden = () => NextResponse.json({ error: 'Solo un amministratore può gestire il backup su Drive' }, { status: 403 });
const callbackUrl = (request: NextRequest) => `${requestOrigin(request)}/api/backup/drive/callback`;

/** GET: stato del collegamento; ?list=1 aggiunge l'elenco dei backup su Drive. */
export async function GET(request: NextRequest) {
  if (!admin(request)) return forbidden();
  const status = driveStatus();
  const out: Record<string, unknown> = { status, redirectUri: callbackUrl(request) };
  if (request.nextUrl.searchParams.get('list') && status.connected) {
    try {
      out.files = await listDriveBackups();
    } catch (err) {
      out.listError = err instanceof Error ? err.message : 'Elenco non disponibile';
    }
  }
  return NextResponse.json(out);
}

/** PUT: credenziali OAuth e pianificazione. */
export async function PUT(request: NextRequest) {
  const user = admin(request);
  if (!user) return forbidden();
  const body = await request.json().catch(() => ({}));
  const status = updateDriveSettings(body || {});
  logActivity(user.username, 'sistema', '', 'Impostazioni backup Google Drive aggiornate');
  return NextResponse.json({ status });
}

/** POST { action: "connect" | "upload" | "disconnect" | "restore", fileId? } */
export async function POST(request: NextRequest) {
  const user = admin(request);
  if (!user) return forbidden();
  const body = await request.json().catch(() => ({}));
  try {
    switch (body?.action) {
      case 'connect':
        return NextResponse.json({ url: authUrl(callbackUrl(request)) });
      case 'upload': {
        const r = await uploadBackupToDrive('manuale', user.username);
        return NextResponse.json({ success: true, ...r, status: driveStatus() });
      }
      case 'disconnect':
        await disconnectDrive();
        logActivity(user.username, 'sistema', '', 'Google Drive scollegato');
        return NextResponse.json({ status: driveStatus() });
      case 'restore': {
        const r = await restoreFromDrive(String(body.fileId || ''));
        if (!r.success) return NextResponse.json({ error: r.error || 'Ripristino non riuscito' }, { status: 400 });
        logActivity(user.username, 'sistema', '', `Ripristino da Google Drive: ${r.restoredFiles.join(', ')}`);
        return NextResponse.json({ success: true, restoredFiles: r.restoredFiles });
      }
      default:
        return NextResponse.json({ error: 'Azione non valida' }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Operazione non riuscita' }, { status: 502 });
  }
}
