import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const filePath = path.join(dataDir, 'inventory.json');

const initialInventory = {
  spools: [
    { id: '1', brand: 'Bambu Lab', material: 'PLA Basic', color: 'Nero', cost: 18.99, weightTotal: 1000, weightRemaining: 750 },
    { id: '2', brand: 'eSUN', material: 'PETG', color: 'Grigio Scuro', cost: 19.50, weightTotal: 1000, weightRemaining: 400 },
    { id: '3', brand: 'Sunlu', material: 'TPU 95A', color: 'Nero', cost: 28.00, weightTotal: 1000, weightRemaining: 900 }
  ],
  hardware: [
    { id: '1', name: 'Inserti termici filettati M3x4x5', qty: 85, cost: 0.08 },
    { id: '2', name: 'Viti UNI 7687 M3x12', qty: 120, cost: 0.05 },
    { id: '3', name: 'Magneti al Neodimio 6x3', qty: 40, cost: 0.15 }
  ]
};

function ensureFileExists() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(initialInventory, null, 2), 'utf-8');
  }
}

export async function GET() {
  try {
    ensureFileExists();
    const data = fs.readFileSync(filePath, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json({ error: 'Errore lettura file inventario' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    ensureFileExists();
    const inventory = await request.json();
    fs.writeFileSync(filePath, JSON.stringify(inventory, null, 2), 'utf-8');
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Errore salvataggio file inventario' }, { status: 500 });
  }
}