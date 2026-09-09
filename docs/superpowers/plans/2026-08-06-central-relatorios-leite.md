# Central de Relatórios Leiteiros Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar os oito relatórios leiteiros da Central como consultas operacionais filtráveis, exportáveis e conectadas às mesmas ações do módulo Rebanho.

**Architecture:** A Central ganha um workspace selecionado por `?modelo=` e um registro tipado de modelos. Consultas específicas vivem em serviços do domínio rebanho e retornam DTOs próprios; a moldura React compartilha filtros, estados, exportação e drawers sem forçar análises e documentos ao contrato tabular reprodutivo.

**Tech Stack:** React 18, TypeScript, Vite 6, Hono, Zod, Prisma 6, Vitest, Testing Library e html2pdf.js.

## Global Constraints

- Identificadores e mensagens ao usuário em PT-BR.
- Toda request frontend usa `comPropriedade()`; toda consulta backend usa `resolverEscopoLeitura(c)`.
- O motor reprodutivo existente em `/api/rebanho/relatorios` permanece retrocompatível.
- Valores `Decimal` são convertidos na borda dos DTOs.
- Não inventar responsável, quarto mamário, custo, tanque ou indicador ausente.
- `Custos do rebanho` permanece `Em preparação` e fora desta entrega.
- Um card só fica disponível quando abre, carrega, trata vazio e oferece caminho operacional.

---

### Task 1: Roteamento e registro tipado

**Files:**
- Create: `client/src/report/types.ts`
- Create: `client/src/report/catalogo.ts`
- Create: `client/src/report/RelatorioWorkspace.tsx`
- Modify: `client/src/components/Relatorios.tsx`
- Test: `client/src/components/Relatorios.test.tsx`

**Interfaces:**
- Produces: `IdRelatorioLeite`, `DefinicaoRelatorio`, `lerModeloRelatorio(search)` e `publicarModeloRelatorio(id)`.
- Consumes: `Tab`.

- [ ] **Step 1: Write failing tests**

~~~~ts
expect(lerModeloRelatorio("?modelo=qualidade-leite")).toBe("qualidade-leite");
expect(lerModeloRelatorio("?modelo=inexistente")).toBeNull();
expect(CATALOGO_RELATORIOS.find((r) => r.id === "qualidade-leite")?.disponivel).toBe(true);
expect(CATALOGO_RELATORIOS.find((r) => r.id === "custos-rebanho")?.disponivel).not.toBe(true);
~~~~

- [ ] **Step 2: Verify failure**

Run: `pnpm --filter rionovo-client exec vitest run src/components/Relatorios.test.tsx`

- [ ] **Step 3: Implement minimal registry and workspace**

~~~~ts
export type IdRelatorioLeite =
  | "ficha-animal" | "rebanho-quantitativo" | "medicamentos" | "carencias"
  | "mastite" | "lactacoes" | "qualidade-leite" | "posicao-estoque";
export type TipoApresentacaoRelatorio = "lista" | "analise" | "documento";
~~~~

Opening a dairy card publishes `?modelo=<id>`; back clears only the query and preserves `/relatorios`.

- [ ] **Step 4: Run tests and commit**

~~~~bash
pnpm --filter rionovo-client exec vitest run src/components/Relatorios.test.tsx
git add client/src/report client/src/components/Relatorios.tsx client/src/components/Relatorios.test.tsx
git commit -m "feat: criar workspace da central de relatorios"
~~~~

### Task 2: Infraestrutura compartilhada

**Files:**
- Create: `client/src/report/api.ts`
- Create: `client/src/report/export.ts`
- Test: `client/src/report/export.test.ts`
- Create: `client/src/report/components/RelatorioCabecalho.tsx`
- Create: `client/src/report/components/RelatorioEstado.tsx`
- Create: `client/src/report/components/RelatorioDrawer.tsx`

**Interfaces:**
- Produces: `reqRelatorio<T>(path, signal?)`, `TabelaExportavel`, `relatorioTabularParaCsv`, `baixarCsv` e `exportarElementoPdf`.
- Consumes: `comPropriedade()`.

- [ ] **Step 1: Write failing CSV tests**

~~~~ts
expect(relatorioTabularParaCsv({
  colunas: ["Animal", "Dose"],
  linhas: [["CACAU", "2,5 mL"]],
})).toContain("\"Animal\";\"Dose\"");
expect(relatorioTabularParaCsv({
  colunas: ["Obs."],
  linhas: [["frasco \"A\""]],
})).toContain("\"frasco \"\"A\"\"\"");
~~~~

