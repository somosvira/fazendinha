# Painel gerencial

A página em `/gerencial` expõe informações já registradas: caixa realizado, nutrição, estoque atual, custos diretos por finalidade e acompanhamentos pendentes. A página inicial dos perfis continua a mesma. A entrega acrescenta interface, navegação, API de leitura e cálculos de apresentação. Não altera schema, migrations, regras financeiras, valorização de estoque ou gravação de fechamentos. Não cria despesas, pagamentos, consumos, parâmetros persistidos ou centros de custo.

## Consulta e fontes existentes

`GET /api/gerencial/resumo?inicio=AAAA-MM-DD&fim=AAAA-MM-DD` aceita até 366 dias inclusivos, sem datas futuras. Sítio/consolidado seguem `resolverEscopoLeitura` e `X-Propriedade-Id`. A URL preserva início/fim e, quando selecionado, `propriedadeId`; recarga e voltar/avançar restauram o contexto. Respostas antigas não substituem consultas novas.

Entrar pelo menu mantém o sítio selecionado e o registra na URL. Acesso direto a `/gerencial` sem `propriedadeId` significa consolidado. Os links de origem levam o sítio explícito aos detalhes operacionais, inclusive em carga completa da página.

A resposta `GERENCIAL_V1` informa período, escopo, instante da consulta, corte próprio do estoque, blocos autorizados, cobertura e origens. Dinheiro usa Decimal serializado como texto. O serviço do painel executa uma transação `RepeatableRead` com `SET TRANSACTION READ ONLY`; não há tabela gerencial nem snapshots novos. Autenticação continua usando o fluxo existente de sessão. Falhas retornam erro, sem fabricar totais zero.

| Bloco | Fonte e interpretação |
|---|---|
| Caixa | Transações, movimentos realizados e rateios existentes. Confirmadas/revertidas entram na data realizada, com inversos abatendo a natureza original. Transferências próprias e compromissos não liquidados ficam fora. Resultado = recebido menos pago; não representa lucro. Série mensal e centros de custo são recortes desse caixa. |
| Compromissos | Saldo atual de compromissos ativos ainda a pagar, agrupado em vencido e faixas de vencimento até a data de consulta. Não movimenta caixa e não segue o período histórico selecionado. O atalho abre a lista filtrada para `situacao=pagar`, preservando o sítio selecionado. |
| Estoque | Movimentos físicos, alocações, bases e parcelas de valorização existentes no corte atual. Preserva o método operacional existente: `MEDIA_SALDO_V1` em produto rastreado e `FIFO_AQUISICAO_V1` sem rastreio. Não modifica entradas, saídas, transferências ou custos históricos. Divergência entre quantidade física e valorizada torna o valor pendente. Não soma quantidades de unidades diferentes. |
| Nutrição | Fechamentos confirmados, participações, itens e valores de movimentos existentes. Localizações, entrada, partos e exceções manuais permitem derivar presença e população por data em memória. Não grava essa reconstrução. |
| Custos diretos | Serviços de leitura e cálculo existentes de tentativa, aplicação, exame e participação. Vínculos preparatórios não duplicam gastos; serviços usam o valor atribuído ao fato. Nutrição entra pelos componentes recortados. Identidade original deduplica os componentes. Finalidade, origem operacional e centro de custo são dimensões diferentes. |
| Acompanhamentos | Contagem das demandas reprodutivas pendentes até o corte atual. A consulta não cria tarefas ou adota políticas clínicas. |

Caixa, compromissos, estoque e consumo têm significados e datas próprios: seus totais não devem ser somados. Compromissos não liquidados não são movimentos de caixa. Nutrição e finalidade são recortes dos mesmos custos diretos. Custos sem atribuição operacional não são distribuídos automaticamente entre animais.

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

A interface usa o título “Painel administrativo”, mantendo a rota `/gerencial`. O seletor global de sítio continua sendo a fonte de contexto; o cabeçalho informa o sítio/consolidado, o período consultado e o instante da resposta. Aplicar período e atualizar preservam os contratos de URL e navegação existentes.

