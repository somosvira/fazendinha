# Navegação unificada num sidebar único — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: usar superpowers:subagent-driven-development para executar task-by-task. Passos usam checkbox (`- [ ]`).

**Goal:** Substituir a top bar do app financeiro por um **sidebar único** (estilo da sidebar do rebanho) que contém tudo, agrupado em FINANCEIRO e REBANHO — acabando com a troca de paradigma ao entrar no Rebanho.

**Architecture:** `App.tsx` vira um shell único (sidebar fixa à esquerda + `<main>` com offset). Um novo `AppSidebar` (reaproveita as regras CSS `.rb-side`) lista os dois grupos. O conteúdo do rebanho vira `RebanhoContent` (sem sidebar própria), com o sub-tab vindo do `App` e o drill-down do cockpit mantido localmente. Estado de navegação unificado numa única união de chaves sem colisão (`reb-*` para o rebanho).

**Tech Stack:** React 18 + Vite + TS. Sem backend. Verificação: `tsc` + `vite build` + vitest (render smokes via `react-dom/server`) + navegador (chrome-devtools).

## Global Constraints

- Client (Vite): imports relativos **sem** extensão.
- Cores via `var(--...)` (todas globais em `:root` de `base.css`); **nunca** hardcodar hex novo — reusar os tokens existentes (`--mast-bg`, `--mast-ink`, `--mast-ink-2`, `--leite`, etc.).
- Reaproveitar as regras CSS existentes `.rb-side …` (já valem globalmente — seletores não aninhados em `.rb`). Não duplicar estilo de sidebar.
- Permissionamento **preservado**: grupo Financeiro respeita `visibleTabs`/perfil + "ver como"; grupo Rebanho visível a todos.
- Nomes: Financeiro usa **Dashboard** e **IA financeira**; Rebanho usa **Painel** e **IA do rebanho**.
- PT-BR em tudo. Sem libs novas. Sem mudar conteúdo das telas.
- Offset de layout **único**: `.app-main { margin-left: var(--side-w) }`. `.rb-main` perde o seu `margin-left` (senão duplica).

---

## Visão dos arquivos

- **Criar:** `client/src/components/AppSidebar.tsx` — a sidebar app-level (2 grupos + rodapé com Acessos e chip "ver como").
- **Criar:** `client/src/rebanho/RebanhoContent.tsx` — conteúdo do rebanho sem sidebar (sub-tab por prop + cockpit local).
- **Modificar:** `client/src/components/Shell.tsx` — união `Tab` unificada (`reb-*`, sem `"rebanho"`); aposenta `Masthead`; mantém `ReportHeader`/`NavTab`.
- **Modificar:** `client/src/App.tsx` — shell único; roteia `reb-*` → `RebanhoContent`.
- **Modificar:** `client/src/styles/base.css` — `--side-w` para `:root`; `.app`/`.app-main`; (masthead CSS fica, inerte).
- **Modificar:** `client/src/rebanho/styles/rebanho.css` — `.rb-main` perde `margin-left`; `.rb` não precisa mais definir `--side-w`.
- **Excluir:** `client/src/rebanho/components/Sidebar.tsx` e `client/src/rebanho/RebanhoApp.tsx` (absorvidos).
- **Modificar:** `client/src/rebanho/nav.ts` — simplificar/remover `useRebanhoNav` se ficar sem uso.
- **Modificar:** `client/src/rebanho/__smoke__/render.test.ts` — apontar para `App`/`RebanhoContent`.

---

### Task 1: `AppSidebar` (apresentacional) + união `Tab` unificada

**Files:**
- Create: `client/src/components/AppSidebar.tsx`
- Modify: `client/src/components/Shell.tsx` (união `Tab`)
- Test: `client/src/rebanho/__smoke__/render.test.ts` (novo caso AppSidebar — adicionar, não quebrar os outros ainda)

