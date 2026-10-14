# Protocolos, exames e papéis reprodutivos

Contrato da base comum de Sanidade e Reprodução. Complementa [Reprodução V4](reproducao.md) e o [contrato geral](README.md). A finalidade do protocolo é independente da ação de uma etapa: um protocolo reprodutivo pode conter aplicação sanitária, exame sanitário, tentativa, avaliação reprodutiva, manejo ou retirada.

## Estado da implementação

A regularização sanitária e a seleção de exames personalizados foram concluídas na base comum, incluindo agenda, planejamento, snapshots, execução individual e transcrição coletiva. Homologação de campo e aplicação em produção permanecem etapas distintas e não foram realizadas por esta alteração.

## Estrutura e identidade

- `Protocolo`: versão do modelo, com `tipo` SANITARIO/REPRODUTIVO, publicação, atividade e autoria. O contexto da tela determina o tipo; não há seletor de tipo para o usuário.
- `EtapaProtocolo`: ação e parâmetros da versão, ordem, intervalo/unidade, referências a Produto, material ou tipo de exame. Configuração específica e referências históricas ficam preservadas.
- `ProgramacaoProtocolo`: grupo que usa uma versão em um sítio, com referência de início. Corresponde ao ciclo sanitário ou à programação IATF na interface.
- `ParticipacaoProtocolo`: animal, versão, sítio, referência prevista, início efetivo quando conhecido e encerramento. `programacaoId` é opcional para preservar participações sanitárias históricas sem grupo; não se infere agrupamento por lote ou data.
- `TarefaProtocolo`: uma ação prevista de uma participação, com etapa, calendário, precisão, planejado, realizado, diferenças, dispensas e históricos.
- `VinculoTarefaProtocolo`: execução ligada a aplicação, exame ou tentativa. Cada ligação conserva sua ordem, autoria, origem, estado e motivo. O vínculo atual é único; substituições preservam os anteriores. A data de criação do fato não determina qual substituto está vigente.

Há uma estrutura física para cada conceito. `ProtocoloIatf`, `ProgramacaoIatf`, `ParticipanteIatf` e `TarefaIatf` são views de leitura para os contratos anteriores. `AvaliacaoReprodutiva` também é uma view, sobre exame e interpretação. O Prisma não oferece escrita nessas views. Rotas/DTOs antigos, nomes de auditoria e envelopes de reenvio permanecem por compatibilidade, sem outra fonte operacional.

Os campos Prisma `diaRelativo`, `rodadaId`, `inicio`, `execucaoId`, `previstaPara`, `parametros` e `motivoDispensa` usam `@map` para as colunas físicas `intervalo`, `programacaoId`, `inicioReferencia`, `participacaoId`, `previstaEm`, `planejadoSnapshot` e `motivo`. São aliases internos dos consumidores V3, não colunas ou tabelas duplicadas.

## Versões, calendário e execução

Rascunho pode ser editado; versão publicada ou utilizada exige outra versão. Inativar impede novas programações sem invalidar participantes ou fatos existentes. Publicação valida parâmetros e referências; novas versões têm tarefas e snapshots próprios. Publicação histórica sem instante conhecido não ganha uma data inventada.

