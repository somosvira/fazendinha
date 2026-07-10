# Sidebar + Header restyle — Terrano shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the app shell (sidebar + header) to match the mockup "Onboarding - sidebar personalizada" — a Terrano brand block + propriedade selector at the top of the sidebar, "Gestão"/"Atividades" section labels, activities as flat rows with static meta subtitles, "Configurações" in the sidebar footer, and a header with no farm selector / no wordmark.

**Architecture:** All changes are in the React client shell (`AppSidebar.tsx`, `Header.tsx`, `App.tsx`). The propriedade selector (`FarmPicker`) is extracted from `Header.tsx` into a shared component and re-parented into the sidebar. The module accordion becomes single-open driven by the active tab (no persisted state). No backend, no new routes, no onboarding wizard.

**Tech Stack:** React 18 + TypeScript + Vite, Tailwind (utility classes inline), shadcn primitives (`DropdownMenu`, `Sheet`), Vitest + Testing Library (jsdom).

## Global Constraints

- Client imports relativos **não** levam extensão (Vite bundler resolution).
- Estilo em classes Tailwind inline, consistente com o arquivo existente (não criar CSS novo salvo necessidade real).
- Cores de atividade e tons via `var(--...)` / classes de tema (`--leite`, `mast-bg`, `mast-ink`, `--mast-ink-2`, `--mast-bg-2`) — **nunca** hardcodar hex fora do padrão já usado no arquivo.
- Mensagens/labels em PT-BR.
- Testes Vitest colocados ao lado do código (`*.test.ts`), rodados via `pnpm --filter rionovo-client run test`.
- Preservar o colapso desktop 901–1100px (constantes `RAIL_*`) e o drawer mobile (`Sheet`).
- Branch de trabalho: `feat/sidebar-header-terrano-shell` (já criada, spec já commitada).

---

### Task 1: Extrair `PropriedadePicker` de `Header.tsx` para componente compartilhado

Move a lógica do seletor de propriedade (hoje `FarmPicker` embutido em `Header.tsx`) para um componente próprio, **com uma prop `variant` que decide o visual** ("header" = pílula escura atual; "sidebar" = bloco `.farm-ctx` do mockup). Nesta task só extraímos e mantemos o header idêntico (variant="header" por padrão) — a mudança de local vem na Task 3/4.

**Files:**
- Create: `client/src/components/PropriedadePicker.tsx`
- Modify: `client/src/components/Header.tsx` (remover a função `FarmPicker` local e importar o novo componente)
- Test: `client/src/components/PropriedadePicker.test.ts` (novo)

**Interfaces:**
- Produces: `export function PropriedadePicker({ propAtiva, onTrocarProp, variant }: { propAtiva: number | null; onTrocarProp: (id: number | null) => void; variant?: "header" | "sidebar" }): JSX.Element`
  - `variant` default `"header"`.
  - Usa `usePropriedades` de `../rebanho/api` e `GerenciarPropriedades` de `../rebanho/components/PropriedadeSelector` (mesmos imports que hoje moram no Header).
  - O botão-gatilho mantém `aria-label="Propriedade / sítio ativo"` em ambas as variants (os testes dependem disso).

- [ ] **Step 1: Write the failing test**

Create `client/src/components/PropriedadePicker.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { createElement as h } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { PropriedadePicker } from "./PropriedadePicker";

// usePropriedades bate na API; stubamos o módulo pra render offline.
vi.mock("../rebanho/api", () => ({
  usePropriedades: () => ({
    data: [{ id: 1, nome: "Rio Novo", principal: true, ativo: true }],
    loading: false,
    recarregar: vi.fn(),
  }),
}));

afterEach(cleanup);

describe("PropriedadePicker", () => {
  it("renderiza o gatilho com o nome da propriedade (variant header)", () => {
    render(h(PropriedadePicker, { propAtiva: null, onTrocarProp: vi.fn() }));
    const trigger = screen.getByRole("button", { name: /Propriedade \/ sítio/i });
    expect(trigger.textContent).toContain("Rio Novo");
  });

  it("renderiza o gatilho no variant sidebar", () => {
    render(h(PropriedadePicker, { propAtiva: null, onTrocarProp: vi.fn(), variant: "sidebar" }));
    const trigger = screen.getByRole("button", { name: /Propriedade \/ sítio/i });
    expect(trigger.textContent).toContain("Rio Novo");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter rionovo-client exec vitest run src/components/PropriedadePicker.test.ts`
