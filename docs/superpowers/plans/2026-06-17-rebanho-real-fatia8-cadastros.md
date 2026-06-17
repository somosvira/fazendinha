# Fatia 8 — Cadastros (Produto + Fornecedor) Implementation Plan

> **For agentic workers:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development. Passos usam checkbox.

**Goal:** Aba **Cadastros** (área Fazenda) com catálogos de **Produtos** (remédio/ração/insumo) e **Fornecedores** — fundação para a Fatia 9 (Estoque → custo vaca/dia).

**Architecture:** CRUD puro no padrão do repo: Hono router→service + Prisma (`db push`) + Zod; client fetchers/hooks + drawer. Sem motor de recálculo. `Fornecedor` reaproveita o `ClienteFornecedor` do financeiro (estendido), sem duplicar.

**Tech Stack:** Hono, Prisma 6, Zod, `@hono/zod-validator`, React 18 + Vite + TS, Vitest.

## Global Constraints
- ESM: server `.js` nos imports relativos; client sem extensão. Enums Prisma multi-linha.
- Decimal→`Number()` na serialização. PT-BR. CSS via `var(--...)`. `db push` (sem migrations).
- Soft-delete por `ativo=false` (não apagar produtos/fornecedores com histórico).
- Aba **Cadastros** entra no **rodapé** do `AppSidebar` (perto de Configurações), chave `cadastros` — não no grupo REBANHO.

## Padrões a espelhar
- CRUD service + DTO + erro: `server/src/services/rebanho/nutricao.ts` (Dieta).
- Rota + mount: `server/src/routes/rebanho/nutricao.ts` + `server/src/index.ts`.
- Client fetch/hooks: `client/src/rebanho/api.ts` (`useDietas`/`useLotes`). Drawer: `client/src/rebanho/components/DietaForm.tsx`. Tab: `client/src/rebanho/components/NutricaoTab.tsx`. Sidebar/nav: `client/src/components/AppSidebar.tsx` + `client/src/components/Shell.tsx` + `client/src/App.tsx`.

---

## PARTE A — BACKEND

### Task 1: Schema (Produto + extensão ClienteFornecedor)

**Files:** Modify `server/prisma/schema.prisma`.

- [ ] **Step 1:** Adicionar:
```prisma
enum TipoProduto {
  MEDICAMENTO
  RACAO
  INSUMO
  MINERAL
  OUTRO
}
enum TipoPessoa {
  CLIENTE
  FORNECEDOR
  AMBOS
}
model Produto {
  id            Int         @id @default(autoincrement())
  nome          String      @unique
  tipo          TipoProduto @default(INSUMO)
  unidade       String      @default("un")
  custoUnitario Decimal?    @db.Decimal(12, 2)
  carencia      Int?
  percentualMS  Decimal?    @db.Decimal(5, 2)
  estocavel     Boolean     @default(true)
  minimoEstoque Decimal?    @db.Decimal(12, 2)
  ativo         Boolean     @default(true)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  @@index([tipo])
}
```
No `model ClienteFornecedor`, adicionar (mantendo os campos existentes):
```prisma
  tipo      TipoPessoa @default(FORNECEDOR)
  telefone  String?
  email     String?
  ativo     Boolean    @default(true)
```
- [ ] **Step 2:** `cd server && pnpm db:push && pnpm prisma:generate` (usa o `.env` local; no worktree, `--env-file=/home/toledo/fazendinha/server/.env`).
- [ ] **Step 3: Commit** — `feat(rebanho): schema Produto + extensão de ClienteFornecedor (cadastros)`.

### Task 2: Services + schemas + rotas

**Files:** Create `server/src/services/rebanho/cadastros.ts`, `server/src/routes/rebanho/cadastros.ts`; Modify `server/src/index.ts`.

