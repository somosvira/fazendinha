# Visão geral financeira em grid

A visão geral responde quanto está disponível e quais compromissos exigem ação. O desenho compacto foi aprovado em 08/out/2026.

- Cinco indicadores: saldo disponível atual, recebimentos e pagamentos realizados, saldo a pagar e a receber por vencimento no período. Os últimos dois também mostram o saldo pendente vencido e a quantidade; incluem todos os pendentes/parciais retornados, não apenas as cinco linhas visíveis.
- Compromissos: abas de vencidos e próximos sete dias (hoje até hoje + 7, sempre dentro do período selecionado), cinco linhas por aba e acesso à lista completa preservando o período. O calendário abre em Dialog e conserva consulta de detalhes e liquidação conforme permissão.
- Contas: as incluídas no saldo geral vêm primeiro; as excluídas podem ser expandidas. Saldo disponível é uma fotografia atual, independente do filtro de período.
- Resultado de caixa: usa `realizado.resultado` calculado no servidor, líquido de estornos. Inclui aportes e retiradas, não equivale a lucro.
- Gráfico: Linhas mostra o acumulado, Barras mostra os valores de cada dia/mês. O subtítulo acompanha a escolha. As séries também se distinguem pelo traçado.
- Despesas por categoria: mantém filtro múltiplo, rosca, total líquido, legenda e tratamento de estornos negativos, em tamanho compacto.
- Rastreabilidade: recolhida por padrão, mantém indicadores, histórico e links com período. O gráfico de volume por tipo foi removido da visão geral; os valores permanecem disponíveis no contrato e na conferência detalhada.

## Componentes e responsividade

A página usa as primitivas locais shadcn (Card, Table, Badge, Tabs, Collapsible, ToggleGroup, Dialog, Button, Input e Select). Popover/Command continuam compondo o filtro de categorias e o seletor de período. O tema Terrano é preservado; não se cria outro sistema visual. A biblioteca Radix unificada atende às novas primitivas; componentes existentes continuam compatíveis com seus pacotes individuais.

O grid divide painéis a partir de 1280px; abaixo disso, empilha. As tabelas e o calendário têm rolagem horizontal contida, sem expandir a página. A rosca compacta usa o tamanho do painel para alternar entre legenda lateral e empilhada. Diminuímos espaços e altura dos gráficos, preservando valores e ações legíveis.

Não há alteração de schema, persistência, cálculos contábeis, auditoria ou autorização. Loading, erro, retry e descarte confirmado de rascunho continuam existentes. As imagens aprovadas usam dados ilustrativos; a implementação só apresenta dados da API.

## Ajustes de calendário e nota fiscal

O calendário do dashboard usa células compactas e modal centralizado limitado à altura da janela, com cabeçalho visível e rolagem interna. O calendário da listagem mantém a densidade anterior.

Registrar pagamento aceita uma nota fiscal opcional por arrastar/soltar ou seleção de arquivo (PDF, XML, JPG, PNG ou WEBP, não vazio e até 10 MB). O envio ocorre ao confirmar, pela API existente, nos documentos da operação vinculada ao compromisso. Se falhar, a liquidação não é solicitada. Se a nota for salva e a liquidação falhar, o modal informa que o documento permanece na operação e uma nova tentativa no mesmo modal não repete o upload. Cancelar antes de confirmar não envia o arquivo. O registro de recebimento mantém seu fluxo atual.

## Detalhamento por clique

Recebimentos e Pagamentos abrem Dialog shadcn com os movimentos mais recentes do período, incluindo estornos identificados e excluindo transferências. A pagar e A receber abrem listas de compromissos pendentes, ordenadas por vencimento, no mesmo período. As listas têm paginação de 15, carregamento com Skeleton e Loader, erro com nova tentativa e estado vazio. O clique no indicador não muda de página; movimentos com operação vinculada preservam o acesso à origem, e compromissos abrem seu detalhe em diálogo.

