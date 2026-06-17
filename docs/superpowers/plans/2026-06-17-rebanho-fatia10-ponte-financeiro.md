# Fatia 10 — Ponte: compra → lançamento financeiro Implementation Plan

> **For agentic workers:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development. Passos usam checkbox.

**Goal:** Uma ENTRADA (compra de insumo) no Estoque gera um `Lancamento` financeiro real, que entra no fluxo de caixa do dashboard financeiro.

**Architecture:** Padrão do repo: Hono router→service + Prisma (`db push`) + Zod; client fetchers/hooks + drawer. A decisão de gerar/qual lançamento é uma **função pura** (`resolverLancamentoDaEntrada`) testada (TDD). Depende das Fatias 8/9.

**Tech Stack:** Hono, Prisma 6, Zod, `@hono/zod-validator`, React 18 + Vite + TS, Vitest.

## Global Constraints
- ESM: server `.js`; client sem extensão. Enums Prisma multi-linha. Decimal→`Number()`. PT-BR. CSS `var(--...)`. `db push`.
- A ENTRADA **nunca é bloqueada** pela ponte: sem categoria/centro de custo, ou mês fechado → cria só o movimento (`lancamentoCriado:false` + motivo).
- `Lancamento` gerado: `natureza=DEBITO`, `situacao=LIQUIDADO`, `dataCompetencia=dataVencimento=dataLiquidacao=data`.
- Respeitar `FechamentoMensal` (hoje 0 linhas → no-op, mas implementar correto).

## Padrões a espelhar
- `server/src/services/rebanho/estoque.ts` (`registrarMovimento`/`excluirMovimento` — vamos estender) + `estoque.calc.ts`/`.test.ts` (motor puro).
- `server/src/services/rebanho/cadastros.ts` (CRUD/DTO/Zod de Produto — estender com categoria/centroCusto) + `routes/rebanho/cadastros.ts`.
- `server/src/services/dashboard.ts` (como o financeiro lê `Lancamento` — referência; **não alterar**).
- Client: `client/src/rebanho/components/MovimentoForm.tsx` (Fatia 9), `ProdutoForm.tsx` (Fatia 8), `api.ts`, `listarGrupos`/`listarFornecedores` (padrão de selects).

---

## PARTE A — BACKEND

### Task 1: Schema + resolver puro (TDD)

**Files:** Modify `server/prisma/schema.prisma`; Create `server/src/services/rebanho/ponte.calc.ts` + `.test.ts`.

- [ ] **Step 1: Schema.** Em `model Produto` adicionar `categoria Categoria? @relation(fields:[categoriaId],references:[id])`, `categoriaId Int?`, `centroCusto CentroCusto? @relation(fields:[centroCustoId],references:[id])`, `centroCustoId Int?`. Em `model MovimentoEstoque` adicionar `lancamento Lancamento? @relation(fields:[lancamentoId],references:[id])`, `lancamentoId Int? @unique`. Relações inversas: `Categoria` += `produtos Produto[]`, `CentroCusto` += `produtos Produto[]`, `Lancamento` += `movimentoEstoque MovimentoEstoque?`.
- [ ] **Step 2:** `cd server && pnpm db:push && pnpm prisma:generate` (worktree: `--env-file=/home/toledo/fazendinha/server/.env`).
- [ ] **Step 3: `ponte.calc.ts`:**
```ts
export interface ResolverIn {
  tipo: "ENTRADA" | "SAIDA" | "AJUSTE";
  gerarLancamento?: boolean;
  inputCategoriaId?: number; inputCentroCustoId?: number;
  produtoCategoriaId: number | null; produtoCentroCustoId: number | null;
  mesFechado: boolean;
}
export interface ResolverOut { deveCriar: boolean; categoriaId?: number; centroCustoId?: number; motivo?: string }
export function resolverLancamentoDaEntrada(i: ResolverIn): ResolverOut {
  if (i.tipo !== "ENTRADA" || i.gerarLancamento === false) return { deveCriar: false };
  const categoriaId = i.inputCategoriaId ?? i.produtoCategoriaId ?? undefined;
  const centroCustoId = i.inputCentroCustoId ?? i.produtoCentroCustoId ?? undefined;
  if (categoriaId == null || centroCustoId == null) return { deveCriar: false, motivo: "produto sem categoria/centro de custo" };
  if (i.mesFechado) return { deveCriar: false, motivo: "mês fechado" };
  return { deveCriar: true, categoriaId, centroCustoId };
}
```
- [ ] **Step 4: Testes (TDD)** `ponte.calc.test.ts`: SAIDA→deveCriar false; ENTRADA gerarLancamento=false→false; ENTRADA sem categoria(input nem produto)→false+motivo; input sobrepõe produto; produto preenche default; mesFechado→false+"mês fechado". Escrever→falhar→implementar→passar (`pnpm --filter rionovo-server test -- ponte.calc`).
- [ ] **Step 5: Commit** — `feat(rebanho): schema da ponte financeira (Produto↔Categoria/CentroCusto, Movimento↔Lancamento) + resolver puro (TDD)`.

