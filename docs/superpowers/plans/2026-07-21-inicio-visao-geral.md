# Início — Home executiva — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a tela "Início" — uma home executiva que resume rebanho + financeiro e vira a primeira tela ao logar.

**Architecture:** Frontend-only. Um entrypoint `InicioContent` consome os dois hooks/fetchers de dashboard já existentes (`useDashboard` do rebanho + `fetchDashboard` do financeiro), passa cada payload por funções puras de `lib/inicioDerive.ts`, e renderiza três cards resilientes (Atenção, Leite hoje, Caixa) + um cabeçalho. Zero backend novo.

**Tech Stack:** React 18 + TypeScript + Vite, Vitest + Testing Library, Tailwind. Padrões do projeto: navegação por `Tab` (sem react-router), `router.ts` para deep-link, `comPropriedade()` nos fetches (já embutido nos hooks reusados).

## Global Constraints

- Client: imports relativos **sem** extensão. Reusar `fmtBRL` de `components/charts` — não recriar formatadores.
- Um card falhar/estar vazio **não pode** derrubar a tela nem os outros cards.
- Respeitar propriedade ativa: já garantido porque os fetchers reusados usam `comPropriedade()`.
- Números da Home devem bater com Painel do Rebanho e Dashboard financeiro (mesma fonte).
- Testes de componente React precisam de `afterEach(cleanup)` (o projeto não tem setup global de cleanup do Testing Library).
- Shapes reais (não inventar campos):
  - Rebanho `DashboardData` (de `rebanho/api.ts`): `herois.producaoTotalDia`, `herois.vacasEmLactacao`, `herois.producaoMediaVaca` — cada um `IndicadorHeroDashboard { valor: number|null; unidade: string; variacaoPercentual: number|null; ... }`; `alertas: WorklistRebanho[]` com `{ chave, titulo, quantidade, severidade: "alta"|"media"|"baixa", tab, explicacao }`.
  - Financeiro (de `api.ts` `fetchDashboard(): Promise<any>`): `creditoTotal: number[]`, `debitoTotal: number[]` (23 meses), `caixaHoje: { total: number }`.

---

### Task 1: Deriva pura do resumo (lib/inicioDerive)

**Files:**
- Create: `client/src/inicio/lib/inicioDerive.ts`
- Test: `client/src/inicio/lib/inicioDerive.test.ts`

**Interfaces:**
- Consumes: nada (funções puras sobre objetos plain).
- Produces:
  - `type ResumoLeite = { producaoDia: number | null; emLactacao: number | null; mediaVaca: number | null; tendenciaPct: number | null }`
  - `type ResumoCaixa = { saldo: number | null; mesLabel: string | null; entrada: number | null; saida: number | null; fluxo: number | null }`
  - `type ResumoAtencao = { chave: string; titulo: string; quantidade: number; severidade: "alta" | "media" | "baixa"; tab: string }`
  - `function resumoLeite(d: unknown): ResumoLeite`
  - `function resumoCaixa(d: unknown): ResumoCaixa`
  - `function resumoAtencao(d: unknown, max?: number): ResumoAtencao[]`  // ordena alta→media→baixa, corta quantidade 0, limita a `max` (default 4)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { resumoLeite, resumoCaixa, resumoAtencao } from "./inicioDerive";

const rebanho = {
  herois: {
    producaoTotalDia: { valor: 980, unidade: "L", variacaoPercentual: 3 },
    vacasEmLactacao: { valor: 98, unidade: "", variacaoPercentual: null },
    producaoMediaVaca: { valor: 10, unidade: "L", variacaoPercentual: null },
  },
  alertas: [
    { chave: "ccs-alta", titulo: "CCS alta", quantidade: 5, severidade: "alta", tab: "sanidade", explicacao: "" },
    { chave: "parto-proximo", titulo: "Partos", quantidade: 2, severidade: "baixa", tab: "reproducao", explicacao: "" },
    { chave: "dg-pendente", titulo: "DG", quantidade: 0, severidade: "media", tab: "reproducao", explicacao: "" },
  ],
};

