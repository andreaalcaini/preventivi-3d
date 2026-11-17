'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, ChevronDown, ChevronUp } from 'lucide-react';

export interface ThreadMessage {
  id: string;
  author: 'cliente' | 'laboratorio';
  authorName: string;
  text: string;
  at: string;
}

function when(iso: string) {
  return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Conversazione su un ordine. `side` indica chi sta scrivendo:
 * - "cliente": usa l'API pubblica con il codice ordine
 * - "laboratorio": usa l'API riservata del gestionale
 */
export default function OrderThread({
  orderId,
  side,
  collapsible = false,
  initialCount = 0,
  unreadCount = 0,
  onRead,
}: {
  orderId: string;
  side: 'cliente' | 'laboratorio';
  collapsible?: boolean;
  initialCount?: number;
  unreadCount?: number;
  onRead?: () => void;
}) {
  const [open, setOpen] = useState(!collapsible);
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const base = side === 'cliente' ? '/api/public/order/messages' : '/api/order-messages';
  const query = side === 'cliente' ? `code=${encodeURIComponent(orderId)}` : `id=${encodeURIComponent(orderId)}`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${base}?${query}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        onRead?.();
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    }
  }, [base, query, onRead]);

  useEffect(() => {
    if (open && messages === null) load();
  }, [open, messages, load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(side === 'cliente' ? { code: orderId, text } : { id: orderId, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Invio non riuscito');
        return;
      }
      setMessages(data.messages || []);
      setText('');
    } catch {
      setError('Errore di connessione');
    } finally {
      setSending(false);
    }
  };

  const count = messages?.length ?? initialCount;
  const other = side === 'cliente' ? 'laboratorio' : 'cliente';

  return (
    <section className="rounded-xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => collapsible && setOpen(o => !o)}
        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${collapsible ? 'hover:bg-raised rounded-xl' : 'cursor-default'}`}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-ink">
          <MessageSquare className="h-4 w-4 text-ink-faint" strokeWidth={1.75} />
          {side === 'cliente' ? 'Messaggi con il laboratorio' : 'Messaggi con il cliente'}
          {count > 0 && <span className="text-ink-faint font-normal">({count})</span>}
          {unreadCount > 0 && !open && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-on-accent">{unreadCount} nuovi</span>
          )}
        </span>
        {collapsible && (open ? <ChevronUp className="h-4 w-4 text-ink-faint" /> : <ChevronDown className="h-4 w-4 text-ink-faint" />)}
      </button>

      {open && (
        <div className="border-t border-line px-4 py-4 space-y-4">
          {messages === null ? (
            <div className="space-y-2" aria-hidden="true">
              <div className="h-10 w-2/3 rounded-lg bg-raised animate-pulse" />
              <div className="ml-auto h-10 w-1/2 rounded-lg bg-raised animate-pulse" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-ink-muted">
              {side === 'cliente'
                ? 'Hai una domanda su questo ordine? Scrivi qui: il laboratorio ti risponderà in questa pagina.'
                : 'Nessun messaggio. Quello che scrivi qui il cliente lo vede nella pagina di tracking.'}
            </p>
          ) : (
            <ol className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {messages.map(m => {
                const mine = m.author === side;
                return (
                  <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm ${mine ? 'bg-accent-soft text-ink' : 'bg-raised text-ink'}`}>
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</p>
                      <p className="mt-1 text-xs text-ink-faint">
                        {m.author === other || !mine ? m.authorName : 'Tu'} · {when(m.at)}
                      </p>
                    </div>
                  </li>
                );
              })}
              <div ref={endRef} />
            </ol>
          )}

          <form onSubmit={send} className="space-y-2">
            <label htmlFor={`msg-${side}-${orderId}`} className="sr-only">Messaggio</label>
            <textarea
              id={`msg-${side}-${orderId}`}
              rows={2}
              maxLength={1000}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(e as unknown as React.FormEvent);
              }}
              placeholder={side === 'cliente' ? 'Scrivi al laboratorio…' : 'Scrivi al cliente…'}
              className="field resize-y"
            />
            <div className="flex items-center justify-between gap-3">
              {error ? <p className="text-sm text-danger-ink" role="alert">{error}</p> : <span className="text-xs text-ink-faint">Ctrl+Invio per inviare</span>}
              <button type="submit" disabled={sending || !text.trim()} className="btn btn-primary btn-sm">
                <Send className="h-3.5 w-3.5" strokeWidth={1.75} /> {sending ? 'Invio…' : 'Invia'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
