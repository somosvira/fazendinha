# Nutrição: consumo diário e conferência mensal

## Escopo e disponibilidade

O domínio mantém receitas versionadas, vigências de dieta por lote e localização histórica dos animais. A nutrição mensal acrescenta configuração por sítio, exceções por lote, cálculo diário, movimentos vinculados e uma conferência por lote/mês. O histórico anterior continua consultável; não há conversão ou lançamento retroativo fictício.

A implementação está protegida por `NUTRICAO_MENSAL_ENABLED=false` e `NUTRICAO_AUTOMACAO_ENABLED=false`. A existência deste contrato e da interface não significa que um ambiente foi migrado ou habilitado. A referência visual aprovada está no [mockup](../design/nutricao/mockup-fechamento.html).

## Escolha do modelo

| Modelo apresentado | Rotina | Quando altera o estoque confirmado | Conferência mensal |
|---|---|---|---|
| Baixa automática diária — recomendado | Calcula dieta × animais presentes em cada dia encerrado | A cada processamento diário bem-sucedido | Aceita o total ou registra diferença justificada |
| Confirmar antes de baixar | Mantém o cálculo aguardando conferência; permite selecionar vários dias juntos e corrigir quantidades | Na confirmação dos dias selecionados | Revisa o conjunto; não repete as baixas |
| Estimar e baixar no fechamento | Calcula consumo virtual diário | Somente ao confirmar o mês | Converte o total revisado em movimentos reais |

O terceiro modelo conserva dois números: **saldo confirmado** e **saldo estimado**, este igual ao saldo confirmado menos o consumo virtual ainda não efetivado. A estimativa pode revelar falta de alimento; não permite saída física sem saldo ou sem base de valor. Não altera caixa nem cria compra. O cálculo representa atribuição por permanência no lote, não medição de ingestão de cada animal.

A opção automática atende a rotina com menor esforço: o usuário cuida de exceções e revisa um total mensal. A opção manual exige mais participação diária. A provisória é útil quando o estoque precisa continuar estimado até a conferência.

## Configuração e calendário

Em **Configurações → Pecuária → Nutrição**, a pessoa escolhe o sítio, o padrão geral ou um lote como exceção, o modelo, a vigência, o dia da conferência e a autorização de seleção por validade. A configuração é versionada e auditada. Uma exceção vigente do lote prevalece sobre o padrão do sítio.

A primeira ativação começa amanhã ou depois e pode produzir um primeiro mês parcial. Alterações começam no primeiro dia de um mês seguinte; não reinterpretam meses já iniciados. Fechamentos anteriores sobrepostos impedem a ativação. Não se permite fechar pelo fluxo anterior um período que já adotou o mensal.

A competência é o mês civil. O dia escolhido é o prazo de conferência **no mês seguinte**. Por exemplo, outubro com dia 5 vence em 5 de novembro. Se o mês não possui o dia escolhido, vale seu último dia. A aba Alertas passa a apresentar o fechamento na data configurada, mantém os atrasados até a revisão e mostra falhas operacionais imediatamente. O filtro é aplicado no servidor antes da paginação. Essa fila é local à Nutrição; não implementa envio de mensagens nem integração com uma central geral de alertas.

## Rotina, faltas e correções

O processador usa a vigência da dieta e os intervalos históricos de localização. A data da transferência pertence ao destino. Ausência de dieta, centro de custo, saldo, lastro monetário ou seleção de partida gera pendência; não é transformada em consumo zero comprovado.

Produtos rastreados podem usar seleção automática por menor validade somente mediante autorização explícita da configuração. Partidas vencidas na data do consumo ou sem validade conhecida não entram nessa escolha. A validade usa a data do consumo, mesmo quando o movimento é registrado depois; cada dia é validado separadamente. A seleção manual mantém as regras existentes do Estoque, inclusive ciência de validade desconhecida e bloqueios de validade. No modo automático, uma pendência pode ser resolvida pela confirmação dos dias com seleção explícita.

A conferência pede o total do mês por ingrediente. Não exige distribuir a diferença por data: o serviço distribui unidades mínimas de forma determinística e conservadora. Uma seleção mensal de partidas é repartida entre os complementos dos dias. Totais iguais aos já baixados não produzem movimentos adicionais. Diferenças exigem justificativa.

Complementos criam saídas; reduções criam recomposições vinculadas às mesmas bases de valor consumidas. Os movimentos são registrados na data da confirmação, mantendo o vínculo com o dia e mês de consumo. Não se recalculam movimentos históricos posteriores. Perda física usa o fluxo de Perda do Estoque, não uma recomposição nutricional. O período do consumo e o do movimento precisam estar abertos.

Se dieta ou ocupação histórica mudar depois de uma baixa, o snapshot permanece com uma pendência. **Atualizar base histórica com justificativa** reconcilia e audita os participantes/ingredientes, sem movimentar estoque. O usuário vê a nova revisão e confere os totais antes de confirmar. Classificações de participantes removidos ficam conservadas na auditoria e deixam de classificar a participação inválida; as dos demais participantes permanecem. Mês já revisado precisa ser reaberto com motivo antes da correção.