Expected: FAIL — `Failed to resolve import "./PropriedadePicker"` (arquivo ainda não existe).

- [ ] **Step 3: Create `PropriedadePicker.tsx`**

Copiar a função `FarmPicker` de `Header.tsx` (linhas ~43–129) para o novo arquivo, renomeando para `PropriedadePicker`, adicionando a prop `variant`, e trocando o markup do **botão-gatilho** por um `switch` de variant. Manter o `DropdownMenuContent` idêntico ao atual (lista de sítios). Conteúdo completo:

```tsx
/* Seletor de propriedade/sítio (fonte única de contexto). Lista os sítios REAIS
 * (tabela Propriedade), permite trocar de sítio ou ver Consolidado, e abre o
 * cadastro via "Gerenciar propriedades".
 *   variant="header"  → pílula escura (masthead)
 *   variant="sidebar" → bloco com eyebrow FAZENDA/Sítio (mockup .farm-ctx)
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePropriedades } from "../rebanho/api";
import { GerenciarPropriedades } from "../rebanho/components/PropriedadeSelector";

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-3 w-3 opacity-70 transition-transform group-data-[state=open]:rotate-180", className)}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function PropriedadePicker({ propAtiva, onTrocarProp, variant = "header" }: {
  propAtiva: number | null;
  onTrocarProp: (id: number | null) => void;
  variant?: "header" | "sidebar";
}) {
  const { data: props, loading, recarregar } = usePropriedades();
  const [gerenciar, setGerenciar] = useState(false);
  const ativos = props.filter((p) => p.ativo);
  const sitioAtual = propAtiva != null ? ativos.find((p) => p.id === propAtiva) : null;
  const rotulo = sitioAtual ? (sitioAtual.apelido || sitioAtual.nome) : (ativos.length >= 2 ? "Consolidado" : "Rio Novo");

  const trigger =
    variant === "sidebar" ? (
      <button
        className="group flex w-full cursor-pointer items-center gap-2.5 rounded-[9px] border border-[rgba(232,220,196,.10)] bg-[rgba(232,220,196,.05)] px-2.5 py-2 font-sans text-mast-ink hover:bg-[rgba(232,220,196,.09)]"
        aria-label="Propriedade / sítio ativo"
      >
        <span className="grid h-[26px] w-[26px] flex-none place-items-center rounded-md bg-leite text-[13px] text-[var(--mast-bg)]" aria-hidden>🥛</span>
        <span className="flex flex-1 flex-col items-start leading-[1.2]">
          <span className="text-[8.5px] font-semibold uppercase tracking-[0.14em] text-[var(--mast-ink-2)]">
            {sitioAtual ? "Sítio" : "Fazenda"}
          </span>
          <span className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold">{rotulo}</span>
        </span>
        <Chevron />
      </button>
    ) : (
      <button
        className="group flex cursor-pointer items-center gap-2.5 rounded-[9px] border border-[#2a3025] bg-[var(--mast-bg-2)] py-1.5 pl-2 pr-2.5 font-sans hover:bg-[#1f2521] max-[900px]:gap-2 max-[900px]:py-1 max-[900px]:pl-1.5 max-[900px]:pr-2 max-[560px]:px-1.5"
        aria-label="Propriedade / sítio ativo"
      >
        <span className="text-base leading-none max-[900px]:text-sm" aria-hidden>🥛</span>
        <span className="flex flex-col items-start leading-[1.05] max-[560px]:hidden">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mast-ink-2)] max-[900px]:hidden">
            {sitioAtual ? "Sítio" : "Fazenda"}
          </span>
          <span className="max-w-[26vw] overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-mast-ink max-[900px]:text-[13px]">
            {rotulo}
          </span>
        </span>
        <Chevron />
      </button>
    );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[280px] max-w-[360px] rounded-[6px] p-0">
          <DropdownMenuLabel className="border-b border-border bg-[var(--bg-card-2)] px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            {ativos.length >= 2 ? "Sítios da fazenda" : "Fazenda"}
          </DropdownMenuLabel>
          {loading ? (
            <div className="px-3.5 py-2.5 text-xs italic text-ink-3">Carregando…</div>
          ) : (
            <>
              {ativos.length >= 2 && (
                <DropdownMenuItem
                  onSelect={() => onTrocarProp(null)}
                  className={cn(
                    "gap-3 rounded-none border-b border-[var(--rule-soft)] px-3.5 py-2.5 font-sans text-foreground last:border-b-0",
                    propAtiva == null && "bg-[var(--bg-card-2)]",
                  )}
                >
                  <span className="text-base" aria-hidden>◎</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-semibold text-foreground">Consolidado</span>
                    <span className="text-[11px] text-ink-3">Todos os sítios juntos</span>
                  </span>
                  {propAtiva == null && <span className="font-bold text-lucro" aria-label="atual">✓</span>}
                </DropdownMenuItem>
              )}
              {ativos.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onSelect={() => onTrocarProp(p.id)}
                  className={cn(
                    "gap-3 rounded-none border-b border-[var(--rule-soft)] px-3.5 py-2.5 font-sans text-foreground last:border-b-0",
                    p.id === propAtiva && "bg-[var(--bg-card-2)]",
                  )}
                >
                  <span className="text-base" aria-hidden>🥛</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-semibold text-foreground">
                      {p.nome}{p.principal && <span className="text-ink-3"> · principal</span>}
                    </span>
                    {(p.cidade || p.uf) && (
                      <span className="text-[11px] text-ink-3">{[p.cidade, p.uf].filter(Boolean).join(" — ")}</span>
                    )}
                  </span>
                  {p.id === propAtiva && <span className="font-bold text-lucro" aria-label="atual">✓</span>}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem
                onSelect={() => setGerenciar(true)}
                className="gap-3 rounded-none px-3.5 py-2.5 font-sans text-ink-2"
              >
                <span className="text-base" aria-hidden>＋</span>
                <span className="text-sm font-medium">Gerenciar propriedades</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {gerenciar && <GerenciarPropriedades propriedades={props} onFechar={() => setGerenciar(false)} onMudou={recarregar} />}
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter rionovo-client exec vitest run src/components/PropriedadePicker.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Wire `Header.tsx` to the extracted component (temporário, mesmo lugar)**

Em `Header.tsx`: apagar a função `FarmPicker` local (linhas ~43–129). **Manter** o `Chevron` local do Header (o `UserPicker` ainda o usa). Remover os imports `usePropriedades` e `GerenciarPropriedades` do topo do `Header.tsx`. Trocar a chamada `<FarmPicker propAtiva={propAtiva} onTrocarProp={onTrocarProp} />` (linha ~252) por:

```tsx
<PropriedadePicker propAtiva={propAtiva} onTrocarProp={onTrocarProp} />
```

E adicionar no topo: `import { PropriedadePicker } from "./PropriedadePicker";`

- [ ] **Step 6: Run the full client test suite (garantir que Header ainda passa)**

Run: `pnpm --filter rionovo-client exec vitest run src/components/Header.test.ts src/components/PropriedadePicker.test.ts`
Expected: PASS — o teste "mostra o seletor de propriedade/sítio no header" continua verde (o `aria-label` foi preservado).

- [ ] **Step 7: Commit**

```bash
git add client/src/components/PropriedadePicker.tsx client/src/components/PropriedadePicker.test.ts client/src/components/Header.tsx
git commit -m "refactor(client): extrai PropriedadePicker de Header (variant header|sidebar)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Adicionar `meta` estático ao config `MODULOS`

