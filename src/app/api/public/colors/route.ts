import { NextRequest, NextResponse } from 'next/server';
import { readInventory } from '@/lib/labData';
import { readPricing } from '@/lib/pricingStore';
import { findMaterial } from '@/lib/pricing';

/**
 * GET /api/public/colors?material=PETG: colori disponibili in magazzino per il materiale scelto nel portale.
 * Solo nome e colore: niente quantità, marche o costi. Una bobina conta se ha almeno 150 g.
 */
export async function GET(request: NextRequest) {
  const material = request.nextUrl.searchParams.get('material') || 'PLA';
  const cfg = readPricing();
  const wanted = findMaterial(cfg, material).key;
  const seen = new Map<string, { name: string; hex: string }>();
  for (const s of readInventory().spools) {
    if (Number(s.weightRemaining) < 150) continue;
    if (findMaterial(cfg, String(s.material || '')).key !== wanted) continue;
    const name = String(s.color || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, { name, hex: typeof s.colorHex === 'string' ? s.colorHex : '' });
  }
  return NextResponse.json(
    { colors: [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'it')) },
    { headers: { 'Cache-Control': 'public, max-age=120' } },
  );
}