- [ ] **Step 2: Verify failure**

Run: `pnpm --filter rionovo-client exec vitest run src/report/export.test.ts`

- [ ] **Step 3: Implement request, states, drawer and exports**

`reqRelatorio` uses `/api` and `comPropriedade(headers)`. States distinguish loading, request error, no records, unavailable metric and truncated result. PDF renders the loaded DOM without a second request.

- [ ] **Step 4: Run tests and commit**

~~~~bash
pnpm --filter rionovo-client exec vitest run src/report/export.test.ts
git add client/src/report
git commit -m "feat: adicionar infraestrutura compartilhada de relatorios"
~~~~

### Task 3: Rebanho quantitativo operacional

**Files:**
- Modify: `server/src/services/rebanho/quantitativo.ts`
- Test: `server/src/services/rebanho/quantitativo.relatorio.test.ts`
- Modify: `server/src/routes/rebanho/carteira.ts`
- Create: `client/src/report/relatorios/QuantitativoRelatorio.tsx`
- Test: `client/src/report/relatorios/QuantitativoRelatorio.test.tsx`

**Interfaces:**
- Produces: `obterQuantitativoDetalhado(propriedadeId, filtros)` returning `{ resumo, animais, truncado }`.
- Consumes: `alterarAnimaisColetivo(animalIds, patch)`.

- [ ] **Step 1: Write failing service tests**

Test inactive exclusion by default, combined group/property filters, exact animal IDs per age cell and `sem-idade` for missing birth dates.

- [ ] **Step 2: Verify failure**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/quantitativo.relatorio.test.ts`

- [ ] **Step 3: Implement service, Zod route and UI**

Add `GET /rebanho/relatorios-leite/rebanho-quantitativo`. Clicking a matrix cell opens its animals; selection supports group/sector change and full animal opening. Limit rows to 2,000 and expose `truncado`.

- [ ] **Step 4: Run tests and commit**

~~~~bash
pnpm --filter rionovo-server exec vitest run src/services/rebanho/quantitativo.relatorio.test.ts
pnpm --filter rionovo-client exec vitest run src/report/relatorios/QuantitativoRelatorio.test.tsx
git add server/src/services/rebanho/quantitativo* server/src/routes/rebanho/carteira.ts client/src/report
git commit -m "feat: disponibilizar relatorio quantitativo operacional"
~~~~

### Task 4: Histórico consolidado de lactações

**Files:**
- Create: `server/src/services/rebanho/lactacoes-relatorio.calc.ts`
- Test: `server/src/services/rebanho/lactacoes-relatorio.calc.test.ts`
- Create: `server/src/services/rebanho/lactacoes-relatorio.ts`
- Create: `server/src/routes/rebanho/relatorios-leite.ts`
- Modify: `server/src/index.ts`
- Create: `client/src/report/relatorios/LactacoesRelatorio.tsx`

**Interfaces:**
- Produces: `calcularMetricasCiclo(lactacao, controles)` and `listarLactacoesRelatorio(propriedadeId, filtros)`.
- Route: `GET /rebanho/relatorios-leite/lactacoes`.

- [ ] **Step 1: Write failing pure tests**

Cover period intersection, duration, observed peak, null persistence below three controls, persistence with post-peak controls and measured production precedence.

- [ ] **Step 2: Verify failure**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/lactacoes-relatorio.calc.test.ts`

- [ ] **Step 3: Implement calculation, service, query and UI**

Persistence is the percentage ratio of post-peak mean to peak, rounded to one decimal, only with at least three valid controls and one post-peak control. UI expands cycle controls and its drawer uses `registrarControle` and `marcarInducaoLactacao`.

- [ ] **Step 4: Run tests and commit**

~~~~bash
pnpm --filter rionovo-server exec vitest run src/services/rebanho/lactacoes-relatorio.calc.test.ts
pnpm --filter rionovo-client run test
git add server/src/services/rebanho/lactacoes-relatorio* server/src/routes/rebanho/relatorios-leite.ts server/src/index.ts client/src/report
git commit -m "feat: adicionar historico operacional de lactacoes"
~~~~

### Task 5: Ficha completa do animal

