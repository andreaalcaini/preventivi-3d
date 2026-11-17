import Link from 'next/link';
import { Box } from 'lucide-react';

export const metadata = { title: 'Informativa privacy | Preventivi 3D' };

/**
 * Informativa essenziale per il portale clienti.
 * Da completare con i dati del titolare (nome o ragione sociale, indirizzo, email) prima dell'uso pubblico.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-[100dvh] w-full bg-canvas">
      <header className="w-full max-w-3xl mx-auto px-4 sm:px-8 h-16 flex items-center">
        <Link href="/login" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-canvas"><Box className="h-4 w-4" strokeWidth={1.75} /></span>
          <span className="text-sm font-semibold tracking-tight text-ink">Preventivi 3D</span>
        </Link>
      </header>
      <main className="w-full max-w-3xl mx-auto px-4 sm:px-8 pt-6 pb-16 space-y-6 text-ink-muted leading-relaxed">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Informativa sul trattamento dei dati</h1>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-ink">Chi tratta i dati</h2>
          <p>Il laboratorio che gestisce questo servizio di stampa 3D, titolare del trattamento. I recapiti del titolare sono indicati nella conferma della richiesta o possono essere chiesti con i messaggi dell&apos;ordine.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-ink">Quali dati</h2>
          <p>Nome, telefono o email, descrizione del progetto, file 3D caricati o link ai modelli, messaggi scambiati sull&apos;ordine e lo stato del lavoro.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-ink">Perché</h2>
          <p>Solo per preparare il preventivo, realizzare e consegnare il lavoro e rispondere alle tue domande. I dati non vengono venduti né usati per pubblicità.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-ink">Dove e per quanto</h2>
          <p>Su un server gestito direttamente dal laboratorio, per il tempo necessario a completare il lavoro e agli obblighi di legge. I file 3D restano disponibili nel tracking finché l&apos;ordine è conservato.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-ink">I tuoi diritti</h2>
          <p>Puoi chiedere in qualsiasi momento di vedere, correggere o cancellare i tuoi dati scrivendo al laboratorio, anche dai messaggi della pagina di tracking del tuo ordine.</p>
        </section>

        <p className="text-sm text-ink-faint">Testo base da completare con i dati del titolare del trattamento.</p>
      </main>
    </div>
  );
}
