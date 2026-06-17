# Rebanho Fase Real — Fatia 5: Dashboard real — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.

**Goal:** Replace the Dashboard's hardcoded numbers with **real herd aggregates** computed from the database (Animal + ResumoAnimal), via a `GET /api/rebanho/dashboard` endpoint.

**Design:** A pure `agregarDashboard(animais, hoje)` (TDD) computes the herd KPIs, per-domain summary lines, and alerts; the service fetches active animals (+resumo) and calls it; `DashboardView` fetches `/rebanho/dashboard` and renders it (no more constants).

**Tech Stack:** Hono + Prisma + Vitest; React. No new deps.

## Global Constraints
- Server imports end in `.js`; client no extension; PT-BR. Prisma `Decimal`→`Number()`.
- Branch `feat/rebanho-real-dashboard`. Commit per task.

## Dashboard DTO
```ts
interface DashboardDTO {
  kpis: { rebanhoAtivo: number; emLactacao: number; secas: number; producaoMedia: number | null; gestantes: number; prenhez: number };
  dominios: { tab: "reproducao"|"sanidade"|"nutricao"|"animal"; titulo: string; linhas: string[] }[];
  alertas: { label: string; n: number; tab: "reproducao"|"sanidade"|"nutricao"|"animal"; tom: "bad"|"ok" }[];
}
```

---

## Task 1: Aggregation (pure) + service + endpoint + smoke — TDD
**Files:** Create `server/src/services/rebanho/dashboard.agg.ts` (+ `.test.ts`), `server/src/services/rebanho/dashboard-rebanho.ts`, `server/src/routes/rebanho/dashboard.ts`; modify `server/src/index.ts`

**Interfaces:** Produces `agregarDashboard(animais: AnimalAgg[], hoje: string): DashboardDTO` where `AnimalAgg = { categoria: string; resumo: { statusReprodutivo: string; del: number | null; producaoMediaDia: number | null; ccs: number | null; ccsTendencia: string | null; iepProjetado: number | null; diasGestacao: number | null; previsaoSecagem: string | null } | null }`.

- [ ] **Step 1: Failing test** — `server/src/services/rebanho/dashboard.agg.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { agregarDashboard } from "./dashboard.agg.js";
const a = (categoria: string, resumo: any) => ({ categoria, resumo });
const HOJE = "2026-06-16";
const herd = [
  a("VACA", { statusReprodutivo: "PRENHE", del: 145, producaoMediaDia: 28, ccs: 512, ccsTendencia: "subindo", iepProjetado: 396, diasGestacao: 49, previsaoSecagem: "2026-04-01" }), // secagem vencida
  a("VACA", { statusReprodutivo: "VAZIA", del: 110, producaoMediaDia: 22, ccs: 300, ccsTendencia: "subindo", iepProjetado: null, diasGestacao: null, previsaoSecagem: null }),
  a("VACA", { statusReprodutivo: "PEV", del: 40, producaoMediaDia: 31, ccs: 180, ccsTendencia: "estavel", iepProjetado: null, diasGestacao: null, previsaoSecagem: null }),
  a("BEZERRA", null),
];
describe("agregarDashboard", () => {
  it("KPIs", () => {
    const d = agregarDashboard(herd, HOJE);
    expect(d.kpis.rebanhoAtivo).toBe(4);
    expect(d.kpis.emLactacao).toBe(3);
    expect(d.kpis.gestantes).toBe(1);
    expect(d.kpis.prenhez).toBe(25);          // 1/4
    expect(d.kpis.producaoMedia).toBe(27);     // (28+22+31)/3 = 27
  });
  it("alertas: secagem vencida + CCS alto + vazia atrasada", () => {
    const d = agregarDashboard(herd, HOJE);
    const get = (label: string) => d.alertas.find((x) => x.label.startsWith(label))?.n;
    expect(get("Secagens")).toBe(1);            // PRENHE com previsaoSecagem < hoje
    expect(get("CCS")).toBe(1);                 // ccs >= 400 → só a primeira (512)
    expect(get("Vazias")).toBe(1);              // VAZIA com del > 90
  });
});
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** `dashboard.agg.ts`:
```ts
export interface ResumoAgg { statusReprodutivo: string; del: number | null; producaoMediaDia: number | null; ccs: number | null; ccsTendencia: string | null; iepProjetado: number | null; diasGestacao: number | null; previsaoSecagem: string | null; }
export interface AnimalAgg { categoria: string; resumo: ResumoAgg | null; }
export interface DashboardDTO {
  kpis: { rebanhoAtivo: number; emLactacao: number; secas: number; producaoMedia: number | null; gestantes: number; prenhez: number };
  dominios: { tab: "reproducao" | "sanidade" | "nutricao" | "animal"; titulo: string; linhas: string[] }[];
  alertas: { label: string; n: number; tab: "reproducao" | "sanidade" | "nutricao" | "animal"; tom: "bad" | "ok" }[];
}
const VAZIA_ATRASADA_DEL = 90;