## Dados, autorização e efeitos

- `ConfiguracaoNutricao`: versão de regra por sítio/lote.
- `MesNutricao`: identidade única lote/competência, configuração congelada, revisão concorrente e autoria da conferência.
- `ConsumoDiario`: snapshot de data, dieta, centro de custo, hash da base e situação.
- `ParticipacaoConsumoDiario`: presença individual usada na atribuição, com classificação de custo opcional.
- `ItemConsumoDiario`: quantidade calculada, quantidade efetivada, custo líquido e origem da quantidade.
- `MovimentoConsumoDiario`: vínculo imutável com movimento de estoque e diferenças assinadas de quantidade/valor.

API em `/api/pecuaria/rebanho/nutricao/mensal`: status, configurações, meses, detalhe, reprocessamento, confirmação mensal, confirmação cumulativa de dias, reconciliação e reabertura. A escrita exige sessão real, área Pecuária, permissão de lançamento e sítio autorizado. Confirmações e reconciliação usam chave idempotente, revisão e transação serializável; a interface também impede submissão concorrente. A resposta mensal oculta custos para quem não pode ver valores financeiros. As consultas existentes de custo operacional conservam sua política própria de autorização.

O estoque exibe a projeção virtual separada do saldo físico. O histórico do animal consulta períodos anteriores e novos dias sem fabricar fechamentos legados. Panorama por lote, custos do animal e painel gerencial incorporam os consumos efetivados; provisórios não são custos realizados. Os movimentos novos permitem retornar ao mês de origem. Nenhuma consulta cria movimentos.

A migration adiciona unicidade, escopo, datas, conservação entre agregado e ledger, imutabilidade de vínculos, proteção de movimentos e bloqueio de alterações históricas que atinjam meses revisados. Alterações de dieta e localização em mês aberto são novamente verificadas na transação da baixa/confirmacão.

## Operação e validação

O Worker possui processamento agendado a cada 15 minutos, condicionado às duas flags. Só processa dias encerrados, em lotes limitados por execução, com recuperação posterior e idempotência. O cliente de banco da tarefa agendada é isolado e encerrado ao final. No desenvolvimento Node, a recuperação manual permite exercitar o fluxo sem agendador.

Antes de habilitar: reconciliar a linhagem de migrations do ambiente, aplicar a migration da funcionalidade pelo fluxo de migrations do projeto, validar os três modelos com dados próprios de teste e conferir as telas no navegador. Ativar primeiro o recurso com automação desligada; configurar vigências futuras e conferir saldo/valor/partidas antes de habilitar o processamento agendado. Não desligar a flag do recurso com consumos em operação sem um plano de continuidade das consultas e fechamentos.

Validação automatizada cobre calendário, rateio conservador, seleção cumulativa de partidas, idempotência, revisão obsoleta, justificativas, reconciliação sem baixa, ajustes compensatórios, faltas de lastro, período fechado, escopo/visibilidade e submissão da configuração. Testes unitários com doubles não comprovam execução das constraints ou concorrência real no PostgreSQL.

A migration foi validada no PostgreSQL local `fazendinha_seedatev3`, sobre a baseline consolidada. A integração com fixtures próprias verifica os três modelos, processamento concorrente, reenvio idempotente, imutabilidade após revisão e compensação de quantidade/custo. A homologação operacional e a navegação autenticada no navegador permanecem necessárias. Não houve deploy; automação continua opt-in. Para testar localmente, habilite `NUTRICAO_MENSAL_ENABLED=true` após aplicar a migration e use o processamento manual enquanto `NUTRICAO_AUTOMACAO_ENABLED=false`.

### Compatibilidade com produção de leite

O fechamento mensal atende ingredientes do estoque convencional. Dietas com leite de produção própria V5 ficam pendentes, sem baixa automática: exigem o fluxo específico de fornecimento de leite, que conserva origens, natureza e custo de produção. Não configure o mensal para esses lotes até existir adaptação específica; os fluxos anteriores continuam disponíveis nos lotes sem configuração mensal.

## Navegação operacional

Nutrição tem uma única aba **Fechamentos**, com meses para conferência e a consulta **Fechamentos por período** para histórico e lotes ainda sem adoção mensal. O modelo e o prazo aparecem em cada mês. **Configurar nutrição** leva a Configurações → Pecuária → Nutrição → Modelo e prazo de fechamento (`/configuracoes/pecuaria/nutricao/fechamento`). O formulário mantém explicações, escopo por sítio, exceções por lote e vigências. URLs anteriores com `aba=mensal` e `aba=configuracao` são normalizadas, preservando os parâmetros; detalhes históricos e filtros continuam válidos.

## Manejo por lote e configuração

