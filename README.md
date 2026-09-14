# 🖨️ Preventivi 3D & Lab Manager

> **Piattaforma all-in-one per maker e laboratori di stampa 3D FDM/SLA.**  
> Calcolo preventivi accurati, viewer 3D STL integrato, gestione clienti con portale pubblico di tracciamento, magazzino bobine con tara automatica dei produttori, registro usura nozzle e dashboard finanziaria.

[![Docker Multi-Arch](https://img.shields.io/badge/Docker-ARM64%20%7C%20AMD64-blue?logo=docker)](https://github.com/andreaalcaini/preventivi-3d/pkgs/container/preventivi-3d)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.3%20(Turbopack)-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)

---

## 🌟 Funzionalità Principali

### 1. 🧮 Calcolatore Preventivi 3D Intelligente
- **Algoritmo Costi Completo**: calcolo istantaneo basato su peso pezzo (g), peso purge/torre di spurgo (g), costo bobina (€/kg), consumo energetico (kWh stampante + costo elettricità), tempo di stampa e tariffa oraria di ammortamento/manodopera.
- **Minuteria & BOM (Bill of Materials)**: inserimento di inserti filettati, viti, cuscinetti e magneti con scarico automatico dalle scorte del magazzino.
- **Profili di Ricarico / Margine Rapidi**: pillole di selezione immediata (*Amico*, *Collega*, *Azienda*).
- **Condivisione WhatsApp in 1-Click**: messaggio formattato pronto per l'invio al cliente con riepilogo e link di tracciamento.
- **Modalità Privacy**: nasconde con un toggle costi interni e margini quando mostri lo schermo al cliente.

### 2. 🧊 Viewer 3D WebGL Integrato (Three.js)
- Caricamento diretto di file `.stl` con rendering interattivo fluido a 60 FPS.
- Calcolo automatico di **Volume (cm³)**, **Peso stimato (g)** in base alla densità del materiale e **Dimensioni di ingombro (X, Y, Z in mm)**.
- Supporto touch nativo per rotazione e zoom a due dita senza interferire con lo scroll della pagina.

### 3. 📦 Magazzino Filamenti & Minuteria con Tara Automatica
- **Database Pesi Rocchetti Vuoti (Tara)**: archivio integrato dei pesi ufficiali dei principali produttori mondiali (**Bambu Lab, Sunlu, eSUN, Polymaker, Prusament, Creality, ELEGOO, Overture, Anycubic, Eryone, FormFutura, Geeetech, Amazon Basics**).
- **⚖️ Calcolatore Pesata alla Bilancia**: appoggia la bobina sulla bilancia, inserisci il peso lordo e il sistema sottrae automaticamente la tara del rocchetto, aggiornando la giacenza netta rimanente.
- **Modifica Completa Parametri**: modifica di marca, materiale, colore con indicatore esadecimale HEX, prezzo, peso totale, peso rimanente, tara e note.
- **Scorte Minuteria**: tracciamento giacenze e costi unitari per viti, inserti termici in ottone e magneti.

### 4. 👥 CRM Clienti & Portale Tracciamento Pubblico
- **Rubrica Clienti**: anagrafica con storico ordini, totale speso, insoluti da saldare e margine generato.
- **Portale Pubblico per il Cliente (`/ordine`)**: vista elegante e protetta senza login (solo codice univoco dell'ordine). Nessun costo interno (filamento, energia, margine) viene esposto al cliente.
- **Tracciamento Multi-Ordine (Bundle)**: possibilità di esportare e condividere un unico link con tutti gli ordini del cliente o solo i pezzi ancora da saldare (`/ordine?codes=id1,id2,...`).
- **Richiesta Preventivo Pubblica (`/richiedi-preventivo`)**: pagina aperta ai clienti per caricare file STL e richiedere quotazioni.

### 5. 🛠️ Registro Manutenzioni & Usura Componenti
- Tracciamento delle **ore di stampa accumulate sul nozzle** (ottone, acciaio temprato, carburo di tungsteno) con avvisi percentuali d'usura.
- Promemoria per **pulizia e lubrificazione barre/guide lineari** e controllo tensione cinghie assi X/Y.

### 6. 📊 Dashboard Finanziaria Grafica
- Grafici interattivi mensili e settimanali di fatturato, utile netto e ore di stampa totali.
- Ripartizione percentuale dei materiali più utilizzati (PLA, PETG, TPU, ecc.) per pianificare i riordini di bobine.
- Classifica Top Clienti con medaglie di merito 🥇🥈🥉.

### 7. 🛡️ Backup & Sicurezza 1-Click
- Esportazione istantanea di un archivio compresso `.zip` contenente tutti i database JSON (`quotes.json`, `inventory.json`, `maintenance.json`, `users.json`).
- Ripristino completo e storico dei backup scaricabili.

---

## 🚀 Avvio Rapido con Docker (Raspberry Pi & PC x64)

L'immagine ufficiale è pubblicata su **GitHub Container Registry (`ghcr.io`)** con supporto nativo multi-architettura per:
- **`linux/arm64`**: Raspberry Pi 4, Raspberry Pi 5, Orange Pi, SBC ARM, Apple Silicon.
- **`linux/amd64`**: PC Desktop, Laptop, Server Linux x86_64, VPS Intel/AMD.

### 1. Avvio con Docker Compose (Consigliato)

Crea un file `docker-compose.yml`:

```yaml
services:
  preventivi-3d:
    image: ghcr.io/andreaalcaini/preventivi-3d:latest
    container_name: preventivi-3d
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=3000
```

Avvia il container in background:
```bash
docker compose up -d
```

L'applicazione sarà accessibile all'indirizzo: `http://IP_DEL_TUO_RASPBERRY:3000` (o `http://localhost:3000`).

---

## 💻 Sviluppo Locale

### Requisiti
- **Node.js**: versione 20 o successiva
- **npm** o **pnpm**

### Installazione
```bash
# Clona il repository
git clone https://github.com/andreaalcaini/preventivi-3d.git
cd preventivi-3d

# Installa le dipendenze
npm install

# Avvia il server di sviluppo Turbopack
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000) nel browser.

### Script Disponibili
- `npm run dev`: avvia il server di sviluppo Next.js Turbopack.
- `npm run build`: crea la build di produzione standalone ottimizzata.
- `npm run start`: avvia il server di produzione standalone.
- `npx tsc --noEmit`: esegue la verifica statica dei tipi TypeScript.

---

## 📁 Struttura del Progetto

```text
preventivi-3d/
├── .github/
│   └── workflows/
│       └── deploy.yml        # CI/CD: build e push automatico multi-arch su GHCR
├── data/                     # Database persistente JSON (volume Docker)
│   ├── quotes.json           # Preventivi e ordini clienti
│   ├── inventory.json        # Magazzino bobine e minuteria hardware
│   ├── maintenance.json      # Registro ore nozzle e manutenzioni
│   └── users.json            # Utenti e autenticazione maker
├── src/
│   ├── app/
│   │   ├── api/              # API backend REST Next.js (quotes, inventory, backup...)
│   │   ├── backup/           # Pagina gestione backup & export zip
│   │   ├── clienti/          # CRM Rubrica clienti con export conti e link bundle
│   │   ├── dashboard/        # Statistiche finanziarie e grafici
│   │   ├── magazzino/        # Magazzino bobine con calcolatore pesata bilancia
│   │   ├── manutenzione/     # Registro usura nozzle e guide
│   │   ├── ordine/           # Portale pubblico cliente con codice univoco
│   │   ├── preventivi/       # Elenco preventivi con filtri e avanzamento stati
│   │   ├── richiedi-preventivo/ # Form pubblico per richieste clienti
│   │   └── page.tsx          # Calcolatore preventivo principale con Three.js
│   ├── components/
│   │   └── StlViewer.tsx     # Viewer 3D interattivo WebGL Three.js
│   └── data/
│       └── spoolTares.ts     # Database pesi tara bobine vuote dei produttori
├── docker-compose.yml        # Configurazione Docker Compose per ghcr.io
├── Dockerfile                # Dockerfile multi-stage per build standalone Next.js
└── package.json
```

---

## 📄 Licenza

Distribuito sotto licenza **MIT**. Consulta il file `LICENSE` per maggiori informazioni.
