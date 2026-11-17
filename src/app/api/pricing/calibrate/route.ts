import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME, getUserById } from '@/lib/auth';
import { readPricing, writePricing, calibrate } from '@/lib/pricingStore';

/** POST /api/pricing/calibrate: ricalcola i fattori di correzione dai lavori con dati reali (solo amministratori). */
export async function POST(request: NextRequest) {
  const s = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const user = s ? getUserById(s.userId) : null;
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Solo un amministratore può ricalibrare' }, { status: 403 });
  const cfg = readPricing();
  cfg.calibration = calibrate(cfg);
  writePricing(cfg);
  return NextResponse.json({ pricing: cfg });
}
