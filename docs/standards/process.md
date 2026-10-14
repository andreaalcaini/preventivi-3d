# Standard di Processo & Rilascio — Preventivi 3D

Protocolli operativi per lo sviluppo e l'integrazione continua.

## 1. Ciclo di Sviluppo Canonico
- **Pianificazione**: Definire chiaramente l'obiettivo, i vincoli e le ambiguità prima di toccare il codice.
- **Esecuzione Minima**: Applicare la disciplina YAGNI (`minimal-code-discipline`). Non scrivere helper speculativi o funzionalità non richieste.
- **Verifica Rigorosa**: Eseguire `npm run build` e `npm run lint` prima di considerare qualsiasi modifica conclusa.

## 2. Policy di Commit & Push
- **Regola**: MAI eseguire `git push` o `git commit` in autonomia senza l'approvazione esplicita dell'utente umano.
- **Ispezione Pre-Commit**: Verificare sempre con `git status` e `git diff` che nessun file della cartella `data/` o file contenente token/credenziali sia presente nell'area di staging.
- **Notifica Post-Push & Build GHCR**: Dopo ogni push verso `origin main`, monitorare il workflow GitHub Actions (`Build and Push to GHCR`) fino a completamento (`status: completed`, `conclusion: success`) e notificare l'utente con l'esito e il comando per scaricare l'immagine aggiornata (`docker compose pull`).

## 3. Pre-Flight Check Visivo (Anti-Slop)
- Nessun font generico (usare Plus Jakarta Sans e Geist Mono).
- Nessun trattino lungo (*em-dash* `—`).
- Rispetto del contrasto WCAG AA (4.5:1 min).
- Supporto mobile reattivo con `min-h-[100dvh]`.