**Files:**
- Create: `client/src/report/relatorios/FichaAnimalRelatorio.tsx`
- Test: `client/src/report/relatorios/FichaAnimalRelatorio.test.tsx`
- Modify: `client/src/report/RelatorioWorkspace.tsx`
- Refactor: `client/src/rebanho/components/EventoForm.tsx` only if required to export its form body.

**Interfaces:**
- Consumes: `obterAnimal`, `montarTimeline`, `listarLactacoes`, `listarMovimentacoes`, `obterInsights`, `registrarEvento`, `registrarEventoSanidade` and `registrarControle`.

- [ ] **Step 1: Write failing document tests**

Mock all reads and assert independent identification, genealogy, reproduction, lactation, production, sanitation and timeline sections; assert no cost or margin section.

- [ ] **Step 2: Verify failure**

Run: `pnpm --filter rionovo-client exec vitest run src/report/relatorios/FichaAnimalRelatorio.test.tsx`

- [ ] **Step 3: Implement selection, isolated sections and actions**

Search uses `listarAnimais({ q })`; optional section failures render local alerts. Drawer provides reproductive event, sanitary event and milk-control actions, then refetches affected sections.

- [ ] **Step 4: Run tests and commit**

~~~~bash
pnpm --filter rionovo-client exec vitest run src/report/relatorios/FichaAnimalRelatorio.test.tsx
git add client/src/report client/src/rebanho/components/EventoForm.tsx
git commit -m "feat: criar ficha completa na central de relatorios"
~~~~

### Task 6: Qualidade individual e tanque

**Files:**
- Modify: `server/src/services/rebanho/analise-leite.ts`
- Test: `server/src/services/rebanho/analise-leite.relatorio.test.ts`
- Modify: `server/src/routes/rebanho/analise-leite.ts`
- Create: `client/src/report/relatorios/QualidadeLeiteRelatorio.tsx`

**Interfaces:**
- Produces: `obterAnaliseLeiteRelatorio(propriedadeId, filtros)` returning `{ individual, tanques }`.
- Route: `GET /rebanho/relatorios-leite/qualidade-leite`.

- [ ] **Step 1: Write failing filter tests**

Cover date, group, sector and CCS range. Tank readings stay in a separate property and never alter individual aggregation.

- [ ] **Step 2: Verify failure**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/analise-leite.relatorio.test.ts`

- [ ] **Step 3: Implement filtered service, route, analysis UI and EXAME drawer**

Return raw individual readings plus aggregates and separate tank summaries. Empty tanks remain `[]`. Saving an `EXAME` reloads the report.

- [ ] **Step 4: Run tests and commit**

~~~~bash
pnpm --filter rionovo-server exec vitest run src/services/rebanho/analise-leite.relatorio.test.ts
pnpm --filter rionovo-client run test
git add server/src/services/rebanho/analise-leite* server/src/routes/rebanho/analise-leite.ts client/src/report
git commit -m "feat: disponibilizar relatorio de qualidade do leite"
~~~~

### Task 7: Medicamentos e carências

**Files:**
- Create: `server/src/services/rebanho/relatorios-sanidade.ts`
- Test: `server/src/services/rebanho/relatorios-sanidade.test.ts`
- Modify: `server/src/routes/rebanho/relatorios-leite.ts`
- Create: `client/src/report/relatorios/MedicamentosRelatorio.tsx`
- Create: `client/src/report/relatorios/CarenciasRelatorio.tsx`

**Interfaces:**
- Produces: `listarMedicamentosAplicados` and `listarCarencias`.
- Routes: `GET /rebanho/relatorios-leite/medicamentos` and `/carencias`.

- [ ] **Step 1: Write failing service tests**

Assert property/group/date filters, absent responsible field, null cost without product reference, reliable cost with reference and quantity, and active/concluded carência derivation.

- [ ] **Step 2: Verify failure**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/relatorios-sanidade.test.ts`

- [ ] **Step 3: Implement services, routes, list UIs and application drawer**

Return `{ linhas, total, truncado, qualidadeDados }`. Both reports reuse one sanitary application drawer. Carência has no manual release mutation.

- [ ] **Step 4: Run tests and commit**

~~~~bash
pnpm --filter rionovo-server exec vitest run src/services/rebanho/relatorios-sanidade.test.ts
pnpm --filter rionovo-client run test
git add server/src/services/rebanho/relatorios-sanidade* server/src/routes/rebanho/relatorios-leite.ts client/src/report
git commit -m "feat: adicionar relatorios de medicamentos e carencias"
~~~~

