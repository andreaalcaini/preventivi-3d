# Design System "Officina" (v2)

Rifatto seguendo le regole di [Taste Skill](https://www.tasteskill.dev/): base neutra calda, un solo accento scuro, gerarchia allineata a sinistra, niente decorazioni che sostituiscono il contenuto.

## Principi
1. **Token, non colori**: le pagine usano solo i token semantici di `src/app/globals.css` (`bg-canvas`, `bg-surface`, `text-ink-muted`, `border-line`, `bg-accent`...). Così tema chiaro e scuro funzionano senza classi `dark:`.
2. **Un accento**: verde profondo per azioni primarie, selezione e focus. `warn`, `danger` e `info` servono solo a comunicare uno stato.
3. **Una card, una coppia di pulsanti**: `.panel` (bordo 1px, raggio 12px, ombra minima), `.btn .btn-primary` / `.btn .btn-secondary` / `.btn-danger`, campi `.field` con `.label` sopra.
4. **Raggi**: card 12px (`rounded-xl`), pulsanti e campi 8px (`rounded-lg`), pillole solo per badge, avatar e pulsanti icona.
5. **Vietati**: gradienti, glassmorphism e `backdrop-blur`, glow colorati, emoji come icone, etichette maiuscole sopra ogni titolo, pulsanti annidati con freccia in un cerchio, animazioni in loop senza motivo.
6. **Tipografia**: Geist per testo e titoli (`tracking-tight` sui titoli), Geist Mono con cifre tabellari per prezzi, pesi e codici.
7. **Accessibilità**: contrasto AA su entrambi i temi, focus visibile con anello accento, target tattili di almeno 40px.

## Navigazione
Sidebar fissa su desktop (gruppi Lavoro, Laboratorio, Sistema, Portali clienti), barra superiore con drawer su mobile. In fondo alla sidebar: notifiche, modalità cliente (privacy), tema chiaro/scuro e utente.
