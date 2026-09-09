# Navegação da dashboard (deep-links da IA)

> **Gerado por `scripts/gen-nav-doc.ts` a partir de `server/src/services/bot/navegacao.ts`.**
> Não editar à mão — mexer no catálogo e rodar `pnpm gen:nav-doc`. Gerado em 2026-09-09.

Este é o guia que a IA recebe no contexto (via `navegacaoResumo()`) para responder com
links internos que levam o usuário à tela/tabela certa, já com o recorte aplicado.

Formato do link: `[rótulo curto](/caminho?param=valor&param2=valor2)`.

## Rotas e filtros

### `/financeiro` — Financeiro — visão geral do período

**Quando linkar:** Quando o usuário quer VER o panorama do caixa: saldo das contas, quanto entrou e saiu no período, o que está a pagar e a receber, e as maiores despesas por categoria.

**Filtros:**
  - `de` — início do período, YYYY-MM-DD
  - `ate` — fim do período, YYYY-MM-DD

**Exemplos:**
  - [Abrir a visão geral do financeiro](/financeiro)

### `/financeiro/compromissos` — Compromissos (a pagar / a receber / liquidados)

**Quando linkar:** Pedidos de DETALHE do que está em aberto: contas a pagar, o que vence, o que já venceu, valores a receber de um cliente. É a agenda de valores pendentes — não confundir com o dinheiro já movimentado.

**Filtros:**
  - `aba` (PAGAR | RECEBER | LIQUIDADOS) — aba da tela
  - `vencidos` (true) — mostrar somente vencidos

**Exemplos:**
  - [Ver o que está a pagar](/financeiro/compromissos?aba=PAGAR)
  - [Ver os compromissos vencidos](/financeiro/compromissos?aba=PAGAR&vencidos=true)
  - [Ver o que há a receber](/financeiro/compromissos?aba=RECEBER)

### `/financeiro/operacoes` — Operações financeiras

**Quando linkar:** Quando a resposta trata de compras, vendas, serviços ou lançamentos já registrados, e o usuário pode querer ver a lista com os efeitos de cada um (estoque, pagamento, recebimento, compromisso).

**Filtros:**
  - `busca` — texto livre: descrição, parceiro ou número da operação
  - `tipo` (COMPRA_ESTOQUE | COMPRA_CONSUMO_DIRETO | SERVICO | VENDA | APORTE | RETIRADA | TRANSFERENCIA_FINANCEIRA | DEVOLUCAO) — tipo da operação
  - `status` (CONFIRMADA | CANCELADA) — situação da operação
  - `efeito` (ESTOQUE | PAGAMENTO | RECEBIMENTO | A_PAGAR | A_RECEBER | TRANSFERENCIA | SEM_EFEITOS) — efeito gerado pela operação
  - `de` — data inicial, YYYY-MM-DD
  - `ate` — data final, YYYY-MM-DD

**Exemplos:**
  - [Ver as compras do período](/financeiro/operacoes?tipo=COMPRA_ESTOQUE)
  - [Ver as operações da Cargill](/financeiro/operacoes?busca=Cargill)
  - [Ver as vendas confirmadas](/financeiro/operacoes?tipo=VENDA&status=CONFIRMADA)

### `/financeiro/contas` — Contas e extratos

**Quando linkar:** Perguntas de saldo: quanto há em caixa ou no banco, e o extrato de uma conta específica. Também é o destino de transferências entre contas próprias.

**Filtros:**
  - (sem filtros de deep-link)

**Exemplos:**
  - [Ver as contas e saldos](/financeiro/contas)

### `/financeiro/relatorios` — Relatórios financeiros

**Quando linkar:** Quando o usuário pede um fechamento ou consolidação por tipo de operação, a partir do que já está registrado.

**Filtros:**
  - (sem filtros de deep-link)

**Exemplos:**
  - [Abrir os relatórios financeiros](/financeiro/relatorios)

### `/pecuaria/animal` — Rebanho — lista de animais

