# Standard Dati & Persistenza — Preventivi 3D

Regole e schemi per la gestione e persistenza dei dati.

## 1. Storage Locale & Privacy Dati
- **Regola**: Tutti i dati operativi (`quotes.json`, `inventory.json`, `maintenance.json`, `users.json`) e i file caricati risiedono esclusivamente nella directory `data/` del filesystem locale.
- **Motivazione**: La cartella `data/` è blindata in `.gitignore` e `.dockerignore`. Nessun dato cliente o inventario reale deve mai finire su repository remoti come GitHub.

## 2. Integrità delle Scritture Concorrenti
- **Regola**: Le scritture su file JSON devono avvenire in modo atomico o sincrono (`fs.writeFileSync` o write-and-rename) verificando l'esistenza della directory padre.
- **Motivazione**: Previene la corruzione dei file JSON in caso di interruzione imprevista del processo Node.

## 3. Schema Dati Preventivi (Quotes)
Ogni preventivo salvato include:
- `id`: identificativo univoco (UUID o slug alfanumerico)
- `name`: nome del lavoro/pezzo
- `clientName` & `clientContact`: anagrafica destinatario
- `pricingType`: 'amico' | 'collega' | 'commerciale' | 'richiesta_cliente'
- `material`: tipologia filamento (es. PLA, PETG, TPU, ASA, CF)
- `spoolId`: bobina associata dell'inventario
- `weight` & `purgeWeight`: grammi netti e scarto AMS
- `hours` & `mins`: durata estrusione
- `totalCalculated`: totale prezzo calcolato
- `status`: 'richiesta' | 'in_attesa' | 'in_stampa' | 'pronto' | 'saldato'
