'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, Wallet, Clock, 
  Package, Award, Layers, ShoppingBag, 
  ExternalLink, ArrowUpRight
} from 'lucide-react';
import Link from 'next/link';

interface KPIs {
  totalRevenue: number;
  totalProfit: number;
  averageMarginPct: number;
  totalOrders: number;
  completedOrders: number;
  totalPrintHours: number;
  totalFilamentWeightGrams: number;
  averageOrderValue: number;
}

interface MonthlyTrend {
  month: string;
  revenue: number;
  profit: number;
  hours: number;
  ordersCount: number;
}

interface MaterialItem {
  material: string;
  count: number;
  totalGrams: number;
  totalRevenue: number;
  percentage: number;
}

interface TopClient {
  name: string;
  totalSpent: number;
  totalProfit: number;
  orderCount: number;
  lastOrderDate: string;
  favoriteMaterial: string;
  marginPct: number;
}

const MATERIAL_COLORS: Record<string, string> = {
  PLA: '#10b981', // Emerald
  PETG: '#06b6d4', // Cyan
  TPU: '#a855f7', // Purple
  ABS: '#f97316', // Orange
  ASA: '#ef4444', // Red
  'Nylon/PA': '#eab308', // Yellow
  'Policarbonato (PC)': '#3b82f6', // Blue
  'Resina UV': '#ec4899' // Pink
};

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [trends, setTrends] = useState<MonthlyTrend[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics');
      const data = await res.json();
      if (data.kpis) {
        setKpis(data.kpis);
        setTrends(data.monthlyTrends || []);
        setMaterials(data.materialBreakdown || []);
        setTopClients(data.topClients || []);
      }
    } catch {
      console.error('Errore caricamento statistiche');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const maxRevenue = trends.length > 0 ? Math.max(...trends.map(t => t.revenue), 10) : 10;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-sunken text-ink p-2 sm:p-4 font-sans relative">
      <div className="max-w-7xl mx-auto w-full flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-ink tracking-tight flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-accent-ink" />
              Dashboard Finanziaria & Analytics Laboratorio
            </h1>
            <p className="text-ink-muted text-xs">
              Monitora l&apos;andamento dei ricavi, i margini netti e i materiali più consumati per pianificare i riordini
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/clienti"
              className="px-3 py-1.5 bg-surface border border-line hover:border-line-strong text-ink-muted text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5"
            >
              <span>Rubrica Clienti</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-ink-faint text-xs gap-3">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span>Elaborazione statistiche del laboratorio...</span>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              
              {/* 1. Fatturato */}
              <div className="bg-surface border border-line rounded-xl p-5 shadow-lg space-y-1">
                <span className="text-xs text-ink-muted font-medium flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-accent-ink" />
                  Fatturato Complessivo
                </span>
                <span className="text-2xl font-semibold text-ink block">
                  €{(kpis?.totalRevenue || 0).toFixed(2)}
                </span>
                <p className="text-[11px] text-ink-faint">
                  Media per pezzo: <strong>€{(kpis?.averageOrderValue || 0).toFixed(2)}</strong>
                </p>
              </div>

              {/* 2. Utile Netto */}
              <div className="bg-surface border border-line rounded-xl p-5 shadow-lg space-y-1">
                <span className="text-xs text-ink-muted font-medium flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-accent-ink" />
                  Tuo Utile Netto Stimato
                </span>
                <span className="text-2xl font-semibold text-accent-ink block">
                  €{(kpis?.totalProfit || 0).toFixed(2)}
                </span>
                <p className="text-[11px] text-ink-faint">
                  Margine medio: <strong className="text-accent-ink">{kpis?.averageMarginPct || 0}%</strong>
                </p>
              </div>

              {/* 3. Ore di Stampa */}
              <div className="bg-surface border border-line rounded-xl p-5 shadow-lg space-y-1">
                <span className="text-xs text-ink-muted font-medium flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-info-ink" />
                  Tempo Macchina Totale
                </span>
                <span className="text-2xl font-semibold text-info-ink block">
                  {(kpis?.totalPrintHours || 0).toFixed(1)} h
                </span>
                <p className="text-[11px] text-ink-faint">
                  Pari a <strong>{((kpis?.totalPrintHours || 0) / 24).toFixed(1)} giorni</strong> di estrusione continua
                </p>
              </div>

              {/* 4. Filamento Estruso */}
              <div className="bg-surface border border-line rounded-xl p-5 shadow-lg space-y-1">
                <span className="text-xs text-ink-muted font-medium flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-info-ink" />
                  Filamento Consumato
                </span>
                <span className="text-2xl font-semibold text-info-ink block">
                  {((kpis?.totalFilamentWeightGrams || 0) / 1000).toFixed(2)} kg
                </span>
                <p className="text-[11px] text-ink-faint">
                  {kpis?.totalOrders || 0} ordini registrati ({kpis?.completedOrders || 0} saldati/pronti)
                </p>
              </div>

            </div>

            {/* Sezione 2 Colonne: Grafico Temporale a Sinistra, Ripartizione Materiali a Destra */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Grafico Temporale (7 Colonne) */}
              <div className="lg:col-span-7 bg-surface border border-line rounded-xl p-6 shadow-lg space-y-6 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center pb-3 border-b border-line">
                    <div>
                      <h3 className="font-bold text-ink text-base">Andamento Ricavi vs Utile Netto</h3>
                      <p className="text-xs text-ink-muted">Riepilogo temporale delle commesse registrate</p>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-ink-muted">
                        <span className="w-2.5 h-2.5 rounded-sm bg-accent inline-block" /> Fatturato
                      </span>
                      <span className="flex items-center gap-1 text-ink-muted">
                        <span className="w-2.5 h-2.5 rounded-sm bg-info inline-block" /> Utile Netto
                      </span>
                    </div>
                  </div>

                  {trends.length === 0 ? (
                    <div className="py-20 text-center text-ink-faint text-xs">
                      Dati insufficienti per generare il grafico temporale.
                    </div>
                  ) : (
                    <div className="pt-6 space-y-6">
                      {/* Istogramma SVG Dinamico con protezione overflow mobile */}
                      <div className="overflow-x-auto pb-2">
                        <div className="h-48 min-w-[300px] w-full flex items-end justify-around gap-2 px-2 border-b border-line pb-2">
                          {trends.map((t, idx) => {
                            const revHeight = Math.max(12, Math.round((t.revenue / maxRevenue) * 160));
                            const profitHeight = Math.max(8, Math.round((t.profit / maxRevenue) * 160));
                            return (
                              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
                                {/* Tooltip Hover */}
                                <div className="absolute -top-12 bg-sunken border border-line-strong text-ink text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
                                  <div>Fatturato: €{t.revenue.toFixed(2)}</div>
                                  <div className="text-accent-ink font-bold">Utile: €{t.profit.toFixed(2)}</div>
                                </div>

                                <div className="w-full flex justify-center items-end gap-1.5 h-44">
                                  <div 
                                    className="w-4 sm:w-6 bg-accent rounded-t-md transition-all group-hover:brightness-110"
                                    style={{ height: `${revHeight}px` }}
                                    title={`Fatturato: €{t.revenue.toFixed(2)}`}
                                  />
                                  <div 
                                    className="w-4 sm:w-6 bg-info rounded-t-md transition-all group-hover:brightness-110"
                                    style={{ height: `${profitHeight}px` }}
                                    title={`Utile: €{t.profit.toFixed(2)}`}
                                  />
                                </div>

                                <span className="text-[10px] font-mono text-ink-muted group-hover:text-ink">
                                  {t.month}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[11px] text-ink-faint">
                        <span>Min: €0.00</span>
                        <span>Picco massimo periodo: €{maxRevenue.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-sunken border border-line rounded-xl text-xs text-ink-muted flex items-center justify-between">
                  <span>Totale commesse incluse: <strong>{kpis?.totalOrders || 0}</strong></span>
                  <span className="text-accent-ink font-bold">Margine Medio: {kpis?.averageMarginPct || 0}%</span>
                </div>
              </div>

              {/* Ripartizione Materiali (5 Colonne) */}
              <div className="lg:col-span-5 bg-surface border border-line rounded-xl p-6 shadow-lg space-y-5 flex flex-col justify-between">
                <div>
                  <div className="pb-3 border-b border-line">
                    <h3 className="font-bold text-ink text-base flex items-center gap-2">
                      <Layers className="w-4 h-4 text-info-ink" />
                      Ripartizione Materiali & Consumi
                    </h3>
                    <p className="text-xs text-ink-muted">
                      Usa questi dati per capire quali filamenti riordinare prima che finiscano
                    </p>
                  </div>

                  {materials.length === 0 ? (
                    <div className="py-20 text-center text-ink-faint text-xs">
                      Nessun materiale registrato.
                    </div>
                  ) : (
                    <div className="space-y-4 pt-4">
                      {materials.map((m) => {
                        const barColor = MATERIAL_COLORS[m.material] || '#10b981';
                        return (
                          <div key={m.material} className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-ink flex items-center gap-1.5">
                                <span 
                                  className="w-2.5 h-2.5 rounded-full inline-block"
                                  style={{ backgroundColor: barColor }}
                                />
                                {m.material}
                              </span>
                              <div className="text-right font-mono text-[11px]">
                                <span className="font-bold text-ink">{m.percentage}%</span>
                                <span className="text-ink-muted ml-1.5">({(m.totalGrams / 1000).toFixed(2)} kg)</span>
                              </div>
                            </div>

                            <div className="w-full bg-sunken h-2.5 rounded-full overflow-hidden border border-line">
                              <div 
                                className="h-full rounded-full transition-all"
                                style={{ width: `${m.percentage}%`, backgroundColor: barColor }}
                              />
                            </div>

                            <div className="flex justify-between text-[10px] text-ink-faint">
                              <span>{m.count} pezzi realizzati</span>
                              <span>Fatturato associato: €{m.totalRevenue.toFixed(2)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="p-3 bg-sunken border border-line rounded-xl text-xs text-ink-muted flex items-center justify-between">
                  <span>Totale bobine consumate stimate:</span>
                  <strong className="text-ink font-mono">
                    {Math.ceil((kpis?.totalFilamentWeightGrams || 0) / 1000)} bobine da 1kg
                  </strong>
                </div>
              </div>

            </div>

            {/* Classifica Top Clienti */}
            <div className="bg-surface border border-line rounded-xl p-6 shadow-lg space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-line">
                <div>
                  <h3 className="text-base font-bold text-ink flex items-center gap-2">
                    <Award className="w-4 h-4 text-warn-ink" />
                    Classifica Clienti più Fedeli (Top Spenders)
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Clienti che generano il maggior volume d&apos;affari e utile per il laboratorio
                  </p>
                </div>

                <Link
                  href="/clienti"
                  className="text-xs text-accent-ink hover:underline flex items-center gap-1 font-medium"
                >
                  <span>Apri Rubrica Completa</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              {topClients.length === 0 ? (
                <div className="py-12 text-center text-ink-faint text-xs">
                  Nessun cliente registrato nei preventivi.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left min-w-[540px]">
                    <thead>
                      <tr className="text-ink-muted text-[11px] pb-2 border-b border-line">
                        <th className="py-2.5 font-semibold">Posizione / Cliente</th>
                        <th className="py-2.5 font-semibold text-center">Ordini</th>
                        <th className="py-2.5 font-semibold">Materiale Preferito</th>
                        <th className="py-2.5 font-semibold text-right">Fatturato Totale</th>
                        <th className="py-2.5 font-semibold text-right">Tuo Utile Netto</th>
                        <th className="py-2.5 font-semibold text-right">Margine %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {topClients.map((client, idx) => {
                        const medal = `#${idx + 1}`;
                        return (
                          <tr key={client.name} className="hover:bg-sunken transition-colors">
                            <td className="py-3 font-medium text-ink flex items-center gap-2.5">
                              <span className="text-sm font-bold w-6">{medal}</span>
                              <Link 
                                href={`/clienti?client=${encodeURIComponent(client.name)}`}
                                className="hover:text-accent-ink transition-colors font-bold"
                              >
                                {client.name}
                              </Link>
                            </td>
                            <td className="py-3 text-center text-ink-muted font-mono">
                              {client.orderCount}
                            </td>
                            <td className="py-3 text-ink-muted">
                              <span className="bg-sunken px-2 py-0.5 rounded border border-line text-[11px] text-ink-muted">
                                {client.favoriteMaterial}
                              </span>
                            </td>
                            <td className="py-3 font-bold text-ink text-right font-mono">
                              €{client.totalSpent.toFixed(2)}
                            </td>
                            <td className="py-3 font-bold text-accent-ink text-right font-mono">
                              €{client.totalProfit.toFixed(2)}
                            </td>
                            <td className="py-3 text-right text-ink-muted font-mono">
                              {client.marginPct}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
