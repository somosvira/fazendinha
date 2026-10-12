# Financeiro — Cooperativa contemporânea

Direção visual selecionada em 10/10/2026, baseada no mockup `03-cooperativa-contemporanea.png`. Base funcional: branch `codex/financeiro-dashboard-grid`, rotas e interfaces existentes do módulo. Direção aplicada em 11/10/2026 na branch `codex/financeiro-cooperativa-contemporanea`, reutilizando os componentes e os fluxos existentes. A validação da implementação está registrada em [design-qa.md](../../../design-qa.md).

## Referência e precedência

A referência principal é [01-visao-geral.png](../../../output/design/financeiro-cooperativa-2026-10-10/01-visao-geral.png), cópia do modelo 03 selecionado. A [galeria](../../../output/design/financeiro-cooperativa-2026-10-10/index.html) reúne as telas e o [pacote completo](../../../output/design/financeiro-cooperativa-2026-10-10/financeiro-cooperativa.zip) permite revisão fora do projeto.

Este documento define a estilização vigente para todo o Financeiro. Para comportamento, prevalecem as interfaces, as regras e o [contrato financeiro](../../financeiro-rebuild-contrato.md). As imagens definem a atmosfera visual; os tokens e regras abaixo tornam essa direção reproduzível. Valores e textos das imagens são ilustrativos e devem vir da API na implementação. Uma imagem gerada pode apresentar pequenas variações em ícones, texto ou alinhamento: elas não autorizam remover, acrescentar ou alterar um controle existente.

O agro aparece no verde sálvia, na calma da composição e no conteúdo real do sistema. A marca Terrano existente deve ser preservada. A silhueta rural discreta da referência pode ser um fundo decorativo da sidebar, sem conteúdo funcional, com baixa opacidade e sem prejudicar textos. Não criar fotografias, banners ou novos módulos para comunicar esse contexto.

Os ícones da preview são requisito de correspondência visual, incluindo desenho, orientação, espessura, tamanho, cor, fundo e alinhamento. A implementação deve criar e validar um inventário canônico antes de distribuir as telas, seguindo o [contrato de iconografia e plano de agentes](implementacao.md). Reutilizar ícones existentes somente quando correspondam à referência; não escolher substitutos aproximados. A conferência ocorre contra a tela implementada, sem presumir vetores originais ou igualdade pixel a pixel a partir de PNGs gerados.

## Paleta

Tokens implementados a partir da referência, normalizados para a aplicação. Os hexadecimais não são uma medição exata de todos os pixels do PNG.

| Token | Valor | Uso |
| --- | --- | --- |
| `financeiro.canvas` | `#EDF2ED` | Fundo geral sálvia claro |
| `financeiro.surface` | `#FFFFFF` | Painéis, menus, diálogos e folhas laterais |
| `financeiro.surface-subtle` | `#F3F6F3` | Cabeçalhos de tabela e agrupamentos internos |
| `financeiro.sidebar` | `#E1E9E2` | Navegação global na proposta |
| `financeiro.nav-selected` | `#CCDCCE` | Destino ativo da sidebar |
| `financeiro.heading` | `#22352C` | Títulos e informação prioritária |
| `financeiro.text` | `#283C31` | Texto principal e saídas neutras |
| `financeiro.text-muted` | `#56665F` | Descrições, datas, ajuda e metadados |
| `financeiro.primary` | `#24493B` | Ações primárias e abas selecionadas, texto branco |
| `financeiro.primary-hover` | `#1B3A2E` | Hover da ação primária |
| `financeiro.positive` | `#2D664D` | Entradas, saldo positivo e confirmação |
| `financeiro.chart-in` | `#2D664D` | Série de entradas, linha contínua |
| `financeiro.chart-out` | `#806343` | Série de saídas, linha tracejada |
| `financeiro.positive-bg` | `#EAF3ED` | Estado positivo discreto |
| `financeiro.danger` | `#8D3931` | Erro, vencido, cancelamento e ação destrutiva |
| `financeiro.danger-bg` | `#FBEFEC` | Fundo leve de alerta |
| `financeiro.warning` | `#775930` | Pendência e avisos de consequência |
| `financeiro.warning-bg` | `#F6F0E5` | Fundo leve de atenção |
| `financeiro.divider` | `#D8E2DA` | Separação decorativa entre grupos |
| `financeiro.control-border` | `#7B8D81` | Contorno essencial de controles |
| `financeiro.focus` | `#24493B` | Foco visível de teclado |

