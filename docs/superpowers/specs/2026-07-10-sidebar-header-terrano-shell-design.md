# Sidebar + Header restyle — Terrano shell (mockup "Onboarding - sidebar personalizada")

**Data:** 2026-07-10
**Origem:** design importado do Claude Design (projeto `fazendinha`, arquivo `Onboarding - sidebar personalizada.html`).
**Escopo:** SOMENTE o realce visual/estrutural da **sidebar** e do **header**. O wizard de onboarding, a personalização por atividade, o botão "Refazer onboarding" e o toast **estão fora de escopo** (ficam para depois).

---

## 1. Objetivo

Deixar o shell do app (sidebar + header) **exatamente** como o screenshot alvo do mockup: uma sidebar com bloco de marca "Terrano" + seletor de propriedade no topo, grupos "Gestão" e "Atividades", atividades como linhas com subtítulo (meta), "Configurações" fixado no rodapé; e um header simplificado (sem o seletor de fazenda e sem o wordmark, que migram para a sidebar).

Nenhuma navegação é perdida: todos os módulos e sub-abas continuam alcançáveis.

## 2. Decisões tomadas (confirmadas com o usuário)

1. **Seletor de propriedade migra para a sidebar.** Reverte a colocação do PR #125 (que o pôs no header). O header perde o `FarmPicker`; ele passa a viver no bloco de marca da sidebar. É o seletor REAL (usa `usePropriedades`, `onTrocarProp`, `GerenciarPropriedades`) — nenhuma lógica nova, só realocação.
2. **Sem wizard de onboarding, sem personalização, sem filtro.** Mostrar **todas** as atividades como linhas planas no estilo do mockup.
3. **Sub-abas: acordeão híbrido.** Só o módulo ativo expande (single-open), dirigido pela aba atual. Módulos inativos ficam como linha única. A máquina de acordeão já existe no `AppSidebar` — muda-se o comportamento para single-open dirigido pela aba e o estilo para o do mockup.
4. **Meta subtitles estáticas.** Como não há personalização/back-end, o subtítulo de cada atividade ("gado leiteiro", "lavoura de café", etc.) é um rótulo estático no config `MODULOS`. Não é dado ao vivo.
5. **Sem estado de acordeão persistido.** Remove-se o `localStorage` de `openModulo` (`STORAGE_KEY = "rionovo:sidebar:openModulo"`); o módulo expandido é sempre o da aba atual.

## 3. Estado atual (o que existe hoje)

- `client/src/components/AppSidebar.tsx` — trilho desktop (persistente, com colapso 901–1100px) + drawer mobile (`Sheet`). Nav em 3 grupos: "Visão & gestão" (financeiro), "Operações" (5 módulos em acordeão), "Administração" (Cadastros/Configurações/Acessos no fim). **Sem bloco de marca.** Acordeão com `openModulo` persistido em `localStorage`.
- `client/src/components/Header.tsx` — faixa preta: hamburger (mobile), `ah-brand` (logo Terrano), `FarmPicker` (seletor de propriedade), busca (`⌘K`), espaçador, `UserPicker` (chip do usuário). Header fixo em `left-[var(--side-w)]`.
- `client/src/App.tsx` — passa `propAtiva`/`onTrocarProp` ao **Header**. Passa `current`/`onNav`/`financeiro`/`isAdmin`/`podeVerFolha`/`mobileOpen`/`onMobileToggle` ao **AppSidebar**.
- Módulos (`RebanhoContent` etc.) recebem `aba` como prop e renderizam a view; **a navegação de sub-abas mora no AppSidebar** (não há tira de sub-abas no conteúdo). O acordeão híbrido preserva isso.

## 4. Mudanças por arquivo

### 4.1 `AppSidebar.tsx` (mudança principal)

**A. Bloco de marca (novo, no topo do `<aside>` e do painel do `Sheet`):**
- Wordmark "Terrano" (Newsreader serif, ~21px) + logo de onda (wave SVG, cor `--leite`/brass). Reusar o `TerranoSymbol`/wave já existente.
- Abaixo, o **seletor de propriedade** — botão com borda, eyebrow "FAZENDA"/"Sítio" + nome da propriedade ativa + chevron; dropdown com Consolidado (se ≥2 sítios) + cada sítio + "Gerenciar propriedades". **Mover a função `FarmPicker` de `Header.tsx` para cá** (ou extrair para um componente compartilhado `PropriedadePicker`), adaptando o estilo ao bloco escuro da sidebar (mockup `.farm-ctx`).
- O `AppSidebar` passa a receber `propAtiva: number | null` e `onTrocarProp: (id: number|null) => void` como props novas.

