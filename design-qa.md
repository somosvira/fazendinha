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


## Cabeçalho final com título e descrição

Conforme ajuste solicitado, títulos e descrições voltam às páginas financeiras; somente o rótulo acima do título permanece removido. Relatórios voltam a apresentar nome, período e autoria no cabeçalho, sem duplicação no card do recorte. Abas contrastantes e loading de página inteira preservados. Captura `22-titulo-sem-rotulo.png` inspecionada em 1440 × 900. Verificação focada: 155 testes em seis arquivos aprovados.
Build frontend aprovado após o ajuste.


## Contas e extratos: densidade e paginação

Contas, extrato geral e extrato da conta paginados em 15 registros; filtros reiniciam a paginação. Regressões cobrem busca além da primeira página, navegação por hash para movimento na segunda página e totais do gráfico preservados ao paginar. Suíte completa: 123 arquivos / 959 testes aprovados; TypeScript e build aprovados, com o aviso anterior de bundle acima de 500 kB. Revisão independente sem achados importantes.

Inspeção em 1440 × 900, 1180 × 820 e 391 × 844 sem overflow horizontal da página. Extrato real com 1188 movimentos mostrou 80 páginas; avançar exibiu os registros 16–30. Altura total em desktop: 1800px, mantendo todos os registros acessíveis por paginação e rolagem contida da tabela. Transferência no celular: Dialog com clientWidth=scrollWidth=357px. Prévia somente de leitura; nenhuma transferência registrada. Evidências locais `23-contas-paginadas-desktop.png` a `29-transferencia-mobile.png` em `financeiro-correcoes`.


## Reauditoria financeira após reorganização de Contas — 08/10/2026

Avaliação de UI/UX, com notas subjetivas orientadas à consulta de dados, densidade e ações claras. Capturas novas em 1440 × 900 e 391 × 844, na prévia com gravações bloqueadas. Os seis passos abaixo incluem suas telas auxiliares observadas. Evidências em `/Users/toledo/.codex/visualizations/2026/10/08/financeiro-correcoes/`.

| Passo | Área e saúde | Evidências | Achados e próximos ajustes |
| --- | --- | --- | --- |
| 1 | Visão geral — 8/10 | `33-auditoria-dashboard`, `48-auditoria-calendario-modal`, `49-auditoria-registrar-pagamento` (desktop/mobile) | Hierarquia de valores e cores clara; calendário centralizado e anexo visível. No celular, cinco indicadores empilhados consomem quase toda a primeira tela; calendário requer deslocamento horizontal interno para outros dias. Priorizar indicadores em grid e alternativa de agenda diária. |
| 2 | Operações — 8/10 | `34-auditoria-operacoes`, `43-auditoria-nova-operacao`, `46-auditoria-detalhe-operacao` (desktop/mobile) | Lista compacta com filtros, status e valor; detalhe do exemplo cabe no desktop, mantém documentos e histórico. Nova operação conserva confirmação visível e campos com rolagem interna. A listagem observada tem apenas um registro no período padrão; massas maiores são cobertas pelos testes existentes. |
| 3 | Compromissos — 5/10, prioridade alta | `35-auditoria-compromissos` (desktop/mobile) | 173 itens a pagar renderizados de uma vez; altura observada de 28097px em desktop e 62525px no celular. Ainda não há paginação nem rolagem contida da lista; descrições, valores e ações usam linhas grandes. Paginar após filtros, compactar linhas, preservar totais completos e calendário sem recortar seus eventos. Controles de situação, checkbox e alternância de visualização ainda têm elementos nativos: migrar para as primitivas shadcn. |
| 4 | Contas e extratos — 8,5/10 | `36-auditoria-contas`, `45-extrato-largura-total` | Saldo integrado às ações, gráfico recolhível e extrato com quatro colunas, incluindo valor sem rolagem lateral no desktop. Os 1188 movimentos continuam acessíveis por 80 páginas. Links e cartão móveis independentes; filtros em duas colunas. Não cabe todo o histórico na janela: paginação e rolagem interna preservam legibilidade. |
| 5 | Configurações — 8/10 | `37-auditoria-configuracoes`, `39-auditoria-parceiros` a `42-auditoria-centros` (desktop/mobile) | Cinco abas com seleção azul; parceiros com 345 cadastros em 23 páginas, produtos com 18 em duas, categorias com 52 em quatro. Listas contidas e ações identificadas. Produtos no celular empilha quatro filtros antes da busca e dos dados: reunir filtros adicionais em Collapsible. Controles de página única ainda aparecem aqui. |
| 6 | Relatórios — 8/10 | `38-auditoria-relatorios`, `44-auditoria-novo-relatorio`, `47-auditoria-detalhe-relatorio` (desktop/mobile) | Histórico compacto, geração com revisão e filtros avançados recolhidos. O snapshot observado tem zero itens: é estado vazio, não falha confirmada. No celular, metadados e quatro indicadores empilhados aumentam altura; usar resumo em grid e recorte expansível. Controles de página única permanecem na listagem. |