Cor indica significado e nunca substitui rótulo, ícone, data ou sinal. A pagar é um compromisso; seu total pode usar texto principal ou marrom de pendência. Reservar vermelho para atraso, erro e ações destrutivas, sem transformar toda obrigação em alerta. Saídas realizadas mantêm direção e sinal escritos. Saldo negativo usa vermelho com sinal. Classificação, anexos e informação comum ficam neutros; não introduzir azul decorativo.

Contrastes calculados entre tokens sólidos: título/branco 13,01:1; texto/canvas 10,40:1; texto secundário/branco 6,07:1; branco/primária 10,04:1; positivo/branco 6,73:1; perigo/fundo de perigo 6,76:1; atenção/fundo de atenção 5,69:1. Borda de controle/branco 3,52:1. A divisória clara é decorativa e não deve ser a única forma de identificar um campo. Esses cálculos não equivalem a uma auditoria do produto implementado.

## Tipografia e números

Usar DM Sans, já disponível no projeto, com fallback `system-ui, sans-serif`. Títulos e corpo compartilham a mesma família. Usar peso e espaço para hierarquia; evitar letras condensadas e excesso de caixa alta.

| Papel | Tamanho / entrelinha | Peso |
| --- | --- | --- |
| Título da página | 28 / 34 px | 600–700 |
| Título de diálogo | 22 / 28 px | 600 |
| Título de painel | 18 / 24 px | 600 |
| Valor principal | 28 / 34 px | 600 |
| Corpo e campos | 14–16 / 20–24 px | 400–500 |
| Metadado curto | 12 / 18 px | 400–500 |
| Cabeçalho de tabela | 12 / 18 px | 600 |

Aplicar `font-variant-numeric: tabular-nums` a valores e datas comparáveis. Alinhar dinheiro à direita nas tabelas; quantidade mantém unidade. Usar formatadores existentes de moeda, data e quantidade, com `R$`, separador decimal brasileiro e sinal quando pertinente. Zero, ausência de valor e falta de permissão são estados diferentes. Não truncar valores monetários para caber no painel.

## Espaço, superfícies e navegação

Escala base: 4, 8, 12, 16, 24 e 32 px. Margem do conteúdo: 24 px no desktop, 16 px no celular. Distância entre painéis: 16 px; entre grandes seções: 24 px. Painéis usam raio de 16 px; campos e botões, 8 px; badges pequenos podem ser arredondados integralmente. Evitar efeito de cápsula em todos os controles.

Superfícies são brancas, com separação leve. Sombra de painel opcional `0 2px 8px rgba(34,53,44,.04)`; diálogo `0 12px 32px rgba(34,53,44,.12)`. Fundo uniforme e contraste de camadas têm prioridade sobre sombras, gradientes ou faixas coloridas.

Preservar marca, busca, recolhimento, seletor de sítio, trabalhos ativos, ordem de navegação e usuário. Sidebar sugerida entre 224 e 248 px no desktop; não altera destinos nem permissões. Destino ativo usa sálvia mais escuro, texto floresta e peso 600. Abas de conteúdo usam verde floresta com texto branco quando selecionadas. A navegação continua sob `client/src/router.ts` e History API, mantendo filtros, parâmetros, links de origem e comportamento de voltar.

## Componentes existentes

Reutilizar as primitivas locais e composições atuais de Tailwind/Radix, incluindo Card, Table, Tabs, Button, Badge, Select, Input, Textarea, Checkbox, Dialog, Sheet, Collapsible, Popover e Command. Gráficos continuam nos componentes existentes com Recharts. O tema deve ser compartilhado dentro do Financeiro e alcançar seus portais; não criar um conjunto paralelo de componentes para a estilização.

Botões têm altura mínima de 40 px no desktop e alvo confortável de 44 px no toque. Primário verde floresta, secundário branco com borda e texto principal, destrutivo tijolo. “Cancelar” que apenas fecha um formulário permanece secundário; “Cancelar operação” e “Confirmar cancelamento” representam efeito financeiro e usam tratamento destrutivo. Desabilitado deve ser identificável sem reduzir a legibilidade dos dados da página inteira. Foco: anel de 2 px com afastamento de 2 px.

Tabelas usam cabeçalho suave, linhas separadas, hover sálvia leve e ações no fim. Cabeçalhos/células têm 16 px de recuo horizontal e 10 px vertical. A coluna principal recebe o espaço restante; auxiliares têm largura orientada pelo conteúdo, podendo crescer para acomodar ações/valores. Datas não quebram e ficam à esquerda; dinheiro e quantidades seguem à direita. Paginação fica no rodapé. Preservar colunas, busca, filtros, contagens e rolagem interna. Não converter cada linha desktop em um novo card. Cliques preservam links acessíveis e ações independentes; inativos/cancelados permanecem legíveis.

