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


## Refinamento dos 18 comentários — 11/10/2026

O cabeçalho da tabela precede os filtros, com ação à direita e busca primeiro. Tabela e paginação ficam junto às bordas do mesmo painel, sem uma segunda margem interna. A borda superior da tabela separa suas colunas dos controles. Operações, Compromissos, Contas/Extrato geral e as listagens sanitárias reutilizam essa composição. Botões respeitam as variantes default, outline e destructive das primitivas locais.

Em Compromissos, período de vencimento, busca, seleção múltipla e vencidos filtram a lista e o calendário; os três cards continuam mostrando o conjunto completo do sítio. A pagar/A receber incluem pendentes e parciais; Liquidados inclui títulos liquidados. Seleção vazia mostra todos, inclusive cancelados. As opções selecionadas são combinadas por OU. A consulta carrega o conjunto uma vez e o período é aplicado na listagem, preservando os parâmetros de rastreabilidade.

Em Contas, filtros do Extrato geral ficam dentro dele e não alteram a tabela de contas nem o fluxo consolidado do ano atual. Esta decisão substitui o gráfico dependente dos filtros do extrato descrito anteriormente. O detalhe individual da conta conserva seu período compartilhado entre gráfico e extrato.

Sanidade mantém os filtros dentro de cada listagem. Tarefas e Carências usam TabelaFinanceira; carências desconhecidas, não aplicáveis, prazo zero, expiração e revisão de finalidade continuam explícitos. Ações secundárias das tarefas ficam em menu, preservando sítio histórico, motivos e confirmação. Os controles permanecem montados durante a consulta para manter a digitação e o foco.

Nutrição usa a saída Cancelar do formulário, sem o link superior redundante. Cadastros específicos de Pecuária mostram o próprio título, sem repetir o cabeçalho geral e o caminho do cadastro.

Estoque usa o sítio da sidebar em saldos, entradas e histórico. O seletor paralelo foi removido; propriedadeId na URL é conservado somente para localizar um movimento histórico específico no consolidado. Com sítio selecionado, ele prevalece. Links Ver estorno/Ver movimento original ficam em Ações, separados dos rótulos de tipo e situação. As quatro ações do topo compartilham uma linha quando há espaço.

[Capturas desta rodada](../../output/qa/feedbacks-tabelas-2026-10-11/index.html). Não houve alteração de API, schema, migrations, permissões ou cálculos financeiros.