export function agregarDashboard(animais: AnimalAgg[], hoje: string): DashboardDTO {
  const rs = animais.map((a) => a.resumo).filter((r): r is ResumoAgg => r != null);
  const n = animais.length;
  const emLactacao = rs.filter((r) => r.del != null).length;
  const vacas = animais.filter((a) => a.categoria === "VACA").length;
  const secas = animais.filter((a) => a.categoria === "VACA" && (a.resumo?.del == null)).length;
  const gestantes = rs.filter((r) => r.statusReprodutivo === "PRENHE").length;
  const vazias = rs.filter((r) => r.statusReprodutivo === "VAZIA").length;
  const servidas = rs.filter((r) => r.statusReprodutivo === "INSEMINADA").length;
  const prods = rs.map((r) => r.producaoMediaDia).filter((x): x is number => x != null);
  const producaoMedia = prods.length ? Math.round(prods.reduce((a, b) => a + b, 0) / prods.length) : null;
  const ieps = rs.map((r) => r.iepProjetado).filter((x): x is number => x != null);
  const iepMedio = ieps.length ? Math.round(ieps.reduce((a, b) => a + b, 0) / ieps.length) : null;
  const ccss = rs.map((r) => r.ccs).filter((x): x is number => x != null);
  const ccsMedio = ccss.length ? Math.round(ccss.reduce((a, b) => a + b, 0) / ccss.length) : null;
  const ccsAlto = rs.filter((r) => (r.ccs ?? 0) >= 400).length;
  const prenhez = n ? Math.round((gestantes / n) * 100) : 0;

  const secagensAtrasadas = rs.filter((r) => r.statusReprodutivo === "PRENHE" && r.previsaoSecagem && Date.parse(r.previsaoSecagem) < Date.parse(hoje)).length;
  const vaziasAtrasadas = rs.filter((r) => r.statusReprodutivo === "VAZIA" && (r.del ?? 0) > VAZIA_ATRASADA_DEL).length;
  const partosPrevistos = rs.filter((r) => r.statusReprodutivo === "PRENHE" && (r.diasGestacao ?? 0) >= 253).length;

  return {
    kpis: { rebanhoAtivo: n, emLactacao, secas, producaoMedia, gestantes, prenhez },
    dominios: [
      { tab: "reproducao", titulo: "Reprodução", linhas: [`${gestantes} gestantes · ${servidas} servidas`, `${vazias} vazias`, iepMedio ? `IEP médio ${iepMedio}d` : "IEP —"] },
      { tab: "sanidade", titulo: "Sanidade", linhas: [ccsMedio ? `CCS médio ${ccsMedio} mil` : "CCS —", `${ccsAlto} com CCS ≥ 400 mil`] },
      { tab: "nutricao", titulo: "Nutrição", linhas: [producaoMedia ? `Produção média ${producaoMedia} L/d` : "—"] },
      { tab: "animal", titulo: "Animal", linhas: [`${n} ativos · ${emLactacao} em lactação`, `${secas} secas · ${vacas} vacas`] },
    ],
    alertas: [
      { label: "Secagens atrasadas", n: secagensAtrasadas, tab: "reproducao", tom: secagensAtrasadas ? "bad" : "ok" },
      { label: "Vazias atrasadas (PEV)", n: vaziasAtrasadas, tab: "reproducao", tom: vaziasAtrasadas ? "bad" : "ok" },
      { label: "CCS alto", n: ccsAlto, tab: "sanidade", tom: ccsAlto ? "bad" : "ok" },
      { label: "Partos previstos ≤30d", n: partosPrevistos, tab: "reproducao", tom: "ok" },
    ],
  };
}
```
- [ ] **Step 4:** Run → PASS (fix test integers to engine if any drift).
- [ ] **Step 5: Service + endpoint** — `dashboard-rebanho.ts`:
```ts
import { prisma } from "../../db.js";
import { agregarDashboard, type AnimalAgg, type DashboardDTO } from "./dashboard.agg.js";
const isoOrNull = (x: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : null);
export async function buildRebanhoDashboard(): Promise<DashboardDTO> {
  const animais = await prisma.animal.findMany({ where: { status: "ATIVO" }, include: { resumo: true } });
  const agg: AnimalAgg[] = animais.map((a) => ({
    categoria: a.categoria,
    resumo: a.resumo ? { statusReprodutivo: a.resumo.statusReprodutivo, del: a.resumo.del, producaoMediaDia: a.resumo.producaoMediaDia != null ? Number(a.resumo.producaoMediaDia) : null, ccs: a.resumo.ccs, ccsTendencia: a.resumo.ccsTendencia, iepProjetado: a.resumo.iepProjetado, diasGestacao: a.resumo.diasGestacao, previsaoSecagem: isoOrNull(a.resumo.previsaoSecagem) } : null,
  }));
  return agregarDashboard(agg, new Date().toISOString().slice(0, 10));
}
```
`server/src/routes/rebanho/dashboard.ts`:
```ts
import { Hono } from "hono";
import { buildRebanhoDashboard } from "../../services/rebanho/dashboard-rebanho.js";
export const rebanhoDashboardRouter = new Hono().get("/rebanho/dashboard", async (c) => c.json(await buildRebanhoDashboard()));
```
Mount in `index.ts`: `import { rebanhoDashboardRouter } from "./routes/rebanho/dashboard.js";` + `app.route("/api", rebanhoDashboardRouter);`. (Note: distinct from the financial `dashboardRouter` — the path `/rebanho/dashboard` doesn't collide with `/dashboard`.)
- [ ] **Step 6: Smoke** — `curl http://localhost:41873/api/rebanho/dashboard` (server running) → JSON with `kpis.rebanhoAtivo` = active count, `alertas` array. 
- [ ] **Step 7:** Commit `feat(rebanho): agregação real do dashboard (TDD) + endpoint`.

