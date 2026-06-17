# Fatia 18 — Custo de sanidade por rateio — Implementation Plan

> **For agentic workers:** Tasks 1–2 backend (motor puro + service + API). Task 3 UI (subagente-friendly). Steps com checkbox.

**Goal:** Ratear o gasto real "Medicamento Animal" (Lancamento) pelas aplicações reais (EventoSanitario APLICACAO) → custo de sanidade estimado por animal/período, na aba Custo.

**Architecture:** Motor puro `ratearCustoSanidade` + service `agregarCustoSanidade` (Lancamento + EventoSanitario) → `GET /rebanho/custo-sanidade` → seção na CustoProducaoTab.

## Global Constraints
- `custoPorAplicacao = totalMedicamento / totalAplicacoes`; por animal = n × custoPorAplicacao. Janela 12m default. Divisão por zero → 0.
- `totalMedicamento` = Σ Lancamento (categoria "Medicamento Animal", LIQUIDADO, DEBITO, dataLiquidacao ≥ desde). Aplicações = EventoSanitario tipo APLICACAO, data ≥ desde.
- Rotular como **estimativa por volume** (sem custo por produto). Server ESM (`.js`), PT-BR. Sem mudança de schema.

---

### Task 1: Motor puro + service `custo-sanidade.ts` (TDD)

**Files:** Create `server/src/services/rebanho/custo-sanidade.ts`, `server/src/services/rebanho/custo-sanidade.test.ts`.

- [ ] **Step 1: teste** `custo-sanidade.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ratearCustoSanidade } from "./custo-sanidade.js";

describe("ratearCustoSanidade", () => {
  it("rateia por volume e ordena por custo desc", () => {
    const r = ratearCustoSanidade(1000, [{ numero: "1", nome: "A", n: 3 }, { numero: "2", nome: "B", n: 1 }]);
    expect(r.totalAplicacoes).toBe(4);
    expect(r.custoPorAplicacao).toBe(250);
    expect(r.animais[0]).toEqual({ numero: "1", nome: "A", n: 3, custoEstimado: 750 });
    expect(r.animais[1].custoEstimado).toBe(250);
  });
  it("zero aplicações → custoPorAplicacao 0, sem divisão por zero", () => {
    const r = ratearCustoSanidade(1000, []);
    expect(r.custoPorAplicacao).toBe(0);
    expect(r.animais).toEqual([]);
  });
});
```

- [ ] **Step 2: rodar e ver falhar** — `pnpm --filter rionovo-server test -- custo-sanidade` → FAIL.

- [ ] **Step 3: implementar** `custo-sanidade.ts`:
```ts
import { prisma } from "../../db.js";

export interface AnimalAplic { numero: string; nome: string; n: number; }
export function ratearCustoSanidade(totalMedicamento: number, porAnimal: AnimalAplic[]) {
  const totalAplicacoes = porAnimal.reduce((s, a) => s + a.n, 0);
  const custoPorAplicacao = totalAplicacoes > 0 ? Math.round((totalMedicamento / totalAplicacoes) * 100) / 100 : 0;
  const animais = porAnimal
    .map((a) => ({ ...a, custoEstimado: Math.round(a.n * custoPorAplicacao * 100) / 100 }))
    .sort((x, y) => y.custoEstimado - x.custoEstimado);
  return { totalAplicacoes, custoPorAplicacao, animais };
}

const toNum = (x: any) => (x != null ? Number(x) : 0);
export async function agregarCustoSanidade(meses = 12) {
  const desde = new Date();
  desde.setMonth(desde.getMonth() - meses);
  // gasto real "Medicamento Animal"
  const lancs = await prisma.lancamento.findMany({
    where: { situacao: "LIQUIDADO", natureza: "DEBITO", dataLiquidacao: { not: null, gte: desde }, categoria: { nome: "Medicamento Animal" } },
    select: { valor: true },
  });
  const totalMedicamento = Math.round(lancs.reduce((s, l) => s + toNum(l.valor), 0) * 100) / 100;
  // aplicações por animal
  const aplics = await prisma.eventoSanitario.findMany({
    where: { tipo: "APLICACAO", data: { gte: desde } },
    select: { produto: true, animal: { select: { numero: true, nome: true } } },
  });
  const porAnimalMap = new Map<string, { numero: string; nome: string; n: number }>();
  const porProduto = new Map<string, number>();
  for (const a of aplics) {
    const num = a.animal.numero;
    const cur = porAnimalMap.get(num) ?? { numero: num, nome: a.animal.nome ?? num, n: 0 };
    cur.n++; porAnimalMap.set(num, cur);
    if (a.produto) porProduto.set(a.produto, (porProduto.get(a.produto) ?? 0) + 1);
  }
  const rateio = ratearCustoSanidade(totalMedicamento, [...porAnimalMap.values()]);
  const topProdutos = [...porProduto.entries()].map(([produto, n]) => ({ produto, n })).sort((a, b) => b.n - a.n).slice(0, 8);
  return {
    periodoMeses: meses,
    totalMedicamento,
    totalAplicacoes: rateio.totalAplicacoes,
    custoPorAplicacao: rateio.custoPorAplicacao,
    topAnimais: rateio.animais.slice(0, 10),
    topProdutos,
    nota: "Estimativa por volume: gasto real de Medicamento Animal ÷ nº de aplicações. Não pondera custo por produto (o Ideagri não tem custo por produto preenchido).",
  };
}
```