Ordem recomendada: (1) Compromissos, por volume sem paginação; (2) indicadores móveis do dashboard e de relatórios; (3) filtros móveis de Produtos e calendário em agenda; (4) simplificar controles de página única nas demais listas. Esses são achados da reauditoria, não alterações já implementadas nesta etapa. Nota geral aproximada: 7,5/10.

Não houve overflow horizontal da página nas capturas aceitas; o calendário móvel tem deslocamento lateral próprio e instrução visível. A aparente sobreposição inicial de título/menu não foi reproduzida ao voltar ao topo: h1 inicia em 56px, menu termina em 52px (`50-cabecalho-mobile-topo`). Algumas capturas de abas preservam rolagem por foco; não foram usadas para afirmar defeito no cabeçalho inicial.

Limites: auditoria visual e navegação de leitura, sem certificação WCAG. Abrir calendário, pagamento, abas, operações e relatórios foi verificado; não foram confirmados liquidação, upload, cancelamento, geração ou gravação de cadastros. Autosave da nova operação/novo relatório recebe “Gravação desativada na prévia local”, deliberadamente: não é falha atribuída ao produto. Testes com mocks cobrem essas gravações.

Validação desta implementação: suíte completa com 123 arquivos / 961 testes aprovados; após ajuste visual final, 48 testes focados e TypeScript/build aprovados. Permanece o aviso de bundle acima de 500 kB. Revisão independente identificou aninhamento de links nos botões dos cartões móveis; corrigido e coberto por teste, sem outros achados importantes na revisão do código alterado.


## Fechamento da reauditoria financeira — 08/10/2026

Critérios usados para a meta de qualidade: hierarquia e cores semânticas; leitura compacta; todos os registros alcançáveis; totais independentes da paginação; controles shadcn; navegação por teclado; estados de carregamento, erro e vazio; ausência de overflow horizontal da página. Não se atribui nota 10 automaticamente por implementação: a avaliação abaixo registra o que foi efetivamente conferido.

