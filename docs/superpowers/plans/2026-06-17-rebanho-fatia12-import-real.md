# Fatia 12 — Importar o rebanho real do Ideagri Implementation Plan

> **For agentic workers:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development. Passos usam checkbox.

**Goal:** Substituir o seed de demonstração (8 vacas) pelo **rebanho real** do Ideagri, importando `server/prisma/rebanho_real.json` (já produzido e commitado pelo controller: 824 animais, 103 em lactação, 1.621 controles).

**Architecture:** Importador Prisma (`server/prisma/import-rebanho.ts`) que consome o JSON commitado e popula `Animal` + `ResumoAnimal` + `Lactacao` (aberta) + `ControleLeiteiro` + `Grupo`/`Raca`. Espelha o pipeline do financeiro (`import.ts`). **Não toca** em `Produto`/`MovimentoEstoque`/`Lancamento`/`Dieta`.

**Tech Stack:** Prisma 6 + tsx (ESM `.js` nos imports relativos). Sem mudança de schema.

## Global Constraints
- Server ESM. Decimal/Date via Prisma. PT-BR. Idempotente (rodar 2× → mesmo estado).
- **Não deletar** `Grupo` (referenciado por `MovimentoEstoque.grupoId`); fazer **upsert por nome**. **Não tocar** em `Produto`/`MovimentoEstoque`/`Lancamento`/`Dieta`.
- O JSON `server/prisma/rebanho_real.json` é a fonte (não gerar dados sintéticos).

## Forma do JSON (contrato)
```json
{ "geradoEm":"2026-06-17",
  "animais":[ { "numero":"1002","nome":"CATARINA","sexo":"F","categoria":"VACA",
    "dataNascimento":"2019-06-01","dataEntrada":"2022-10-01","brincoEletronico":null,"sisbov":null,
    "numPartosEntrada":0,"status":"ATIVO","dataBaixa":null,"setor":null,"raca":"Girolando","grupo":"Alta Produção",
    "resumo":{ "statusReprodutivo":"VAZIA","del":44,"ordemLactacao":4,"producaoMediaDia":32.7,"producao305":6477,
      "ccs":null,"ultimoDgData":null,"ultimoDgResultado":null,"iepProjetado":null,"diasGestacao":null,
      "previsaoSecagem":null,"lactacaoAberta":{"dtInicio":"2026-05-04"} } } ],
  "controles":[ { "numero":"1002","data":"2024-01-01","peso1":null,"peso2":null,"peso3":null,"pesoTotal":24.5 } ] }
```
`categoria` ∈ BEZERRA/NOVILHA/VACA/BEZERRO/TOURO. `del`/`producaoMediaDia` só preenchidos para vacas em lactação. `lactacaoAberta` presente sse em lactação.

## Padrões a espelhar
- `server/prisma/import.ts` (importador financeiro: load JSON → Prisma). `server/prisma/seed-rebanho.ts` (upsert por nome, ordem de deleção).
- Schema: `Animal` (cascade em ControleLeiteiro/EventoReprodutivo/EventoSanitario/Lactacao/ResumoAnimal), `Raca`/`Grupo` (`nome @unique`), `ResumoAnimal`, `Lactacao`.

---

### Task 1: Importador `import-rebanho.ts`

**Files:** Create `server/prisma/import-rebanho.ts`; Modify `server/package.json` (script `import:rebanho`).

