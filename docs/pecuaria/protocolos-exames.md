# Protocolos, exames e papéis reprodutivos

Contrato da base comum de Sanidade e Reprodução. Complementa [Reprodução V4](reproducao.md) e o [contrato geral](README.md). A finalidade do protocolo é independente da ação de uma etapa: um protocolo reprodutivo pode conter aplicação sanitária, exame sanitário, tentativa, avaliação reprodutiva, manejo ou retirada.

## Estado da implementação

O fluxo unificado para protocolos sanitários e reprodutivos, individuais e coletivos, está implementado localmente e permanece em validação. A migration aditiva `20261019190000_eventos_tarefas_protocolos` foi aplicada em `fazendinha_seedatev3`. O roteiro manual não está homologado; não há confirmação de homologação de campo ou publicação em produção.

## Referências e registro da entrega

A [base documental dos protocolos](artefatos/protocolos/index.html) reúne explicação de domínio, diagramas, catálogo físico e mockup. O catálogo é uma fotografia dos metadados de `fazendinha_seedatev3` em 19/10/2026; não atesta outros ambientes nem homologação.

O [registro da entrega local](plano-protocolos-unificados.md) aponta o escopo e os limites operacionais. As regras implementadas abaixo formam o contrato vigente.

## Estrutura e identidade

- `Protocolo`: versão do modelo, com `tipo` SANITARIO/REPRODUTIVO, publicação, atividade e autoria. O contexto da tela determina o tipo; não há seletor de tipo para o usuário.
- `EtapaProtocolo`: ação e parâmetros da versão, ordem, intervalo/unidade, referências a Produto, material ou tipo de exame. Configuração específica e referências históricas ficam preservadas.
- `ProgramacaoProtocolo`: grupo que usa uma versão em um sítio, com referência de início. Corresponde ao ciclo sanitário ou à programação IATF na interface.
- `ParticipacaoProtocolo`: animal, versão, sítio, referência prevista, início efetivo quando conhecido e encerramento. `programacaoId` é opcional nos dois tipos: a participação individual não exige grupo; não se infere agrupamento por lote ou data.
- `TarefaProtocolo`: uma ação prevista de uma participação, com etapa, calendário, precisão, planejado, realizado, diferenças, dispensas e históricos.
- `VinculoTarefaProtocolo`: execução ligada a aplicação, exame ou tentativa. Cada ligação conserva sua ordem, autoria, origem, estado e motivo. O vínculo atual é único; substituições preservam os anteriores. A data de criação do fato não determina qual substituto está vigente.
- `EventoTarefaProtocolo`: histórico operacional por tarefa para `NAO_ATENDIDO`, `ADIAMENTO` e `RETIFICACAO_JUSTIFICATIVA`. Registra data do acontecimento, motivo, autoria e, no adiamento, previsão/precisão anterior e nova; uma retificação referencia evento anterior da mesma tarefa. O fluxo é append-only e o trigger recusa UPDATE; correções são novos eventos. O evento não substitui vínculo de atendimento nem cria fato clínico.

`ParticipacaoProtocolo.origemCalendario` distingue `REFERENCIA_PROGRAMADA` de `INICIO_EFETIVO_LEGADO`. A coluna classifica a regra usada pela participação; a migration preservou previsões, precisões e snapshots existentes, sem recalcular histórico. A regra `INICIO_EFETIVO_LEGADO` mantém a interpretação do calendário das participações reprodutivas já migradas; novas participações usam `REFERENCIA_PROGRAMADA`. Inícios obtidos de uma execução com lastro só preenchem participações da origem programada ainda sem início efetivo. Para uma participação legada sem início, a prévia de recálculo é somente leitura; quando houver tarefas a recalcular, a confirmação exige ciência explícita. Ela mostra as previsões afetadas, conserva tarefas realizadas/dispensadas e registra as mudanças no histórico. Se já houver execução anterior incompatível, o fluxo bloqueia em vez de reescrever o fato.

Uma programação continua sendo coletiva mesmo com um participante; o modo vem da forma explícita de criação, não da contagem atual. `programacaoId = NULL` representa a participação individual. Lote ajuda a seleção inicial, sem inscrever ou retirar participantes automaticamente depois; usar os mesmos animais em outro protocolo cria nova programação e novas participações. Não há turma permanente compartilhada entre protocolos.

