# Fatia 9 — Estoque + custo vaca/dia Implementation Plan

> **For agentic workers:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development. Passos usam checkbox.

**Goal:** Aba **Estoque** com saldo de insumos (entradas − saídas), registro de movimentos, e o KPI **custo vaca/dia** (consumo valorizado ÷ vacas×dias) — o norte da Tássila.

**Architecture:** Padrão do repo: Hono router→service + Prisma (`db push`) + Zod; client fetchers/hooks + drawer. **Motor puro** (`saldoProduto`, `custoVacaDia`) testado (TDD). Depende da Fatia 8 (`Produto`, `ClienteFornecedor`).

**Tech Stack:** Hono, Prisma 6, Zod, `@hono/zod-validator`, React 18 + Vite + TS, Vitest.

## Global Constraints
- ESM: server `.js`; client sem extensão. Enums Prisma multi-linha. Decimal→`Number()`. PT-BR. CSS `var(--...)`. `db push`.
- Motor puro Prisma-free e testado. `valorTotal = quantidade × custoUnitario`. Saldo computado (não armazenado).
- Aba **Estoque** no **grupo REBANHO** (chave `reb-estoque`, entre Produção e IA).

## Padrões a espelhar
- Motor + teste: `server/src/services/rebanho/dashboard.agg.ts` + `.test.ts` (agregação pura). Service mutate: `server/src/services/rebanho/eventos.ts`.
- CRUD service/DTO/erro + filtros: `server/src/services/rebanho/cadastros.ts`. Rota+mount: `server/src/routes/rebanho/cadastros.ts` + `index.ts`.
- Vacas em lactação (`resumo.del != null`): `server/src/services/rebanho/producao.ts`.
- Client: `client/src/rebanho/api.ts`; aba `client/src/rebanho/components/ProducaoTab.tsx`; drawer `client/src/rebanho/components/ControleForm.tsx`; sidebar `client/src/components/AppSidebar.tsx` + `Shell.tsx` + `App.tsx` + `RebanhoContent.tsx`.

---

## PARTE A — BACKEND

### Task 1: Schema + motor puro (TDD)

**Files:** Modify `server/prisma/schema.prisma`; Create `server/src/services/rebanho/estoque.calc.ts` + `.test.ts`.

- [ ] **Step 1: Schema.** Adicionar:
```prisma
enum TipoMovimento {
  ENTRADA
  SAIDA
  AJUSTE
}
model MovimentoEstoque {
  id            Int           @id @default(autoincrement())
  produto       Produto       @relation(fields: [produtoId], references: [id])
  produtoId     Int
  tipo          TipoMovimento
  data          DateTime      @db.Date
  quantidade    Decimal       @db.Decimal(12, 2)
  custoUnitario Decimal       @db.Decimal(12, 2)
  valorTotal    Decimal       @db.Decimal(14, 2)
  grupo         Grupo?             @relation(fields: [grupoId], references: [id])
  grupoId       Int?
  fornecedor    ClienteFornecedor? @relation(fields: [fornecedorId], references: [id])
  fornecedorId  Int?
  observacao    String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  @@index([produtoId, data])
  @@index([tipo, data])
}
```
Relações inversas: `Produto` += `movimentos MovimentoEstoque[]`; `Grupo` += `movimentosEstoque MovimentoEstoque[]`; `ClienteFornecedor` += `movimentosEstoque MovimentoEstoque[]`.
- [ ] **Step 2:** `cd server && pnpm db:push && pnpm prisma:generate` (no worktree, `--env-file=/home/toledo/fazendinha/server/.env`).
- [ ] **Step 3: Motor `estoque.calc.ts`:**
```ts
export interface MovIn { tipo: "ENTRADA" | "SAIDA" | "AJUSTE"; quantidade: number; valorTotal: number; data: string }
const sinal = (t: MovIn["tipo"]) => (t === "SAIDA" ? -1 : 1); // AJUSTE soma com o sinal da própria quantidade/valor
export function saldoProduto(movs: MovIn[]): { saldo: number; valor: number } {
  let saldo = 0, valor = 0;
  for (const m of movs) { saldo += sinal(m.tipo) * m.quantidade; valor += sinal(m.tipo) * m.valorTotal; }
  return { saldo: Math.round(saldo * 100) / 100, valor: Math.round(valor * 100) / 100 };
}
export function custoVacaDia(saidas: { valorTotal: number; data: string }[], vacasEmLactacao: number, hoje: string, periodoDias: number): number | null {
  if (vacasEmLactacao <= 0) return null;
  const limite = new Date(hoje); limite.setDate(limite.getDate() - periodoDias);
  const total = saidas.filter((s) => new Date(s.data) >= limite && new Date(s.data) <= new Date(hoje)).reduce((a, s) => a + s.valorTotal, 0);
  return Math.round((total / (vacasEmLactacao * periodoDias)) * 100) / 100;
}
```
- [ ] **Step 4: Testes (TDD)** `estoque.calc.test.ts`:
  - `saldoProduto([ENTRADA 100/R$200, SAIDA 30/R$60])` → `{saldo:70, valor:140}`.
  - `saldoProduto([])` → `{saldo:0, valor:0}`; AJUSTE com quantidade negativa subtrai.
  - `custoVacaDia([{valorTotal:2100, data:hoje}], 7, hoje, 30)` → `2100/(7*30)=10`.
  - `custoVacaDia([...], 0, hoje, 30)` → null; saída com data > 30 dias atrás é ignorada.
  Rodar `pnpm --filter rionovo-server test -- estoque.calc` (escrever→falhar→implementar→passar).
