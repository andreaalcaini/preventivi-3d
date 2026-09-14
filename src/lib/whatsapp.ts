export interface WhatsAppMessageParams {
  phone?: string;
  clientName: string;
  projectName: string;
  material?: string;
  totalCalculated?: number;
  orderCode?: string;
  status?: 'richiesta' | 'in_attesa' | 'in_stampa' | 'pronto' | 'saldato';
  origin?: string;
}

/**
 * Pulisce il numero di telefono per il formato internazionale wa.me.
 * Se è un numero italiano di 10 cifre che inizia per 3, aggiunge prefisso 39.
 */
export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  // Se è un cellulare italiano standard (es. 3401234567) senza prefisso
  if (/^3\d{8,9}$/.test(cleaned)) {
    cleaned = '39' + cleaned;
  }
  return cleaned;
}

/**
 * Genera il messaggio formattato in base allo stato della commessa.
 */
export function buildWhatsAppMessage(params: WhatsAppMessageParams): string {
  const { clientName, projectName, material, totalCalculated, orderCode, status, origin } = params;
  const nameStr = clientName && clientName.trim() !== 'Cliente Anonimo' ? ` ${clientName.trim()}` : '';
  const priceStr = totalCalculated !== undefined ? `€${totalCalculated.toFixed(2)}` : '';
  const baseUrl = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const trackingLink = orderCode ? `${baseUrl}/ordine?code=${encodeURIComponent(orderCode)}` : '';

  switch (status) {
    case 'pronto':
      return `Ciao${nameStr}! 🎉 La tua stampa 3D per "*${projectName || 'il tuo progetto'}*" è completata ed è *PRONTA PER IL RITIRO*! 📦
${priceStr ? `\n💰 *Totale dovuto:* ${priceStr}` : ''}
${trackingLink ? `🔗 *Dettagli ordine:* ${trackingLink}` : ''}

Passa pure in laboratorio quando desideri! A presto.`;

    case 'in_stampa':
      return `Ciao${nameStr}! 🖨️ Abbiamo appena avviato la stampante 3D per "*${projectName || 'il tuo progetto'}*"${material ? ` in *${material}*` : ''}!
${trackingLink ? `\n🔗 *Puoi seguire l'avanzamento qui:* ${trackingLink}` : ''}

Ti avviserò non appena il pezzo sarà pulito e pronto per la consegna.`;

    case 'saldato':
      return `Grazie mille${nameStr} per aver scelto il nostro laboratorio di stampa 3D per "*${projectName || 'il tuo progetto'}*"! 🙏

Se ti serve qualsiasi altra ristampa, modifica CAD o nuovo progetto, siamo sempre a disposizione. Buona giornata!`;

    case 'in_attesa':
    case 'richiesta':
    default:
      return `Ciao${nameStr}! 👋 Ecco il preventivo per la realizzazione 3D di "*${projectName || 'il tuo progetto'}*":
${material ? `\n- *Materiale:* ${material}` : ''}
${priceStr ? `- *Totale preventivato:* ${priceStr}` : ''}
${trackingLink ? `\n🔗 *Scheda completa & anteprima 3D:* ${trackingLink}` : ''}

Fammi sapere se posso procedere con la messa in macchina!`;
  }
}

/**
 * Restituisce il link wa.me pronto da aprire
 */
export function getWhatsAppUrl(params: WhatsAppMessageParams): string {
  const text = encodeURIComponent(buildWhatsAppMessage(params));
  const phone = params.phone ? formatPhoneNumber(params.phone) : '';
  if (phone) {
    return `https://wa.me/${phone}?text=${text}`;
  }
  return `https://wa.me/?text=${text}`;
}
