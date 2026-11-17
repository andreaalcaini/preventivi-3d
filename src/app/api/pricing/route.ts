import { NextRequest, NextResponse } from 'next/server';
import { logActivity } from '@/lib/activity';
import { verifySessionToken, SESSION_COOKIE_NAME, getUserById } from '@/lib/auth';
import { readPricing, writePricing } from '@/lib/pricingStore';
import { mergePricing, DEFAULT_PRICING, type PricingConfig } from '@/lib/pricing';

function actor(request: NextRequest) {
  const s = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  return s ? getUserById(s.userId) : null;
}

export async function GET(request: NextRequest) {
  const user = actor(request);
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  return NextResponse.json({ pricing: readPricing(), defaults: DEFAULT_PRICING, canEdit: user.role === 'admin' });
}

const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** PUT /api/pricing: salva il listino (solo amministratori). La calibrazione non si modifica da qui. */
export async function PUT(request: NextRequest) {
  const user = actor(request);
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Solo un amministratore può modificare il listino' }, { status: 403 });
  const body = (await request.json().catch(() => null)) as Partial<PricingConfig> | null;
  if (!body) return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 });

  const current = readPricing();
  const d = DEFAULT_PRICING;
  const next = mergePricing({
    ...current,
    materials: (Array.isArray(body.materials) ? body.materials : current.materials).slice(0, 30).map((m, i) => ({
      key: String(m.key || `mat${i}`).slice(0, 30),
      label: String(m.label || 'Materiale').slice(0, 60),
      match: (Array.isArray(m.match) ? m.match : String(m.match || '').split(',')).map(x => String(x).trim()).filter(Boolean).slice(0, 10),
      pricePerKg: num(m.pricePerKg, 0, 1000, 25),
      density: num(m.density, 0.5, 3, 1.24),
      surchargePct: num(m.surchargePct, -50, 500, 0),
    })),
    machineRatePerHour: num(body.machineRatePerHour, 0, 100, d.machineRatePerHour),
    setupFee: num(body.setupFee, 0, 1000, d.setupFee),
    marginPct: num(body.marginPct, 0, 1000, d.marginPct),
    minPrice: num(body.minPrice, 0, 10000, d.minPrice),
    roundTo: num(body.roundTo, 0.01, 10, d.roundTo),
    multicolorWasteFactor: num(body.multicolorWasteFactor, 1, 5, d.multicolorWasteFactor),
    multicolorSurchargePct: num(body.multicolorSurchargePct, 0, 500, d.multicolorSurchargePct),
    urgencySurchargePct: num(body.urgencySurchargePct, 0, 500, d.urgencySurchargePct),
    quantityTiers: (Array.isArray(body.quantityTiers) ? body.quantityTiers : current.quantityTiers)
      .map(t => ({ minQty: Math.round(num(t.minQty, 2, 100000, 10)), discountPct: num(t.discountPct, 0, 90, 0) }))
      .sort((a, b) => a.minQty - b.minQty)
      .slice(0, 10),
    buildVolume: {
      x: num(body.buildVolume?.x, 10, 2000, current.buildVolume.x),
      y: num(body.buildVolume?.y, 10, 2000, current.buildVolume.y),
      z: num(body.buildVolume?.z, 10, 2000, current.buildVolume.z),
    },
    estimation: {
      wallMm: num(body.estimation?.wallMm, 0.2, 10, current.estimation.wallMm),
      infillPct: num(body.estimation?.infillPct, 0, 100, current.estimation.infillPct),
      throughputGPerHour: num(body.estimation?.throughputGPerHour, 1, 500, current.estimation.throughputGPerHour),
      layerHeightMm: num(body.estimation?.layerHeightMm, 0.04, 1, current.estimation.layerHeightMm),
      secondsPerLayer: num(body.estimation?.secondsPerLayer, 0, 60, current.estimation.secondsPerLayer),
      minBaseAreaMm2: num(body.estimation?.minBaseAreaMm2, 0, 10000, current.estimation.minBaseAreaMm2),
    },
    calibration: current.calibration,
  });
  writePricing(next);
  logActivity(user.username, 'listino', '', 'Listino aggiornato');
  return NextResponse.json({ pricing: next });
}