- [ ] **Step 1: `cadastros.ts` (service).** Zod + CRUD, espelhando `nutricao.ts`:
```ts
import { prisma } from "../../db.js";
import { z } from "zod";
export class CadastroError extends Error { constructor(public code: "NAO_ENCONTRADO" | "DUPLICADO", m: string) { super(m); } }

export const produtoSchema = z.object({
  nome: z.string().min(1).max(80),
  tipo: z.enum(["MEDICAMENTO", "RACAO", "INSUMO", "MINERAL", "OUTRO"]),
  unidade: z.string().min(1).max(12).default("un"),
  custoUnitario: z.number().nonnegative().optional(),
  carencia: z.number().int().nonnegative().optional(),
  percentualMS: z.number().min(0).max(100).optional(),
  estocavel: z.boolean().optional(),
  minimoEstoque: z.number().nonnegative().optional(),
  ativo: z.boolean().optional(),
});
export type ProdutoInput = z.infer<typeof produtoSchema>;
const produtoDTO = (p: any) => ({ id: p.id, nome: p.nome, tipo: p.tipo, unidade: p.unidade, custoUnitario: p.custoUnitario != null ? Number(p.custoUnitario) : null, carencia: p.carencia ?? null, percentualMS: p.percentualMS != null ? Number(p.percentualMS) : null, estocavel: p.estocavel, minimoEstoque: p.minimoEstoque != null ? Number(p.minimoEstoque) : null, ativo: p.ativo });

export async function listarProdutos(f?: { tipo?: string; q?: string; ativo?: boolean }) {
  const where: any = {};
  if (f?.tipo) where.tipo = f.tipo;
  if (f?.ativo != null) where.ativo = f.ativo;
  if (f?.q) where.nome = { contains: f.q, mode: "insensitive" };
  return (await prisma.produto.findMany({ where, orderBy: { nome: "asc" } })).map(produtoDTO);
}
export async function criarProduto(input: ProdutoInput) {
  if (await prisma.produto.findUnique({ where: { nome: input.nome } })) throw new CadastroError("DUPLICADO", `produto ${input.nome} já existe`);
  return produtoDTO(await prisma.produto.create({ data: input }));
}
export async function editarProduto(id: number, input: Partial<ProdutoInput>) {
  if (!(await prisma.produto.findUnique({ where: { id } }))) throw new CadastroError("NAO_ENCONTRADO", "produto não encontrado");
  return produtoDTO(await prisma.produto.update({ where: { id }, data: input }));
}

export const fornecedorSchema = z.object({
  nome: z.string().min(1).max(120),
  documento: z.string().max(20).optional(),
  tipo: z.enum(["CLIENTE", "FORNECEDOR", "AMBOS"]).optional(),
  telefone: z.string().max(20).optional(),
  email: z.string().email().max(120).optional().or(z.literal("")),
  ativo: z.boolean().optional(),
});
export type FornecedorInput = z.infer<typeof fornecedorSchema>;
const fornDTO = (f: any) => ({ id: f.id, nome: f.nome, documento: f.documento ?? null, tipo: f.tipo, telefone: f.telefone ?? null, email: f.email ?? null, ativo: f.ativo });
export async function listarFornecedores(f?: { tipo?: string; q?: string }) {
  const where: any = {};
  if (f?.tipo) where.tipo = f.tipo;
  if (f?.q) where.nome = { contains: f.q, mode: "insensitive" };
  return (await prisma.clienteFornecedor.findMany({ where, orderBy: { nome: "asc" } })).map(fornDTO);
}
export async function criarFornecedor(input: FornecedorInput) {
  if (await prisma.clienteFornecedor.findFirst({ where: { nome: input.nome } })) throw new CadastroError("DUPLICADO", `${input.nome} já existe`);
  return fornDTO(await prisma.clienteFornecedor.create({ data: { ...input, email: input.email || null } }));
}
export async function editarFornecedor(id: number, input: Partial<FornecedorInput>) {
  if (!(await prisma.clienteFornecedor.findUnique({ where: { id } }))) throw new CadastroError("NAO_ENCONTRADO", "fornecedor não encontrado");
  return fornDTO(await prisma.clienteFornecedor.update({ where: { id }, data: { ...input, email: input.email === "" ? null : input.email } }));
}
```
- [ ] **Step 2: `routes/rebanho/cadastros.ts`** — `GET /rebanho/produtos` (query `tipo/q/ativo`), `POST /rebanho/produtos`, `PATCH /rebanho/produtos/:id`; `GET /rebanho/fornecedores`, `POST /rebanho/fornecedores`, `PATCH /rebanho/fornecedores/:id`. zValidator nos POST/PATCH; tratar `CadastroError` (DUPLICADO→409, NAO_ENCONTRADO→404). Espelhar `routes/rebanho/nutricao.ts`. Montar em `index.ts`.
- [ ] **Step 3: Testes** — `cadastros.schemas.test.ts` (Zod: produto válido/sem nome/tipo inválido; fornecedor email inválido). Rodar `pnpm --filter rionovo-server test -- cadastros` verde.
- [ ] **Step 4: Smoke de API** — build + subir (porta livre): criar produto, listar, filtrar por tipo, duplicar→409; criar fornecedor, listar. Documentar. Matar server.
- [ ] **Step 5: Commit** — `feat(rebanho): endpoints de cadastros (produtos + fornecedores)`.

