# Reprodução Bloco B — Aptidão, exame ginecológico e parto→crias — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline), tarefa a tarefa, com TDD. Passos usam checkbox (`- [ ]`).

**Goal:** Fechar as linhas *Aptidão de novilhas*, *DG/exame ginecológico* e completar *Parto* do contrato de paridade: aptidão vira fato próprio (manual + automática), o exame ginecológico ganha o dicionário oficial de resultados, e o parto passa a criar (ou vincular) o `Animal` cria com genealogia.

**Architecture:** Rota fina → service → cálculo puro `*.calc.ts` + schemas, TDD. Aptidão automática e a criação de cria no parto são funções puras; a persistência roda na transação do evento (mesmo padrão de `recomputarAnimal`).

**Tech Stack:** Hono + Zod + Prisma 6 + Vitest (server); React 18 + Vite + TS (client). Sem novas dependências.

## Global Constraints

- Comandos por workspace a partir da raiz; sem target `test` na raiz.
- Server: imports `.ts` terminam em `.js`; client sem extensão. PT-BR.
- Escopo de propriedade via `resolverEscopoLeitura/Escrita(c)`; dicionário oficial é compartilhado (`propriedadeId null`).
- `@db.Date` gravado de `new Date("YYYY-MM-DDT00:00:00Z")`; cálculo puro recebe `hoje`.
- Migration aditiva idempotente + `pnpm prisma:generate`.
- Mutação composta em transação; conflito aborta; acesso cruzado → `NAO_ENCONTRADO`.
- Commits terminam com `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- O dicionário oficial de 44 resultados vem do IDEAGRI; sem a fonte nesta máquina, importa-se via contrato intermediário `@RESULTGINE@` (fail-closed) e semeia-se um conjunto-semente versionado para operação imediata.

---

### Task 1: Schema — aptidão, dicionário ginecológico e vínculo de cria

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/prisma/migrations/20260726140000_ciclo_reprodutivo/migration.sql`

**Interfaces:**
- Produces: enum `OrigemAptidao { MANUAL AUTOMATICA }`; model `AptidaoAnimal` (animal, data, apta, motivo, origem, propriedadeId); model `ResultadoExameGinecologico` (código único IDEAGRI, nomeResumido, nomeCompleto, tipo, padrao); `EventoReprodutivo.resultadoGinecologicoId Int?` e `EventoReprodutivo.criaId Int?` (animal cria criado/vinculado no parto).

- [ ] **Step 1: Adicionar modelos ao schema** — enum + dois models + duas FKs opcionais em `EventoReprodutivo` + inverse em `Animal` (`aptidoes AptidaoAnimal[]`). `AptidaoAnimal` com `@@index([animalId])` e `@@index([propriedadeId])`; `ResultadoExameGinecologico` com `codigo Int @unique`.

- [ ] **Step 2: Migration aditiva** — `CREATE TABLE IF NOT EXISTS` para os dois models, `CREATE TYPE` guardado, `ADD COLUMN IF NOT EXISTS` para `resultadoGinecologicoId`/`criaId`, índices e FKs guardadas por `pg_constraint`.

- [ ] **Step 3:** `pnpm prisma:generate` → "Generated Prisma Client".

- [ ] **Step 4: Commit** `feat(rebanho): schema de aptidão, dicionário ginecológico e cria no parto`.

---

### Task 2: Cálculo puro da aptidão automática de novilhas (TDD)

**Files:**
- Create: `server/src/services/rebanho/aptidao.calc.ts` (+ `.test.ts`)

**Interfaces:**
- Produces: `avaliarAptidao(novilha, criterio, hoje): { apta: boolean; motivo: string }` e `listarAptas(novilhas, criterio, hoje): AptidaoResultado[]`.
  - `NovilhaAptidao = { animalId: number; numero: string; categoria: string; dataNascimento: string | null; ultimoPesoKg: number | null }`
  - `CriterioAptidao = { idadeMinMeses: number; pesoMinKg: number }` (default 13 meses / 320 kg, reusando parâmetros).

- [ ] **Step 1: Teste RED** — apta quando idade ≥ 13m E peso ≥ 320; inapta com motivo específico (idade, peso ou ambos); ignora não-novilha; sem nascimento → inapta por idade desconhecida. `listarAptas` retorna só aptas ordenadas por número.

- [ ] **Step 2: RED** `vitest run src/services/rebanho/aptidao.calc.test.ts`.

- [ ] **Step 3: GREEN** — implementar `avaliarAptidao`/`listarAptas` puros (idade em meses a partir de `dataNascimento` e `hoje`).

- [ ] **Step 4: GREEN** rodar o teste.

- [ ] **Step 5: Commit** `feat(rebanho): regra de aptidão automática de novilhas`.

---

### Task 3: Service + rota de aptidão (manual e automática)

**Files:**
- Create: `server/src/services/rebanho/aptidao.ts` (+ `.schemas.ts`, + `.test.ts` de escopo)
- Create/Modify: `server/src/routes/rebanho/aptidao.ts`; montar em `server/src/index.ts`

**Interfaces:**
- Produces: `listarAptidoes(animalId, propriedadeId)`, `registrarAptidao(animalId, input, propriedadeId)`, `sugerirAptidaoAutomatica(propriedadeId)` (lista novilhas aptas do sítio via `avaliarAptidao`), `aplicarAptidaoAutomatica(propriedadeId)` (materializa `AptidaoAnimal` origem=AUTOMATICA idempotente por animal+data).
- Rotas: `GET/POST /api/rebanho/animais/:id/aptidao`, `GET /api/rebanho/aptidao/sugestoes`, `POST /api/rebanho/aptidao/aplicar`.