Adiciona o subtítulo estático de cada módulo (linha `.meta` do mockup) ao array `MODULOS` em `AppSidebar.tsx`. Sem UI ainda — só o dado + o campo no type.

**Files:**
- Modify: `client/src/components/AppSidebar.tsx` (type `Modulo` + array `MODULOS`)

**Interfaces:**
- Produces: `type Modulo` ganha `meta?: string`. Cada entrada de `MODULOS` ganha `meta`:
  - rebanho → `"gado leiteiro"`
  - plantio → `"lavoura de café"`
  - corte → `"gado de corte"`
  - cultivo → `"grão e silagem"`
  - equipe → `"pessoas e diárias"`

- [ ] **Step 1: Editar o type `Modulo`**

Em `AppSidebar.tsx`, na declaração `type Modulo = { ... }`, adicionar `meta?: string;`:

```ts
type Modulo = { id: ModuloId; label: string; icon: JSX.Element; subs: SubItem[]; disabled?: boolean; meta?: string };
```

- [ ] **Step 2: Preencher `meta` em cada entrada de `MODULOS`**

Adicionar a propriedade `meta` a cada um dos 5 objetos do array `MODULOS` (junto de `label`):

```ts
// rebanho:
label: "Rebanho leiteiro", meta: "gado leiteiro",
// plantio:
label: "Plantio · café", meta: "lavoura de café",
// corte:
label: "Gado de corte", meta: "gado de corte",
// cultivo:
label: "Milho", meta: "grão e silagem",
// equipe:
label: "Equipe & Ponto", meta: "pessoas e diárias",
```

