import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const filePath = path.join(dataDir, 'quotes.json');

function ensureFileExists() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([]), 'utf-8');
  }
}

export async function GET() {
  try {
    ensureFileExists();
    const data = fs.readFileSync(filePath, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json({ error: 'Errore lettura file preventivi' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    ensureFileExists();
    const quotes = await request.json();
    fs.writeFileSync(filePath, JSON.stringify(quotes, null, 2), 'utf-8');
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Errore salvataggio file preventivi' }, { status: 500 });
  }
}