---

## Task 2: DashboardView fetches real data
**Files:** Modify `client/src/rebanho/api.ts`, `client/src/rebanho/components/DashboardView.tsx`
- [ ] **Step 1:** In `api.ts` add:
```ts
export interface DashboardData { kpis: { rebanhoAtivo: number; emLactacao: number; secas: number; producaoMedia: number | null; gestantes: number; prenhez: number }; dominios: { tab: string; titulo: string; linhas: string[] }[]; alertas: { label: string; n: number; tab: string; tom: "bad" | "ok" }[]; }
export const obterDashboard = () => req<DashboardData>(`/rebanho/dashboard`);
export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null); const [loading, setLoading] = useState(true); const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => { setLoading(true); setErro(null); obterDashboard().then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { recarregar(); }, [recarregar]); return { data, loading, erro };
}
```
- [ ] **Step 2:** Rewrite `DashboardView.tsx` to fetch and render. Replace the hardcoded `HERD`/`DOMINIOS`/`ALERTAS` consts with `useDashboard()`. Keep the same JSX structure (KPI strip, IA band, `rb-dash` grid with domain cards + alerts) but feed from `data`:
```tsx
import type { RebanhoTab } from "../nav";
import { insightDoRebanho } from "../mock";
import { IaInsightBand } from "./IaInsight";
import { useDashboard } from "../api";

export function DashboardView({ onNav }: { onNav: (t: RebanhoTab) => void }) {
  const { data, loading, erro } = useDashboard();
  const insight = insightDoRebanho("reproducao");
  if (loading) return <main className="rb-main"><div className="rb-head"><h1>Dashboard</h1></div><p className="rb-sub">Carregando…</p></main>;
  if (erro || !data) return <main className="rb-main"><div className="rb-head"><h1>Dashboard</h1></div><p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {erro}</p></main>;
  const k = data.kpis;
  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Sítio São Francisco · {k.rebanhoAtivo} animais</div>
      <div className="rb-head"><h1>Dashboard</h1><div className="period">📅 Junho 2026 ▾</div></div>
      <div className="rb-kstrip" style={{ ["--cols" as any]: 6 }}>
        <div className="rb-k"><div className="lab">Rebanho ativo</div><div className="val">{k.rebanhoAtivo}</div><div className="d">total</div></div>
        <div className="rb-k"><div className="lab">Em lactação</div><div className="val">{k.emLactacao}</div><div className="d">vacas</div></div>
        <div className="rb-k"><div className="lab">Secas</div><div className="val">{k.secas}</div><div className="d">vacas</div></div>
        <div className="rb-k"><div className="lab">Produção média</div><div className="val">{k.producaoMedia ?? "—"}<small style={{ fontSize: 13 }}>L</small></div><div className="d">por vaca/dia</div></div>
        <div className="rb-k"><div className="lab">Gestantes</div><div className="val">{k.gestantes}</div><div className="d">prenhes</div></div>
        <div className="rb-k"><div className="lab">Prenhez</div><div className="val">{k.prenhez}<small style={{ fontSize: 13 }}>%</small></div><div className="d">do rebanho</div></div>
      </div>
      {insight && <IaInsightBand insight={insight} />}
      <div className="rb-dash">
        <div className="rb-dcards">
          {data.dominios.map((d) => (
            <button key={d.tab} className="rb-dcard" onClick={() => onNav(d.tab as RebanhoTab)}>
              <h4>{d.titulo}<span className="go">ver →</span></h4>
              <ul>{d.linhas.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </button>
          ))}
        </div>
        <div className="rb-alerts">
          <h4>Animais em situação de alerta</h4>
          {data.alertas.map((al) => (
            <button key={al.label} className="rb-alert" onClick={() => onNav(al.tab as RebanhoTab)}>
              <span>{al.label}</span><span className={"n " + (al.n === 0 ? "ok" : al.tom)}>{al.n}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
```
- [ ] **Step 3:** The render smoke `__smoke__/render.test.ts` has a `DashboardView` case asserting on the old hardcoded text ("Rebanho ativo", "522", "Animais em situação de alerta", "Secagens atrasadas"). Since it now fetches (SSR → loading shell), **update that smoke case** to assert the loading state renders (e.g., `expect(html).toContain("Dashboard")` and `toContain("Carregando")`), keeping the other cases. Run `pnpm --filter rionovo-client test` → green.
- [ ] **Step 4:** tsc/build green; commit `feat(rebanho): Dashboard lendo agregados reais da API`.

---

## Self-Review
- Coverage: aggregation (TDD)→T1; service+endpoint→T1; client fetch + DashboardView→T2. ✓
- Path `/rebanho/dashboard` distinct from financial `/dashboard` — no collision. ✓ Decimal→Number in the service mapping. ✓
- Types: `DashboardDTO`/`AnimalAgg`/`ResumoAgg` (T1) ↔ client `DashboardData` (T2) same shape. ✓ The smoke test update is required (T2 Step 3) since the view now fetches. ✓
