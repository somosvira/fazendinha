# Reprodução e visitas — V4

Este contrato descreve a implementação em `server/src/services/pecuaria/reproducao/`, no schema `pecuaria`, e a interface em `client/src/pecuaria/rebanho/reproducao/`. A publicação em produção e a homologação da rotina pela fazenda são etapas distintas da entrega de código.

## Fatos individuais e acompanhamento

Uma tentativa de reprodução tem identidade própria, animal, sítio na data do fato, tipo (IA, TE ou cobertura observada), data, responsável, origem do material e posição no ciclo. A confirmação da gestação é um fato diferente da tentativa. Várias avaliações podem acompanhar a mesma gestação.

Categoria (vaca/novilha), aptidão (leite/corte), papel genético (doadora/receptora), situação reprodutiva e restrição são dimensões diferentes. Uma vaca marcada para descarte continua no rebanho e pode continuar no leite. A decisão impede novas intervenções reprodutivas, exige motivo e só termina com reversão explícita e auditada. Não gera baixa, secagem ou encerramento de lactação.

Restrições sanitárias são configuradas por sítio, doença e ação, com efeito de alerta ou bloqueio. Não existem bloqueios clínicos presumidos. A vigência da ocorrência determina sua aplicação; encerrar uma ocorrência não elimina outra restrição. O sistema registra ciência dos alertas e mantém a auditoria de configurações.

As anotações confirmadas pela fazenda têm os seguintes significados:

| Anotação | Efeito |
|---|---|
| P+ | Confirma gestação; vincula uma tentativa comprovada ou registra explicitamente a origem desconhecida |
| OK | Reconfirma uma gestação conhecida; não cria outra gestação |
| M/F | Registra sexo fetal na gestação acompanhada; não cria tentativa ou cria |
| IATF | Indica protocolo para uma fêmea avaliada vazia; não inicia o protocolo nem consome insumo |
| Descarte | Registra restrição reprodutiva com motivo, mantendo o animal no rebanho |
| Aguardar | Organiza retorno; não equivale a resultado negativo |
| IATFCL, traços e outras anotações | Preserva o texto; não deduz significado clínico não confirmado |

Um negativo após uma gestação confirmada exige tratar a perda ou corrigir o diagnóstico, preservando o resultado anterior. Ausência de atendimento, resultado inconclusivo e falta de informação não tornam automaticamente uma vaca vazia. A situação apresentada deriva da cronologia: parto ou perda encerra a gestação; nova tentativa passa a aguardar diagnóstico.

Lançamentos retroativos conferem também os ciclos encerrados: uma nova gestação ou lactação não pode se sobrepor a um período conhecido. Uma perda registrada permite o diagnóstico negativo no mesmo dia; isso não libera automaticamente outra intervenção reprodutiva nesse dia. Anular um parto antigo exige revisar os fatos posteriores antes de reabrir sua gestação.

A situação clínica acompanha o animal após a transferência entre sítios. Gestação, restrições, paridade e tentativa relevante são consultadas para o animal autorizado na data de referência. Listas de fatos e custos conservam o sítio do evento; acompanhar a condição clínica não concede acesso a custos de outros sítios. Reconfirmação, sexagem e parto no destino podem se vincular à gestação anterior.

## Material, estoque e genética

IA e TE usam `MaterialGenetico`, ligado ao Produto do estoque único. Consumo de estoque valida produto, lote/validade, quantidade, saldo e período financeiro; fato e saída são gravados na mesma transação. Material incluído em Serviço confirmado não cria saldo fictício na fazenda. Origem documentada exige justificativa. Um vínculo ao Serviço não lança outra despesa.

A tentativa preserva um retrato da genética e da origem: alterações posteriores no cadastro do material não reescrevem a tentativa. Na TE, a mãe genética é a doadora e a mãe gestacional é a receptora. Genitor desconhecido permanece desconhecido; a receptora não substitui uma doadora ausente.

