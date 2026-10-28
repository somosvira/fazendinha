# Bezerreiro e colostragem

O Bezerreiro reúne participação dos animais, programação por coleira, aleitamento coletivo, acompanhamento de colostragem, banco de unidades congeladas e sanidade. A implementação usa o estoque e os fatos pecuários existentes. Não representa uma nova conta de estoque ou um novo cadastro de animal.

## Estado e validação

O código do módulo e as migrations aditivas do Bezerreiro evoluem a baseline V5. As migrations não foram aplicadas localmente nesta entrega. Disponibilidade operacional depende de sua aplicação e homologação no ambiente autorizado. Testes de serviço/contrato e verificações estáticas de SQL não comprovam execução das funções SQL ou concorrência real em PostgreSQL.

A referência de produto é a [prévia navegável](../design/bezerreiro/index.html), incluindo os comentários consolidados em seu [planejamento](../design/bezerreiro/planejamento.html#implementacao). A prévia usa dados fictícios e armazenamento próprio de sessão; a aplicação consulta a API real.

## Acesso e participação

Bezerreiro é um item de Pecuária na sidebar, com Animais, Alimentação, Colostragem, Sanidade e Custos. A consulta de saídas é independente da lista de presentes. Busca, coleira/fase, período e paginação permanecem na URL dos fluxos correspondentes.

`PerfilBezerreiro` especializa um `Lote` existente. `ParticipacaoBezerreiro` registra animal, perfil, entrada/saída, motivo, autoria e versão; os intervalos são `[desde, ate)`: a data de saída não integra a permanência. A localização do animal precisa comprovar o lote/sítio na data. Incluir um participante exige que ele já esteja no lote; a movimentação usa o fluxo de Rebanho. Não se inventa localização ou participação a partir de idade, nascimento ou compra.

As fases são fatos versionados em `PeriodoFaseBezerreiro`. A ficha apresenta acompanhamento somente quando há participação ou fatos reais de colostragem; após a saída, conserva histórico. Um animal que nunca participou não recebe aba vazia por pertencer a uma categoria etária.

## Configuração e aleitamento

Coleiras possuem nome e cor configuráveis. Fases publicadas conservam dose diária, identificação da coleira e programação de ofertas. A rotina inicial proposta pelo usuário é vermelha 4 L, verde 2 L e amarela 0 L por animal/dia; o formulário pode carregar esses valores, mas não cria cadastros ou seed antes de salvar.

Uma oferta programada tem identidade estável, ordem, percentual diário e horário previsto opcional. Adicionar/Excluir modifica linhas explicitamente e não redistribui as demais silenciosamente. A programação publicada fecha 100% quando há ofertas; dose zero pode não ter ofertas. Rascunhos incompletos não são programação publicada.

O horário previsto não limita o registro. Uma oferta realizada pode ser avulsa, fora do horário ou sem horário conhecido. Data civil e instante ocorrido são separados, com indicação de estimativa quando declarada. Duas ocorrências legítimas podem ter o mesmo horário. Reenvio é identificado pela chave/payload/autoria e vínculos do comando, não pelo relógio.

Previsão soma programações comprovadas por participante e coleira. Falta de programação/localização é pendência, diferente de zero. A previsão emite contextoToken canônico para sítio, perfil, data, permanências, fases e programação. A confirmação envia esse token com o volume coletivo, motivo das diferenças e origens; o servidor compara o contexto sob os locks do comando antes de criar fatos. Trocar participantes mesmo com a mesma dose exige nova conferência. Reenvio de um comando já concluído recupera o resultado original, sem depender de uma previsão posterior. Quantidades por animal são atribuídas com base explícita; não são ingestão individual aferida.

Leite não comercial disponível tem prioridade; comercial completa a necessidade, respeitando saldo e origens. Descarte físico já consumado não está disponível. Colostro segue fluxo próprio. O adaptador cria `ItemFechamentoConsumo` vinculado ao grupo da oferta, sem fechamento ou animal-dias fictícios, e reutiliza `FornecimentoNutricionalLeite` e seus movimentos. Fechar a Nutrição não pode repetir esse consumo. Sobreposição entre ofertas e fechamento convencional exige conciliação explícita: não se calcula um abatimento automático usando doses previstas. A parcela leiteira sobreposta é recusada antes da gravação; outros ingredientes podem seguir com a parcela de leite explicitamente zerada e justificada. Consumo adicional legítimo no Bezerreiro exige declaração e motivo, conservados no snapshot. A verificação considera animais, presença no lote e período, nas duas ordens de registro, e compartilha lock por sítio com os estornos.

Transição por idade/peso é configurável como critério e permanece manual; não há limiar ou automação clínica presumida. Fatos realizados não são recalculados por mudança de fase. A decisão sobre o alcance coletivo da vigência depois de uma oferta ainda exige definição antes de automatizar a troca no mesmo dia.

## Retirada vinculada ao parto

No parto ou em Colostragem, registrar uma retirada identifica parto produtor, matriz, data/hora conhecida, primeira/seguinte declarada, volume e origem física. Pode vincular uma produção existente compatível ou criar parcela por meio do núcleo de ordenha. Uma produção não vira duas origens disponíveis.

Origem biológica e local físico são distintos. Tanque cadastrado é uma relação versionada; outro recipiente é identificado conforme o contrato da produção geral. Quando se vincula produção existente, herdam-se tanque/recipiente e versão. Não se cria cadastro fictício de recipiente, parto ou animal para preencher o formulário. Naturezas diferentes preservam segregação física.

Salvar retirada/medição não confirma entrada de estoque. A confirmação é ação explícita, com versão esperada e idempotência. Somente a entrada confirmada disponibiliza saldo para destinação. Corrigir uma medição ainda sem entrada pode tornar obsoleta sua retirada rascunho: regularizar exige estornar a retirada antiga com motivo e versão, preservando seu snapshot, e registrar novo vínculo com nova chave. A exclusividade é do vínculo ativo; estorno não apaga a produção nem impede sua reutilização corrigida. Registros anteriores sem vínculo comprovado não recebem parto por backfill presumido.

## Brix e destinação

O Brix do colostro usa formato real versionado do núcleo de Qualidade, com campo e unidade explícitos e histórico. Referência inicial configurável: **maior ou igual a 25%**. Fornecimento abaixo da referência ou sem leitura exige motivo e responsável. A exceção não altera o resultado ou cria aprovação sanitária.

Destinação permite consumo direto da cria, congelamento ou ambos na mesma transação. O formulário permite escolher novo fornecimento ou vincular registro existente compatível da cria. A seleção conserva data/hora conhecida e volume do fato, com busca paginada e resolução do ID selecionado fora da página. O servidor revalida status, sítio na data, cronologia e ausência de origem ativa; não duplica litros já consumidos. A cria destinatária pode ser de outra matriz. O peso e a política usados para referência de volume permanecem no histórico; 10% é referência configurável, não quantidade automaticamente confirmada.

`LoteColostro` vincula parto/matriz e produção. `OrigemColostro` identifica lote bruto ou resultado de enriquecimento, exclusivamente. As alocações conservam quantidade e vínculos com os fornecimentos reais. A destinação exige período financeiro aberto antes de qualquer escrita, inclusive origem enriquecida, unidade retirada e congelamento. Banco e destinação operam sobre o mesmo saldo físico compartilhado; entradas geridas pelo colostro não podem ser consumidas por uma saída genérica que ignore suas reservas.

## Banco e enriquecimento

O banco fica abaixo da colostragem. Cada unidade congelada tem 2 L, código, origem, tipagem, versão e histórico. Enriquecido/não enriquecido é distinto de Brix medido, pendente ou abaixo da referência. Registrar unidade exige origem já registrada e volume livre; não gera produção.

Enriquecer é uma ação de uma origem não enriquecida existente. O registro conserva quantidades de origem, unidades retiradas, insumos/produto/partida, responsável e volume final medido. Não há receita automática ou dedução do resultado Brix pelo produto utilizado. O preparo cria uma nova origem enriquecida e consome o saldo anterior uma vez. O núcleo de estoque confere saldo, partida, validade e período dos insumos.

Congelar porções de 2 L conserva o remanescente livre: por exemplo, volume final de 2,2 L permite uma unidade de 2 L e sobra 0,2 L. Não fabricar outra unidade por arredondamento ou recongelar mediante simples troca de status. Detalhes de destinação e enriquecimento conservam vínculos, autoria, códigos e dependências. Estornos exigem motivo/versão e preservam fatos; origem consumida exige regularização dos destinos antes da anulação, sem cascata automática. Se a destinação apenas vinculou fornecimento pré-existente, seu estorno remove a atribuição da origem sem anular esse fornecimento.

## Exame da cria e sanidade

Acompanhamento da imunidade reutiliza `ExameAnimal`, `TipoExame`, formatos e resultados versionados. IgG sérica/plasmática, proteína total sérica e Brix sérico são métodos/resultados distintos. O limiar do Brix do alimento não é aplicado ao sangue. Método não identificado permanece pendente; não converter para IgG nem diagnosticar automaticamente.

O acompanhamento é único por animal e sítio. Uma transferência permite novos fatos no sítio de destino, conservando IDs, exames, fornecimentos e políticas do acompanhamento anterior no seu escopo. O vínculo de exame conserva animal, sítio, método/material quando informados, resultado/unidade do formato original e política vista. Resultados e laudos individuais continuam acessíveis na ficha do animal. Sanidade consulta os fatos comuns dos participantes durante a permanência e usa os formulários e procedimentos existentes, incluindo protocolos, vacinas e ocorrências, sem duplicá-los no Bezerreiro.

## Custos e permissões

Alimentação inclui os custos efetivos das origens de leite consumidas, outros alimentos comprovados e colostro/enriquecedores consumidos. Sanidade usa apenas custos vinculados aos bezerros durante a participação, com classificação/prova existentes. Não ratear despesas gerais, inventar custo completo ou tratar descarte como gratuito. Custos nutricionais usam o período efetivo de consumo: o fim do fechamento não exclui uma participação anterior. Valores já atribuídos são conservados quando o período ou seus segmentos comprovados cabem integralmente no recorte. Se faltar prova para separar um recorte parcial, o componente permanece pendente, sem divisão presumida pelos dias.

Custos desconhecidos são pendências. Apuração posterior pode atualizar a leitura derivada sem repetir volume, despesa ou caixa. Atribuições conservam litros e centavos e permanecem rotuladas. Alimentação e Sanidade são conjuntos exclusivos: uma fonte nutricional classificada como SANIDADE integra somente o componente sanitário. A identidade inclui o item/natureza do componente para conservar ingredientes distintos da mesma participação. Referência comercial R07 é separada do custo real; referência sem fonte comprovada permanece pendente. Receita do futuro animal e retorno de futura lactação ficam fora deste módulo.

Seletores de partos e crias usam busca/paginação, data do fato e resolução do ID selecionado; 100 registros não definem o universo elegível. Cria transferida conserva sua elegibilidade comprovada na data sem expor os dados maternos de outro sítio. Conflitos de versão mantêm o rascunho; atualizar contexto não grava, e adotar a versão atual exige nova conferência explícita. Respostas de contexto anterior são descartadas.

A API em `/api/pecuaria/rebanho/bezerreiro` exige área Pecuária e sítio; comandos exigem `lancar`. O servidor resolve o escopo e valida versões, vínculos e autoria. `verValores` e acesso financeiro são conferidos também em consultas auxiliares e DTOs. Ocultar ação na interface não substitui o gate.

## Implementação e homologação

Rotas ficam em `server/src/routes/pecuaria/bezerreiro.ts`; serviços/cálculos/schemas em `server/src/services/pecuaria/bezerreiro`; interface em `client/src/pecuaria/rebanho/bezerreiro`. A migration acrescenta integridade de intervalos, programa publicado, origem, conservação, reservas e autoria, sem alterar a baseline aplicada.

Critérios de homologação incluem parto → 6 L retirados → Brix 27% → 4 L para a cria + uma unidade de 2 L; reenvio e concorrência sem duplicação; enriquecimento com sobras; leitura sem valores; correções/estornos; retomada de rascunho; navegação por URL; histórico após saída; desktop/celular e teclado. Integração real somente em `fazendinha_seedatev3`, com fixtures próprias e autorização de aplicação da migration; sem reset ou banco auxiliar.