**Interfaces — Produces:**
```ts
// Shell.tsx — união unificada (ADITIVA nesta task: mantém as chaves financeiras; ADICIONA reb-*; mantém "rebanho" por ora p/ App.tsx compilar)
export type Tab =
  | "dashboard" | "gastos" | "lancar" | "plano" | "ia" | "relatorio" | "acessos" | "rebanho"
  | "reb-dashboard" | "reb-animal" | "reb-reproducao" | "reb-sanidade" | "reb-nutricao" | "reb-ia";

// AppSidebar.tsx
export function AppSidebar(props: {
  current: Tab;
  onNav: (t: Tab) => void;
  financeiro: { id: Tab; label: string }[];   // itens financeiros permitidos (de visibleTabs, sem "rebanho")
  isAdmin: boolean;
  user: import("../data/acessos").User;
  allUsers: import("../data/acessos").User[] | null;
  onSwitchUser: (id: string) => void;
}): JSX.Element;
```

- [ ] **Step 1: Estender a união `Tab`** em `Shell.tsx` para o valor acima (adiciona as 6 chaves `reb-*`; mantém o resto).

- [ ] **Step 2: Criar `AppSidebar.tsx`.** Reusa `className="rb-side"` (estilo já existe e vale global). Dois grupos + rodapé. Menu "ver como" portado do `Masthead`.

```tsx
import { useState } from "react";
import { PAPEIS, type User } from "../data/acessos";
import type { Tab } from "./Shell";

// ícones simples (single-path) por chave — reusa os do rebanho onde aplicável
const ICON: Partial<Record<Tab, JSX.Element>> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  gastos: <><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/></>,
  lancar: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8v8M8 12h8"/></>,
  plano: <><path d="M4 6h16M4 12h16M4 18h10"/></>,
  relatorio: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
  ia: <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>,
  acessos: <><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/></>,
  "reb-dashboard": <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  "reb-animal": <><circle cx="12" cy="9" r="5"/><path d="M5 21c1-4 4-6 7-6s6 2 7 6"/></>,
  "reb-reproducao": <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>,
  "reb-sanidade": <path d="M12 6v12M6 12h12"/>,
  "reb-nutricao": <path d="M12 21c5-3 8-7 8-12 0-1.5-.5-3-1-4-3 0-7 1-9 4s-2 8-2 12c2-2 4-3 6-4"/>,
  "reb-ia": <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>,
};

const REBANHO_ITENS: { id: Tab; label: string }[] = [
  { id: "reb-dashboard", label: "Painel" },
  { id: "reb-animal", label: "Animal" },
  { id: "reb-reproducao", label: "Reprodução" },
  { id: "reb-sanidade", label: "Sanidade" },
  { id: "reb-nutricao", label: "Nutrição" },
  { id: "reb-ia", label: "IA do rebanho" },
];

function Item({ id, label, current, onNav }: { id: Tab; label: string; current: Tab; onNav: (t: Tab) => void }) {
  return (
    <button className={"navi" + (current === id ? " on" : "")} onClick={() => onNav(id)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>{ICON[id]}</svg>
      {label}
    </button>
  );
}

export function AppSidebar({ current, onNav, financeiro, isAdmin, user, allUsers, onSwitchUser }: {
  current: Tab; onNav: (t: Tab) => void; financeiro: { id: Tab; label: string }[];
  isAdmin: boolean; user: User; allUsers: User[] | null; onSwitchUser: (id: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const papelNome = (u: User) => (u.papel === "personalizado" ? "Personalizado" : PAPEIS[u.papel]?.nome || "");
  // relabel financeiro: "IA" -> "IA financeira"
  const fin = financeiro.map((t) => (t.id === "ia" ? { ...t, label: "IA financeira" } : t));
  return (
    <aside className="rb-side">
      <div className="brand">
        <div className="lg">Rio Novo</div>
        <div className="farm"><span>🌾 Sítio São Francisco</span><span>▾</span></div>
      </div>

      <div className="grp">Financeiro</div>
      {fin.map((t) => <Item key={t.id} id={t.id} label={t.label} current={current} onNav={onNav} />)}

      <div className="grp">Rebanho</div>
      {REBANHO_ITENS.map((t) => <Item key={t.id} id={t.id} label={t.label} current={current} onNav={onNav} />)}

      <div className="spacer" />

      {isAdmin && <Item id="acessos" label="Acessos" current={current} onNav={onNav} />}

      <div className="user" style={{ position: "relative", cursor: allUsers ? "pointer" : "default" }} onClick={() => allUsers && setMenu((o) => !o)}>
        <div className="av">{user.inicial}</div>
        <div><div className="nm">{user.nome.split(" ")[0]}</div><div className="rl">{papelNome(user)}</div></div>
        {allUsers && <span style={{ marginLeft: "auto", color: "var(--mast-ink-2)" }}>▾</span>}
        {menu && allUsers && (
          <div className="user-menu" onClick={(e) => e.stopPropagation()}>
            <div className="user-menu-head">Entrar como (demonstração)</div>
            {allUsers.map((u) => (
              <button key={u.id} className="user-menu-opt" onClick={() => { onSwitchUser(u.id); setMenu(false); }}>
                <span className="umo-av">{u.inicial}</span>
                <span className="umo-info"><div className="umo-nome">{u.nome}</div><div className="umo-papel">{papelNome(u)}</div></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
```
> O menu reusa as classes `.user-menu/.user-menu-*/.umo-*` já definidas (eram do Masthead). Se elas estiverem aninhadas em `.masthead` no CSS, mover para seletores globais no Step do CSS (Task 3) — verificar com grep `\.user-menu` em `styles/base.css`; se estiverem como `.masthead .user-menu`, desaninhar.

