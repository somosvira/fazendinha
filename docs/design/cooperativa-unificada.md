# Cooperativa contemporânea — design unificado

Consolidação de 11/10/2026 na branch `codex/redesign-unificado-cooperativa`.

## Base de integração

Financeiro e Pecuária compartilhavam a base Git `f0907ce`; os redesigns estavam presentes como alterações locais no mesmo diretório. A branch unificada conserva ambos e inclui o redesign do Estoque. Nenhuma branch anterior foi apagada.

Direção visual: [Financeiro](financeiro-cooperativa/design.md) e [Pecuária](pecuaria-cooperativa/design.md). A paleta permanece em `client/src/styles/cooperativa-theme.css`; composição compartilhada em `financeiro-theme.css`. Estoque usa `estoque-theme.css` apenas para a composição específica de seus blocos.

## Identidade compartilhada

- Canvas sálvia, painéis brancos e ação principal verde floresta.
- DM Sans, títulos e textos com a mesma hierarquia.
- Sidebar, menus, seletores e portais de modais recebem os mesmos tokens.
- Painéis com raio de 16 px; controles com raio de 8 px e alvos de toque de 40–44 px.
- Abas usam Tabs/TabsList/TabsTrigger existentes, através da variante financeira de SubTabs.
- Tabelas usam TabelaFinanceira: cabeçalho sálvia, células de 10 × 16 px, texto de 14 px, números alinhados à direita e paginação compartilhada.
- A aplicação autenticada conserva essa identidade também ao navegar para configurações gerais. A seleção e persistência de temas ainda não são uma feature implementada.

## Estoque

`/estoque` mantém valor total, produtos em estoque e seis últimas entradas. Saldos e histórico passam a reunir cabeçalho, filtros, tabela e paginação no mesmo painel, com menos separações e alinhamento consistente. Alertas de mínimo usam TriangleAlert e o token de atenção.

`/estoque/produtos/:id` usa breadcrumb e abas Resumo, Lotes, Movimentos e Origens das entradas. O resumo apresenta saldo, categoria e custos recebidos da API. Listagens usam tabelas; ações por lote ficam no menu da linha. Renomear lote usa o diálogo compartilhado, preservando a gravação auditada existente.

Transferência, perda e cadastro de produto reutilizam os formulários existentes, com cabeçalhos e rodapés no tema compartilhado. Transferência e perda impedem fechamento enquanto a gravação está ocupada.

Preservados: escopo por sítio, permissões, mascaramento de custos, paginação no servidor, rastreio por partida, links de origem e estornos. Não foram alterados endpoints, schema, migrations ou regras de cálculo de saldo/custo.

## Evidências locais

[Galeria da unificação](../../output/qa/redesign-unificado-2026-10-11/index.html), com capturas antes/depois e estados responsivos. O [relatório de QA](../../design-qa.md) registra testes e limites da verificação. As imagens são artefatos locais de revisão.
