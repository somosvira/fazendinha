# Migração para shadcn/ui — Design

**Data:** 2026-07-08
**Status:** Fase 0 (Foundation) especificada; Fases 1–7 mapeadas (cada uma ganha seu próprio spec).
**Decisões do usuário:** base **Radix canônico** (`shadcn` upstream) · escopo **reescrita total** (aposentar o CSS, reexpressar tudo em Tailwind + shadcn) · **preservar a identidade editorial** via theme tokens.

---

## 1. Contexto

`client/` é um app **Vite 6 + React 18 + TypeScript**, hoje **sem Tailwind e sem shadcn**. São ~130 componentes estilizados por **12 arquivos CSS bespoke** (`base.css` sozinho tem ~1.850 linhas) com uma identidade editorial muito distinta:

- Paleta papel/tinta (`--bg #F2EDE2`, `--ink #14191A`) + atividades rurais brass/coffee/sage (`--leite`/`--cafe`/`--outros`) + sinais chapados (`--lucro`/`--prejuizo`/`--atencao`/`--info`).
- Tipografia **Newsreader** (serif, displays) + **DM Sans** (sans, corpo), já carregadas via Google Fonts no `index.html`.
- Cantos retos (sem border-radius), `font-variant-numeric: tabular-nums`, `font-feature-settings: ss01/cv11`.
- Gráficos são **SVG inline próprios** (`components/charts.tsx`) — fora do escopo desta migração.

O projeto irmão `pointless/apps/admin/components/ui` tem componentes shadcn sobre **@base-ui/react** + Tailwind v4 (React 19/Next). Servem de referência de convenção, mas **não serão portados** — a decisão foi Radix canônico.

## 2. Objetivo e não-objetivos

**Objetivo:** todo elemento de UI genérico e todo layout do `client/` passa a ser Tailwind + shadcn (Radix), aposentando os 12 arquivos CSS, **sem que a identidade visual mude** — as primitivas shadcn herdam o look Rio Novo via theme tokens.

**Não-objetivos:**
- Reescrever os gráficos SVG (`charts.tsx`) — permanecem como estão.
- Introduzir dark mode (o app não tem hoje; o bloco `.dark` fica vazio).
- Mexer no backend ou nos dados mock.
- Trocar de roteamento/estado.

## 3. Decomposição (mapa de fases)

Cada fase é entregável de forma independente e **aposenta o CSS que substitui**. Ordem por risco/dependência.

| Fase | Escopo | CSS aposentado | Primitivas-chave |
|------|--------|----------------|------------------|
| **0 · Foundation** | Tailwind+alias+cn+theme+primitivas iniciais+piloto | login/confirm (blocos de `base.css`) | button, input, label, textarea, dialog, select, dropdown-menu, sonner |
| 1 · Shell | Header, AppSidebar, masthead, nav, CommandPalette | `command-palette.css`, partes de `base.css` | command, dropdown-menu, sheet |
| 2 · Financeiro core | Dashboard, Relatório (KPI rows, DRE, activity cards) | `dashboard.css`, `dashboard-v2.css` | — (layouts) + card, table |
| 3 · Gastos/Lançar/forms | Gastos, Lançar, DateRangePicker, MonthRangePicker | `forms.css`, `datepicker.css` | popover, calendar, select, table |
| 4 · IA + Chat | IA, ChatWidget | `chat.css` | — |
| 5 · Rebanho | ~45 componentes do rebanho leiteiro | `rebanho.css`, `cockpit.css` | tabs, dialog, table, badge |
| 6 · Demais módulos | Corte, Plantio, Cultivo, Equipe, Caixinha | `simulador.css` etc. | reuso das anteriores |
| 7 · Cauda + cleanup | Acessos, Vigilância, Simulador; deletar CSS morto; remover `recharts` se não usado; remover shims de preflight | `acessos.css`, `vigilancia.css`, restante | — |

Fases 1–7 são **indicativas**; cada uma recebe seu próprio spec → plano → implementação. Este documento detalha só a Fase 0.

---

## 4. Fase 0 — Foundation (detalhe)

A única fase em que um erro contamina tudo a jusante. Entrega o toolchain, o theme fiel, um conjunto inicial de primitivas e um **piloto** que prova a esteira ponta a ponta.

### 4.1 Toolchain

