import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
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

const SITE_NAME = 'Preventivi 3D';
const TITLE = 'Preventivi 3D | Gestionale di stampa';
const DESCRIPTION = 'Gestionale per maker e laboratori di stampa 3D FDM/SLA: preventivi, viewer STL e 3MF, clienti con portale ordini, magazzino bobine e integrazioni API.';

/**
 * WhatsApp, Telegram e social vogliono URL assoluti per l'anteprima (og:image).
 * Si usa SITE_URL se impostato, altrimenti il dominio da cui arriva la richiesta (anche dietro il tunnel Cloudflare).
 */
async function siteUrl(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000';
  const proto = h.get('x-forwarded-proto')?.split(',')[0] || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(await siteUrl()),
    title: TITLE,
    description: DESCRIPTION,
    applicationName: SITE_NAME,
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: SITE_NAME,
    },
    icons: {
      // favicon.ico in src/app viene aggiunto automaticamente da Next.js
      icon: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }],
      apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
    },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: TITLE,
      description: DESCRIPTION,
      locale: 'it_IT',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: {
      card: 'summary_large_image',
      title: TITLE,
      description: DESCRIPTION,
      images: ['/og-image.png'],
    },
  };
}

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