A precisão DIA conserva apenas a data dos registros sanitários anteriores. Na IATF, data é obrigatória e horário opcional. A precisão HORA conserva o instante quando informado, incluindo frações de intervalo quando admitidas; DIA conserva somente o dia. `precisaoInicioEfetivo` e `precisaoRealizacao` são independentes da precisão da previsão. Etapas em horas ou dias fracionados sem início com hora ficam com `previsaoPendente`, sem atraso presumido, até previsão explícita ou realização. Veja [horário opcional](reproducao.md#horário-opcional-na-iatf). O início previsto não comprova início efetivo. Os intervalos da IATF são ancorados no início efetivo individual; reagendamento explícito conserva a previsão original e o motivo. Atraso de uma execução não desloca as seguintes. Retirada encerra pendências e reentrada cria outra participação.

O núcleo em `services/pecuaria/protocolos/` reúne versões, calendário e vínculo das execuções. Os executores específicos continuam validando os parâmetros e efeitos de cada ação. Confirmação mantém atomicidade, sítio na data do fato, autorização, autoria e reenvio idempotente. Desvio não aferível exige justificativa; ausência de snapshot não prova conformidade.

`ParticipanteVisita.tarefaId` aponta para a tarefa comum. Os campos `tarefaSanitariaId`/`tarefaIatfId` continuam como aliases de entrada/saída no limite HTTP e na apresentação conforme a atividade; não são duas relações físicas. Uma linha não admite as duas referências. Impressões e snapshots antigos conservam os identificadores originais.

Anulação deixa o atendimento/tarefa dependente de regularização. Reabertura exige ausência efetiva do procedimento e efeitos físicos compatíveis; consumo mantido impede repetir a baixa. Substituição vincula fato válido do mesmo tipo, animal, sítio e data, sem nova execução ou despesa. A ligação anterior continua consultável. A agenda sanitária distingue REGULARIZACAO_PENDENTE, ENCERRADA_SEM_SUBSTITUICAO, REALIZADA e PENDENTE; seus filtros e contagens usam a mesma regra. Anular não autoriza repetir automaticamente. O sítio da regularização vem do fato no último vínculo, mesmo após transferência do animal. Substitutos já usados por outra tarefa/atendimento não são oferecidos. O histórico fica disponível nas tarefas da agenda e do ciclo. Sugestões e inclusão em visitas usam a mesma pendência real: tarefas realizadas, encerradas ou aguardando regularização não são oferecidas para nova execução; a lista sanitária também restringe o tipo do protocolo.

Reabrir também exige participação/programação aberta, tarefa não dispensada e ausência de visita encerrada entre os atendimentos confirmados vinculados. A operação limpa a referência operacional e os snapshots da realização, conservando-os no histórico; reabre os atendimentos vinculados, incrementa a versão de rascunho e preserva impressões. Vincular substituto ou encerrar a regularização não reabre uma visita encerrada. A validação e as escritas acontecem na mesma transação, com chave de reenvio.

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

Paridade usa `rebanho/partos.calc.ts`. Consumo comum usa `consumo.ts` para saldo, lotes/validade, custo Decimal, período financeiro e movimento atômico; conversões específicas e compra direta permanecem nos executores adequados. `desvios.calc.ts` compartilha a comparação e a exigência de motivo; os normalizadores permanecem específicos. `requisicoes.ts` compartilha trava, identidade, conflito e gravação do reenvio sem alterar os formatos/hash históricos ou a ocultação de custos.

## Configurações e operação

Configurações → Pecuária → Reprodução reúne protocolos reprodutivos, tipos de exame reprodutivo e regras sanitárias por doença, além de atalhos aos cadastros existentes de materiais genéticos, genitores externos e Produtos. Sanidade usa a mesma base pelos seus cadastros. As rotinas de Reprodução/IATF mantêm programação, início, execução e acompanhamento, com atalhos para manutenção. URLs e filtros anteriores são conservados.

## Migração e retorno

As migrations `20261014140000` a `20261014180000` convertem a estrutura em transações, preservam IDs quando possíveis e registram `legadoIatfId` quando há colisão. Aplicações, exames, tentativas, visitas e vínculos técnicos passam a referenciar a identidade comum. Impressões, auditorias, payloads e respostas de reenvio antigos permanecem intactos. Resolutores aceitam os IDs reprodutivos anteriores nos fluxos operacionais; a conversão não executa fatos, estoque, financeiro ou diagnósticos novamente.

Antes de aplicar em outro ambiente: executar `pnpm --filter rionovo-server previa:pecuaria:padronizacao` e conferir conflitos/contagens/referências e a recuperação prevista. No desenvolvimento local, aplicar somente em `fazendinha_seedatev3`, sem criar outro banco ou clone para ensaio. A prévia só lê o banco e informa tabelas/views, colisões, papéis conflitantes e arquivos incompletos. A migração interrompe divergências e vínculos incompatíveis. Arquivos incompletos continuam arquivados; não recebem publicação, horário ou tarefas presumidas.

Código e migrations devem ser publicados em janela coordenada: o código antigo não escreve nas novas views. Após iniciar escritas no modelo comum, retornar somente o código antigo é incompatível. Retorno exige interromper escritas e restaurar o backup compatível, conciliando os fatos posteriores; não existe down migration que descarte esses fatos automaticamente. Não executar seed, reset ou carga IDEAGRI para viabilizar a mudança.

A remoção de `public.RegistroChuva` usa uma migration independente, sem CASCADE, que recusa tabela com registros. `btree_gist` e as garantias SQL dos outros domínios permanecem.

A migration complementar `20261014180000` preenche metadados de realização e regularização das tarefas sanitárias históricas pelo último vínculo, sem executar fatos novamente. Usa a data original com precisão DIA; registra separadamente o momento da conferência e conserva anulações, motivos, consumo e impressões. Tarefas dispensadas/participações canceladas não são reabertas pela migração.

## Validação

Testes automatizados exercitam a cadeia vazia e uma conversão com V3/V4 misturadas, colisões de IDs, períodos conflitantes, resultados históricos, programas arquivados, participação sem grupo, snapshots e impressões preservados; cobrem também calendário, versões concorrentes, exames com várias observações, regularização, estoque e reenvio. A migração foi aplicada no banco local sem recarga, com conferência de contagens. A política vigente exige usar somente `fazendinha_seedatev3` para toda validação local; ensaios que recriam estrutura ficam no CI externo. Isso não certifica produção nem homologa a rotina da fazenda.

O [HTML de conceitos](artefatos/conceitos-v4.html) apresenta o modelo implementado e sua relação com as telas. O [roteiro manual](artefatos/testes-v4-guia.html) mantém as marcações anteriores e acrescenta casos de padronização pendentes. Homologação pela fazenda permanece pendente.
