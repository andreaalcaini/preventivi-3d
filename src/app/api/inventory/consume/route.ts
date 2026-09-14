import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const filePath = path.join(dataDir, 'inventory.json');

interface Spool {
  id: string;
  brand: string;
  material: string;
  color: string;
  cost: number;
  weightTotal: number;
  weightRemaining: number;
}

interface HardwareItem {
  id: string;
  name: string;
  qty: number;
  cost: number;
}

interface InventoryData {
  spools: Spool[];
  hardware: HardwareItem[];
}

export async function POST(request: Request) {
  try {
    const { spoolId, gramsUsed, bomItems } = await request.json();

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File inventario non trovato' }, { status: 404 });
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const inventory: InventoryData = JSON.parse(raw);

    // Scala grammi bobina se specificata
    if (spoolId && typeof gramsUsed === 'number' && gramsUsed > 0) {
      inventory.spools = inventory.spools.map(s => {
        if (s.id === spoolId) {
          return { ...s, weightRemaining: Math.max(0, s.weightRemaining - gramsUsed) };
        }
        return s;
      });
    }

    // Scala viteria e componenti BOM se presenti nel magazzino
    if (Array.isArray(bomItems) && bomItems.length > 0) {
      inventory.hardware = inventory.hardware.map(hw => {
        const used = bomItems.find((b: { name: string; qty: number }) => b.name.trim().toLowerCase() === hw.name.trim().toLowerCase());
        if (used) {
          return { ...hw, qty: Math.max(0, hw.qty - (used.qty || 1)) };
        }
        return hw;
      });
    }

    fs.writeFileSync(filePath, JSON.stringify(inventory, null, 2), 'utf-8');
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Errore durante lo scarico dal magazzino' }, { status: 500 });
  }
}