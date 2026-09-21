import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google';
import './globals.css';
import ClientShell from '@/components/ClientShell';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Preventivi di Stampa 3D | Lab Manager',
  description: 'Piattaforma per maker e laboratori di stampa 3D FDM/SLA: calcolo preventivi, viewer STL WebGL, gestione clienti con portale ordini e magazzino con tara',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className={`${jakarta.variable} ${geistMono.variable}`}>
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-emerald-500/30 min-h-[100dvh] flex flex-col font-sans relative">
        <div className="ambient-mesh" aria-hidden="true" />
        <ClientShell>
          {children}
        </ClientShell>
      </body>
    </html>
  );
}