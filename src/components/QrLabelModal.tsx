'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Printer, X, Box, Package, ExternalLink, Download } from 'lucide-react';

export interface SpoolLabelData {
  type: 'spool';
  id: string;
  brand: string;
  material: string;
  color: string;
  colorHex?: string;
  weightRemaining: number;
  weightTotal?: number;
  tareWeight?: number;
  cost?: number;
}

export interface ParcelLabelData {
  type: 'parcel';
  orderId: string;
  clientName: string;
  projectName: string;
  material: string;
  savedAt: string;
  totalCalculated: number;
}

export type LabelData = SpoolLabelData | ParcelLabelData;

interface Props {
  data: LabelData;
  onClose: () => void;
}

export default function QrLabelModal({ data, onClose }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [targetUrl, setTargetUrl] = useState<string>('');

  useEffect(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    let url = '';

    if (data.type === 'spool') {
      url = `${origin}/magazzino?spoolId=${encodeURIComponent(data.id)}&weigh=1`;
    } else {
      url = `${origin}/ordine?code=${encodeURIComponent(data.orderId)}`;
    }

    setTargetUrl(url);

    QRCode.toDataURL(url, {
      width: 256,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
      .then(urlData => setQrDataUrl(urlData))
      .catch(err => console.error('Errore generazione QR Code:', err));
  }, [data]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      
      {/* Box Principale */}
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-6">
        
        {/* Header Modal (nascosto in stampa) */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              {data.type === 'spool' ? <Box className="w-5 h-5" /> : <Package className="w-5 h-5" />}
            </div>
            <div>
              <span>{data.type === 'spool' ? 'Etichetta QR Bobina' : 'Etichetta Pacco Commessa'}</span>
              <span className="block text-[11px] font-normal text-slate-400">
                {data.type === 'spool' ? 'Da attaccare sulla bobina fisica per pesarla' : 'Da applicare sulla scatola di consegna al cliente'}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ANTEPRIMA ETICHETTA (Questo blocco sarà stampato) */}
        <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 flex justify-center items-center">
          
          <div id="printable-qr-label" className="bg-white text-black p-4 rounded-xl shadow-lg w-[320px] font-sans border-2 border-dashed border-gray-400 print:border-none print:shadow-none print:w-[60mm] print:h-[40mm] print:p-2 print:rounded-none">
            
            {data.type === 'spool' ? (
              /* ETICHETTA BOBINA */
              <div className="flex flex-col justify-between h-full text-left">
                
                {/* Header Marca & Materiale */}
                <div className="border-b border-black pb-1 mb-2 flex justify-between items-baseline">
                  <div>
                    <span className="font-black text-xs uppercase tracking-wider block leading-tight">
                      {data.brand || 'Filamento'}
                    </span>
                    <span className="text-[10px] font-bold text-gray-700 uppercase">
                      {data.material || 'PLA'}
                    </span>
                  </div>
                  {data.colorHex && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium">{data.color}</span>
                      <span 
                        className="w-3.5 h-3.5 rounded-full border border-black inline-block" 
                        style={{ backgroundColor: data.colorHex }}
                      />
                    </div>
                  )}
                </div>

                {/* Centro: QR Code + Dati Peso */}
                <div className="flex items-center gap-3 my-1">
                  {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={qrDataUrl} 
                      alt="QR Code Bobina" 
                      className="w-20 h-20 flex-shrink-0 border border-black p-0.5 rounded"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-200 animate-pulse rounded" />
                  )}

                  <div className="text-[11px] leading-tight space-y-1 min-w-0">
                    <div>
                      <span className="text-[9px] text-gray-500 uppercase block">Rimanente</span>
                      <strong className="text-sm font-black text-black">{data.weightRemaining}g</strong>
                    </div>
                    {data.tareWeight !== undefined && (
                      <div>
                        <span className="text-[9px] text-gray-500 uppercase block">Tara Vuoto</span>
                        <span className="font-semibold text-gray-800">{data.tareWeight}g</span>
                      </div>
                    )}
                    {data.cost !== undefined && (
                      <div className="text-[10px] text-gray-600">
                        Costo: <strong>€{data.cost.toFixed(2)}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer con istruzione per la scansione */}
                <div className="mt-2 pt-1 border-t border-gray-300 flex justify-between items-center text-[8px] text-gray-600">
                  <span>Inquadra QR per pesare</span>
                  <span className="font-mono">ID: {data.id.slice(0, 8)}</span>
                </div>

              </div>
            ) : (
              /* ETICHETTA PACCO / COMMESSA CLIENTE */
              <div className="flex flex-col justify-between h-full text-left">
                
                {/* Header Laboratorio */}
                <div className="border-b border-black pb-1 mb-2 flex justify-between items-baseline">
                  <div>
                    <span className="font-black text-xs uppercase tracking-tight block">
                      Preventivi 3D Lab
                    </span>
                    <span className="text-[9px] text-gray-600 uppercase">Commessa di Stampa</span>
                  </div>
                  <span className="font-mono text-[9px] font-bold">
                    #{data.orderId.slice(0, 8)}
                  </span>
                </div>

                {/* Centro: QR + Dettagli Commessa */}
                <div className="flex items-center gap-3 my-1">
                  {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={qrDataUrl} 
                      alt="QR Code Ordine" 
                      className="w-20 h-20 flex-shrink-0 border border-black p-0.5 rounded"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-200 animate-pulse rounded" />
                  )}

                  <div className="text-[11px] leading-tight space-y-1 min-w-0">
                    <div>
                      <span className="text-[9px] text-gray-500 uppercase block">Destinatario</span>
                      <strong className="text-xs font-bold text-black truncate block">{data.clientName}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-500 uppercase block">Oggetto</span>
                      <span className="font-medium text-gray-800 truncate block text-[10px]">{data.projectName}</span>
                    </div>
                    <div className="text-[10px] text-gray-600">
                      Mat: <strong>{data.material}</strong>
                    </div>
                  </div>
                </div>

                {/* Totale & Footer */}
                <div className="mt-2 pt-1 border-t-2 border-black flex justify-between items-baseline">
                  <span className="text-[9px] uppercase font-bold text-gray-600">Totale Dovuto</span>
                  <span className="text-base font-black text-black">€{data.totalCalculated.toFixed(2)}</span>
                </div>

                <div className="mt-1 text-center text-[7px] text-gray-500">
                  Scansiona il QR Code per visualizzare scheda e stato ordine
                </div>

              </div>
            )}

          </div>

        </div>

        {/* Pulsanti Azione (nascosti in stampa) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800 print:hidden">
          <a 
            href={targetUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-slate-400 hover:text-cyan-400 transition-colors inline-flex items-center gap-1.5"
          >
            <span>Apri link collegato al QR</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Chiudi
            </button>

            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-initial py-2 px-5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-md shadow-cyan-950 flex items-center justify-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Stampa Etichetta</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