A legenda e as fatias de despesas abrem um Dialog com lançamentos, total líquido e paginação de 15 itens. “Outras” mostra apenas as categorias que compõem o grupo; estornos negativos também abrem detalhes. Categoria é identificada por ID e nome histórico, conforme o agrupamento do dashboard, para preservar snapshots após renomeações. Cada lançamento inteiro é um link acessível para a operação ou movimento avulso, com clique modificado/nova aba preservados. O desenho usa Card e Badge shadcn, cores de investimento/custeio e estorno, e cabeçalho visível no modal.

A leitura `GET /financeiro/analise-categorias`, na base `pagamentos`, agora usa os mesmos movimentos e rateio do dashboard, incluindo retiradas, avulsos e estornos e todas as horas do último dia. Bases de compras e pendentes permanecem com seus contratos existentes. Não há nova rota ou gravação.

## Falha ao abrir a origem

A leitura de uma operação exige ID e as coleções essenciais antes de renderizar o detalhe. Uma resposta inválida gera mensagem recuperável e botão “Tentar novamente”, em vez de derrubar a tela. A prévia local anterior só tinha respostas capturadas do dashboard e retornava uma lista vazia para consultas não preparadas; foi substituída por consultas reais de leitura com todas as gravações bloqueadas. Isso é configuração local de revisão, sem mudança no deploy.

## Detalhe compacto da operação

O detalhe usa resumo com valor, categoria e contagens no topo, seguido por grid de duas colunas para compromissos, histórico, documentos e procedimentos. Itens/perdas/transferências só ocupam um painel quando existem; todos os registros continuam visíveis, sem truncar descrições ou ocultar dados em abas. Transações aparecem uma única vez no histórico, incluindo links das movimentações e ação de estorno. As contagens do resumo apresentam todos os registros vinculados; a confirmação de cancelamento continua usando somente os efeitos elegíveis.

O objetivo é reduzir rolagem pela organização e remoção de duplicações. Listas extensas e telas menores continuam permitindo rolagem para preservar legibilidade e todos os dados. No carregamento, Skeleton shadcn acompanha o grid e a composição de categorias, com anúncio acessível e respeito à preferência por movimento reduzido. Erro e nova tentativa permanecem disponíveis.

## Hierarquia por cor

Dashboard, compromissos/calendário, contas/extratos, detalhe da operação e seus diálogos usam cards claros sobre o fundo quente. A camada `cores-financeiro.css` centraliza entrada (verde), saída (terracota), pendência (âmbar), informação/anexos (azul) e alerta (vermelho), reaproveitando tokens Terrano. Valores e status mantêm rótulos e datas; o gráfico conserva os traçados distintos. A camada é opt-in nas páginas revisadas, sem aplicar novos estilos aos demais módulos. O grid, a densidade e os contratos de dados permanecem os mesmos.

## Correções da auditoria das demais telas

Operações, cadastros e relatórios seguem o mesmo padrão de densidade e cores. Use sempre as primitivas shadcn locais, inclusive para controles simples; `SelectCampo` compõe Select com as opções já usadas pelos formulários e callbacks de valor, sem simular eventos de DOM.

- Os cinco cadastros têm busca, situação e paginação de 15 itens. Parceiros aceitam nome, documento com ou sem máscara, e-mail e telefone, além de filtro por papel. Produtos preservam filtros de fornecedor, centro, uso e situação; vínculos completos ficam disponíveis na ficha.
- A busca de operações aceita número, código exibido e variações de separadores/caixa, sem depender de descrição ou UUID. Os demais filtros continuam combinados. A ação de procedimentos fica em DropdownMenu por serviço elegível; as linhas mantêm clique e abertura por teclado.
- Tabelas compactas usam Table shadcn, cabeçalho visível e rolagem contida no desktop. A paginação dos cadastros fica acima dos dados. No celular, todos os dados da linha continuam disponíveis em cartões com pares organizados em grid e rolagem contida. Canceladas/inativas usam status explícito, sem reduzir a opacidade do texto inteiro.
- Contas, parceiros e produtos usam Sheet de até 768 px com campos em grid e ações persistentes. Categoria e centro de custo usam Dialog de altura natural. Fechar um cadastro alterado por Escape, clique fora ou botão de fechar pede descarte; cancelar no rodapé continua sendo descarte explícito. Durante salvamento, o fechamento fica bloqueado.
- Nova operação compacta os espaçamentos, mantém campos roláveis e confirmação acessível. A revisão dos efeitos pode ser expandida no celular; no desktop fica aberta. Novo relatório reserva o espaço do menu, reúne filtros opcionais em Collapsible e mantém a geração junto de uma revisão compacta. O histórico ganha busca por nome/autor e paginação; o detalhe preserva o snapshot salvo e abre a prévia gerencial sob demanda.
- Carregamento de página e atualização de operações usam Skeleton shadcn com anúncio acessível. Tabs shadcn garante navegação por setas e associação ao painel; os destinos ficam visíveis em grid também no celular.