Cobertura observada é diferente de exposição de um touro a um lote. A exposição registra touro, lote e intervalo, respeitando a permanência histórica das fêmeas. Ela não comprova uma data exata de fecundação nem determina automaticamente a paternidade.

Anulação de lançamento e perda física de material têm efeitos diferentes. Uma dose usada ou descartada não pode voltar ao estoque utilizável por simples cancelamento do procedimento. Correções exigem motivo e conferência dos fatos dependentes.

Uma tentativa anulada com consumo mantido continua compondo o total atribuído ao Serviço. Criação de tentativas, consulta e edição dos procedimentos usam a mesma regra de soma; o valor confirmado continua sendo o limite para atribuições concorrentes.

Aplicações sanitárias também distinguem devolução de material não utilizado e manutenção de material utilizado/descartado. Ao manter consumo, o usuário informa separadamente se a administração e os dados/carências registrados foram confirmados, se o material foi descartado sem administração ou se a informação não pôde ser confirmada. Administração confirmada conserva a carência registrada; informação não confirmada deixa leite e carne em revisão. Vincular uma aplicação substituta válida transfere a evidência clínica para ela, mantendo o consumo e a auditoria originais.

## Parto, cria e lactação

O parto é único para a matriz, mesmo com gêmeos, e contém o resultado de cada cria. Na regra aprovada para esta entrega, aborto e natimorto contam como parto, seguindo a contagem investigada no IDEAGRI. Outras perdas gestacionais não são automaticamente classificadas como aborto.

O total de partos soma o saldo anterior à entrada e os eventos válidos que ainda não estejam incluídos nesse saldo. Eventos anulados não contam. Ficha, categorias, filtros, resumo de lote e painel usam essa mesma regra. O parto inicia um novo ciclo de tentativas, mantendo os ciclos anteriores consultáveis.

Uma cria viva nasce no sistema junto com o parto, na mesma transação. Sexo, aptidão e sítio são conhecidos; brinco definitivo e peso podem ficar pendentes. Sem brinco, recebe identificação provisória explicitamente sinalizada. Completar a identificação preserva seu ID, filiação, histórico e vínculo com o parto. Natimorto não gera um animal ativo. Morte posterior ao nascimento usa o fluxo normal de baixa do animal.

O parto pode iniciar a lactação mínima quando isso foi efetivamente informado. Aborto não abre uma lactação automaticamente. Há registro de início e encerramento; produção diária, qualidade do leite, laboratório/FIV e gestão avançada de coleta permanecem fora desta versão.

## Visita veterinária

A visita organiza atividades e participantes; cada procedimento continua sendo um fato individual único, consultável pela visita e pela ficha. O percurso é preparar, imprimir, atender no campo, retomar a mesma lista, transcrever e confirmar.

Cada atividade preserva participantes, ordem e contexto. Atividades extras não substituem a folha original. Rascunhos ficam no servidor. Atendimento confirmado, adiado e não atendido são diferentes; finalizar a visita não executa automaticamente as pendências.

A seleção usa a localização, categoria e situação reprodutiva na data da visita. Filtros permitem lote, categoria e intervalos informados desde tentativa, parto ou confirmação de gestação. A preparação conserva os critérios e motivos de inclusão. A folha de campo apresenta o lote e o contexto reprodutivo conhecido, com informação ausente explicitamente indicada e espaço para o resultado.

Rascunhos têm versão por participante. Um salvamento baseado em versão antiga é rejeitado como conflito, sem substituir os dados mais recentes. Adiado e não atendido exigem motivo, mas não data de execução. A prévia compara também restrições, paridade, parto e categoria; alterações posteriores à revisão exigem uma nova conferência.

Uma confirmação pode abranger um animal ou um subconjunto de até 100 participantes da mesma atividade. A confirmação do subconjunto é atômica e idempotente. O restante da visita pode continuar pendente. Aplicações, exames e tarefas existentes são reutilizados, evitando duplicar consumo ou procedimentos entre os módulos.

