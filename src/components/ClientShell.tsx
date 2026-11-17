'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Calculator, FolderKanban, Users, Box,
  Eye, EyeOff, Shield, LogOut, BarChart3, Wrench, HardDrive,
  ArrowUpRight, KeyRound, Sun, Moon, Menu, X, Tags, CalendarClock, History, BookMarked, Search, type LucideIcon,
} from 'lucide-react';
import { NotificationManager } from '@/components/NotificationManager';
import CommandSearch from '@/components/CommandSearch';

function subscribeToStorage(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

const getPrivacySnapshot = () => localStorage.getItem('printquote_privacy') || 'false';
const getThemeSnapshot = () => {
  const stored = localStorage.getItem('p3d_theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};
const subscribeToViewport = (cb: () => void) => {
  const mq = window.matchMedia('(min-width: 1024px)');
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const getDesktopSnapshot = () => window.matchMedia('(min-width: 1024px)').matches;
const serverDesktop = () => true;
const serverFalse = () => 'false';
const serverLight = () => 'light';

interface CurrentUser {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'operatore';
}

interface NavItem { href: string; label: string; icon: LucideIcon }

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Lavoro',
    items: [
      { href: '/', label: 'Calcolatore', icon: Calculator },
      { href: '/preventivi', label: 'Preventivi', icon: FolderKanban },
      { href: '/clienti', label: 'Clienti', icon: Users },
      { href: '/catalogo', label: 'Catalogo', icon: BookMarked },
      { href: '/listino', label: 'Listino', icon: Tags },
    ],
  },
  {
    title: 'Laboratorio',
    items: [
      { href: '/produzione', label: 'Produzione', icon: CalendarClock },
      { href: '/magazzino', label: 'Magazzino', icon: Box },
      { href: '/manutenzione', label: 'Manutenzione', icon: Wrench },
      { href: '/dashboard', label: 'Statistiche', icon: BarChart3 },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { href: '/attivita', label: 'Attività', icon: History },
      { href: '/integrazioni', label: 'Integrazioni API', icon: KeyRound },
      { href: '/utenti', label: 'Utenti', icon: Shield },
      { href: '/backup', label: 'Backup', icon: HardDrive },
    ],
  },
];

const PORTALS = [
  { href: '/richiedi-preventivo', label: 'Richiesta preventivo' },
  { href: '/ordine', label: 'Tracciamento ordine' },
];

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 min-w-0">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink text-canvas">
        <Box className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold tracking-tight text-ink leading-tight">Preventivi 3D</span>
        <span className="block text-xs text-ink-faint leading-tight">Gestionale di stampa</span>
      </span>
    </Link>
  );
}

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const privacyMode = useSyncExternalStore(subscribeToStorage, getPrivacySnapshot, serverFalse) === 'true';
  const theme = useSyncExternalStore(subscribeToStorage, getThemeSnapshot, serverLight);
  // Un solo NotificationManager montato alla volta (apre lo stream SSE e mostra i toast)
  const isDesktop = useSyncExternalStore(subscribeToViewport, getDesktopSnapshot, serverDesktop);

  useEffect(() => {
    document.documentElement.classList.toggle('privacy-active', privacyMode);
  }, [privacyMode]);

  const togglePrivacy = () => {
    localStorage.setItem('printquote_privacy', String(!privacyMode));
    window.dispatchEvent(new Event('storage'));
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('p3d_theme', next);
    document.documentElement.dataset.theme = next;
    window.dispatchEvent(new Event('storage'));
  };

  const isPublicPage = pathname === '/login' || pathname === '/privacy' || pathname.startsWith('/ordine') || pathname.startsWith('/richiedi-preventivo');

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isPublicPage) return;
    fetch('/api/auth/me')
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (data?.user) setCurrentUser(data.user); })
      .catch(() => {});
  }, [pathname, isPublicPage]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    }
  };

  if (isPublicPage) {
    return <main className="flex-1 flex flex-col min-h-[100dvh]">{children}</main>;
  }


  const searchButton = (
    <button
      onClick={() => { setMobileMenuOpen(false); setSearchOpen(true); }}
      className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface px-3 min-h-10 text-sm text-ink-faint hover:border-line-strong hover:text-ink-muted"
    >
      <Search className="h-4 w-4" strokeWidth={1.75} />
      <span className="flex-1 text-left">Cerca</span>
      <kbd className="hidden lg:inline rounded border border-line px-1.5 font-mono text-[11px]">Ctrl K</kbd>
    </button>
  );

  const navList = (
    <nav className="flex flex-col gap-6" aria-label="Navigazione principale">
      {NAV_GROUPS.map(group => (
        <div key={group.title}>
          <p className="px-3 mb-1.5 text-xs font-medium text-ink-faint">{group.title}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map(item => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 min-h-10 text-sm transition-colors ${
                      active
                        ? 'bg-surface text-ink font-medium shadow-sm ring-1 ring-line'
                        : 'text-ink-muted hover:bg-raised hover:text-ink'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-accent' : ''}`} strokeWidth={1.75} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div>
        <p className="px-3 mb-1.5 text-xs font-medium text-ink-faint">Portali clienti</p>
        <ul className="flex flex-col gap-0.5">
          {PORTALS.map(p => (
            <li key={p.href}>
              <Link
                href={p.href}
                className="flex items-center justify-between rounded-lg px-3 min-h-10 text-sm text-ink-muted hover:bg-raised hover:text-ink transition-colors"
              >
                {p.label}
                <ArrowUpRight className="h-3.5 w-3.5 text-ink-faint" strokeWidth={1.75} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );

  const utilityRow = (withBell: boolean) => (
    <div className="flex items-center gap-1.5">
      {withBell && <NotificationManager align="left" />}
      <button
        onClick={togglePrivacy}
        aria-pressed={privacyMode}
        title={privacyMode ? 'Mostra margini e costi' : 'Modalità cliente: nasconde margini e costi'}
        className={`grid h-9 w-9 place-items-center rounded-full border transition-colors ${
          privacyMode
            ? 'bg-warn-soft border-warn-line text-warn-ink'
            : 'bg-surface border-line text-ink-muted hover:text-ink hover:border-line-strong'
        }`}
      >
        {privacyMode ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
        <span className="sr-only">Modalità cliente</span>
      </button>
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
        className="grid h-9 w-9 place-items-center rounded-full border bg-surface border-line text-ink-muted hover:text-ink hover:border-line-strong transition-colors"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" strokeWidth={1.75} /> : <Moon className="h-4 w-4" strokeWidth={1.75} />}
        <span className="sr-only">Cambia tema</span>
      </button>
    </div>
  );

  const userCard = (
    <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-raised text-xs font-semibold text-ink uppercase">
        {currentUser?.displayName?.slice(0, 2) || 'OP'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{currentUser?.displayName || 'Operatore'}</span>
        <span className="block truncate text-xs text-ink-faint">
          {currentUser ? `${currentUser.role === 'admin' ? 'Amministratore' : 'Operatore'} · @${currentUser.username}` : 'Caricamento'}
        </span>
      </span>
      <button
        onClick={handleLogout}
        title="Esci"
        className="grid h-9 w-9 place-items-center rounded-lg text-ink-faint hover:bg-danger-soft hover:text-danger-ink transition-colors"
      >
        <LogOut className="h-4 w-4" strokeWidth={1.75} />
        <span className="sr-only">Esci</span>
      </button>
    </div>
  );

  return (
    <div className="flex min-h-[100dvh] w-full">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-line bg-canvas sticky top-0 h-[100dvh] print:hidden">
        <div className="px-5 h-16 flex items-center border-b border-line">
          <Brand />
        </div>
        <div className="px-3 pt-4">{searchButton}</div>
        <div className="flex-1 overflow-y-auto px-3 py-5">{navList}</div>
        <div className="border-t border-line px-3 py-3 space-y-2">
          <div className="px-2">{utilityRow(isDesktop)}</div>
          {userCard}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superiore mobile */}
        <header className="lg:hidden sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-line bg-canvas px-4 print:hidden">
          <Brand />
          <div className="flex items-center gap-1.5">
            <button onClick={() => setSearchOpen(true)} aria-label="Cerca" className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-surface text-ink">
              <Search className="h-5 w-5" strokeWidth={1.75} />
            </button>
            {!isDesktop && <NotificationManager align="right" />}
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Apri menu"
              className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-surface text-ink"
            >
              <Menu className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col min-h-0">{children}</main>
      </div>

      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Drawer mobile */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-scrim" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-80 max-w-[86vw] flex-col bg-canvas border-r border-line shadow-lg animate-slide-in">
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <Brand />
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Chiudi menu"
                className="grid h-10 w-10 place-items-center rounded-lg text-ink-muted hover:bg-raised"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-5">{navList}</div>
            <div className="border-t border-line px-3 py-3 space-y-2 pb-safe">
              <div className="px-2">{utilityRow(false)}</div>
              {userCard}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
