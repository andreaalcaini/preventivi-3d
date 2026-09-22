'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Calculator, FolderKanban, Users, Box, 
  Eye, EyeOff, Shield, LogOut, BarChart3, Wrench, HardDrive,
  ExternalLink, Sparkles
} from 'lucide-react';
import { NotificationManager } from '@/components/NotificationManager';

function subscribeToStorage(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getPrivacySnapshot(): string {
  return localStorage.getItem('printquote_privacy') || 'false';
}

function getPrivacyServerSnapshot(): string {
  return 'false';
}

interface CurrentUser {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'operatore';
}

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const rawPrivacy = useSyncExternalStore(
    subscribeToStorage,
    getPrivacySnapshot,
    getPrivacyServerSnapshot
  );
  const privacyMode = rawPrivacy === 'true';

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('privacy-active', privacyMode);
    }
  }, [privacyMode]);

  const togglePrivacy = () => {
    const next = !privacyMode;
    localStorage.setItem('printquote_privacy', String(next));
    window.dispatchEvent(new Event('storage'));
  };

  const isPublicPage = pathname === '/login' || pathname.startsWith('/ordine') || pathname.startsWith('/richiedi-preventivo');

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isPublicPage) {
      fetch('/api/auth/me')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.user) {
            setCurrentUser(data.user);
          }
        })
        .catch(() => {});
    }
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

  const navLinks = [
    { href: '/', label: 'Calcolatore', icon: Calculator },
    { href: '/preventivi', label: 'Preventivi', icon: FolderKanban },
    { href: '/clienti', label: 'Clienti', icon: Users },
    { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
    { href: '/magazzino', label: 'Magazzino', icon: Box },
    { href: '/manutenzione', label: 'Manutenzione', icon: Wrench },
    { href: '/backup', label: 'Backup', icon: HardDrive },
    { href: '/utenti', label: 'Utenti', icon: Shield },
  ];

  return (
    <div className="flex flex-col min-h-[100dvh] relative z-10">
      {/* Floating Island Navigation per l'area laboratorio */}
      {!isPublicPage && (
        <header className="sticky top-2 sm:top-3 z-40 w-full px-2 sm:px-6 pointer-events-none print:hidden">
          <div className="max-w-7xl mx-auto pointer-events-auto bg-slate-950/80 backdrop-blur-2xl border border-white/10 ring-1 ring-white/5 rounded-2xl sm:rounded-full px-3 sm:px-5 h-14 flex items-center justify-between shadow-2xl shadow-black/80 transition-all">
            
            {/* Brand Logo con Doppelrand micro-shell */}
            <Link 
              href="/" 
              className="flex items-center gap-2.5 hover:opacity-90 transition-opacity flex-shrink-0 group"
            >
              <div className="p-1.5 rounded-xl bg-white/[0.04] border border-white/10 ring-1 ring-white/5 group-hover:border-emerald-500/40 transition-colors shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                  <Calculator className="w-3.5 h-3.5" strokeWidth={2} />
                </div>
              </div>
              <div>
                <span className="font-bold text-white text-xs sm:text-sm tracking-tight block leading-none">
                  Preventivi 3D
                </span>
                <span className="text-[9px] text-slate-400 font-mono tracking-[0.2em] uppercase">
                  Lab Manager
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links (schermi larghi >= xl) */}
            <nav className="hidden xl:flex items-center gap-1">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link 
                    key={item.href}
                    href={item.href} 
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isActive 
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]' 
                        : 'text-slate-300 hover:bg-white/[0.06] hover:text-white border border-transparent'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Medium screens (lg: 1024px - 1279px): Icone compatte a pillola */}
            <nav className="hidden lg:flex xl:hidden items-center gap-1">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link 
                    key={item.href}
                    href={item.href} 
                    title={item.label}
                    className={`p-2 rounded-full text-xs transition-all ${
                      isActive 
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]' 
                        : 'text-slate-300 hover:bg-white/[0.06] hover:text-white border border-transparent'
                    }`}
                  >
                    <Icon className="w-4 h-4" strokeWidth={1.75} />
                  </Link>
                );
              })}
            </nav>

            {/* Azioni Rapide a Destra */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              
              {/* Notifiche Push PWA & Popup In-App */}
              <NotificationManager />

              {/* Privacy Mode Toggle Button */}
              <button
                onClick={togglePrivacy}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium transition-all border active:scale-[0.98] ${
                  privacyMode 
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]' 
                    : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
                }`}
                title={privacyMode ? "Disattiva Privacy Mode" : "Attiva Privacy Mode (nasconde margini per mostrare lo schermo)"}
              >
                {privacyMode ? <EyeOff className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.75} /> : <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />}
                <span className="hidden md:inline">{privacyMode ? 'Cliente' : 'Privacy'}</span>
              </button>

              {/* Desktop User / Logout Pill */}
              <button
                onClick={handleLogout}
                className="hidden lg:flex items-center gap-1.5 pl-2 pr-3 py-1 rounded-full text-xs font-medium text-slate-300 hover:text-red-400 bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-red-500/30 transition-all active:scale-[0.98]"
                title={`Disconnetti (${currentUser?.username || 'Logout'})`}
              >
                <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                  {currentUser?.displayName?.slice(0, 1) || 'U'}
                </div>
                <span className="max-w-[75px] truncate">{currentUser?.displayName || 'Esci'}</span>
                <LogOut className="w-3 h-3 text-slate-400 ml-0.5" strokeWidth={1.75} />
              </button>

              {/* Hamburger Button con Morphing */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Menu di navigazione"
                className="lg:hidden p-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors focus:outline-none"
              >
                <div className="w-5 h-4 relative flex flex-col justify-between items-center">
                  <span className={`w-5 h-0.5 bg-current rounded-full transition-all duration-300 ${mobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
                  <span className={`w-5 h-0.5 bg-current rounded-full transition-opacity duration-200 ${mobileMenuOpen ? 'opacity-0' : 'opacity-100'}`} />
                  <span className={`w-5 h-0.5 bg-current rounded-full transition-all duration-300 ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
                </div>
              </button>

            </div>

          </div>
        </header>
      )}

      {/* Mobile Drawer (Side sheet ad isola di vetro) */}
      {mobileMenuOpen && !isPublicPage && (
        <div className="fixed inset-0 z-50 lg:hidden flex justify-end">
          
          {/* Backdrop con Blur profondo */}
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-80 max-w-[85vw] bg-slate-950/95 border-l border-white/10 h-full flex flex-col justify-between p-6 z-10 animate-slide-in shadow-2xl backdrop-blur-2xl">
            
            <div className="space-y-6 overflow-y-auto pr-1">
              
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                    <Calculator className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <div>
                    <span className="font-bold text-white text-sm block">Preventivi 3D</span>
                    <span className="text-[10px] text-slate-400 font-mono tracking-wider">PANNELLO LAB</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Chiudi menu"
                >
                  <div className="w-5 h-5 relative flex items-center justify-center">
                    <span className="w-4 h-0.5 bg-current rotate-45 absolute" />
                    <span className="w-4 h-0.5 bg-current -rotate-45 absolute" />
                  </div>
                </button>
              </div>

              {/* Voci di Menu */}
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-500 px-3 tracking-[0.2em] block mb-2 font-bold">
                  Gestione Laboratorio
                </span>
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                        isActive 
                          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]' 
                          : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} strokeWidth={1.75} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Portali Esterni */}
              <div className="pt-4 border-t border-white/10 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-500 px-3 tracking-[0.2em] block mb-2 font-bold">
                  Portali Pubblici
                </span>
                <Link
                  href="/richiedi-preventivo"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-3.5 py-2 rounded-xl text-xs text-slate-300 hover:bg-white/[0.05] hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.75} />
                    Richiedi Preventivo
                  </span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </Link>

                <Link
                  href="/ordine"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-3.5 py-2 rounded-xl text-xs text-slate-300 hover:bg-white/[0.05] hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <Box className="w-3.5 h-3.5 text-cyan-400" strokeWidth={1.75} />
                    Traccia un Ordine
                  </span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </Link>
              </div>

            </div>

            {/* Drawer Footer */}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <button
                onClick={togglePrivacy}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                  privacyMode 
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]' 
                    : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  {privacyMode ? <EyeOff className="w-4 h-4 text-amber-400" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
                  <span>Modalità Privacy</span>
                </span>
                <span className="text-[10px] uppercase font-mono tracking-wider font-bold">
                  {privacyMode ? 'ATTIVA' : 'DISATTIVA'}
                </span>
              </button>

              <div className="p-3 bg-white/[0.03] rounded-xl border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-bold text-white text-xs uppercase flex-shrink-0">
                    {currentUser?.displayName?.slice(0, 2) || 'OP'}
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-white text-xs block truncate">
                      {currentUser?.displayName || 'Operatore'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block">
                      @{currentUser?.username || 'operatore'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors"
                  title="Disconnetti"
                >
                  <LogOut className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Main Content */}
      <main className={`flex-1 flex flex-col min-h-0 ${isPublicPage ? '' : 'pt-2'}`}>
        {children}
      </main>
    </div>
  );
}