### Task 3: Seed

**Files:** Modify `server/prisma/seed-rebanho.ts`.

- [ ] **Step 1:** Idempotente (`produto.deleteMany({})`): criar ~5 produtos (Mastijet MEDICAMENTO un carência 96; Ração Lactação Alta RACAO kg %MS 88; Núcleo Mineral MINERAL kg; Sêmen Lance 884 INSUMO dose; Antibiótico X MEDICAMENTO). Garantir 2–3 `ClienteFornecedor` com `tipo`/contato (Cargill, Coop. Boa Vista) — upsert por nome pra não duplicar os que o financeiro já criou.
- [ ] **Step 2:** `pnpm --filter rionovo-server run seed:rebanho` sem erro.
- [ ] **Step 3: Commit** — `feat(rebanho): seed de produtos e fornecedores`.

---

## PARTE B — CLIENT

### Task 4: api.ts + CadastrosView + sidebar

**Files:** Modify `client/src/rebanho/api.ts`, `client/src/components/AppSidebar.tsx`, `client/src/components/Shell.tsx`, `client/src/App.tsx`; Create `client/src/rebanho/components/CadastrosView.tsx`, `client/src/rebanho/components/ProdutoForm.tsx`, `client/src/rebanho/components/FornecedorForm.tsx`; Modify `client/src/rebanho/__smoke__/render.test.ts`.