Há uma estrutura física para cada conceito. `ProtocoloIatf`, `ProgramacaoIatf`, `ParticipanteIatf` e `TarefaIatf` são views de leitura para os contratos anteriores. `AvaliacaoReprodutiva` também é uma view, sobre exame e interpretação. O Prisma não oferece escrita nessas views. Rotas/DTOs antigos, nomes de auditoria e envelopes de reenvio permanecem por compatibilidade, sem outra fonte operacional.

Os campos Prisma `diaRelativo`, `rodadaId`, `inicio`, `execucaoId`, `previstaPara`, `parametros` e `motivoDispensa` usam `@map` para as colunas físicas `intervalo`, `programacaoId`, `inicioReferencia`, `participacaoId`, `previstaEm`, `planejadoSnapshot` e `motivo`. São aliases internos dos consumidores V3, não colunas ou tabelas duplicadas.

## Versões, calendário e execução

Rascunho pode ser editado; versão publicada ou utilizada exige outra versão. Inativar impede novas programações sem invalidar participantes ou fatos existentes. Publicação valida parâmetros e referências; novas versões têm tarefas e snapshots próprios. Publicação histórica sem instante conhecido não ganha uma data inventada.

A edição de rascunhos e a derivação de versões reprodutivas enviam apenas os parâmetros editáveis das etapas. As referências congeladas que acompanham a leitura não são reenviadas como campos do cadastro; publicação e tarefas anteriores conservam seus snapshots.

