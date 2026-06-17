# Fatia 11 — Custo de Produção (quebra do custo real) Implementation Plan

> **For agentic workers:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development. Passos usam checkbox.

**Goal:** Aba **Custo de Produção** (grupo Rebanho) que mostra o custeio do leite real por componente (do `Lancamento`) + custo vaca/dia, com o custo/litro marcado como pendente de produção em escala real (sem divisor quebrado).

**Architecture:** Padrão do repo. **Sem mudança de schema** (só leitura). Função pura `quebrarPorCategoria` (TDD) + service que agrega `Lancamento` (filtros do `buildDashboard`) + reusa `calcularCustoVacaDia`. Uma aba nova + nav.

**Tech Stack:** Hono, Prisma 6, Zod, React 18 + Vite + TS, Vitest.

## Global Constraints
- ESM: server `.js`; client sem extensão. Decimal→`Number()`. PT-BR. CSS `var(--...)`.
- **Não mostrar custo/litro com divisor quebrado** — `custoLitro: null` + nota de transparência (escalas incompatíveis: produção seed 8 vacas × financeiro fazenda inteira).
- Aba **Custo** no grupo REBANHO (`reb-custo`, entre Estoque e IA).
- Não alterar o financeiro nem outras abas; o `buildDashboard` é só referência (não mudar).

## Padrões a espelhar
- `server/src/services/dashboard.ts` (`buildDashboard` — filtros de `Lancamento`: `situacao=LIQUIDADO`, `estornado=false`, `dataLiquidacao not null`, `centroCusto.nome != "(Sem centro de custo)"`; usar `centroCusto.nome = "Atividade Leiteira"` + `natureza=DEBITO`). **Referência — não alterar.**
- `server/src/services/rebanho/estoque.ts` (`calcularCustoVacaDia` — reusar) + `producao.ts` (vacas em lactação `resumo.del != null`; litros).
- `server/src/services/rebanho/dashboard.agg.ts` + `.test.ts` (motor puro + TDD).
- Rota+mount: `server/src/routes/rebanho/estoque.ts` + `index.ts`.
- Client aba: `client/src/rebanho/components/EstoqueTab.tsx`; nav: `AppSidebar.tsx`/`Shell.tsx`/`App.tsx`/`RebanhoContent.tsx`; `api.ts`.

---

### Task 1: Motor puro + service + endpoint (backend)

**Files:** Create `server/src/services/rebanho/custo-producao.ts` + `server/src/services/rebanho/custo-producao.test.ts`, `server/src/routes/rebanho/custo-producao.ts`; Modify `server/src/index.ts`.

- [ ] **Step 1: Motor puro** em `custo-producao.ts`:
```ts
export interface ItemCusto { categoria: string; valor: number }
export interface QuebraCusto { total: number; linhas: { categoria: string; valor: number; pct: number }[] }
export function quebrarPorCategoria(itens: ItemCusto[]): QuebraCusto {
  const por = new Map<string, number>();
  for (const i of itens) por.set(i.categoria, (por.get(i.categoria) ?? 0) + i.valor);
  const total = Math.round([...por.values()].reduce((a, b) => a + b, 0) * 100) / 100;
  const linhas = [...por.entries()]
    .map(([categoria, valor]) => ({ categoria, valor: Math.round(valor * 100) / 100, pct: total > 0 ? Math.round((valor / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.valor - a.valor);
  return { total, linhas };
}
```
- [ ] **Step 2: Testes (TDD)** `custo-producao.test.ts`:
  - `quebrarPorCategoria([])` → `{ total: 0, linhas: [] }`.
  - `[{Ração,100},{Ração,50},{Pessoal,150}]` → total 300; linhas ordenadas [Pessoal 150 (50%), Ração 150 (50%)] (ou Ração/Pessoal — desempate por valor igual, aceitar ambos; usar valores distintos pra ordenar: Ração 200/Pessoal 100 → [Ração 200 (66.7%), Pessoal 100 (33.3%)]).
  - total 0 → pct 0.
  Rodar `pnpm --filter rionovo-server test -- custo-producao` (falhar→implementar→passar).