- [ ] **Step 3: Smoke do AppSidebar.** Em `rebanho/__smoke__/render.test.ts`, **adicionar** um caso (sem remover os existentes nesta task):
```ts
import { AppSidebar } from "../../components/AppSidebar";
import { usuarios } from "../../data/acessos";
it("AppSidebar renders both groups and the user chip", () => {
  const html = renderToString(h(AppSidebar, {
    current: "dashboard", onNav: () => {}, financeiro: [{ id: "dashboard", label: "Dashboard" }, { id: "ia", label: "IA" }],
    isAdmin: true, user: usuarios[0], allUsers: usuarios, onSwitchUser: () => {},
  }));
  expect(html).toContain("Financeiro");
  expect(html).toContain("Rebanho");
  expect(html).toContain("Painel");
  expect(html).toContain("IA financeira");
  expect(html).toContain("Acessos");
});
```

- [ ] **Step 4: Verificar.** `pnpm --filter rionovo-client exec tsc -b` (ou `pnpm --filter rionovo-client build`) e `pnpm --filter rionovo-client test` → verdes. (Build ainda usa o `Masthead`/`RebanhoApp` antigos — tudo compila porque a Task 1 é aditiva.)

- [ ] **Step 5: Commit** — `feat(nav): AppSidebar app-level (2 grupos) + união Tab unificada`.

### Task 2: `RebanhoContent` (conteúdo sem sidebar) — aditivo

**Files:**
- Create: `client/src/rebanho/RebanhoContent.tsx`
- Test: `client/src/rebanho/__smoke__/render.test.ts` (adicionar caso)

**Interfaces — Consumes:** Tab de Task 1. **Produces:**
```ts
export type RebSub = "dashboard" | "animal" | "reproducao" | "sanidade" | "nutricao" | "ia";
export function RebanhoContent(props: { aba: RebSub }): JSX.Element;
```

- [ ] **Step 1: Criar `RebanhoContent.tsx`** — mesma lógica de render do `RebanhoApp.tsx` atual, **menos** o `<Sidebar>`. O sub-tab vem da prop `aba`; o cockpit (`animalId`) e o drawer (`form`) ficam locais. Ao mudar `aba`, fecha o cockpit.