- [ ] **Step 1:** `import-rebanho.ts`:
  - `const dados = JSON.parse(readFileSync(new URL("./rebanho_real.json", import.meta.url), "utf-8"))`.
  - **Limpa o rebanho** (cascatas cuidam dos filhos do Animal): `await prisma.producaoLote.deleteMany({})`; `await prisma.animal.deleteMany({})` (cascade → controleLeiteiro/eventos/lactacao/resumo). **Não** deletar grupo/produto/movimentoEstoque/lancamento.
  - **Raça/Grupos:** colete os nomes distintos de `raca` e `grupo` do JSON; `for (nome) prisma.raca.upsert({where:{nome},create:{nome},update:{}})` e idem `grupo`. Monte mapas `nome→id`.
  - **Animais:** para cada `a` do JSON, `prisma.animal.create({ data: { numero, nome, sexo, categoria, racaId, grupoId, dataNascimento: a.dataNascimento?new Date(a.dataNascimento):null, dataEntrada: new Date(a.dataEntrada ?? a.dataNascimento ?? dados.geradoEm), brincoEletronico, sisbov, numPartosEntrada, status, dataBaixa } })`. Guarde `numero→animalId`.
    - Em seguida `prisma.resumoAnimal.create({ data: { animalId, statusReprodutivo, del, ordemLactacao, producaoMediaDia, producao305, ccs, ccsTendencia: null, producaoTendencia: null, ultimoDgData, ultimoDgResultado, iepProjetado, diasGestacao, previsaoSecagem } })` (datas → `new Date(...)` quando não-nulas).
    - Se `a.resumo.lactacaoAberta`: `prisma.lactacao.create({ data: { animalId, numero: a.resumo.ordemLactacao ?? 1, dtInicio: new Date(...), dtFim: null } })`.
  - **Controles:** agrupe por `numero`; para cada controle com `numero` mapeado, `prisma.controleLeiteiro.create({ data: { animalId, data: new Date(c.data), peso1, peso2, peso3, pesoTotal, origem: "ideagri" } })`. Use `createMany` em lotes (ex.: 500) para performance.
  - Logue ao final: `console.log("Import rebanho real: X animais, Y em lactação, Z controles")`.
  - **Performance:** envolva inserts em `prisma.$transaction` por blocos ou use `createMany` onde possível (resumo/lactacao precisam do animalId → criar animais primeiro com `createMany`, depois buscar ids por numero, depois resumos/controles em `createMany`). Escolha a abordagem que rode em <~30s para 824 animais + 1621 controles.
- [ ] **Step 2: package.json** — script `"import:rebanho": "tsx --env-file=.env prisma/import-rebanho.ts"`.
- [ ] **Step 3: Rodar** — `pnpm --filter rionovo-server run import:rebanho` (no worktree: garanta `.env` via cópia de `/home/toledo/fazendinha/server/.env`; `prisma generate` se preciso). Esperado: log com 824 animais / 103 em lactação / 1621 controles, sem erro.
- [ ] **Step 4: Verificação (script de contagem)** — via `prisma` ou `psql`: `animal.count()` = 824; `resumoAnimal.count({where:{del:{not:null}}})` ≈ 103; `controleLeiteiro.count()` = 1621; um animal real (ex.: numero "1002" CATARINA) tem `producaoMediaDia` ~32.7. **Idempotência:** rodar o import 2× e conferir que as contagens ficam iguais (não dobram).
- [ ] **Step 5: Build/test** — `pnpm --filter rionovo-server build` limpo; `pnpm --filter rionovo-server test` verde (nada de teste novo necessário — importador é dado; mas garanta que não quebrou nada).
- [ ] **Step 6: Commit** — `feat(rebanho): importador do rebanho real do Ideagri (824 animais, 1621 controles)`.

### Task 2: Wiring do seed + smoke da API

**Files:** Modify `server/prisma/seed-rebanho.ts` (ou doc), `server/package.json` se necessário.

- [ ] **Step 1:** Garantir uma ordem coerente: o `seed:rebanho` (demo) cria produtos/dietas/grupos/estoque; o `import:rebanho` **substitui os animais** preservando o resto. Documentar no topo do `import-rebanho.ts` a ordem recomendada (`seed:rebanho` → `import:rebanho`). Se o `seed-rebanho.ts` recriar animais demo, tudo bem (o import os substitui); **não** precisa removê-los do seed.
- [ ] **Step 2: Smoke da API** — subir o server (porta livre, após o import) e conferir: `GET /api/rebanho/animais` retorna centenas de animais reais; `GET /api/rebanho/producao` (modo ORDENHA) mostra um ranking real (vacas reais, ~27 L/d); `GET /api/rebanho/dashboard` reflete rebanho ativo ~824 / em lactação ~103. Documentar a saída. Matar o server.
- [ ] **Step 3: Commit** — `feat(rebanho): seed real do rebanho (ordem seed→import) + smoke`.

---

## Verificação final (controller, navegador)
- Aba **Animal**: rebanho real (centenas de animais, nomes reais tipo CATARINA/BANNY) com produção/DEL reais.
- Aba **Produção**: ranking real (vacas reais, ~27 L/d), produção total ~2.827 L/dia, ~103 em lactação.
- **Dashboard**: rebanho ativo ~824, em lactação ~103.
- (Destrava a Fatia 13: custo/litro real.)

## Self-review
- Cobertura: importador (T1) + wiring/smoke (T2). Sem mudança de schema; cascatas cuidam da limpeza; grupos preservados por nome. ✓
- Sem placeholders de lógica; o JSON é o contrato. Idempotência explícita.

## Decisões deferidas
- Timeline de eventos por animal (só resumo agregado) · genealogia mãe/pai · refino do statusReprodutivo/IEP · **Fatia 13: custo/litro real**.
