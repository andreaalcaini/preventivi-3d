'use client';

import React, { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { 
  Bell, BellRing, Volume2, VolumeX, Sparkles, 
  CheckCircle2, AlertCircle, X, ExternalLink, Smartphone, 
  Radio, Loader2
} from 'lucide-react';
import type { LabNotification } from '@/lib/notification-bus';

function subscribeToStorage(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getSoundSnapshot(): string {
  return localStorage.getItem('printquote_sound_notifications') ?? 'true';
}

function getSoundServerSnapshot(): string {
  return 'true';
}

function checkPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

function checkPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'default';
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Chime armonico a due toni con Web Audio API (senza file mp3 esterni)
function playLabChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Tono 1: Mi5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tono 2: Si5 (987.77 Hz) con attacco ritardato
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.11);
    gain2.gain.setValueAtTime(0.15, now + 0.11);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.11);
    osc2.stop(now + 0.6);
  } catch {
    // Audio autoplay bloccato o contesto non supportato
  }
}

export function NotificationManager({ align = 'right' }: { align?: 'left' | 'right' } = {}) {
  const [activeToasts, setActiveToasts] = useState<LabNotification[]>([]);
  const [isPushSupported] = useState(checkPushSupported);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission>(checkPermission);
  const rawSound = useSyncExternalStore(
    subscribeToStorage,
    getSoundSnapshot,
    getSoundServerSnapshot
  );
  const soundEnabled = rawSound !== 'false';
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Inizializzazione Service Worker
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(async (registration) => {
          const sub = await registration.pushManager.getSubscription();
          setIsSubscribed(!!sub);
        })
        .catch((err) => {
          console.warn('Registrazione Service Worker non riuscita:', err);
        });
    }
  }, []);

  // Ascolto Server-Sent Events (SSE) per i popup real-time quando la scheda è aperta
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    function connectSSE() {
      try {
        eventSource = new EventSource('/api/notifications/stream');

        eventSource.addEventListener('quote', (event) => {
          try {
            const data: LabNotification = JSON.parse(event.data);
            
            // Riproduci chime sonoro se abilitato
            if (localStorage.getItem('printquote_sound_notifications') !== 'false') {
              playLabChime();
            }

            // Aggiungi al flusso toast
            setActiveToasts((prev) => [data, ...prev.slice(0, 4)]);

            // Auto-chiusura dopo 12 secondi
            setTimeout(() => {
              setActiveToasts((current) => current.filter((t) => t.id !== data.id));
            }, 12000);
          } catch (e) {
            console.error('Errore parsing evento notifica:', e);
          }
        });

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // Riconnetti con backoff
          reconnectTimeout = setTimeout(connectSSE, 5000);
        };
      } catch {
        reconnectTimeout = setTimeout(connectSSE, 5000);
      }
    }

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      clearTimeout(reconnectTimeout);
    };
  }, []);

  // Chiudi il menu se si clicca fuori
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const toggleSound = () => {
    const next = !soundEnabled;
    localStorage.setItem('printquote_sound_notifications', String(next));
    window.dispatchEvent(new Event('storage'));
    if (next) {
      playLabChime();
    }
  };

  const subscribePush = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const perm = await Notification.requestPermission();
      setPermissionState(perm);
      if (perm !== 'granted') {
        setStatusMessage({ type: 'error', text: 'Permesso notifiche negato nel browser' });
        setIsLoading(false);
        return;
      }

      // Recupera chiave pubblica VAPID dal server
      const vapidRes = await fetch('/api/push/vapid-public-key');
      const { publicKey } = await vapidRes.json();
      if (!publicKey) throw new Error('Chiave pubblica VAPID non disponibile');

      const convertedKey = urlBase64ToUint8Array(publicKey);
      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });

      // Salva sul server
      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      });

      if (!saveRes.ok) throw new Error('Impossibile salvare la sottoscrizione');

      setIsSubscribed(true);
      setStatusMessage({ type: 'success', text: 'Notifiche push attivate su questo dispositivo!' });
    } catch (err) {
      console.error(err);
      setStatusMessage({ 
        type: 'error', 
        text: err instanceof Error ? err.message : 'Errore attivazione notifiche push' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribePush = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
      setStatusMessage({ type: 'success', text: 'Notifiche push disattivate su questo dispositivo' });
    } catch (err) {
      setStatusMessage({ 
        type: 'error', 
        text: err instanceof Error ? err.message : 'Errore disattivazione notifiche' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestNotification = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ 
          type: 'success', 
          text: `Test inviato! Push: ${data.pushResult?.successCount || 0} dispositivi raggiunti` 
        });
      } else {
        throw new Error(data.error || 'Errore durante l\'invio');
      }
    } catch (err) {
      setStatusMessage({ 
        type: 'error', 
        text: err instanceof Error ? err.message : 'Errore test' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const dismissToast = useCallback((id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <>
      {/* TRIGGER CAMPANELLA NELL'HEADER */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`relative p-2 rounded-full text-xs font-medium transition-all border active:scale-[0.98] ${
            isSubscribed
              ? 'bg-accent-soft border-accent-line text-accent-ink '
              : 'bg-raised border-line text-ink-muted hover:text-ink hover:border-line-strong'
          }`}
          title={isSubscribed ? "Notifiche Push Attive" : "Configura Notifiche Preventivi"}
          aria-label="Menu Notifiche"
        >
          {isSubscribed ? (
            <BellRing className="w-4 h-4 text-accent-ink" strokeWidth={1.75} />
          ) : (
            <Bell className="w-4 h-4" strokeWidth={1.75} />
          )}

          {/* Micro dot indicatore di stato */}
          <span 
            className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${
              isSubscribed ? 'bg-accent' : 'bg-muted'
            }`} 
          />
        </button>

        {/* POPOVER DI CONFIGURAZIONE NOTIFICHE */}
        {isMenuOpen && (
          <div className={`absolute ${align === 'left' ? 'left-0 bottom-full mb-2' : 'right-0 mt-2'} w-80 sm:w-96 bg-surface border border-line rounded-xl shadow-lg p-4 z-50`}>
            {/* Intestazione */}
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-accent-soft border border-accent-line rounded-lg text-accent-ink">
                  <Radio className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-ink tracking-tight">Centro Notifiche Lab</h4>
                  <p className="text-[10px] text-ink-muted font-mono">Avvisi Richieste Preventivo</p>
                </div>
              </div>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="p-1 text-ink-muted hover:text-ink rounded-lg transition-colors"
                aria-label="Chiudi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stato e Opzioni */}
            <div className="py-3 space-y-3 text-xs">
              {/* Push Smartphone */}
              <div className="p-3 rounded-xl bg-raised border border-line flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-medium text-ink">
                    <Smartphone className="w-3.5 h-3.5 text-info-ink" />
                    <span>Push Smartphone</span>
                  </div>
                  <p className="text-[10px] text-ink-muted mt-0.5 leading-snug">
                    {isSubscribed
                      ? 'Attive su questo dispositivo'
                      : permissionState === 'denied'
                      ? 'Permesso bloccato nel browser'
                      : 'Ricevi avvisi anche a telefono spento'}
                  </p>
                </div>

                {isPushSupported ? (
                  <button
                    onClick={isSubscribed ? unsubscribePush : subscribePush}
                    disabled={isLoading || permissionState === 'denied'}
                    className={`px-3 py-1.5 rounded-lg font-semibold text-[11px] transition-all flex items-center gap-1.5 ${
                      isSubscribed
                        ? 'bg-danger-soft hover:bg-danger-soft text-danger-ink border border-danger-line'
                        : 'bg-accent-soft hover:bg-accent-soft text-accent-ink border border-accent-line shadow-sm'
                    } disabled:opacity-50`}
                  >
                    {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>{isSubscribed ? 'Disattiva' : 'Abilita'}</span>
                  </button>
                ) : (
                  <span className="text-[10px] text-warn-ink font-mono">Non Supportato</span>
                )}
              </div>

              {/* Suono Chime In-App */}
              <div className="p-3 rounded-xl bg-raised border border-line flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-medium text-ink">
                    {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-accent-ink" /> : <VolumeX className="w-3.5 h-3.5 text-ink-faint" />}
                    <span>Suono di Avviso</span>
                  </div>
                  <p className="text-[10px] text-ink-muted mt-0.5">
                    Chime sonoro all&apos;arrivo di un preventivo
                  </p>
                </div>

                <button
                  onClick={toggleSound}
                  className={`px-3 py-1.5 rounded-lg font-semibold text-[11px] transition-all ${
                    soundEnabled
                      ? 'bg-accent-soft text-accent-ink border border-accent-line'
                      : 'bg-raised text-ink-muted border border-line'
                  }`}
                >
                  {soundEnabled ? 'Attivo' : 'Muto'}
                </button>
              </div>

              {/* Feedback Messaggio */}
              {statusMessage && (
                <div
                  className={`p-2.5 rounded-xl text-[11px] flex items-center gap-2 border ${
                    statusMessage.type === 'success'
                      ? 'bg-accent-soft border-accent-line text-accent-ink'
                      : 'bg-danger-soft border-danger-line text-danger-ink'
                  }`}
                >
                  {statusMessage.type === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* Tasto Test */}
              <div className="pt-1">
                <button
                  onClick={sendTestNotification}
                  disabled={isLoading}
                  className="w-full py-2 px-3 rounded-xl bg-raised hover:bg-muted border border-line text-ink hover:text-ink font-medium text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-warn-ink" />}
                  <span>Invia Notifica di Prova Adesso</span>
                </button>
              </div>

              {/* Nota iOS / PWA */}
              <p className="text-[9px] text-ink-faint leading-normal border-t border-line pt-2">
                <span className="font-semibold text-ink-muted">Su iPhone (iOS 16.4+):</span> aggiungi l&apos;app alla schermata Home da Safari (Condividi &rarr; &ldquo;Aggiungi a schermata Home&rdquo;) per ricevere notifiche a telefono bloccato.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* POPUP TOAST DOPPELRAND IN-APP (QUANDO IL SITO È APERTO) */}
      <div 
        className="fixed top-18 right-3 sm:right-6 z-[100] flex flex-col gap-2.5 max-w-sm w-[calc(100vw-1.5rem)] pointer-events-none print:hidden"
        aria-live="polite"
      >
        {activeToasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto bg-sunken border border-accent-line ring-1 ring-accent/30 rounded-xl p-3.5 shadow-lg animate-in slide-in-from-top-4 fade-in duration-300 flex flex-col gap-2 relative group overflow-hidden"
          >
            {/* Top Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-0.5 animate-pulse" />

            {/* Header del Toast */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                </span>
                <span className="text-[11px] font-mono text-accent-ink font-bold">
                  Nuovo Preventivo
                </span>
                <span className="text-[9px] font-mono text-ink-faint">
                  {toast.dateStr || 'Adesso'}
                </span>
              </div>

              <button
                onClick={() => dismissToast(toast.id)}
                className="text-ink-muted hover:text-ink p-1 rounded-lg transition-colors"
                aria-label="Chiudi notifica"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Contenuto Dettagliato */}
            <div>
              <h4 className="text-xs font-bold text-ink tracking-tight line-clamp-1">
                {toast.projectName}
              </h4>
              <p className="text-[11px] text-ink-muted mt-0.5">
                Da <span className="font-semibold text-accent-ink">{toast.clientName}</span>
                {toast.material ? ` • ${toast.material}` : ''}
              </p>
              {toast.totalCalculated > 0 && (
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[10px] text-ink-muted">Importo Stimato:</span>
                  <span className="text-xs font-mono font-bold text-accent-ink">
                    €{toast.totalCalculated.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Azioni Rapide */}
            <div className="pt-1 flex items-center justify-end gap-2">
              <Link
                href="/preventivi"
                onClick={() => dismissToast(toast.id)}
                className="px-2.5 py-1 rounded-lg bg-accent-soft hover:bg-accent-soft border border-accent-line text-accent-ink font-semibold text-[11px] flex items-center gap-1 transition-all active:scale-[0.98]"
              >
                <span>Vedi Preventivo</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