- [ ] **Step 4: rodar e ver passar** — `pnpm --filter rionovo-server test -- custo-sanidade` → PASS.

- [ ] **Step 5: commit** — `feat(rebanho): motor de custo de sanidade por rateio (TDD)`.

### Task 2: API `GET /rebanho/custo-sanidade`

**Files:** Create `server/src/routes/rebanho/custo-sanidade.ts`; Modify `server/src/index.ts`.

- [ ] **Step 1:** rota (espelha `custo-producao.ts`):
```ts
import { Hono } from "hono";
import { agregarCustoSanidade } from "../../services/rebanho/custo-sanidade.js";
export const custoSanidadeRouter = new Hono().get("/rebanho/custo-sanidade", async (c) => {
  const meses = Number(c.req.query("meses") ?? 12);
  return c.json(await agregarCustoSanidade(Number.isFinite(meses) && meses > 0 ? meses : 12));
});
```
- [ ] **Step 2:** em `index.ts`, importar e `app.route("/api", custoSanidadeRouter)` (junto dos outros routers rebanho).
- [ ] **Step 3:** build server + smoke: `curl /api/rebanho/custo-sanidade` → totalMedicamento ~299820, totalAplicacoes ~3153, custoPorAplicacao ~95, topAnimais/topProdutos preenchidos.
- [ ] **Step 4: commit** — `feat(rebanho): GET /rebanho/custo-sanidade`.

### Task 3: UI — seção "Custo de sanidade" na aba Custo (subagente-friendly)

**Files:** Modify `client/src/rebanho/api.ts` (interface + `useCustoSanidade`), `client/src/rebanho/components/CustoProducaoTab.tsx`. Test: estender `client/src/rebanho/__smoke__/render.test.ts`.

**Interfaces:**
- Consome: `GET /rebanho/custo-sanidade` → `{ periodoMeses, totalMedicamento, totalAplicacoes, custoPorAplicacao, topAnimais: {numero,nome,n,custoEstimado}[], topProdutos: {produto,n}[], nota }`.

- [ ] **Step 1:** em `api.ts`, `interface CustoSanidade {...}` + `obterCustoSanidade`/`useCustoSanidade(meses=12)` espelhando `useCustoProducao`.
- [ ] **Step 2:** em `CustoProducaoTab.tsx`, abaixo do conteúdo atual, nova seção `<h2 className="rb-sec-title">Custo de sanidade (estimado)</h2>` com `useCustoSanidade(12)`:
  - `rb-kstrip` 3 cols: "Gasto Medicamento (real)" `{money(totalMedicamento)}`, "Aplicações" `{totalAplicacoes}`, "R$ / aplicação" `{money(custoPorAplicacao)}`.
  - Tabela ranking `topAnimais`: nome (#numero) · nº aplicações · custo estimado (barra `width: custoEstimado/maxCusto*100%`, `var(--leite)`).
  - Tabela `topProdutos`: produto · nº.
  - Card transparência com `{data.nota}`.
  - Tratar loading/erro como o resto do componente.
- [ ] **Step 3:** smoke em `render.test.ts` — CustoProducaoTab contém "Custo de sanidade".
- [ ] **Step 4:** client build + test verdes.
- [ ] **Step 5: commit** — `feat(rebanho): seção Custo de sanidade na aba Custo`.

---

## Verificação final (controller, navegador)
- Aba **Custo** → seção "Custo de sanidade": Gasto Medicamento ~R$ 300k, ~3.153 aplicações, ~R$ 95/aplic; ranking de animais por custo; top produtos (Lactotropin); card de transparência.
- PR, merge, sync, catalogar + memória.

## Self-review
- Cobertura: §2 método→T1; §3 API→T2, UI→T3; §4→final. Tipos: `topAnimais`/`topProdutos` consistentes client/server. Sem placeholders. ✓

## Deferido
- Custo por produto exato (Cadastros); custo no cockpit; separar bST; pesagens; qualidade do leite; reclassificação.