### Task 8: Mastite e CMT por quarto

**Files:**
- Create: `server/src/services/rebanho/mastite-relatorio.calc.ts`
- Test: `server/src/services/rebanho/mastite-relatorio.calc.test.ts`
- Create: `server/src/services/rebanho/mastite-relatorio.ts`
- Modify: `server/src/routes/rebanho/relatorios-leite.ts`
- Create: `client/src/report/relatorios/MastiteRelatorio.tsx`

**Interfaces:**
- Produces: `agregarMastite(exames, legados)` and `obterRelatorioMastite(propriedadeId, filtros)`.
- Route: `GET /rebanho/relatorios-leite/mastite`.

- [ ] **Step 1: Write failing aggregation tests**

Cover quarter/CMT distribution, recurrence per animal+quarter, lost quarter count and legacy mastitis only in `ocorrenciasSemQuarto`.

- [ ] **Step 2: Verify failure**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/mastite-relatorio.calc.test.ts`

- [ ] **Step 3: Implement aggregation, scoped route, analysis UI and existing quarter drawer**

No legacy event is assigned to a quarter. Empty structured exams return zero aggregates and the real legacy count.

- [ ] **Step 4: Run tests and commit**

~~~~bash
pnpm --filter rionovo-server exec vitest run src/services/rebanho/mastite-relatorio.calc.test.ts
pnpm --filter rionovo-client run test
git add server/src/services/rebanho/mastite-relatorio* server/src/routes/rebanho/relatorios-leite.ts client/src/report
git commit -m "feat: criar relatorio de mastite e cmt"
~~~~

### Task 9: Posição de estoque leiteiro

**Files:**
- Create: `server/src/services/rebanho/estoque-relatorio.ts`
- Test: `server/src/services/rebanho/estoque-relatorio.test.ts`
- Modify: `server/src/routes/rebanho/relatorios-leite.ts`
- Create: `client/src/report/relatorios/EstoqueLeiteRelatorio.tsx`

**Interfaces:**
- Produces: `obterPosicaoEstoqueLeite(propriedadeId, filtros)`.
- Route: `GET /rebanho/relatorios-leite/posicao-estoque`.

- [ ] **Step 1: Write failing service tests**

Assert only `setor=LEITE`, property-scoped movements, exact balance, below-minimum filter, expiration windows and latest movement.

- [ ] **Step 2: Verify failure**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/estoque-relatorio.test.ts`

- [ ] **Step 3: Implement service, route, UI and existing stock drawers**

Return saldo, unit, value, minimum, lots, next expiry and last movement. Reuse `MovimentoForm`, `ProdutoForm` and the lot form; reload after mutation.

- [ ] **Step 4: Run tests and commit**

~~~~bash
pnpm --filter rionovo-server exec vitest run src/services/rebanho/estoque-relatorio.test.ts
pnpm --filter rionovo-client run test
git add server/src/services/rebanho/estoque-relatorio* server/src/routes/rebanho/relatorios-leite.ts client/src/report
git commit -m "feat: disponibilizar posicao de estoque leiteiro"
~~~~

### Task 10: Integração e verificação ponta a ponta

**Files:**
- Modify: `client/src/components/Relatorios.test.tsx`
- Modify: `client/src/report/RelatorioWorkspace.tsx`
- Modify: `client/src/report/catalogo.ts`

**Interfaces:**
- Consumes all report components.
- Produces eight available dairy cards while `custos-rebanho` remains unavailable.

- [ ] **Step 1: Add integration tests**

Assert each dairy card opens its URL/heading, back clears `modelo`, unknown IDs return to catalog, favorites remain, every workspace has an operational action, and costs still show `Em preparação`.

- [ ] **Step 2: Run full verification**

~~~~bash
pnpm --filter rionovo-server run test
pnpm --filter rionovo-client run test
pnpm build
~~~~

Expected: all commands exit 0.

- [ ] **Step 3: Verify in browser**

Open `/relatorios`; test all eight model URLs, populated/empty states, filter persistence, drawer save/close, return to catalog, CSV, PDF and keyboard focus restoration.

- [ ] **Step 4: Commit integration fixes**

~~~~bash
git add client/src server/src
git commit -m "test: validar central operacional de relatorios leiteiros"
~~~~
