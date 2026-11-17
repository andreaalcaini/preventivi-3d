import { NextRequest, NextResponse } from 'next/server';
import { readPricing } from '@/lib/pricingStore';
import { estimateUsageFromMesh, priceFromUsage, checkPrintability } from '@/lib/pricing';

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * POST /api/public/estimate: stima per il portale. Il listino resta sul server.
 * Corpo: { material, qty, multicolor?, urgent?, slicer?: { hours, mins, grams }, mesh?: { volumeCm3, surfaceCm2, sizeMm, baseAreaMm2, openEdges } }
 * Se ci sono dati dello slicer si usano quelli; altrimenti la stima geometrica calibrata.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 });
  const cfg = readPricing();
  const material = String(body.material || 'PLA').slice(0, 60);
  const qty = Math.min(100000, Math.max(1, Math.round(n(body.qty) || 1)));

  let usage: { hours: number; grams: number } | null = null;
  let source: 'slicer' | 'geometria' | null = null;
  let warnings: ReturnType<typeof checkPrintability> = [];

  const mesh = body.mesh && n(body.mesh.volumeCm3) > 0 ? {
    volumeCm3: n(body.mesh.volumeCm3),
    surfaceCm2: n(body.mesh.surfaceCm2),
    sizeMm: { x: n(body.mesh.sizeMm?.x), y: n(body.mesh.sizeMm?.y), z: n(body.mesh.sizeMm?.z) },
    baseAreaMm2: body.mesh.baseAreaMm2 === undefined ? undefined : n(body.mesh.baseAreaMm2),
    openEdges: n(body.mesh.openEdges),
  } : null;

  if (mesh) warnings = checkPrintability(mesh, cfg);

  if (body.slicer && (n(body.slicer.grams) > 0 || n(body.slicer.hours) + n(body.slicer.mins) > 0)) {
    usage = { hours: n(body.slicer.hours) + n(body.slicer.mins) / 60, grams: n(body.slicer.grams) };
    source = 'slicer';
  } else if (mesh) {
    usage = estimateUsageFromMesh(mesh, material, cfg);
    source = 'geometria';
  }

  if (!usage) return NextResponse.json({ estimate: null, warnings });
  const price = priceFromUsage({ ...usage, qty, material, multicolor: Boolean(body.multicolor), urgent: Boolean(body.urgent) }, cfg);
  return NextResponse.json({
    estimate: { ...price, source, calibrated: source === 'geometria' && cfg.calibration.samples >= 3 },
    warnings,
  });
}