### Task 2: Estoque gera/exclui lançamento + endpoints de referência

**Files:** Modify `server/src/services/rebanho/estoque.ts`, `server/src/services/rebanho/cadastros.ts`, `server/src/routes/rebanho/cadastros.ts`; Create `server/src/services/rebanho/financeiro-ref.ts`, `server/src/routes/rebanho/financeiro-ref.ts`; Modify `server/src/index.ts`.

- [ ] **Step 1: `movimentoSchema`** (estoque.ts) ganha `gerarLancamento: z.boolean().optional()`, `categoriaId: z.number().int().optional()`, `centroCustoId: z.number().int().optional()`.
- [ ] **Step 2: `registrarMovimento`** — depois de criar o `MovimentoEstoque`, se ENTRADA: buscar `mesFechado` (`prisma.fechamentoMensal.findFirst({ where: { ano, mes } })` da `data`), chamar `resolverLancamentoDaEntrada(...)` com os campos do input + os do produto. Se `deveCriar`: criar o `Lancamento` (campos da §4 do spec; `clienteFornecedorId = input.fornecedorId ?? null`; `descricao` = `Compra: ${produto.nome} (${quantidade} ${produto.unidade})`), depois `prisma.movimentoEstoque.update({ where:{id}, data:{ lancamentoId } })`. Retornar `{ id, lancamentoCriado: bool, lancamentoId?, motivo? }`.
- [ ] **Step 3: `excluirMovimento`** — carregar o movimento; se `lancamentoId`: checar `FechamentoMensal` do lançamento (se fechado → `throw EstoqueError`/novo motivo, não excluir); senão excluir o `Lancamento` e o movimento (ordem: excluir movimento primeiro ou setar null; como `lancamentoId @unique` aponta do movimento pro lançamento, excluir o movimento e depois o lançamento).
- [ ] **Step 4: `financeiro-ref.ts`** — `listarCategorias()` → `prisma.categoria.findMany({ orderBy:{nome:'asc'}, select:{id,nome} })`; `listarCentrosCusto()` → `prisma.centroCusto.findMany({ orderBy:{ordem:'asc'}, select:{id,nome,ehInvestimento} })`. Rota `financeiro-ref.ts`: `GET /rebanho/categorias`, `GET /rebanho/centros-custo`. Montar em `index.ts`.
- [ ] **Step 5: Cadastros — Produto** ganha categoria/centroCusto: em `cadastros.ts`, `produtoSchema` += `categoriaId: z.number().int().optional()`, `centroCustoId: z.number().int().optional()`; `produtoDTO` inclui `categoriaId`, `centroCustoId` e (via include) `categoriaNome`/`centroCustoNome`. `criarProduto`/`editarProduto`/`listarProdutos` passam os campos / incluem os nomes.
- [ ] **Step 6: Smoke de API** — build + subir (porta livre): criar/garantir um produto com categoria "Ração" + centro "Atividade Leiteira"; ENTRADA dele → resposta `lancamentoCriado:true` + `lancamentoId`; conferir que `GET /api/dashboard` reflete (o total da categoria Ração sobe) ou ao menos `prisma`/`GET movimentos` mostra o vínculo; ENTRADA de produto sem categoria → `lancamentoCriado:false, motivo`; excluir a 1ª ENTRADA → lançamento some. Documentar. Matar server.
- [ ] **Step 7: Commit** — `feat(rebanho): ENTRADA de estoque gera Lancamento financeiro + endpoints de categorias/centros`.

### Task 3: Seed

**Files:** Modify `server/prisma/seed-rebanho.ts`.

