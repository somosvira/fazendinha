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

Recebimentos e Pagamentos abrem o extrato geral com o período e a natureza escolhidos. O filtro inclui o original e seu estorno na mesma natureza, exclui transferências e pode ser removido. A pagar e A receber abrem a aba correspondente de compromissos por vencimento, preservando o período.

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
