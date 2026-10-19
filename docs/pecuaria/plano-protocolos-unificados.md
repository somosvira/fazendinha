# Plano de implementação — protocolos individuais e coletivos

**Estado: proposta consolidada, não implementada.** Atualizado em 19/10/2026 a partir dos feedbacks e do mockup aprovado. Este plano substitui o recorte anterior limitado à tela de turma/IATF. Não substitui os contratos operacionais de [protocolos e exames](protocolos-exames.md), [reprodução](reproducao.md) e [Pecuária](README.md) enquanto a implementação não for entregue.

## Objetivo e referências

Aplicar o mesmo padrão operacional aos protocolos **sanitários e reprodutivos**, **individuais e coletivos**, mantendo tarefas, pendências, atendimentos e custos próprios de cada animal. Reutilizar o núcleo comum existente, sem quatro modelos de dados ou quatro executores independentes.

- [Base documental navegável](artefatos/protocolos/index.html): entrada para os materiais abaixo e instruções de manutenção.
- [Relações e diagramas interativos](artefatos/protocolos/relacoes.html): modelo, participação, tarefa e fatos; distingue estado atual de proposta.
- [Diagrama físico e catálogo SQL](artefatos/protocolos/db/index.html): fotografia de 19/10/2026 do banco local, com todas as colunas das seis tabelas centrais, FKs, índices e triggers; tabelas de apoio no catálogo.
- [Mockup aprovado](artefatos/protocolos/mockup/index.html#turma): referência visual do coletivo reprodutivo. O individual e o sanitário seguem as adaptações deste plano; suas quatro combinações ainda precisam de validação visual na aplicação.

Os HTMLs são documentos estáticos com exemplos locais; não executam operações na aplicação. O diagrama físico descreve o banco inspecionado, **não inclui como existentes as extensões propostas abaixo**. Capturas e catálogo não certificam o estado de outros ambientes nem homologação de campo.

## Escopo e vocabulário

| Conceito | Decisão |
|---|---|
| Protocolo | Modelo versionado SANITARIO ou REPRODUTIVO. Cada versão é uma linha de `Protocolo`, com id próprio; FKs usam o id, não apenas o número da versão. |
| Etapa | Linha de `EtapaProtocolo` da versão escolhida; não recebe o atendimento de um animal. |
| Participação | Linha de `ParticipacaoProtocolo` que liga animal e versão. Serve aos dois tipos e aos dois modos. |
| Coletivo | `ProgramacaoProtocolo` reúne participações na mesma versão e sítio. Continua sendo a mesma programação em todas as etapas. |
| Individual | Participação com `programacaoId = NULL`; título e navegação vinculados ao animal, sem obrigar nome de turma. |
| Tarefa | Linha de `TarefaProtocolo` para o par participação/etapa; contém previsão e execução próprias. |
| Atendimento | Fato sanitário/reprodutivo vinculado à tarefa, ou execução de manejo/retirada na própria tarefa. |
| Pendência | Situação operacional da tarefa daquele animal; não é diagnóstico clínico nem retirada da participação. |

Uma programação com um único participante continua coletiva se foi criada assim. Não converter agrupamentos históricos pela contagem atual de animais. “Individual/coletivo” é modo explícito de criação e apresentação; não é inferido do tamanho da lista.

Lote auxilia a seleção inicial. Entradas/saídas posteriores do lote não modificam participantes automaticamente. Não existe, neste escopo, uma entidade de turma permanente reutilizável entre protocolos. Selecionar novamente os mesmos animais para outro protocolo cria outra programação e outras participações.

## Jornadas a atender

1. Como responsável pelo manejo, quero selecionar uma versão publicada, para manter a estrutura e as referências usadas pelos animais.
2. Como responsável pelo manejo, quero iniciar um protocolo pela ficha de um animal, para acompanhá-lo sem criar uma turma artificial.
3. Como responsável pelo manejo, quero selecionar animais por sítio, lote e busca, para conferir os participantes de um coletivo antes de confirmar.
4. Como responsável pelo manejo, quero adicionar ou retirar um participante com histórico, para ajustar o coletivo sem alterar os registros dos demais.
5. Como responsável pelo manejo, quero selecionar uma etapa e ver seus animais e pendências juntos, para decidir quem ainda precisa de atendimento.
6. Como responsável pelo manejo, quero registrar o motivo de não atendimento e adiar uma tarefa, para manter a participação e acompanhar a exceção.
7. Como responsável pelo manejo, quero consultar um atendimento feito pela ficha ou visita na tela do protocolo, para não registrar o mesmo procedimento novamente.
8. Como responsável pelo manejo, quero atender um subconjunto de animais, para registrar resultados diferentes sem presumir atendimento de todos.
9. Como responsável pelo manejo, quero conferir produto, origem e saldo antes de confirmar, para saber se o procedimento pode ser realizado.
10. Como responsável pelo manejo, quero retomar um rascunho após erro ou conflito, para não perder o que preenchi nem duplicar consumo.
11. Como responsável pelo manejo, quero regularizar um fato anulado, para preservar o histórico e evitar outra saída indevida de estoque.
12. Como gestor autorizado, quero ver estimativa, custo real e procedimentos vinculados, para entender o custo deste protocolo sem duplicar despesas.
13. Como leitor autorizado, quero consultar registros sem ações de escrita ou dados fora do meu escopo, para respeitar as permissões existentes.
14. Como usuário, quero navegar por listas com no máximo dez itens, preservando filtros e seleção, para trabalhar com coletivos maiores sem perder contexto.
15. Como usuário, quero abrir o protocolo correspondente na ficha do animal e retornar à lista anterior, para consultar o contexto sem refazer a navegação.
16. Como responsável pela reprodução, quero manter separados o progresso do protocolo e os resultados de cada animal, para não interpretar conclusão de etapas como confirmação de gestação.

## Estrutura atual que será preservada

O catálogo SQL confirmou `Protocolo`, `EtapaProtocolo`, `ProgramacaoProtocolo`, `ParticipacaoProtocolo`, `TarefaProtocolo` e `VinculoTarefaProtocolo`. Não criar `ProtocoloIndividual`, `ProtocoloColetivo` ou duplicações sanitárias/reprodutivas.

- Preservar `UNIQUE(tipo, nome, versao)` e o versionamento por nova linha/id; etapas publicadas/usadas permanecem protegidas.
- Preservar `UNIQUE(participacaoId, etapaId)` e o trigger que exige a mesma versão para participação e etapa.
- Preservar agrupamento opcional, unicidade parcial de participação ativa por programação/animal, escopo e histórico de reentrada.
- Gerar tarefas pela aplicação, na transação de criação/inclusão; não presumir geração automática por FK ou trigger.
- Preservar vínculos de fatos, exatamente um destino por vínculo e no máximo um vínculo ATUAL por tarefa. Reutilizar os executores e a regularização comuns.
- Manter views IATF somente para compatibilidade de leitura; nenhuma escrita nas views.
- Não usar nomes de propriedades Prisma como se fossem novas colunas: `rodadaId` mapeia `programacaoId`, `execucaoId` mapeia `participacaoId`, `previstaPara` mapeia `previstaEm`.
- Gestação, tentativa e interpretação continuam fatos próprios do animal. Não adicionar uma FK obrigatória de gestação para programação nem copiar situação gestacional para todos os participantes.

## Extensões de dados propostas

### Pendência individual com histórico

Adicionar, por migration aditiva, `EventoTarefaProtocolo` no schema `pecuaria`. É um histórico operacional ligado à tarefa, compartilhado pelos dois tipos; não substitui `VinculoTarefaProtocolo` nem armazena um segundo atendimento.

| Campo proposto | Contrato |
|---|---|
| `id` | PK text com UUID gerado pelo padrão do projeto. |
| `tarefaId` | FK obrigatória → TarefaProtocolo, ON DELETE RESTRICT. |
| `tipo` | Enum: NAO_ATENDIDO, ADIAMENTO, RETIFICACAO_JUSTIFICATIVA. |
| `ocorridaEm` | Data/hora do evento operacional; não é a data de criação do fato clínico. |
| `motivo` | Texto obrigatório, validado e limitado; não atendimento e adiamento exigem justificativa. |
| `previsaoAnterior` / `previsaoNova` | Datas e precisões correspondentes ao adiamento; nulas nos eventos que não alteram previsão. |
| `precisaoAnterior` / `precisaoNova` | PrecisaoCalendarioProtocolo; obrigatórias junto das datas do adiamento. |
| `eventoCorrigidoId` | FK opcional para evento anterior da mesma tarefa; obrigatória somente na retificação. |
| `registradoEm` / `registradoPorId` | Instante de gravação e FK de autoria conforme sessão; escritos pelo servidor. |

Reutilizar o mecanismo comum de chave de reenvio para evitar eventos duplicados. Definir índices por tarefa/ordem de leitura e FK de autoria. CHECKs validam combinações de tipo/datas/precisões; a validação de retificação deve garantir que o evento pertence à mesma tarefa. Não permitir alteração ou exclusão pelo fluxo normal: corrigir por novo evento e auditoria.

A transação de adiamento registra o evento e atualiza apenas `TarefaProtocolo.previstaEm`/precisão, preservando `previsaoOriginal`. O histórico JSON existente não é apagado: permanece evidência anterior e compatibilidade; eventos novos têm identidade única, sem duplicar a apresentação quando referenciados por adaptadores legados. O histórico novo é a fonte das ocorrências novas de não atendimento/adiamento, não um segundo status independente.

Não transformar registros antigos sem execução em “não atendido” nem inventar motivos. Ausência de evento continua “sem registro” quando exigível. `dispensadaEm` encerra uma obrigação; não atendimento mantém a tarefa pendente. Se um atendimento válido for registrado depois, a pendência se resolve na projeção e o evento anterior permanece no histórico.

### Adesão ao protocolo sem confirmação manual de início

A criação da participação torna o animal inscrito no protocolo, com tarefas previstas. Retirar o botão “Confirmar início efetivo” não autoriza gravar realização fictícia, horário desconhecido ou `inicioEfetivo` igual ao planejado.

Para novas participações, o calendário se ancora em `inicioReferencia` informado na criação/inclusão. Data futura significa programação prevista; chegada da referência permite exibir “em andamento” operacionalmente, mesmo havendo animais não atendidos. O atendimento efetivo de cada animal é comprovado pelos fatos; primeira execução pode preencher o início efetivo individual na mesma transação, sem etapa manual separada e sem deslocar automaticamente a agenda coletiva.

Adicionar um discriminador de origem do calendário à participação, com valores `REFERENCIA_PROGRAMADA` e `INICIO_EFETIVO_LEGADO`, para não reinterpretar o histórico. Na migration, participações reprodutivas existentes ficam no modo legado; sanitárias mantêm referência programada. Novas participações dos dois tipos usam referência programada. Não reescrever previsões, snapshots nem início efetivo durante o backfill.

No modo legado, conservar o comportamento temporal existente e seu histórico. Se uma participação antiga sem início for atendida, estabelecer o início a partir da realização verdadeira dentro do fluxo existente, exibindo antes os efeitos sobre tarefas pendentes. Não converter a participação para a regra nova silenciosamente. A programação continua com a mesma identidade; diferenças individuais ficam visíveis no detalhe da tarefa.

Reutilizar regras de dia/hora: referência sem hora não gera precisão fictícia; intervalos que exigem hora permanecem não aferíveis/pendentes até referência suficiente ou ajuste explícito. Não criar scheduler para mudar um rótulo derivado da data. Esse pacote exige revisar `iatf.ts`, calendário comum e `inicio-iatf-visita.ts`, não apenas ocultar um botão.

## Situação das tarefas e pendências

Criar uma projeção comum, usada por consulta, contagem, agenda, ficha e execução. Ela deve incorporar tentativas reprodutivas e vínculos ATUAIS, além das aplicações/exames existentes; a lógica sanitária atual não deve ser copiada sem essa ampliação.

| Situação apresentada | Regra e ação |
|---|---|
| Atendido | Execução válida existente e sem regularização pendente. Abrir o fato/serviço vinculado; bloquear segunda execução. |
| Não atendido | Evento explícito com justificativa, sem realização posterior válida. Continua pendente; pode adiar ou registrar atendimento. |
| Sem registro | Tarefa exigível sem execução, dispensa ou evento explícito de não atendimento. Oferecer justificar, adiar e atender. |
| Adiado | Reprogramação explícita ainda não realizada. Mostrar a nova previsão individual como exceção e permitir consultar motivo. |
| Previsto | Tarefa futura sem ocorrência pendente; não presumir falta ou atendimento. |
| Regularização pendente | Fato anulado/inconsistente exige fluxo de regularização; não liberar execução/consumo por simples ausência de vínculo atual. |
| Dispensado / retirado / encerrado | Obrigação encerrada com histórico; não oferecer como pendência executável. |

Prioridade: regularização e encerramento específico; execução válida; retirada/dispensa sem execução; último evento operacional aplicável; previsão/ausência. Não perder a distinção entre fato realizado antes da retirada e tarefa nunca realizada. Pendências abertas incluem não atendimento, adiamento ainda aberto, ausência exigível e regularização; “atrasadas” é um recorte temporal separado. As regras SQL dos filtros devem equivaler à projeção, inclusive perto da meia-noite na referência temporal do sítio.

Reprogramar um animal não troca a etapa nem cria nova programação, não recalcula outros animais e não move etapas seguintes automaticamente. Não atendimento não altera gestação, aptidão ou papel reprodutivo.

## Consulta, API e autorização

Implementar uma leitura comum em `server/src/services/pecuaria/protocolos/`, consumida pelas rotas sanitárias/reprodutivas existentes. Adaptar contratos novos de forma aditiva; não remover endpoints ou aliases consumidos por visitas e ficha.

Separar cabeçalho/resumo, etapas, tarefas da etapa, procedimentos e eventos da tarefa. Evitar devolver toda a programação com arrays internos ilimitados para a interface depois recortar.

- Contexto inequívoco: tipo de protocolo, programação **ou** participação individual, versão, sítio autorizado, etapa e data de referência.
- DTO da linha: tarefaId, participacaoId, animal autorizado, etapaId, situação, realizadaEm/precisão, previsão individual quando houver exceção, vínculo atual, origem e ações permitidas. Nome de animal não é chave.
- DTO das consultas paginadas: `itens`, `total`, `pagina`, `porPagina` e resumo autorizado independente da página.
- Novas ações: registrar não atendimento, retificar justificativa e adiar tarefa. Validar corpo com Zod, chave de reenvio, autoria e escopo; delegar aos serviços transacionais.
- Criação individual reprodutiva deve usar participação sem programação; o suporte estrutural existente não significa que a rota antiga de IATF já aceite esse fluxo. Acrescentar entrada explícita usando os adaptadores comuns e manter as entradas antigas.
- Confirmação reconsulta tarefa/fato, elegibilidade, programação/participação aberta, estoque, origem e serviço. Conflito entre ficha, visita e coletivo retorna conflito recuperável e atualiza a linha; não duplica fato nem baixa.
- Preservar sessão, área, ação, sítio na data e políticas vigentes de custos operacionais versus valores/documentos financeiros. Usar `custos/permissoes.ts`; não equiparar todos os custos operacionais a `verValores`, nem expor dados financeiros completos a leitores sem permissão.
- Para histórico após transferência, resolver escopo pelo fato/participação conforme contratos existentes; não vazar localização atual de outro sítio.

### Paginação: máximo de dez

Padrão e teto das novas consultas operacionais: **10 itens por página**. Validar no servidor; solicitações acima do teto são rejeitadas com erro de validação. As telas não oferecem opção 20/50/100. Não alterar inadvertidamente endpoints globais de outros módulos; adicionar schemas de consulta específicos onde necessário.

Aplica-se às listas de programações, participações, animais/tarefas por etapa, pendências filtradas, preparação do atendimento, procedimentos/custos detalhados, histórico de eventos e seletores de animais/protocolos/produtos/serviços/substitutos usados neste fluxo. Se houver mais de dez etapas, paginar também sua navegação, preservando a etapa selecionada no contexto.

Busca, escopo e filtros precedem contagem e paginação. Ordenação determinística com desempate por id; ao trocar filtro/etapa, voltar à página 1. Se uma ação reduzir o total e invalidar a página, recuperar a última página válida. Totais de pendências, atendimentos e custos se referem ao conjunto completo, nunca às dez linhas atuais.

Seleção coletiva e rascunho persistem por ids ao trocar página; paginar a revisão sem reduzir a confirmação à página visível. “Selecionar página” significa só os dez itens visíveis. Não introduzir seleção de todos os resultados sem revisão explícita. O limite de exibição não substitui os limites de escrita coletiva existentes; respeitar seus máximos e não dividir automaticamente uma confirmação atômica em lotes silenciosos.

## Composição da interface

Reutilizar cabeçalhos recolhíveis, tabelas, controles, formatadores e navegação do projeto. Extrair um componente de detalhe comum e adaptadores por contexto; formulários e regras de aplicação/exame/IA continuam especializados.

| Contexto | Primeiro componente | Segundo componente |
|---|---|---|
| Sanitário coletivo | Etapas e animais; seleção de etapa e tabela de participantes/tarefas | Procedimentos e custos do coletivo |
| Reprodutivo coletivo | Mesmo componente; executores reprodutivos conforme etapa | Procedimentos e custos do coletivo |
| Sanitário individual | Etapas do protocolo; tarefa e atendimentos do animal, sem tabela repetitiva de um participante | Procedimentos e custos da participação |
| Reprodutivo individual | Mesmo padrão individual; tentativa/exame vinculados | Procedimentos e custos da participação |

Nos coletivos, calendário, animais e pendências ficam no **mesmo componente**, com filtros Todos/Pendentes. Não criar uma segunda tabela de pendências. Título e subtítulo à esquerda; data de referência no subtítulo e seta de recolher na ponta direita. Selecionar etapa realmente consulta seu conteúdo.

Tabela: Animal, Situação, Data realizada e Ações. A data prevista comum permanece no seletor da etapa; somente uma exceção individual de previsão aparece na linha/detalhe com rótulo claro. Sem “participação ativa” repetida, descrição genérica da etapa ou próxima etapa em todas as linhas.

Ações usam aparência consistente de botão: ver serviço, ver/editar motivo, justificar, adiar, regularizar. Detalhes abrem imediatamente abaixo do animal de origem. Identificação do animal continua link semântico para a ficha no domínio e participação corretos. Linha de programação com uma única ação é clicável, mantendo link real, foco, teclado e abertura em nova aba.

Lista individual, lista coletiva e fichas devem navegar pelos mesmos ids. Preservar contratos de URL em `client/src/router.ts`, retorno, sítio, filtros, página e etapa. Ações no cabeçalho não devem recolher a seção. Estados de erro, vazio, leitura parcial, carregamento e permissão têm mensagens distintas.

## Preparação, estoque, serviços e custos

Antes de confirmar, reconciliar os registros já feitos pela ficha e pela visita. Exibir origem e referência do fato; selecionar somente tarefas efetivamente novas para consumo. A escolha do serviço financeiro não é obrigatória quando o domínio permite atendimento sem serviço associado, nem substitui a comprovação de execução.

Apresentar produto/material planejado, quantidade para os novos atendimentos e origem escolhida. Saldo insuficiente impede confirmar consumo de estoque. Usar somente alternativas de origem já suportadas pelo domínio, com validações e desvios próprios; não oferecer “sem estoque” como dispensa de rastreabilidade. A tarefa sem produto previsto não precisa simular consumo. Validar novamente saldo/lote/validade na transação.

“Procedimentos e custos” é o último componente recolhível. Contém cards de estimado/real, composição e lista paginada de procedimentos deste protocolo/participação. Cada procedimento mostra data, tipo, animal quando coletivo, valor conhecido e ação para o detalhe de origem. Não trazer filtros de relatório ou editor genérico de classificação para o topo operacional.

Estimado = quantidades planejadas × referências de preço disponíveis, incluindo serviços previstos. A leitura informa data/origem da referência e cobertura: referência ausente significa estimativa parcial/não apurada, nunca zero. Não mudar a estrutura publicada para atualizar um preço de leitura. Se houver necessidade futura de orçamento congelado, tratar como outra feature.

Real = custos de produtos e serviços efetivamente atribuídos aos fatos do recorte. Reutilizar `services/pecuaria/custos/`; deduplicar identidades e não somar novamente material incluído no serviço. Custo faltante permanece desconhecido. Anulações/estornos e preparatórios respeitam os contratos existentes. A atribuição coletiva não pode ser copiada integralmente a cada animal. Totais independem de página e da etapa selecionada, pois representam toda a programação/participação, com rótulo explícito.

## Pacotes de implementação e dependências

1. **Contratos e regressões de base.** Mapear DTOs, consumidores antigos, estados, custos e permissões nas quatro combinações. Fixar casos de aceitação abaixo antes de alterar comportamento; reutilizar os testes por rota/fluxo existentes.
2. **Migrations e núcleo de eventos/calendário.** Acrescentar evento operacional e origem do calendário, constraints, índices, autoria e idempotência. Preservar histórico e escrever testes de concorrência. Revisar migrations no CI; aplicação local posterior somente no banco autorizado, sem resets.
3. **Consultas e projeção comum.** Leitura paginada, contagens, estados e agregados consistentes, novos fluxos individuais, compatibilidade dos aliases. Depende do pacote 2 para os novos eventos.
4. **Ações comuns.** Não atendimento, retificação, adiamento, primeira execução real sem confirmação manual, reconciliação de fatos e estoque. Estender os executores, não criar um executor paralelo. Depende de 2–3.
5. **Componentes e quatro entradas.** Detalhe comum, variantes individual/coletiva, integrações em sanidade/reprodução/ficha, filtros/URLs e paginação. Usar o mockup como referência; validar individual e sanitário visualmente. Depende de 3–4.
6. **Procedimentos e custos.** Cards, estimativa com cobertura, valores reais e lista deduplicada; preservar autorização e links de origem. Depende das consultas e componentes.
7. **Regressão integrada e documentação.** Validar casos, builds e navegador; atualizar contratos e diagramas do que efetivamente mudou. Incorporar decisões vigentes aos contratos e retirar este plano temporário ao concluir a implementação.

Pontos de partida confirmados: `Iatf.tsx`, `ProtocolosAnimal.tsx`, `sanidade/AgendaRodadas.tsx`, `RodadasAnimal.tsx`, `FormRodada.tsx`, `rodadas-api.ts`; backend em `protocolos/`, `sanidade/protocolos.ts`, `sanidade/rodadas.ts`, `reproducao/iatf.ts`, `reproducao/inicio-iatf-visita.ts`, `custos/`, rotas `rodadas.ts` e `reproducao.ts`. O desenho dos componentes novos será ajustado após localizar equivalentes; esses caminhos não autorizam reescrita integral dos módulos.

## Critérios de aceitação e validação

### Modelo e fluxos

- As quatro combinações criam/consultam participação e tarefas no mesmo núcleo; individual não exige programação e coletivo de um animal preserva sua identidade.
- Duas versões do mesmo protocolo não misturam etapas; participação histórica não muda de versão. Três animais × quatro etapas produzem doze tarefas, com execução independente.
- Novo participante não recalcula os anteriores. Retirada mantém história; reentrada cria outra participação.
- Não atendimento exige motivo, permanece pendente e não consome estoque. Retificação preserva o texto anterior. Adiamento altera só a tarefa escolhida e conserva previsão original.
- Sem registro, previsto, adiado, não atendido e regularização têm filtros/contagens coerentes. A mesma tarefa não recebe execução duplicada por disputa entre ficha, visita e coletivo.
- Adesão nova não grava início/realização fictícios. Modo legado mantém calendários e snapshots; ausência de hora continua explícita.
- IA realizada não cria gestação; diagnóstico válido preserva as regras atuais. Um resultado não altera os demais animais nem encerra suas pendências automaticamente.

### Listas, acesso e custos

- Casos com 0, 1, 10, 11 e 21 itens; nenhuma página operacional excede 10. Trocar filtro, etapa e tamanho do conjunto não perde dados nem deixa página inválida.
- Confirmação preserva os ids selecionados em várias páginas; repetição de requisição não duplica evento, fato ou consumo.
- Totais/estimativas do mesmo conjunto não mudam ao navegar páginas; filtros aplicados no servidor não vazam dados de outro sítio.
- Saldo insuficiente, produto divergente, origem documentada, fato existente, valor desconhecido e material incluído em serviço têm resultados explícitos, sem dupla baixa/duplo custo.
- Consultor sem escrita não recebe ações utilizáveis de mutação. Usuário sem autorização financeira não recebe valores/documentos financeiros indevidos pelos DTOs, snapshots ou links.

### Evidências exigidas na implementação

Priorizar testes pelas rotas e pelos fluxos existentes: `rodadas.test.ts`, `protocolos.integration.test.ts`, `rodadas.integration.test.ts`, `fluxos-comuns.integration.test.ts`, `iatf.integration.test.ts`, `inicio-iatf-visita.*` e testes de custos/permissões. Casos puros cobrem calendário e equivalência projeção/filtros; React cobre seleção, paginação, acessibilidade e navegação. Não criar mocks de cada camada interna.

Executar testes e builds proporcionais no client/server. Revisar cada fixture antes de habilitar integração; somente `fazendinha_seedatev3`, com criação/limpeza exclusiva dos próprios registros e sem recarga de seeds. Testes que recriam banco/estrutura ficam no CI externo.

Inspeção visual de desktop e celular nas quatro combinações, teclado, foco, expansão na linha, erros e dados longos. Separar resultados automatizados, inspeção visual, CI e homologação da fazenda; não marcar roteiros antigos como aprovados.

## Fora de escopo

Turma permanente entre protocolos; duplicação de entidades sanitárias/reprodutivas; novo módulo de laboratório/FIV/leite; prescrição clínica automática; integração contínua IDEAGRI; migração de históricos para inferir atendimentos; mudanças globais de permissões; criação de outro banco; deploy ou alteração de produção. O trabalho desta atualização é documental, não a execução dos pacotes acima.