A precisão DIA conserva apenas a data dos registros sanitários anteriores. Na IATF, data é obrigatória e horário opcional. A precisão HORA conserva o instante quando informado, incluindo frações de intervalo quando admitidas; DIA conserva somente o dia. `precisaoInicioEfetivo` e `precisaoRealizacao` são independentes da precisão da previsão. Etapas em horas ou dias fracionados sem início com hora ficam com `previsaoPendente`, sem atraso presumido, até previsão explícita ou realização. Veja [horário opcional](reproducao.md#horário-opcional-na-iatf). O início previsto não comprova início efetivo. Nas participações novas, os intervalos se ancoram na referência programada; a primeira realização preenche o início efetivo sem deslocar as próximas etapas. Participações reprodutivas legadas conservam a âncora no início efetivo individual e exigem a prévia e ciência descritas acima quando o primeiro atendimento recalcular previsões. Reagendamento explícito conserva a previsão original e o motivo. Atraso de uma execução não desloca as seguintes. Retirada encerra pendências e reentrada cria outra participação.

O núcleo em `services/pecuaria/protocolos/` reúne calendário (`calendario.ts`), eventos (`eventos.ts`), vínculo (`vinculos.ts`) e leitura/estados (`operacao.ts`, `operacao.dto.ts`, `operacao.escopo.ts`). `routes/pecuaria/protocolos-operacao.ts` publica consultas e ações com validação Zod, sessão, área, permissão e escopo do sítio; as rotas sanitárias e reprodutivas existentes mantêm adaptadores e aliases legados. As consultas retornam cabeçalhos, etapas, tarefas, eventos e procedimentos paginados, com teto de dez por página. Busca, filtros e escopo vêm antes da contagem e da seleção da página; a ordem é determinística e páginas inválidas são reconduzidas ao último índice válido. Totais e resumos representam o conjunto autorizado completo, não a página visível. O início individual reprodutivo cria participação sem programação; a prévia não inscreve o animal. Na tela coletiva, a seleção é por identidade de tarefa e continua entre páginas; confirmar mais de cem itens é bloqueado, sem divisão automática de uma operação atômica em lotes. Não há coluna genérica `status` em `TarefaProtocolo`: a situação é projetada nesta precedência: regularização pendente; encerrada sem substituição; fato válido/atendimento; retirada ou dispensa; último evento de adiamento/não atendimento; então prevista ou sem registro. Retificação substitui o motivo apresentado sem apagar o evento original. “Atrasada” é um filtro temporal separado e não uma situação clínica. Confirmações e escritas preservam transação, autoria, idempotência e reconsulta de conflito. Desvio não aferível exige justificativa; ausência de snapshot não prova conformidade.

A tela comum reúne seleção de etapa, animais e pendências na mesma seção recolhível; o individual apresenta tarefas do animal, sem nome de turma obrigatório. O detalhamento do atendimento aparece abaixo da linha de origem e os procedimentos/custos ficam na seção final. Listas IATF, gestão de participantes e vínculos coletivos da ficha usam leituras paginadas no servidor, sem baixar árvores completas de tarefas. A origem de uma tentativa/avaliação no histórico da ficha é consultada sob demanda por fato autorizado, incluindo vínculos substituídos e fatos anulados; falha de leitura não é apresentada como ausência de vínculo. Links preservam animal, participação, sítio, aba e retorno.

`ParticipanteVisita.tarefaId` aponta para a tarefa comum. Os campos `tarefaSanitariaId`/`tarefaIatfId` continuam como aliases de entrada/saída no limite HTTP e na apresentação conforme a atividade; não são duas relações físicas. Uma linha não admite as duas referências. Impressões e snapshots antigos conservam os identificadores originais.

Anulação deixa o atendimento/tarefa dependente de regularização. Reabertura exige ausência efetiva do procedimento e efeitos físicos compatíveis; consumo mantido impede repetir a baixa. Substituição vincula fato válido do mesmo tipo, animal, sítio e data, sem nova execução ou despesa. A ligação anterior continua consultável. A agenda sanitária distingue REGULARIZACAO_PENDENTE, ENCERRADA_SEM_SUBSTITUICAO, REALIZADA e PENDENTE; seus filtros e contagens usam a mesma regra. Anular não autoriza repetir automaticamente. O sítio da regularização vem do fato no último vínculo, mesmo após transferência do animal. Substitutos já usados por outra tarefa/atendimento não são oferecidos. O histórico fica disponível nas tarefas da agenda e do ciclo. Sugestões e inclusão em visitas usam a mesma pendência real: tarefas realizadas, encerradas ou aguardando regularização não são oferecidas para nova execução; a lista sanitária também restringe o tipo do protocolo.

Reabrir também exige participação/programação aberta, tarefa não dispensada e ausência de visita encerrada entre os atendimentos confirmados vinculados. A operação limpa a referência operacional e os snapshots da realização, conservando-os no histórico; reabre os atendimentos vinculados, incrementa a versão de rascunho e preserva impressões. Vincular substituto ou encerrar a regularização não reabre uma visita encerrada. A validação e as escritas acontecem na mesma transação, com chave de reenvio. Eventos operacionais também usam chave de reenvio; não atendimento não registra aplicação, exame, serviço ou movimento de estoque. Não se convertem ausências históricas em eventos: sem evento permanece sem registro, e uma execução válida posterior passa a prevalecer na projeção sem apagar o evento anterior. Adiamento atualiza somente a previsão da tarefa escolhida e mantém `previsaoOriginal`; o registro de eventos não altera outros animais nem desloca etapas seguintes.

## Exame e interpretação

`TipoExame` define o contexto SANITARIO/REPRODUTIVO/COMPARTILHADO e uma versão de formato. Uma realização em `ExameAnimal` guarda animal, sítio, data, responsável, autoria, finalidades, realização/não realização, anotação original e snapshot do formato. `ResultadoExame` permite várias observações estruturadas na mesma realização: campo, valor, unidade e autoria.

Formatos históricos TEXTO/NUMERO/OPCAO conservam os campos escalares existentes; o formato MULTIPLO usa as observações. O banco impede misturar resultado escalar e estruturado na mesma realização. Resultado ausente é diferente de zero, falso e negativo. Correção de resultado conserva as observações substituídas e audita o antes/depois, usando o formato da coleta.

O formato fica bloqueado após coleta, mesmo pendente/anulada, ou referência em versão publicada/utilizada de protocolo. “Nova versão” cria outro TipoExame, vinculado por `versaoAnteriorId`, com número de formato reservado de modo concorrente. Coletas, tarefas e planos anteriores mantêm a referência e o snapshot anteriores. Renomear ou inativar não reescreve o histórico.

O plano de avaliação da etapa reprodutiva aceita `tipoExameId` e finalidade independentes. Ao publicar, congela o tipo, número da versão e campos; tarefas herdam essa referência. Planos antigos sem esse campo mantêm o tipo padrão, sem reescrever seus snapshots/envelopes de reenvio. A execução usa o tipo planejado quando omitido; trocar explicitamente o tipo exige motivo de desvio, sem prever qual será a conclusão clínica. Novos fatos exigem tipo ativo; um tipo inativado continua legível no histórico.

Na transcrição coletiva, cada animal pode escolher o tipo de exame e preencher suas observações adicionais. Conclusão gestacional e sexo fetal continuam nos campos clínicos próprios. Rascunhos preservam o tipo e os valores, incluindo zero/falso. O servidor registra e confere a assinatura do formato; se um formato ainda sem uso mudar entre o preenchimento e a confirmação, exige atualizar/revisar o formulário. A assinatura não substitui validação clínica nem autorização. A confirmação mantém atomicidade do subconjunto e reenvio idempotente.

Na avaliação reprodutiva, finalidade (diagnosticar, reconfirmar ou sexar), conclusão gestacional, sexo fetal e conduta são informações independentes. Confirmação e sexo podem ocupar a mesma realização. “P+”, “OK” e “M/F” são anotações da fazenda, não o catálogo obrigatório. Texto desconhecido permanece texto. Campos clínicos têm códigos semânticos explícitos; mudar um rótulo ou adicionar observação não cria efeitos clínicos automáticos.

`InterpretacaoReprodutiva` liga a evidência à tentativa, gestação e eventual restrição/retorno. Ela não repete data, animal, sítio ou resultado. O executor reprodutivo abre/reconfirma gestação e atualiza sexo fetal somente após validar a cronologia. Negativo diante de gestação conhecida exige revisar perda/diagnóstico anterior. Correção/anulação de exame com interpretação passa pela revisão dos efeitos reprodutivos, na mesma transação; o endpoint sanitário genérico recusa contornar essa revisão.

## Papel e regras compartilhadas

`PeriodoReprodutivoAnimal` é a fonte do papel por data: NENHUM, DOADORA ou RECEPTORA, com intervalos [início, fim), origem, autoria e revogação. `DestinoAnimal` mantém a aptidão leite/corte. O papel é independente da situação gestacional e do descarte. Ausência não vira NENHUM; períodos incompatíveis produzem CONFLITO e não escolhem automaticamente filiação ou filtro. A mudança de aptidão sem informar papel conserva o papel existente/desconhecido. Desfazer conserva os períodos revogados e a auditoria.

A migração reúne períodos importados e valores de destino preservando a linha original em proveniência, sem conciliar conflitos por suposição. A genética da doadora e a identidade gestacional da receptora continuam distintas; a conversão não recalcula pedigree.

Paridade usa `rebanho/partos.calc.ts`. Execuções que consomem material continuam nos executores pecuários e em `consumo.ts`, com saldo, lote/validade, custo Decimal, período financeiro e movimento atômico; não atendimento e adiamento não consomem estoque. `custos/estimativa-protocolo.ts` estima quantidades planejadas usando a valorização atual do estoque do sítio, sem reservar ou baixar saldo; preço/quantidade ausente e serviço sem referência permanecem não apurados, e despesas gerais ficam fora. `custos/custos.ts` agrega os custos reais dos fatos vinculados com deduplicação e atribuição de preparos. A autorização de valores e documentos segue as permissões pecuárias/financeiras vigentes. `desvios.calc.ts` compartilha a comparação e a exigência de motivo; `requisicoes.ts` compartilha trava, identidade, conflito e gravação do reenvio sem alterar formatos/hash históricos ou ocultação de custos.

## Configurações e operação

Configurações → Pecuária → Reprodução reúne protocolos reprodutivos, tipos de exame reprodutivo e regras sanitárias por doença, além de atalhos aos cadastros existentes de materiais genéticos, genitores externos e Produtos. Sanidade usa a mesma base pelos seus cadastros. As rotinas de Reprodução/IATF mantêm programação, início, execução e acompanhamento, com atalhos para manutenção. URLs e filtros anteriores são conservados.

### Orientação temporal opcional por etapa

Informar a hora de uma realização não transforma a etapa em uma exigência de precisão horária. O follow-up admite `orientacaoTemporal` explícita na configuração da etapa e no snapshot publicado: referência ao início efetivo ou à etapa anterior, intervalo em horas, tolerância anterior/posterior e efeito ALERTA. O planejamento por dias continua disponível sem essa orientação.

Quando configurada, a orientação é avaliada separadamente da precisão registrada: dentro da janela, fora da janela ou não aferível. Referência ou realização sem hora conhecida não recebe horário fictício nem conformidade presumida. Uma etapa anterior anulada ou aguardando regularização não fornece uma realização válida apenas porque conserva sua data histórica. Atraso não desloca outras etapas automaticamente. Registrar o fato conserva os desvios e justificativas aplicáveis, respeitando bloqueios já existentes.

### Biblioteca de referências

A biblioteca pesquisável apresenta referências técnicas com fonte, data/versão, objetivo, população indicada e campos que precisam ser completados. O catálogo inicial contém a referência Ovsynch 56, ficha Wisconsin de 15/04/2021, página 24. É um ponto de partida documental, sem indicação automática para um animal, produto ou dose.

Copiar exige nome e versão e cria um `Protocolo` em rascunho, com `referenciaTecnica` preservada. Configurar, publicar e adotar são ações distintas. A derivação de nova versão conserva a referência por vínculo explícito à versão de origem; semelhança de nome não prova proveniência. A publicação continua exigindo os parâmetros operacionais do núcleo comum. Nenhum modelo é apresentado como importado do IDEAGRI sem evidência de sua origem; IDEAGRI permanece transferência inicial de dados.

### Demandas e tarefas existentes

As políticas e demandas de DG/reconfirmação estão descritas no [contrato reprodutivo](reproducao.md#diagnóstico-e-reconfirmação-configuráveis). Elas se vinculam às tarefas e exames comuns; não criam um segundo executor de protocolo. Realização da tarefa e resolução clínica da demanda são estados diferentes. Um exame inconclusivo não satisfaz a demanda apenas por ter concluído a tarefa.

## Migração e retorno

As migrations `20261014140000` a `20261014180000` convertem a estrutura em transações, preservam IDs quando possíveis e registram `legadoIatfId` quando há colisão. A migration aditiva `20261019190000_eventos_tarefas_protocolos` acrescenta o histórico operacional e `origemCalendario`; sua classificação não recalcula previsões nem reescreve fatos, vínculos, snapshots ou auditoria histórica. Os aliases e views IATF seguem compatíveis para leitura/entrada antiga; a escrita operacional permanece no núcleo comum, sem escrita direta nas views. Aplicações, exames, tentativas, visitas e vínculos técnicos passam a referenciar a identidade comum. Impressões, auditorias, payloads e respostas de reenvio antigos permanecem intactos. Resolutores aceitam os IDs reprodutivos anteriores nos fluxos operacionais; a conversão não executa fatos, estoque, financeiro ou diagnósticos novamente.

Antes de aplicar em outro ambiente: executar `pnpm --filter rionovo-server previa:pecuaria:padronizacao` e conferir conflitos/contagens/referências e a recuperação prevista. No desenvolvimento local, aplicar somente em `fazendinha_seedatev3`, sem criar outro banco ou clone para ensaio. A prévia só lê o banco e informa tabelas/views, colisões, papéis conflitantes e arquivos incompletos. A migração interrompe divergências e vínculos incompatíveis. Arquivos incompletos continuam arquivados; não recebem publicação, horário ou tarefas presumidas.

Código e migrations devem ser publicados em janela coordenada: o código antigo não escreve nas novas views. Após iniciar escritas no modelo comum, retornar somente o código antigo é incompatível. Retorno exige interromper escritas e restaurar o backup compatível, conciliando os fatos posteriores; não existe down migration que descarte esses fatos automaticamente. Não executar seed, reset ou carga IDEAGRI para viabilizar a mudança.

A remoção de `public.RegistroChuva` usa uma migration independente, sem CASCADE, que recusa tabela com registros. `btree_gist` e as garantias SQL dos outros domínios permanecem.

A migration complementar `20261014180000` preenche metadados de realização e regularização das tarefas sanitárias históricas pelo último vínculo, sem executar fatos novamente. Usa a data original com precisão DIA; registra separadamente o momento da conferência e conserva anulações, motivos, consumo e impressões. Tarefas dispensadas/participações canceladas não são reabertas pela migração.

## Integração com visitas, elegibilidade e relatórios

As visitas usam tarefas comuns em `ParticipanteVisita`, seleções dinâmicas versionadas e snapshots de impressão. A transcrição individual pode usar o tipo de exame da tarefa; a coletiva preserva campos personalizados por animal. A confirmação é por subconjuntos de até 100 participantes. A indicação de IATF abre a programação, sem iniciar o protocolo.

A atividade de início reprodutivo conserva a versão publicada na preparação e resolve a participação somente ao confirmar. Sem pendência compatível, cria `ProgramacaoProtocolo`, `ParticipacaoProtocolo` e tarefas pelo núcleo comum, na mesma transação do início. O vínculo da programação criada em `AtividadeVisita.contexto.inicioIatf` é controlado e validado pelo servidor e reutilizado entre blocos. Não há escrita nas views IATF nem efeito em estoque ou tentativas pelo simples início. Reutilização, ambiguidade, dados antigos e precisão temporal seguem o [contrato de IATF](reproducao.md#iatf).

Elegibilidade reprodutiva não tem padrão clínico presumido. `PoliticaElegibilidadeReprodutiva` guarda versões por sítio/vigência; `VinculoPoliticaCiclo` congela a versão no ciclo; `DecisaoElegibilidadeCiclo` registra liberação ou exceção com evidência. Ciclos em sítios nunca configurados exigem setup e vínculo explícitos, sem aplicação retroativa silenciosa. Relatórios PARTOS e INDICADORES persistem emissões em `SnapshotRelatorioReprodutivo` para reimpressão auditável. O contrato de [Reprodução V4](reproducao.md) descreve metodologia e limites.

## Validação

Para esta entrega, a migration `20261019190000_eventos_tarefas_protocolos` está aplicada somente no banco autorizado `fazendinha_seedatev3`. A conferência do catálogo físico consultou apenas `pg_catalog` em transação somente leitura, sem consultar registros de animais, usuários ou atendimentos. O código e seus builds foram verificados localmente; a revisão visual final ainda está em andamento. O roteiro manual não está homologado, e não há confirmação de homologação de campo ou publicação em produção.

A validação da padronização anterior incluiu testes/builds, typechecks de seed/importação e integrações locais com fixtures próprias em `fazendinha_seedatev3`. As migrations do follow-up estão aplicadas no mesmo `fazendinha_seedatev3`, com abertura documentada dos saldos demonstrativos legados e preservação de movimentos/manifesto. A validação usa testes unitários e integrações locais selecionadas com fixtures próprias; a bateria restrita ao CI externo permanece separada; seu estado consta no [HTML da entrega](artefatos/follow-up-v4-entrega.html). O alinhamento não exige reset, recarga de seed, banco auxiliar ou backup. Homologação da rotina pela fazenda permanece separada e pendente.

O [HTML de conceitos](artefatos/conceitos-v4.html) apresenta o modelo implementado e sua relação com as telas, inclusive os fluxos novos de visita, parto, elegibilidade e relatórios. O [roteiro manual](artefatos/testes-v4-guia.html) mantém as marcações anteriores e acrescenta casos de padronização pendentes. Homologação pela fazenda permanece pendente.

Resultados estruturados de exames (`resultados[].valor`) são dados clínicos e permanecem legíveis no detalhe e no histórico, inclusive zero, falso e JSON composto. A máscara financeira não altera esses resultados; valores financeiros irmãos e documentos continuam sujeitos às permissões correspondentes.

### Apresentação operacional

A timeline da participação é compartilhada pela ficha e pela página de programação IATF. Os marcos usam toda a largura útil entre o primeiro e o último; contêiner estreito muda para apresentação vertical. A aparência não altera o estado da tarefa: previsão pendente, início desconhecido, dispensa, execução, encerramento e regularização continuam baseados nos registros comuns. A página própria mantém os mesmos executores e o painel autorizado do sítio; abrir o detalhe não cria participação ou tarefa.
