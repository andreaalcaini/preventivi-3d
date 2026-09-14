'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import './globals.css';
import { 
  Calculator, FolderKanban, Users, Box, 
  Eye, EyeOff, Shield, LogOut, BarChart3, Wrench, HardDrive,
  Menu, X, ExternalLink, Sparkles
} from 'lucide-react';

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  const togglePrivacy = () => {
    const next = !privacyMode;
    localStorage.setItem('printquote_privacy', String(next));
    window.dispatchEvent(new Event('storage'));
  };

  const isPublicPage = pathname === '/login' || pathname.startsWith('/ordine') || pathname.startsWith('/richiedi-preventivo');

  useEffect(() => {
    // Chiudi il menu mobile ad ogni cambio pagina
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
    <html lang="it" className={privacyMode ? 'privacy-active' : ''}>
      <body className="bg-slate-950 text-slate-200 antialiased selection:bg-emerald-500/30 h-screen max-h-screen overflow-hidden flex flex-col">
        
        {/* Mostra la barra venditore solo nelle sezioni del laboratorio */}
        {!isPublicPage && (
          <>
            <header className="flex-shrink-0 z-40 w-full bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 print:hidden transition-all">
              <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-2">
                
                {/* Brand Logo */}
                <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity flex-shrink-0">
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 shadow-sm shadow-emerald-950">
                    <Calculator className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-white text-sm sm:text-base tracking-tight block leading-none">
                      Preventivi di stampa 3d
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono tracking-wider">LAB MANAGER</span>
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
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          isActive 
                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-sm' 
                            : 'text-slate-300 hover:bg-slate-800/70 hover:text-white border border-transparent'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>

                {/* Medium screens (lg: 1024px - 1279px): Icone compatte */}
                <nav className="hidden lg:flex xl:hidden items-center gap-1">
                  {navLinks.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link 
                        key={item.href}
                        href={item.href} 
                        title={item.label}
                        className={`p-2 rounded-lg text-xs transition-all ${
                          isActive 
                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-sm' 
                            : 'text-slate-300 hover:bg-slate-800/70 hover:text-white border border-transparent'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </Link>
                    );
                  })}
                </nav>

                {/* Azioni Rapide a Destra */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  
                  {/* Privacy Mode Toggle Button */}
                  <button
                    onClick={togglePrivacy}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      privacyMode 
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                    title={privacyMode ? "Disattiva Privacy Mode" : "Attiva Privacy Mode (nasconde margini per mostrare lo schermo)"}
                  >
                    {privacyMode ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
                    <span className="hidden md:inline">{privacyMode ? 'Cliente' : 'Privacy'}</span>
                  </button>

                  {/* Desktop Logout Button */}
                  <button
                    onClick={handleLogout}
                    className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800/80 transition-colors border border-transparent hover:border-slate-800"
                    title={`Disconnetti (${currentUser?.username || 'Logout'})`}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="max-w-[80px] truncate">{currentUser?.displayName || 'Esci'}</span>
                  </button>

                  {/* Hamburger Toggle Button (mobile & tablet < lg) */}
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    aria-label="Menu di navigazione"
                    className="lg:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none"
                  >
                    {mobileMenuOpen ? <X className="w-5 h-5 text-emerald-400" /> : <Menu className="w-5 h-5" />}
                  </button>

                </div>

              </div>
            </header>

            {/* Mobile Drawer (Side sheet) */}
            {mobileMenuOpen && (
              <div className="fixed inset-0 z-50 lg:hidden flex">
                
                {/* Backdrop Blur */}
                <div 
                  className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
                  onClick={() => setMobileMenuOpen(false)}
                />

                {/* Drawer Content */}
                <div className="relative w-72 sm:w-80 max-w-[85vw] bg-slate-900 border-r border-slate-800 h-full flex flex-col justify-between p-5 z-10 animate-slide-in shadow-2xl">
                  
                  <div className="space-y-6 overflow-y-auto pr-1">
                    
                    {/* Drawer Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                          <Calculator className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="font-bold text-white text-sm block">PrintQuote Lab</span>
                          <span className="text-[10px] text-slate-400 font-mono">PANNELLO OPERATIVO</span>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => setMobileMenuOpen(false)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Voci di Menu */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase text-slate-500 px-3 tracking-wider block mb-2 font-bold">
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
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                              isActive 
                                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-sm' 
                                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                            }`}
                          >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>

                    {/* Portali Esterni & Clienti */}
                    <div className="pt-2 border-t border-slate-800/80 space-y-1">
                      <span className="text-[10px] font-mono uppercase text-slate-500 px-3 tracking-wider block mb-2 font-bold">
                        Portali Pubblici
                      </span>
                      <Link
                        href="/richiedi-preventivo"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800/60 hover:text-white transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          Richiedi Preventivo
                        </span>
                        <ExternalLink className="w-3 h-3 text-slate-500" />
                      </Link>

                      <Link
                        href="/ordine"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800/60 hover:text-white transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <Box className="w-3.5 h-3.5 text-cyan-400" />
                          Traccia un Ordine
                        </span>
                        <ExternalLink className="w-3 h-3 text-slate-500" />
                      </Link>
                    </div>

                  </div>

                  {/* Drawer Footer con Account & Privacy */}
                  <div className="pt-4 border-t border-slate-800 space-y-3">
                    <button
                      onClick={() => {
                        togglePrivacy();
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        privacyMode 
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' 
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {privacyMode ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4" />}
                        <span>Modalità Privacy</span>
                      </span>
                      <span className="text-[10px] uppercase font-mono tracking-wider font-bold">
                        {privacyMode ? 'ATTIVA' : 'DISATTIVA'}
                      </span>
                    </button>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-xs uppercase flex-shrink-0">
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
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded-lg transition-colors"
                        title="Disconnetti"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                </div>

              </div>
            )}
          </>
        )}

        <main className={`flex-1 overflow-hidden flex flex-col ${isPublicPage ? 'h-screen' : 'h-[calc(100vh-3.5rem)]'}`}>
          {children}
        </main>
      </body>
    </html>
  );
}