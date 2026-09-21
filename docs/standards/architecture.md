# Standard Architetturali — Preventivi 3D

Regole verificabili e fondate sulla struttura dell'applicazione.

## 1. Confini dei Moduli & Separazione Server/Client
- **Regola**: Ogni pagina o componente interattivo che usa hook di stato (`useState`, `useEffect`, `usePathname`) deve dichiarare `'use client'` in cima al file ed essere racchiuso come Client Island.
- **Motivazione**: Preserva le prestazioni di rendering statico di Next.js 16 (Turbopack) ed evita overhead sul client.

## 2. Gestione degli Errori & Resilienza API
- **Regola**: Tutte le route API (`/api/*`) devono essere racchiuse in blocchi `try/catch` restituendo risposte JSON con `{ error: string }` e status code HTTP appropriati (400, 401, 404, 500).
- **Motivazione**: Garantisce che il client non riceva crash non gestiti e possa mostrare feedback visivo chiaro all'utente.

## 3. Direzione delle Dipendenze
- **Regola**: I componenti dell'interfaccia (`src/components/`) possono importare librerie condivise da `src/lib/` e dati statici da `src/data/`, ma non possono importare route interne da `src/app/api/`.
- **Motivazione**: Mantiene disaccoppiato il layer visivo dai contratti di routing del server.

## 4. Prestazioni 3D (Three.js & WebGL)
- **Regola**: I visualizzatori 3D (`StlViewer`, `MakerWorldModelViewer`) devono disporre correttamente di geometrie, materiali e renderer WebGL nel cleanup (`useEffect` return) per prevenire memory leak.
- **Motivazione**: I file STL/3MF possono pesare decine di megabyte; senza cleanup della memoria GPU il browser crasha dopo pochi cambi modello.