Busca e filtros compartilham uma barra desktop com intervalos de 12 px. Busca cresce até 420 px; seletores até 220 px; quebra organizada conforme a largura. No celular, empilham. Evitar seletor estreito dentro de grande coluna vazia. Densidade e larguras são isoladas ao Financeiro, inclusive quando primitivas são reutilizadas na Pecuária.

Formulários mantêm labels visíveis, obrigatoriedade e ajuda junto ao campo. Grupos de duas colunas só quando a largura permite. Erro aparece junto ao campo e no resumo existente, com anúncio acessível. Menus e seletores usam superfície branca e seleção sálvia. Campos condicionais aparecem somente nas condições já implementadas; a imagem de um formulário não é um inventário de todas as suas variantes.

Dialog continua centralizado, com cabeçalho sálvia, título floresta, ícone canônico e rodapé suave separado do corpo branco. O ícone do cabeçalho usa círculo floresta com traços brancos, mantendo seu desenho. Corpo rola quando necessário, limitado à janela. Sheet de conta, parceiro, produto e procedimentos continua à direita, até 768 px e largura limitada pela janela. Overlay `rgba(34,53,44,.38)`. Detalhe de compromisso e liquidação destacam saldo pendente/vencimento antes dos metadados. Preservar foco preso, retorno ao acionador, Escape, confirmação de descarte e bloqueio durante envio.

## Refinamentos após os 13 feedbacks

Os ajustes de 11/10/2026 seguem o [plano de refinamentos](plano-refinamentos.md). A galeria registra a referência inicial; esta seção descreve a composição refinada.

Operações usam uma superfície contínua: identificação/valor, contagens inline e seções internas de itens, consequências, documentos, procedimentos e auditoria. Divisórias substituem sombras independentes. Breadcrumbs em operação, conta e relatório preservam os destinos e parâmetros; operações vindas do Estoque/Sanidade respeitam a origem contextual.

Nova operação e novo relatório usam a largura disponível após a sidebar, formulário à esquerda e resumo de 340 px à direita (300 px nas larguras intermediárias). Título, descrição e salvamento ficam dentro do formulário. Ações secundárias no rodapé; confirmação/geração no resumo. Relatório empilha abaixo de 900 px; operação abaixo de 1024 px, mantendo rolagem interna e ação de confirmação limitada à janela. O resumo do relatório acompanha a rolagem quando há espaço.

Gráficos usam tokens específicos de entradas/saídas nas séries, legendas e tooltips; valores de saída continuam neutros. Traço contínuo/tracejado distingue as séries. Contas apresenta fluxo consolidado aberto antes da lista, com todas as contas no ano atual, inclusive fora do saldo geral. Período, busca, conta e instituição ficam dentro do painel Extrato geral e afetam apenas essa tabela. Essa decisão de 11/10/2026 substitui o período compartilhado entre gráfico e extrato. Saldo geral considera contas ativas incluídas. Transferências próprias e estornos seguem o contrato. Fluxo acumulado não é denominado saldo histórico.

Histórico de relatórios carrega na entrada e no retorno da criação/detalhe, sem botão habitual de atualizar. Falhas oferecem tentar novamente. Apenas enquanto há `PROCESSANDO` na lista, revalida após 4 s, sem requests sobrepostas, pausando com página oculta, erro ou saída.

Documento financeiro tem tema monocromático: papel branco, texto preto, metadados cinza, sinais e rótulos explícitos. Abrange prévia, símbolo Terrano dentro do documento e exportação pelo navegador. O PDF do servidor já usa cinza e preserva snapshots/arquivos históricos. Cabeçalhos de tabela repetem na impressão; tabelas extensas atravessam páginas sem quebrar linhas.

## Continuidade dos rascunhos

Abrir lista pela sidebar atualiza rota e tela; retomar trabalho é uma ação separada. Operações/relatórios salvam a última edição ao desmontar, além do autosave. Gravações serializadas usam a versão confirmada; leituras atrasadas não restauram conteúdo antigo.

Durante salvamento/falha, a última edição permanece recuperável em memória da sessão/sítio, identificada como trabalho não salvo; a lista continua acessível. Confirmação/geração e descarte limpam a recuperação. Correção e ajuste de estoque não são restaurados como rascunho comum. Não há novo armazenamento no navegador. Se a gravação falhar, a recuperação temporária não sobrevive a fechar/recarregar a página; somente o rascunho confirmado no servidor persiste entre recargas.