```tsx
import { useEffect, useState } from "react";
import { HerdDomainView } from "./components/HerdDomainView";
import { AnimalCockpit } from "./components/AnimalCockpit";
import { AnimalTab } from "./components/AnimalTab";
import { ReproducaoTab } from "./components/ReproducaoTab";
import { SanidadeTab } from "./components/SanidadeTab";
import { NutricaoTab } from "./components/NutricaoTab";
import { AnimalForm } from "./components/AnimalForm";
import { DashboardView } from "./components/DashboardView";
import { IaView } from "./components/IaView";
import { DOMAINS } from "./domains";
import { resumos, insightDoRebanho } from "./mock";
import type { Animal } from "./types";

export type RebSub = "dashboard" | "animal" | "reproducao" | "sanidade" | "nutricao" | "ia";

export function RebanhoContent({ aba }: { aba: RebSub }) {
  const [animalId, setAnimalId] = useState<string | null>(null);
  const [form, setForm] = useState<{ modo: "novo" | "editar" | "baixa"; animal?: Animal } | null>(null);
  const [recarga, setRecarga] = useState(0);
  // trocar de aba fecha o cockpit
  useEffect(() => { setAnimalId(null); }, [aba]);

  const domainKey = (["animal", "reproducao", "sanidade", "nutricao"] as const).includes(aba as any)
    ? (aba as keyof typeof DOMAINS) : null;

  return (
    <div className="rb">
      {animalId
        ? <AnimalCockpit key={recarga} animalId={animalId} onVoltar={() => setAnimalId(null)} onAbrirAnimal={setAnimalId} onEditar={(a) => setForm({ modo: "editar", animal: a })} onBaixa={(a) => setForm({ modo: "baixa", animal: a })} />
        : aba === "animal"
          ? <AnimalTab key={recarga} onAbrirAnimal={setAnimalId} onNovo={() => setForm({ modo: "novo" })} />
          : aba === "reproducao"
            ? <ReproducaoTab onAbrirAnimal={setAnimalId} />
            : aba === "sanidade"
              ? <SanidadeTab onAbrirAnimal={setAnimalId} />
              : aba === "nutricao"
                ? <NutricaoTab />
                : aba === "dashboard"
                  ? <DashboardView onNav={() => { /* Task 3 liga aos itens do sidebar */ }} />
                  : <IaView />}
      {form && <AnimalForm modo={form.modo} animal={form.animal} onFechar={() => setForm(null)} onSalvo={() => { setForm(null); setRecarga((n) => n + 1); }} />}
    </div>
  );
}
```
> `DashboardView` recebe `onNav` (hoje navega entre sub-tabs do rebanho). Na Task 3, `App` passa um `onNav` que mapeia para as chaves `reb-*`. Por ora um no-op mantém compilável; **a Task 3 substitui** por navegação real (ver Task 3 Step 4). O `domainKey`/`HerdDomainView` genérico não é usado pelas 4 abas reais, mas fica como fallback inócuo — pode remover se o tsc acusar `domainKey` sem uso (use `void domainKey` ou remova a linha).

- [ ] **Step 2: Smoke do RebanhoContent.** Adicionar:
```ts
import { RebanhoContent } from "../RebanhoContent";
it("RebanhoContent renders a domain tab shell (live-fetched)", () => {
  const html = renderToString(h(RebanhoContent, { aba: "reproducao" }));
  expect(html).toContain("Carregando");   // shell de loading (sem fetch no SSR)
});
```

- [ ] **Step 3: Verificar** — `tsc`/build + `pnpm --filter rionovo-client test` verdes. (Ainda aditivo: `RebanhoApp` antigo segue existindo.)

- [ ] **Step 4: Commit** — `feat(rebanho): RebanhoContent (conteúdo sem sidebar, cockpit local)`.

### Task 3: Shell único no `App` + CSS + limpeza

**Files:**
- Modify: `client/src/App.tsx`, `client/src/components/Shell.tsx`, `client/src/styles/base.css`, `client/src/rebanho/styles/rebanho.css`, `client/src/rebanho/__smoke__/render.test.ts`
- Delete: `client/src/rebanho/components/Sidebar.tsx`, `client/src/rebanho/RebanhoApp.tsx`
- Modify (se ficar sem uso): `client/src/rebanho/nav.ts`