Nenhuma alteração de cálculo, payload financeiro, backend, permissão ou persistência. As verificações de escrita usam mocks de API; a revisão visual usa prévia local com gravações bloqueadas.

O carregamento combina Skeleton shadcn com o Loader temático existente. Placeholders financeiros usam contraste próprio sobre cards claros; o indicador e sua mensagem permanecem visíveis. Há um único anúncio acessível por área, e as animações respeitam movimento reduzido.

As páginas financeiras mostram título, descrição e ações no topo, sem o rótulo “Financeiro” acima do título. Nomes, períodos e autoria de relatórios permanecem no cabeçalho, sem duplicação no conteúdo do snapshot. Cabeçalhos de outros módulos não mudam. As abas de configurações usam superfície branca e seleção azul com texto branco. O carregamento inicial ocupa a altura útil da janela, mantendo o menu disponível; atualizações parciais usam a versão compacta.


## Contas e extratos compactos e paginados

A listagem de contas, o extrato geral e o extrato de cada conta usam paginação shadcn de 15 registros após os filtros. Alterar filtros ou período retorna à primeira página; abrir um movimento seleciona a página que o contém e preserva o foco na origem. Os gráficos e totais continuam calculados sobre todos os movimentos do período, independentemente da página visível.

Saldo, filtros, tabelas e gráfico têm espaçamentos menores. No desktop amplo, gráfico consolidado e extrato geral ficam lado a lado; no celular, os dados usam os cartões responsivos existentes. A última movimentação da listagem de contas mostra um resumo de duas linhas, com texto completo no título e no extrato da conta. Valores por dia/mês ficam em Collapsible. Transferência usa Dialog, Input e Select shadcn, com rodapé empilhado no celular. Não há mudança em cálculos, payloads ou persistência.


## Organização final de Contas e extratos

Este ajuste substitui o grid lateral de gráfico e extrato descrito acima. O saldo geral fica junto das ações do cabeçalho; o título redundante da seção de contas fica apenas acessível. Os filtros da conta usam duas colunas no celular. O nome da conta é o link explícito, e a linha inteira continua acionável, sem coluna “Ver conta”.

O gráfico consolidado começa recolhido em Collapsible shadcn (“Mostrar receitas e despesas”), preservando alternância Linhas/Barras e todos os movimentos do período. O extrato geral ocupa a largura disponível e apresenta data, movimentação, conta e valor com direção e sinal. Instituição e link de operação ficam junto da descrição; a ficha da conta preserva seus dados completos. Os controles de paginação de contas/extratos só aparecem quando existe mais de uma página; a contagem permanece visível. No celular, a área clicável dos cartões e os links são elementos irmãos, evitando links dentro de botões.

Nenhuma alteração financeira de cálculo, filtros, payload ou persistência. A reauditoria das demais telas, com prioridades e limites, está em `design-qa.md`.


## Fechamento dos achados da reauditoria

A revisão seguinte aplica os critérios de densidade, utilidade e componentes shadcn a todas as áreas financeiras auditadas:

- **Compromissos:** busca por descrição, parceiro e código da operação; paginação de 15 após os filtros; tabela compacta no desktop e cartões com rolagem contida no celular. A linha abre os detalhes; o link da operação e a liquidação continuam independentes. Totais são calculados sobre todo o recorte, antes da paginação. O calendário recebe todos os compromissos filtrados.
- **Visão geral:** indicadores em duas colunas no celular, com saldo disponível em largura completa. Agenda, Análises e Contas usam abas shadcn no celular; o desktop mantém o grid simultâneo. A agenda prioritária móvel usa cartões com descrição, vencimento, valor e ação, sem tabela lateral.
- **Calendário:** mês em grid no desktop e agenda mensal ordenada por vencimento no celular. Todos os eventos do mês continuam disponíveis; detalhes e liquidação respeitam a permissão existente.
- **Configurações:** filtros de Produtos ficam em Collapsible, aberto no desktop e recolhido no celular, com contagem dos filtros ativos e limpeza explícita. Busca continua visível. Paginações de uma única página mostram a contagem sem controles redundantes.
- **Relatórios:** recorte da emissão expansível, aberto no desktop e recolhido no celular; quatro indicadores em duas colunas móveis. Itens salvos paginados em 15, preservando totais, PDF e o aviso de truncamento do snapshot quando aplicável.
- **Diálogos e detalhe:** controles restantes do financeiro usam Button, Checkbox, ToggleGroup, Textarea e Dialog locais shadcn. Pagamento mantém ações no rodapé e corpo rolável; nota fiscal continua usando o contrato anterior. O retorno de foco acompanha a cadeia de diálogos: fechar o detalhe ou cancelar o pagamento devolve o foco ao acionador conectado, inclusive após desmontar o calendário.

As listas compactas limitam a altura interna para reduzir rolagem da página. Paginação e áreas roláveis preservam todos os registros; não se reduzem fontes até tornar os valores ilegíveis nem se promete exibir um histórico ilimitado em uma única janela. Nenhuma alteração no backend, cálculo, payload ou política de permissão. A reauditoria e suas limitações estão registradas em `design-qa.md`.

O grid simultâneo da visão geral se aplica a partir de 1024px; em larguras menores os painéis se adaptam, e abaixo de 768px são organizados nas três abas. Valores monetários não são truncados.


## Seções de Contas e extrato geral

A sidebar mantém “Contas e extratos”. O conteúdo inicia com o título “Contas”, sua descrição e a listagem. A seção “Extrato geral” vem abaixo, com sua explicação, período, gráfico expansível e tabela de movimentações. O título do extrato antecede seus controles; o destino `#extrato-geral` permanece na seção completa. O detalhe de cada conta mantém o nome próprio no cabeçalho.

## Tema financeiro sóbrio

Esta direção substitui a aplicação anterior de cores decorativas nas telas revisadas do PR. Cards, títulos, ícones, cabeçalhos, anexos e filtros ficam neutros; a seleção das abas usa grafite sobre branco. Verde e vermelho permanecem nos valores financeiros e estados correspondentes; âmbar indica pendência/atenção. Classificações e documentos não recebem cores decorativas. Gráficos preservam as séries semânticas e a diferenciação discreta das categorias. O ajuste abrange dashboard, operações/detalhes/formulários, compromissos/calendário/pagamento, contas/extratos, cadastros e relatórios por meio das primitivas shadcn e da camada compartilhada de estilo.

## Correção da paleta aprovada — 09/10/2026

A preferência esclarecida substitui a neutralização excessiva anterior: manter faixas vermelhas, cards de efeitos, ícones/cabeçalhos suaves e os detalhes em marrom/verde/vermelho. Remover o azul; informação, classificação e pendência usam marrom suave. Abas selecionadas e ações primárias permanecem preto/grafite. Os três efeitos do resumo da operação usam Card shadcn compacto, preservando os contadores e a organização em grid.

Os títulos “Contas” e “Extrato geral” usam a mesma escala tipográfica responsiva (`h1` visual), com descrições no mesmo tamanho. A hierarquia semântica permanece h1 na página e h2 na seção do extrato.

## Nova direção da página inicial e sidebar — 09/10/2026