- [ ] **Step 1–2: RED/GREEN** — teste de escopo (recusa animal de outro sítio → `NAO_ENCONTRADO`); teste de que `sugerirAptidaoAutomatica` só devolve novilhas aptas.

- [ ] **Step 3: Rota + mount + typecheck.**

- [ ] **Step 4: Commit** `feat(rebanho): aptidão de novilhas (lançamento manual + automático)`.

---

### Task 4: Dicionário ginecológico oficial — import + seed-semente + vínculo no evento

**Files:**
- Modify: `scripts/build-rebanho-json.mjs` (+ test) — parser `@RESULTGINE@`
- Create: `server/src/services/rebanho/exame-ginecologico.ts` (+ `.test.ts`) — seed idempotente + resolução de achado condensado → resultado oficial
- Modify: `server/src/services/rebanho/eventos.schemas.ts` — `EXAME_GINECOLOGICO` aceita `resultadoGinecologicoId?` (além do achado condensado)
- Modify: `server/src/services/rebanho/eventos.ts` — grava `resultadoGinecologicoId`

**Interfaces:**
- Produces: `parseResultadoGinecologico(linha)` → `{ codigo, nomeResumido, nomeCompleto, tipo, padrao }` (código inválido → null, main aborta). `semearResultadosGinecologicos(db, lista)` idempotente por `codigo`. `mapaAchadoParaResultado(achado)` mantém os 9 achados condensados como *view* derivada.

- [ ] **Step 1–2: RED/GREEN** parser (fixture sintético) + rejeição de código inválido.
- [ ] **Step 3–4: RED/GREEN** seed idempotente (upsert por `codigo`) + resolução achado→oficial.
- [ ] **Step 5:** `eventos.schemas`/`eventos.ts` gravam `resultadoGinecologicoId`; typecheck.
- [ ] **Step 6: Commit** `feat(rebanho): dicionário ginecológico oficial + vínculo no exame`.

> Sem a fonte, o seed-semente cobre os achados condensados existentes com códigos-semente estáveis; a reconciliação dos 44 fica para o operador no Bloco F.

---

### Task 5: Parto cria (ou vincula) o Animal cria (TDD)

**Files:**
- Create: `server/src/services/rebanho/parto-cria.calc.ts` (+ `.test.ts`)
- Modify: `server/src/services/rebanho/eventos.ts` — na transação do PARTO, criar/vincular cria
- Modify: `server/src/services/rebanho/eventos.schemas.ts` — PARTO aceita `criarCria?: boolean`, `criaNumero?`, `criaId?`

**Interfaces:**
- Produces: `planejarCrias(parto, receptoraId, doadoraId): NovaCriaPlano[]` puro.
  - Aborto/natimorto total → nenhuma cria. Vivas ≥ 1 → uma cria por viva (categoria BEZERRA/BEZERRO pelo sexo), `maeId = doadoraId ?? receptoraId` (na TE, a mãe genética é a doadora), `dataNascimento = data do parto`.
  - Se `criaId` informado, vincula em vez de criar (retorna vínculo).

- [ ] **Step 1: Teste RED** — parto normal 1 viva fêmea → 1 BEZERRA com mãe=paridora; parto de receptora com doadora → mãe=doadora; aborto → 0; natimorto → 0; gemelar 2 vivas → 2 crias.
- [ ] **Step 2: RED** rodar.
- [ ] **Step 3: GREEN** implementar `planejarCrias`.
- [ ] **Step 4:** `eventos.ts` cria as crias na transação do parto (quando `criarCria`), grava `criaId` no evento; `eventos.schemas` aceita os campos.
- [ ] **Step 5: GREEN** rodar testes de eventos + calc.
- [ ] **Step 6: Commit** `feat(rebanho): parto cria ou vincula a cria com genealogia`.

---

### Task 6: Client — aptidão e vínculo de resultado/cria

**Files:**
- Modify: `client/src/rebanho/api.ts` — fetchers de aptidão + campos novos do evento
- Modify: `client/src/rebanho/components/EventoForm.tsx` — PARTO oferece "cadastrar a cria" (número + sexo); EXAME_GINECOLOGICO permite escolher o resultado oficial
- Create: `client/src/rebanho/components/AptidaoSection.tsx` — lista/sugestão/aplicação de aptidão; montar na aba Reprodução

- [ ] **Step 1–3:** DTOs + fetchers; UI de aptidão; campos do parto/exame.
- [ ] **Step 4:** `tsc -b --noEmit` + `test` client verdes.
- [ ] **Step 5: Commit** `feat(rebanho): UI de aptidão, resultado ginecológico e cria do parto`.

---

### Task 7: Gate do Bloco B

- [ ] **Step 1:** `vitest run` dos novos testes server (aptidao.calc, aptidao escopo, exame-ginecologico, parto-cria.calc, eventos.*).
- [ ] **Step 2:** `node --test scripts/build-rebanho-json.test.mjs`.
- [ ] **Step 3:** `pnpm build`.
- [ ] **Step 4:** registrar que a reconciliação dos 44 resultados e das 248 linhas de `EXAMEANIMAL` aguarda a máquina com o `DADOS777.FDB`.

## Self-Review

- **Cobertura:** aptidão (Tasks 2/3/6), dicionário ginecológico (Task 4), parto→cria (Task 5), UI (Task 6), gate (Task 7).
- **Sem placeholders:** dependência da fonte é explícita e fail-closed; seed-semente permite operar já.
- **Tipos:** `OrigemAptidao`, `resultadoGinecologicoId`, `criaId` consistentes entre schema (Task 1), services (Tasks 3–5) e client (Task 6).