- [ ] **Step 1: `App.tsx` vira shell único.** Substituir o `Masthead` + o `if (tab === "rebanho") return <RebanhoApp/>` por:
```tsx
import { AppSidebar } from "./components/AppSidebar";
import { RebanhoContent, type RebSub } from "./rebanho/RebanhoContent";
// ... (Dashboard, Gastos, Lancar, PlanoContas, IA, Relatorio, Acessos, GatedTab seguem)

const REB: Record<string, RebSub> = {
  "reb-dashboard": "dashboard", "reb-animal": "animal", "reb-reproducao": "reproducao",
  "reb-sanidade": "sanidade", "reb-nutricao": "nutricao", "reb-ia": "ia",
};

export function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  // ... users/viewAs/effectiveUser/isAdmin iguais ...

  // visibleTabs: SÓ financeiro agora (sem o push de "rebanho")
  const visibleTabs = useMemo<NavTab[]>(() => {
    const base: NavTab[] = ABAS.filter((a) => effectiveUser.abas.includes(a.id)).map((a) => ({ id: a.id as Tab, label: a.label }));
    if (isAdmin) base.push({ id: "acessos", label: "Acessos" });
    return base;
  }, [effectiveUser, isAdmin]);

  // redireciona só quando a aba ativa é financeira e não permitida (reb-* sempre ok)
  useEffect(() => {
    const isReb = String(tab).startsWith("reb-");
    if (isReb || tab === "acessos") return;
    const allowed = visibleTabs.map((t) => t.id);
    if (!allowed.includes(tab)) setTab(allowed[0] || "dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTabs]);

  const canSee = (id: Tab) => visibleTabs.some((t) => t.id === id);
  const enterViewAs = (id: string) => { setViewAsId(id === realUserId ? null : id); setTab("dashboard"); };

  const conteudo = String(tab).startsWith("reb-")
    ? <RebanhoContent aba={REB[tab]} />
    : <>
        {tab === "dashboard" && (canSee("dashboard") ? <Dashboard onNav={setTab} user={effectiveUser} /> : <GatedTab user={effectiveUser} abaLabel="Dashboard" />)}
        {tab === "gastos" && (canSee("gastos") ? <Gastos onNav={setTab} user={effectiveUser} /> : <GatedTab user={effectiveUser} abaLabel="Gastos" />)}
        {tab === "ia" && (canSee("ia") ? <IA /> : <GatedTab user={effectiveUser} abaLabel="IA" />)}
        {tab === "relatorio" && (canSee("relatorio") ? <Relatorio onNav={setTab} /> : <GatedTab user={effectiveUser} abaLabel="Relatório" />)}
        {tab === "lancar" && (canSee("lancar") ? <Lancar onNav={setTab} /> : <GatedTab user={effectiveUser} abaLabel="Lançar" />)}
        {tab === "plano" && (canSee("plano") ? <PlanoContas onNav={setTab} /> : <GatedTab user={effectiveUser} abaLabel="Categorias" />)}
        {tab === "acessos" && (isAdmin ? <Acessos users={users} setUsers={setUsers} onViewAs={enterViewAs} /> : <GatedTab user={effectiveUser} abaLabel="Acessos" />)}
      </>;

  return (
    <div className="app">
      <AppSidebar current={tab} onNav={setTab} financeiro={visibleTabs} isAdmin={isAdmin} user={effectiveUser} allUsers={viewAsId ? null : users} onSwitchUser={enterViewAs} />
      <main className="app-main">
        {viewAsId && (
          <div className="viewas-banner">
            <span className="eye">👁</span>
            <span>Você está vendo o sistema como <strong>{effectiveUser.nome}</strong> — {effectiveUser.papel === "personalizado" ? "Personalizado" : PAPEIS[effectiveUser.papel]?.nome}</span>
            <button onClick={() => { setViewAsId(null); setTab("dashboard"); }}>Voltar para Marco (admin)</button>
          </div>
        )}
        {conteudo}
      </main>
    </div>
  );
}
```
Remover o `import { RebanhoApp }` e o `import { Masthead, ... }` (manter `type Tab, type NavTab` de `./components/Shell`).

- [ ] **Step 2: `Shell.tsx`** — remover `"rebanho"` da união `Tab` (fica só `reb-*` + financeiras); **remover** a função `Masthead` (e seus imports `useState`/`User` se ficarem sem uso); manter `ReportHeader`, `NavTab` e o `type Tab`.

- [ ] **Step 3: CSS.**
  - `styles/base.css`: no `:root`, adicionar `--side-w: 222px;`. Adicionar:
    ```css
    .app { min-height: 100vh; background: var(--bg); color: var(--ink); }
    .app-main { margin-left: var(--side-w); }
    ```
    Se as regras do menu estiverem aninhadas como `.masthead .user-menu` / `.masthead .user-chip ...`, desaninhar para `.user-menu`/`.user-menu-*`/`.umo-*` (globais) para o chip do AppSidebar funcionar. (As regras `.masthead`/`.nav-tab*` podem ficar — inertes.)
  - `rebanho/styles/rebanho.css`: em `.rb`, **remover** `--side-w: 222px;` (agora em `:root`); em `.rb-main`, **remover** `margin-left: var(--side-w);` (mantendo `max-width` e `padding`). A sidebar `.rb-side` continua `position:fixed` (uma só, do AppSidebar).