- [ ] **Step 5: Commit** — `feat(rebanho): schema MovimentoEstoque + motor de saldo/custo-vaca-dia (TDD)`.

### Task 2: Service + rotas

**Files:** Create `server/src/services/rebanho/estoque.ts`, `server/src/routes/rebanho/estoque.ts`; Modify `server/src/index.ts`.

- [ ] **Step 1: `estoque.ts`** (espelha `cadastros.ts` + `dashboard-rebanho.ts`):
```ts
import { prisma } from "../../db.js";
import { z } from "zod";
import { saldoProduto, custoVacaDia, type MovIn } from "./estoque.calc.js";
export class EstoqueError extends Error { constructor(public code: "NAO_ENCONTRADO", m: string) { super(m); } }
const iso = (d: Date) => d.toISOString().slice(0, 10);
const naoFutura = z.string().refine((s) => new Date(s) <= new Date(), "data não pode ser futura");

export const movimentoSchema = z.object({
  produtoId: z.number().int(),
  tipo: z.enum(["ENTRADA", "SAIDA", "AJUSTE"]),
  data: naoFutura,
  quantidade: z.number().positive(),
  custoUnitario: z.number().nonnegative().optional(),
  grupoId: z.number().int().optional(),
  fornecedorId: z.number().int().optional(),
  observacao: z.string().max(200).optional(),
});
export type MovimentoInput = z.infer<typeof movimentoSchema>;

export async function listarSaldos() {
  const produtos = await prisma.produto.findMany({ where: { estocavel: true, ativo: true }, orderBy: { nome: "asc" }, include: { movimentos: true } });
  return produtos.map((p) => {
    const movs: MovIn[] = p.movimentos.map((m) => ({ tipo: m.tipo, quantidade: Number(m.quantidade), valorTotal: Number(m.valorTotal), data: iso(m.data) }));
    const { saldo, valor } = saldoProduto(movs);
    const minimo = p.minimoEstoque != null ? Number(p.minimoEstoque) : null;
    return { produtoId: p.id, nome: p.nome, tipo: p.tipo, unidade: p.unidade, saldo, valor, minimoEstoque: minimo, abaixoMinimo: minimo != null && saldo < minimo };
  });
}
export async function listarMovimentos(f?: { produtoId?: number; tipo?: string }) {
  const where: any = {};
  if (f?.produtoId) where.produtoId = f.produtoId;
  if (f?.tipo) where.tipo = f.tipo;
  const ms = await prisma.movimentoEstoque.findMany({ where, orderBy: { data: "desc" }, take: 200, include: { produto: true, fornecedor: true, grupo: true } });
  return ms.map((m) => ({ id: m.id, produtoId: m.produtoId, produto: m.produto.nome, tipo: m.tipo, data: iso(m.data), quantidade: Number(m.quantidade), custoUnitario: Number(m.custoUnitario), valorTotal: Number(m.valorTotal), fornecedor: m.fornecedor?.nome ?? null, grupo: m.grupo?.nome ?? null, observacao: m.observacao ?? null }));
}
export async function registrarMovimento(input: MovimentoInput) {
  const produto = await prisma.produto.findUnique({ where: { id: input.produtoId } });
  if (!produto) throw new EstoqueError("NAO_ENCONTRADO", "produto não encontrado");
  const custo = input.custoUnitario ?? (produto.custoUnitario != null ? Number(produto.custoUnitario) : 0);
  const valorTotal = Math.round(input.quantidade * custo * 100) / 100;
  const m = await prisma.movimentoEstoque.create({ data: { produtoId: input.produtoId, tipo: input.tipo, data: new Date(input.data), quantidade: input.quantidade, custoUnitario: custo, valorTotal, grupoId: input.grupoId ?? null, fornecedorId: input.fornecedorId ?? null, observacao: input.observacao } });
  return { id: m.id };
}
export async function excluirMovimento(id: number) {
  if (!(await prisma.movimentoEstoque.findUnique({ where: { id } }))) throw new EstoqueError("NAO_ENCONTRADO", "movimento não encontrado");
  await prisma.movimentoEstoque.delete({ where: { id } });
}
export async function calcularCustoVacaDia(periodoDias = 30) {
  const hoje = iso(new Date());
  const vacas = await prisma.animal.count({ where: { status: "ATIVO", resumo: { del: { not: null } } } });
  const limite = new Date(); limite.setDate(limite.getDate() - periodoDias);
  const saidas = await prisma.movimentoEstoque.findMany({ where: { tipo: "SAIDA", data: { gte: limite } }, select: { valorTotal: true, data: true } });
  const arr = saidas.map((s) => ({ valorTotal: Number(s.valorTotal), data: iso(s.data) }));
  const custo = custoVacaDia(arr, vacas, hoje, periodoDias);
  const totalConsumo = Math.round(arr.reduce((a, s) => a + s.valorTotal, 0) * 100) / 100;
  return { periodoDias, custoVacaDia: custo, vacasEmLactacao: vacas, totalConsumo };
}
```
- [ ] **Step 2: `routes/rebanho/estoque.ts`** — `GET /rebanho/estoque/saldos`, `GET /rebanho/estoque/movimentos` (query produtoId/tipo), `POST /rebanho/estoque/movimentos` (zValidator), `DELETE /rebanho/estoque/movimentos/:id`, `GET /rebanho/estoque/custo-vaca-dia?dias=`. `EstoqueError`→404. Espelhar `routes/rebanho/cadastros.ts`. Montar em `index.ts`.
- [ ] **Step 3: Teste** — `estoque.schemas.test.ts` (movimentoSchema válido / sem produtoId / quantidade ≤0 / data futura). Rodar verde.
- [ ] **Step 4: Smoke de API** — build + subir (porta livre): registrar ENTRADA (Ração, qtde 1000, custo 2.1) → `GET saldos` (saldo 1000, valor 2100); registrar SAIDA (Ração, 300) → saldo 700; `GET custo-vaca-dia` → custo coerente (consumo 630 / (7×30)). Documentar. Matar server.
- [ ] **Step 5: Commit** — `feat(rebanho): endpoints de estoque (saldos/movimentos/custo-vaca-dia)`.

