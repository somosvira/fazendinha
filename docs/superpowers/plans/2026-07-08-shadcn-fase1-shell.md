# shadcn/ui — Fase 1 (Shell + CommandPalette) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax. Follow the playbook: `docs/superpowers/specs/2026-07-08-shadcn-migration-playbook.md`. Parent design: `docs/superpowers/specs/2026-07-08-shadcn-migration-design.md` (§3 fase 1).

**Goal:** Migrar a moldura do app (ReportHeader, Header/masthead, AppSidebar, CommandPalette) para Tailwind + shadcn, aposentando `command-palette.css`, os blocos `.ah-*`/masthead de `base.css`, e os blocos de sidebar em `rebanho/styles/rebanho.css` — sem regredir navegação, ⌘K, impersonation, ou o drawer mobile.

**Architecture:** Primitivas Radix novas (dropdown-menu, command/cmdk, sheet) tematizadas como as da Fase 0 (React 18 `forwardRef`, tokens editoriais, cantos retos, preflight ainda OFF). Cada componente migra preservando sua **API pública** (consumidores em `App.tsx` não mudam) e comportamento.

## Global Constraints
- Radix canônico; React 18 `forwardRef` em qualquer primitiva que receba ref.
- Preflight continua OFF (não tocar em `theme.css` layer setup).
- Preservar identidade (cantos retos; tokens `bg-mast`/`text-mast-ink`, `text-ink-3`, etc.).
- **APIs públicas inalteradas:** `ReportHeader`, `Header`, `AppSidebar`, `CommandPalette` mantêm as mesmas props (ver mapa). O tipo `Tab`/`NavTab` continua exportado de `Shell.tsx` (importado em ~10 arquivos) — não mover.
- Apagar só CSS monopolizado/comprovadamente morto; **manter** `.period-switch` (Dashboard), `.eyebrow`/`.caption`/`.h1` (genéricos), tokens `--mast-*`.
- Testes: portalizado → `// @vitest-environment jsdom` + RTL; sem portal → `renderToString`. Build `pnpm --filter rionovo-client run build`; test `run test`.
- Pré-existente (ignorar): `financeiro/__smoke__/render.test.ts` "ContasAVencer" falha desde antes.

---

### Task 1: Adicionar primitivas dropdown-menu, command, sheet

**Files:** Create `client/src/components/ui/dropdown-menu.tsx`, `command.tsx`, `sheet.tsx`; Test `client/src/components/ui/dropdown-menu.test.ts`.
**Interfaces produced:** os exports canônicos shadcn dessas 3 primitivas (DropdownMenu*, Command*/CommandDialog, Sheet*), tematizados como as da Fase 0.

- [ ] **Step 1:** `pnpm --filter rionovo-client add @radix-ui/react-dropdown-menu cmdk`. Sheet: fazer sobre `@radix-ui/react-dialog` (já instalado) para consistência com a Fase 0 — não adicionar `vaul`. Registrar a escolha no report.
- [ ] **Step 2 (RED):** teste jsdom para dropdown-menu: abrir (`open`) e ver um item; rodar, confirmar FAIL (módulo inexistente).
- [ ] **Step 3:** criar as 3 primitivas via `npx shadcn@latest add dropdown-menu command sheet` (lê `components.json`), depois **conferir/ajustar tema**: cantos retos, tokens (`bg-popover`, `text-popover-foreground`, `border-border`), e **React 18** (se o CLI gerar ref-as-prop, converter para `forwardRef`). `CommandDialog` deve usar o estilo de Dialog da Fase 0.
- [ ] **Step 4 (GREEN):** dropdown-menu test passa.
- [ ] **Step 5:** build + suíte verdes; commit `feat(ui): primitivas dropdown-menu, command, sheet`.

### Task 2: Migrar ReportHeader + purgar CSS morto do masthead

Componente trivial (layout puro). Também remove blocos de `base.css` com **0 uso** (confirmado pelo mapeamento): `.masthead`/`.masthead-inner`, `.brand*`, `.nav-tabs`/`.nav-tab`, `.user-chip`/`.user-avatar`.

**Files:** Modify `client/src/components/Shell.tsx` (só o corpo de `ReportHeader`; **manter** exports de tipos `Tab`/`NavTab`); Modify `client/src/styles/base.css`; Test `client/src/components/Shell.test.ts`.

