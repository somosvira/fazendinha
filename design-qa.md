# QA — dashboard financeiro compacto

final result: passed

Referência: mockup aprovado nesta conversa em 08/out/2026. Comparação visual com captura local em desktop (1440 × 1024), além de verificações responsivas em 390, 720 e 1180px. Evidências locais em `/tmp/fazendinha-dashboard-qa/`: `desktop.png`, `calendar.png`, `mobile.png`, `mobile-calendar.png` e capturas de tablet.

## Resultado

- Cinco indicadores compactos, compromissos e contas lado a lado, gráficos na segunda linha e rastreabilidade recolhida.
- Categorias mantêm rosca, legenda, filtro e estornos; Linhas/Barras preserva acumulado versus movimento do intervalo.
- Calendário abre em Dialog, com título e descrição acessíveis, fechamento por Escape e consulta de detalhes. Liquidação mantém permissões e validações existentes.
- Corrigidos durante a revisão: quebra de valores dos indicadores, descrições longas ampliando linhas, botões de eventos com conteúdo horizontal e expansão indevida do modal no celular.
- Nenhum erro de execução capturado no navegador. Sem overflow horizontal da página. Tabelas/calendário usam rolagem horizontal contida e indicação no celular.

## Diferenças deliberadas da imagem

A imagem usa dados ilustrativos; a tela usa os dados reais retornados pela API, incluindo 47 vencidos e descrições maiores. Rótulos e valores completos permanecem acessíveis. O tema Terrano e os componentes existentes do aplicativo foram preservados. O link ilustrativo de pagamentos por categoria não ganhou uma rota artificial: o filtro funcional continua no próprio painel.

Com o mesmo viewport desktop, a página tem aproximadamente 1164px de altura, contra 3843px da versão anterior capturada em largura semelhante (1512px). Redução aproximada de 70%; não se exige que toda a página caiba em uma única tela para preservar legibilidade.

## Verificação técnica e limites

`pnpm --filter rionovo-client test`: 123 arquivos, 949 testes aprovados (base atualizada com `origin/main`). `pnpm --filter rionovo-client build`: aprovado; permanece o aviso de bundle acima de 500kB, já existente.

A verificação visual local utilizou um snapshot de respostas de leitura, com gravações bloqueadas. Não foram efetuadas liquidações na produção. Os testes automatizados exercitam validação, seleção de conta, permissões, filtros, período, modal e dados obsoletos de requisições anteriores. Não houve alteração de API ou persistência.

## Revisão após ajustes solicitados

Calendário centralizado e limitado à janela, com cabeçalho fixo e células menores. Em desktop 1440 × 900, centro vertical medido com desvio de 0px. Registro de pagamento com nota selecionada verificado em desktop e celular (390 × 844). Rodapé do pagamento empilha botões no celular para conter o conteúdo. Capturas locais adicionais: `calendar-centered.png`, `payment-invoice.png` e `payment-invoice-mobile.png`. Os três novos testes cobrem drop, validação, remoção, envio anterior à liquidação, erro e nova tentativa sem repetir nota salva. Upload em produção não efetuado.

## Detalhamento e navegação dos indicadores

Categorias, fatias e estornos abrem composição dos valores. “Outras” filtra por ID e nome histórico, preservando renomeações. Cards coloridos shadcn mostram data, descrição, categoria, classificação, centro e valor; todo o item é um link para a origem, sem “Ver operação”. Paginação de 15 mantém o total completo. O modal foi inspecionado em desktop e 390 × 844, sem overflow horizontal (clientWidth e scrollWidth de 356px no celular). Capturas locais: `category-detail-color.png` e `category-detail-color-mobile.png`.

Recebimentos/Pagamentos levam ao extrato com a natureza e o período; A pagar/A receber levam à aba correta de compromissos. Testes verificam URLs, estornos, transferências excluídas, clique no card, categorias renomeadas, grupo Outras, erro/retry e paginação. Frontend: 946 testes aprovados; backend: 11 testes focados de análise, classificação e série do dashboard; builds frontend e backend aprovados. Prisma Client foi regenerado para refletir o schema existente, sem migration ou gravação no banco.

A captura visual dos detalhes usa respostas de leitura da API atual. O novo cálculo de reconciliação no servidor foi validado por testes locais e ainda depende da publicação do PR; nenhuma escrita em produção foi efetuada.

## Correção da navegação na prévia

Reproduzida tela em branco ao clicar no card: a URL era correta, mas o adaptador local de snapshots retornava HTTP 200 com `[]` para o detalhe não capturado. A prévia agora encaminha leituras reais à API e bloqueia POST/PUT/PATCH/DELETE. Validado no navegador o percurso categoria → card → detalhe completo da operação, com histórico financeiro e documentos. Captura local: `operation-click-fixed.png`.

A API cliente agora rejeita estruturas inválidas no detalhe, com mensagem e nova tentativa. Testes de regressão cobrem a resposta vazia, operação válida e recuperação do erro. Nenhuma liquidação, upload ou outra escrita foi feita na produção.

Após a correção, a suite completa passou: 123 arquivos, 949 testes; build do frontend aprovado.

## Detalhe da operação e skeleton

Reorganizado o detalhe em resumo compacto e grid de compromissos/histórico/documentos/procedimentos. Removida a repetição das transações, preservando movimentos de conta e estorno. A operação OP-2482 foi inspecionada com leitura real: em 1440 × 900, o último painel termina em aproximadamente 664px, sem rolagem da página. Também verificado sem overflow horizontal em 1180px e 720px. Listas maiores continuam integralmente acessíveis por rolagem.

Skeleton shadcn verificado no navegador com leitura temporariamente retida, com `aria-busy=true`; instrumentação removida depois. Teste cobre entrada/saída do carregamento. Review apontou botões de confirmação sem quebra no celular; rodapés corrigidos para empilhar antes de 640px. Regressão adicional verifica que a transação aparece uma vez e a conta abre o movimento correto. Verificação focada: 26 testes aprovados e build frontend aprovado. Capturas locais: `operation-compact-desktop.png`, `operation-compact-mobile.png`, `operation-skeleton.png`.
