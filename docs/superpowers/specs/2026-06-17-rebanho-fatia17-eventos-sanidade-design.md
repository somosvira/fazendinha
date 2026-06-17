# Fatia 17 — Eventos de sanidade no cockpit (DOENCAANIMAL + APLICACAOPRODUTO → EventoSanitario) — Design

**Data:** 2026-06-17
**Status:** aprovado (usuário pediu "siga com a sanidade").
**Depende de:** Fatia 16 (pipeline `@E@`/eventos + importador); modelo `EventoSanitario` + timeline (Fatia 3).

---

## 1. Problema
A timeline do cockpit já tem reprodução (Fatia 16) + produção, mas falta o lado **sanitário**. O Ideagri tem `DOENCAANIMAL` (339 ocorrências) e `APLICACAOPRODUTO` (3.257 aplicações de produto — hormônio/vacina/antiparasitário) por animal, prontos pra completar a história.

## 2. Fontes e mapeamento (verificado)

**`DOENCAANIMAL`** (339) → `EventoSanitario` tipo **OCORRENCIA**:
- `CDANIMAL`→numero; `CDDOENCA`→`doenca` (nome via `DOENCA.NOMECOMPLETO`); `DTINICIO`→`data`; `DTFIM`→`dtFim`; `DIASTRATAMENTO`→`diasTratamento`; `OBSERVACAO`→`observacao`.

**`APLICACAOPRODUTO`** (3.257) → `EventoSanitario` tipo **APLICACAO**:
- `CDANIMAL`→numero; `CDPRODUTO`→`produto` (nome via `PRODUTO.NOME` — ex.: Lactotropin 967, Vacina Poli-Star 474, Dectomax 319); `DTAPLICACAOPRODUTO`→`data`; `DOSEAPLICADA`→`dose`; `CARENCIA`→`carencia`; `OBSERVACAO`→`observacao`.

**Escopo de animais:** TODOS da fazenda (ativos + baixados), igual aos demais imports. ~3.596 eventos sanitários.

**Diferenciar VACINA de APLICACAO:** deferido — o nome do produto já diz "Vacina X"; refino do tipo (detectar vacina pelo tipo do `PRODUTO`) fica pra depois. Todos entram como APLICACAO.

## 3. Mudanças (backend-only — o cockpit já lê `EventoSanitario`)
`timeline.ts` já faz `prisma.eventoSanitario.findMany({ where: { animalId } })` (Fatia 3). Importar os eventos acende o lado sanitário. **Sem mudança de API/UI.**

- **`scripts/rebanho-dump.sql`** — 2 blocos novos: `@D@` (DOENCAANIMAL, join DOENCA) e `@V@` (APLICACAOPRODUTO, join PRODUTO), filtrando animais da fazenda.
- **`scripts/build-rebanho-json.mjs`** — `parseDoenca`/`parseAplicacao` puros (TDD) → `eventosSanitarios[]` (cada um com `tipo`). `main()` roteia `@D@`/`@V@`.
- **JSON** — novo top-level `eventosSanitarios: [...]`.
- **`server/prisma/import-rebanho.ts`** — `createMany EventoSanitario` em lotes (cascade do `animal.deleteMany` já limpa → idempotente).

## 4. Verificação
- **JSON:** `eventosSanitarios.length` ≈ 3.596; por tipo: OCORRENCIA ~339, APLICACAO ~3.257.
- **Postgres:** `eventoSanitario.count()` ≈ 3.596; um animal real tem aplicações (ex.: Lactotropin) e/ou doenças.
- **Navegador:** cockpit mostra a timeline costurada reprodução + **sanidade** (aplicações de produto, ocorrências) + produção, ordenada por data.
- Transformador (node --test) + server build/test verdes. Idempotente.

## 5. Decisões deferidas
- **MAMITE** (24, esparso) → MASTITE: vai junto com **qualidade do leite** (`ANALISELEITE` 467: CCS/gordura/proteína) numa fatia própria (mastite + CCS são clínicos juntos).
- **VACINA** como tipo distinto (detectar pelo tipo do produto).
- `loteProduto` (via `LOTEPRODUTO`); `EXAME` (`EXAMEANIMAL`).
- **Custo de sanidade real**: `APLICACAOPRODUTO` × custo do `Produto` → custo veterinário por animal/período (liga ao custo de produção) — fatia própria, o grande próximo passo financeiro.
- Pesagens (`PESO`→GMD); composição racial; reclassificação Animal Aquisição.
