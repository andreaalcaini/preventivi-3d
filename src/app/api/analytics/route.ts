import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const quotesFilePath = path.join(process.cwd(), 'data', 'quotes.json');

interface RawQuote {
  id: string;
  name: string;
  clientName: string;
  material: string;
  savedAt: string;
  totalCalculated: number;
  estimatedProfit: number;
  status?: string;
  weight?: number | string;
  hours?: number | string;
  mins?: number | string;
  [key: string]: unknown;
}

export async function GET() {
  try {
    if (!fs.existsSync(quotesFilePath)) {
      return NextResponse.json({
        kpis: {
          totalRevenue: 0,
          totalProfit: 0,
          averageMarginPct: 0,
          totalOrders: 0,
          completedOrders: 0,
          totalPrintHours: 0,
          totalFilamentWeightGrams: 0,
          averageOrderValue: 0
        },
        monthlyTrends: [],
        materialBreakdown: [],
        topClients: []
      });
    }

    const raw = fs.readFileSync(quotesFilePath, 'utf-8');
    const quotes: RawQuote[] = JSON.parse(raw);

    let totalRevenue = 0;
    let totalProfit = 0;
    let totalPrintHours = 0;
    let totalFilamentWeightGrams = 0;
    let completedOrders = 0;

    const materialsMap: Record<string, { count: number; totalGrams: number; totalRevenue: number }> = {};
    const clientsMap: Record<string, { totalSpent: number; totalProfit: number; orderCount: number; lastOrderDate: string; materials: Record<string, number> }> = {};
    const monthlyMap: Record<string, { month: string; revenue: number; profit: number; hours: number; ordersCount: number }> = {};

    quotes.forEach((q) => {
      const rev = Number(q.totalCalculated) || 0;
      const profit = Number(q.estimatedProfit) || 0;
      const weight = Number(q.weight) || 0;
      const h = Number(q.hours) || 0;
      const m = Number(q.mins) || 0;
      const durationHours = h + (m / 60);

      totalRevenue += rev;
      totalProfit += profit;
      totalPrintHours += durationHours;
      totalFilamentWeightGrams += weight;

      if (q.status === 'saldato' || q.status === 'pronto') {
        completedOrders += 1;
      }

      // 1. Materiali
      const rawMat = (q.material || 'Standard PLA').toUpperCase().trim();
      let matKey = 'PLA';
      if (rawMat.includes('PETG')) matKey = 'PETG';
      else if (rawMat.includes('TPU')) matKey = 'TPU';
      else if (rawMat.includes('ABS')) matKey = 'ABS';
      else if (rawMat.includes('ASA')) matKey = 'ASA';
      else if (rawMat.includes('NYLON') || rawMat.includes('PA')) matKey = 'Nylon/PA';
      else if (rawMat.includes('PC')) matKey = 'Policarbonato (PC)';
      else if (rawMat.includes('RESIN')) matKey = 'Resina UV';
      else matKey = q.material?.trim() || 'PLA';

      if (!materialsMap[matKey]) {
        materialsMap[matKey] = { count: 0, totalGrams: 0, totalRevenue: 0 };
      }
      materialsMap[matKey].count += 1;
      materialsMap[matKey].totalGrams += weight;
      materialsMap[matKey].totalRevenue += rev;

      // 2. Clienti
      const clientName = (q.clientName || 'Cliente Anonimo').trim();
      if (!clientsMap[clientName]) {
        clientsMap[clientName] = {
          totalSpent: 0,
          totalProfit: 0,
          orderCount: 0,
          lastOrderDate: q.savedAt || '',
          materials: {}
        };
      }
      clientsMap[clientName].totalSpent += rev;
      clientsMap[clientName].totalProfit += profit;
      clientsMap[clientName].orderCount += 1;
      clientsMap[clientName].materials[matKey] = (clientsMap[clientName].materials[matKey] || 0) + 1;
      if (q.savedAt) clientsMap[clientName].lastOrderDate = q.savedAt;

      // 3. Raggruppamento Mese (formato atteso da savedAt: "DD/MM/YYYY...")
      let monthLabel = 'Recenti';
      if (q.savedAt && q.savedAt.includes('/')) {
        const parts = q.savedAt.split(',')[0].trim().split('/');
        if (parts.length === 3) {
          const mNum = parseInt(parts[1], 10);
          const yNum = parts[2].slice(-2);
          const monthNames = ['', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
          monthLabel = `${monthNames[mNum] || parts[1]} '${yNum}`;
        }
      }

      if (!monthlyMap[monthLabel]) {
        monthlyMap[monthLabel] = { month: monthLabel, revenue: 0, profit: 0, hours: 0, ordersCount: 0 };
      }
      monthlyMap[monthLabel].revenue += rev;
      monthlyMap[monthLabel].profit += profit;
      monthlyMap[monthLabel].hours += durationHours;
      monthlyMap[monthLabel].ordersCount += 1;
    });

    const totalOrders = quotes.length;
    const averageMarginPct = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Ripartizione Materiali formattata con percentuali
    const totalGramsAll = Object.values(materialsMap).reduce((sum, m) => sum + m.totalGrams, 0);
    const materialBreakdown = Object.entries(materialsMap).map(([material, data]) => ({
      material,
      count: data.count,
      totalGrams: +data.totalGrams.toFixed(1),
      totalRevenue: +data.totalRevenue.toFixed(2),
      percentage: totalGramsAll > 0 ? Math.round((data.totalGrams / totalGramsAll) * 100) : Math.round((data.count / totalOrders) * 100)
    })).sort((a, b) => b.totalGrams - a.totalGrams);

    // Classifica Top Clienti
    const topClients = Object.entries(clientsMap).map(([name, data]) => {
      // Trova materiale preferito
      const fav = Object.entries(data.materials).sort((a, b) => b[1] - a[1])[0]?.[0] || 'PLA';
      return {
        name,
        totalSpent: +data.totalSpent.toFixed(2),
        totalProfit: +data.totalProfit.toFixed(2),
        orderCount: data.orderCount,
        lastOrderDate: data.lastOrderDate,
        favoriteMaterial: fav,
        marginPct: data.totalSpent > 0 ? Math.round((data.totalProfit / data.totalSpent) * 100) : 0
      };
    }).sort((a, b) => b.totalSpent - a.totalSpent);

    const monthlyTrends = Object.values(monthlyMap);

    return NextResponse.json({
      kpis: {
        totalRevenue: +totalRevenue.toFixed(2),
        totalProfit: +totalProfit.toFixed(2),
        averageMarginPct: Math.round(averageMarginPct),
        totalOrders,
        completedOrders,
        totalPrintHours: +totalPrintHours.toFixed(1),
        totalFilamentWeightGrams: +totalFilamentWeightGrams.toFixed(1),
        averageOrderValue: +averageOrderValue.toFixed(2)
      },
      monthlyTrends,
      materialBreakdown,
      topClients
    });
  } catch (err) {
    return NextResponse.json({ 
      error: 'Errore elaborazione statistiche', 
      details: err instanceof Error ? err.message : String(err) 
    }, { status: 500 });
  }
}