const financeiro = {
  // 23 meses; só o penúltimo tem movimento (mês corrente zerado = atraso do BPO)
  creditoTotal: [...Array(21).fill(0), 5000, 0],
  debitoTotal: [...Array(21).fill(0), 3000, 0],
  caixaHoje: { total: 12345.67 },
};

describe("resumoLeite", () => {
  it("extrai produção, lactação, média e tendência", () => {
    expect(resumoLeite(rebanho)).toEqual({ producaoDia: 980, emLactacao: 98, mediaVaca: 10, tendenciaPct: 3 });
  });
  it("payload vazio → tudo null", () => {
    expect(resumoLeite(null)).toEqual({ producaoDia: null, emLactacao: null, mediaVaca: null, tendenciaPct: null });
  });
});

describe("resumoCaixa", () => {
  it("saldo + último mês com dados (ignora mês corrente zerado)", () => {
    const r = resumoCaixa(financeiro);
    expect(r.saldo).toBe(12345.67);
    expect(r.entrada).toBe(5000);
    expect(r.saida).toBe(3000);
    expect(r.fluxo).toBe(2000);
    expect(r.mesLabel).toMatch(/\/\d{2}$/); // "mmm/aa"
  });
  it("sem mês com dados → mesLabel null mas saldo preservado", () => {
    expect(resumoCaixa({ creditoTotal: [0, 0], debitoTotal: [0, 0], caixaHoje: { total: 10 } }).mesLabel).toBeNull();
  });
});

