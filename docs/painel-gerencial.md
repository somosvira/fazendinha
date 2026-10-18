# Painel gerencial

A página em `/gerencial` expõe informações já registradas: caixa realizado, nutrição, estoque atual, custos diretos por finalidade e acompanhamentos pendentes. A página inicial dos perfis continua a mesma. A entrega acrescenta interface, navegação, API de leitura e cálculos de apresentação. Não altera schema, migrations, regras financeiras, valorização de estoque ou gravação de fechamentos. Não cria despesas, pagamentos, consumos, parâmetros persistidos ou centros de custo.

## Consulta e fontes existentes

`GET /api/gerencial/resumo?inicio=AAAA-MM-DD&fim=AAAA-MM-DD` aceita até 366 dias inclusivos, sem datas futuras. Sítio/consolidado seguem `resolverEscopoLeitura` e `X-Propriedade-Id`. A URL preserva início/fim e, quando selecionado, `propriedadeId`; recarga e voltar/avançar restauram o contexto. Respostas antigas não substituem consultas novas.

Entrar pelo menu mantém o sítio selecionado e o registra na URL. Acesso direto a `/gerencial` sem `propriedadeId` significa consolidado. Os links de origem levam o sítio explícito aos detalhes operacionais, inclusive em carga completa da página.

A resposta `GERENCIAL_V1` informa período, escopo, instante da consulta, corte próprio do estoque, blocos autorizados, cobertura e origens. Dinheiro usa Decimal serializado como texto. O serviço do painel executa uma transação `RepeatableRead` com `SET TRANSACTION READ ONLY`; não há tabela gerencial nem snapshots novos. Autenticação continua usando o fluxo existente de sessão. Falhas retornam erro, sem fabricar totais zero.

| Bloco | Fonte e interpretação |
|---|---|
| Caixa | Transações, movimentos realizados e rateios existentes. Confirmadas/revertidas entram na data realizada, com inversos abatendo a natureza original. Transferências próprias e compromissos não liquidados ficam fora. Resultado = recebido menos pago; não representa lucro. Série mensal e centros de custo são recortes desse caixa. |
| Estoque | Movimentos físicos, alocações, bases e parcelas de valorização existentes no corte atual. Preserva o método operacional existente: `MEDIA_SALDO_V1` em produto rastreado e `FIFO_AQUISICAO_V1` sem rastreio. Não modifica entradas, saídas, transferências ou custos históricos. Divergência entre quantidade física e valorizada torna o valor pendente. Não soma quantidades de unidades diferentes. |
| Nutrição | Fechamentos confirmados, participações, itens e valores de movimentos existentes. Localizações, entrada, partos e exceções manuais permitem derivar presença e população por data em memória. Não grava essa reconstrução. |
| Custos diretos | Serviços de leitura e cálculo existentes de tentativa, aplicação, exame e participação. Vínculos preparatórios não duplicam gastos; serviços usam o valor atribuído ao fato. Nutrição entra pelos componentes recortados. Identidade original deduplica os componentes. Finalidade, origem operacional e centro de custo são dimensões diferentes. |
| Acompanhamentos | Contagem das demandas reprodutivas pendentes até o corte atual. A consulta não cria tarefas ou adota políticas clínicas. |

Caixa, estoque e consumo têm significados e datas próprios: seus totais não devem ser somados. Nutrição e finalidade são recortes dos mesmos custos diretos. Custos sem atribuição operacional não são distribuídos automaticamente entre animais.

## Nutrição e limites do histórico

A atribuição individual usa `calcularAtribuicao`, já existente. Para apresentar um recorte de período, a parcela atribuída a cada animal é distribuída entre seus dias conciliados antes de aplicar o filtro. Maiores restos e desempate cronológico conservam centavos e quantidades de três casas. Isso é rateio de apresentação, não medição de ingestão individual nem alteração do custo gravado.

A reconstrução só é usada quando seus intervalos conciliam com o número de dias registrado na participação. Divergências ficam explícitas como lacunas e tornam os totais parciais. A consulta depende dos fatos históricos disponíveis; não oferece a garantia de uma classificação congelada na data do fechamento.

Vaca por data significa fêmea com paridade positiva pela função existente `contarPartos`, incluindo secas e lactantes. Saldo de entrada e partos contabilizáveis seguem o domínio atual, inclusive suas regras para aborto, natimorto e anulação. Machos e fêmeas sem paridade ficam fora dessa população. Datas anteriores à entrada e exceções manuais de categoria tornam a classificação incerta. Localizações contraditórias não geram presença inventada. Categoria textual editável e idade atual não definem a população histórica.