- [ ] **Step 4: Ligar a navegação do `DashboardView` do rebanho.** Em `RebanhoContent`, trocar o `onNav` no-op por `(sub) => setAbaExterna(...)`? Não — `aba` é prop. Solução: passar um callback de App. Ajuste mínimo: dar à `RebanhoContent` uma prop opcional `onNavReb?: (aba: RebSub) => void` e, no `App`, passar `onNavReb={(s) => setTab(("reb-" + s) as Tab)}`; dentro de `RebanhoContent`, `DashboardView onNav={(t) => onNavReb?.(t as RebSub)}`. (O `DashboardView.onNav` hoje recebe chaves de sub-tab do rebanho — `"animal"|"reproducao"|...`.) Atualizar a assinatura e o uso.

- [ ] **Step 5: Excluir** `rebanho/components/Sidebar.tsx` e `rebanho/RebanhoApp.tsx`. Rodar `pnpm --filter rionovo-client exec tsc -b` e corrigir referências órfãs: `rebanho/nav.ts` (`useRebanhoNav`/`RebanhoTab`) — se nada mais importar, remover o arquivo ou deixar só o `type RebanhoTab` se algo usar; garantir que `Sidebar.tsx`/`RebanhoApp.tsx` não são mais importados por ninguém (`grep -rn "RebanhoApp\|components/Sidebar\|useRebanhoNav" client/src`).

- [ ] **Step 6: Atualizar o smoke** `rebanho/__smoke__/render.test.ts`: remover o caso que renderiza `RebanhoApp` (deletado). Trocar o caso "RebanhoApp renders the default…" por um que renderiza o **`App`** e verifica a sidebar única:
```ts
import { App } from "../../App";
it("App renders the unified sidebar (no top bar)", () => {
  const html = renderToString(h(App));
  expect(html).toContain("Financeiro");   // grupo
  expect(html).toContain("Rebanho");       // grupo
  expect(html).toContain("Painel");        // item rebanho
  expect(html).not.toContain("nav-tabs");  // top bar removida
});
```
Manter os casos de `AppSidebar`, `RebanhoContent`, `DashboardView`, `IaView`.

- [ ] **Step 7: Verificar** — `pnpm --filter rionovo-client exec tsc -b` limpo, `pnpm --filter rionovo-client build` ok, `pnpm --filter rionovo-client test` verde, `pnpm --filter rionovo-server test` verde (inalterado).

- [ ] **Step 8: Commit** — `feat(nav): shell único com sidebar unificada (aposenta top bar)`.

---

## Verificação final (controller, no navegador — chrome-devtools)
- Sidebar única à esquerda; **sem top bar**.
- Grupos **Financeiro** (Dashboard/Gastos/Lançar/Categorias/Relatório/IA financeira) e **Rebanho** (Painel/Animal/Reprodução/Sanidade/Nutrição/IA do rebanho).
- Navegar entre financeiro e rebanho troca **só o conteúdo** (layout estável).
- Conteúdo encostado/alinhado à sidebar (sem **duplo-offset** no rebanho, sem ficar cramped no financeiro).
- Ficha do animal (cockpit) abre e volta.
- Chip "ver como" no rodapé: ao entrar como outro perfil, o grupo Financeiro reduz e os valores R$ mascaram; "Acessos" some se não-admin.

## Self-review (feito)
- **Cobertura do spec:** shell único (Task 3), AppSidebar 2 grupos (Task 1), RebanhoContent sem sidebar (Task 2), união sem colisão (Task 1/3), CSS offset único (Task 3 Step 3), permissionamento + ver-como (Task 1 + Task 3 Step 1), nomes desambiguados (Task 1). ✓
- **Placeholders:** nenhum — código concreto em cada step.
- **Consistência de tipos:** `Tab` (Shell) usada por AppSidebar/App; `RebSub` (RebanhoContent) mapeada por `REB` no App; `RebanhoContent` ganha `onNavReb` no Task 3 Step 4 (assinatura atualizada lá).

## Decisões deferidas
- Sidebar colapsável/mobile · fundir as duas IAs · ícones financeiros mais elaborados · gating por perfil do grupo Rebanho.
