'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  HardDrive, Download, Upload, ShieldCheck, 
  AlertTriangle, RefreshCw, FileArchive, CheckCircle2, Clock
} from 'lucide-react';

interface Snapshot {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

export default function BackupPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSnapshots = async () => {
    try {
      const res = await fetch('/api/backup');
      const data = await res.json();
      if (data.snapshots) {
        setSnapshots(data.snapshots);
      }
    } catch {
      console.error('Errore lettura snapshot');
    }
  };

  useEffect(() => {
    fetchSnapshots();
  }, []);

  const handleDownloadZip = () => {
    window.location.href = '/api/backup?download=1';
  };

  const handleCreateSnapshot = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/backup?action=snapshot');
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Nuovo snapshot salvato: ${data.filename}` });
        fetchSnapshots();
      } else {
        setMessage({ type: 'error', text: data.error || 'Errore creazione snapshot' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Errore di connessione al server' });
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`Sei sicuro di voler ripristinare il database dal file "${file.name}"? Tutti i dati attuali verranno aggiornati con quelli presenti nell'archivio.`)) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setRestoring(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({ 
          type: 'success', 
          text: `Ripristino completato con successo! File ripristinati: ${data.restoredFiles?.join(', ')}` 
        });
        fetchSnapshots();
      } else {
        setMessage({ type: 'error', text: data.error || 'Errore durante il ripristino' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Errore di rete durante il caricamento' });
    } finally {
      setRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <HardDrive className="w-6 h-6 text-emerald-400" />
              Centro Backup & Sicurezza Dati
            </h1>
            <p className="text-slate-400 text-sm">
              Esporta, archivia e ripristina l&apos;intero database per prevenire perdite di dati su Raspberry Pi
            </p>
          </div>

          <button
            onClick={handleCreateSnapshot}
            disabled={loading}
            className="px-4 py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 w-full sm:w-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Crea Snapshot Immediato</span>
          </button>
        </div>

        {/* Feedback Message */}
        {message && (
          <div className={`p-4 rounded-xl border text-sm flex items-start gap-3 ${
            message.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">{message.type === 'success' ? 'Operazione Riuscita' : 'Attenzione'}</p>
              <p className="text-xs opacity-90 mt-0.5">{message.text}</p>
            </div>
          </div>
        )}

        {/* Azioni Principali: 2 Card Grandi */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1: Esporta / Download */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 w-fit">
                <Download className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-white">Download Backup Completo (.zip)</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Scarica subito un archivio compresso contenente tutti i preventivi, anagrafiche clienti, magazzino filamenti, account utenti e registri di manutenzione.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={handleDownloadZip}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-950 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Scarica Archivio ZIP (.zip)</span>
              </button>
            </div>
          </div>

          {/* Card 2: Ripristina / Upload */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400 w-fit">
                <Upload className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-white">Ripristina da File Backup</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Seleziona un archivio `.zip` generato in precedenza per ripristinare il sistema in caso di nuova installazione o migrazione. Prima di sovrascrivere, il sistema crea automaticamente una copia di salvataggio.
              </p>
            </div>

            <div className="pt-2">
              <input
                type="file"
                ref={fileInputRef}
                accept=".zip"
                onChange={handleRestoreFile}
                className="hidden"
                id="backup-file-upload"
                disabled={restoring}
              />
              <label
                htmlFor="backup-file-upload"
                className={`w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-2 cursor-pointer ${
                  restoring ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <Upload className="w-4 h-4 text-purple-400" />
                <span>{restoring ? 'Ripristino in corso...' : 'Seleziona File .ZIP e Ripristina'}</span>
              </label>
            </div>
          </div>

        </div>

        {/* Tabella Snapshot Locali su Disco */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                Snapshot Locali su Disco Raspberry Pi
              </h3>
              <p className="text-xs text-slate-400">
                Copie di sicurezza automatiche archiviate in locale su <code>/app/data/backups/</code> (ultimi 15 snapshot)
              </p>
            </div>

            <span className="text-xs bg-slate-950 text-slate-400 px-3 py-1 rounded-lg border border-slate-800">
              {snapshots.length} archivi
            </span>
          </div>

          {snapshots.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Nessuno snapshot locale archiviato al momento. Clicca su &quot;Crea Snapshot Immediato&quot; per generarne uno.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60 overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[500px]">
                <thead>
                  <tr className="text-slate-400 uppercase text-[10px] pb-2">
                    <th className="py-2.5 font-semibold">Nome Archivio</th>
                    <th className="py-2.5 font-semibold">Data Creazione</th>
                    <th className="py-2.5 font-semibold">Dimensione</th>
                    <th className="py-2.5 font-semibold text-right">Azione</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {snapshots.map((s) => (
                    <tr key={s.filename} className="hover:bg-slate-950/40 transition-colors">
                      <td className="py-3 font-mono text-slate-300 flex items-center gap-2">
                        <FileArchive className="w-4 h-4 text-emerald-400/80" />
                        <span>{s.filename}</span>
                      </td>
                      <td className="py-3 text-slate-400">{formatDate(s.createdAt)}</td>
                      <td className="py-3 text-slate-400">{formatBytes(s.sizeBytes)}</td>
                      <td className="py-3 text-right">
                        <button
                          onClick={handleDownloadZip}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium transition-colors inline-flex items-center gap-1"
                          title="Scarica questo backup"
                        >
                          <Download className="w-3 h-3" />
                          <span>Scarica</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Box Informativo Raspberry Pi & Cloud */}
        <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl flex items-start gap-3.5 text-xs text-slate-400">
          <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 leading-relaxed">
            <h4 className="font-bold text-white text-sm">Best Practice per Maker con Raspberry Pi</h4>
            <p>
              Le schede microSD dei Raspberry Pi possono usurarsi con cicli continui di lettura e scrittura. Si consiglia di:
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-slate-300 pt-1">
              <li>Scaricare periodicamente l&apos;archivio ZIP prima di grossi aggiornamenti software.</li>
              <li>Mappare la cartella <code>/app/data</code> su un drive USB / SSD esterno o condivisione NFS/SMB tramite Docker Volume.</li>
              <li>Sincronizzare la cartella <code>/app/data/backups/</code> verso Google Drive o Dropbox tramite strumenti leggeri come <em>rclone</em>.</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