- [ ] **Step 3: Verificar build de tipos (tsc) do client**

Run: `pnpm --filter rionovo-client exec tsc --noEmit`
Expected: sem erros (o campo é opcional; nada mais mudou ainda).

- [ ] **Step 4: Commit**

```bash
git add client/src/components/AppSidebar.tsx
git commit -m "feat(client): meta estático por módulo no config MODULOS

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `AppSidebar` — bloco de marca + acordeão single-open dirigido pela aba + labels + footer

O coração da mudança. Adiciona o bloco de marca (Terrano + PropriedadePicker), troca os labels dos grupos, renderiza a `meta` nas linhas de módulo, torna o acordeão **single-open derivado da aba atual** (sem `localStorage`), e fixa "Configurações" no rodapé. Atualiza os testes do `AppSidebar` que dependiam do comportamento antigo.

**Files:**
- Modify: `client/src/components/AppSidebar.tsx`
- Test: `client/src/components/AppSidebar.test.ts`

**Interfaces:**
- Consumes: `PropriedadePicker` (Task 1) com `variant="sidebar"`; `meta` em `MODULOS` (Task 2).
- Produces: assinatura de `AppSidebar` ganha duas props: `propAtiva: number | null` e `onTrocarProp: (id: number | null) => void`. Assinatura completa nova:
  ```ts
  export function AppSidebar({ current, onNav, financeiro, isAdmin, podeVerFolha, mobileOpen, onMobileToggle, propAtiva, onTrocarProp }: {
    current: Tab; onNav: (t: Tab) => void; financeiro: { id: Tab; label: string }[];
    isAdmin: boolean; podeVerFolha: boolean;
    mobileOpen: boolean; onMobileToggle: (open: boolean) => void;
    propAtiva: number | null; onTrocarProp: (id: number | null) => void;
  })
  ```

- [ ] **Step 1: Atualizar os testes do AppSidebar para o novo comportamento (failing)**

Em `AppSidebar.test.ts`:

1. Adicionar o mock de `../rebanho/api` logo após os imports (o `PropriedadePicker` chama `usePropriedades`):

```ts
vi.mock("../rebanho/api", () => ({
  usePropriedades: () => ({ data: [{ id: 1, nome: "Rio Novo", principal: true, ativo: true }], loading: false, recarregar: vi.fn() }),
}));
```

2. No `baseProps` — adicionar ao type de overrides e ao objeto retornado: `propAtiva: null as number | null` e `onTrocarProp: vi.fn()`.

3. Substituir o teste "clicar no cabeçalho de um módulo alterna (acordeão) seus sub-itens" e o teste "persiste o módulo aberto no localStorage e abre automaticamente o módulo da aba atual ao navegar" por estes quatro testes:

```ts
it("expande o módulo da aba atual (single-open dirigido pela aba)", () => {
  render(h(AppSidebar, baseProps({ current: "reb-nutricao" as Tab })));
  expect(screen.getByText("Nutrição")).toBeTruthy();  // sub-item do Rebanho, expandido
  expect(screen.queryByText("Safras")).toBeNull();     // Milho fechado
});

it("troca o módulo expandido quando a aba muda", () => {
  const { rerender } = render(h(AppSidebar, baseProps({ current: "reb-nutricao" as Tab })));
  expect(screen.getByText("Nutrição")).toBeTruthy();
  rerender(h(AppSidebar, baseProps({ current: "mil-safras" as Tab })));
  expect(screen.getByText("Safras")).toBeTruthy();
  expect(screen.queryByText("Nutrição")).toBeNull();
});

it("mostra o meta subtitle do módulo", () => {
  render(h(AppSidebar, baseProps()));
  expect(screen.getByText("gado leiteiro")).toBeTruthy();
});

