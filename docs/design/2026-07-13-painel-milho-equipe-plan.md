# Painel de visão geral — Milho (cultivo) + Equipe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar um painel de visão geral próprio (faixa de KPIs · banda de insight da IA · grid de domínios · rail de alerta) aos módulos **Milho (cultivo)** e **Equipe & Ponto**, no mesmo molde de Rebanho/Plantio/Corte, e fazer os dois módulos abrirem nesse painel.

**Architecture:** Backend-computado estilo Corte — rota fina (`GET /api/cultivo/dashboard`, `GET /api/ponto/dashboard`) → service loader (lê read-models escopados por propriedade, converte Decimal→number na borda) → agregação **pura** testada (`*.agg.ts`) que devolve o triplo `{ k, dominios, alertas }`. No cliente, cada módulo ganha um `useDashboard()` + `DashboardView.tsx` copiado do Corte, com banda de insight mock (paridade total). A navegação ganha uma sub-aba "Painel" e os dois módulos passam a abrir nela.

**Tech Stack:** Hono + Prisma 6 + Zod (server) · React 18 + Vite + TS + Tailwind v4 + shadcn (client) · Vitest nos dois workspaces.

**Spec:** [docs/design/2026-07-13-painel-milho-equipe-design.md](2026-07-13-painel-milho-equipe-design.md)

**Branch:** `feat/painel-milho-equipe` (já criada off `origin/main`; spec commitada em `9e98287`).

## Global Constraints

Toda task herda estas regras (copiadas do CLAUDE.md e da spec):

- **Server ESM:** imports relativos de `.ts` terminam em `.js` (ex.: `import { prisma } from "../../db.js"`). Node ESM exige.
- **Client imports relativos SEM extensão** (Vite bundler resolution). Alias `@/` = `client/src/`.
- **Decimal → number na borda:** nunca tratar `Prisma.Decimal` como `number` cru; converter com `Number(...)` no loader antes de entregar à agregação pura.
- **Escopo de propriedade:** rotas de leitura resolvem `resolverEscopoLeitura(c)` (`number | null`; `null` = consolidado). Services espalham `...(propriedadeId != null ? { propriedadeId } : {})` no `where`.
- **Client fetch:** SEMPRE via `comPropriedade(headers)` — já embutido no helper `req<T>` de cada `api.ts` de módulo. Reusar `req`.
- **PT-BR** em identificadores de domínio e textos ao usuário.
- **Sem `.md` de doc extra** além deste plano e da spec.
- **Gate de saída (roda no fim, Task 9):** `tsc` limpo nos dois workspaces · `pnpm --filter rionovo-client run test` (hoje 166 verdes) · `pnpm --filter rionovo-server run test` · `pnpm build` · conferência no navegador.

---

## File Structure

**Novos (server):**
- `server/src/services/cultivo/dashboard.agg.ts` — agregação pura do painel do milho.
- `server/src/services/cultivo/dashboard.agg.test.ts` — testes da agregação.
- `server/src/services/cultivo/dashboard.ts` — loader Prisma (lê safras+silos escopados).
- `server/src/routes/cultivo/dashboard.ts` — rota fina.
- `server/src/services/ponto/dashboard.agg.ts` — agregação pura do painel da equipe.
- `server/src/services/ponto/dashboard.agg.test.ts` — testes da agregação.
- `server/src/services/ponto/dashboard.ts` — loader (compõe funcionários+custo MO+folha) + `mesCorrente()`.
- `server/src/routes/ponto/dashboard.ts` — rota fina.

**Novos (client):**
- `client/src/cultivo/mock/insight.ts` — tipo `IaInsight` mínimo + `insightDoMilho()`.
- `client/src/cultivo/components/IaInsight.tsx` — `IaInsightBand` + `Enfase`.
- `client/src/cultivo/components/DashboardView.tsx` — painel do milho.
- `client/src/equipe/mock/insight.ts` — tipo `IaInsight` mínimo + `insightDaEquipe()`.
- `client/src/equipe/components/IaInsight.tsx` — `IaInsightBand` + `Enfase`.
- `client/src/equipe/components/DashboardView.tsx` — painel da equipe.
- `client/src/equipe/__smoke__/render.test.ts` — smoke SSR do módulo Equipe.

**Editados (server):**
- `server/src/index.ts` — importa e monta 2 routers.

**Editados (client):**
- `client/src/cultivo/api.ts` · `client/src/equipe/api.ts` — `DashboardXxx` + `obterDashboard` + `useDashboard`.
- `client/src/cultivo/CultivoContent.tsx` · `client/src/equipe/EquipeContent.tsx` — branch "dashboard".
- `client/src/components/Shell.tsx` — união `Tab`.
- `client/src/App.tsx` — mapas `MIL`/`EQP`.
- `client/src/router.ts` — `MODULO_BASE` (abrem no painel).
- `client/src/components/AppSidebar.tsx` — ícones + subs "Painel".
- `client/src/lib/searchIndex.ts` — 2 comandos + curadoria.
- `client/src/cultivo/__smoke__/render.test.ts` — `+ "dashboard"`.
- `client/src/plantio/components/DashboardView.tsx` · `client/src/corte/components/DashboardView.tsx` — eyebrow (item 4).

---

## Task 1: Cultivo — agregação pura do dashboard (TDD)

**Files:**
- Create: `server/src/services/cultivo/dashboard.agg.ts`
- Test: `server/src/services/cultivo/dashboard.agg.test.ts`

**Interfaces:**
- Produces: `agregarDashboardCultivo(safras: SafraCultivoAgg[], silos: SiloAgg[]): DashboardCultivoDTO`; e os tipos `ResumoCultivoAgg`, `SafraCultivoAgg`, `SiloAgg`, `DashboardCultivoDTO`.
- Consumes: nada (pura).

- [ ] **Step 1: Write the failing test**

Create `server/src/services/cultivo/dashboard.agg.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  agregarDashboardCultivo,
  type SafraCultivoAgg,
  type SiloAgg,
  type ResumoCultivoAgg,
} from "./dashboard.agg.js";

const resumo = (over: Partial<ResumoCultivoAgg> = {}): ResumoCultivoAgg => ({
  areaHa: 0,
  producaoGraoSc: 0,
  producaoSilagemTon: 0,
  custeioTotal: 0,
  investimentoTotal: 0,
  custoSaca: null,
  ...over,
});

describe("agregarDashboardCultivo", () => {
  it("soma read-models e conta safras ativas/fechadas", () => {
    const safras: SafraCultivoAgg[] = [
      { fechada: false, resumo: resumo({ areaHa: 10, producaoGraoSc: 100, custeioTotal: 5000, custoSaca: 50 }) },
      { fechada: true, resumo: resumo({ areaHa: 20, producaoGraoSc: 300, custeioTotal: 12000, custoSaca: 40 }) },
    ];
    const d = agregarDashboardCultivo(safras, []);
    expect(d.k.safrasAtivas).toBe(1);
    expect(d.k.safrasFechadas).toBe(1);
    expect(d.k.areaHa).toBe(30);
    expect(d.k.producaoGraoSc).toBe(400);
    expect(d.k.custeioTotal).toBe(17000);
    // custo/saca médio ponderado = custeio ÷ produção grão = 17000 / 400 = 42.5
    expect(d.k.custoSacaMedio).toBe(42.5);
  });

  it("custoSacaMedio é null quando não há produção de grão", () => {
    const safras: SafraCultivoAgg[] = [{ fechada: false, resumo: resumo({ producaoSilagemTon: 50 }) }];
    const d = agregarDashboardCultivo(safras, []);
    expect(d.k.custoSacaMedio).toBeNull();
  });

  it("ocupação de silo e alerta > 90%", () => {
    const silos: SiloAgg[] = [
      { saldoAtual: 95, capacidade: 100, ativo: true }, // 95% → alerta
      { saldoAtual: 50, capacidade: 100, ativo: true }, // 50%
    ];
    const d = agregarDashboardCultivo([], silos);
    expect(d.k.silosAtivos).toBe(2);
    expect(d.k.siloSaldoTotal).toBe(145);
    expect(d.k.siloOcupacaoPct).toBe(72.5); // 145/200
    const alSilo = d.alertas.find((a) => a.tab === "mil-silos")!;
    expect(alSilo.n).toBe(1);
  });

  it("siloOcupacaoPct é null sem capacidade cadastrada", () => {
    const d = agregarDashboardCultivo([], [{ saldoAtual: 30, capacidade: null, ativo: true }]);
    expect(d.k.siloOcupacaoPct).toBeNull();
  });

  it("alerta de safra ativa sem produção", () => {
    const safras: SafraCultivoAgg[] = [
      { fechada: false, resumo: resumo({ producaoGraoSc: 0, producaoSilagemTon: 0 }) },
      { fechada: false, resumo: resumo({ producaoGraoSc: 10 }) },
    ];
    const d = agregarDashboardCultivo(safras, []);
    const al = d.alertas.find((a) => a.tab === "mil-producao")!;
    expect(al.n).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter rionovo-server exec vitest run src/services/cultivo/dashboard.agg.test.ts`