| Área | Correções e resultado conferido | Evidências |
| --- | --- | --- |
| Visão geral | Indicadores móveis em grid; Agenda/Análises/Contas por abas móveis e grid no desktop; lista prioritária com valores e ação sem arraste lateral; calendário centralizado com agenda mensal móvel. | `52-dashboard-desktop`, `57-dashboard-mobile-compacto`, `58-agenda-modal-mobile`, `69-dashboard-tablet` |
| Operações | Lista paginada, detalhe compacto e documentos preservados; controles e confirmações financeiras restantes migrados para shadcn; estados de loading e erro mantidos. | `53-operacoes` e `64-operacao-detalhe` (desktop/mobile), `65-nova-operacao` (desktop/mobile), `70-operacoes-tablet` |
| Compromissos | 173 pendentes acessíveis em 12 páginas de 15; busca e filtros antes da paginação, totais completos. Avançar mostrou 16–30. Enter na linha → detalhe → pagamento → cancelar restaurou foco na mesma TR. Altura da página: 915px no desktop e 1147px no celular, ante 28097px/62525px na auditoria anterior. | `68-compromissos` (desktop/mobile), `71-compromissos-tablet` |
| Contas e extratos | Saldo integrado ao cabeçalho, quatro colunas no extrato geral, gráfico recolhível, contas/extratos paginados; listas com altura interna menor. | `54-contas` (desktop/mobile), `72-contas-tablet`; testes preservam busca, navegação por hash e totais completos. |
| Configurações | Cinco abas contrastantes; todas as listas paginadas; Produtos com busca antes dos filtros adicionais, contagem e limpeza, filtros recolhidos no celular. | `55-configuracoes`, `60-parceiros`, `61-produtos`, `62-categorias`, `63-centros` (desktop/mobile), `73-configuracoes-tablet` |
| Relatórios | Histórico paginado e filtrável; recorte recolhível e indicadores móveis em grid no detalhe; composição paginada; geração e revisão preservadas. | `56-relatorios`, `66-relatorio-detalhe`, `67-novo-relatorio` (desktop/mobile), `74-relatorios-tablet`; composição com 31 itens coberta por teste. |
| Pagamento | Campos em grid móvel, nota fiscal por seleção/drag and drop, corpo rolável e confirmação fixa visível. O botão foi medido entre y=753 e 789 em viewport de 844px; diálogo com largura interna de 357px sem overflow. | `59-pagamento-mobile-rodape` |

Capturas aceitas usam 1440 × 900, 1180 × 820 e 391 × 844. As seis áreas foram conferidas no tablet e em desktop/celular; as cinco abas de cadastros e telas de operação/relatório foram observadas em desktop/celular. Não houve overflow horizontal da página nos estados capturados. Evidências ficam em `/Users/toledo/.codex/visualizations/2026/10/08/financeiro-correcoes/`.

A revisão independente encontrou perda de foco ao fechar detalhes e após a transição para pagamento; corrigida com cadeia de acionadores e testes de fechamento/transição. Revisão final sem novos achados importantes. As verificações mantêm os limites da auditoria anterior: prévia somente de leitura, sem liquidação, cancelamento, transferência, upload ou geração real contra produção. Esses contratos continuam cobertos por testes de API mockada; o snapshot real observado no relatório não contém itens. Não é certificação WCAG nem avaliação com usuários finais.

Validação final: 124 arquivos / 967 testes aprovados; build frontend (TypeScript + Vite) aprovado. Após o ajuste final do breakpoint do dashboard, os testes focados de visualização e responsividade foram repetidos. Permanece o aviso anterior de bundle acima de 500 kB. As regras de React foram revisadas quanto a ordem de hooks, limpeza de listeners, conteúdo acessível e ausência de duplicação dos painéis.

Também conferida no navegador a sequência calendário móvel → compromisso → pagamento → cancelar: nenhum diálogo permaneceu aberto e o foco retornou ao botão Calendário.

## Ajuste de sobriedade — 09/10/2026

Aplicada a direção aprovada para todas as telas financeiras revisadas: superfícies brancas, ícones/títulos neutros, abas selecionadas em grafite, classificações e links sem azul/verde decorativo. Cores semânticas permanecem nos valores e estados; gráficos preservam diferenciação de séries/categorias. Nenhuma alteração de cálculo, navegação ou contrato de dados.

A nova inspeção visual no navegador ficou indisponível nesta sessão: o browser-harness retornou `Operation not permitted` ao acessar `DevToolsActivePort` do Chrome local. As capturas anteriores não comprovam este ajuste de cor. A validação automatizada atual está registrada na descrição do PR.

Validação atual: 124 arquivos / 967 testes frontend aprovados; TypeScript e build aprovados. Permanece o aviso anterior de bundle acima de 500 kB. `git diff --check` sem erros.

## Paleta corrigida após esclarecimento — 09/10/2026

Mantidas faixas de destaque e superfícies suaves na paleta marrom/verde/vermelho/preto. Azul informativo e amarelo forte substituídos por marrom. Contadores de efeitos em Card shadcn compacto. Validação: 31 arquivos / 330 testes financeiros aprovados, TypeScript e build aprovados. Prévia local responde 200; inspeção visual automática continua indisponível por acesso ao Chrome, conforme registro anterior.

