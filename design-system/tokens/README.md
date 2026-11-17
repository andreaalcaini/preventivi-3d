# Design Tokens

Definiti come variabili CSS in `src/app/globals.css` ed esposti a Tailwind con `@theme inline`.

| Token | Chiaro | Scuro | Uso |
|---|---|---|---|
| canvas | #f1f0ed | #121211 | Sfondo pagina |
| surface | #ffffff | #1a1a19 | Card, campi |
| sunken | #f7f6f4 | #151514 | Aree incassate, intestazioni tabella |
| raised / muted | #ecebe7 / #e2e0db | #242422 / #2e2e2b | Hover, chip, tracce |
| line / line-strong | #e0ddd7 / #c9c5bd | #2b2b29 / #3c3b38 | Bordi |
| ink / ink-muted / ink-faint | #161615 / #4f4b46 / #6b665f | #eeedea / #b3b0aa / #9a968f | Testo |
| accent | #1d6a50 | #5cbf98 | Azione primaria, selezione, focus |
| warn / danger / info | ambra / rosso / blu acciaio | versioni chiare | Solo stati |

Ogni tono ha le varianti `-soft` (sfondo), `-ink` (testo su sfondo soft) e `-line` (bordo). `on-accent` è il testo sopra i pieni colorati.

Il tema segue il sistema; la scelta manuale è salvata in `localStorage.p3d_theme` e applicata come `html[data-theme]` prima del primo paint.