- [ ] **Step 1: api.ts** — tipos + fetchers + hooks:
```ts
export type TipoProduto = "MEDICAMENTO" | "RACAO" | "INSUMO" | "MINERAL" | "OUTRO";
export interface ProdutoDTO { id: number; nome: string; tipo: TipoProduto; unidade: string; custoUnitario: number | null; carencia: number | null; percentualMS: number | null; estocavel: boolean; minimoEstoque: number | null; ativo: boolean; }
export interface ProdutoInput { nome: string; tipo: TipoProduto; unidade: string; custoUnitario?: number; carencia?: number; percentualMS?: number; estocavel?: boolean; minimoEstoque?: number; ativo?: boolean; }
export const listarProdutos = (f?: { tipo?: string; q?: string }) => req<ProdutoDTO[]>(`/rebanho/produtos${qs(f)}`);
export const criarProduto = (p: ProdutoInput) => req<ProdutoDTO>(`/rebanho/produtos`, { method: "POST", body: JSON.stringify(p) });
export const editarProduto = (id: number, p: Partial<ProdutoInput>) => req<ProdutoDTO>(`/rebanho/produtos/${id}`, { method: "PATCH", body: JSON.stringify(p) });
export type TipoPessoa = "CLIENTE" | "FORNECEDOR" | "AMBOS";
export interface FornecedorDTO { id: number; nome: string; documento: string | null; tipo: TipoPessoa; telefone: string | null; email: string | null; ativo: boolean; }
export interface FornecedorInput { nome: string; documento?: string; tipo?: TipoPessoa; telefone?: string; email?: string; ativo?: boolean; }
export const listarFornecedores = (f?: { tipo?: string; q?: string }) => req<FornecedorDTO[]>(`/rebanho/fornecedores${qs(f)}`);
export const criarFornecedor = (p: FornecedorInput) => req<FornecedorDTO>(`/rebanho/fornecedores`, { method: "POST", body: JSON.stringify(p) });
export const editarFornecedor = (id: number, p: Partial<FornecedorInput>) => req<FornecedorDTO>(`/rebanho/fornecedores/${id}`, { method: "PATCH", body: JSON.stringify(p) });
export function useProdutos(f?: { tipo?: string; q?: string }) { /* data/loading/erro/recarregar, mesmo padrão de useAnimais */ }
export function useFornecedores(f?: { tipo?: string; q?: string }) { /* idem */ }
```
> `qs(f)` = helper que monta a query string (já há um padrão inline em `listarAnimais`; pode extrair um helper ou repetir o padrão).

- [ ] **Step 2: `CadastrosView.tsx`** — sub-abas internas **Produtos | Fornecedores** (`useState`). Produtos: filtro por tipo (chips) + busca + tabela (nome · tipo · unidade · custo · ativo) + "Novo produto" → `ProdutoForm` (drawer). Fornecedores: tabela (nome · tipo · documento · contato · ativo) + "Novo fornecedor" → `FornecedorForm`. Editar abre o drawer preenchido. Ativar/desativar via `editar...({ ativo })`. Loading/erro shells.
- [ ] **Step 3: `ProdutoForm.tsx` / `FornecedorForm.tsx`** — drawers espelhando `DietaForm`/`AnimalForm`: campos controlados, salvar via criar/editar, callback de refetch. Produto: nome, tipo (select), unidade, custoUnitario, carência, %MS, estocável, mínimo. Fornecedor: nome, tipo (select), documento, telefone, email.
- [ ] **Step 4: Sidebar + App.** `AppSidebar.tsx`: ícone (ex.: caixa/etiqueta) pra `cadastros` + `<Item id="cadastros" label="Cadastros">` no rodapé (perto de Configurações). `Shell.tsx`: `Tab` += `"cadastros"`. `App.tsx`: rotear `cadastros` → `<CadastrosView/>`; redirect effect early-return em `cadastros`.
- [ ] **Step 5: Smoke + verificação** — `render.test.ts`: caso `CadastrosView` (lista/loading + sub-abas + estende o smoke do AppSidebar com "Cadastros"). `pnpm --filter rionovo-client build` + `test` verdes.
- [ ] **Step 6: Commit** — `feat(rebanho): aba Cadastros (produtos + fornecedores) + item no sidebar`.

---

## Verificação final (controller, navegador)
- Item **Cadastros** no rodapé do sidebar.
- Sub-aba Produtos: lista semeada; criar um produto (ex.: "Ivermectina" MEDICAMENTO) → aparece; filtrar por tipo.
- Sub-aba Fornecedores: lista; criar um fornecedor → aparece.

## Self-review
- Cobertura: Produto+Fornecedor schema (T1), services+rotas+Zod (T2), seed (T3), api+UI+sidebar (T4). ✓
- Sem placeholders de lógica (os "espelha X" apontam arquivos reais). Tipos `ProdutoDTO/Input`, `FornecedorDTO/Input`, enums consistentes entre tasks.

## Decisões deferidas
- Sanidade/Nutrição referenciarem `Produto` por FK · link `Produto`↔`Categoria` (Fatia 9) · Estoque (Fatia 9) · multi-tenant.
