# ADR 0001: Adozione del Framework Shipyard & Oh-My-Claudecode

## Stato
Approvato (Accepted)

## Contesto
Per garantire che lo sviluppo assistito da intelligenza artificiale mantenga coerenza stilistica, disciplina architetturale e protezione assoluta dei dati personali, è necessario un framework condiviso tra sviluppatore umano e agenti AI.

## Decisione
Abbiamo adottato l'harness **Shipyard** basato sulla suite **Oh-My-Claudecode (OMC)**, istituendo i 4 pilastri:
1. **Contesto**: `CONTEXT.md` come autorità terminologica di dominio.
2. **Regole**: `AGENTS.md` (con preservazione delle regole Next.js) e `CLAUDE.md`.
3. **Strumenti**: Skill modulari in `.agents/skills/` (`minimal-code-discipline`, `verify`, `ai-slop-cleaner`, ecc.).
4. **Standard**: `docs/standards/` e `design-system/` per l'estetica Doppelrand e la qualità del codice.

## Conseguenze
- Ogni agente eredita la comprensione del dominio senza dover chiedere ripetutamente contesto.
- La qualità del codice e dell'interfaccia rispetta standard di fascia alta senza deviazioni casuali.
- Il repository rimane pulito e privo di leakage di dati personali.
