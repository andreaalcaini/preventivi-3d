import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const maintenanceFilePath = path.join(process.cwd(), 'data', 'maintenance.json');

export interface MaintenanceLog {
  id: string;
  date: string;
  printerId: string;
  type: 'nozzle' | 'lubrificazione' | 'pulizia' | 'cinghie' | 'altro';
  description: string;
  hoursAtLog: number;
}

export interface Printer {
  id: string;
  name: string;
  model: string;
  nozzleType: string;
  totalPrintHours: number;
  nozzleInstalledAtHours: number;
  nozzleLifespanHours: number;
  lastLubricationHours: number;
  lubricationIntervalHours: number;
  lastBeltsCheckHours: number;
  beltsCheckIntervalHours: number;
  status: 'operativa' | 'in_manutenzione' | 'ferma';
  notes?: string;
  logs: MaintenanceLog[];
}

function getInitialPrinters(): Printer[] {
  return [
    {
      id: 'printer-default-1',
      name: 'Stampante Primaria #1',
      model: 'Bambu Lab P1S',
      nozzleType: '0.4mm Acciaio Temperato (Hardened Steel)',
      totalPrintHours: 142.5,
      nozzleInstalledAtHours: 0,
      nozzleLifespanHours: 1000,
      lastLubricationHours: 40,
      lubricationIntervalHours: 250,
      lastBeltsCheckHours: 0,
      beltsCheckIntervalHours: 500,
      status: 'operativa',
      notes: 'Piatto PEI texturizzato installato',
      logs: [
        {
          id: 'log-1',
          date: new Date().toLocaleDateString('it-IT'),
          printerId: 'printer-default-1',
          type: 'lubrificazione',
          description: 'Pulizia e ingrassaggio guide asse Z e barre lineari',
          hoursAtLog: 40
        }
      ]
    }
  ];
}

function readPrinters(): Printer[] {
  try {
    if (!fs.existsSync(maintenanceFilePath)) {
      const init = getInitialPrinters();
      fs.writeFileSync(maintenanceFilePath, JSON.stringify(init, null, 2), 'utf-8');
      return init;
    }
    const raw = fs.readFileSync(maintenanceFilePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return getInitialPrinters();
  }
}

function savePrinters(printers: Printer[]) {
  fs.writeFileSync(maintenanceFilePath, JSON.stringify(printers, null, 2), 'utf-8');
}

export async function GET() {
  try {
    const printers = readPrinters();
    const totalFleetHours = printers.reduce((sum, p) => sum + (p.totalPrintHours || 0), 0);
    return NextResponse.json({ printers, totalFleetHours });
  } catch {
    return NextResponse.json({ error: 'Errore lettura registro manutenzioni' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, printerId } = body;
    const printers = readPrinters();

    const nowStr = new Date().toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    if (action === 'add_printer') {
      const newPrinter: Printer = {
        id: `printer-${Date.now()}`,
        name: body.name || 'Nuova Stampante',
        model: body.model || 'FDM Standard',
        nozzleType: body.nozzleType || '0.4mm Ottone',
        totalPrintHours: Number(body.totalPrintHours) || 0,
        nozzleInstalledAtHours: Number(body.totalPrintHours) || 0,
        nozzleLifespanHours: Number(body.nozzleLifespanHours) || 500,
        lastLubricationHours: Number(body.totalPrintHours) || 0,
        lubricationIntervalHours: Number(body.lubricationIntervalHours) || 250,
        lastBeltsCheckHours: Number(body.totalPrintHours) || 0,
        beltsCheckIntervalHours: Number(body.beltsCheckIntervalHours) || 500,
        status: body.status || 'operativa',
        notes: body.notes || '',
        logs: [
          {
            id: `log-${Date.now()}`,
            date: nowStr,
            printerId: `printer-${Date.now()}`,
            type: 'altro',
            description: 'Messa in servizio e registrazione stampante',
            hoursAtLog: Number(body.totalPrintHours) || 0
          }
        ]
      };
      printers.push(newPrinter);
      savePrinters(printers);
      return NextResponse.json({ success: true, printer: newPrinter });
    }

    const printer = printers.find(p => p.id === printerId);
    if (!printer) {
      return NextResponse.json({ error: 'Stampante non trovata' }, { status: 404 });
    }

    if (action === 'delete_printer') {
      const updated = printers.filter(p => p.id !== printerId);
      savePrinters(updated);
      return NextResponse.json({ success: true });
    }

    if (action === 'edit_printer') {
      if (body.name !== undefined) printer.name = body.name;
      if (body.model !== undefined) printer.model = body.model;
      if (body.nozzleType !== undefined) printer.nozzleType = body.nozzleType;
      if (body.nozzleLifespanHours !== undefined) printer.nozzleLifespanHours = Number(body.nozzleLifespanHours);
      if (body.lubricationIntervalHours !== undefined) printer.lubricationIntervalHours = Number(body.lubricationIntervalHours);
      if (body.status !== undefined) printer.status = body.status;
      if (body.notes !== undefined) printer.notes = body.notes;
      savePrinters(printers);
      return NextResponse.json({ success: true, printer });
    }

    if (action === 'add_hours') {
      const hoursToAdd = Number(body.hours) || 0;
      if (hoursToAdd > 0) {
        printer.totalPrintHours = +(printer.totalPrintHours + hoursToAdd).toFixed(1);
        savePrinters(printers);
      }
      return NextResponse.json({ success: true, printer });
    }

    if (action === 'replace_nozzle') {
      printer.nozzleInstalledAtHours = printer.totalPrintHours;
      if (body.nozzleType) printer.nozzleType = body.nozzleType;
      printer.logs.unshift({
        id: `log-${Date.now()}`,
        date: nowStr,
        printerId: printer.id,
        type: 'nozzle',
        description: body.description || `Sostituzione ugello/nozzle (${printer.nozzleType})`,
        hoursAtLog: printer.totalPrintHours
      });
      savePrinters(printers);
      return NextResponse.json({ success: true, printer });
    }

    if (action === 'mark_lubricated') {
      printer.lastLubricationHours = printer.totalPrintHours;
      printer.logs.unshift({
        id: `log-${Date.now()}`,
        date: nowStr,
        printerId: printer.id,
        type: 'lubrificazione',
        description: body.description || 'Lubrificazione guide lineari e viti trapezie eseguita',
        hoursAtLog: printer.totalPrintHours
      });
      savePrinters(printers);
      return NextResponse.json({ success: true, printer });
    }

    if (action === 'mark_belts') {
      printer.lastBeltsCheckHours = printer.totalPrintHours;
      printer.logs.unshift({
        id: `log-${Date.now()}`,
        date: nowStr,
        printerId: printer.id,
        type: 'cinghie',
        description: body.description || 'Controllo tensione cinghie e allineamento assi completato',
        hoursAtLog: printer.totalPrintHours
      });
      savePrinters(printers);
      return NextResponse.json({ success: true, printer });
    }

    if (action === 'add_log') {
      printer.logs.unshift({
        id: `log-${Date.now()}`,
        date: nowStr,
        printerId: printer.id,
        type: body.type || 'altro',
        description: body.description || 'Intervento di manutenzione ordinaria',
        hoursAtLog: printer.totalPrintHours
      });
      savePrinters(printers);
      return NextResponse.json({ success: true, printer });
    }

    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ 
      error: 'Errore aggiornamento registro manutenzioni',
      details: err instanceof Error ? err.message : String(err)
    }, { status: 500 });
  }
}