- [ ] **Step 1 (RED):** teste SSR de `ReportHeader` afirmando o subtítulo + que renderiza um `h1`, mais uma marca nova introduzida na reescrita (ex.: um `data-slot="report-header"`) para RED genuíno contra o markup atual. Rodar, confirmar FAIL.
- [ ] **Step 2:** reescrever `ReportHeader` em Tailwind (grid `report-header` → `grid grid-cols-[1fr_auto] items-end gap-6 border-b border-border py-7`; `report-title`/`report-meta` → flex cols; adicionar `data-slot="report-header"`). Manter `<DateRangePicker>` intacto. Manter `eyebrow`/`h1`/`caption` (compartilhados) por ora.
- [ ] **Step 3 (GREEN):** teste passa.
- [ ] **Step 4:** em `base.css` deletar (a) o bloco `report-header`/`report-title`/`report-meta`; (b) os blocos MORTOS `.masthead`+`.masthead-inner`, `.brand`/`.brand-mark`/`.brand-name`/`.brand-sub`, `.nav-tabs`/`.nav-tab`(+`:hover`/`[aria-current]`), `.user-chip`/`.user-avatar`. **Não** tocar `.period-switch`.
- [ ] **Step 5:** grep de sanidade: nenhuma dessas classes referenciada em `.tsx/.ts`. Build + suíte verdes; commit `feat(shell): migra ReportHeader; remove CSS masthead/brand/nav-tab morto`.

### Task 3: Migrar Header (FarmPicker/UserPicker → dropdown-menu) — REQUER APP RODANDO P/ VERIFICAR
Substituir os dois menus hand-rolled + `useClickOutside` por `dropdown-menu`; manter botão de busca (⌘K → `onAbrirBusca`) e burger (→ `mobileOpen`). API pública inalterada. FarmPicker é **display-only** (não inventar troca). UserPicker = impersonation (`onSwitchUser`/`onSair`), só abre se `allUsers.length>1` ou `onSair`. Apagar `.ah-*` (base.css) e `.ah-search*` (command-palette.css). Verificação: dropdowns abrem/fecham, Escape, impersonation, ⌘K trigger, burger no mobile.

### Task 4: Migrar AppSidebar (sheet mobile + accordion) — REQUER APP RODANDO
Preservar: `openModulo` em `localStorage["rionovo:sidebar:openModulo"]`, auto-open do módulo da tab atual, filtro `podeVerFolha` (esconde `equipe`), rail hover-expand (CSS), e o drawer mobile compartilhado (`mobileOpen`/`onMobileToggle`, `<main inert>`). CSS vive em `rebanho/styles/rebanho.css` (`.rb-side*`, `.modulo*`, `.navi*`, `.grp`, `.spacer`). API pública inalterada (também consumido por `rebanho/__smoke__/render.test.ts`).

### Task 5: Migrar CommandPalette (shadcn command/cmdk em Dialog) — MAIOR RISCO, REQUER APP RODANDO
Rewrite sobre `command`+`Dialog`. Preservar TUDO: lista de 2 fontes (índice estático `lib/searchIndex.ts` + busca backend `/api/busca?q=` com min 2 chars, debounce 200ms, guarda de resposta stale); headers `comPropriedade()`; filtro `podeVer` nas duas fontes; contrato `onNav(t, entidadeId?)` (deep-links `reb-/pla-/cor-`); scroll-lock; ⌘K é do `App.tsx` (não re-bindar). Apagar `command-palette.css`. Verificação: busca, teclado (setas/enter/esc), deep-link, scope, permissões.

### Task 6: Cleanup + review final da fase
Confirmar que todos os blocos CSS monopolizados saíram; nenhuma classe legada órfã; build+suíte verdes; review whole-branch.

---
## Nota de execução (2026-07-08)
Tasks 1–2 executadas nesta sessão (foundation slice, baixo risco). Tasks 3–6 (Header/AppSidebar/CommandPalette + cleanup) ficam para um incremento focado **com o app rodando** para verificação comportamental (dropdowns, ⌘K, impersonation, drawer mobile, busca backend) — rewrite headless desses três seria arriscado.