- [ ] **Step 1:** Ao criar os produtos (Fatia 8), setar `categoriaId`/`centroCustoId` por lookup de nome: Ração/Núcleo Mineral → Categoria "Ração"; Mastijet/Antibiótico X → "Medicamento Animal"; Sêmen → "Ração" (ou deixar sem, demonstra o caminho "sem categoria"). Todos `centroCusto` "Atividade Leiteira". As ENTRADAS já semeadas (Fatia 9) passam a gerar lançamentos — idempotência: antes de recriar movimentos, **excluir os Lancamentos vinculados** (`prisma.lancamento.deleteMany({ where: { movimentoEstoque: { isNot: null } } })` **ou** por `descricao startsWith "Compra:"`), pra não acumular a cada seed.
- [ ] **Step 2:** `pnpm --filter rionovo-server run seed:rebanho` sem erro; conferir contagem de lançamentos "Compra:" estável entre 2 runs.
- [ ] **Step 3: Commit** — `feat(rebanho): seed mapeia produtos a categorias e gera lançamentos das compras`.

---

## PARTE B — CLIENT

### Task 4: MovimentoForm + ProdutoForm + api

**Files:** Modify `client/src/rebanho/api.ts`, `client/src/rebanho/components/MovimentoForm.tsx`, `client/src/rebanho/components/ProdutoForm.tsx`; Modify `client/src/rebanho/__smoke__/render.test.ts`.

- [ ] **Step 1: api.ts** —
```ts
export interface RefDTO { id: number; nome: string }
export const listarCategorias = () => req<RefDTO[]>(`/rebanho/categorias`);
export const listarCentrosCusto = () => req<(RefDTO & { ehInvestimento: boolean })[]>(`/rebanho/centros-custo`);
```
`MovimentoInput` += `gerarLancamento?: boolean; categoriaId?: number; centroCustoId?: number`; `registrarMovimento` retorna `{ id: number; lancamentoCriado: boolean; lancamentoId?: number; motivo?: string }`. `ProdutoDTO`/`ProdutoInput` += `categoriaId?: number | null; centroCustoId?: number | null` (+ `categoriaNome`/`centroCustoNome` no DTO).
- [ ] **Step 2: `MovimentoForm`** — quando `tipo === "ENTRADA"`: carregar categorias + centros (uma vez), mostrar selects **Categoria** e **Centro de custo** (default = `produto.categoriaId/centroCustoId` ao escolher o produto) + checkbox **"Gerar lançamento financeiro"** (default marcado). Ao salvar, ler o retorno: se `lancamentoCriado` → feedback "✓ Lançamento gerado"; senão → "Sem lançamento: {motivo}". (Não bloquear o fechamento do drawer.)
- [ ] **Step 3: `ProdutoForm`** — adicionar selects opcionais **Categoria contábil** e **Centro de custo** (de `listarCategorias`/`listarCentrosCusto`), salvando `categoriaId`/`centroCustoId`.
- [ ] **Step 4: Smoke + verificação** — `render.test.ts`: o smoke do `MovimentoForm`/`EstoqueTab` segue válido (selects extra). `pnpm --filter rionovo-client build` + `test` verdes; `pnpm --filter rionovo-server test` verde.
- [ ] **Step 5: Commit** — `feat(rebanho): compra no Estoque gera lançamento (selects categoria/centro + feedback) e Produto carrega mapeamento contábil`.

---

## Verificação final (controller, navegador)
- Cadastros → editar um produto → setar Categoria contábil "Ração" + Centro "Atividade Leiteira".
- Estoque → Registrar movimento → ENTRADA daquele produto → ver "✓ Lançamento gerado".
- Dashboard financeiro (Gastos/Dashboard) → o total da categoria reflete a compra (ou via /api/dashboard). 
- Registrar ENTRADA de produto sem categoria → "Sem lançamento: produto sem categoria/centro de custo".

## Self-review
- Cobertura: schema+resolver (T1), estoque gera/exclui + refs + produto-cadastro (T2), seed (T3), client form+produto (T4). ✓
- Tipos `ResolverIn/Out`, `RefDTO`, retorno de `registrarMovimento`, `ProdutoDTO` consistentes. Sem placeholders de lógica.

## Decisões deferidas
- Editar/estornar o lançamento gerado pela tela financeira · parcelamento/conta bancária · Fatia 11 (custo/litro real) · multi-tenant.