O mockup aprovado limita esta etapa à visão geral e à navegação global. Desktop organiza recebimentos/pagamentos e categorias no primeiro grid, compromissos e disponibilidade no segundo. O saldo disponível recebe destaque verde (vermelho quando negativo); os demais indicadores são neutros. Painéis brancos substituem faixas e cabeçalhos coloridos nessa página. A lista de disponibilidade mostra o total das contas incluídas e o acesso ao módulo de contas. Linhas/Barras, filtros, detalhamento por categoria, calendário, links dos indicadores e abas móveis permanecem funcionais. A sidebar clara usa Button shadcn e preserva todos os destinos, controles de acesso, rascunhos, seletor de sítio e comportamento móvel. Não há mudanças em APIs, cálculos do dashboard ou nas outras páginas financeiras.

## Calendário independente e ordem final dos painéis — 09/10/2026

A organização desktop aprovada é: primeira linha com recebimentos/pagamentos, contas/disponibilidade e compromissos; segunda linha com calendário e despesas por categoria. O calendário ganha Card próprio, mês sempre visível, contadores de pagamentos/recebimentos por dia e expansão em Dialog para o calendário completo. Selecionar um dia abre todos os compromissos daquele dia; selecionar um compromisso mantém o detalhe e a liquidação existentes. Os contadores e o calendário usam todos os pendentes do recorte, sem limitar aos cinco itens da lista. No celular, o mês compacto aparece na aba Agenda, antes da lista prioritária.

Quando não há vencimentos nos próximos sete dias, a agenda informa o próximo vencimento futuro existente no período, explicitamente separado do grupo de sete dias. Não amplia o filtro, os contadores ou os totais. O resultado de caixa da API passa ao cabeçalho do gráfico e a rosca aproveita melhor o painel com legenda lateral. Calendários das demais páginas mantêm seu comportamento.

## Indicadores integrados ao contexto — 09/10/2026

A faixa de cinco indicadores acima do grid foi removida. Recebimentos e pagamentos ficam no painel do gráfico; saldo disponível e quantidade de contas incluídas antecedem a lista de contas; a pagar e a receber ficam no painel de compromissos, junto da agenda prioritária. O saldo não se repete no rodapé. A ordem dos dois grids, o calendário independente, filtros, totais e permissões permanecem os mesmos. Na versão móvel, os valores acompanham seus respectivos painéis nas abas.

## Grid integrado aprovado — 09/10/2026

Esta organização substitui a divisão anterior de três painéis na primeira linha: recebimentos/pagamentos ocupam 75% e contas/disponibilidade 25%. Na segunda, compromissos e calendário aberto por padrão compartilham um único Card shadcn com 80% da largura; despesas por categoria ficam nos 20% restantes, com rosca e legenda empilhadas. Dentro do painel maior, os próximos compromissos aparecem primeiro, ao lado do mês. No celular, a agenda integrada empilha a lista antes do calendário. Expansão, detalhes, liquidação e modais dos valores permanecem disponíveis.

- Ajuste aprovado nos comentários de 09/10: categorias abaixo da agenda, em largura completa; remover rastreabilidade da visão geral. Calendário aberto com descrição, direção e valor dos compromissos nos dias (agenda textual no celular). Painel de compromissos ocupa toda a segunda linha, com calendário maior; contas acompanha a altura do gráfico na primeira linha. Componentes e contratos de auditoria fora da visão geral permanecem disponíveis.

- Categorias na visão geral: substituir rosca por “Onde estamos gastando”, ranking compacto das cinco maiores despesas positivas, com barra discreta, valor e participação. Total líquido inclui estornos. Uma categoria resulta em uma linha; “Ver todas” abre lista completa e filtro no Dialog shadcn. Clique na categoria mantém detalhamento de lançamentos do período. As participações usam o total positivo completo, inclusive categorias fora das cinco exibidas; estornos ficam identificados no modal, sem barras/percentuais negativos.

- Refinamento aprovado: manter o título “Despesas por categoria”, seguido do total líquido, e pizza compacta à esquerda do ranking no desktop. No celular, pizza e ranking se empilham. Pizza usa as mesmas cinco categorias do ranking e agrupa as restantes em “Outras categorias”; total e participações consideram todo o período. Filtro/lista completa continuam no modal.
