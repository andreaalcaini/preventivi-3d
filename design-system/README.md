# Design System — Preventivi 3D

Standard visivo e componenti del design system di fascia alta (*Awwwards / Linear / Apple-tier*).

## Struttura
- **tokens/**: Definizioni cromatiche, tipografiche, curve fisiche di transizione e raggi di curvatura.
- **components/**: Contratti dei componenti (ClientShell, MakerWorldModelViewer, StlViewer, QrLabelModal).
- **patterns/**: Pattern di interazione (Doppelrand, Button-in-Button, Floating Island Nav).

## Principi Guida
1. **Profondità Aptica**: Niente card piatte o ombre scure aggressive. Usare il doppio bordo concentrico (`.bezel-shell` + `.bezel-core`).
2. **Button-in-Button**: I pulsanti di azione primari racchiudono l'icona in una capsula circolare autonoma con traslazione fisica all'hover.
3. **Tipografia Distintiva**: Plus Jakarta Sans per titoli e testo; Geist Mono per codici e quote numeriche.
4. **Contrasto WCAG AA**: Testo e pulsanti leggibili con contrasto minimo di 4.5:1.
