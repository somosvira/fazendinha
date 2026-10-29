# Pecuária · Reprodução

## Três ciclos que precisam ser separados

O **ciclo estral biológico** é o intervalo entre cios. Em bovinos, a referência média é cerca de 21 dias, com variação; envolve desenvolvimento folicular, cio/ovulação e fase lútea. Se houver concepção e manutenção da gestação, o animal segue gestante; se não houver, pode retornar à ciclicidade. A gestação tem duração aproximada de nove meses, variável por raça e indivíduo. Essas referências explicam a biologia; não são uma agenda clínica automática do app. Fonte: [FDA — ciclo estral bovino](https://www.fda.gov/animal-veterinary/product-safety-information/cattle-estrous-cycle-and-fda-approved-animal-drugs-control-and-synchronize-estrus-resource-producers).

O **ciclo operacional de tentativas** do aplicativo agrupa tentativas desde o último parto válido, ou desde a referência inicial. Pode conter várias tentativas e vários ciclos estrais. Aborto e natimorto registrados como parto iniciam outro ciclo operacional; uma perda gestacional que não é parto não o reinicia automaticamente.

O **ciclo produtivo** acompanha início/encerramento de lactação e medições. Ele se sobrepõe à reprodução: a vaca pode voltar a ser inseminada e ficar gestante enquanto ainda produz leite. Secagem encerra lactação; não encerra a gestação.

## Da novilha ao próximo parto

| Momento | O que acontece | O que registrar | O que o app pode concluir |
|---|---|---|---|
| Entrada sem história suficiente | Conhecimento incompleto | Identidade, localização, finalidade e situação inicial comprovada | Reprodução desconhecida; produção não informada |
| Avaliação e liberação | Decisão clínica/operacional | Situação inicial, política e/ou decisão individual, papel e restrições | Elegível, não elegível ou pendente conforme a data |
| Cio ou preparação | Oportunidade/planejamento | Observações, exames e protocolo aplicável | Não confirma concepção nem execução de tentativa |
| IA, TE ou cobertura observada | Intervenção realizada | Tentativa, responsável, material/origem e data | Aguarda diagnóstico |
| Diagnóstico negativo | Evidência conclusiva sem gestação | Exame/interpretação | Vazia; elegibilidade ainda precisa ser conferida |
| Diagnóstico positivo | Gestação comprovada | Exame, gestação e tentativa vinculada quando conhecida | Gestante; vínculo desconhecido permanece explícito |
| Reconfirmação/sexagem | Acompanhamento da mesma gestação | Novas evidências | Mantém gestação; não cria outra tentativa/gestação |
| Secagem | Encerramento produtivo informado | Encerramento da lactação | Seca, podendo continuar gestante |
| Parto | Nascimento/desfecho da gestação | Um parto e os resultados de cada cria | Encerra gestação e reinicia tentativas; lactação depende de registro |
| Pós-parto | Recuperação e acompanhamento | Ocorrências, exames, política/decisão de liberação | Vazia não significa imediatamente elegível |

No pós-parto, retorno à atividade reprodutiva depende das condições do animal; o simples decurso do calendário não comprova recuperação ou aptidão. Referência de contexto: [Oregon State University — função reprodutiva bovina](https://extension.oregonstate.edu/catalog/basics-reproductive-function-beef-cows). Prazos de espera, diagnóstico e reconfirmação do software precisam de política explícita, sem copiar médias biológicas como prescrição.

## Situação reprodutiva

| Estado | Evidência e motivo | Próxima ação possível |
|---|---|---|
| `DESCONHECIDA` | Não há conclusão válida suficiente; encerramento sem desfecho comprovado também pode exigir esclarecimento | Completar história ou avaliar |
| `VAZIA` | Conclusão negativa ou encerramento comprovado por parto/perda | Conferir elegibilidade; não inseminar só pelo rótulo |
| `APTA` | Situação inicial declarada, com data de aptidão quando informada | Submeter às regras atuais de elegibilidade |
| `AGUARDANDO_DIAGNOSTICO` | Existe tentativa válida mais recente sem desfecho conclusivo que a substitua | Atender a demanda diagnóstica |
| `GESTANTE` | Gestação confirmada válida, com acompanhamento preservado | Acompanhar, reconfirmar, registrar desfecho |

O cálculo considera fatos válidos até a referência, cronologia e prioridade das evidências. Gestação operacional aberta não é desfeita por um cadastro inicial posterior. Inconclusivo e “aguardar” não equivalem a negativo. Anulação de uma evidência exige reavaliar seus dependentes.

## Elegibilidade: uma decisão diferente do diagnóstico

`ELEGIVEL`, `NAO_ELEGIVEL` e `PENDENTE` respondem se o conjunto de regras está satisfeito naquela data. O cálculo usa sexo, baixa, localização, ciclo, política congelada, papel, descarte, restrições, liberação individual e situação reprodutiva.

PEV é período de espera voluntário configurado pela fazenda. Pode distinguir primíparas e multíparas e o tratamento após aborto. A política é vinculada ao início do ciclo para não mudar silenciosamente o passado. Uma decisão individual pode liberar ou bloquear com sua própria evidência.

Vazia durante o PEV pode ser não elegível. Aguardando diagnóstico pode ficar pendente. Sem política ou liberação suficiente, o sistema não fabrica aptidão. Gestante não é elegível a uma nova tentativa no cálculo. As guardas específicas do comando também verificam restrições sanitárias, material, estoque e período.

### Critérios, avaliação e aptidão clínica

A política V2 separa critérios de vacas e novilhas. Selecione somente os critérios desejados: dias pós-parto para vacas, idade, peso absoluto, percentual do peso adulto ou ECC. Cada parâmetro só participa quando selecionado. Se dois critérios estiverem ativos, ambos precisam ser atendidos; evidência ausente ou vencida aparece como pendência. O padrão do critério de peso aceita apenas medido; estimado/informado só participa se a política autorizar explicitamente. ECC conserva sua escala e validade. Uma vaca com parto anterior declarado, mas sem sua data, não passa a ser tratada como novilha por faltar a data.

Atender aos critérios sinaliza **Avaliação devida**. Não agenda visita nem libera protocolo ou tentativa. Sem critérios ativos, o agendamento continua manual. A referência pós-parto depende de parto comprovado e da política adotada; salvar uma configuração não adota parâmetros em nome da fazenda nem muda silenciosamente o ciclo anterior.

O **toque de aptidão** usa o exame comum e registra Apta, Não apta ou Inconclusivo, com retorno quando informado. A conclusão clínica aparece separada dos impedimentos operacionais. DG negativo não comprova aptidão; idade, peso ou fim do PEV também não substituem o exame. Uma decisão individual explícita pode usar um toque apto válido para antecipar o PEV na ação escolhida, mantendo o prazo original, a justificativa e os outros impedimentos.

Ficha, agenda e visita compartilham a mesma necessidade de avaliação do ciclo. Agendar ou informar retorno não cria outra necessidade; corrigir/anular a evidência revalida os efeitos da decisão sem apagar o histórico. Um novo parto, inclusive aborto ou natimorto, reinicia o ciclo e não herda a liberação anterior. Políticas V1 históricas conservam sua compatibilidade documentada; isso não dispensa a validação do ciclo atual.

## Tentativas, materiais e filiação

IA usa material de sêmen; TE usa embrião e conserva doadora e receptora com papéis distintos. Cobertura observada registra o evento conhecido. Exposição de touro a um lote registra intervalo e participantes históricos; não comprova data exata de concepção nem paternidade automática.

O material pode vir do estoque, de Serviço ou de origem documentada, conforme o contrato. Fato, consumo, custo e vínculos são confirmados de forma coordenada. A tentativa conserva um snapshot genético; editar o cadastro do material não reescreve o que foi utilizado.

Uma tentativa anulada não devolve automaticamente uma dose utilizada. A correção distingue devolução por erro de lançamento, material consumido e material descartado. O custo de um Serviço não é duplicado pelo vínculo com a tentativa.

## Gestação, perda, aborto e parto

O diagnóstico positivo cria ou confirma a gestação conforme o fluxo. Reconfirmação e sexagem acrescentam evidência à mesma gestação. Origem sem tentativa conhecida é registrada explicitamente, sem inventar IA anterior.

Perda precisa de explicação e pode ter causa desconhecida, suspeita ou confirmada. A autoria do lançamento não significa responsabilidade pela perda. Um negativo depois de positivo exige tratar a perda ou corrigir o diagnóstico; não pode apagar silenciosamente a gestação.

Aborto é um desfecho de parto no contrato atual e participa da análise de perdas sem duplicação. Natimorto é identificado no nascimento e não gera animal ativo. Morte depois de nascimento vivo usa a baixa normal da cria. Gêmeos são várias crias de um único parto.

Parto e criação de animais vivos são atômicos. Uma cria sem brinco definitivo permanece identificada provisoriamente. Filiação respeita genética/gestação; peso pode ser informado e vinculado. Início da lactação é explícito; aborto não abre lactação por suposição.

## Lactação e contadores

`LACTANTE` exige lactação vigente única com evidência válida. `SECA` exige encerramento comprovado sem lactação posterior vigente nem parto posterior sem resolução. Sem evidência suficiente, usa-se `NAO_INFORMADA`. Na interface, a Situação de lactação apresenta Lactante, Seca ou Não informada. O código legado `SEM_LACTACAO` também aparece como Não informada: ausência de lactação registrada não comprova secagem.

DEL conta dias desde o início da lactação, com D0 no início. Fica nulo após o encerramento, inclusive no dia da secagem. Dias pós-parto usa o parto; dias desde tentativa usa a tentativa do ciclo; dias desde confirmação usa o diagnóstico. São relógios distintos.

No formulário **Encerrar lactação**, peso é opcional: escolha **Não informar peso**, **Registrar pesagem** ou **Reutilizar pesagem existente**. A mesma pesagem fica no histórico do animal e na lactação encerrada. Depois, é possível acrescentar, corrigir, substituir ou retirar o vínculo com motivo e histórico. Registrar peso isoladamente não encerra lactação. Data e localização precisam corresponder ao encerramento comprovado; reutilizar conserva tipo, origem e precisão. Reabrir a lactação revoga o vínculo ativo, preservando a pesagem. Na conciliação dos 100 pesos de secagem identificados no IDEAGRI, falta de evidência deixa a associação pendente, sem inventar lactação ou data. Código disponível não indica que esses dados já foram carregados.

Idade gestacional desde IA/cobertura vinculada é uma referência operacional. TE precisa considerar idade embrionária; o contexto atual conserva essa pendência em vez de tratar a data da transferência como fecundação exata. A análise de indicadores possui suas regras próprias de deslocamento, que não completam a ficha individual automaticamente.

## Protocolos e IATF

Protocolo é uma versão de planejamento. Momentos agrupam ações; participação liga animal e versão; tarefa representa o que deve ser realizado. Programação reúne participações num contexto coletivo. A mesma base atende sanitário/reprodutivo e individual/coletivo.

Aplicação, exame, tentativa, avaliação, manejo e retirada de dispositivo usam os executores comuns. A confirmação revalida a prévia e é idempotente: repetir o mesmo pedido não cria outro fato. Adiar ou não atender não administra produto, não insemina e não diagnostica.

Na consulta histórica, **Sem tentativa vinculada** descreve a ausência de vínculo registrado com a participação. **IA não prevista neste modelo histórico** depende das etapas da versão, sem dedução pelo nome do protocolo: um modelo com TE ou somente preparação não fica incompleto por não ter IA. Etapas e fatos avulsos posteriores permanecem separados; datas próximas não atribuem vínculo nem sucesso ao protocolo. O acesso à ficha preserva o contexto de retorno e permite consultar os mesmos fatos.

O executor HTTP comum atual aceita versão 1, até cem tarefas de animais distintos da mesma ação/contexto. A proposta antiga de atendimento por exceção de um momento inteiro com várias ações não está integralmente implementada. Visitas têm coordenação transacional própria entre grupos; isso não significa que o endpoint comum aceite um envelope v2.

## Visitas, demandas e retorno

Agenda do dia reúne demandas previstas; Seleção livre permite escolher animais por critérios. Ambos chegam à preparação, revisão, impressão e atendimento. A lista impressa é planejamento, não prova de realização. Transcrever o campo deve criar os mesmos fatos consultáveis na ficha/protocolo.

Políticas de acompanhamento definem DG após tentativa e reconfirmações após positivo. Uma demanda conserva âncora, regra e previsão. Inconclusivo pode concluir uma tarefa executada e manter a demanda clínica pendente. Demandas originadas por protocolo sem prazo comprovado mostram “Sem data definida”.

Anular a evidência de origem pode reabrir uma pendência e bloquear sua resolução até regularização. Atraso sinaliza trabalho pendente; não prova prenhez, vazio, perda ou culpa da equipe.

## Indicadores e limites de leitura

As consultas de partos e indicadores usam período e sítio explícitos. Taxas precisam de numerador, denominador e cobertura coerentes; contagem de tentativas não é contagem de animais únicos. Base elegível considera o histórico, PEV, políticas e pendências, não apenas o status atual.

A metodologia V2 de indicadores conserva estimativas declaradas e diagnósticos abertos separados dos resultados conhecidos. Não presuma que uma vaca sem diagnóstico está vazia para melhorar artificialmente o denominador. Perdas posteriores não apagam concepções comprovadas. Emissões preservadas conservam a metodologia e as fontes usadas.

## Implementação e verificações

Rotas em `server/src/routes/pecuaria/reproducao.ts`, `visitas.ts` e `protocolos-operacao.ts`; serviços em `server/src/services/pecuaria/reproducao/` e `protocolos/`. `regras.calc.ts`, `contexto-animal.calc.ts`, `elegibilidade.calc.ts` e `indicadores.calc.ts` separam os cálculos da persistência.

TentativaReprodutiva, GestacaoAnimal, PartoAnimal, CriaParto, LactacaoAnimal, RestricaoReprodutiva, PoliticaElegibilidadeReprodutiva, VinculoPoliticaCiclo e DemandaAcompanhamentoReprodutivo conservam fatos e decisões. ExameAnimal/InterpretacaoReprodutiva são a base comum de avaliação; views antigas não recebem escrita paralela.

Testes próximos desses cálculos e integrações verificam cronologia, intervalos, estados, custos e efeitos. Referências completas: [Reprodução](../pecuaria/reproducao.md), [Protocolos](../pecuaria/protocolos-exames.md) e [estados do animal](../pecuaria/estados-animal.md).
