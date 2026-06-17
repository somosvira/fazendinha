# Fatia 19 — Qualidade do leite + mastite no cockpit — Design + Plano

**Data:** 2026-06-17 · **Status:** aprovado ("pode seguir com tudo"). **Depende de:** Fatia 17 (pipeline de eventos sanitários).

## Objetivo
Completar a timeline sanitária com **qualidade do leite** (`ANALISELEITE` 467) e **mastite** (`MAMITE` 24) → `EventoSanitario` (campos já existem; sem mudança de schema; backend-only — o cockpit já lê).

## Mapeamento (verificado)
- **`ANALISELEITE`** → `EventoSanitario` **EXAME**: `CDANIMAL`→numero; `DTANALISELEITE`→data; `CCS`→ccs (Int); `GORDURA`→gordura (Decimal); `PROTEINA`→proteina (Decimal); `OBSERVACAO`→observacao.
- **`MAMITE`** → `EventoSanitario` **MASTITE**: `CDANIMAL`→numero; `DATA`→data; quartos `AD`/`AE`/`PD`/`PE` (não-vazios) → `quarto` (ex.: "AD, PE"); `CDMICROORGANISMO1`→`resultadoCultivo` (nome via `MICROORGANISMO.NOME`); `OBSERVACAO`→observacao.
- Todos os animais da fazenda. ~491 eventos.

## Mudanças (pipeline, igual Fatia 16/17)
- `rebanho-dump.sql`: blocos `@Q@` (ANALISELEITE) e `@M@` (MAMITE).
- `build-rebanho-json.mjs`: `parseAnalise`/`parseMamite` puros (TDD) → empurram em `eventosSanitarios[]` (mesmo array da Fatia 17, com `tipo`).
- `import-rebanho.ts`: o `sanitarioRows` (já existe) ganha os campos `ccs/gordura/proteina/quarto/resultadoCultivo` (mapear quando presentes). Sem novo createMany — reusa o de EventoSanitario.

## Verificação
- JSON: `eventosSanitarios` cresce ~491 (EXAME ~467, MASTITE ~24).
- Postgres: `EventoSanitario` por tipo inclui EXAME/MASTITE; um animal com análise tem ccs/gordura.
- Navegador: cockpit mostra Exame (CCS/gordura/proteína) e Mastite na timeline.
- Transformador (node --test) + server build/test verdes; idempotente.

## Deferido
- Tendência de CCS (gráfico); LACTOSE/UREIA/CONTBACTERIA (não no modelo); severidade da mastite; pesagens (Fatia 20); custo por produto (Fatia 21).