- **Tailwind v4** via `@tailwindcss/vite` (plugin no `vite.config.ts`).
- Novo `src/styles/theme.css` com `@import "tailwindcss";` + blocos `@theme`/`:root`, **importado primeiro** em `main.tsx` para que o CSS legado ainda sobreponha durante a migração.
- **Alias `@/`** → `client/src` em `tsconfig.json` (`compilerOptions.paths`) **e** `vite.config.ts` (`resolve.alias`).
- **`cn`** (clsx + tailwind-merge) em `@/lib/utils`.
- **`components.json`** canônico: `style: new-york` (ou `default`), `baseColor: neutral`, `cssVariables: true`, `rsc: false`, aliases `@/components`, `@/components/ui`, `@/lib/utils`, `@/lib`, `@/hooks`.
- **Dependências adicionadas:** `tailwindcss`, `@tailwindcss/vite`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css` (ou `tailwindcss-animate`), `lucide-react`; pacotes `@radix-ui/*` entram por componente via `npx shadcn@latest add`.

### 4.2 Theme (preservação da identidade — o ponto crítico)

Mapear o sistema editorial nos tokens shadcn para que as primitivas nasçam com o look Rio Novo, drift zero. Valores finais validados no piloto; intenção:

| Token shadcn | Fonte editorial | Valor |
|--------------|-----------------|-------|
| `--background` | `--bg` papel | `#F2EDE2` |
| `--card` / `--popover` | `--bg-card` | `#FAF6EC` |
| `--foreground` | `--ink` | `#14191A` |
| `--muted-foreground` | `--ink-2` | `#3A4341` |
| `--border` / `--input` | `--rule` | `#D6CDB8` |
| `--primary` | `--ink` (botão escuro) | `#14191A` |
| `--primary-foreground` | `--bg` | `#F2EDE2` |
| `--destructive` | `--prejuizo` | `#C62828` |
| `--ring` | `--ink` | `#14191A` |
| `--radius` | cantos retos | `0` |
| `--chart-1..5` | brass/coffee/sage | `--leite`/`--cafe`/`--outros`… |

- **Fontes:** Tailwind `--font-sans` → DM Sans; adicionar `--font-serif` → Newsreader; manter `tabular-nums` e `ss01/cv11` no `body`.
- **Superfícies masthead** (`--mast-bg #0E1311`, `--mast-ink #E8DCC4`) e cores de atividade/sinal permanecem como **tokens Tailwind extras** (ex.: `bg-leite`, `text-lucro`, `bg-mast`), não sobrescrevem os tokens semânticos do shadcn.
- **Único tema claro** — sem dark mode.

### 4.3 Coexistência + risco de preflight

Risco honesto: o **preflight** do Tailwind (reset que "desestiliza" botões/headings) entra global enquanto os 12 CSS ainda vivem. Mitigação, decidida pelo piloto:

- Se o preflight regredir telas não migradas, escopar sob `@layer` / não importar o preflight até a Fase 7 (CSS legado continua autoritativo para telas legadas).
- Telas migradas são donas de Tailwind + shadcn; telas legadas continuam no CSS antigo.
- Gate da fase: `pnpm build` verde + smoke check manual antes/depois.

### 4.4 Primitivas + piloto

- **Primitivas adicionadas e tematizadas** para paridade: `button`, `input`, `label`, `textarea`, `dialog`, `select`, `dropdown-menu`, `sonner`. Cada uma conferida contra o look atual.
- **Piloto (prova o padrão ponta a ponta):** reescrever **`Login.tsx`** e **`ConfirmDialog.tsx`** sobre primitivas shadcn; deletar seus blocos de CSS legado (`login-*` e `confirm-*` em `base.css`); confirmar paridade visual + `vitest` verde.
- **`Toast.tsx`** reconciliado com `sonner` (ou mantido e envolvido) — decidido no piloto.
- **Entregável extra:** um **playbook de migração** curto (padrão repetível + definition-of-done) que toda fase seguinte segue, e o inventário CSS-arquivo → tela → primitiva que dirige a ordem das fases.

### 4.5 Testes / Definition of Done (por fase)

- `pnpm build` verde (tsc + vite).
- `vitest run` verde.
- Nenhuma classe CSS legada referenciada por componente migrado.
- Tela migrada bate visualmente com o baseline (antes/depois).
- Bloco de CSS aposentado **deletado** (não órfão).

## 5. Arquitetura / unidades

- `client/src/lib/utils.ts` — `cn`. Dependência: clsx, tailwind-merge. Uso: toda primitiva.
- `client/src/styles/theme.css` — `@import "tailwindcss"` + `@theme`/tokens. Fonte única do mapeamento de identidade.
- `client/src/components/ui/*` — primitivas shadcn (uma por arquivo, API canônica). Testáveis/entendíveis isoladamente.
- `components.json` — contrato do CLI shadcn; permite `npx shadcn add` nas fases seguintes.
- **Playbook** — o "como migrar uma tela" que padroniza as fases (seção 4.4).

## 6. Riscos

1. **Preflight quebra telas legadas** → mitigação 4.3 (escopar/adiar preflight).
2. **Drift visual sutil** (raio, peso de fonte, cor de borda) → theme conferido no piloto com comparação antes/depois; DoD exige paridade.
3. **React 18 + Radix** → Radix suporta 18; sem risco material, mas o build do piloto confirma.
4. **Escopo "reescrita total" é longo (multi-mês)** → mitigado pela decomposição: cada fase é shippável e reversível isoladamente.
5. **`Toast` custom vs `sonner`** → decidir no piloto sem bloquear (fallback: manter Toast atual e migrar depois).

## 7. Fora de escopo desta fase 0

Layouts editoriais grandes (KPI rows, DRE, activity cards, drawers, timelines, cockpits) e os módulos — todos nas Fases 1–7, cada um com spec próprio.
