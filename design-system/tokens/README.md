# Design Tokens — Preventivi 3D

I token fondamentali risiedono nel layer CSS nativo in `src/app/globals.css`:

## Colori Fondamentali
- Background: OLED Black `#020617` / `#030712`
- Foreground: White `#f8fafc`
- Accenti:
  - Emerald (Produzione / Azioni riuscite): `#10b981`
  - Cyan (Tracciamento / Info tecniche): `#06b6d4`
  - Amber (In attesa / Avvisi): `#f59e0b`

## Curve di Transizione Fisica (Spring Physics)
- `--ease-spring`: `cubic-bezier(0.32, 0.72, 0, 1)`
- `--ease-out-quad`: `cubic-bezier(0.25, 1, 0.5, 1)`

## Raggi Concentrici (Concentric Radii)
- Guscio esterno: `rounded-[2rem]` (o `1.75rem`)
- Nucleo interno: `rounded-[calc(2rem-0.375rem)]`