**Quando linkar:** Quando a resposta é sobre o rebanho/animais e o usuário pode querer ver a lista.

**Filtros:**
  - (sem filtros de deep-link)

**Exemplos:**
  - [Ver o rebanho](/pecuaria/animal)

### `/pecuaria/producao` — Produção de leite

**Quando linkar:** Pedidos de produção/controle leiteiro do rebanho.

**Filtros:**
  - `worklist` (producao-caindo) — abre a tela já com a lista de trabalho aplicada

**Exemplos:**
  - [Ver a produção de leite](/pecuaria/producao)
  - [Ver as vacas com produção caindo](/pecuaria/producao?worklist=producao-caindo)

### `/pecuaria/sanidade` — Sanidade / alertas do rebanho

**Quando linkar:** Pedidos de sanidade, CCS, mastite, carência, vacinas e alertas do rebanho.

**Filtros:**
  - `worklist` (ccs-alta | carencia | vacina-pendente) — abre a tela já com a lista de trabalho aplicada

**Exemplos:**
  - [Ver alertas de sanidade](/pecuaria/sanidade)
  - [Ver as vacas com CCS alta](/pecuaria/sanidade?worklist=ccs-alta)
  - [Ver o leite em carência](/pecuaria/sanidade?worklist=carencia)

### `/pecuaria/reproducao` — Reprodução do rebanho

**Quando linkar:** Pedidos de reprodução: o que inseminar, diagnóstico de gestação pendente, secagem, partos previstos.

**Filtros:**
  - `worklist` (secagem-atrasada | vazia-pos-pev | dg-pendente | parto-proximo | precisa-de-exame) — abre a tela já com a lista de trabalho aplicada

**Exemplos:**
  - [Ver a reprodução](/pecuaria/reproducao)
  - [Ver os DGs pendentes](/pecuaria/reproducao?worklist=dg-pendente)
  - [Ver as secagens atrasadas](/pecuaria/reproducao?worklist=secagem-atrasada)

## Plano de implementação no client (filtros)

O que **já funciona**: `?worklist=<chave>` nas telas de reprodução, sanidade e produção do
rebanho. O router expõe `REBANHO_WORKLISTS` + `parseRotaWorklistRebanho` e o App.tsx
aplica a lista de trabalho na montagem — esses deep-links podem ser emitidos hoje.

O que **falta**: as telas do financeiro ainda não leem query string. A navegação é
`useState<Tab>` + History API gravando só o path (client/src/router.ts, App.tsx), e cada
tela inicializa os próprios filtros em `useState`. Para os links do financeiro aplicarem
filtro:

1. **Parsear a query string na entrada** (App.tsx, junto de `pathToTab`): ler
   `window.location.search` -> objeto de filtros e passar para a tela via prop
   (ex.: `deepLinkFiltros`), reaproveitando o padrão já usado pelo `?worklist=`.
2. **Cada tela consome os params na montagem**, usando os nomes que ela já tem em estado:
   - `CompromissosFinanceiros` -> `aba` (PAGAR | RECEBER | LIQUIDADOS) e `soVencidos`;
   - `OperacoesFinanceiras` -> `busca`, `tipo`, `status`, `efeito`, `inicio`/`fim`;
   - `VisaoGeralFinanceira` -> período (`de`/`ate`), que já vai à API como inicio/fim.
3. **Refletir filtro->URL** (opcional, fase 2): ao mudar um filtro, `replaceState` com a
   query atualizada, para o link ser compartilhável e recarregável.
4. **Tornar o link clicável no chat**: o `Formatado` (client/src/components/ChatWidget.tsx)
   só entende `**negrito**`. Estender para detectar `[rótulo](/caminho?filtros)` e renderizar
   um `<button>` que chama um callback de navegação in-app (setTab + aplicar filtros) — **não**
   um `<a href>` puro (recarregaria a página).

Ordem sugerida: 4 -> 1 -> 2 (clicável primeiro, depois os filtros de fato). Cada tela pode
entrar incrementalmente; enquanto uma não lê os params, o link ainda abre a aba certa.