O acompanhamento apresenta retornos informados, diagnóstico pendente, tarefas IATF futuras/vencidas e previsões de parto. Uma avaliação válida posterior substitui o retorno anterior do mesmo animal. Parto/perda encerram a previsão ligada à gestação. Links abrem o animal, fato consultável, programação ou registro de parto; fatos de outro sítio não recebem acesso por esse caminho. Ausência de data de diagnóstico permanece explícita, sem gerar um prazo clínico presumido.

## IATF

Uma programação usa uma versão publicada do protocolo, com participações individuais. Os intervalos de 10/11 dias até a inseminação são contados a partir do início efetivo de cada participante, conforme confirmação da fazenda, e dependem da versão do protocolo. Indicação, início previsto, início efetivo e execução são informações distintas.

Etapas admitem intervalos em dias ou horas. Atraso de uma execução não desloca silenciosamente as demais; reprogramar exige motivo. Retirada conserva o histórico e a reentrada constitui outra participação. A aplicação, avaliação ou tentativa executada permanece ligada à tarefa, com um único efeito operacional.

As restrições aplicáveis são revalidadas na execução; preparar ou iniciar o protocolo não autoriza executar uma etapa posteriormente bloqueada. Alertas configurados exigem ciência explícita. O início informado de um protocolo sanitário pela visita é preservado, sem substituição silenciosa pela data da visita.

Anular um fato vinculado deixa sua tarefa ou atendimento pendente de regularização, preservando a execução original e o histórico. A regularização exige motivo e pode vincular um substituto válido, encerrar sem substituição ou reabrir quando o procedimento não aconteceu e os efeitos físicos permitem isso. Não produz consumo automático nem apaga o lançamento original.

A escolha do substituto apresenta fatos válidos do mesmo tipo, animal, sítio e data, sem exigir digitação de identificadores internos. Consumo mantido impede reabertura para nova execução. Visita encerrada permite vincular substituto ou encerrar a regularização, mas não reabrir atendimento. Anulação de tentativa vinculada a Serviço respeita os períodos da tentativa e do Serviço.

## Carga técnica e reconciliação

O IDEAGRI serve à carga inicial; não existe sincronização contínua ou tela de reconciliação para o usuário final. A extração parte de uma cópia explicitamente fornecida. Transformação e importação têm prévia, chaves de origem, identificação de conflitos e reexecução sem duplicação. O Fazendinha passa a ser a fonte operacional após a carga.

Relações só são estabelecidas quando há referência comprovada. Coincidência de nascimento/filiação não autoriza vincular uma cria histórica ao parto; proximidade de datas não comprova tentativa, gestação ou paternidade. Fatos anteriores à entrada podem ser conservados como históricos, sem inventar localização no sítio atual ou consumo de estoque.

A programação IATF histórica sem informações suficientes para reproduzir o protocolo fica arquivada com suas participações e pendências. Não é publicada como protocolo operacional nem gera tarefas presumidas. Da mesma forma, diagnósticos históricos não são convertidos em várias gestações abertas sem comprovação dos ciclos. O relatório técnico explicita lacunas e conflitos para revisão antes de aplicar a carga.

Os comandos e as precauções de conexão ficam em [desenvolvimento](../desenvolvimento.md). Nenhuma carga em produção faz parte da validação local da implementação.

## Autorização e validação

Aplicam-se sessão, área Pecuária, ação de lançamento e escopo de sítio existentes. Consultar custos exige também acesso financeiro e permissão para ver valores, inclusive em snapshots e retornos de gravação. Não foram criados novos papéis de acesso.

Datas usam a localização na data do fato e respeitam nascimento, entrada e baixa. Movimentação ou correção retroativa não pode tornar incoerentes fatos já registrados. Migrations e transações protegem integridade, concorrência, autoria e histórico.

A validação automatizada cobre cálculos, filtros, serviços, contratos HTTP e persistência em PostgreSQL descartável. A homologação manual com o time da fazenda permanece pendente; nem testes automatizados nem esta documentação aprovam marcações dos roteiros V3 ou certificam o banco de produção.