## Aplicação por tela

Os arquivos abaixo ficam em `output/design/financeiro-cooperativa-2026-10-10/`. A galeria apresenta a mesma sequência.

| Arquivo PNG | Rota ou superfície | Conteúdo de referência |
| --- | --- | --- |
| `01-visao-geral` | `/financeiro` | Modelo 03 selecionado: caixa, contas, compromissos/calendário e categorias |
| `02-operacoes` | `/financeiro/operacoes` | Lista, período, busca, efeitos, tipos, status e rascunho |
| `03-nova-operacao` | `/financeiro/operacoes/nova` | Identificação, itens, classificação, efeito financeiro, documentos e revisão |
| `04-detalhe-operacao` | `/financeiro/operacoes/:id` | Resumo, itens, compromissos, documentos e vínculos presentes |
| `05-compromissos-lista` | `/financeiro/compromissos` | A pagar em lista, saldos, vencidos e liquidação |
| `06-compromissos-calendario` | Mesma rota, calendário | Mês, navegação, legenda e compromissos por dia |
| `07-compromissos-liquidados` | Mesma rota, filtro Liquidados | Estado liquidado com saldo pendente zero |
| `08-detalhe-compromisso` | Dialog | Valor original, pendência, prazo e origem |
| `09-registrar-pagamento` | Dialog | Conta, valor, data, forma, nota opcional e consequências |
| `10-registrar-recebimento` | Dialog | Liquidação a receber, sem adicionar campos do pagamento |
| `11-contas-extrato-geral` | `/financeiro/contas` | Contas, saldo geral, filtros e extrato geral abaixo |
| `12-detalhe-conta` | `/financeiro/contas/:id` | Gráfico, identificação e extrato da conta |
| `13-transferencia` | Dialog | Origem, destino, valor, data e revisão de impacto |
| `14-config-contas` | `/financeiro/configuracoes` | Aba Contas financeiras |
| `15-config-parceiros` | Mesma página | Aba Clientes e fornecedores |
| `16-config-produtos` | Mesma página | Aba Produtos, filtros e vínculos ao estoque |
| `17-config-categorias` | `/financeiro/configuracoes/categorias` | Aba Categorias, classificação, vínculos e paginação |
| `18-config-centros` | Configurações, aba | Centros de custo, vínculos e situação |
| `19-form-conta` | Sheet | Cadastro bancário, abertura e inclusão no saldo geral |
| `20-form-parceiro` | Sheet | Identificação, papéis, contato, endereço e preferências |
| `21-form-produto` | Sheet | Categoria, usos, unidade, lotes, centros e fornecedores |
| `22-form-categoria` | Dialog | Nome e classificação |
| `23-form-centro` | Dialog | Nome do centro de custo |
| `24-relatorios` | `/financeiro/relatorios` | Histórico, autor, recorte, busca e PDF |
| `25-novo-relatorio` | `/financeiro/relatorios/novo` | Leitura, filtros avançados, revisão e emissão |
| `26-detalhe-relatorio` | `/financeiro/relatorios/:id` | Snapshot emitido, totais, itens e prévia existente |
| `27-detalhe-categoria` | Dialog da visão geral | Total líquido e lançamentos com acesso à origem |
| `28-cancelar-operacao` | Dialog de revisão | Efeitos elegíveis, preservação de histórico e motivo |
| `29-procedimentos-servico` | Sheet | Procedimentos realizados vinculados ao serviço, filtros e origem |

As abas de configurações pertencem à mesma página; não criar uma rota para cada arquivo. Parâmetros existentes como `aba=parceiros` e `aba=produtos` devem continuar funcionando. Criação e edição de cadastros compartilham a composição, preservando os campos permitidos e as restrições da edição.

O formulário de operação representa uma compra para estoque. Serviço, venda, consumo direto, transferência, ajuste e demais tipos disponíveis reutilizam a linguagem visual, preservando suas seções e regras próprias. Não copiar campos de compra para todos os tipos. Detalhes exibem histórico, movimentos, perdas ou transferências quando o registro os possui, sem esconder conteúdo para reproduzir a altura de um PNG.

A visão geral mantém seus painéis e ações, sem uma nova faixa de indicadores. Disponibilidade é saldo atual; recebimentos e pagamentos dependem do período. Resultado de caixa não é lucro. Despesas por categoria preservam total líquido, filtro, pizza/ranking e acesso aos lançamentos. Linhas e barras mantêm alternância e traçados distinguíveis.