A visão geral conserva o gráfico de lotes com/sem dieta e oferece tabela como padrão na ausência de preferência salva, com alternância para cartões. Situação e programação são filtros junto da busca, não cards adicionais. Ambas as apresentações mostram a dieta vigente e a próxima troca; usuários autorizados atribuem ou trocam diretamente no lote. Receitas publicadas também iniciam a atribuição, com a receita pré-selecionada. O formulário mostra composição por ingrediente/unidade, estimativa com o efetivo atual e início; a atribuição não confirma consumo nem faz baixa. Alertas reúne também lotes sem dieta vigente cadastrada, distinguindo eventual programação futura.

O card de custo médio usa o último mês civil encerrado: custo conhecido dividido pelos animal-dias da mesma base, com `Prisma.Decimal` no servidor. Inclui somente lotes cuja base registrada no recorte está integralmente valorizada; exclui bases vazias, desconhecidas ou parcialmente valorizadas e exibe quantos lotes entraram. Fechamentos anteriores só entram se inteiramente contidos no mês, sem rateio fictício dos que cruzam suas bordas; dias mensais respeitam a data factual. Consumos virtuais/aguardando confirmação não viram custos realizados. Essa média de registros não comprova cobertura alimentar integral. O endpoint `/nutricao/custo-medio` resolve sítio e permissão no servidor e devolve `null` sem permissão de custos.

Em Configurações → Pecuária → Nutrição, o formulário separa aplicação (padrão do sítio ou exceção de lote), modelo de baixa, conferência/vigência e autorização de seleção por validade. Exibe a regra vigente, explica o efeito dos três modelos e exemplifica o prazo no mês seguinte. Uma revisão antecede a escrita, conservando trava contra submissão concorrente, erros e campos. O servidor continua responsável pelas restrições temporais, sobreposições e autorização; a revisão visual não as substitui.

Na configuração, a data de referência é escolhida pelo calendário; seu dia define a recorrência mensal, com vencimento no último dia quando necessário. A vigência é calculada automaticamente: amanhã na primeira ativação ou primeiro dia do próximo mês em alterações. Os campos têm dimensões iguais e o início é somente leitura. A interface usa “lotes de estoque” para identificar os lotes dos produtos.

## Roteiro de homologação operacional

Execute em ambiente de desenvolvimento/homologação, com automação desligada e lotes/produtos de teste identificados. Não reutilize estoque operacional para ensaios. Validação automatizada de serviço não substitui o aceite das pessoas que executarão a rotina.

| Cenário | Ação | Resultado esperado |
|---|---|---|
| Visão por lote | Alternar tabela/cartões, buscar dieta e filtrar sem dieta/programação | Mesmos lotes autorizados, dieta e próxima troca identificáveis; ações respeitam a permissão |
| Atribuição | Selecionar receita publicada e lote; conferir composição e início | Prévia mostra quantidades por unidade, dieta atual, programação e modelo efetivo; falha de consulta impede confirmação |
| Configuração inicial | Selecionar sítio sem configuração e escolher dia no calendário | Vigência automática amanhã; o dia escolhido define a recorrência; revisão mostra escopo e efeito |
| Alteração e exceção | Alterar regra existente ou configurar exceção do lote | Início automático no próximo mês; exceção vigente prevalece; histórico permanece intacto |
| Automático | Processar um dia com 1 animal e 10 kg/dia, custo R$ 2/kg | Uma baixa de 10 kg e R$ 20; confirmar o mês sem diferença não gera outra baixa |
| Manual | Processar dias; confirmar um dia ou vários com quantidades revisadas | Não há baixa antes da confirmação; somente dias selecionados afetam estoque e custo |
| Provisório | Processar consumo diário e conferir o mês | Estimativa afeta saldo estimado; estoque confirmado só muda na confirmação mensal |
| Correção | Reabrir com motivo e corrigir total de 10 kg para 8 kg | Movimento compensatório de 2 kg; total líquido R$ 16; original preservado e justificativa auditada |
| Reenvio/concorrência | Repetir a mesma confirmação e executar chamadas concorrentes | Nenhuma duplicação de estoque/custo; revisão divergente exige reconferência |
| Mudança de efetivo/dieta | Alterar presença ou vigência em uma data e conferir dias afetados | Quantidades seguem animais presentes e dieta factual; base já efetivada exige reconciliação explícita |
| Calendário e alertas | Escolher dia 31 e verificar fevereiro; manter mês sem conferir após o prazo | Vencimento no último dia do mês; pendência fica atrasada até a conferência |
| Pendências de estoque | Ensaiar saldo insuficiente, lote vencido e valor desconhecido | Pendência explicada; nenhuma baixa forçada ou custo desconhecido transformado em zero |
| Custo médio | Consultar base completa, parcial, ausente e custo zero comprovado | Média ponderada apenas sobre a base elegível, com período e cobertura explícitos |
| Acessos | Repetir consultas com perfil restrito e sítio diferente | API impede escrita/escopo indevido e não retorna valores sem permissão |

Antes da liberação, registrar responsável, data, ambiente e evidência de cada cenário; não marcar como homologado com base somente em mocks ou testes unitários. Conferir CI, migration aplicável e flags em staging antes do piloto. Habilitar automação é uma ação separada da publicação do código; acompanhar o primeiro processamento e a primeira conferência mensal.