describe("resumoAtencao", () => {
  it("ordena por severidade, corta quantidade 0, limita", () => {
    const a = resumoAtencao(rebanho, 4);
    expect(a.map((x) => x.chave)).toEqual(["ccs-alta", "parto-proximo"]);
  });
  it("payload vazio → []", () => {
    expect(resumoAtencao(null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter rionovo-client exec vitest run src/inicio/lib/inicioDerive.test.ts`
Expected: FAIL — "Failed to load url ./inicioDerive".

- [ ] **Step 3: Write minimal implementation**

```ts
export type ResumoLeite = { producaoDia: number | null; emLactacao: number | null; mediaVaca: number | null; tendenciaPct: number | null };
export type ResumoCaixa = { saldo: number | null; mesLabel: string | null; entrada: number | null; saida: number | null; fluxo: number | null };
export type ResumoAtencao = { chave: string; titulo: string; quantidade: number; severidade: "alta" | "media" | "baixa"; tab: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const heroi = (d: any, k: string) => (d?.herois?.[k]?.valor ?? null) as number | null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resumoLeite(d: any): ResumoLeite {
  return {
    producaoDia: heroi(d, "producaoTotalDia"),
    emLactacao: heroi(d, "vacasEmLactacao"),
    mediaVaca: heroi(d, "producaoMediaVaca"),
    tendenciaPct: (d?.herois?.producaoTotalDia?.variacaoPercentual ?? null) as number | null,
  };
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
// Âncora igual à do Dashboard financeiro: idx 0 = jul/2024.
const ANCORA_ANO = 2024, ANCORA_MES = 6;
function mesLabelDeIdx(idx: number): string {
  const mo = ANCORA_MES + idx;
  const ano = ANCORA_ANO + Math.floor(mo / 12);
  return `${MESES[((mo % 12) + 12) % 12]}/${String(ano).slice(2)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resumoCaixa(d: any): ResumoCaixa {
  const cred: number[] = Array.isArray(d?.creditoTotal) ? d.creditoTotal : [];
  const deb: number[] = Array.isArray(d?.debitoTotal) ? d.debitoTotal : [];
  const saldo = (d?.caixaHoje?.total ?? null) as number | null;
  for (let i = Math.max(cred.length, deb.length) - 1; i >= 0; i--) {
    const e = cred[i] || 0, s = deb[i] || 0;
    if (e !== 0 || s !== 0) return { saldo, mesLabel: mesLabelDeIdx(i), entrada: e, saida: s, fluxo: e - s };
  }
  return { saldo, mesLabel: null, entrada: null, saida: null, fluxo: null };
}

const RANK = { alta: 0, media: 1, baixa: 2 } as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resumoAtencao(d: any, max = 4): ResumoAtencao[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alertas: any[] = Array.isArray(d?.alertas) ? d.alertas : [];
  return alertas
    .filter((a) => (a?.quantidade ?? 0) > 0)
    .sort((a, b) => RANK[a.severidade as keyof typeof RANK] - RANK[b.severidade as keyof typeof RANK] || b.quantidade - a.quantidade)
    .slice(0, max)
    .map((a) => ({ chave: a.chave, titulo: a.titulo, quantidade: a.quantidade, severidade: a.severidade, tab: a.tab }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter rionovo-client exec vitest run src/inicio/lib/inicioDerive.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/inicio/lib/inicioDerive.ts client/src/inicio/lib/inicioDerive.test.ts
git commit -m "feat(inicio): deriva pura do resumo de leite/caixa/atenção"
```

---

### Task 2: Cards da Home (Atenção, Leite hoje, Caixa)

**Files:**
- Create: `client/src/inicio/components/InicioCards.tsx`
- Test: `client/src/inicio/components/InicioCards.test.tsx`

**Interfaces:**
- Consumes: `ResumoLeite`, `ResumoCaixa`, `ResumoAtencao` (Task 1); `fmtBRL` de `../../components/charts`.
- Produces:
  - `function AtencaoCard(props: { itens: ResumoAtencao[]; onAbrir: (tab: string) => void }): JSX.Element`
  - `function LeiteHojeCard(props: { resumo: ResumoLeite; loading?: boolean; erro?: boolean; onVer: () => void }): JSX.Element`
  - `function CaixaCard(props: { resumo: ResumoCaixa; loading?: boolean; erro?: boolean; onVer: () => void }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { createElement } from "react";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AtencaoCard, LeiteHojeCard, CaixaCard } from "./InicioCards";

afterEach(cleanup);

describe("LeiteHojeCard", () => {
  it("mostra produção e chama onVer no atalho", () => {
    const onVer = vi.fn();
    const { getByText, getByRole } = render(createElement(LeiteHojeCard, {
      resumo: { producaoDia: 980, emLactacao: 98, mediaVaca: 10, tendenciaPct: 3 }, onVer,
    }));
    expect(getByText(/980/)).toBeTruthy();
    fireEvent.click(getByRole("button", { name: /Ver rebanho/ }));
    expect(onVer).toHaveBeenCalledOnce();
  });
  it("estado de erro não quebra e mostra aviso", () => {
    const { getByText } = render(createElement(LeiteHojeCard, {
      resumo: { producaoDia: null, emLactacao: null, mediaVaca: null, tendenciaPct: null }, erro: true, onVer: () => {},
    }));
    expect(getByText(/Não foi possível carregar/)).toBeTruthy();
  });
});

describe("CaixaCard", () => {
  it("mostra saldo e rótulo do mês", () => {
    const { getByText } = render(createElement(CaixaCard, {
      resumo: { saldo: 12345.67, mesLabel: "mai/26", entrada: 5000, saida: 3000, fluxo: 2000 }, onVer: () => {},
    }));
    expect(getByText(/mai\/26/)).toBeTruthy();
  });
});

describe("AtencaoCard", () => {
  it("vazio mostra operação em dia", () => {
    const { getByText } = render(createElement(AtencaoCard, { itens: [], onAbrir: () => {} }));
    expect(getByText(/em dia/i)).toBeTruthy();
  });
  it("item chama onAbrir com a tab", () => {
    const onAbrir = vi.fn();
    const { getByText } = render(createElement(AtencaoCard, {
      itens: [{ chave: "ccs-alta", titulo: "CCS alta", quantidade: 5, severidade: "alta", tab: "sanidade" }], onAbrir,
    }));
    fireEvent.click(getByText(/CCS alta/));
    expect(onAbrir).toHaveBeenCalledWith("sanidade");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter rionovo-client exec vitest run src/inicio/components/InicioCards.test.tsx`
Expected: FAIL — "Failed to load url ./InicioCards".

- [ ] **Step 3: Write minimal implementation**

```tsx
import { fmtBRL } from "../../components/charts";
import type { ResumoAtencao, ResumoCaixa, ResumoLeite } from "../lib/inicioDerive";

const CARD = "rounded-xl border border-[color:var(--rule-soft)] bg-card px-6 py-[22px] max-[620px]:px-4";
const H2 = "m-0 font-serif text-xl font-medium tracking-[-.01em]";
const num = (v: number | null, u = "") => (v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${u ? ` ${u}` : ""}`);

export function AtencaoCard({ itens, onAbrir }: { itens: ResumoAtencao[]; onAbrir: (tab: string) => void }) {
  return (
    <section className={CARD}>
      <h2 className={H2}>Precisa de atenção</h2>
      {itens.length === 0 ? (
        <div className="mt-4 rounded-[9px] border border-dashed border-[color:var(--rule-soft)] bg-[color:var(--bg)] px-4 py-3 text-sm text-ink-2">✓ Operação em dia.</div>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {itens.map((a) => (
            <button key={a.chave} onClick={() => onAbrir(a.tab)} className="flex w-full items-center gap-3 rounded-[9px] border border-[color:var(--rule-soft)] border-l-[3px] border-l-prejuizo bg-[color:var(--bg)] px-[15px] py-3 text-left hover:border-cafe">
              <strong className="w-10 text-center font-serif text-[26px] font-medium tabular-nums text-prejuizo">{a.quantidade}</strong>
              <span className="flex-1 text-sm font-semibold text-foreground">{a.titulo}</span>
              <span aria-hidden className="text-ink-3">→</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function CardComAtalho({ titulo, erro, loading, onVer, verLabel, children }: { titulo: string; erro?: boolean; loading?: boolean; onVer: () => void; verLabel: string; children: React.ReactNode }) {
  return (
    <section className={CARD}>
      <header className="mb-[18px] flex items-center justify-between gap-3">
        <h2 className={H2}>{titulo}</h2>
        <button className="text-xs font-semibold text-cafe" onClick={onVer}>{verLabel} →</button>
      </header>
      {erro ? <p className="text-sm text-ink-3">Não foi possível carregar.</p>
        : loading ? <p className="text-sm text-ink-3">Carregando…</p>
        : children}
    </section>
  );
}

export function LeiteHojeCard({ resumo, loading, erro, onVer }: { resumo: ResumoLeite; loading?: boolean; erro?: boolean; onVer: () => void }) {
  return (
    <CardComAtalho titulo="Leite hoje" verLabel="Ver rebanho" erro={erro} loading={loading} onVer={onVer}>
      <div className="grid grid-cols-3 gap-4 max-[520px]:grid-cols-1">
        <div><p className="text-xs text-ink-3">Produção do dia</p><p className="mt-1 font-serif text-2xl font-medium tabular-nums">{num(resumo.producaoDia, "L")}</p></div>
        <div><p className="text-xs text-ink-3">Em lactação</p><p className="mt-1 font-serif text-2xl font-medium tabular-nums">{num(resumo.emLactacao)}</p></div>
        <div><p className="text-xs text-ink-3">Média/vaca</p><p className="mt-1 font-serif text-2xl font-medium tabular-nums">{num(resumo.mediaVaca, "L")}</p></div>
      </div>
    </CardComAtalho>
  );
}

export function CaixaCard({ resumo, loading, erro, onVer }: { resumo: ResumoCaixa; loading?: boolean; erro?: boolean; onVer: () => void }) {
  return (
    <CardComAtalho titulo="Caixa" verLabel="Ver financeiro" erro={erro} loading={loading} onVer={onVer}>
      <div><p className="text-xs text-ink-3">Saldo em caixa</p><p className="mt-1 font-serif text-2xl font-medium tabular-nums">{resumo.saldo == null ? "—" : fmtBRL(resumo.saldo)}</p></div>
      {resumo.mesLabel && (
        <div className="mt-4 grid grid-cols-3 gap-4 border-t border-[color:var(--rule-soft)] pt-3 text-sm max-[520px]:grid-cols-1">
          <div><p className="text-xs text-ink-3">Entrada · {resumo.mesLabel}</p><p className="mt-1 tabular-nums">{resumo.entrada == null ? "—" : fmtBRL(resumo.entrada)}</p></div>
          <div><p className="text-xs text-ink-3">Saída</p><p className="mt-1 tabular-nums">{resumo.saida == null ? "—" : fmtBRL(resumo.saida)}</p></div>
          <div><p className="text-xs text-ink-3">Fluxo</p><p className="mt-1 tabular-nums">{resumo.fluxo == null ? "—" : fmtBRL(resumo.fluxo)}</p></div>
        </div>
      )}
    </CardComAtalho>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter rionovo-client exec vitest run src/inicio/components/InicioCards.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/inicio/components/InicioCards.tsx client/src/inicio/components/InicioCards.test.tsx
git commit -m "feat(inicio): cards de atenção, leite hoje e caixa"
```

---

### Task 3: Entrypoint InicioContent

**Files:**
- Create: `client/src/inicio/InicioContent.tsx`
- Test: `client/src/inicio/InicioContent.test.tsx`

**Interfaces:**
- Consumes: `useDashboard` de `../rebanho/api` (retorna `{ data, loading, erro }` com `DashboardData`); `fetchDashboard` de `../api`; cards da Task 2; derives da Task 1.
- Produces: `function InicioContent(props: { onNav: (tab: string) => void }): JSX.Element`
  - onNav é chamado com `"reb-dashboard"` (leite), `"dashboard"` (caixa), e `"reb-" + tab` para itens de atenção (a `tab` do alerta é um `RebanhoTab` como "sanidade"/"reproducao").

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { createElement } from "react";
import { render, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// mocka os dois fetchers para não bater em rede
vi.mock("../rebanho/api", () => ({
  useDashboard: () => ({
    data: { herois: { producaoTotalDia: { valor: 980, unidade: "L", variacaoPercentual: 3 }, vacasEmLactacao: { valor: 98 }, producaoMediaVaca: { valor: 10 } }, alertas: [] },
    loading: false, erro: null,
  }),
}));
vi.mock("../api", () => ({
  fetchDashboard: () => Promise.resolve({ creditoTotal: [0, 5000], debitoTotal: [0, 3000], caixaHoje: { total: 12345.67 } }),
}));

import { InicioContent } from "./InicioContent";

afterEach(cleanup);

describe("InicioContent", () => {
  it("renderiza os três blocos com dados", async () => {
    const { getByText } = render(createElement(InicioContent, { onNav: () => {} }));
    expect(getByText("Precisa de atenção")).toBeTruthy();
    expect(getByText("Leite hoje")).toBeTruthy();
    await waitFor(() => expect(getByText("Caixa")).toBeTruthy());
    expect(getByText(/980/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter rionovo-client exec vitest run src/inicio/InicioContent.test.tsx`
Expected: FAIL — "Failed to load url ./InicioContent".

- [ ] **Step 3: Write minimal implementation**

```tsx
import { useEffect, useState } from "react";
import { useDashboard } from "../rebanho/api";
import { fetchDashboard } from "../api";
import { AtencaoCard, CaixaCard, LeiteHojeCard } from "./components/InicioCards";
import { resumoAtencao, resumoCaixa, resumoLeite, type ResumoCaixa } from "./lib/inicioDerive";

const CAIXA_VAZIO: ResumoCaixa = { saldo: null, mesLabel: null, entrada: null, saida: null, fluxo: null };

export function InicioContent({ onNav }: { onNav: (tab: string) => void }) {
  const reb = useDashboard();
  const [fin, setFin] = useState<unknown>(null);
  const [finErro, setFinErro] = useState(false);
  const [finLoading, setFinLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    fetchDashboard()
      .then((d) => { if (vivo) setFin(d); })
      .catch(() => { if (vivo) setFinErro(true); })
      .finally(() => { if (vivo) setFinLoading(false); });
    return () => { vivo = false; };
  }, []);

  const leite = resumoLeite(reb.data);
  const atencao = resumoAtencao(reb.data);
  const caixa = fin ? resumoCaixa(fin) : CAIXA_VAZIO;

  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-5 px-6 pt-7 pb-20 max-[620px]:px-4">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[.14em] text-ink-3">Início</span>
        <h1 className="font-serif text-[30px] font-medium tracking-[-.01em]">Como a fazenda está hoje</h1>
      </header>
      <AtencaoCard itens={atencao} onAbrir={(tab) => onNav("reb-" + tab)} />
      <LeiteHojeCard resumo={leite} loading={reb.loading} erro={!!reb.erro} onVer={() => onNav("reb-dashboard")} />
      <CaixaCard resumo={caixa} loading={finLoading} erro={finErro} onVer={() => onNav("dashboard")} />
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter rionovo-client exec vitest run src/inicio/InicioContent.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add client/src/inicio/InicioContent.tsx client/src/inicio/InicioContent.test.tsx
git commit -m "feat(inicio): entrypoint InicioContent junta os dois dashboards"
```

---

### Task 4: Registrar Tab, rota e item de sidebar; tornar tela inicial

**Files:**
- Modify: `client/src/components/Shell.tsx` (union `Tab` — adicionar `"inicio"`)
- Modify: `client/src/router.ts` (mapa de slug + `DEFAULT_TAB`)
- Modify: `client/src/components/AppSidebar.tsx` (item "Início" no topo + ícone)
- Modify: `client/src/App.tsx` (montar `InicioContent`, usar `"inicio"` como aba inicial)
- Test: `client/src/router.test.ts` (adicionar caso `inicio ⇄ /inicio`)

**Interfaces:**
- Consumes: `InicioContent` (Task 3).
- Produces: `Tab` passa a incluir `"inicio"`; `/inicio` deep-linkável; app abre em `"inicio"`.

- [ ] **Step 1: Write the failing test (router)**

Adicionar em `client/src/router.test.ts` (usar os helpers já importados no arquivo — `tabToPath`, `pathToTab`):

```ts
it("mapeia inicio ⇄ /inicio", () => {
  expect(tabToPath("inicio")).toBe("/inicio");
  expect(pathToTab("/inicio")).toBe("inicio");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter rionovo-client exec vitest run src/router.test.ts`
Expected: FAIL — `tabToPath("inicio")` retorna fallback (não `/inicio`); e/ou erro de tipo `"inicio"` não está em `Tab`.

- [ ] **Step 3: Implementar Tab + rota + sidebar + App**

Em `client/src/components/Shell.tsx`, no início do union `Tab`:

```ts
export type Tab =
  | "inicio"
  | "dashboard" | "gastos" | "lancar" | "caixinha" | "plano" | "ia" | "relatorio" | "acessos" | "config" | "cadastros"
  // ... resto inalterado
```

Em `client/src/router.ts`, no mapa de slug fixo (perto de `dashboard: "/dashboard"`):

```ts
  inicio: "/inicio",
```

E trocar o default:

```ts
export const DEFAULT_TAB: Tab = "inicio";
```

Em `client/src/components/AppSidebar.tsx`, adicionar o ícone ao mapa `ICON`:

```ts
  inicio: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></>,
```

E renderizar o item "Início" no topo, **antes** da seção "GESTÃO". Seguir exatamente o mesmo componente/botão de item que as abas de GESTÃO usam (mesmo handler de seleção de `Tab`, mesmo estilo de "ativo"), adicionando uma entrada `{ id: "inicio", label: "Início" }` renderizada acima do grupo. Não criar um novo mecanismo de navegação — reusar o existente.

Em `client/src/App.tsx`:
- Importar: `import { InicioContent } from "./inicio/InicioContent";`
- No render, **antes** do bloco `tab === "dashboard"`:

```tsx
{tab === "inicio" && <InicioContent onNav={(t) => navegarTab(t as Tab)} />}
```

- A aba inicial já vem de `DEFAULT_TAB` via `pathToTab` no `useState<Tab>` inicial — confirmar que, sem deep-link, cai em `"inicio"`.
- Conferir a lógica de "abas permitidas" (`allowed`/`visibleTabs`): garantir que `"inicio"` é sempre permitida (não depende de flag), senão o fallback `setTab(allowed[0])` pode expulsar da Home. Se a lista de permitidas for derivada de `ABAS`/`effectiveUser.abas`, tratar `"inicio"` como sempre-visível (curto-circuito antes do filtro).

- [ ] **Step 4: Run tests + build**

Run: `pnpm --filter rionovo-client exec vitest run src/router.test.ts`
Expected: PASS.

Run: `pnpm --filter rionovo-client run build`
Expected: exit 0 (sem erro de tipo — `"inicio"` reconhecido em toda parte).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Shell.tsx client/src/router.ts client/src/components/AppSidebar.tsx client/src/App.tsx client/src/router.test.ts
git commit -m "feat(inicio): registra Tab/rota/sidebar e torna Início a tela inicial"
```

---

### Task 5: Verificação final (suíte + build + navegador)

**Files:** nenhum (verificação).

- [ ] **Step 1: Suíte completa do client**

Run: `pnpm --filter rionovo-client run test`
Expected: todos PASS (inclui os novos: inicioDerive 6, InicioCards 5, InicioContent 1, router +1).

- [ ] **Step 2: Build**

Run: `pnpm --filter rionovo-client run build`
Expected: exit 0 (só o aviso pré-existente de chunk grande).

- [ ] **Step 3: Validação no navegador**

`pnpm dev`, abrir `http://localhost:41875/` (sem path) → deve cair em Início. Conferir:
- Cabeçalho "Como a fazenda está hoje".
- Card Leite hoje com número de produção (bate com o Painel do Rebanho).
- Card Caixa com saldo + mês rotulado.
- Precisa de atenção com alertas (ou "Operação em dia").
- Atalhos: "Ver rebanho" → Painel do Rebanho; "Ver financeiro" → Dashboard; item de atenção → aba correta.
- Trocar propriedade ativa muda os números.

- [ ] **Step 4: Commit (se algum ajuste visual for necessário)**

```bash
git add -A && git commit -m "fix(inicio): ajustes de validação visual"
```

---

## Self-Review (autor)

- **Cobertura da spec:** §3 blocos → Tasks 1–3; §4 arquitetura → Tasks 1–3; §5 dados (reuso) → Task 1/3; §6 estados → Task 2 (loading/erro/vazio nos cards); §7 navegação/tela inicial → Task 4; §8 testes → Tasks 1–5. ✔
- **Placeholders:** nenhum "TODO/TBD"; todo código está inline. ✔
- **Consistência de tipos:** `ResumoLeite/ResumoCaixa/ResumoAtencao` definidos na Task 1 e usados idênticos nas Tasks 2–3; `onNav(tab: string)` consistente entre Task 3 e Task 4. ✔
- **Ressalva conhecida (spec §5):** `caixaHoje.total` hoje é fluxo acumulado (saldos de abertura zerados no banco) — rótulo "Saldo em caixa" aceito na spec; sem ação no código.