Para duração `D`, animal-dias `AD` e custo `C` da mesma população e dos mesmos dias:

- População média = `AD / D`.
- R$/cabeça/dia = `C / AD`.
- R$/cabeça no período = `C / (AD / D)`.

Vacas usam numerador e denominador próprios. Consolidado soma custos/dias antes de dividir. Denominador zero ou ausência de custo conhecido retorna não apurado; zero comprovado continua zero. Valores diários têm quatro casas na apresentação.

Cobertura distingue alimentação registrada, classificação e componentes/quantidades com custo conhecido por unidade. Ausência de lançamento não significa consumo zero. Não existe percentual monetário sobre um total desconhecido. Lacunas de nutrição impedem declarar completos os custos diretos e suas finalidades.

## Apresentação do painel administrativo

A interface usa o título “Painel administrativo”, mantendo a rota `/gerencial`. O seletor global de sítio continua sendo a fonte de contexto; o cabeçalho informa o sítio/consolidado, o período efetivamente consultado e o instante da resposta. Aplicar período, atualizar e os atalhos internos preservam os contratos de URL e navegação existentes.

O resumo de caixa antecede a tabela aberta de centros de custo. Custos diretos por finalidade e nutrição ficam em blocos distintos; nutrição já integra o total de custos diretos. A contagem de transações usa `transacaoId` distinto, e a de produtos usa `produtoId` distinto: movimentos, lotes e sítios podem repetir a mesma identidade. Resultado líquido zero não implica ausência de transações.

A cobertura de alimentação acompanha os indicadores nutricionais: `diasAlimentados / animalDias`, apresentada como percentual com uma casa decimal e contagem absoluta. Denominador zero torna a cobertura não apurada. Esse percentual não mede custo monetário conhecido nem comprova classificação ou custo completos. Os estados parciais e as lacunas do contrato continuam sendo exibidos. População média tem uma casa decimal na tela, sem alterar cálculos; valores diários mantêm quatro casas.

O estoque mostra sua própria data de referência. Vacas, evolução mensal com tabela, composição do estoque, origens, divergências, limites e acompanhamentos permanecem acessíveis nos detalhes. Blocos restritos exibem uma mensagem curta com o motivo consultável, sem valores ou origens. A interface se reorganiza em uma coluna no celular, com a rolagem de tabelas contida em seu próprio bloco.

## Autorização

| Bloco | Requisitos existentes verificados no servidor |
|---|---|
| Página/API | Pecuária, ou Financeiro com aba Visão geral (`dashboard`); dono mantém acesso existente |
| Caixa | Financeiro + Visão geral + `verValores` + `verSalarios` + `verInvestimento` |
| Estoque em valores | Financeiro + `verValores` |
| Nutrição e custos diretos | Pecuária + Financeiro + `verValores` |
| Acompanhamento clínico | Pecuária |

Bloco restrito devolve somente estado/motivo, sem consultar ou enviar valores, fontes, gráficos ou subtotais. Não cria papéis nem ACL de sítio. Caixa exige as permissões adicionais porque as categorias atuais não permitem separar com segurança um total que inclua valores salariais/investimentos. O painel explica a restrição e não amplia o acesso do perfil.

## Implementação e validação

O servidor concentra as consultas em `services/gerencial/`, com cálculos puros de presença/nutrição separados do acesso ao banco, e rota Hono/Zod em `routes/gerencial.ts`. A interface em `client/src/gerencial/` usa os componentes e contratos existentes de navegação e detalhes operacionais. O [HTML explicativo](gerencial/artefatos/painel-administrativo.html) descreve a entrega e as evidências de validação.

Testes do painel cobrem permissões, validação de período/sítio, transação de leitura, centavos, populações, lacunas, erro e resposta fora de ordem. Validação com dados reais deve usar somente `fazendinha_seedatev3`, sem reset ou recarga. Testes automatizados, inspeção visual e homologação pela fazenda são evidências diferentes.

Ficam fora do escopo alterações de banco ou motores financeiros, correções de operações de estoque, novas regras de fechamento, custo econômico completo/lucro, produção e qualidade do leite, FIV/laboratório, assistência automática, sincronização IDEAGRI, novas permissões e reativação da IA. Qualquer evolução operacional exige uma tarefa própria.