### Task 3: Seed

**Files:** Modify `server/prisma/seed-rebanho.ts`.

- [ ] **Step 1:** Idempotente (`movimentoEstoque.deleteMany({})`): entradas (Ração Lactação Alta 1500 kg, Núcleo Mineral 200 kg, via fornecedor Cargill) + saídas recentes (consumo Ração ~900 kg nos últimos dias) usando os produtos/fornecedores da Fatia 8 (buscar por nome). Garante saldo positivo + custo vaca/dia plausível.
- [ ] **Step 2:** `pnpm --filter rionovo-server run seed:rebanho` sem erro.
- [ ] **Step 3: Commit** — `feat(rebanho): seed de movimentos de estoque`.

---

## PARTE B — CLIENT

### Task 4: api.ts + aba Estoque + MovimentoForm

**Files:** Modify `client/src/rebanho/api.ts`, `client/src/components/AppSidebar.tsx`, `client/src/components/Shell.tsx`, `client/src/App.tsx`, `client/src/rebanho/RebanhoContent.tsx`; Create `client/src/rebanho/components/EstoqueTab.tsx`, `client/src/rebanho/components/MovimentoForm.tsx`; Modify `client/src/rebanho/__smoke__/render.test.ts`.

- [ ] **Step 1: api.ts** — tipos + fetchers + hooks:
```ts
export interface SaldoDTO { produtoId: number; nome: string; tipo: string; unidade: string; saldo: number; valor: number; minimoEstoque: number | null; abaixoMinimo: boolean; }
export interface MovimentoDTO { id: number; produtoId: number; produto: string; tipo: "ENTRADA" | "SAIDA" | "AJUSTE"; data: string; quantidade: number; custoUnitario: number; valorTotal: number; fornecedor: string | null; grupo: string | null; observacao: string | null; }
export interface MovimentoInput { produtoId: number; tipo: "ENTRADA" | "SAIDA" | "AJUSTE"; data: string; quantidade: number; custoUnitario?: number; grupoId?: number; fornecedorId?: number; observacao?: string; }
export interface CustoVacaDia { periodoDias: number; custoVacaDia: number | null; vacasEmLactacao: number; totalConsumo: number; }
export const listarSaldos = () => req<SaldoDTO[]>(`/rebanho/estoque/saldos`);
export const listarMovimentos = (f?: { produtoId?: number; tipo?: string }) => req<MovimentoDTO[]>(`/rebanho/estoque/movimentos${qs(f)}`);
export const registrarMovimento = (p: MovimentoInput) => req<{ id: number }>(`/rebanho/estoque/movimentos`, { method: "POST", body: JSON.stringify(p) });
export const excluirMovimento = (id: number) => req<{ ok: true }>(`/rebanho/estoque/movimentos/${id}`, { method: "DELETE" });
export const obterCustoVacaDia = (dias = 30) => req<CustoVacaDia>(`/rebanho/estoque/custo-vaca-dia?dias=${dias}`);
export function useSaldos() { /* data/loading/erro/recarregar */ }
export function useCustoVacaDia() { /* data/loading/erro/recarregar */ }
```
- [ ] **Step 2: `EstoqueTab.tsx`** — `useSaldos` + `useCustoVacaDia` + movimentos. Topo: KPI **custo vaca/dia** em destaque (valor + "vacas em lactação" + "consumo {periodo}d"). Depois: tabela de **saldos** (produto · tipo · saldo+unidade · valor · ⚠ se abaixoMinimo). Depois: **movimentos** recentes + botão "Registrar movimento" → `MovimentoForm`. Loading/erro shells.
- [ ] **Step 3: `MovimentoForm.tsx`** (drawer, espelha `ControleForm`) — campos: tipo (select ENTRADA/SAIDA/AJUSTE), produto (select de `listarProdutos`), data (default hoje), quantidade, custoUnitario (opcional, placeholder = custo do produto), fornecedor (select, só ENTRADA) / lote (select grupos, só SAIDA), observação. Salva via `registrarMovimento` → refetch.
- [ ] **Step 4: Sidebar/nav.** `AppSidebar.tsx`: ícone (caixa/estoque) `reb-estoque` no grupo REBANHO entre Produção e IA. `Shell.tsx`: `Tab` += `"reb-estoque"`. `App.tsx`: `REB` map += `"reb-estoque": "estoque"`. `RebanhoContent.tsx`: `RebSub` += `"estoque"`; rotear `aba === "estoque"` → `<EstoqueTab/>`.
- [ ] **Step 5: Smoke + verificação** — `render.test.ts`: caso `EstoqueTab` (loading shell) + estende sidebar smoke com "Estoque". `pnpm --filter rionovo-client build` + `test` verdes; `pnpm --filter rionovo-server test` verde.
- [ ] **Step 6: Commit** — `feat(rebanho): aba Estoque (saldos, movimentos, custo vaca/dia)`.

---

## Verificação final (controller, navegador)
- Item **Estoque** no grupo REBANHO.
- KPI **custo vaca/dia** visível com valor plausível.
- Tabela de saldos (produtos com saldo do seed) + alerta de mínimo.
- Registrar uma SAÍDA → saldo cai e custo vaca/dia sobe; registrar ENTRADA → saldo sobe.

## Self-review
- Cobertura: schema+motor (T1), service+rotas+custo-vaca-dia (T2), seed (T3), api+aba+form+nav (T4). ✓
- Tipos `MovIn`, `MovimentoInput`, `SaldoDTO`, `MovimentoDTO`, `CustoVacaDia`, `RebSub`+`estoque` consistentes. Sem placeholders de lógica.

## Decisões deferidas
- Compra→`Lancamento` automático · alocação por centro de custo · NOTA/XML · validade/FEFO · custo por categoria · multi-tenant.