Expected: FAIL — `Cannot find module './dashboard.agg.js'` (arquivo ainda não existe).

- [ ] **Step 3: Write minimal implementation**

Create `server/src/services/cultivo/dashboard.agg.ts`:

```ts
/* Agregação PURA do dashboard do Milho (cultivo) — rollup dos read-models
 * ResumoSafraCultivo + Silo. Sem Prisma: recebe números já convertidos na borda
 * (o loader dashboard.ts faz Number() dos Decimals). Testável isoladamente.
 *
 * Espelha a forma do dashboard do Corte: devolve o triplo { k, dominios, alertas }
 * que o DashboardView do cliente consome. `tab` dos domínios/alertas usa o prefixo
 * mil-* (a sub-aba de destino no módulo). */

export interface ResumoCultivoAgg {
  areaHa: number;
  producaoGraoSc: number;
  producaoSilagemTon: number;
  custeioTotal: number;
  investimentoTotal: number;
  custoSaca: number | null;
}

export interface SafraCultivoAgg {
  fechada: boolean;
  resumo: ResumoCultivoAgg | null;
}

export interface SiloAgg {
  saldoAtual: number;
  capacidade: number | null;
  ativo: boolean;
}

export interface DashboardCultivoDTO {
  k: {
    safrasAtivas: number;
    safrasFechadas: number;
    areaHa: number;
    producaoGraoSc: number;
    producaoSilagemTon: number;
    custeioTotal: number;
    investimentoTotal: number;
    custoSacaMedio: number | null;
    silosAtivos: number;
    siloSaldoTotal: number;
    siloOcupacaoPct: number | null;
  };
  dominios: { tab: string; titulo: string; linhas: string[] }[];
  alertas: { label: string; n: number; tom?: "up" | "bad"; tab: string }[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const brInt = (n: number) => Math.round(n).toLocaleString("pt-BR");

export function agregarDashboardCultivo(safras: SafraCultivoAgg[], silos: SiloAgg[]): DashboardCultivoDTO {
  const ativas = safras.filter((s) => !s.fechada);
  const fechadas = safras.filter((s) => s.fechada);

  const sum = (sel: (r: ResumoCultivoAgg) => number) =>
    safras.reduce((a, s) => a + (s.resumo ? sel(s.resumo) : 0), 0);

  const areaHa = sum((r) => r.areaHa);
  const producaoGraoSc = sum((r) => r.producaoGraoSc);
  const producaoSilagemTon = sum((r) => r.producaoSilagemTon);
  const custeioTotal = sum((r) => r.custeioTotal);
  const investimentoTotal = sum((r) => r.investimentoTotal);
  const custoSacaMedio = producaoGraoSc > 0 ? custeioTotal / producaoGraoSc : null;

  const ativos = silos.filter((s) => s.ativo);
  const siloSaldoTotal = ativos.reduce((a, s) => a + s.saldoAtual, 0);
  const capacidadeTotal = ativos.reduce((a, s) => a + (s.capacidade ?? 0), 0);
  const siloOcupacaoPct = capacidadeTotal > 0 ? (siloSaldoTotal / capacidadeTotal) * 100 : null;

  // Alertas derivados
  const safrasSemProducao = ativas.filter(
    (s) => !s.resumo || s.resumo.producaoGraoSc + s.resumo.producaoSilagemTon === 0,
  ).length;
  const silosCheios = ativos.filter(
    (s) => s.capacidade != null && s.capacidade > 0 && s.saldoAtual / s.capacidade > 0.9,
  ).length;
  const comCusto = safras.map((s) => s.resumo?.custoSaca).filter((v): v is number => v != null);
  const custoSacaMedioSafras = comCusto.length ? comCusto.reduce((a, v) => a + v, 0) / comCusto.length : 0;
  const safrasCaras = comCusto.filter((v) => v > custoSacaMedioSafras).length;

  return {
    k: {
      safrasAtivas: ativas.length,
      safrasFechadas: fechadas.length,
      areaHa: round2(areaHa),
      producaoGraoSc: round1(producaoGraoSc),
      producaoSilagemTon: round1(producaoSilagemTon),
      custeioTotal: Math.round(custeioTotal),
      investimentoTotal: Math.round(investimentoTotal),
      custoSacaMedio: custoSacaMedio != null ? round2(custoSacaMedio) : null,
      silosAtivos: ativos.length,
      siloSaldoTotal: round1(siloSaldoTotal),
      siloOcupacaoPct: siloOcupacaoPct != null ? round1(siloOcupacaoPct) : null,
    },
    dominios: [
      {
        tab: "mil-safras",
        titulo: "Safras",
        linhas: [`${ativas.length} safras ativas · ${fechadas.length} fechadas`, `${round2(areaHa)} ha em cultivo`],
      },
      {
        tab: "mil-producao",
        titulo: "Produção",
        linhas: [`${round1(producaoGraoSc)} sc de grão`, `${round1(producaoSilagemTon)} t de silagem`],
      },
      {
        tab: "mil-silos",
        titulo: "Silos",
        linhas: [
          `${ativos.length} silos ativos · ${round1(siloSaldoTotal)} em estoque`,
          siloOcupacaoPct != null ? `Ocupação média ${round1(siloOcupacaoPct)}%` : "Sem capacidade cadastrada",
        ],
      },
      {
        tab: "mil-custo",
        titulo: "Custo de produção",
        linhas: [
          custoSacaMedio != null ? `Custo médio R$ ${round2(custoSacaMedio)}/sc` : "Sem produção de grão lançada",
          `Custeio total R$ ${brInt(custeioTotal)}`,
        ],
      },
    ],
    alertas: [
      { label: "Safras ativas sem produção", n: safrasSemProducao, tom: "up", tab: "mil-producao" },
      { label: "Silos acima de 90%", n: silosCheios, tom: "bad", tab: "mil-silos" },
      { label: "Safras com custo/saca acima da média", n: safrasCaras, tom: "up", tab: "mil-custo" },
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter rionovo-server exec vitest run src/services/cultivo/dashboard.agg.test.ts`
Expected: PASS (5 testes verdes).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/cultivo/dashboard.agg.ts server/src/services/cultivo/dashboard.agg.test.ts
git commit -m "feat(cultivo): agregação pura do dashboard do milho"
```

---

## Task 2: Cultivo — loader + rota + montagem

**Files:**
- Create: `server/src/services/cultivo/dashboard.ts`
- Create: `server/src/routes/cultivo/dashboard.ts`
- Modify: `server/src/index.ts` (import + `app.route`)

**Interfaces:**
- Consumes: `agregarDashboardCultivo`, `SafraCultivoAgg`, `SiloAgg` (Task 1); `prisma` (`server/src/db.js`); `resolverEscopoLeitura` (`server/src/services/propriedade.js`).
- Produces: `buildCultivoDashboard(propriedadeId?: number | null): Promise<DashboardCultivoDTO>`; `cultivoDashboardRouter` (Hono); endpoint `GET /api/cultivo/dashboard`.

- [ ] **Step 1: Write the loader**

Create `server/src/services/cultivo/dashboard.ts`:

```ts
/* Loader do dashboard do Milho — lê os read-models escopados por propriedade
 * (SafraCultivo + ResumoSafraCultivo embutido; Silo ativo), converte Decimal→
 * number na borda e delega à agregação pura. Espelha buildCorteDashboard. */
import { prisma } from "../../db.js";
import { agregarDashboardCultivo, type SafraCultivoAgg, type SiloAgg } from "./dashboard.agg.js";