it("mostra o bloco de marca Terrano e o seletor de propriedade", () => {
  render(h(AppSidebar, baseProps()));
  expect(screen.getAllByText("Terrano").length).toBeGreaterThan(0);
  expect(screen.getAllByRole("button", { name: /Propriedade \/ sítio/i }).length).toBeGreaterThan(0);
});
```

Manter os testes existentes: "chama onNav com a Tab certa", "esconde o módulo Equipe & Ponto quando podeVerFolha=false", "mostra o módulo Equipe & Ponto quando podeVerFolha=true", "monta o drawer mobile (Sheet) quando mobileOpen=true e não quando false".

> Nota: o teste "chama onNav com a Tab certa" clica em "Gastos" (item do grupo Gestão) — continua válido. Com `current="dashboard"` (default) nenhum módulo fica expandido, então "Painel"/"Safras" não aparecem — coerente com o novo comportamento.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter rionovo-client exec vitest run src/components/AppSidebar.test.ts`
Expected: FAIL — novos testes falham (sem bloco de marca / meta; acordeão ainda usa default-first-module e localStorage).

- [ ] **Step 3: Reescrever o `AppSidebar` — imports + estado derivado**

No topo de `AppSidebar.tsx`, adicionar imports:

```ts
import { PropriedadePicker } from "./PropriedadePicker";
import { TerranoSymbol } from "./TerranoLogo";
```

Remover a constante `STORAGE_KEY = "rionovo:sidebar:openModulo"`. Dentro de `AppSidebar`, remover o `useState(openModulo)` inicializado do localStorage, o `useEffect` de auto-open por aba, e o `useEffect` que persiste em localStorage. Substituir por um valor **derivado da aba** (colocar após `modulosVisiveis`):

```ts
// Acordeão single-open dirigido pela aba: o módulo aberto é sempre o da aba
// atual; se a aba não pertence a nenhum módulo (ex.: dashboard financeiro),
// nenhum módulo fica expandido. Sem estado persistido.
const openModulo = moduloOfTab(current);
```

Remover a função `toggleModulo`. **Manter** o `useEffect` que fecha o drawer mobile no crossover 901px (o que usa `matchMedia` — não está ligado a `openModulo`).

- [ ] **Step 4: Helper `firstTabOf` + `ModuloHeader` navega e mostra meta**

Adicionar helper perto de `moduloOfTab`:

```ts
// primeira sub-aba do módulo = seu "painel" (destino ao clicar no cabeçalho)
function firstTabOf(m: Modulo): Tab { return m.subs[0].id; }
```

No JSX do `ModuloHeader`, trocar o `<span className={cn("flex-1", RAIL_LABEL)}>{m.label}</span>` por um bloco com nome + meta:

```tsx
<span className={cn("flex flex-1 flex-col leading-[1.2]", RAIL_LABEL)}>
  <span>{m.label}</span>
  {m.meta && <span className="mt-0.5 text-[11px] text-[var(--mast-ink-2)]">{m.meta}</span>}
</span>
```

(O chevron com `path d="M9 6l6 6-6 6"` que roda via `isOpen` permanece.)

- [ ] **Step 5: `navBody` — brand block, labels novos, footer**

Substituir o conteúdo do `navBody` por:

```tsx
const navBody = (
  <>
    {/* bloco de marca — Terrano + seletor de propriedade */}
    <div className={cn("flex flex-col gap-3 px-3.5 pb-3.5", RAIL_BLOCK)}>
      <div className="flex items-center gap-2.5 px-1.5 pt-0.5">
        <TerranoSymbol size={28} tone="dark" strokeWidth={4.4} />
        <span className="font-serif text-[21px] font-medium leading-none tracking-[-0.01em] text-mast-ink">Terrano</span>
      </div>
      <PropriedadePicker propAtiva={propAtiva} onTrocarProp={onTrocarProp} variant="sidebar" />
    </div>

    <GroupLabel>Gestão</GroupLabel>
    {fin.map((t) => <Item key={t.id} id={t.id} label={t.label} current={current} onNav={nav} />)}

    <GroupLabel>Atividades</GroupLabel>
    {modulosVisiveis.map((m) => {
      const isOpen = openModulo === m.id && !m.disabled;
      const isActive = m.subs.some((s) => s.id === current);
      return (
        <div key={m.id} className="flex flex-col">
          <ModuloHeader m={m} isOpen={isOpen} isActive={isActive} onToggle={() => nav(firstTabOf(m))} />
          {isOpen && (
            <div className={cn("ml-7 border-l border-[#23291f] pb-1.5 pt-0.5", RAIL_BLOCK)}>
              {m.subs.map((s) => <Item key={s.id} id={s.id} label={s.label} current={current} onNav={nav} nested />)}
            </div>
          )}
        </div>
      );
    })}

    <div className="flex-1" />

    <GroupLabel>Administração</GroupLabel>
    <Item id="cadastros" label="Cadastros" current={current} onNav={nav} />
    {isAdmin && <Item id="acessos" label="Acessos" current={current} onNav={nav} />}

    {/* rodapé — Configurações separado por hairline (mockup .side-foot) */}
    <div className={cn("mt-2 border-t border-[rgba(232,220,196,.10)] pt-2", RAIL_BLOCK)}>
      <Item id="config" label="Configurações" current={current} onNav={nav} />
    </div>
  </>
);
```