O resumo apresenta caixa realizado, saldo atual a pagar, nutrição, custos diretos por finalidade, valor atual de estoque e acompanhamentos pendentes. O gráfico mensal compara recebimentos e pagamentos quando há valores líquidos não zerados; a tabela mensal permanece mesmo quando todos os valores são zero. Transações com efeitos líquidos zerados não são tratadas como ausência de movimentos. Centros e faixas de vencimento usam barras com valores diretamente associados, sem repetir uma legenda extensa; valores negativos têm eixo divergente e sinal preservado. As faixas estão junto ao saldo a pagar, em ordem cronológica. Estados vazios são textuais. Não há expansão de origens, composição ou outras linhas de detalhe no painel.

Nutrição já integra o total de custos diretos. A contagem de transações usa `transacaoId` distinto, e a de produtos usa `produtoId` distinto. Resultado líquido zero não implica ausência de transações. O indicador de população média do rebanho permanece no resumo nutricional, sem linhas de origem ou indicador separado para vacas.

O estoque mostra sua data própria de referência. `situacao` distingue valor completo, parcial e desconhecido; `valorConhecido: null` aparece como “Não apurado”, enquanto zero comprovado permanece zero. Um valor parcial soma somente parcelas conhecidas e informa que existem grupos pendentes. A página não transforma ausência de valor em zero.

Os atalhos levam às contas, aos compromissos a pagar, à nutrição, ao estoque atual e à reprodução, mantendo o sítio selecionado. Contas, nutrição e reprodução preservam o período quando aplicável; compromissos não recebem filtro histórico e estoque não recebe datas, pois são visões atuais. Blocos restritos mostram o motivo sem valores monetários. A interface se reorganiza em uma coluna no celular.

## Autorização

| Bloco | Requisitos existentes verificados no servidor |
|---|---|
| Página/API | Pecuária, ou Financeiro com aba Visão geral (`dashboard`); dono mantém acesso existente |
| Caixa | Financeiro + Visão geral + `verValores` + `verSalarios` + `verInvestimento` |
| Compromissos | As mesmas permissões financeiras da visão de caixa; compromissos compartilham categorias que podem conter valores salariais/investimentos |
| Estoque em valores | Financeiro + `verValores` |
| Nutrição e custos diretos | Pecuária + Financeiro + `verValores` |
| Acompanhamento clínico | Pecuária |

Bloco restrito devolve somente estado/motivo, sem consultar ou enviar valores, fontes, gráficos ou subtotais. Não cria papéis nem ACL de sítio. Caixa exige as permissões adicionais porque as categorias atuais não permitem separar com segurança um total que inclua valores salariais/investimentos. O painel explica a restrição e não amplia o acesso do perfil.

## Implementação e validação

O servidor concentra as consultas em `services/gerencial/`, com cálculos puros separados do acesso ao banco, e rota Hono/Zod em `routes/gerencial.ts`. A interface em `client/src/gerencial/` reaproveita a navegação existente. Testes cobrem contratos de permissões, período e sítio, erro, resposta fora de ordem, acessibilidade dos valores nos gráficos, estados vazios, mascaramento e URLs dos atalhos. Validação com dados reais deve usar somente `fazendinha_seedatev3`, sem reset ou recarga. Testes automatizados, inspeção visual e homologação pela fazenda são evidências diferentes. O [HTML explicativo](gerencial/artefatos/painel-administrativo.html) registra implementação e validação da entrega.

Ficam fora do escopo alterações de banco ou motores financeiros, correções de operações de estoque, novas regras de fechamento, custo econômico completo/lucro, produção e qualidade do leite, FIV/laboratório, assistência automática, sincronização IDEAGRI, novas permissões e reativação da IA. Qualquer evolução operacional exige uma tarefa própria.


### Apresentação e prioridades

A interface compartilha a identidade petróleo, superfícies claras e tipografia das consultas operacionais. Período fica num popover com os campos e confirmação existentes; cancelar/fechar descarta a edição ao reabrir. A URL, limite de datas e atualização de sítio continuam no controlador atual.

Vencidos e acompanhamentos autorizados recebem uma faixa de prioridades atuais. Ela respeita os estados restritos, conserva a referência temporal e os atalhos de origem; não usa valores ocultos nem representa o período histórico do caixa. Nutrição e custos diretos aparecem juntos, com coberturas distintas e valores pendentes explícitos. Barras de finalidade representam apenas valores conhecidos positivos, sem transformar Não apurado em zero. Tabelas mensais, centros, faixas, classificações comprovadas, população média e horário de consulta permanecem acessíveis. A explicação de não somar caixa, consumo, estoque e custos fica no acionador Sobre as leituras do painel.