export async function buildCultivoDashboard(propriedadeId?: number | null) {
  const escopo = propriedadeId != null ? { propriedadeId } : {}; // escopo do sítio
  const [safras, silos] = await Promise.all([
    prisma.safraCultivo.findMany({ where: escopo, include: { resumo: true } }),
    prisma.silo.findMany({ where: { ...escopo, ativo: true } }),
  ]);

  const safrasAgg: SafraCultivoAgg[] = safras.map((s) => ({
    fechada: s.fechada,
    resumo: s.resumo
      ? {
          areaHa: Number(s.resumo.areaHa),
          producaoGraoSc: Number(s.resumo.producaoGraoSc),
          producaoSilagemTon: Number(s.resumo.producaoSilagemTon),
          custeioTotal: Number(s.resumo.custeioTotal),
          investimentoTotal: Number(s.resumo.investimentoTotal),
          custoSaca: s.resumo.custoSaca != null ? Number(s.resumo.custoSaca) : null,
        }
      : null,
  }));

  const silosAgg: SiloAgg[] = silos.map((s) => ({
    saldoAtual: Number(s.saldoAtual),
    capacidade: s.capacidade != null ? Number(s.capacidade) : null,
    ativo: s.ativo,
  }));

  return agregarDashboardCultivo(safrasAgg, silosAgg);
}
```

- [ ] **Step 2: Write the route**

Create `server/src/routes/cultivo/dashboard.ts`:

```ts
import { Hono } from "hono";
import { buildCultivoDashboard } from "../../services/cultivo/dashboard.js";
import { resolverEscopoLeitura } from "../../services/propriedade.js";

export const cultivoDashboardRouter = new Hono()
  .get("/cultivo/dashboard", async (c) => c.json(await buildCultivoDashboard(await resolverEscopoLeitura(c))));
```

- [ ] **Step 3: Mount the router in index.ts**

In `server/src/index.ts`, add the import right after the line `import { cultivoSilosRouter } from "./routes/cultivo/silos.js";`:

```ts
import { cultivoDashboardRouter } from "./routes/cultivo/dashboard.js";
```

And add the mount right after the line `app.route("/api", cultivoSilosRouter);`:

```ts
app.route("/api", cultivoDashboardRouter);
```

- [ ] **Step 4: Verify server type-checks + tests stay green**

Run: `pnpm --filter rionovo-server exec tsc --noEmit`
Expected: no errors.

Run: `pnpm --filter rionovo-server run test`
Expected: PASS (todos os testes do server, incluindo o novo `dashboard.agg.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/cultivo/dashboard.ts server/src/routes/cultivo/dashboard.ts server/src/index.ts
git commit -m "feat(cultivo): endpoint GET /api/cultivo/dashboard escopado"
```

---

## Task 3: Ponto — agregação pura do dashboard (TDD)

**Files:**
- Create: `server/src/services/ponto/dashboard.agg.ts`
- Test: `server/src/services/ponto/dashboard.agg.test.ts`

**Interfaces:**
- Consumes (type-only): `CustoMOSetor` (`server/src/services/ponto/custoMOSetor.js`, já exportado); `FolhaDTO` (`server/src/services/ponto/folha.service.js`, já exportado).
- Produces: `agregarDashboardPonto(input): DashboardPontoDTO`; tipo `DashboardPontoDTO`.

- [ ] **Step 1: Write the failing test**

Create `server/src/services/ponto/dashboard.agg.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { agregarDashboardPonto } from "./dashboard.agg.js";
import type { FolhaDTO } from "./folha.service.js";
import type { CustoMOSetor } from "./custoMOSetor.js";

const linha = (over: Partial<FolhaDTO["linhas"][number]> = {}): FolhaDTO["linhas"][number] => ({
  funcionarioId: "1",
  nome: "F",
  cargo: null,
  salarioMensal: 2000,
  valorHora: 10,
  diasTrabalhados: 20,
  totalHoras: 160,
  horasNormais: 160,
  extra50: 0,
  extra100: 0,
  valorExtra: 0,
  totalPagar: 2000,
  ...over,
});

const folha = (linhas: FolhaDTO["linhas"], totais?: Partial<FolhaDTO["totais"]>): FolhaDTO => ({
  mes: "2026-05",
  linhas,
  totais: { salarios: 0, valorExtra: 0, totalPagar: 0, totalHoras: 0, ...totais },
});

