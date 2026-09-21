---
documentLanguage: it
---

# Glossario & Contesto di Dominio — Preventivi 3D

Terminologia standard e definizioni del dominio applicativo. Questo documento fa fede per la nomenclatura di codice, modelli dati, API e documentazione.

## Preventivo di Stampa (Quote)
- **Definizione**: Calcolo analitico del costo e prezzo di una commessa di produzione additiva basato su consumo materiale, tempo macchina, energia, usura, manodopera e margine.
- **Confine**: È la stima economica dell'oggetto da produrre; non include la gestione fatture fiscali formali, ma genera il foglio di lavorazione e ricevuta d'ordine.
- **Ambiguità risolta**: Il costo include la quota di purging/scarto per stampe multicolore AMS calcolata a parte rispetto al peso netto del pezzo.

## Tara Bobina (Spool Tare)
- **Definizione**: Il peso a vuoto del rocchetto in plastica/cartone su cui è avvolto il filamento.
- **Confine**: È il valore sottratto al peso lordo pesato sulla bilancia per calcolare il filamento netto rimasto.
- **Ambiguità risolta**: Ogni brand (Bambu Lab, Sunlu, Polymaker, eSun, Extrudr) ha un proprio peso tara specifico censito in `src/data/spoolTares.ts`.

## Profilo MakerWorld / 3MF
- **Definizione**: Pacchetto contenente metadati di slicing (piatti, peso, tempo di stampa stimato, filamenti utilizzati) estratto dall'URL pubblico di MakerWorld.
- **Confine**: Rappresenta le impostazioni di stampa ottimali definite dal designer per stampanti Bambu Lab.
- **Ambiguità risolta**: Se un file 3MF contiene più piatti, l'utente può scegliere quale piatto produrre o stimare.

## Modalità Privacy (Privacy Mode)
- **Definizione**: Stato dell'interfaccia che nasconde margini di profitto, costi orari del laboratorio e dettagli confidenziali quando lo schermo viene mostrato al cliente finale.
- **Confine**: Agisce solo sul livello di presentazione UI tramite classe `.privacy-active`; non altera i calcoli effettivi salvati nel backend.

## Commessa / Codice Univoco (Order ID)
- **Definizione**: Identificativo univoco (es. `ORD-1049`) fornito al cliente per tracciare lo stato della lavorazione su `/ordine`.
- **Confine**: Riferimento pubblico sicuro che permette al committente di verificare l'avanzamento (`in_attesa` → `in_stampa` → `pronto` → `saldato`) senza concedere accesso al pannello operatore.
