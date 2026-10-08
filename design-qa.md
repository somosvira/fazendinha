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

## Cores semânticas nas páginas revisadas

Cards claros sobre o fundo quente, com tokens centrais de entrada (verde), saída (terracota), pendência (âmbar), informação/anexo (azul) e alerta (vermelho). Aplicado ao dashboard, compromissos/calendário, contas/extratos, detalhe da operação, categoria, liquidação e upload. A camada é opt-in para preservar módulos fora do PR. Nenhum dado, ação ou espaço do grid foi removido para acomodar cor.

Inspecionados dashboard e contas/extratos sem overflow horizontal em 1440, 1180, 720 e 390/391px. Diálogo de pagamento com nota fiscal verificado em 391px: área útil de 357px, scrollWidth=clientWidth. Detalhe da operação conserva todos os blocos na primeira tela do exemplo. Review identificou saldo disponível negativo em verde; corrigido para tom de alerta. Acessibilidade mantém rótulos, status, datas e traçados das séries; texto âmbar usa marrom escuro sobre fundo suave.

Validação final: 123 arquivos / 950 testes frontend aprovados e build frontend aprovado. O teste do gráfico foi atualizado para a cor de saída, mantendo suas verificações de valores exatos e alternativa acessível. Capturas locais: `dashboard-colors.png`, `operation-colors.png`, `compromissos-colors.png`, `contas-colors.png`, `payment-colors.png`.


## Auditoria das demais telas financeiras

Corrigidos os cadastros (busca, filtros e paginação de 15), busca por código de operação, formulários em grid com ações persistentes, modais compactos para categoria/centro e organização dos relatórios. Input, Textarea, Select, Checkbox, RadioGroup, Button, Table, Tabs, Sheet, Dialog e Collapsible usam as primitivas shadcn locais. As abas móveis não sobrepõem o conteúdo; mudanças exclusivas nos vínculos do produto também pedem confirmação antes de descarte.

Suíte completa: 123 arquivos / 955 testes aprovados. Checagem TypeScript e build frontend aprovados; permanece o aviso pré-existente de bundle acima de 500 kB. Testes focados foram repetidos após os ajustes visuais finais. A revisão independente de código foi encerrada sem achados importantes pendentes.

Inspeção visual em 1440, 1180, 720 e 391px, sem overflow horizontal das páginas inspecionadas. A nova operação conserva a altura da janela e mantém confirmação visível; campos e revisão dos efeitos rolam internamente. Em desktop, parceiros passou de cerca de 22717px para 903px, com todos os registros acessíveis por paginação e rolagem da tabela. A listagem de relatórios cabe em 900px; a prévia gerencial do detalhe é aberta sob demanda. No celular, listas e formulários preservam rolagem para não comprimir textos e controles.

Evidências locais em `/Users/toledo/.codex/visualizations/2026/10/08/financeiro-correcoes/`. A prévia encaminha somente leituras e bloqueia gravações: autosave, geração, upload e liquidação foram exercitados com mocks nos testes, sem escrita na produção.


## Contraste do carregamento

Skeleton financeiro com contraste reforçado sobre superfície branca, combinado com Loader temático e mensagem visível. Inspeção com leituras temporariamente retidas confirmou ambos em 1440 × 900 sem overflow; instrumentação removida ao concluir. Um único status acessível por área. Verificação: 47 testes focados e build frontend aprovados. Evidência local: `financeiro-correcoes/16-loading-contraste.png`.


## Cabeçalhos compactos, abas e carregamento de página

Removida a apresentação visual repetida das páginas financeiras; ações permanecem no topo e títulos continuam acessíveis sem consumir altura. Nome, período e autoria dos relatórios ficam no conteúdo do snapshot. Cabeçalhos de outros módulos preservam sua apresentação. Configurações usam abas shadcn sobre superfície branca com seleção azul e texto branco.

O carregamento inicial combina Loader e Skeleton shadcn preenchendo a área útil da janela; atualizações parciais mantêm a versão compacta. Capturas `17-abas-sem-cabecalho.png`, `18-loading-pagina-inteira.png`, `19-loading-mobile-inteiro.png`, `20-abas-mobile.png` e `21-contas-sem-cabecalho.png` inspecionadas. Loading medido em 1440 × 900 e 391 × 844 sem overflow da página. Gravações permanecem bloqueadas na prévia.

Validação final: 123 arquivos / 955 testes aprovados (`vitest run --maxWorkers=2 --minWorkers=1`) e build frontend aprovado.