describe("agregarDashboardPonto", () => {
  it("compõe KPIs de quadro, custo e folha", () => {
    const custoSetores: CustoMOSetor[] = [
      { setor: "Curral", totalMensal: 8000, qtd: 4 },
      { setor: "Geral", totalMensal: 3000, qtd: 2 },
    ];
    const d = agregarDashboardPonto({
      mes: "2026-05",
      funcionariosAtivos: 6,
      custoSetores,
      folha: folha([linha()], { salarios: 12000, valorExtra: 500, totalPagar: 12500, totalHoras: 1000 }),
    });
    expect(d.k.mes).toBe("2026-05");
    expect(d.k.funcionariosAtivos).toBe(6);
    expect(d.k.setores).toBe(2);
    expect(d.k.custoMOMes).toBe(11000);
    expect(d.k.folhaTotalPagar).toBe(12500);
    expect(d.k.maiorSetor).toEqual({ nome: "Curral", total: 8000, qtd: 4 });
  });

  it("alerta 'sem ponto' conta linhas com diasTrabalhados 0", () => {
    const d = agregarDashboardPonto({
      mes: "2026-05",
      funcionariosAtivos: 2,
      custoSetores: [],
      folha: folha([linha({ diasTrabalhados: 0 }), linha({ diasTrabalhados: 22 })]),
    });
    const al = d.alertas.find((a) => a.tab === "eqp-ponto")!;
    expect(al.n).toBe(1);
  });

  it("alerta 'horas extras' conta linhas com extra50+extra100 > 0", () => {
    const d = agregarDashboardPonto({
      mes: "2026-05",
      funcionariosAtivos: 3,
      custoSetores: [],
      folha: folha([linha({ extra50: 5 }), linha({ extra100: 2 }), linha()]),
    });
    const al = d.alertas.find((a) => a.tab === "eqp-folha")!;
    expect(al.n).toBe(2);
  });

  it("maiorSetor é null sem setores", () => {
    const d = agregarDashboardPonto({ mes: "2026-05", funcionariosAtivos: 0, custoSetores: [], folha: folha([]) });
    expect(d.k.maiorSetor).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter rionovo-server exec vitest run src/services/ponto/dashboard.agg.test.ts`
Expected: FAIL — `Cannot find module './dashboard.agg.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `server/src/services/ponto/dashboard.agg.ts`:

```ts
/* Agregação PURA do dashboard da Equipe & Ponto — compõe a contagem de
 * funcionários ativos + o custo de MO por setor + os totais da folha do mês
 * num triplo { k, dominios, alertas }. Sem Prisma: recebe os agregados já
 * prontos (o loader dashboard.ts carrega e converte). `tab` usa o prefixo eqp-*. */
import type { CustoMOSetor } from "./custoMOSetor.js";
import type { FolhaDTO } from "./folha.service.js";

export interface DashboardPontoDTO {
  k: {
    mes: string;
    funcionariosAtivos: number;
    setores: number;
    custoMOMes: number;
    folhaTotalPagar: number;
    valorExtra: number;
    totalHoras: number;
    maiorSetor: { nome: string; total: number; qtd: number } | null;
  };
  dominios: { tab: string; titulo: string; linhas: string[] }[];
  alertas: { label: string; n: number; tom?: "up" | "bad"; tab: string }[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const brMoney = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function agregarDashboardPonto(input: {
  mes: string;
  funcionariosAtivos: number;
  custoSetores: CustoMOSetor[];
  folha: FolhaDTO;
}): DashboardPontoDTO {
  const { mes, funcionariosAtivos, custoSetores, folha } = input;

  const custoMOMes = custoSetores.reduce((a, s) => a + s.totalMensal, 0);
  const maior = custoSetores[0]
    ? { nome: custoSetores[0].setor, total: custoSetores[0].totalMensal, qtd: custoSetores[0].qtd }
    : null;

  const semPonto = folha.linhas.filter((l) => l.diasTrabalhados === 0).length;
  const comExtra = folha.linhas.filter((l) => l.extra50 + l.extra100 > 0).length;

  return {
    k: {
      mes,
      funcionariosAtivos,
      setores: custoSetores.length,
      custoMOMes: round2(custoMOMes),
      folhaTotalPagar: folha.totais.totalPagar,
      valorExtra: folha.totais.valorExtra,
      totalHoras: folha.totais.totalHoras,
      maiorSetor: maior,
    },
    dominios: [
      {
        tab: "eqp-funcionarios",
        titulo: "Funcionários",
        linhas: [
          `${funcionariosAtivos} funcionários ativos`,
          `${custoSetores.length} setores`,
          maior ? `Maior: ${maior.nome} (${maior.qtd})` : "Sem setores cadastrados",
        ],
      },
      {
        tab: "eqp-ponto",
        titulo: "Ponto",
        linhas: [`${folha.linhas.length} em apuração no mês`, `${semPonto} sem ponto lançado`],
      },
      {
        tab: "eqp-folha",
        titulo: "Folha",
        linhas: [
          `Total a pagar ${brMoney(folha.totais.totalPagar)}`,
          `Hora extra ${brMoney(folha.totais.valorExtra)} · ${round2(folha.totais.totalHoras)} h`,
        ],
      },
    ],
    alertas: [
      { label: "Sem ponto lançado no mês", n: semPonto, tom: "bad", tab: "eqp-ponto" },
      { label: "Com horas extras", n: comExtra, tom: "up", tab: "eqp-folha" },
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter rionovo-server exec vitest run src/services/ponto/dashboard.agg.test.ts`
Expected: PASS (4 testes verdes).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/ponto/dashboard.agg.ts server/src/services/ponto/dashboard.agg.test.ts
git commit -m "feat(ponto): agregação pura do dashboard da equipe"
```

---

## Task 4: Ponto — loader + rota + montagem

**Files:**
- Create: `server/src/services/ponto/dashboard.ts`
- Create: `server/src/routes/ponto/dashboard.ts`
- Modify: `server/src/index.ts` (import + `app.route`)

**Interfaces:**
- Consumes: `listarFuncionarios` (`./funcionarios.js`, assinatura `(f?: ListFuncionariosFiltros, propriedadeId?: number | null)`); `custoMOPorSetor` (`./custoMOSetor.js`, `(propriedadeId?) => Promise<CustoMOSetor[]>`); `apurarFolha` (`./folha.service.js`, `(mes, propriedadeId?) => Promise<FolhaDTO>`); `agregarDashboardPonto`, `DashboardPontoDTO` (Task 3); `resolverEscopoLeitura`.
- Produces: `mesCorrente(): string`; `buildPontoDashboard(mes: string, propriedadeId?: number | null): Promise<DashboardPontoDTO>`; `pontoDashboardRouter`; endpoint `GET /api/ponto/dashboard?mes=YYYY-MM`.

- [ ] **Step 1: Write the loader**

Create `server/src/services/ponto/dashboard.ts`:

```ts
/* Loader do dashboard da Equipe & Ponto — compõe três leituras escopadas por
 * propriedade (quadro ativo, custo de MO por setor, folha do mês) e delega à
 * agregação pura. O `mes` vem do cliente (âncora do módulo, "2026-05");
 * mesCorrente() é só o fallback server-side quando ausente. */
import { listarFuncionarios } from "./funcionarios.js";
import { custoMOPorSetor } from "./custoMOSetor.js";
import { apurarFolha } from "./folha.service.js";
import { agregarDashboardPonto, type DashboardPontoDTO } from "./dashboard.agg.js";

/** "YYYY-MM" do mês corrente (UTC). Fallback quando o cliente não manda ?mes=. */
export function mesCorrente(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function buildPontoDashboard(
  mes: string,
  propriedadeId?: number | null,
): Promise<DashboardPontoDTO> {
  const [ativos, custoSetores, folha] = await Promise.all([
    listarFuncionarios({ ativo: true }, propriedadeId),
    custoMOPorSetor(propriedadeId),
    apurarFolha(mes, propriedadeId),
  ]);
  return agregarDashboardPonto({
    mes,
    funcionariosAtivos: ativos.length,
    custoSetores,
    folha,
  });
}
```

- [ ] **Step 2: Write the route**

Create `server/src/routes/ponto/dashboard.ts`:

```ts
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { buildPontoDashboard, mesCorrente } from "../../services/ponto/dashboard.js";
import { resolverEscopoLeitura } from "../../services/propriedade.js";

// mes opcional (YYYY-MM). Ausente → mês corrente (server-side).
const querySchema = z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/, "mês deve ser YYYY-MM").optional() });

export const pontoDashboardRouter = new Hono().get(
  "/ponto/dashboard",
  zValidator("query", querySchema),
  async (c) => {
    const mes = c.req.valid("query").mes ?? mesCorrente();
    return c.json(await buildPontoDashboard(mes, await resolverEscopoLeitura(c)));
  },
);
```

- [ ] **Step 3: Mount the router in index.ts**

In `server/src/index.ts`, add the import right after the line `import { pontoRouter } from "./routes/ponto/index.js";`:

```ts
import { pontoDashboardRouter } from "./routes/ponto/dashboard.js";
```

And add the mount right after the line `app.route("/api", pontoRouter);`:

```ts
app.route("/api", pontoDashboardRouter);
```

- [ ] **Step 4: Verify server type-checks + tests green**

Run: `pnpm --filter rionovo-server exec tsc --noEmit`
Expected: no errors.

Run: `pnpm --filter rionovo-server run test`
Expected: PASS (todos, incluindo os dois novos `dashboard.agg.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/ponto/dashboard.ts server/src/routes/ponto/dashboard.ts server/src/index.ts
git commit -m "feat(ponto): endpoint GET /api/ponto/dashboard escopado"
```

---

## Task 5: Cultivo — painel no cliente (api + insight + view + dispatch + smoke)

**Files:**
- Modify: `client/src/cultivo/api.ts` (append DASHBOARD)
- Create: `client/src/cultivo/mock/insight.ts`
- Create: `client/src/cultivo/components/IaInsight.tsx`
- Create: `client/src/cultivo/components/DashboardView.tsx`
- Modify: `client/src/cultivo/CultivoContent.tsx` (`MilSub` + branch)
- Modify: `client/src/cultivo/__smoke__/render.test.ts` (`+ "dashboard"`)

**Interfaces:**
- Consumes: `req<T>` (existente em `cultivo/api.ts`); `RebHeader` (`@/rebanho/components/RebHeader`), `RebKpiStrip`/`RebKpi` (`@/components/rb/RebKpiStrip`), `RebMain` (`@/components/rb/RebPrimitives`), `RebButton` (`@/components/rb/RebButton`), `Loader` (`../../components/Loading`).
- Produces: `DashboardMilho` interface, `obterDashboard()`, `useDashboard()` (em `cultivo/api.ts`); `IaInsight` type + `insightDoMilho()` (mock); `IaInsightBand` (component); `DashboardView` ({ onNavMil }); `MilSub` ganha `"dashboard"`.

- [ ] **Step 1: Add the dashboard API to `cultivo/api.ts`**

Append at the end of `client/src/cultivo/api.ts` (after the SILOS section):

```ts
// DASHBOARD ---------------------------------------------------------------
// Espelha DashboardCultivoDTO (server/src/services/cultivo/dashboard.agg.ts).

export interface DashboardMilho {
  k: {
    safrasAtivas: number;
    safrasFechadas: number;
    areaHa: number;
    producaoGraoSc: number;
    producaoSilagemTon: number;
    custeioTotal: number;
    investimentoTotal: number;
    custoSacaMedio: number | null;
    silosAtivos: number;
    siloSaldoTotal: number;
    siloOcupacaoPct: number | null;
  };
  dominios: { tab: string; titulo: string; linhas: string[] }[];
  alertas: { label: string; n: number; tom?: "up" | "bad"; tab: string }[];
}

export const obterDashboard = () => req<DashboardMilho>(`/cultivo/dashboard`);

export function useDashboard() {
  const [data, setData] = useState<DashboardMilho | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    obterDashboard()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);
  return { data, loading };
}
```

- [ ] **Step 2: Create the mock insight `cultivo/mock/insight.ts`**

Create `client/src/cultivo/mock/insight.ts`:

```ts
/* Insight mock do painel do Milho (paridade com rebanho/plantio/corte). Estático
 * — a banda só usa `texto` e o rótulo da 1ª ação. Tipo IaInsight mínimo local. */
export interface IaInsight {
  texto: string;
  acoes?: { label: string }[];
}

export function insightDoMilho(): IaInsight {
  return {
    texto:
      "A <b>safrinha</b> está com o custeio adiantado, mas <b>sem produção de grão lançada</b> ainda — assim que a colheita entrar, o custo por saca fecha sozinho. Os silos de silagem seguem com folga pro trato da seca.",
    acoes: [{ label: "Ver custo de produção" }],
  };
}
```

- [ ] **Step 3: Create `cultivo/components/IaInsight.tsx`**

Create `client/src/cultivo/components/IaInsight.tsx`:

```tsx
import { Fragment } from "react";
import type { IaInsight } from "../mock/insight";
import { RebButton } from "@/components/rb/RebButton";

export function Enfase({ texto }: { texto: string }) {
  const partes = texto.split(/(<b>.*?<\/b>)/g);
  return (
    <>
      {partes.map((p, i) => {
        const m = p.match(/^<b>(.*?)<\/b>$/);
        return m ? <strong key={i}>{m[1]}</strong> : <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

// Banner horizontal (nível módulo) — pull-quote com border-left leite.
export function IaInsightBand({ insight }: { insight: IaInsight }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-[14px] border-l border-[color:var(--leite)] py-1 pl-[18px]">
      <div className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border border-[color:var(--leite)] font-serif text-sm font-bold text-[color:var(--leite)]">✦</div>
      <p className="m-0 font-serif text-sm italic leading-normal text-ink-2"><Enfase texto={insight.texto} /></p>
      {insight.acoes?.[0]?.label && (
        <RebButton variant="pri" className="ml-auto flex-none max-[900px]:ml-0">{insight.acoes[0].label}</RebButton>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `cultivo/components/DashboardView.tsx`**

Create `client/src/cultivo/components/DashboardView.tsx`:

```tsx
import { Loader } from "../../components/Loading";
import type { MilSub } from "../CultivoContent";
import { insightDoMilho } from "../mock/insight";
import { IaInsightBand } from "./IaInsight";
import { useDashboard } from "../api";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebMain } from "@/components/rb/RebPrimitives";

const money = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function DashboardView({ onNavMil }: { onNavMil: (s: MilSub) => void }) {
  const { data, loading } = useDashboard();
  const insight = insightDoMilho();

  // Loading shell PRECISA conter "Cultivo · milho" (o smoke test SSR só vê este estado).
  if (loading || !data) {
    return (
      <RebMain>
        <RebHeader eyebrow="Cultivo · milho" title="Painel do milho" />
        <Loader />
      </RebMain>
    );
  }
  const k = data.k;
  return (
    <RebMain>
      <RebHeader
        eyebrow={`Cultivo · milho · ${k.safrasAtivas} ${k.safrasAtivas === 1 ? "safra ativa" : "safras ativas"}`}
        title="Painel do milho"
      />

      <RebKpiStrip cols={6}>
        <RebKpi lab="Safras ativas" val={k.safrasAtivas} d={`${k.safrasFechadas} fechadas`} />
        <RebKpi lab="Área" val={k.areaHa} sufixo="ha" d="em cultivo" />
        <RebKpi lab="Grão" val={k.producaoGraoSc} sufixo="sc" d={`${k.producaoSilagemTon} t de silagem`} />
        <RebKpi lab="Custo/saca médio" val={k.custoSacaMedio != null ? money(k.custoSacaMedio) : "—"} d="custeio ÷ grão" />
        <RebKpi lab="Custeio total" val={money(k.custeioTotal)} d="lançado nas safras" />
        <RebKpi
          lab="Silos"
          val={k.silosAtivos}
          sufixo="ativos"
          d={k.siloOcupacaoPct != null ? `${k.siloOcupacaoPct}% de ocupação` : `${k.siloSaldoTotal} em estoque`}
        />
      </RebKpiStrip>

      {insight && <IaInsightBand insight={insight} />}

      <div className="mt-1.5 grid grid-cols-[1fr_320px] gap-5 max-[1100px]:grid-cols-1">
        <div className="grid grid-cols-2 gap-3 content-start max-[900px]:grid-cols-1">
          {data.dominios.map((d) => (
            <button
              key={d.tab}
              className="cursor-pointer rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-3.5 text-left font-sans hover:bg-[color:var(--bg-card-2)]"
              onClick={() => onNavMil(d.tab.replace("mil-", "") as MilSub)}
            >
              <h4 className="mb-[9px] mt-0 flex items-baseline justify-between font-serif text-[17px] font-medium">
                {d.titulo}<span className="text-sm font-semibold text-cafe">ver →</span>
              </h4>
              <ul className="m-0 list-none p-0">
                {d.linhas.map((l, i) => (
                  <li key={i} className="border-b border-dashed border-[color:var(--rule-soft)] py-1 text-sm text-ink-2 last:border-0">{l}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>
        <div className="self-start rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-3.5">
          <h4 className="mb-2 mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Alertas e oportunidades</h4>
          {data.alertas.map((al) => (
            <button
              key={al.label}
              className="flex w-full cursor-pointer items-center justify-between border-0 border-b border-[color:var(--rule-soft)] bg-transparent py-2.5 text-left font-sans text-sm text-ink-2 last:border-b-0"
              onClick={() => onNavMil(al.tab.replace("mil-", "") as MilSub)}
            >
              <span>{al.label}</span>
              <span className={"font-serif text-[21px] " + (al.n === 0 ? "text-lucro" : "text-prejuizo")}>{al.n}</span>
            </button>
          ))}
        </div>
      </div>
    </RebMain>
  );
}
```

- [ ] **Step 5: Wire the branch in `CultivoContent.tsx`**

In `client/src/cultivo/CultivoContent.tsx`:

Add the import at the top (after the other `./components/*` imports):

```tsx
import { DashboardView } from "./components/DashboardView";
```

Change the `MilSub` type to prepend `"dashboard"`:

```tsx
export type MilSub = "dashboard" | "safras" | "custos" | "producao" | "silos" | "custo";
```

Change the dispatch to add the `dashboard` branch first:

```tsx
  return (
    <div className="rb">
      {aba === "dashboard" ? (
        <DashboardView onNavMil={onNavMil} />
      ) : aba === "safras" ? (
        <SafrasTab onNavMil={onNavMil} />
      ) : aba === "custos" ? (
        <CustosTab />
      ) : aba === "producao" ? (
        <ProducaoTab />
      ) : aba === "silos" ? (
        <SilosTab />
      ) : (
        <CustoTab />
      )}
    </div>
  );
```

- [ ] **Step 6: Update the cultivo smoke test**

In `client/src/cultivo/__smoke__/render.test.ts`, change the `ABAS` line:

```ts
const ABAS: MilSub[] = ["dashboard", "safras", "custos", "producao", "silos", "custo"];
```

- [ ] **Step 7: Run the cultivo smoke test**

Run: `pnpm --filter rionovo-client exec vitest run src/cultivo/__smoke__/render.test.ts`
Expected: PASS — 6 casos (incl. `dashboard`), cada um contém `"Cultivo · milho"` (o loading shell renderiza no SSR porque `useEffect` não dispara).

- [ ] **Step 8: Commit**

```bash
git add client/src/cultivo/api.ts client/src/cultivo/mock/insight.ts client/src/cultivo/components/IaInsight.tsx client/src/cultivo/components/DashboardView.tsx client/src/cultivo/CultivoContent.tsx client/src/cultivo/__smoke__/render.test.ts
git commit -m "feat(cultivo): painel de visão geral do milho (client)"
```

---

## Task 6: Equipe — painel no cliente (api + insight + view + dispatch + smoke)

**Files:**
- Modify: `client/src/equipe/api.ts` (append DASHBOARD + `useMemo` import)
- Create: `client/src/equipe/mock/insight.ts`
- Create: `client/src/equipe/components/IaInsight.tsx`
- Create: `client/src/equipe/components/DashboardView.tsx`
- Modify: `client/src/equipe/EquipeContent.tsx` (`EqpSub` + branch)
- Create: `client/src/equipe/__smoke__/render.test.ts`

**Interfaces:**
- Consumes: `req<T>`, `qs`, `money`, `num`, `mesesRecentes` (existentes em `equipe/api.ts`); os mesmos primitivos Reb* de Task 5.
- Produces: `DashboardEquipe` interface, `obterDashboard(mes)`, `useDashboard()` (em `equipe/api.ts`); `IaInsight` type + `insightDaEquipe()`; `IaInsightBand`; `DashboardView` ({ onNavEqp }); `EqpSub` ganha `"dashboard"`.

- [ ] **Step 1: Add `useMemo` to the imports + dashboard API in `equipe/api.ts`**

In `client/src/equipe/api.ts`, change the React import line from:

```ts
import { useEffect, useState, useCallback } from "react";
```

to:

```ts
import { useEffect, useState, useCallback, useMemo } from "react";
```

Then append at the end of the file (after the FORMATADORES / CALENDÁRIO sections):

```ts
// DASHBOARD ---------------------------------------------------------------
// Espelha DashboardPontoDTO (server/src/services/ponto/dashboard.agg.ts).

export interface DashboardEquipe {
  k: {
    mes: string;
    funcionariosAtivos: number;
    setores: number;
    custoMOMes: number;
    folhaTotalPagar: number;
    valorExtra: number;
    totalHoras: number;
    maiorSetor: { nome: string; total: number; qtd: number } | null;
  };
  dominios: { tab: string; titulo: string; linhas: string[] }[];
  alertas: { label: string; n: number; tom?: "up" | "bad"; tab: string }[];
}

export const obterDashboard = (mes: string) => req<DashboardEquipe>(`/ponto/dashboard${qs({ mes })}`);

// Usa a mesma âncora dos outros módulos: mesesRecentes(1)[0] = "2026-05".
export function useDashboard() {
  const mes = useMemo(() => mesesRecentes(1)[0], []);
  const [data, setData] = useState<DashboardEquipe | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    obterDashboard(mes)
      .then((d) => { if (!cancelado) setData(d); })
      .catch(() => { if (!cancelado) setData(null); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [mes]);
  return { data, loading };
}
```

- [ ] **Step 2: Create `equipe/mock/insight.ts`**

Create `client/src/equipe/mock/insight.ts`:

```ts
/* Insight mock do painel da Equipe (paridade com os outros módulos). Estático —
 * a banda só usa `texto` e o rótulo da 1ª ação. Tipo IaInsight mínimo local. */
export interface IaInsight {
  texto: string;
  acoes?: { label: string }[];
}

export function insightDaEquipe(): IaInsight {
  return {
    texto:
      "A folha do mês fechou com <b>horas extras concentradas em poucos setores</b> — vale revisar a escala antes que o extra vire recorrente. A maioria do quadro já está com <b>ponto lançado</b>, mas confira os que ainda estão sem apuração.",
    acoes: [{ label: "Abrir folha do mês" }],
  };
}
```

- [ ] **Step 3: Create `equipe/components/IaInsight.tsx`**

Create `client/src/equipe/components/IaInsight.tsx`:

```tsx
import { Fragment } from "react";
import type { IaInsight } from "../mock/insight";
import { RebButton } from "@/components/rb/RebButton";

export function Enfase({ texto }: { texto: string }) {
  const partes = texto.split(/(<b>.*?<\/b>)/g);
  return (
    <>
      {partes.map((p, i) => {
        const m = p.match(/^<b>(.*?)<\/b>$/);
        return m ? <strong key={i}>{m[1]}</strong> : <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

// Banner horizontal (nível módulo) — pull-quote com border-left leite.
export function IaInsightBand({ insight }: { insight: IaInsight }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-[14px] border-l border-[color:var(--leite)] py-1 pl-[18px]">
      <div className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border border-[color:var(--leite)] font-serif text-sm font-bold text-[color:var(--leite)]">✦</div>
      <p className="m-0 font-serif text-sm italic leading-normal text-ink-2"><Enfase texto={insight.texto} /></p>
      {insight.acoes?.[0]?.label && (
        <RebButton variant="pri" className="ml-auto flex-none max-[900px]:ml-0">{insight.acoes[0].label}</RebButton>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `equipe/components/DashboardView.tsx`**

Create `client/src/equipe/components/DashboardView.tsx`:

```tsx
import { Loader } from "../../components/Loading";
import type { EqpSub } from "../EquipeContent";
import { insightDaEquipe } from "../mock/insight";
import { IaInsightBand } from "./IaInsight";
import { useDashboard, money, num } from "../api";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebMain } from "@/components/rb/RebPrimitives";

export function DashboardView({ onNavEqp }: { onNavEqp: (s: EqpSub) => void }) {
  const { data, loading } = useDashboard();
  const insight = insightDaEquipe();

  // Loading shell PRECISA conter "Equipe ·" (o smoke test SSR só vê este estado).
  if (loading || !data) {
    return (
      <RebMain>
        <RebHeader eyebrow="Equipe · Painel" title="Painel da equipe" />
        <Loader />
      </RebMain>
    );
  }
  const k = data.k;
  return (
    <RebMain>
      <RebHeader
        eyebrow={`Equipe · Painel · ${k.funcionariosAtivos} ${k.funcionariosAtivos === 1 ? "ativo" : "ativos"}`}
        title="Painel da equipe"
      />

      <RebKpiStrip cols={6}>
        <RebKpi lab="Ativos" val={k.funcionariosAtivos} d={`${k.setores} setores`} />
        <RebKpi lab="Custo de MO/mês" val={money(k.custoMOMes)} d="salários do quadro ativo" />
        <RebKpi lab="Folha a pagar" val={money(k.folhaTotalPagar)} d="salários + extras" />
        <RebKpi lab="Hora extra" val={money(k.valorExtra)} d="no mês" />
        <RebKpi lab="Horas apuradas" val={num(k.totalHoras, 0)} sufixo="h" d="total trabalhado" />
        <RebKpi
          lab="Maior setor"
          val={k.maiorSetor ? k.maiorSetor.nome : "—"}
          d={k.maiorSetor ? `${k.maiorSetor.qtd} pessoas` : "sem setores"}
        />
      </RebKpiStrip>

      {insight && <IaInsightBand insight={insight} />}

      <div className="mt-1.5 grid grid-cols-[1fr_320px] gap-5 max-[1100px]:grid-cols-1">
        <div className="grid grid-cols-2 gap-3 content-start max-[900px]:grid-cols-1">
          {data.dominios.map((d) => (
            <button
              key={d.tab}
              className="cursor-pointer rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-3.5 text-left font-sans hover:bg-[color:var(--bg-card-2)]"
              onClick={() => onNavEqp(d.tab.replace("eqp-", "") as EqpSub)}
            >
              <h4 className="mb-[9px] mt-0 flex items-baseline justify-between font-serif text-[17px] font-medium">
                {d.titulo}<span className="text-sm font-semibold text-cafe">ver →</span>
              </h4>
              <ul className="m-0 list-none p-0">
                {d.linhas.map((l, i) => (
                  <li key={i} className="border-b border-dashed border-[color:var(--rule-soft)] py-1 text-sm text-ink-2 last:border-0">{l}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>
        <div className="self-start rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-3.5">
          <h4 className="mb-2 mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Alertas e oportunidades</h4>
          {data.alertas.map((al) => (
            <button
              key={al.label}
              className="flex w-full cursor-pointer items-center justify-between border-0 border-b border-[color:var(--rule-soft)] bg-transparent py-2.5 text-left font-sans text-sm text-ink-2 last:border-b-0"
              onClick={() => onNavEqp(al.tab.replace("eqp-", "") as EqpSub)}
            >
              <span>{al.label}</span>
              <span className={"font-serif text-[21px] " + (al.n === 0 ? "text-lucro" : "text-prejuizo")}>{al.n}</span>
            </button>
          ))}
        </div>
      </div>
    </RebMain>
  );
}
```

- [ ] **Step 5: Wire the branch in `EquipeContent.tsx`**

Replace the full contents of `client/src/equipe/EquipeContent.tsx` with:

```tsx
import { FuncionariosTab } from "./components/FuncionariosTab";
import { PontoTab } from "./components/PontoTab";
import { FolhaTab } from "./components/FolhaTab";
import { DashboardView } from "./components/DashboardView";

export type EqpSub = "dashboard" | "funcionarios" | "ponto" | "folha";

/* Roteia as 4 sub-abas do módulo Equipe & Ponto (espelha CultivoContent).
 * onNavEqp permite navegar entre as abas (usado pelo painel). */
export function EquipeContent({ aba, onNavEqp }: { aba: EqpSub; onNavEqp?: (aba: EqpSub) => void }) {
  return (
    <div className="rb">
      {aba === "dashboard"
        ? <DashboardView onNavEqp={onNavEqp ?? (() => {})} />
        : aba === "ponto"
          ? <PontoTab />
          : aba === "folha"
            ? <FolhaTab />
            : <FuncionariosTab />}
    </div>
  );
}
```

- [ ] **Step 6: Create the equipe smoke test**

Create `client/src/equipe/__smoke__/render.test.ts`:

```ts
// Render smoke do módulo Equipe & Ponto — espelha cultivo/__smoke__: pega erros
// de runtime que tsc/build não pegam. Usa react-dom/server (sem DOM); hooks de
// fetch não disparam no SSR (useEffect), então cada tab renderiza o shell de
// carregando — todas com o eyebrow "Equipe · …".
import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { EquipeContent, type EqpSub } from "../EquipeContent";

const ABAS: EqpSub[] = ["dashboard", "funcionarios", "ponto", "folha"];

describe("equipe render smoke", () => {
  for (const aba of ABAS) {
    it(`EquipeContent renderiza a sub-aba ${aba}`, () => {
      const html = renderToString(h(EquipeContent, { aba, onNavEqp: () => {} }));
      expect(html).toContain("Equipe ·");
    });
  }
});
```

- [ ] **Step 7: Run the equipe smoke test**

Run: `pnpm --filter rionovo-client exec vitest run src/equipe/__smoke__/render.test.ts`
Expected: PASS — 4 casos, cada um contém `"Equipe ·"`.

- [ ] **Step 8: Commit**

```bash
git add client/src/equipe/api.ts client/src/equipe/mock/insight.ts client/src/equipe/components/IaInsight.tsx client/src/equipe/components/DashboardView.tsx client/src/equipe/EquipeContent.tsx client/src/equipe/__smoke__/render.test.ts
git commit -m "feat(equipe): painel de visão geral da equipe (client)"
```

---

## Task 7: Wiring de navegação (Shell · App · router · sidebar · ⌘K)

**Files:**
- Modify: `client/src/components/Shell.tsx` (união `Tab`)
- Modify: `client/src/App.tsx` (mapas `MIL`/`EQP`)
- Modify: `client/src/router.ts` (`MODULO_BASE`)
- Modify: `client/src/components/AppSidebar.tsx` (ícones + subs)
- Modify: `client/src/lib/searchIndex.ts` (2 comandos + curadoria)

**Interfaces:**
- Consumes: `MilSub`/`EqpSub` já com `"dashboard"` (Tasks 5–6).
- Produces: `Tab` union ganha `"mil-dashboard"` e `"eqp-dashboard"`; ambos os módulos abrem no painel; sub-aba "Painel" na sidebar; comandos ⌘K.

- [ ] **Step 1: Extend the `Tab` union in `Shell.tsx`**

In `client/src/components/Shell.tsx`, replace lines 11–12 (the `eqp-*` and `mil-*` rows):

```ts
  | "eqp-funcionarios" | "eqp-ponto" | "eqp-folha"
  | "mil-safras" | "mil-custos" | "mil-producao" | "mil-silos" | "mil-custo";
```

with:

```ts
  | "eqp-dashboard" | "eqp-funcionarios" | "eqp-ponto" | "eqp-folha"
  | "mil-dashboard" | "mil-safras" | "mil-custos" | "mil-producao" | "mil-silos" | "mil-custo";
```

- [ ] **Step 2: Extend the `MIL` and `EQP` maps in `App.tsx`**

In `client/src/App.tsx`, change the `EQP` map to prepend the dashboard entry:

```ts
const EQP: Record<string, EqpSub> = {
  "eqp-dashboard": "dashboard",
  "eqp-funcionarios": "funcionarios",
  "eqp-ponto": "ponto",
  "eqp-folha": "folha",
};
```

And the `MIL` map:

```ts
const MIL: Record<string, MilSub> = {
  "mil-dashboard": "dashboard",
  "mil-safras": "safras",
  "mil-custos": "custos",
  "mil-producao": "producao",
  "mil-silos": "silos",
  "mil-custo": "custo",
};
```

(Nenhuma outra mudança em `App.tsx`: os checks `startsWith("mil-")`/`startsWith("eqp-")` no redirect e no `podeVer` já cobrem as novas abas.)

- [ ] **Step 3: Make both modules open on the painel in `router.ts`**

In `client/src/router.ts`, replace the comment (lines 34–36) + `MODULO_BASE` block (lines 37–43) with:

```ts
// Prefixo da aba (reb-/pla-/cor-/mil-/eqp-) <-> base do caminho aninhado.
// `defaultSub` = sub-aba aberta quando a URL é só a base (default "dashboard").
// TODOS os módulos operacionais abrem no painel (dashboard) — a URL base
// /rebanho, /plantio, /corte, /milho, /equipe resolve para o painel.
const MODULO_BASE: Array<{ prefix: string; base: string; defaultSub?: string }> = [
  { prefix: "reb-", base: "/rebanho" },
  { prefix: "pla-", base: "/plantio" },
  { prefix: "cor-", base: "/corte" },
  { prefix: "mil-", base: "/milho" },
  { prefix: "eqp-", base: "/equipe" },
];
```

(O fallback `defaultSub ?? "dashboard"` em `pathToTab` já faz `/milho` → `mil-dashboard` e `/equipe` → `eqp-dashboard`.)

- [ ] **Step 4: Add the sidebar icons in `AppSidebar.tsx`**

In `client/src/components/AppSidebar.tsx`, in the `ICON` map, add the `mil-dashboard` entry right before the `"mil-safras":` line:

```tsx
  "mil-dashboard": <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
```

And add the `eqp-dashboard` entry right before the `"eqp-funcionarios":` line:

```tsx
  "eqp-dashboard": <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
```

- [ ] **Step 5: Prepend the "Painel" sub in the `cultivo` and `equipe` modules**

In `client/src/components/AppSidebar.tsx`, in the `cultivo` module `subs`, prepend `{ id: "mil-dashboard", label: "Painel" }` so the block reads:

```tsx
    subs: [
      { id: "mil-dashboard", label: "Painel" },
      { id: "mil-safras", label: "Safras" },
      { id: "mil-custos", label: "Lançar custos" },
      { id: "mil-producao", label: "Produção" },
      { id: "mil-silos", label: "Silos" },
      { id: "mil-custo", label: "Custo de produção" },
    ],
```

And in the `equipe` module `subs`, prepend `{ id: "eqp-dashboard", label: "Painel" }` so the block reads:

```tsx
    subs: [
      { id: "eqp-dashboard", label: "Painel" },
      { id: "eqp-funcionarios", label: "Funcionários" },
      { id: "eqp-ponto", label: "Ponto" },
      { id: "eqp-folha", label: "Folha" },
    ],
```

- [ ] **Step 6: Add the ⌘K commands in `searchIndex.ts`**

In `client/src/lib/searchIndex.ts`, in the "— Milho —" section, prepend before the `mil-safras` command:

```ts
  { id: "mil-dashboard", tab: "mil-dashboard", label: "Painel", grupo: "Milho", sinonimos: ["milho", "cultivo", "safra", "visão geral", "início", "painel"], descricao: "Painel do milho" },
```

In the "— Administração —" section, prepend before the `eqp-funcionarios` command:

```ts
  { id: "eqp-dashboard", tab: "eqp-dashboard", label: "Painel", grupo: "Administração", sinonimos: ["equipe", "ponto", "folha", "rh", "visão geral", "painel"], descricao: "Painel da equipe" },
```

Then add both to `CURADORIA_IDS` (append after `"cor-dashboard"`):

```ts
const CURADORIA_IDS = [
  "fin-dashboard",
  "fin-gastos",
  "fin-lancar",
  "fin-relatorio",
  "reb-dashboard",
  "reb-animal",
  "pla-dashboard",
  "cor-dashboard",
  "mil-dashboard",
  "eqp-dashboard",
];
```

(`eqp-dashboard` é seguro na curadoria: a `CommandPalette` filtra `COMANDOS` por `podeVer` **antes** de montar a curadoria — quem não tem `verSalarios` não vê o item.)

- [ ] **Step 7: Type-check the client**

Run: `pnpm --filter rionovo-client exec tsc --noEmit`
Expected: no errors (o `MIL`/`EQP` `Record<string, …>` aceita as novas chaves; `Tab` cobre `mil-dashboard`/`eqp-dashboard`).

- [ ] **Step 8: Run the client test suite**

Run: `pnpm --filter rionovo-client run test`
Expected: PASS — os smokes de cultivo (6) e equipe (4) verdes.

> **Nota:** se `client/src/lib/searchIndex.test.ts` existir e assertar o tamanho exato da curadoria (8) ou a contagem de `COMANDOS`, atualizar a expectativa (curadoria 8→10; 2 comandos novos). Rodar isolado primeiro: `pnpm --filter rionovo-client exec vitest run src/lib/searchIndex.test.ts`.

- [ ] **Step 9: Commit**

```bash
git add client/src/components/Shell.tsx client/src/App.tsx client/src/router.ts client/src/components/AppSidebar.tsx client/src/lib/searchIndex.ts
git commit -m "feat(nav): sub-aba Painel + abrir Milho/Equipe no painel"
```

---

## Task 8: Item 4 — eyebrow contextual (Plantio + Corte)

**Files:**
- Modify: `client/src/plantio/components/DashboardView.tsx:20`
- Modify: `client/src/corte/components/DashboardView.tsx:28`

**Interfaces:** nenhuma nova — só troca de string do `eyebrow` (lidera com o rótulo do módulo, remove o nome de fazenda hardcoded, alinhado à direção de revenda/multi-tenant). Nenhum teste fixa essas strings (verificado).

- [ ] **Step 1: Update the Plantio eyebrow**

In `client/src/plantio/components/DashboardView.tsx`, change the loaded-state `RebHeader` (line ~20) from:

```tsx
      <RebHeader eyebrow={`Lavoura Rio Novo · ${k.areaTotal} ha · ${k.talhoesAtivos} talhões ativos`} title="Painel da lavoura" />
```

to:

```tsx
      <RebHeader eyebrow={`Plantio · café · ${k.areaTotal} ha · ${k.talhoesAtivos} talhões`} title="Painel da lavoura" />
```

- [ ] **Step 2: Update the Corte eyebrow**

In `client/src/corte/components/DashboardView.tsx`, change the loaded-state `RebHeader` (line ~28) from:

```tsx
      <RebHeader eyebrow={`Atividade Corte · Rio Novo · ${k.totalCabecas} cabeças · ${k.totalAtivos} lotes`} title="Painel da pecuária" />
```

to:

```tsx
      <RebHeader eyebrow={`Gado de corte · ${k.totalCabecas} cabeças · ${k.totalAtivos} lotes`} title="Painel da pecuária" />
```

- [ ] **Step 3: Type-check + run the plantio/corte smokes**

Run: `pnpm --filter rionovo-client exec tsc --noEmit`
Expected: no errors.

Run: `pnpm --filter rionovo-client exec vitest run src/plantio src/corte`
Expected: PASS (as strings de eyebrow não são asseridas por nenhum smoke; as loading shells `"Lavoura · Painel"` / `"Corte · Painel"` continuam iguais).

- [ ] **Step 4: Commit**

```bash
git add client/src/plantio/components/DashboardView.tsx client/src/corte/components/DashboardView.tsx
git commit -m "refactor(client): eyebrow contextual dos painéis Plantio e Corte"
```

---

## Task 9: Gate de saída + PR

**Files:** nenhuma mudança de código (verificação + PR). Se algum passo falhar, corrigir na task correspondente e repetir.

- [ ] **Step 1: Type-check ambos os workspaces**

Run: `pnpm --filter rionovo-server exec tsc --noEmit && pnpm --filter rionovo-client exec tsc --noEmit`
Expected: no errors nos dois.

- [ ] **Step 2: Rodar os testes dos dois workspaces**

Run: `pnpm --filter rionovo-server run test`
Expected: PASS (incl. os 2 novos `dashboard.agg.test.ts`).

Run: `pnpm --filter rionovo-client run test`
Expected: PASS — 166 anteriores + novos casos (cultivo smoke 5→6, novo equipe smoke 4) todos verdes.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: build dos dois workspaces (tsc + vite build) sem erro.

- [ ] **Step 4: Conferência no navegador**

Subir `pnpm dev` e conferir (desktop e mobile ≤900px):
1. `/milho` abre no **Painel do milho** (KPIs · banda de insight · grid de domínios · rail de alerta). Clicar num card "ver →" navega pra sub-aba certa. Sidebar mostra "Painel" como 1º item de Milho.
2. `/equipe` abre no **Painel da equipe** (mesmos elementos). Cards e alertas navegam. Sidebar mostra "Painel".
3. ⌘K: buscar "painel" lista os painéis de Milho e Equipe (Equipe só aparece com perfil que tem `verSalarios`).
4. `/plantio` e `/corte`: eyebrow agora lê `Plantio · café · …` e `Gado de corte · …`.

- [ ] **Step 5: Push + abrir PR**

```bash
git push -u origin feat/painel-milho-equipe
gh pr create --base main --head feat/painel-milho-equipe \
  --title "feat: painel de visão geral para Milho e Equipe" \
  --body "$(cat <<'EOF'
## Resumo
- Dá um **painel de visão geral** próprio aos módulos **Milho (cultivo)** e **Equipe & Ponto**, no mesmo molde de Rebanho/Plantio/Corte (faixa de KPIs · banda de insight da IA · grid de domínios · rail de alerta). Fecha o último item aberto da auditoria de UI.
- **Backend:** `GET /api/cultivo/dashboard` e `GET /api/ponto/dashboard`, escopados por propriedade (`resolverEscopoLeitura`), com agregação pura testada (`dashboard.agg.ts`) sobre read-models existentes (ResumoSafraCultivo/Silo; custo de MO por setor + folha).
- **Nav:** sub-aba "Painel" na sidebar; Milho e Equipe passam a **abrir no painel**; comandos ⌘K.
- **Item 4:** eyebrow contextual dos painéis de Plantio e Corte (`Plantio · café · …`, `Gado de corte · …`), sem nome de fazenda hardcoded.

## Testes
- Novos: `services/cultivo/dashboard.agg.test.ts`, `services/ponto/dashboard.agg.test.ts`, `equipe/__smoke__/render.test.ts`; `cultivo/__smoke__` +dashboard.
- `tsc` limpo (server+client) · `pnpm --filter rionovo-client run test` · `pnpm --filter rionovo-server run test` · `pnpm build` · conferido no navegador (desktop/mobile).

Spec: `docs/design/2026-07-13-painel-milho-equipe-design.md` · Plano: `docs/design/2026-07-13-painel-milho-equipe-plan.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6 (opcional, fora deste PR):** follow-up — deletar os 3 `IaView.tsx` órfãos (rebanho/plantio/corte) + ajustar `rebanho/__smoke__/render.test.ts` que os referencia. Fica como PR separado.

---

## Self-Review

**1. Spec coverage:**
- Objetivo 1 (endpoints escopados testados) → Tasks 1–4. ✅
- Objetivo 2 (DashboardView cultivo + equipe no molde rebanho) → Tasks 5–6. ✅
- Objetivo 3 (abrir no painel + sub-aba "Painel") → Task 7 (router MODULO_BASE, sidebar subs, Shell/App maps). ✅
- Objetivo 4 (eyebrow Plantio/Corte) → Task 8. ✅
- Insight IA paridade total (IaInsight.tsx + mock por módulo) → Tasks 5–6. ✅
- ⌘K (2 comandos + curadoria) → Task 7. ✅
- Testes (server aggs, cultivo smoke +dashboard, novo equipe smoke) → Tasks 1,3,5,6. ✅
- Gate de saída (tsc/tests/build/browser) → Task 9. ✅
- Não-objetivos respeitados: rebanho não muda; IaView órfãos ficam como follow-up (Step 6); nenhum fato novo escopado. ✅

**2. Placeholder scan:** sem TBD/TODO; todo passo com código completo ou comando exato + saída esperada. ✅

**3. Type consistency:**
- `DashboardCultivoDTO`/`DashboardMilho` e `DashboardPontoDTO`/`DashboardEquipe` têm os mesmos campos em `k`, `dominios`, `alertas` no server e no client. ✅
- `agregarDashboardCultivo(safras, silos)` — mesma assinatura em Task 1 (impl), Task 1 (test), Task 2 (loader). ✅
- `agregarDashboardPonto({ mes, funcionariosAtivos, custoSetores, folha })` — mesma forma em Task 3 (impl/test) e Task 4 (loader). ✅
- `buildCultivoDashboard(propriedadeId?)` / `buildPontoDashboard(mes, propriedadeId?)` — assinaturas casam rota↔loader. ✅
- `CustoMOSetor` (custoMOSetor.ts) e `FolhaDTO` (folha.service.ts) são de fato exportados (verificado no código). ✅
- `MilSub`/`EqpSub` ganham `"dashboard"` (Tasks 5/6) antes de serem consumidos por `DashboardView` e pelos mapas `MIL`/`EQP` (Task 7). ✅
- `onNavMil`/`onNavEqp` recebem `MilSub`/`EqpSub` via `d.tab.replace("mil-"/"eqp-", "")` — os `tab` do DTO usam exatamente esses prefixos. ✅