Compromissos usam busca primeiro, seleção múltipla de A pagar/A receber/Liquidados e período de vencimento dentro da listagem. Seleção vazia inclui todas as situações, também cancelados; critérios selecionados são combinados por OU. O período e os demais filtros afetam lista/calendário, enquanto os três cards mantêm o conjunto completo do sítio; vencido é condição de prazo, separada de Pendente/Parcial/Liquidado. Pagamento mantém nota fiscal opcional e seus avisos de persistência; recebimento conserva o fluxo próprio. Transferência preserva revisão das duas contas e o recorte das contas incluídas no saldo geral.

Relatórios preservam o recorte, o autor e os dados da emissão; não recalcular silenciosamente o snapshot ao abri-lo. A lista mantém PDF e continuação de rascunho. O formulário mantém filtros por item e sua revisão. Categorias e centros históricos não indicam módulos operacionais de Agricultura/Equipe, produção de leite ou reprodução disponíveis.

## Estados e responsividade

Carregamento usa Skeleton ou indicador existente nos mesmos grupos de conteúdo, com movimento reduzido respeitado. Vazio apresenta a explicação e a ação já disponível; não inventar sugestões, métricas ou registros. Erro mantém mensagem recuperável e nova tentativa quando existente. Falha de salvamento não pode parecer sucesso. Rascunho mantém estado explícito de alteração não salva, salvamento ou falha conforme resultado real.

Até 767 px, usar navegação móvel existente, campos em uma coluna, rodapés alcançáveis e indicadores acompanhando os painéis nas abas existentes da visão geral. Tabelas mantêm todos os dados no padrão móvel atual ou rolagem contida. Calendário conserva acesso aos dias e compromissos, sem miniaturizar textos; a agenda textual existente permanece no celular. Entre 768 e 1023 px, reduzir colunas sem perder controles. A partir de 1024 px, permitir o grid simultâneo da visão geral; ajustar proporções à legibilidade e ao conteúdo real. Formulários com revisão lateral podem empilhar antes de comprimir campos.

Esses parâmetros orientam a implementação responsiva. Os mockups entregues são desktop; não há PNG separado para cada breakpoint, tipo de operação, estado de erro ou combinação de filtros.

## Regras funcionais preservadas

Operação descreve o fato; compromisso representa pendência; transação representa dinheiro realizado; movimento de conta altera saldo. Não confundir essas quatro camadas por cor ou título. Confirmados preservam histórico e autoria. Cancelamento/estorno mantêm revisão, motivo e efeitos inversos; períodos fechados não são contornados. Estoque depende do fato físico e sua origem, independentemente do pagamento.

Escopo por sítio, permissões de lançar/editar/exportar e `verValores` continuam definidos pelo servidor. Estado visual não autoriza ação. Dados monetários continuam com Decimal e formatadores existentes. Não adicionar assistente, novos módulos ou novas dependências operacionais como parte do tema.

## Validação e limites da entrega

Referências capturadas da aplicação local, com usuário demonstrativo e leitura das rotas existentes. Após autenticação, requisições de escrita da captura foram bloqueadas; pagamentos, recebimentos, transferências, cancelamentos, vínculos e cadastros não foram confirmados. As imagens usam a massa fictícia existente, sem reexecutar seed.

Revisão visual dos PNGs, conferência da cobertura das páginas e cálculo dos contrastes dos tokens. A geração dos mockups não alterou runtime, API, schema ou dados financeiros. A implementação posterior altera somente a apresentação no client; as evidências de build, testes, navegador, responsividade e isolamento estão no relatório de QA. A homologação integral com leitor de tela e escrita financeira real continua fora das capturas de leitura. As capturas e os mockups não substituem essa validação.

Antes de implementar, conferir cada campo e ação contra sua interface atual; usar as imagens para estilo e este guia para consistência. Diferença eventual entre um texto rasterizado e o controle real deve ser resolvida preservando o contrato funcional.


## Compartilhamento com a Pecuária — 11/10/2026

A paleta deste guia foi extraída, com os mesmos valores, para `client/src/styles/cooperativa-theme.css`. As primitivas e os tokens agora alcançam também `.pecuaria-content`. O [guia da Pecuária](../pecuaria-cooperativa/design.md) define sua composição operacional. A geometria canônica dos ícones e os contratos/rotas do Financeiro continuam sendo os deste módulo.
