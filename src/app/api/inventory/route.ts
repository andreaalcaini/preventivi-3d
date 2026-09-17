import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const filePath = path.join(dataDir, 'inventory.json');

const initialInventory = {
  spools: [],
  hardware: []
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