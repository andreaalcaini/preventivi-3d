import { NextRequest, NextResponse } from 'next/server';
import { readInventory, writeInventory } from '@/lib/labData';

/**
 * PATCH /api/v1/inventory/spools/{id}
 * { "weightRemaining": 640 } imposta il residuo, { "gramsUsed": 35 } lo scala.
 */
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/v1/inventory/spools/[id]'>) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const inventory = readInventory();
  const spool = inventory.spools.find(s => s.id === id);
  if (!spool) return NextResponse.json({ error: 'Bobina non trovata' }, { status: 404 });

  if (typeof body?.weightRemaining === 'number' && body.weightRemaining >= 0) {
    spool.weightRemaining = Math.round(body.weightRemaining);
  } else if (typeof body?.gramsUsed === 'number' && body.gramsUsed > 0) {
    spool.weightRemaining = Math.max(0, Math.round(Number(spool.weightRemaining) - body.gramsUsed));
  } else {
    return NextResponse.json({ error: 'Indica weightRemaining (>= 0) oppure gramsUsed (> 0)' }, { status: 400 });
  }

  writeInventory(inventory);
  return NextResponse.json({ success: true, spool });
}
