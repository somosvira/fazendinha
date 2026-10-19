# Cooperativa contemporânea — design unificado

Consolidação de 11/10/2026 na branch `codex/redesign-unificado-cooperativa`.

## Base de integração

Financeiro e Pecuária compartilhavam a base Git `f0907ce`; os redesigns estavam presentes como alterações locais no mesmo diretório. A branch unificada conserva ambos e inclui o redesign do Estoque. Nenhuma branch anterior foi apagada.

Direção visual: [Financeiro](financeiro-cooperativa/design.md) e [Pecuária](pecuaria-cooperativa/design.md). A paleta permanece em `client/src/styles/cooperativa-theme.css`; composição compartilhada em `financeiro-theme.css`. Estoque usa `estoque-theme.css` apenas para a composição específica de seus blocos.

## Identidade compartilhada

- Canvas quase neutro com gradiente suave entre branco frio e sálvia, lateral sálvia mais definida, painéis brancos e ação principal verde floresta. O gradiente estático pertence ao fundo compartilhado da aplicação; tabelas, campos e cards permanecem opacos para leitura consistente. Superfícies secundárias e divisórias são cinzas discretos. Cabeçalhos de diálogos e rodapés de receitas usam branco; cores de estado conservam sua função, com vermelho reservado a erros e ações destrutivas como anulação.
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

Nas consultas tabulares, busca e critérios frequentes ficam agrupados à esquerda, com ação principal e resumo útil à direita. O título da página ou da aba não é repetido em outra faixa acima da mesma tabela. Títulos de seções com conjuntos distintos na mesma página permanecem para identificar o contexto. Tabela e paginação ficam junto às bordas do mesmo painel, sem uma segunda margem interna. A borda superior da tabela separa suas colunas dos controles. Operações, Compromissos, Contas/Extrato geral e as listagens sanitárias reutilizam essa composição. Botões respeitam as variantes default, outline e destructive das primitivas locais.

Em Compromissos, período de vencimento, busca, seleção múltipla e vencidos filtram a lista e o calendário; os três cards continuam mostrando o conjunto completo do sítio. A pagar/A receber incluem pendentes e parciais; Liquidados inclui títulos liquidados. Seleção vazia mostra todos, inclusive cancelados. As opções selecionadas são combinadas por OU. A consulta carrega o conjunto uma vez e o período é aplicado na listagem, preservando os parâmetros de rastreabilidade.

Em Contas, filtros do Extrato geral ficam dentro dele e não alteram a tabela de contas nem o fluxo consolidado do ano atual. Esta decisão substitui o gráfico dependente dos filtros do extrato descrito anteriormente. O detalhe individual da conta conserva seu período compartilhado entre gráfico e extrato.

Sanidade mantém os filtros dentro de cada listagem. Tarefas e Carências usam TabelaFinanceira; carências desconhecidas, não aplicáveis, prazo zero, expiração e revisão de finalidade continuam explícitos. Ações secundárias das tarefas ficam em menu, preservando sítio histórico, motivos e confirmação. Os controles permanecem montados durante a consulta para manter a digitação e o foco.

Nutrição usa a saída Cancelar do formulário, sem o link superior redundante. Cadastros específicos de Pecuária mostram o próprio título, sem repetir o cabeçalho geral e o caminho do cadastro.

Estoque usa o sítio da sidebar em saldos, entradas e histórico. O seletor paralelo foi removido; propriedadeId na URL é conservado somente para localizar um movimento histórico específico no consolidado. Com sítio selecionado, ele prevalece. Links Ver estorno/Ver movimento original ficam em Ações, separados dos rótulos de tipo e situação. As quatro ações do topo compartilham uma linha quando há espaço.

[Capturas desta rodada](../../output/qa/feedbacks-tabelas-2026-10-11/index.html). Não houve alteração de API, schema, migrations, permissões ou cálculos financeiros.

## Componentes compartilhados

PageHeader mantém identidade (título e descrição) e comandos (contexto, extras e ações) na mesma base, inclusive em fichas e formulários. Usa slots para não duplicar composições entre módulos; comandos podem ocupar a largura necessária no desktop e quebram em telas pequenas.

BarraConsulta reúne controles frequentes, resumo e ações da consulta, com intervalos de 8px dentro de um grupo e 24px entre consulta e ações. Situações de seleção única usam botões; listas extensas mantêm estados secundários em menu, sem opções duplicadas. Critérios adicionais ficam no painel lateral e são identificados por controles removíveis na tabela. Os campos do painel editam um rascunho; Aplicar filtros confirma o conjunto em uma única atualização. Limpar filtros altera apenas o rascunho, e cancelar, fechar, Escape ou clicar fora descartam as mudanças não aplicadas. Abrir novamente restaura os critérios efetivamente aplicados. Busca, situações rápidas e remoção de critérios na barra permanecem diretas. O painel tem até 576px no desktop e largura disponível no celular, sem padding duplicado nem placeholders cortados. Controles têm pelo menos 40px no desktop e 44px no celular; em telas estreitas as ações precedem os filtros. Relatórios que exigem aplicar uma consulta ou preservar uma emissão continuam com essa confirmação explícita.

