# Command Palette — busca global no header (design)

**Data:** 2026-06-30 · **Status:** aprovado (escopo: páginas/abas + ações; sem backend)

## Objetivo
Busca global estilo Cloudflare (⌘K) no header: o usuário digita qualquer coisa e
vê **sugestões agrupadas** num modal, navegando por teclado. Escopo v1 =
**navegação (páginas/abas) + ações** (atalhos pra aba certa). Sem backend, sem
schema. Arquitetura pronta pra somar entidades reais (talhões/animais) depois.

## Componentes (client-only)

1. **`client/src/lib/searchIndex.ts`** — fonte estática + busca pura.
   - `type Comando = { id: string; tab: Tab; label: string; grupo: Grupo; sinonimos?: string[]; acao?: boolean }`.
   - Enumera as ~37 abas (Financeiro, Rebanho, Plantio, Gado de corte, Administração) com `grupo` e `sinonimos`
     (ex.: talhão~lavoura, gasto~despesa, vaca~animal, saca~café), os nomes de módulo, e ~6 **ações**
     que mapeiam pra uma aba ("Lançar gasto"→`lancar`, "Novo talhão"→`pla-talhao`, "Plano de contas"→`plano`).
   - `buscar(comandos, q): Comando[]` — pura, testável: filtra por substring em label+sinonimos+grupo;
     ranqueia (começo-do-label > começo-de-palavra > substring); estável; query vazia → curadoria de destinos-topo.

2. **`client/src/components/CommandPalette.tsx`** — o modal.
   - Props: `{ aberto, onFechar, onNav(tab), podeVer(tab): boolean }`. Filtra o índice por `podeVer`
     (reusa o `canSee` do App — não mostra aba bloqueada do Financeiro/Admin; abas de módulo são sempre visíveis;
     Corte aparece mas leva ao "em breve").
   - Input com lupa + chip "Esc"; resultados agrupados por `grupo` com cabeçalho de seção; linha selecionada destacada.
   - **Teclado**: ↑↓ move seleção (com wrap), **Enter** seleciona (`onNav` + fecha), **Esc** fecha; hover seleciona.
     Rodapé com dicas "↑↓ navegar · ↵ selecionar". Query vazia → "Sugestões" + dicas. Sem resultado → "Nenhum resultado".
   - Acessibilidade: `role="dialog"` aria-modal, foco no input ao abrir, foco preso, `body` com scroll travado enquanto aberto,
     clique no backdrop fecha.

3. **`client/src/components/Header.tsx`** — adiciona o **campo de busca visível** ("Pesquisar páginas e recursos…" + dica ⌘K)
   que abre o modal ao focar/clicar. Estilo discreto no topo escuro.

4. **`client/src/App.tsx`** — monta `<CommandPalette>` no root; estado `paletaAberta`; listener global
   **⌘K / Ctrl+K** (preventDefault) e **Esc**; passa `onNav={setTab}` e `podeVer={canSee}` (abas de módulo sempre true).

5. **`client/src/styles/command-palette.css`** (importado em `main.tsx`) — modal claro arredondado com sombra,
   fontes do app (DM Sans/Newsreader), escopo `.cmdk-*`.

## Não-objetivos (v1)
- Busca de entidades reais do banco (talhão/animal/lançamento) — fatia futura (estrutura já pronta).
- Prefixos de escopo ("talhão:") estilo Cloudflare — futuro.
- Histórico de buscas recentes / favoritos.

## Testes
- `searchIndex.test.ts` — `buscar()` (ranking, sinônimos, query vazia, sem match).
- Smoke de render do `CommandPalette` (react-dom/server) — não quebra SSR.

## Verificação
- `tsc` + vitest + `vite build` verdes. Browser: ⌘K abre, digitar filtra/agrupa, ↑↓/Enter navega,
  Esc fecha, permissão respeitada, sem erro de console; sem regressão no resto do app.
