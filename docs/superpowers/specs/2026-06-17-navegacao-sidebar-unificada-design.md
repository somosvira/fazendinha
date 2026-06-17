# Navegação unificada num sidebar único — Design

**Data:** 2026-06-17
**Status:** aprovado no brainstorming (usuário escolheu "Sidebar agrupada (tudo visível)" e aprovou o design)

---

## 1. Problema

O app tem **dois paradigmas de navegação** que se contradizem:
- O **app financeiro** (`App.tsx` + `Masthead`) usa uma **top bar** com as abas Dashboard, Gastos, Lançar, Categorias, IA, Relatório, (Acessos), Rebanho.
- Ao clicar **Rebanho**, o `App` faz `return <RebanhoApp/>` — que troca o layout inteiro por uma **sidebar à esquerda** (Dashboard, Animal, Reprodução, Sanidade, Nutrição, IA).

Clicar num item da top bar abre uma sidebar: troca de paradigma no meio do app. O usuário quer **tudo num sidebar único e consistente**, sem top bar.

## 2. Objetivo

Um **shell único**: sidebar fixa à esquerda + área de conteúdo à direita, para o app inteiro. Todos os destinos (financeiro **e** rebanho) viram itens desse sidebar, agrupados. A top bar (`Masthead`) é aposentada. Nenhuma mudança de backend, nem no conteúdo das telas.

## 3. Escopo

**Dentro:**
- Novo **sidebar app-level** (reaproveita o visual da sidebar do rebanho — `.rb-side`), com dois grupos:
  - **FINANCEIRO**: Dashboard · Gastos · Lançar · Categorias · Relatório · IA financeira
  - **REBANHO**: Painel · Animal · Reprodução · Sanidade · Nutrição · IA do rebanho
  - Rodapé: **Acessos** (só admin) + chip do usuário com menu "ver como".
- `App.tsx` vira o shell único (sidebar + `<main>`); deixa de dar `return <RebanhoApp/>`.
- `RebanhoApp` perde sidebar/shell próprios — vira só **conteúdo** que renderiza na área comum.
- Estado de navegação **unificado** em `App` (uma união de chaves sem colisão).
- **Permissionamento preservado**: itens do grupo Financeiro continuam gated por perfil + "ver como"; grupo Rebanho visível a todos (como hoje).
- CSS de layout: conteúdo passa a sentar ao lado da sidebar (offset único `margin-left: var(--side-w)`), sem a top bar.

**Fora (YAGNI):**
- Fundir as duas IAs (financeira × rebanho) numa só.
- Mudar conteúdo/telas internas.
- Responsividade mobile / sidebar colapsável.
- Reorganizar permissionamento do rebanho (continua sem gating por perfil).

## 4. Arquitetura

### 4.1 Estado de navegação (sem colisão de chaves)
As uniões atuais colidem em `dashboard` e `ia`. Unificar namespaceando os destinos do rebanho:

```ts
type Tab =
  | "dashboard" | "gastos" | "lancar" | "plano" | "ia" | "relatorio" | "acessos"   // financeiro (inalterado)
  | "reb-dashboard" | "reb-animal" | "reb-reproducao" | "reb-sanidade" | "reb-nutricao" | "reb-ia"; // rebanho
```

`App` mantém um único `tab: Tab`. Chaves `reb-*` roteiam para o **conteúdo do rebanho**; as demais para as telas financeiras (exatamente como hoje). A chave antiga `"rebanho"` deixa de existir.

### 4.2 Shell
```
<div class="app">
  <AppSidebar current={tab} onNav={setTab} financeiroTabs={visibleTabs} isAdmin={...} user={...} allUsers={...} onSwitchUser={...} />
  <main class="app-main">
    {viewAsBanner?}
    {conteúdo da aba ativa}
  </main>
</div>
```
- `AppSidebar` é um componente novo (em `components/AppSidebar.tsx`) com o visual de `.rb-side`. Renderiza os dois grupos + rodapé (Acessos + chip com menu "ver como"). O menu "ver como" (hoje no `Masthead`) migra pra cá.
- `.app-main { margin-left: var(--side-w); }` — **único** mecanismo de offset para todo o conteúdo.
- O `viewas-banner` (quando vendo como outro perfil) passa pro topo de `.app-main`.

