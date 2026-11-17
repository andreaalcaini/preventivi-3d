import { NextRequest, NextResponse } from 'next/server';
import { readInventory } from '@/lib/labData';

/** GET /api/v1/inventory?material=PETG&lowStock=true: bobine e componenti in magazzino. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const material = params.get('material')?.toLowerCase();
  const lowStock = params.get('lowStock') === 'true';
  const { spools, hardware } = readInventory();

  const filteredSpools = spools
    .filter(s => (material ? String(s.material ?? '').toLowerCase().includes(material) : true))
    .filter(s => (lowStock ? Number(s.weightRemaining) < 200 : true));

  return NextResponse.json({ spools: filteredSpools, hardware });
}
