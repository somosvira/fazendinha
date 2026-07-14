# Navegação da dashboard (deep-links da IA)

> **Gerado por `scripts/gen-nav-doc.ts` a partir de `server/src/services/bot/navegacao.ts`.**
> Não editar à mão — mexer no catálogo e rodar `pnpm gen:nav-doc`. Gerado em 2026-07-14.

Este é o guia que a IA recebe no contexto (via `navegacaoResumo()`) para responder com
links internos que levam o usuário à tela/tabela certa, já com o recorte aplicado.

Formato do link: `[rótulo curto](/caminho?param=valor&param2=valor2)`.

## Rotas e filtros

### `/gastos` — Contas (a vencer / vencidas / pagas)

**Quando linkar:** Pedidos de DETALHE de contas a pagar, o que vence, o que está vencido, ou a lista de pagamentos de um fornecedor/categoria. É a tabela filtrável do financeiro.

**Filtros:**
  - `status` (aVencer | vencidas | pagas) — aba da tela
  - `categoria` — filtra por categoria (parte do nome)
  - `pessoa` — filtra por fornecedor/cliente (parte do nome)
  - `q` — busca livre (fornecedor, descrição, valor)
  - `de` — vencimento inicial YYYY-MM-DD
  - `ate` — vencimento final YYYY-MM-DD

**Exemplos:**
  - [Ver contas vencidas](/gastos?status=vencidas)
  - [Pagamentos à Cargill](/gastos?pessoa=Cargill)
  - [Gastos com ração](/gastos?categoria=Ração)

### `/dashboard` — Painel do mês

**Quando linkar:** Quando o usuário quer VER o painel de um mês específico (visão de caixa, receita, custeio, investimento, maiores categorias).

**Filtros:**
  - `mes` — mês do painel, YYYY-MM

**Exemplos:**
  - [Abrir o painel de mai/2026](/dashboard?mes=2026-05)

### `/rebanho/animal` — Rebanho — lista de animais

**Quando linkar:** Quando a resposta é sobre o rebanho/animais e o usuário pode querer ver a lista.

**Filtros:**
  - (sem filtros de deep-link)

**Exemplos:**
  - [Ver o rebanho](/rebanho/animal)

### `/rebanho/producao` — Produção de leite

**Quando linkar:** Pedidos de produção/controle leiteiro do rebanho.

**Filtros:**
  - (sem filtros de deep-link)

**Exemplos:**
  - [Ver a produção de leite](/rebanho/producao)

### `/rebanho/sanidade` — Sanidade / alertas do rebanho

**Quando linkar:** Pedidos de sanidade, CCS, mastite, alertas do rebanho.

**Filtros:**
  - (sem filtros de deep-link)

**Exemplos:**
  - [Ver alertas de sanidade](/rebanho/sanidade)

## Plano de implementação no client (filtros)

Hoje a navegação é `useState<Tab>` + History API gravando **só o path** (client/src/router.ts,
App.tsx) — **nenhum filtro vive na URL**. Para os deep-links acima aplicarem filtro:

1. **Parsear a query string na entrada** (App.tsx, junto de `pathToTab`): ler
   `window.location.search` → objeto de filtros, e passar para a tela via prop
   (ex.: `deepLinkFiltros`), reaproveitando o padrão do ⌘K (`abrirId`/`onAbriuEntidade`).
2. **Cada tela consome os params na montagem**: Gastos/ContasAVencer inicializa seu
   `useState` de filtro a partir de `deepLinkFiltros` (status, categoria, pessoa, q, de, ate);
   Dashboard lê `mes`/`atividade`/`categoria`; Rebanho abre `id` pelo cockpit já existente.
3. **Refletir filtro→URL** (opcional, fase 2): ao mudar um filtro, `replaceState` com a query
   atualizada, para o link ser compartilhável/recarregável.
4. **Tornar o link clicável no chat**: hoje o `Formatado` (client/src/components/ChatWidget.tsx)
   só entende `**negrito**`. Estender para detectar `[rótulo](/caminho?filtros)` e renderizar
   um `<button>` que chama um callback de navegação in-app (setTab + aplicar filtros) — **não**
   um `<a href>` puro (recarregaria a página e hoje não carrega filtro).

Ordem sugerida: 4 → 1 → 2 (clicável primeiro, depois os filtros de fato). Cada tela pode
entrar incrementalmente; enquanto uma não lê os params, o link ainda abre a aba certa.