(`GroupLabel`, `Item`, `ModuloHeader`, `fin`, `nav`, `modulosVisiveis`, `RAIL_BLOCK` já existem. `ModuloHeader`'s `onToggle` prop agora recebe a navegação — assinatura do componente inalterada.)

- [ ] **Step 6: Atualizar a assinatura de `AppSidebar` (props novas)**

Adicionar `propAtiva` e `onTrocarProp` à desestruturação e ao type da função `AppSidebar` (ver bloco Interfaces desta task).

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm --filter rionovo-client exec vitest run src/components/AppSidebar.test.ts`
Expected: PASS (todos, incl. os 4 novos).

- [ ] **Step 8: Type-check (esperado: erro só no App.tsx)**

Run: `pnpm --filter rionovo-client exec tsc --noEmit`
Expected: pode falhar em `App.tsx` (o `<AppSidebar>` ainda não passa `propAtiva`/`onTrocarProp`) — isso é corrigido na Task 4. Se o único erro for esse, seguir. Qualquer outro erro deve ser resolvido antes do commit.

- [ ] **Step 9: Commit**

```bash
git add client/src/components/AppSidebar.tsx client/src/components/AppSidebar.test.ts
git commit -m "feat(client): sidebar Terrano — brand block, meta, single-open por aba, footer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `Header.tsx` — remover FarmPicker + wordmark; `App.tsx` — reparentar props

Simplifica o header (sem seletor de fazenda, sem `ah-brand`) e move `propAtiva`/`onTrocarProp` do `<Header>` para o `<AppSidebar>` em `App.tsx`. Atualiza o teste do Header.

**Files:**
- Modify: `client/src/components/Header.tsx`
- Modify: `client/src/App.tsx`
- Test: `client/src/components/Header.test.ts`

**Interfaces:**
- Consumes: `AppSidebar` novo (Task 3), que agora exige `propAtiva`/`onTrocarProp`.
- Produces: `Header` perde `propAtiva`/`onTrocarProp` da assinatura. Nova assinatura:
  ```ts
  export function Header({ user, allUsers, onSwitchUser, mobileOpen, onMobileToggle, onAbrirBusca, onSair }: {
    user: User; allUsers: User[] | null; onSwitchUser: (id: string) => void;
    mobileOpen: boolean; onMobileToggle: (open: boolean) => void;
    onAbrirBusca?: () => void; onSair?: () => void;
  })
  ```

- [ ] **Step 1: Atualizar o teste do Header (failing)**

Em `Header.test.ts`: remover `propAtiva: null`/`onTrocarProp: vi.fn()` do `baseProps` (linhas 43–44). **Remover** o teste "mostra o seletor de propriedade/sítio no header" (linhas 88–94). Adicionar um teste que garante a ausência:

```ts
it("não renderiza mais o seletor de propriedade no header", () => {
  const props = baseProps();
  render(h(Header, props));
  expect(screen.queryByRole("button", { name: /Propriedade \/ sítio/i })).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter rionovo-client exec vitest run src/components/Header.test.ts`
Expected: FAIL — o novo teste falha (o `PropriedadePicker` ainda está no Header, da Task 1).

- [ ] **Step 3: Editar `Header.tsx`**

- Remover a linha `<PropriedadePicker propAtiva={propAtiva} onTrocarProp={onTrocarProp} />` (~linha 252).
- Remover o import `import { PropriedadePicker } from "./PropriedadePicker";`.
- Remover o bloco `ah-brand` (o `<div className="ah-brand">…</div>` com `TerranoSymbol` + wordmark, ~linhas 244–250) e o import `import { TerranoSymbol } from "./TerranoLogo";` (linha 20).
- Remover `propAtiva` e `onTrocarProp` da desestruturação e do type de `Header` (~linhas 217, 225–226).

- [ ] **Step 4: Editar `App.tsx` — reparentar props**

Em `App.tsx`, no `<Header ...>` (linhas ~352–362), **remover** `propAtiva={propAtiva}` e `onTrocarProp={trocarPropriedade}`. No `<AppSidebar ...>` (linhas ~363–371), **adicionar** `propAtiva={propAtiva}` e `onTrocarProp={trocarPropriedade}`:

```tsx
<AppSidebar
  current={tab}
  onNav={setTab}
  financeiro={visibleTabs}
  isAdmin={isAdmin}
  podeVerFolha={canSeeFolha}
  mobileOpen={mobileOpen}
  onMobileToggle={setMobileOpen}
  propAtiva={propAtiva}
  onTrocarProp={trocarPropriedade}
/>
```

- [ ] **Step 5: Run the Header test to verify it passes**

Run: `pnpm --filter rionovo-client exec vitest run src/components/Header.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-check + full client suite**

Run: `pnpm --filter rionovo-client exec tsc --noEmit && pnpm --filter rionovo-client run test`
Expected: sem erros de tipo; todos os testes do client passam.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/Header.tsx client/src/components/Header.test.ts client/src/App.tsx
git commit -m "feat(client): header sem seletor de fazenda/wordmark; sidebar recebe propriedade

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Verificação visual no navegador + build

Rodar o app e conferir contra o screenshot alvo nos 3 breakpoints; garantir que o build passa.

**Files:** nenhum (verificação). Se surgirem ajustes finos de espaçamento/estilo, editar `AppSidebar.tsx`.

- [ ] **Step 1: Build de produção**

Run: `pnpm --filter rionovo-client run build`
Expected: build conclui sem erros (tsc + vite build).

- [ ] **Step 2: Subir o dev server e abrir**

Run (background): `pnpm dev` (server + client — o `usePropriedades` bate na API real; sem backend o seletor mostra "Carregando…").
Abrir `http://localhost:41875`.

- [ ] **Step 3: Conferência visual — desktop (>1100px)**

Verificar contra o screenshot alvo:
- Sidebar: "Terrano" + onda no topo, seletor "FAZENDA / Rio Novo" logo abaixo.
- Grupo "Gestão": Dashboard, Gastos, Lançar, IA financeira, Relatório.
- Grupo "Atividades": 5 módulos, cada um com meta subtitle; o da aba atual expandido com sub-abas.
- "Configurações" no rodapé, com hairline acima.
- Header: sem seletor de fazenda, sem wordmark; busca (⌘K) + chip do usuário à direita.

Usar o chrome-devtools MCP (`take_snapshot` / `take_screenshot`) para registrar.

- [ ] **Step 4: Conferência — faixa colapsada (901–1100px) e mobile (<=900px)**

- Redimensionar para ~1000px: sidebar vira icon-rail e expande no hover (bloco de marca some/reaparece via `RAIL_BLOCK`).
- Redimensionar para ~800px: header mostra o burger; clicar abre o drawer (Sheet) com o mesmo `navBody` (marca + grupos + footer).

- [ ] **Step 5: Trocar propriedade pela sidebar**

Clicar no seletor na sidebar → escolher um sítio/Consolidado → confirmar que o app reescopa (o conteúdo remonta via `key={propAtiva}` no `App.tsx`).

- [ ] **Step 6: Commit de ajustes (se houver)**

```bash
git add -A
git commit -m "style(client): ajustes finos da sidebar Terrano após conferência visual

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

(Se nenhum ajuste foi necessário, pular este commit.)

---

## Notas de fechamento (pós-execução)

- Atualizar a memória `fazenda-propriedade-setor-hierarquia` (o seletor de propriedade voltou do header para a sidebar; reverte parte do PR #125).
- Abrir PR a partir de `feat/sidebar-header-terrano-shell` quando o preview/build estiver verde (ver `ci-green-merge-autonomy`).