## Modelo claro da visão geral e sidebar — 09/10/2026

final result: passed

Escopo desta iteração: somente `/financeiro` e sidebar global. Fonte visual: mockup aprovado `exec-15e3d8d4-a31c-4967-939d-fd4ff8a0448b.png` (1487 × 1058). Implementação autenticada com API local em `http://localhost:41875/financeiro`. Evidências: `/tmp/financeiro-design-qa/desktop.jpg`, `desktop-match.jpg`, `desktop-normalizado.jpg`, `comparacao.jpg`, `mobile.jpg` e `mobile-sidebar.jpg`.

A comparação lado a lado usa `comparacao.jpg`. O viewport observado de 1486 × 1058 foi alinhado à referência. A captura do IAB com override inclui uma margem externa (1651 × 1174); a normalização remove apenas essa margem, usando os limites do viewport observados no DOM. A conferência móvel usou override 390 × 844. O override foi restaurado ao final.

### Achados corrigidos e nova comparação

- P2: indicadores de recebimentos/a receber herdavam verde por um seletor `first-child`. Corrigido com classe explícita de saldo; demais indicadores em grafite, alertas preservados em vermelho.
- P2: títulos de painéis ainda herdavam cores do tema anterior. Corrigida a precedência local e verificada a cor computada `rgb(32,39,35)` nos quatro títulos.
- P2: cabeçalho da sidebar estreita ocultava o controle de colapso. Marca e controles compactados; busca e colapso visíveis e colapso/expansão funcionando.
- P2: legenda da rosca poderia empilhar no painel estreito de desktop. Grid local de duas colunas aplicado; sem mudar gráficos das outras páginas.

A captura posterior confirma painéis brancos, grafite, tipografia sans-serif e grid análises/categorias acima de compromissos/contas. A sidebar clara conserva marca real, rascunhos, áreas e seletor de sítio. Não há achados P0/P1/P2 pendentes.

### Superfícies de fidelidade

- Tipografia: sans-serif existente, títulos compactos e valores legíveis, sem truncar dinheiro.
- Ritmo: grid 1,65:1, gaps de 16px, cinco indicadores e bordas discretas; abas preservadas no celular.
- Tokens: fundo cinza claro, branco, grafite; verde nos saldos/resultados e vermelho nos alertas. Categorias terrosas discretas.
- Assets: marca oficial Terrano preservada; ícones existentes e Lucide no seletor/indicadores. Sem assets gerados novos.
- Conteúdo: dados reais locais, período global, totais, filtros e legendas preservados. O conteúdo ilustrativo da imagem não substitui os dados da API.

Diferenças deliberadas: o banco local possui uma categoria e nenhum compromisso vencido/nos próximos sete dias, gerando rosca única e estado vazio. O calendário mostra compromissos posteriores; não criamos dados para preencher a imagem. As funções já existentes de rascunhos, permissões e filtros permanecem disponíveis, mesmo quando ausentes no mockup. A explicação contábil do resultado permanece no conteúdo acessível.

### Validação

- Suíte cliente: a expectativa da ordem anterior dos painéis foi atualizada para o modelo aprovado; os 32 testes de dashboard e sidebar passaram. Na repetição completa, 966 de 967 testes passaram e o caso existente de centro de custo por item excedeu 5 segundos. Esse caso passou isoladamente em 947ms, sem alteração de código ou aumento do limite. Não há falha funcional pendente identificada.
- Build de produção e TypeScript aprovados.
- Navegador: Linhas/Barras, detalhes de Alimentação animal com lançamento carregado, calendário com compromissos, abas móveis, sidebar em Sheet e colapso/expansão conferidos.
- Desktop sem overflow horizontal: `scrollWidth === innerWidth`. Nenhuma transação ou dado financeiro foi alterado durante QA.

Checklist: tema limitado ao escopo aprovado; shadcn mantido; navegação e dados preservados; documentação atualizada; comparação visual posterior aprovada.