**B. Grupos relabeled + estilo do mockup:**
- "Visão & gestão" → **"Gestão"** (Dashboard, Gastos, Lançar, IA financeira, Relatório).
- "Operações" → **"Atividades"** (os 5 módulos).
- "Administração" continua, mas **"Configurações" fixado no rodapé** (`side-foot`) com hairline separador, como no mockup. Cadastros e Acessos (se admin) permanecem no grupo Administração acima do rodapé; só Configurações vai ao pé.
- Itens no estilo do mockup: pílula com `border-radius ~7px`, hover sutil, item ativo com barra brass à esquerda (`::before`, 3px, `--leite`) + preenchimento fraco.

**C. Acordeão híbrido (single-open dirigido pela aba):**
- Cada módulo é uma linha única com ícone + nome + **meta subtitle** (linha menor abaixo do nome) + chevron `›`.
- **Só um módulo expande por vez, e é sempre o da aba atual.** Remover o `useState(openModulo)` persistido em `localStorage` e derivar o módulo aberto de `moduloOfTab(current)`. Clicar numa linha de atividade navega para o dashboard daquele módulo (o que torna aquele módulo o ativo → expande).
- Sub-itens nested com o estilo do mockup (régua fina à esquerda, texto menor, sub-item ativo com barrinha brass).
- **Preservar** o colapso 901–1100px (icon-rail) e o drawer mobile — o bloco de marca e os estilos novos fluem por ambos.

**D. Meta subtitles estáticas** no config `MODULOS`: adicionar `meta?: string` por módulo (ex.: Rebanho "gado leiteiro", Plantio "lavoura de café", Corte "gado de corte", Milho "grão e silagem", Equipe "pessoas e diárias"). Renderizado como a linha `.meta` do mockup.

### 4.2 `Header.tsx`

- **Remover** o `FarmPicker` (migra para a sidebar) e a chamada correspondente.
- **Remover** o bloco `ah-brand` (wordmark Terrano) do header — a marca agora vive na sidebar (mockup: header sem wordmark). A busca desloca-se para a esquerda.
- **Manter**: hamburger (mobile), busca (`⌘K`), espaçador, `UserPicker`.
- Remover as props `propAtiva`/`onTrocarProp` da assinatura de `Header` (passam a ir para `AppSidebar`).
- Se `FarmPicker` for extraído para um componente compartilhado, `Header.tsx` deixa de importar `usePropriedades`/`GerenciarPropriedades`.

### 4.3 `App.tsx`

- Parar de passar `propAtiva`/`onTrocarProp` ao `<Header>`; passar ao `<AppSidebar>`.

### 4.4 Testes

- `client/src/components/Header.test.ts` — atualizar para a assinatura sem `propAtiva`/`onTrocarProp` e sem `FarmPicker`/`ah-brand`.
- Adicionar/ajustar um teste de `AppSidebar` cobrindo: bloco de marca presente, seletor de propriedade dispara `onTrocarProp`, grupos "Gestão"/"Atividades" renderizados, meta subtitle visível, single-open dirigido pela aba (o módulo da aba atual expande; trocar de aba troca o expandido).

## 5. Fora de escopo (explícito)

- Wizard de onboarding (modal de 3 passos), botão "Refazer onboarding", toast.
- Qualquer filtro/personalização de atividades ou persistência das escolhas (localStorage ou back-end).
- Conteúdo/ghost do mockup (KPIs skeleton) — o conteúdo real dos módulos e do Dashboard **não é tocado**.
- Mobile: mantém-se o drawer `Sheet` atual (o mockup é desktop-only); nada de navegação mobile é removido.

## 6. Riscos & mitigação

- **Perder navegação de sub-abas.** Mitigado pelo acordeão híbrido (sub-abas continuam na sidebar). Nenhuma tira nova de sub-abas no conteúdo é necessária.
- **Reverter parte do PR #125.** Intencional e confirmado — o seletor de propriedade passa do header para a sidebar. Atualizar a memória `fazenda-propriedade-setor-hierarquia` ao final.
- **Regressão no colapso 901–1100px / drawer mobile.** Mitigado mantendo as constantes `RAIL_*` e a estrutura `group`; validar visualmente nos 3 breakpoints.
- **`--side-w` / `--header-h`.** O header fica em `left-[var(--side-w)]`; o bloco de marca cresce a altura da sidebar mas não muda a largura — sem impacto no offset do header.

## 7. Critérios de aceite

1. Sidebar renderiza: "Terrano" + wave, seletor de propriedade, grupo "Gestão", grupo "Atividades" (5 módulos com meta subtitle), "Configurações" no rodapé — visualmente igual ao screenshot.
2. Trocar propriedade pela sidebar reescopa o app (mesmo efeito de antes, via `onTrocarProp`).
3. Header não tem mais seletor de fazenda nem wordmark; busca (`⌘K`) e chip do usuário funcionam.
4. Clicar numa atividade abre o dashboard do módulo e expande só aquele módulo; as sub-abas funcionam.
5. Colapso 901–1100px e drawer mobile continuam funcionando.
6. `pnpm --filter rionovo-client run test` passa; `pnpm build` passa.