- [ ] **Step 3: Service** `agregarCustoProducao(meses = 12)` no mesmo arquivo:
```ts
import { prisma } from "../../db.js";
import { calcularCustoVacaDia } from "./estoque.js";
const toNum = (x: any) => (x != null ? Number(x) : 0);

export async function agregarCustoProducao(meses = 12) {
  const desde = new Date(); desde.setMonth(desde.getMonth() - meses);
  const lancs = await prisma.lancamento.findMany({
    where: { situacao: "LIQUIDADO", estornado: false, natureza: "DEBITO", dataLiquidacao: { not: null, gte: desde }, centroCusto: { nome: "Atividade Leiteira" } },
    select: { valor: true, categoria: { select: { nome: true } } },
  });
  const quebra = quebrarPorCategoria(lancs.map((l) => ({ categoria: l.categoria.nome, valor: toNum(l.valor) })));
  const cvd = await calcularCustoVacaDia(30); // { custoVacaDia, vacasEmLactacao, totalConsumo }
  // litros estimados do período (transparência) — produção média das vacas em lactação × dias
  const dias = meses * 30;
  const animais = await prisma.animal.findMany({ where: { status: "ATIVO", resumo: { del: { not: null } } }, include: { resumo: true } });
  const litrosDia = animais.reduce((s, a) => s + toNum(a.resumo?.producaoMediaDia), 0);
  const litrosPeriodoEstimado = Math.round(litrosDia * dias);
  return {
    periodoMeses: meses,
    custeioLeiteTotal: quebra.total,
    breakdown: quebra.linhas,
    custoVacaDia: cvd.custoVacaDia,
    vacasEmLactacao: cvd.vacasEmLactacao,
    litrosPeriodoEstimado,
    custoLitro: null as number | null,
    nota: "Custo/litro real requer produção em escala da fazenda inteira; hoje a produção é demonstração (8 vacas).",
  };
}
```
- [ ] **Step 4: Rota** `routes/rebanho/custo-producao.ts` — `GET /rebanho/custo-producao` (query `meses` opcional, default 12, `Number(c.req.query("meses")) || 12`). Montar em `index.ts`.
- [ ] **Step 5: Build + smoke** — `pnpm --filter rionovo-server build`; subir (porta livre) e `curl /api/rebanho/custo-producao` → `custeioLeiteTotal > 0`, breakdown com categorias reais (Ração/Pessoal/etc.), `custoLitro: null` + nota. Documentar. Matar server.
- [ ] **Step 6: Commit** — `feat(rebanho): custo de produção — quebra real do custeio do leite + endpoint`.

### Task 2: Aba Custo de Produção + nav (client)

**Files:** Modify `client/src/rebanho/api.ts`, `client/src/components/AppSidebar.tsx`, `client/src/components/Shell.tsx`, `client/src/App.tsx`, `client/src/rebanho/RebanhoContent.tsx`; Create `client/src/rebanho/components/CustoProducaoTab.tsx`; Modify `client/src/rebanho/__smoke__/render.test.ts`.

- [ ] **Step 1: api.ts**:
```ts
export interface CustoProducao { periodoMeses: number; custeioLeiteTotal: number; breakdown: { categoria: string; valor: number; pct: number }[]; custoVacaDia: number | null; vacasEmLactacao: number; litrosPeriodoEstimado: number; custoLitro: number | null; nota: string; }
export const obterCustoProducao = (meses = 12) => req<CustoProducao>(`/rebanho/custo-producao?meses=${meses}`);
export function useCustoProducao() { /* data/loading/erro/recarregar, padrão de useDashboard */ }
```
- [ ] **Step 2: `CustoProducaoTab.tsx`** — `useCustoProducao()`. Layout:
  - Eyebrow "REBANHO · CUSTO DE PRODUÇÃO" + h1 "Custo de Produção".
  - **Headline KPI strip:** Custeio do leite (total real, destaque, formato R$) · Custo vaca/dia · Vacas em lactação. (`.rb-kstrip`/`.rb-k`.)
  - **Quebra por componente:** tabela `.rb-tbl` (Categoria · Valor · %) ordenada; uma barra simples por linha (largura = pct%, cor `var(--leite)`) — sem hex hardcoded.
  - **Card de transparência** (`.rb-box`): título "Custo/litro — pendente"; mostra `nota`; lado a lado "Custeio (real): R$ X" e "Produção (demonstração): {litrosPeriodoEstimado} L". Deixa claro por que não há custo/litro.
  - Loading/erro shells como nas outras abas.
- [ ] **Step 3: Nav** — `Shell.tsx` `Tab` += `"reb-custo"`; `App.tsx` `REB` map += `"reb-custo": "custo"`; `AppSidebar.tsx` ícone ($/gráfico) + item "Custo" no grupo REBANHO entre Estoque e IA; `RebanhoContent.tsx` `RebSub` += `"custo"`, rotear `aba === "custo"` → `<CustoProducaoTab/>`.
- [ ] **Step 4: Smoke + verificação** — `render.test.ts`: caso `CustoProducaoTab` (loading shell) + estende sidebar smoke com "Custo". `pnpm --filter rionovo-client build` + `test` verdes; `pnpm --filter rionovo-server test` verde.
- [ ] **Step 5: Commit** — `feat(rebanho): aba Custo de Produção (custeio real + transparência do custo/litro)`.

---

## Verificação final (controller, navegador)
- Item **Custo** no grupo REBANHO.
- Custeio do leite real (valor na casa dos milhões, do `Lancamento`) + quebra por categoria (Ração, Pessoal, Medicamento…).
- Custo vaca/dia real ao lado.
- Card de transparência explicando o custo/litro pendente (escala). Sem número quebrado.

## Self-review
- Cobertura: motor `quebrarPorCategoria` (T1) + service/endpoint (T1) + aba/nav (T2). Sem mudança de schema. ✓
- Tipos `ItemCusto/QuebraCusto`, `CustoProducao`, `RebSub`+`custo` consistentes. Sem placeholders de lógica.

## Decisões deferidas
- Produção em escala real (destrava custo/litro) · reclassificar "Animal Aquisição" · período selecionável na UI · apontar KPI do dashboard financeiro pra cá · multi-tenant.