CabecalhoTabela identifica seções com contexto próprio, sem repetir o nome da aba. A paginação conserva a contagem quando há registros, oferece navegação quando há mais de uma página e não cria rodapé para resultado vazio. Tabelas contextuais compartilham hierarquia e preenchimento em tela; documentos e impressão conservam sua composição. TabelaFinanceira inclui separação superior e alinhamento de valores; CardFicha oferece a variante `tabela` sem preenchimento externo duplicado. A primeira carga financeira usa skeletons das primitivas locais; atualizações preservam os dados anteriores com indicação de progresso e bloqueio da interação até a resposta.

Os guias por módulo substituem as referências estéticas antigas de DESIGN.md e COMPONENTS.md retiradas na limpeza de documentação da main. Contratos de domínio permanecem nos documentos atuais de Financeiro e Pecuária.


## Organização para análise e gestão

A identidade Cooperativa é preservada. As abas compartilhadas têm contorno discreto e cantos superiores de 8px: a selecionada usa branco e se conecta à superfície de conteúdo; as inativas usam fundo neutro. Mantêm largura natural, intervalo de 4px e quebra de linha quando necessário, sem rolagem horizontal ou distribuição em larguras iguais. O estilo vive em `client/src/styles/abas.css`, com a variante `pasta` de TabsList e a mesma classe nas navegações nativas das fichas e indicadores. Ciclos/Tarefas usa a aparência explícita de botões, separada das abas e dos filtros. Os painéis mantêm borda e dispensam sombra. A lateral conserva marca, seletor, trabalhos ativos, permissões e colapso, com fundo uniforme para leitura do menu.

As páginas de consulta apresentam título e uma descrição curta que explica o que pode ser acompanhado ou realizado. Comandos gerais ficam à direita do cabeçalho; as abas aparecem logo abaixo. Abas usam texto de 16px, ícones de 20px quando existentes e altura mínima de 48px. Fichas conservam a identidade do registro e formulários conservam o nome da tarefa. A navegação de Reprodução permanece antes do conteúdo também em Indicadores. Ciclos/Tarefas mantém o tratamento de botões de seleção.

No panorama do Rebanho, a ordem é total ativo, distribuição proporcional e categorias consultáveis. O contexto de fêmeas e receptoras explicita os denominadores. Baixas apresentam linhas proporcionais consultáveis por tipo e motivos diretamente visíveis, sem repetir os mesmos dados em gráfico cartesiano. As abas dão acesso a Animais e Lotes, sem repetição de botões logo abaixo.


### Orientação durante a navegação

Ao entrar numa área, a lateral abre o grupo correspondente e recolhe os outros grupos de domínio. Dentro da mesma rota, o usuário ainda pode abrir ou recolher qualquer grupo manualmente. Trabalhos ativos só reservam uma seção quando há rascunho ou relatório real para retomar; um atalho de nova operação sem rascunho não representa trabalho em andamento. A lista de Animais abre na consulta, sem indicadores e composição repetidos do panorama. Seções principais das fichas são diretas; somente detalhes auxiliares usam expansão. A ficha de lote divide os fluxos por abas, mantendo os fragmentos anteriores.

No panorama do Rebanho, composição/baixas e sítios/atividade formam duas colunas consistentes, empilhadas em telas estreitas. Baixas reúne linhas proporcionais e motivos visíveis, sem gráfico cartesiano repetido nem acordeão. A visão geral financeira foi aprovada como referência visual pelo usuário e não faz parte desta revisão do panorama.

A ficha animal organiza Resumo, Cadastro, Histórico, Reprodução, Sanidade e Nutrição com abas de largura natural. Identificação e genética pertencem ao Cadastro; a regra de categoria fica junto à identificação, sem um cartão isolado para uma frase. Baixas e auditoria pertencem ao Histórico. Indicadores sobre as mesmas duas pesagens compartilham um valor, com suas definições preservadas; bases diferentes permanecem distintas mesmo quando o resultado numérico coincide.

Sanidade agrupa carências, protocolos, aplicações e acompanhamento em superfícies brancas. Aplicação, ocorrência, coleta e início de protocolo ficam diretamente disponíveis aos perfis autorizados. Nutrição concentra receitas, versões, dieta e consumo em seus fluxos próprios; a aba do lote oferece as ações cotidianas sem exigir uma visita intermediária à página completa. Tabelas mantêm os valores exatos, dispensando gráficos ou resumos que apenas os repetiam. Períodos de consumo individual formam superfícies brancas coesas. A revisão não autoriza alterações de dados operacionais ou dos contratos de escrita.