### 4.3 Conteúdo do rebanho
`RebanhoApp` vira `RebanhoContent`: recebe a sub-aba ativa (derivada de `reb-*`) e mantém **internamente** o estado do drill-down da ficha (`animalId` do cockpit) e o drawer de formulário — igual hoje, menos a `<Sidebar>` própria. O `useRebanhoNav` é simplificado/substituído: a aba vem de cima (do `App`), o `animalId` continua local.

### 4.4 CSS (reconciliação do offset)
Hoje `.rb-main` já aplica `margin-left: var(--side-w)`. Com o offset único em `.app-main`, isso **duplicaria**. Solução:
- `--side-w` promovido para `:root` (hoje só existe em `.rb`).
- `.app-main { margin-left: var(--side-w); }` passa a ser o offset de tudo.
- `.rb-main` **perde o `margin-left`** (mantém `max-width: 1100px; padding: …`) — passa a viver dentro de `.app-main`, que já deslocou.
- A sidebar app-level reusa as regras `.rb-side …` (mesmo visual). O wrapper `.rb` (vars/escopo) continua envolvendo o conteúdo do rebanho.
- `.masthead` e `.nav-tabs` (base.css) e qualquer offset de topo que existia por causa da top bar são removidos/neutralizados. As telas financeiras passam a viver dentro de `.app-main`.
- Variáveis `--mast-bg/--mast-ink/--leite` já são globais (usadas pela masthead e pela rb-side) — seguem servindo a sidebar nova.

### 4.5 Componentes tocados
- **Novo:** `client/src/components/AppSidebar.tsx`.
- **Modificar:** `App.tsx` (shell único, estado unificado, roteamento `reb-*`), `components/Shell.tsx` (aposenta `Masthead`; mantém `ReportHeader` e o tipo `Tab` movido/expandido — ou move `Tab` pra um módulo de nav), `rebanho/RebanhoApp.tsx` → `RebanhoContent` (sem `<Sidebar>`), `rebanho/components/Sidebar.tsx` (removido ou absorvido pelo `AppSidebar`), `rebanho/nav.ts` (simplifica), CSS: `styles/base.css` (masthead) + `rebanho/styles/rebanho.css` (`--side-w`, `.rb-main`, `.app`/`.app-main`).

## 5. Nomes dos itens (desambiguação)
Como há dois "Dashboard" e dois "IA":
- Financeiro: **Dashboard** · **IA financeira**.
- Rebanho: **Painel** · **IA do rebanho**.
Demais itens mantêm o nome. Trivial de ajustar depois.

## 6. Permissionamento
- `visibleTabs` (perfil) segue calculado como hoje e alimenta o **grupo Financeiro** do sidebar. Itens não permitidos não aparecem; `acessos` só admin.
- O grupo **Rebanho** aparece para todos (espelha o comportamento atual de anexar "Rebanho" para qualquer perfil).
- "Ver como" (troca de usuário) migra pro chip no rodapé do sidebar; o `viewas-banner` continua, no topo de `.app-main`.
- Ao trocar de perfil, se a aba ativa não é permitida, cai para a primeira disponível (regra atual preservada).

## 7. Testes / verificação
- Build do client + `tsc` limpos; suíte vitest verde (inclui o smoke de render do rebanho — atualizar se o shell mudar a árvore).
- Verificação no navegador (chrome-devtools): (a) sidebar única, sem top bar; (b) navegar Financeiro (Dashboard/Gastos/Relatório) e Rebanho (Painel/Animal/IA) troca só o conteúdo; (c) ficha do animal (cockpit) abre/volta; (d) "ver como" reduz o grupo Financeiro e mascara valores; (e) sem duplo-offset (conteúdo encostado na sidebar, alinhado).

## 8. Decisões deferidas
- Sidebar colapsável / mobile. · Fundir as duas IAs. · Ícones próprios para os itens financeiros (por ora, reusar/streamlinar os do rebanho ou sem ícone). · Gating por perfil do grupo Rebanho.
