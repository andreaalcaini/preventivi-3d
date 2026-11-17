import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import ClientShell from '@/components/ClientShell';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f1f0ed' },
    { media: '(prefers-color-scheme: dark)', color: '#121211' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Preventivi 3D | Gestionale di stampa',
  description: 'Gestionale per maker e laboratori di stampa 3D FDM/SLA: preventivi, viewer STL e 3MF, clienti con portale ordini, magazzino bobine e integrazioni API.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Preventivi 3D',
  },
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/icon-192.png',
  },
};

// Applica il tema scelto prima del primo paint, così non c'è il lampo di colore sbagliato
const themeBootstrap = `try{var t=localStorage.getItem('p3d_theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t}}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="bg-canvas text-ink antialiased min-h-[100dvh] flex flex-col font-sans">
        <ClientShell>
          {children}
        </ClientShell>
      </body>
    </html>
  );
}
