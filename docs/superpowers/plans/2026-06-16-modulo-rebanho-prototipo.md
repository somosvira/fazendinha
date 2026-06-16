# Módulo Rebanho — Protótipo (4 abas + cockpit + IA) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a navigable, mock-data prototype of a herd-management module (Animal, Reprodução, Sanidade, Nutrição) using approach C (herd work-lists → animal cockpit), with a left sidebar shell and proactive AI insight cards, in the fazendinha visual language.

**Architecture:** New self-contained `client/src/rebanho/` module with its own dark **sidebar shell** that takes over the screen when active (the existing financial app is untouched). A small `useState`-based internal nav holds `{ tab, animalId }` (matching the project's no-router idiom). A pure **logic layer** (derivations, work-list selectors, timeline builder) is TDD'd with Vitest; presentational components are built to match the approved mockups and verified visually.

**Tech Stack:** React 18 + Vite + TypeScript (existing). Adds **Vitest** (dev-only) for unit tests. No new runtime deps. Reuses CSS variables from `client/src/styles/base.css`.

**Source of truth for visuals:** the approved brainstorming spec [docs/superpowers/specs/2026-06-16-modulo-rebanho-design.md](../specs/2026-06-16-modulo-rebanho-design.md). All markup/colors below are ported from the mockups validated there.

**Conventions (from CLAUDE.md):** pnpm workspaces; run client commands via `pnpm --filter rionovo-client`. Client imports do **not** carry file extensions. Identifiers/domain in PT-BR. Reuse `fmt/fmtBR` from `components/charts.tsx` for number formatting where useful.

**Decisions locked here (were open in the spec):**
- **Routing:** internal `useState` nav inside `RebanhoApp` (no react-router) — matches `App.tsx`.
- **Events in the prototype:** modeled as one normalized `EventoTimeline` shape (the timeline is their only consumer in step 1). Typed per-event tables are backend/future work — not built now.
- **"Today":** a fixed `HOJE = "2026-06-16"` constant so mock-derived numbers are stable (mirrors how the financial mock pins a date).

---

## File Structure

```
client/
  vitest.config.ts                      [create] — test runner config
  package.json                          [modify] — add vitest devDep + "test" script
  src/
    main.tsx                            [modify] — import rebanho/styles/rebanho.css
    App.tsx                             [modify] — render <RebanhoApp/> when tab==="rebanho" (early return)
    components/Shell.tsx                [modify] — add "rebanho" to Tab union
    rebanho/
      types.ts                          [create] — domain types & enums
      HOJE.ts                           [create] — fixed "today" constant
      lib/
        derive.ts                       [create] — del(), idadeMeses(), diffDias()
        derive.test.ts                  [create]
        worklists.ts                    [create] — aInseminar/dgPendente/aSecar/partosPrevistos
        worklists.test.ts               [create]
        timeline.ts                     [create] — buildTimeline()
        timeline.test.ts                [create]
      mock/
        animais.ts                      [create] — Animal[] + ResumoAnimal[]
        eventos.ts                      [create] — EventoTimeline[]
        insights.ts                     [create] — IaInsight[]
        index.ts                        [create] — assembled dataset + helpers
        mock.test.ts                    [create] — dataset invariants
      nav.ts                            [create] — RebanhoTab type + useRebanhoNav()
      domains.tsx                       [create] — per-domain config (KPIs, worklists, columns)
      components/
        Sidebar.tsx                     [create]
        IaInsight.tsx                   [create] — <IaInsightCard/> + <IaInsightBand/>
        HerdDomainView.tsx              [create]
        Timeline.tsx                    [create]
        AnimalCockpit.tsx               [create]
      RebanhoApp.tsx                    [create] — shell: sidebar + view switch
      styles/
        rebanho.css                     [create] — all module styles (ported from mockups)
```

---

## Task 1: Vitest setup

**Files:**
- Modify: `client/package.json`
- Create: `client/vitest.config.ts`
- Create: `client/src/rebanho/lib/smoke.test.ts` (temporary)

- [ ] **Step 1: Add the failing test**

Create `client/src/rebanho/lib/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("vitest wiring", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Add vitest dep + script**

In `client/package.json`, add to `devDependencies`: `"vitest": "^2.1.8"`. Add to `scripts`: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 3: Create `client/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Install and run**

Run: `pnpm install` (from repo root), then `pnpm --filter rionovo-client test`
Expected: 1 passed.

- [ ] **Step 5: Remove smoke test and commit**

```bash
rm client/src/rebanho/lib/smoke.test.ts
git add client/package.json client/vitest.config.ts pnpm-lock.yaml
git commit -m "chore(rebanho): add vitest for the herd module logic layer"
```

---

## Task 2: Module styles (`rebanho.css`)

This is the consolidated, de-duplicated CSS from the approved mockups (sidebar + herd view + cockpit). Reuses the palette literally (the values match `base.css`).

**Files:**
- Create: `client/src/rebanho/styles/rebanho.css`
- Modify: `client/src/main.tsx`

- [ ] **Step 1: Create `client/src/rebanho/styles/rebanho.css`**

```css
/* Módulo Rebanho — escopo .rb (não vaza pro financeiro) */
.rb { --side-w: 222px; background: var(--bg); color: var(--ink); font-family: var(--sans); min-height: 100vh; }

/* sidebar */
.rb-side { position: fixed; top: 0; left: 0; bottom: 0; width: var(--side-w); background: var(--mast-bg); color: var(--mast-ink); display: flex; flex-direction: column; padding: 18px 0; z-index: 5; }
.rb-side .brand { padding: 0 20px 16px; border-bottom: 1px solid #23291f; margin-bottom: 6px; }
.rb-side .brand .lg { font-family: var(--serif); font-size: 20px; font-weight: 600; line-height: 1; }
.rb-side .brand .farm { margin-top: 10px; display: flex; align-items: center; justify-content: space-between; background: var(--mast-bg-2); border: 1px solid #2a3025; border-radius: 8px; padding: 7px 10px; font-size: 12.5px; color: var(--mast-ink-2); cursor: pointer; }
.rb-side .grp { padding: 14px 20px 6px; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #6f6a58; }
.rb-side button.navi { width: 100%; text-align: left; display: flex; align-items: center; gap: 11px; padding: 9px 20px; color: var(--mast-ink-2); background: none; border: 0; cursor: pointer; font-family: var(--sans); font-size: 14px; border-left: 3px solid transparent; }
.rb-side button.navi svg { width: 17px; height: 17px; flex: none; opacity: .85; }
.rb-side button.navi:hover { color: var(--mast-ink); background: #161b17; }
.rb-side button.navi.on { color: var(--mast-ink); border-left-color: var(--leite); background: #171d18; font-weight: 600; }
.rb-side button.navi.on svg { opacity: 1; color: var(--leite); }
.rb-side .ia-btn { margin: 8px 16px 0; display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--leite); color: var(--mast-bg); font-weight: 700; border: 0; border-radius: 9px; padding: 10px; font-size: 13.5px; cursor: pointer; font-family: var(--sans); }
.rb-side .spacer { flex: 1; }
.rb-side .user { margin: 0 16px; padding-top: 14px; border-top: 1px solid #23291f; display: flex; align-items: center; gap: 10px; }
.rb-side .user .av { width: 30px; height: 30px; border-radius: 50%; background: var(--leite); color: var(--mast-bg); display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-weight: 600; font-size: 14px; }
.rb-side .user .nm { font-size: 13px; color: var(--mast-ink); } .rb-side .user .rl { font-size: 11px; color: var(--mast-ink-2); }

/* content shell */
.rb-main { margin-left: var(--side-w); max-width: 1100px; padding: 26px 40px 70px; }
.rb-eyebrow { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--cafe); font-weight: 700; }
.rb-crumb { font-size: 12.5px; color: var(--ink-3); margin-bottom: 16px; background: none; border: 0; cursor: pointer; font-family: var(--sans); padding: 0; }
.rb-crumb b { color: var(--ink-2); }
.rb-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; border-bottom: 1px solid var(--rule); padding-bottom: 16px; margin-top: 4px; }
.rb-head h1 { font-family: var(--serif); font-weight: 500; font-size: 38px; margin: 4px 0 0; line-height: 1.05; }
.rb-head h1 small { color: var(--ink-mute); font-size: 24px; font-weight: 400; }
.rb-head .period { font-size: 12.5px; color: var(--ink-3); border: 1px solid var(--rule); border-radius: 8px; padding: 7px 12px; background: var(--bg-card); }
.rb-sub { margin-top: 7px; color: var(--ink-3); font-size: 13.5px; }
.rb-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.rb-chip { font-size: 12.5px; font-weight: 600; padding: 5px 11px; border-radius: 13px; border: 1px solid var(--rule); }
.rb-chip.preg { background: var(--cafe-soft); color: var(--cafe); border-color: #D8C3A8; }
.rb-chip.lact { background: var(--leite-soft); color: #6e5a26; border-color: #E0CF9E; }

/* KPI strip (configurable columns via --cols) */
.rb-kstrip { display: grid; grid-template-columns: repeat(var(--cols, 6), 1fr); gap: 1px; background: var(--rule-soft); border: 1px solid var(--rule-soft); margin: 18px 0; border-radius: 8px; overflow: hidden; }
.rb-k { background: var(--bg-card); padding: 12px 13px; }
.rb-k .lab { font-size: 10.5px; letter-spacing: .04em; text-transform: uppercase; color: var(--ink-mute); font-weight: 600; }
.rb-k .val { font-family: var(--serif); font-size: 24px; margin-top: 3px; line-height: 1; }
.rb-k .val u { text-decoration: none; font-size: 13px; color: var(--ink-3); }
.rb-k .d { font-size: 11px; margin-top: 3px; color: var(--ink-3); }
.rb-up { color: var(--neg); } .rb-ok { color: var(--pos); }

/* IA */
.rb-ia-card { display: flex; gap: 14px; align-items: flex-start; background: linear-gradient(180deg,#fbf7ec,#f6efdf); border: 1px solid #E2D3AE; border-left: 3px solid var(--leite); border-radius: 10px; padding: 15px 17px; margin: 20px 0; }
.rb-ia-band { display: flex; align-items: center; gap: 13px; background: linear-gradient(180deg,#fbf7ec,#f6efdf); border: 1px solid #E2D3AE; border-left: 3px solid var(--leite); border-radius: 10px; padding: 13px 16px; margin-bottom: 22px; }
.rb-ia-dot { flex: none; width: 30px; height: 30px; border-radius: 50%; background: var(--mast-bg); color: var(--leite); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; font-family: var(--serif); }
.rb-ia-card h4 { margin: 0 0 3px; font-size: 14.5px; } .rb-ia-card p, .rb-ia-band p { margin: 0; color: var(--ink-2); font-size: 13.5px; }
.rb-ia-act { margin-top: 9px; display: flex; gap: 8px; }
.rb-ia-band button.cta { margin-left: auto; flex: none; }
.rb-btn { font-family: var(--sans); font-size: 12.5px; font-weight: 600; border-radius: 8px; padding: 7px 13px; cursor: pointer; border: 1px solid var(--rule); background: transparent; color: var(--ink-2); }
.rb-btn.pri { background: var(--mast-bg); color: var(--mast-ink); border: 0; }

/* tasks + table */
.rb-sec-title { font-family: var(--serif); font-size: 20px; font-weight: 500; margin: 0 0 12px; }
.rb-tasks { display: flex; gap: 12px; margin-bottom: 18px; }
.rb-task { flex: 1; background: var(--bg-card); border: 1px solid var(--rule-soft); border-radius: 10px; padding: 13px 15px; cursor: pointer; border-left: 3px solid transparent; text-align: left; font-family: var(--sans); }
.rb-task:hover { background: var(--bg-card-2); }
.rb-task.on { border-left-color: var(--cafe); background: #fff; }
.rb-task .n { font-family: var(--serif); font-size: 27px; line-height: 1; } .rb-task .l { font-size: 12.5px; color: var(--ink-3); margin-top: 3px; }
.rb-task.alert .n { color: var(--neg); }
.rb-listhead { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
.rb-listhead h3 { font-family: var(--serif); font-size: 18px; font-weight: 500; margin: 0; }
.rb-listhead .hint { font-size: 12.5px; color: var(--ink-3); }
.rb-tbl { width: 100%; border-collapse: collapse; background: var(--bg-card); border: 1px solid var(--rule-soft); border-radius: 10px; overflow: hidden; }
.rb-tbl th { font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-mute); text-align: left; padding: 10px 14px; border-bottom: 1px solid var(--rule-soft); font-weight: 600; }
.rb-tbl td { padding: 11px 14px; border-bottom: 1px solid var(--rule-soft); font-size: 13.5px; color: var(--ink-2); }
.rb-tbl tr:last-child td { border: 0; }
.rb-tbl tr.row { cursor: pointer; } .rb-tbl tr.row:hover td { background: var(--bg-card-2); }
.rb-anm { font-weight: 600; color: var(--ink); } .rb-anm small { color: var(--ink-mute); font-weight: 400; }
.rb-pill { font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: 11px; background: var(--outros-soft); color: #42523a; }
.rb-pill.warn { background: var(--leite-soft); color: #6e5a26; } .rb-pill.bad { background: #EEDAD3; color: var(--neg); }

/* cockpit */
.rb-stats { display: grid; grid-template-columns: repeat(6,1fr); gap: 1px; background: var(--rule-soft); border: 1px solid var(--rule-soft); margin: 18px 0 6px; border-radius: 8px; overflow: hidden; }
.rb-stat { background: var(--bg-card); padding: 13px 14px; }
.rb-stat .k { font-size: 11px; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-mute); font-weight: 600; }
.rb-stat .v { font-family: var(--serif); font-size: 25px; margin-top: 3px; line-height: 1; } .rb-stat .v u { text-decoration: none; font-size: 13px; color: var(--ink-3); }
.rb-stat .t { font-size: 11.5px; margin-top: 4px; }
.rb-grid { display: grid; grid-template-columns: 1fr 280px; gap: 26px; margin-top: 8px; }
.rb-sec-sub { color: var(--ink-3); font-size: 12.5px; margin: 0 0 16px; }
.rb-tl { position: relative; margin-left: 6px; padding-left: 24px; border-left: 2px solid var(--rule); }
.rb-ev { position: relative; padding: 0 0 20px; }
.rb-ev::before { content: ""; position: absolute; left: -31px; top: 3px; width: 11px; height: 11px; border-radius: 50%; background: var(--ink); border: 2px solid var(--bg); }
.rb-ev.reproducao::before { background: var(--cafe); } .rb-ev.sanidade::before { background: var(--neg); }
.rb-ev.nutricao::before { background: var(--outros); } .rb-ev.producao::before { background: var(--leite); }
.rb-ev .when { font-size: 11.5px; color: var(--ink-mute); font-weight: 600; }
.rb-ev .tag { display: inline-block; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; font-weight: 700; padding: 1px 7px; border-radius: 9px; margin-left: 8px; vertical-align: 1px; }
.rb-ev .tag.reproducao { background: var(--cafe-soft); color: var(--cafe); } .rb-ev .tag.sanidade { background: #EEDAD3; color: var(--neg); }
.rb-ev .tag.nutricao { background: var(--outros-soft); color: #42523a; } .rb-ev .tag.producao { background: var(--leite-soft); color: #6e5a26; }
.rb-ev h5 { margin: 4px 0 2px; font-size: 15px; font-weight: 600; } .rb-ev p { margin: 0; color: var(--ink-3); font-size: 13px; }
.rb-ev .flag { color: var(--neg); font-weight: 600; }
.rb-tl-marker { font-family: var(--serif); color: var(--ink-mute); font-size: 13px; margin: 2px 0 12px; font-style: italic; }
.rb-box { background: var(--bg-card); border: 1px solid var(--rule-soft); border-radius: 10px; padding: 15px 16px; margin-bottom: 16px; }
.rb-box h4 { margin: 0 0 11px; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); }
.rb-kv { display: flex; justify-content: space-between; font-size: 13.5px; padding: 5px 0; border-bottom: 1px dashed var(--rule-soft); }
.rb-kv:last-child { border: 0; } .rb-kv b { font-weight: 600; }
.rb-ped { display: flex; flex-direction: column; gap: 6px; font-size: 13px; } .rb-ped button { background: none; border: 0; color: var(--cafe); font-weight: 600; cursor: pointer; padding: 0; font-family: var(--sans); font-size: 13px; }
```

- [ ] **Step 2: Register the stylesheet** — in `client/src/main.tsx`, add after the other style imports:
```ts
import "./rebanho/styles/rebanho.css";
```

- [ ] **Step 3: Commit**
```bash
git add client/src/rebanho/styles/rebanho.css client/src/main.tsx
git commit -m "feat(rebanho): module stylesheet (sidebar + herd + cockpit)"
```

---

## Task 3: Domain types

**Files:**
- Create: `client/src/rebanho/types.ts`
- Create: `client/src/rebanho/HOJE.ts`

- [ ] **Step 1: Create `client/src/rebanho/HOJE.ts`**
```ts
// "Hoje" fixo pro mock (números derivados estáveis). Mirrors the financial mock's pinned date.
export const HOJE = "2026-06-16";
```

- [ ] **Step 2: Create `client/src/rebanho/types.ts`**
```ts
export type Sexo = "F" | "M";
export type CategoriaAnimal = "BEZERRA" | "NOVILHA" | "VACA" | "BEZERRO" | "TOURO";
export type StatusReprodutivo = "PEV" | "VAZIA" | "INSEMINADA" | "PRENHE";
export type Dominio = "reproducao" | "sanidade" | "nutricao" | "producao";

export interface Animal {
  id: string;            // ex.: "1234"
  numero: string;        // identificação visível
  nome: string;
  sexo: Sexo;
  categoria: CategoriaAnimal;
  raca: string;          // "Girolando 5/8"
  dataNascimento: string; // ISO "YYYY-MM-DD"
  dataEntrada: string;
  brincoEletronico?: string;
  sisbov?: string;
  maeId?: string;
  paiNome?: string;
  grupoAtual?: string;   // lote
  setor?: string;
  ativo: boolean;
}

// Read-model pré-computado por animal (espelha ANIMALINFO_* do Ideagri)
export interface ResumoAnimal {
  animalId: string;
  statusReprodutivo: StatusReprodutivo;
  del?: number;                 // dias em leite
  ordemLactacao?: number;
  producaoMediaDia?: number;    // L/d
  producao305?: number;
  ccs?: number;                 // mil cél/mL
  ccsTendencia?: "subindo" | "estavel" | "caindo";
  ultimoDgData?: string;        // ISO
  ultimoDgResultado?: "positivo" | "negativo";
  iepProjetado?: number;        // dias
  diasGestacao?: number;
  previsaoSecagem?: string;     // ISO
  ultimaInseminacao?: string;   // ISO
  protocoloAtual?: string;
}

// Evento normalizado — única forma consumida pela timeline no protótipo.
export interface EventoTimeline {
  id: string;
  animalId: string;
  data: string;        // ISO
  dominio: Dominio;
  titulo: string;
  detalhe?: string;
  alerta?: boolean;
  marcador?: string;   // ex.: "início da 3ª lactação" (separador na timeline)
}

export interface IaInsight {
  id: string;
  escopo: "rebanho" | "animal";
  dominio: Dominio;
  animalId?: string;
  texto: string;       // pode conter <b> simples
  acoes: { label: string; primaria?: boolean }[];
}
```

- [ ] **Step 3: Typecheck & commit**

Run: `pnpm --filter rionovo-client exec tsc -b --noEmit` — Expected: no errors.
```bash
git add client/src/rebanho/types.ts client/src/rebanho/HOJE.ts
git commit -m "feat(rebanho): domain types + pinned HOJE"
```

---

## Task 4: Derivations (`derive.ts`) — TDD

**Files:**
- Create: `client/src/rebanho/lib/derive.ts`
- Test: `client/src/rebanho/lib/derive.test.ts`

- [ ] **Step 1: Write the failing test** — `client/src/rebanho/lib/derive.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { diffDias, del, idadeMeses } from "./derive";

describe("diffDias", () => {
  it("conta dias entre duas datas ISO", () => {
    expect(diffDias("2026-01-22", "2026-06-16")).toBe(145);
  });
  it("é negativo quando a segunda data é anterior", () => {
    expect(diffDias("2026-06-16", "2026-01-22")).toBe(-145);
  });
});

describe("del", () => {
  it("dias em leite = hoje - dataParto", () => {
    expect(del("2026-01-22", "2026-06-16")).toBe(145);
  });
  it("undefined se não há parto", () => {
    expect(del(undefined, "2026-06-16")).toBeUndefined();
  });
});

describe("idadeMeses", () => {
  it("retorna idade em meses inteiros", () => {
    expect(idadeMeses("2020-03-12", "2026-06-16")).toBe(75);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter rionovo-client test`
Expected: FAIL — "Cannot find module './derive'".

- [ ] **Step 3: Implement `client/src/rebanho/lib/derive.ts`**
```ts
const MS_DIA = 86_400_000;

export function diffDias(de: string, ate: string): number {
  return Math.round((Date.parse(ate) - Date.parse(de)) / MS_DIA);
}

export function del(dataParto: string | undefined, hoje: string): number | undefined {
  if (!dataParto) return undefined;
  return diffDias(dataParto, hoje);
}

export function idadeMeses(dataNascimento: string, hoje: string): number {
  const n = new Date(dataNascimento);
  const h = new Date(hoje);
  return (h.getFullYear() - n.getFullYear()) * 12 + (h.getMonth() - n.getMonth()) - (h.getDate() < n.getDate() ? 1 : 0);
}
```

- [ ] **Step 4: Run to verify it passes** — Run: `pnpm --filter rionovo-client test` — Expected: derive tests PASS.

- [ ] **Step 5: Commit**
```bash
git add client/src/rebanho/lib/derive.ts client/src/rebanho/lib/derive.test.ts
git commit -m "feat(rebanho): date/lactation derivations (TDD)"
```

---

## Task 5: Mock dataset

Believable data that matches the approved mockups (Jurema #1234 + the 5 vacas "a inseminar").

**Files:**
- Create: `client/src/rebanho/mock/animais.ts`, `mock/eventos.ts`, `mock/insights.ts`, `mock/index.ts`
- Test: `client/src/rebanho/mock/mock.test.ts`

- [ ] **Step 1: Create `client/src/rebanho/mock/animais.ts`**
```ts
import type { Animal, ResumoAnimal } from "../types";

export const animais: Animal[] = [
  { id: "1234", numero: "1234", nome: "Jurema", sexo: "F", categoria: "VACA", raca: "Girolando 5/8", dataNascimento: "2020-03-12", dataEntrada: "2020-03-12", brincoEletronico: "982000123456789", maeId: "0871", paiNome: "Lance 612", grupoAtual: "Alta Produção", setor: "Galpão 2", ativo: true },
  { id: "1188", numero: "1188", nome: "Aurora", sexo: "F", categoria: "VACA", raca: "Girolando 1/2", dataNascimento: "2021-06-02", dataEntrada: "2021-06-02", grupoAtual: "Alta Produção", ativo: true },
  { id: "0942", numero: "0942", nome: "Bonita", sexo: "F", categoria: "VACA", raca: "Holandês", dataNascimento: "2020-09-18", dataEntrada: "2020-09-18", grupoAtual: "Média Produção", ativo: true },
  { id: "1305", numero: "1305", nome: "Cravina", sexo: "F", categoria: "VACA", raca: "Girolando 3/4", dataNascimento: "2021-01-05", dataEntrada: "2021-01-05", grupoAtual: "Média Produção", ativo: true },
  { id: "0877", numero: "0877", nome: "Dália", sexo: "F", categoria: "VACA", raca: "Girolando 5/8", dataNascimento: "2020-04-22", dataEntrada: "2020-04-22", grupoAtual: "Alta Produção", ativo: true },
  { id: "1421", numero: "1421", nome: "Estrela", sexo: "F", categoria: "VACA", raca: "Holandês", dataNascimento: "2021-08-30", dataEntrada: "2021-08-30", grupoAtual: "Média Produção", ativo: true },
  { id: "0871", numero: "0871", nome: "Jandira", sexo: "F", categoria: "VACA", raca: "Girolando 5/8", dataNascimento: "2018-02-10", dataEntrada: "2018-02-10", grupoAtual: "Alta Produção", ativo: true },
  { id: "1442", numero: "1442", nome: "Bezerra 1442", sexo: "F", categoria: "BEZERRA", raca: "Girolando 9/16", dataNascimento: "2026-01-22", dataEntrada: "2026-01-22", maeId: "1234", paiNome: "Lance 884", grupoAtual: "Bezerreiro", ativo: true },
];

export const resumos: ResumoAnimal[] = [
  { animalId: "1234", statusReprodutivo: "PRENHE", del: 145, ordemLactacao: 3, producaoMediaDia: 28, producao305: 8900, ccs: 512, ccsTendencia: "subindo", ultimoDgData: "2026-05-28", ultimoDgResultado: "positivo", iepProjetado: 395, diasGestacao: 30, previsaoSecagem: "2026-12-12", ultimaInseminacao: "2026-04-28", protocoloAtual: "IATF 11d" },
  { animalId: "1188", statusReprodutivo: "PEV", del: 72, ordemLactacao: 2, producaoMediaDia: 31, ccs: 180, ccsTendencia: "estavel", protocoloAtual: "IATF 11d (D0)" },
  { animalId: "0942", statusReprodutivo: "VAZIA", del: 96, ordemLactacao: 3, producaoMediaDia: 24, ccs: 240, ccsTendencia: "estavel", ultimoDgData: "2026-05-14", ultimoDgResultado: "negativo", protocoloAtual: "IATF 11d (D9)" },
  { animalId: "1305", statusReprodutivo: "VAZIA", del: 110, ordemLactacao: 2, producaoMediaDia: 22, ccs: 300, ccsTendencia: "subindo", ultimoDgData: "2026-05-02", ultimoDgResultado: "negativo" },
  { animalId: "0877", statusReprodutivo: "PEV", del: 68, ordemLactacao: 4, producaoMediaDia: 33, ccs: 150, ccsTendencia: "estavel" },
  { animalId: "1421", statusReprodutivo: "VAZIA", del: 83, ordemLactacao: 1, producaoMediaDia: 26, ccs: 210, ccsTendencia: "estavel", ultimoDgData: "2026-05-20", ultimoDgResultado: "negativo" },
  { animalId: "0871", statusReprodutivo: "PRENHE", del: 210, ordemLactacao: 4, producaoMediaDia: 21, ccs: 130, ccsTendencia: "estavel", iepProjetado: 402, diasGestacao: 95, previsaoSecagem: "2026-09-30" },
];
```

- [ ] **Step 2: Create `client/src/rebanho/mock/eventos.ts`** (Jurema's timeline from the approved cockpit)
```ts
import type { EventoTimeline } from "../types";

export const eventos: EventoTimeline[] = [
  { id: "e1", animalId: "1234", data: "2026-05-28", dominio: "reproducao", titulo: "Diagnóstico de gestação — POSITIVO", detalhe: "~30 dias de gestação · sêmen Girolando \"Lance 884\" · parto previsto 22/02/2027" },
  { id: "e2", animalId: "1234", data: "2026-05-12", dominio: "sanidade", titulo: "Controle leiteiro — CCS 512 mil", detalhe: "Terceira alta consecutiva · gordura 3,8% · proteína 3,2%", alerta: true },
  { id: "e3", animalId: "1234", data: "2026-04-28", dominio: "reproducao", titulo: "Inseminação artificial (IATF)", detalhe: "Protocolo IATF 11 dias · reprodutor \"Lance 884\" · 1ª tentativa" },
  { id: "e4", animalId: "1234", data: "2026-04-14", dominio: "sanidade", titulo: "Mastite clínica — quarto posterior direito", detalhe: "Tratamento intramamário · carência do leite 96h (até 18/04) · lote produto MAST-2231" },
  { id: "e5", animalId: "1234", data: "2026-03-20", dominio: "nutricao", titulo: "Realocada → lote \"Alta Produção\"", detalhe: "Dieta lactação alta · 18% PB · 1,68 Mcal/kg" },
  { id: "e6", animalId: "1234", data: "2026-01-22", dominio: "reproducao", titulo: "Parto — cria ♀ #1442 viva", detalhe: "Parto normal · escore de colostro Brix 24% (ótimo) · sem retenção de placenta", marcador: "início da 3ª lactação" },
  { id: "e7", animalId: "1234", data: "2025-12-18", dominio: "nutricao", titulo: "Secagem da 2ª lactação", detalhe: "Motivo: fim de ciclo · 305 dias · produção total 8.420 L" },
];
```

- [ ] **Step 3: Create `client/src/rebanho/mock/insights.ts`**
```ts
import type { IaInsight } from "../types";

export const insights: IaInsight[] = [
  { id: "i-rep", escopo: "rebanho", dominio: "reproducao", texto: "A taxa de concepção caiu de <b>42% → 31%</b> nos últimos 3 lotes de IATF — concentrada no reprodutor <b>\"Lance 884\"</b>. Pode ser partida de sêmen ou manejo.", acoes: [{ label: "Investigar com a IA", primaria: true }] },
  { id: "i-1234", escopo: "animal", dominio: "sanidade", animalId: "1234", texto: "CCS subiu em 3 controles seguidos (<b>245 → 389 → 512 mil cél/mL</b>) e houve mastite clínica em abril. Risco de <b>mastite subclínica persistente</b> — candidata a cultura no próximo controle.", acoes: [{ label: "Ver 7 vacas com padrão parecido", primaria: true }, { label: "Agendar cultura" }] },
];
```

- [ ] **Step 4: Create `client/src/rebanho/mock/index.ts`**
```ts
import { animais, resumos } from "./animais";
import { eventos } from "./eventos";
import { insights } from "./insights";
import type { Animal, ResumoAnimal, IaInsight } from "../types";

export { animais, resumos, eventos, insights };

export function getAnimal(id: string): Animal | undefined {
  return animais.find((a) => a.id === id);
}
export function getResumo(id: string): ResumoAnimal | undefined {
  return resumos.find((r) => r.animalId === id);
}
export function insightDoRebanho(dominio: string): IaInsight | undefined {
  return insights.find((i) => i.escopo === "rebanho" && i.dominio === dominio);
}
export function insightDoAnimal(animalId: string): IaInsight | undefined {
  return insights.find((i) => i.escopo === "animal" && i.animalId === animalId);
}
```

- [ ] **Step 5: Write `client/src/rebanho/mock/mock.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { animais, resumos } from "./animais";
import { getAnimal, getResumo } from "./index";

describe("mock invariants", () => {
  it("todo resumo aponta pra um animal existente", () => {
    for (const r of resumos) expect(getAnimal(r.animalId), r.animalId).toBeDefined();
  });
  it("ids de animal são únicos", () => {
    expect(new Set(animais.map((a) => a.id)).size).toBe(animais.length);
  });
  it("getResumo encontra a Jurema", () => {
    expect(getResumo("1234")?.statusReprodutivo).toBe("PRENHE");
  });
});
```

- [ ] **Step 6: Run tests & commit** — Run: `pnpm --filter rionovo-client test` — Expected: PASS.
```bash
git add client/src/rebanho/mock
git commit -m "feat(rebanho): mock dataset (animais, resumos, eventos, insights)"
```

---

## Task 6: Work-list selectors (`worklists.ts`) — TDD

The herd view's "tarefas do dia". Pure functions over `Animal` + `ResumoAnimal`.

**Files:**
- Create: `client/src/rebanho/lib/worklists.ts`
- Test: `client/src/rebanho/lib/worklists.test.ts`

- [ ] **Step 1: Write the failing test** — `client/src/rebanho/lib/worklists.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { aInseminar, dgPendente, aSecar, partosPrevistos } from "./worklists";
import { resumos } from "../mock/animais";

const HOJE = "2026-06-16";

describe("aInseminar", () => {
  it("inclui PEV e VAZIA (aptas a inseminar)", () => {
    const ids = aInseminar(resumos).map((r) => r.animalId).sort();
    expect(ids).toEqual(["0877", "0942", "1188", "1305", "1421"]);
  });
  it("não inclui prenhes", () => {
    expect(aInseminar(resumos).some((r) => r.statusReprodutivo === "PRENHE")).toBe(false);
  });
});

describe("dgPendente", () => {
  it("inclui apenas INSEMINADA", () => {
    const so = [{ animalId: "x", statusReprodutivo: "INSEMINADA" as const }];
    expect(dgPendente(so as any).map((r) => r.animalId)).toEqual(["x"]);
    expect(dgPendente(resumos).length).toBe(0);
  });
});

describe("aSecar", () => {
  it("prenhe com previsão de secagem já vencida conta como atrasada", () => {
    const ids = aSecar(resumos, HOJE).map((r) => r.animalId);
    expect(ids).toContain("0871"); // previsão 2026-09-30 > hoje? não — ver Step 3 regra
  });
});

describe("partosPrevistos", () => {
  it("prenhes com gestação avançada entram", () => {
    expect(partosPrevistos(resumos).every((r) => r.statusReprodutivo === "PRENHE")).toBe(true);
  });
});
```

> Nota: ajuste a asserção do `aSecar` ao confirmar a regra no Step 3 (mantemos "atrasada = previsaoSecagem ≤ hoje"; com o mock atual nenhuma está vencida, então troque o `toContain` por `expect(aSecar(resumos, HOJE)).toHaveLength(0)` se preferir refletir o dataset). Escolha uma e deixe o teste verde e fiel à regra.

- [ ] **Step 2: Run to verify it fails** — Run: `pnpm --filter rionovo-client test` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement `client/src/rebanho/lib/worklists.ts`**
```ts
import type { ResumoAnimal } from "../types";
import { diffDias } from "./derive";

// Aptas a inseminar: fora do período prenhe/inseminada (PEV ou VAZIA).
export function aInseminar(resumos: ResumoAnimal[]): ResumoAnimal[] {
  return resumos.filter((r) => r.statusReprodutivo === "PEV" || r.statusReprodutivo === "VAZIA");
}

// DG pendente: inseminadas aguardando diagnóstico.
export function dgPendente(resumos: ResumoAnimal[]): ResumoAnimal[] {
  return resumos.filter((r) => r.statusReprodutivo === "INSEMINADA");
}

// A secar: prenhes cuja previsão de secagem já passou (atrasada).
export function aSecar(resumos: ResumoAnimal[], hoje: string): ResumoAnimal[] {
  return resumos.filter((r) => r.statusReprodutivo === "PRENHE" && r.previsaoSecagem !== undefined && diffDias(r.previsaoSecagem, hoje) >= 0);
}

// Partos previstos: prenhes com gestação >= 250 dias (≈ últimos 30d antes do parto).
export function partosPrevistos(resumos: ResumoAnimal[]): ResumoAnimal[] {
  return resumos.filter((r) => r.statusReprodutivo === "PRENHE" && (r.diasGestacao ?? 0) >= 250);
}
```

- [ ] **Step 4: Reconcile the `aSecar` assertion** with the rule above (no animal in the mock is overdue → `aSecar(resumos, HOJE)` is empty). Update the test to `expect(aSecar(resumos, HOJE)).toHaveLength(0)`. Run: `pnpm --filter rionovo-client test` — Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add client/src/rebanho/lib/worklists.ts client/src/rebanho/lib/worklists.test.ts
git commit -m "feat(rebanho): work-list selectors (TDD)"
```

---

## Task 7: Timeline builder (`timeline.ts`) — TDD

**Files:**
- Create: `client/src/rebanho/lib/timeline.ts`
- Test: `client/src/rebanho/lib/timeline.test.ts`

- [ ] **Step 1: Write the failing test** — `client/src/rebanho/lib/timeline.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildTimeline } from "./timeline";
import { eventos } from "../mock/eventos";

describe("buildTimeline", () => {
  it("filtra por animal e ordena do mais recente pro mais antigo", () => {
    const tl = buildTimeline(eventos, "1234");
    expect(tl).toHaveLength(7);
    expect(tl[0].data).toBe("2026-05-28");
    expect(tl[tl.length - 1].data).toBe("2025-12-18");
  });
  it("retorna vazio pra animal sem eventos", () => {
    expect(buildTimeline(eventos, "9999")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — Run: `pnpm --filter rionovo-client test` — Expected: FAIL.

- [ ] **Step 3: Implement `client/src/rebanho/lib/timeline.ts`**
```ts
import type { EventoTimeline } from "../types";

export function buildTimeline(eventos: EventoTimeline[], animalId: string): EventoTimeline[] {
  return eventos
    .filter((e) => e.animalId === animalId)
    .slice()
    .sort((a, b) => Date.parse(b.data) - Date.parse(a.data));
}
```

- [ ] **Step 4: Run to verify it passes** — Run: `pnpm --filter rionovo-client test` — Expected: PASS (all suites).

- [ ] **Step 5: Commit**
```bash
git add client/src/rebanho/lib/timeline.ts client/src/rebanho/lib/timeline.test.ts
git commit -m "feat(rebanho): unified timeline builder (TDD)"
```

---

## Task 8: Internal navigation (`nav.ts`)

**Files:**
- Create: `client/src/rebanho/nav.ts`

- [ ] **Step 1: Create `client/src/rebanho/nav.ts`**
```ts
import { useState, useCallback } from "react";

export type RebanhoTab = "dashboard" | "animal" | "reproducao" | "sanidade" | "nutricao" | "ia";

export interface RebanhoNav {
  tab: RebanhoTab;
  animalId: string | null;     // quando setado, mostra a ficha-cockpit
  irPara: (tab: RebanhoTab) => void;
  abrirAnimal: (id: string) => void;
  voltarAoRebanho: () => void;
}

export function useRebanhoNav(): RebanhoNav {
  const [tab, setTab] = useState<RebanhoTab>("reproducao");
  const [animalId, setAnimalId] = useState<string | null>(null);
  const irPara = useCallback((t: RebanhoTab) => { setTab(t); setAnimalId(null); }, []);
  const abrirAnimal = useCallback((id: string) => setAnimalId(id), []);
  const voltarAoRebanho = useCallback(() => setAnimalId(null), []);
  return { tab, animalId, irPara, abrirAnimal, voltarAoRebanho };
}
```

- [ ] **Step 2: Typecheck & commit**

Run: `pnpm --filter rionovo-client exec tsc -b --noEmit` — Expected: no errors.
```bash
git add client/src/rebanho/nav.ts
git commit -m "feat(rebanho): internal nav state hook"
```

---

## Task 9: Sidebar component

**Files:**
- Create: `client/src/rebanho/components/Sidebar.tsx`

- [ ] **Step 1: Create `client/src/rebanho/components/Sidebar.tsx`**
```tsx
import type { RebanhoTab } from "../nav";

const ICONS: Record<RebanhoTab, JSX.Element> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  animal: <><circle cx="12" cy="9" r="5" /><path d="M5 21c1-4 4-6 7-6s6 2 7 6" /></>,
  reproducao: <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" />,
  sanidade: <path d="M12 6v12M6 12h12" />,
  nutricao: <path d="M12 21c5-3 8-7 8-12 0-1.5-.5-3-1-4-3 0-7 1-9 4s-2 8-2 12c2-2 4-3 6-4" />,
  ia: <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />,
};

const ITENS: { id: RebanhoTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "animal", label: "Animal" },
  { id: "reproducao", label: "Reprodução" },
  { id: "sanidade", label: "Sanidade" },
  { id: "nutricao", label: "Nutrição" },
  { id: "ia", label: "IA" },
];

export function Sidebar({ atual, onNav }: { atual: RebanhoTab; onNav: (t: RebanhoTab) => void }) {
  return (
    <aside className="rb-side">
      <div className="brand">
        <div className="lg">Rio Novo</div>
        <div className="farm"><span>🌾 Sítio São Francisco</span><span>▾</span></div>
      </div>
      <div className="grp">Gestão de rebanho</div>
      {ITENS.map((it) => (
        <button key={it.id} className={"navi" + (atual === it.id ? " on" : "")} onClick={() => onNav(it.id)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>{ICONS[it.id]}</svg>
          {it.label}
        </button>
      ))}
      <button className="ia-btn" onClick={() => onNav("ia")}>✦ Perguntar à IA</button>
      <div className="spacer" />
      <div className="user"><div className="av">M</div><div><div className="nm">Marco Antônio</div><div className="rl">Gerente</div></div></div>
    </aside>
  );
}
```

- [ ] **Step 2: Typecheck & commit**

Run: `pnpm --filter rionovo-client exec tsc -b --noEmit` — Expected: no errors.
```bash
git add client/src/rebanho/components/Sidebar.tsx
git commit -m "feat(rebanho): sidebar navigation component"
```

---

## Task 10: IA insight components

**Files:**
- Create: `client/src/rebanho/components/IaInsight.tsx`

- [ ] **Step 1: Create `client/src/rebanho/components/IaInsight.tsx`**
```tsx
import type { IaInsight } from "../types";

function html(texto: string) {
  return { dangerouslySetInnerHTML: { __html: texto } };
}

// Banner horizontal (nível rebanho)
export function IaInsightBand({ insight }: { insight: IaInsight }) {
  const cta = insight.acoes[0];
  return (
    <div className="rb-ia-band">
      <div className="rb-ia-dot">✦</div>
      <p {...html(insight.texto)} />
      {cta && <button className="rb-btn pri cta">{cta.label}</button>}
    </div>
  );
}

// Card vertical com várias ações (ficha do animal)
export function IaInsightCard({ insight }: { insight: IaInsight }) {
  return (
    <div className="rb-ia-card">
      <div className="rb-ia-dot">✦</div>
      <div style={{ flex: 1 }}>
        <h4>A IA notou um padrão</h4>
        <p {...html(insight.texto)} />
        <div className="rb-ia-act">
          {insight.acoes.map((a, i) => (
            <button key={i} className={"rb-btn" + (a.primaria ? " pri" : "")}>{a.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck & commit**

Run: `pnpm --filter rionovo-client exec tsc -b --noEmit` — Expected: no errors.
```bash
git add client/src/rebanho/components/IaInsight.tsx
git commit -m "feat(rebanho): proactive IA insight components"
```

---

## Task 11: Per-domain config (`domains.tsx`)

Drives the generic `HerdDomainView`. For the prototype only **Reprodução** is fully populated; the other three get a minimal config (Task 18 fleshes them out).

**Files:**
- Create: `client/src/rebanho/domains.tsx`

- [ ] **Step 1: Create `client/src/rebanho/domains.tsx`**
```tsx
import type { ResumoAnimal } from "./types";
import { aInseminar, dgPendente, aSecar, partosPrevistos } from "./lib/worklists";
import { HOJE } from "./HOJE";

export interface Kpi { lab: string; val: string; sufixo?: string; d?: string; tom?: "up" | "ok"; }
export interface Coluna { nome: string; render: (r: ResumoAnimal) => React.ReactNode; }
export interface WorkList { id: string; label: string; alerta?: boolean; selecionar: (rs: ResumoAnimal[]) => ResumoAnimal[]; }

export interface DomainConfig {
  titulo: string;
  eyebrow: string;
  kpis: (rs: ResumoAnimal[]) => Kpi[];
  worklists: WorkList[];
  colunas: Coluna[];
}

const pill = (txt: string, tom?: "warn" | "bad") => <span className={"rb-pill" + (tom ? " " + tom : "")}>{txt}</span>;

export const reproducao: DomainConfig = {
  titulo: "Reprodução",
  eyebrow: "Rebanho · 522 animais",
  kpis: (rs) => [
    { lab: "Aptas", val: String(rs.filter((r) => r.statusReprodutivo === "PEV").length), d: "no PEV" },
    { lab: "Servidas", val: String(rs.filter((r) => r.statusReprodutivo === "INSEMINADA").length), d: "aguardando DG" },
    { lab: "Gestantes", val: String(rs.filter((r) => r.statusReprodutivo === "PRENHE").length), d: "↗ +4", tom: "ok" },
    { lab: "Vazias", val: String(rs.filter((r) => r.statusReprodutivo === "VAZIA").length), d: "atrasadas", tom: "up" },
    { lab: "Taxa prenhez", val: "31", sufixo: "%", d: "↓ era 42%", tom: "up" },
    { lab: "IEP médio", val: "488", sufixo: "d", d: "meta 430", tom: "up" },
    { lab: "Partos previstos", val: "13", d: "próx. 30d" },
  ],
  worklists: [
    { id: "inseminar", label: "A inseminar", selecionar: aInseminar },
    { id: "dg", label: "DG pendente", selecionar: dgPendente },
    { id: "secar", label: "A secar (atrasadas)", alerta: true, selecionar: (rs) => aSecar(rs, HOJE) },
    { id: "partos", label: "Partos ≤ 30d", selecionar: partosPrevistos },
  ],
  colunas: [
    { nome: "DEL", render: (r) => r.del ?? "—" },
    { nome: "Status", render: (r) => r.statusReprodutivo === "PEV" ? pill("apta · PEV") : r.statusReprodutivo === "VAZIA" ? pill("vazia", "bad") : pill(r.statusReprodutivo.toLowerCase()) },
    { nome: "Última tentativa", render: (r) => r.ultimaInseminacao ?? (r.ultimoDgData ? `${r.ultimoDgData} · ${r.ultimoDgResultado}` : "—") },
    { nome: "Protocolo", render: (r) => r.protocoloAtual ?? "Reservar" },
  ],
};

// Placeholders mínimos — preenchidos na Task 18.
const vazio: DomainConfig = { titulo: "", eyebrow: "Rebanho · 522 animais", kpis: () => [], worklists: [], colunas: [] };
export const animal: DomainConfig = { ...vazio, titulo: "Animal" };
export const sanidade: DomainConfig = { ...vazio, titulo: "Sanidade" };
export const nutricao: DomainConfig = { ...vazio, titulo: "Nutrição" };

export const DOMAINS = { animal, reproducao, sanidade, nutricao } as const;
```

- [ ] **Step 2: Typecheck & commit**

Run: `pnpm --filter rionovo-client exec tsc -b --noEmit` — Expected: no errors.
```bash
git add client/src/rebanho/domains.tsx
git commit -m "feat(rebanho): per-domain config (Reprodução populated)"
```

---

## Task 12: Herd domain view

**Files:**
- Create: `client/src/rebanho/components/HerdDomainView.tsx`

- [ ] **Step 1: Create `client/src/rebanho/components/HerdDomainView.tsx`**
```tsx
import { useState } from "react";
import type { DomainConfig } from "../domains";
import type { ResumoAnimal, IaInsight } from "../types";
import { getAnimal } from "../mock";
import { IaInsightBand } from "./IaInsight";

export function HerdDomainView({
  config, resumos, insight, onAbrirAnimal,
}: {
  config: DomainConfig;
  resumos: ResumoAnimal[];
  insight?: IaInsight;
  onAbrirAnimal: (id: string) => void;
}) {
  const [wlId, setWlId] = useState(config.worklists[0]?.id);
  const wl = config.worklists.find((w) => w.id === wlId);
  const linhas = wl ? wl.selecionar(resumos) : [];
  const kpis = config.kpis(resumos);

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">{config.eyebrow}</div>
      <div className="rb-head">
        <h1>{config.titulo}</h1>
        <div className="period">📅 Junho 2026 ▾</div>
      </div>

      {kpis.length > 0 && (
        <div className="rb-kstrip" style={{ ["--cols" as any]: kpis.length }}>
          {kpis.map((k) => (
            <div className="rb-k" key={k.lab}>
              <div className="lab">{k.lab}</div>
              <div className="val">{k.val}{k.sufixo && <small style={{ fontSize: 13 }}>{k.sufixo}</small>}</div>
              {k.d && <div className={"d" + (k.tom === "up" ? " rb-up" : k.tom === "ok" ? " rb-ok" : "")}>{k.d}</div>}
            </div>
          ))}
        </div>
      )}

      {insight && <IaInsightBand insight={insight} />}

      {config.worklists.length > 0 && (
        <>
          <h2 className="rb-sec-title">Tarefas do dia</h2>
          <div className="rb-tasks">
            {config.worklists.map((w) => (
              <button key={w.id} className={"rb-task" + (w.id === wlId ? " on" : "") + (w.alerta ? " alert" : "")} onClick={() => setWlId(w.id)}>
                <div className="n">{w.selecionar(resumos).length}</div>
                <div className="l">{w.label}</div>
              </button>
            ))}
          </div>

          <div className="rb-listhead">
            <h3>{wl?.label} — {linhas.length} {linhas.length === 1 ? "animal" : "animais"}</h3>
            <span className="hint">clique numa linha pra abrir a ficha</span>
          </div>
          <table className="rb-tbl">
            <thead><tr><th>Animal</th>{config.colunas.map((c) => <th key={c.nome}>{c.nome}</th>)}</tr></thead>
            <tbody>
              {linhas.map((r) => {
                const a = getAnimal(r.animalId);
                return (
                  <tr className="row" key={r.animalId} onClick={() => onAbrirAnimal(r.animalId)}>
                    <td className="rb-anm">{a?.nome} <small>#{a?.numero}</small></td>
                    {config.colunas.map((c) => <td key={c.nome}>{c.render(r)}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Typecheck & commit**

Run: `pnpm --filter rionovo-client exec tsc -b --noEmit` — Expected: no errors.
```bash
git add client/src/rebanho/components/HerdDomainView.tsx
git commit -m "feat(rebanho): generic herd domain view (KPIs + tasks + table)"
```

---

## Task 13: Timeline component

**Files:**
- Create: `client/src/rebanho/components/Timeline.tsx`

- [ ] **Step 1: Create `client/src/rebanho/components/Timeline.tsx`**
```tsx
import type { EventoTimeline } from "../types";

const DOM_LABEL: Record<string, string> = { reproducao: "Reprodução", sanidade: "Sanidade", nutricao: "Nutrição", producao: "Produção" };

function fmtDia(iso: string) {
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const d = new Date(iso);
  const ano = d.getFullYear() === 2026 ? "" : ` ${d.getFullYear()}`;
  return `${d.getDate().toString().padStart(2, "0")} ${meses[d.getMonth()]}${ano}`;
}

export function Timeline({ eventos }: { eventos: EventoTimeline[] }) {
  return (
    <div className="rb-tl">
      <div className="rb-tl-marker">2026</div>
      {eventos.map((e) => (
        <div key={e.id}>
          {e.marcador && <div className="rb-tl-marker">— {e.marcador} —</div>}
          <div className={"rb-ev " + e.dominio}>
            <span className="when">{fmtDia(e.data)}</span>
            <span className={"tag " + e.dominio}>{DOM_LABEL[e.dominio]}</span>
            <h5>{e.titulo}{e.alerta && <span className="flag"> ↑ alerta</span>}</h5>
            {e.detalhe && <p>{e.detalhe}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck & commit**

Run: `pnpm --filter rionovo-client exec tsc -b --noEmit` — Expected: no errors.
```bash
git add client/src/rebanho/components/Timeline.tsx
git commit -m "feat(rebanho): timeline renderer"
```

---

## Task 14: Animal cockpit

**Files:**
- Create: `client/src/rebanho/components/AnimalCockpit.tsx`

- [ ] **Step 1: Create `client/src/rebanho/components/AnimalCockpit.tsx`**
```tsx
import { getAnimal, getResumo, eventos as todosEventos, insightDoAnimal } from "../mock";
import { buildTimeline } from "../lib/timeline";
import { idadeMeses } from "../lib/derive";
import { HOJE } from "../HOJE";
import { Timeline } from "./Timeline";
import { IaInsightCard } from "./IaInsight";

function fmtPrevSecagem(iso?: string) {
  if (!iso) return "—";
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, "0")}/${meses[d.getMonth()]}`;
}

export function AnimalCockpit({ animalId, onVoltar, onAbrirAnimal }: { animalId: string; onVoltar: () => void; onAbrirAnimal: (id: string) => void }) {
  const a = getAnimal(animalId);
  const r = getResumo(animalId);
  if (!a) return <main className="rb-main"><button className="rb-crumb" onClick={onVoltar}>← Rebanho</button><p>Animal não encontrado.</p></main>;
  const tl = buildTimeline(todosEventos, animalId);
  const insight = insightDoAnimal(animalId);
  const meses = idadeMeses(a.dataNascimento, HOJE);
  const idade = `${Math.floor(meses / 12)}a ${meses % 12}m`;
  const mae = a.maeId ? getAnimal(a.maeId) : undefined;

  return (
    <main className="rb-main">
      <button className="rb-crumb" onClick={onVoltar}>← <b>Rebanho</b> · 522 animais &nbsp;/&nbsp; Animal #{a.numero}</button>

      <div className="rb-head">
        <div>
          <h1>{a.nome} <small>· #{a.numero}</small></h1>
          <div className="rb-sub">{a.categoria === "VACA" ? "Vaca" : a.categoria.toLowerCase()} · {a.raca} · nascida {new Date(a.dataNascimento).toLocaleDateString("pt-BR")} ({idade}){a.brincoEletronico ? ` · brinco ${a.brincoEletronico}` : ""}</div>
        </div>
        <div className="rb-chips">
          {r?.statusReprodutivo === "PRENHE" && <span className="rb-chip preg">Prenhe · {r.diasGestacao} dias</span>}
          {r?.ordemLactacao && <span className="rb-chip lact">{r.ordemLactacao}ª lactação · DEL {r.del}</span>}
        </div>
      </div>

      {r && (
        <div className="rb-stats">
          <div className="rb-stat"><div className="k">DEL</div><div className="v">{r.del}<u>d</u></div><div className="t">pico passou</div></div>
          <div className="rb-stat"><div className="k">Produção</div><div className="v">{r.producaoMediaDia}<u>L/d</u></div><div className="t rb-ok">média 7d ↗</div></div>
          <div className="rb-stat"><div className="k">Reprodução</div><div className="v" style={{ fontSize: 18, paddingTop: 5 }}>{r.statusReprodutivo === "PRENHE" ? "Prenhe" : r.statusReprodutivo}</div><div className="t">DG+ {r.ultimoDgData ? new Date(r.ultimoDgData).toLocaleDateString("pt-BR") : "—"}</div></div>
          <div className="rb-stat"><div className="k">IEP previsto</div><div className="v">{r.iepProjetado ?? "—"}<u>d</u></div><div className="t rb-ok">meta ≤ 400</div></div>
          <div className="rb-stat"><div className="k">Prev. secagem</div><div className="v" style={{ fontSize: 18, paddingTop: 5 }}>{fmtPrevSecagem(r.previsaoSecagem)}</div><div className="t">programada</div></div>
          <div className="rb-stat"><div className="k">CCS</div><div className="v">{r.ccs}<u>mil</u></div><div className={"t" + (r.ccsTendencia === "subindo" ? " rb-up" : "")}>{r.ccsTendencia === "subindo" ? "↑ subindo" : "estável"}</div></div>
        </div>
      )}

      {insight && <IaInsightCard insight={insight} />}

      <div className="rb-grid">
        <div>
          <h3 className="rb-sec-title">Linha do tempo</h3>
          <p className="rb-sec-sub">Todos os domínios costurados — reprodução, sanidade, nutrição e produção em uma história só.</p>
          <Timeline eventos={tl} />
        </div>
        <div>
          <div className="rb-box">
            <h4>Estado atual</h4>
            <div className="rb-kv"><span>Grupo / lote</span><b>{a.grupoAtual ?? "—"}</b></div>
            <div className="rb-kv"><span>Setor</span><b>{a.setor ?? "—"}</b></div>
            <div className="rb-kv"><span>Status reprod.</span><b>{r?.statusReprodutivo ?? "—"}</b></div>
          </div>
          <div className="rb-box">
            <h4>Genealogia</h4>
            <div className="rb-ped">
              {mae ? <div>Mãe <button onClick={() => onAbrirAnimal(mae.id)}>{mae.nome} #{mae.numero}</button></div> : <div>Mãe <span style={{ color: "var(--ink-mute)" }}>—</span></div>}
              <div>Pai <span style={{ color: "var(--ink-mute)" }}>{a.paiNome ?? "—"}</span></div>
            </div>
          </div>
          {r && (
            <div className="rb-box">
              <h4>Produção · {r.ordemLactacao}ª lactação</h4>
              <div className="rb-kv"><span>Média atual</span><b>{r.producaoMediaDia} L/dia</b></div>
              <div className="rb-kv"><span>Proj. 305d</span><b>{r.producao305?.toLocaleString("pt-BR")} L</b></div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck & commit**

Run: `pnpm --filter rionovo-client exec tsc -b --noEmit` — Expected: no errors.
```bash
git add client/src/rebanho/components/AnimalCockpit.tsx
git commit -m "feat(rebanho): animal cockpit (header + stats + IA + timeline)"
```

---

## Task 15: RebanhoApp shell + App integration

**Files:**
- Create: `client/src/rebanho/RebanhoApp.tsx`
- Modify: `client/src/components/Shell.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Create `client/src/rebanho/RebanhoApp.tsx`**
```tsx
import { useRebanhoNav } from "./nav";
import { Sidebar } from "./components/Sidebar";
import { HerdDomainView } from "./components/HerdDomainView";
import { AnimalCockpit } from "./components/AnimalCockpit";
import { DOMAINS } from "./domains";
import { resumos, insightDoRebanho } from "./mock";

export function RebanhoApp() {
  const nav = useRebanhoNav();
  const domainKey = (["animal", "reproducao", "sanidade", "nutricao"] as const).includes(nav.tab as any) ? (nav.tab as keyof typeof DOMAINS) : null;

  return (
    <div className="rb">
      <Sidebar atual={nav.tab} onNav={nav.irPara} />
      {nav.animalId
        ? <AnimalCockpit animalId={nav.animalId} onVoltar={nav.voltarAoRebanho} onAbrirAnimal={nav.abrirAnimal} />
        : domainKey
          ? <HerdDomainView config={DOMAINS[domainKey]} resumos={resumos} insight={insightDoRebanho(domainKey)} onAbrirAnimal={nav.abrirAnimal} />
          : <main className="rb-main"><div className="rb-eyebrow">Em breve</div><div className="rb-head"><h1>{nav.tab === "ia" ? "IA" : "Dashboard"}</h1></div><p className="rb-sub">Esta aba entra numa próxima etapa.</p></main>}
    </div>
  );
}
```

- [ ] **Step 2: Add `"rebanho"` to the `Tab` union** — in `client/src/components/Shell.tsx`, change the `Tab` type:
```ts
export type Tab = "dashboard" | "gastos" | "lancar" | "plano" | "ia" | "relatorio" | "acessos" | "rebanho";
```

- [ ] **Step 3: Wire it into `client/src/App.tsx`** — add the import near the other component imports:
```ts
import { RebanhoApp } from "./rebanho/RebanhoApp";
```
Then, inside `App()`, immediately before the `return (` statement, add the full-screen takeover:
```tsx
  if (tab === "rebanho") return <RebanhoApp />;
```
And add a Rebanho entry to the nav by appending it in the `visibleTabs` memo — change the `if (isAdmin) base.push(...)` block to also push Rebanho:
```ts
    if (isAdmin) base.push({ id: "acessos", label: "Acessos" });
    base.push({ id: "rebanho", label: "Rebanho" });
    return base;
```

- [ ] **Step 4: Typecheck** — Run: `pnpm --filter rionovo-client exec tsc -b --noEmit` — Expected: no errors.

- [ ] **Step 5: Visual verification** — Run `pnpm dev` (repo root). Open the client URL, click **Rebanho** in the masthead. Confirm: the dark sidebar takes over; "Reprodução" is the default view with the KPI strip, the IA band, the four task cards, and the 5-row "A inseminar" table. Click a row (e.g., Aurora) → the **cockpit** opens. From Jurema's cockpit, the timeline shows 7 events with colored domain tags and the CCS insight card; clicking "Jandira #0871" in genealogia opens her cockpit. Click the breadcrumb → back to the herd view.

- [ ] **Step 6: Commit**
```bash
git add client/src/rebanho/RebanhoApp.tsx client/src/components/Shell.tsx client/src/App.tsx
git commit -m "feat(rebanho): shell + app integration (Rebanho takeover from masthead)"
```

---

## Task 16: Fill in the remaining domains

Populate `animal`, `sanidade`, `nutricao` configs so all four tabs render meaningful herd views (same component, different config). Reuses existing selectors where they fit; adds simple inline selectors otherwise.

**Files:**
- Modify: `client/src/rebanho/domains.tsx`

- [ ] **Step 1: Replace the placeholder configs** in `client/src/rebanho/domains.tsx` (the `animal`/`sanidade`/`nutricao` block) with:
```tsx
export const animal: DomainConfig = {
  titulo: "Animal", eyebrow: "Rebanho · 522 animais",
  kpis: (rs) => [
    { lab: "Total", val: String(rs.length) },
    { lab: "Em lactação", val: String(rs.filter((r) => r.del !== undefined).length) },
    { lab: "Prenhes", val: String(rs.filter((r) => r.statusReprodutivo === "PRENHE").length) },
    { lab: "Vazias", val: String(rs.filter((r) => r.statusReprodutivo === "VAZIA").length), tom: "up" },
  ],
  worklists: [{ id: "todas", label: "Todas as fêmeas", selecionar: (rs) => rs }],
  colunas: [
    { nome: "Lactação", render: (r) => r.ordemLactacao ? `${r.ordemLactacao}ª` : "—" },
    { nome: "DEL", render: (r) => r.del ?? "—" },
    { nome: "Produção", render: (r) => r.producaoMediaDia ? `${r.producaoMediaDia} L/d` : "—" },
    { nome: "Status", render: (r) => pill(r.statusReprodutivo.toLowerCase()) },
  ],
};

export const sanidade: DomainConfig = {
  titulo: "Sanidade", eyebrow: "Rebanho · 522 animais",
  kpis: (rs) => [
    { lab: "CCS alto", val: String(rs.filter((r) => (r.ccs ?? 0) >= 400).length), d: "≥ 400 mil", tom: "up" },
    { lab: "CCS subindo", val: String(rs.filter((r) => r.ccsTendencia === "subindo").length), tom: "up" },
    { lab: "Em tratamento", val: "2" },
    { lab: "CCS médio", val: "248", sufixo: "mil" },
  ],
  worklists: [
    { id: "ccs", label: "CCS alto / subindo", alerta: true, selecionar: (rs) => rs.filter((r) => (r.ccs ?? 0) >= 400 || r.ccsTendencia === "subindo") },
    { id: "todas", label: "Todas", selecionar: (rs) => rs },
  ],
  colunas: [
    { nome: "CCS", render: (r) => r.ccs ? `${r.ccs} mil` : "—" },
    { nome: "Tendência", render: (r) => r.ccsTendencia === "subindo" ? pill("subindo", "bad") : pill(r.ccsTendencia ?? "—") },
    { nome: "DEL", render: (r) => r.del ?? "—" },
  ],
};

export const nutricao: DomainConfig = {
  titulo: "Nutrição", eyebrow: "Rebanho · 522 animais",
  kpis: (rs) => [
    { lab: "Lotes ativos", val: "3" },
    { lab: "Alta Produção", val: String(rs.filter((r) => (r.producaoMediaDia ?? 0) >= 28).length) },
    { lab: "Produção média", val: "26,4", sufixo: "L" },
  ],
  worklists: [{ id: "lote", label: "Por lote", selecionar: (rs) => rs }],
  colunas: [
    { nome: "Produção", render: (r) => r.producaoMediaDia ? `${r.producaoMediaDia} L/d` : "—" },
    { nome: "Lote sugerido", render: (r) => (r.producaoMediaDia ?? 0) >= 28 ? pill("Alta Produção") : pill("Média Produção", "warn") },
    { nome: "DEL", render: (r) => r.del ?? "—" },
  ],
};
```

- [ ] **Step 2: Typecheck** — Run: `pnpm --filter rionovo-client exec tsc -b --noEmit` — Expected: no errors.

- [ ] **Step 3: Visual verification** — `pnpm dev`; in Rebanho, click through **Animal · Sanidade · Nutrição**. Each shows its KPI strip + task cards + table, and rows still drill into the cockpit. Sanidade's "CCS alto / subindo" task highlights in red and lists Jurema (#1234, 512 mil) and Cravina (#1305, subindo).

- [ ] **Step 4: Full test + build + commit**
```bash
pnpm --filter rionovo-client test          # all logic suites pass
pnpm --filter rionovo-client build         # tsc -b && vite build succeed
git add client/src/rebanho/domains.tsx
git commit -m "feat(rebanho): populate Animal/Sanidade/Nutrição domain views"
```

---

## Self-Review (done while writing)

**Spec coverage:**
- Approach C (herd work-lists → cockpit) → Tasks 12, 14, 15. ✓
- Sidebar shell → Tasks 9, 15. ✓
- Visual language (fazendinha palette/fonts) → Task 2 CSS uses the exact `base.css` vars. ✓
- Data model (Animal hub, typed-events-as-normalized-timeline, ResumoAnimal read-model) → Task 3 types; Tasks 5–7. ✓
- IA proactive at both levels → Task 10 + used in 12 (band) and 14 (card). ✓
- 4 tabs, mock-first, no backend → Tasks 11/16 + mock in Task 5; no network anywhere. ✓
- "Financeiro untouched" → Task 15 only *adds* a Tab value, a nav entry, and an early return. ✓

**Placeholder scan:** No "TBD/TODO" in delivered code. The `aSecar` test has an explicit reconciliation step (Task 6 Step 4) so it lands green and truthful — not a placeholder. Dashboard/IA tabs render an explicit "Em breve" panel (intentional, in-scope-deferred), not a broken placeholder.

**Type consistency:** `RebanhoTab` (nav.ts) is reused by Sidebar; `DomainConfig`/`Kpi`/`Coluna`/`WorkList` defined in domains.tsx and consumed by HerdDomainView; `ResumoAnimal`/`EventoTimeline`/`IaInsight` from types.ts used consistently; selector names (`aInseminar`/`dgPendente`/`aSecar`/`partosPrevistos`) match between worklists.ts, its test, and domains.tsx. `buildTimeline(eventos, animalId)` signature consistent across timeline.ts, its test, and AnimalCockpit. ✓

**Note on file extension:** `domains.tsx` contains JSX (the `pill` helper and `kpis`/`colunas` renderers), so it must use the `.tsx` extension — `@vitejs/plugin-react` does not transform JSX in `.ts` files. It is imported extension-less as `./domains`. No other file in this plan contains JSX in a `.ts` file.
