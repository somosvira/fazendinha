# Estados do animal: eixos, evidências e transições

O animal não tem um único status capaz de representar sua vida. O estado exibido é uma composição de dimensões na data de referência. Esta matriz descreve a V5 integrada e distingue valores persistidos, projeções calculadas e conceitos ainda sem estado próprio. A explicação para usuários está no [guia do Rebanho](../guia/04-pecuaria-rebanho.md) e no [ciclo reprodutivo](../guia/05-pecuaria-reproducao.md).

## Matriz de dimensões

| Eixo | Estados/valores | Fonte e por que existe |
|---|---|---|
| Identidade | Sexo F/M; origem NASCIDO/COMPRADO; identificação definitiva/provisória quando aplicável | Animal; conserva o indivíduo mesmo depois de trocar brinco/contexto |
| Atividade no rebanho | Ativo no recorte ou baixado por VENDA, ABATE, MORTE, DOACAO, EXTRAVIO; CADASTRO_INDEVIDO é correção interna | Entrada e BaixaAnimal; distingue decisão de descarte de saída efetiva |
| Localização | Sítio e lote na data; ausência ou sobreposição explícitas | LocalizacaoAnimal; determina escopo, consumo e atribuição histórica |
| Categoria | Resultado das regras configuráveis ou exceção manual vigente | CategoriaAnimal/CategoriaManualAnimal; não é gestação ou finalidade |
| Finalidade | LEITE, CORTE, REPRODUCAO; evidência temporal pode faltar/conflitar | FinalidadeAnimal; indica destinação operacional por período |
| Papel reprodutivo | NENHUM, DOADORA, RECEPTORA; estado da resolução CONHECIDO, DESCONHECIDO, CONFLITO | PeriodoReprodutivoAnimal; função naquele intervalo, sem substituir genética ou finalidade |
| Situação reprodutiva | DESCONHECIDA, VAZIA, APTA, AGUARDANDO_DIAGNOSTICO, GESTANTE | Projeção de situação inicial, tentativa, exame/interpretação, gestação e parto |
| Elegibilidade | ELEGIVEL, NAO_ELEGIVEL, PENDENTE; motivos, política e decisão | Cálculo temporal da aptidão operacional; diagnóstico não basta |
| Restrição reprodutiva | Restrições vigentes e marcação DESCARTE; encerramento/reversão explícitos | RestricaoReprodutiva e regras sanitárias; impede/alerta ações sem dar baixa |
| Produção biológica registrada | LACTANTE, SECA, NAO_INFORMADA | LactacaoAnimal e validade do parto; mede evidência produtiva, não volume |
| Sanidade | Ocorrências vigentes/encerradas, aplicações, exames e revisões | Conjunto de fatos; não existe conclusão global automática de saudável |
| Carência | Leite e carne separadamente: nenhuma registrada, não informada, não aplicável ou prazo conhecido; revisão quando aplicável | Snapshots de aplicações; não equivale à natureza de uma origem de leite |
| Nutrição | Dieta vigente, fechamentos confirmados/estornados, participação e cobertura | Relações com lote/período; não é um campo único nem prova de ingestão |
| Protocolos/acompanhamento | Planejamento, participação, tarefas pendentes/realizadas/dispensadas e demandas clínicas | Estado da tarefa e estado clínico podem divergir legitimamente |

Os nomes de leitura “ativo”, “baixado”, “ocorrência vigente” e “dieta vigente” não são apresentados aqui como um novo enum no Animal. São projeções das entidades existentes. Sexo/categoria também restringem a aplicabilidade: não se deve exibir fêmeas adultas como modelo universal de todo o rebanho.

## Reprodução: transições por fatos

| Origem | Evento | Resultado possível | Eixos que não mudam por esse evento isolado |
|---|---|---|---|
| Desconhecida | Situação inicial comprovada | Vazia ou Apta inicial | Lactação, carência, finalidade |
| Vazia/apta com guardas satisfeitas | IA, TE ou cobertura observada | Aguarda diagnóstico | Não confirma gestação; não encerra lactação |
| Aguarda diagnóstico | Negativo conclusivo | Vazia | Não prova liberação clínica |
| Aguarda diagnóstico | Positivo | Gestante | Não muda finalidade/papel nem interrompe produção |
| Gestante | Reconfirmação ou sexagem | Mesma gestação acompanhada | Não cria nova tentativa/cria |
| Gestante | Perda comprovada | Vazia após encerramento | Não reinicia ciclo de tentativas como parto nem libera intervenção por si só |
| Gestante | Parto, inclusive aborto/natimorto | Encerra gestação; novo ciclo de tentativas | Lactação só inicia quando informada; aborto não a presume |
| Qualquer contexto | Exame inconclusivo/aguardar | Mantém conclusão válida e/ou pendência | Não presume vazio, prenhez ou perda |
| Qualquer contexto | Anulação/correção | Recalcula pelos fatos válidos e trata dependências | Não apaga efeitos físicos já ocorridos |

O código prioriza gestação operacional aberta e, nos demais casos, a evidência conclusiva mais recente, com prioridades para desempate. Intervalos e sobreposições são validados separadamente. A simples passagem dos dias não produz parto, diagnóstico ou secagem.

## Lactação: o que cada rótulo prova

LACTANTE exige uma lactação vigente única e vínculo de parto válido quando existente. SECA exige encerramento comprovado, sem lactação vigente e sem parto posterior que torne aquela conclusão insuficiente. NAO_INFORMADA cobre ausência de história e situações sem evidência única/confiável.

`SEM_LACTACAO` existe no tipo de contexto, mas o cálculo atual não o retorna por falta de histórico. Não apresentá-lo como status já inferido para todas as novilhas. Se for necessário comprovar “nunca lactou”, é preciso definir fonte/critério próprio e sua adoção; a ausência de registros não o comprova.

DEL é D0 no início da lactação e nulo após encerramento. Dias pós-parto, idade gestacional, dias desde tentativa e dias desde confirmação têm âncoras distintas. Uma transferência entre sítios não reinicia nenhum desses relógios.

## Combinações coerentes

| Exemplo didático | Combinação | Explicação |
|---|---|---|
| Vaca após novo diagnóstico positivo | Ativa + Leite + NENHUM conhecido + Gestante + Lactante | Gestação e lactação se sobrepõem |
| Receptora produtora | Ativa + Leite + Receptora + Gestante + Lactante | Papel gestacional não muda finalidade nem mãe genética |
| Pré-parto com secagem registrada | Ativa + Gestante + Seca | Encerrar lactação não encerra prenhez |
| Vaca tratada durante lactação | Lactante + ocorrência vigente + carência do leite | Produzir volume não significa poder comercializá-lo |
| Matriz marcada para descarte | Ativa + restrição DESCARTE + Lactante | Continua no rebanho até baixa; não autoriza nova intervenção reprodutiva |
| Entrada sem documentos clínicos | Ativa + reprodução desconhecida + produção não informada | Cadastro não completa a história clínica |

Essas combinações são exemplos de coexistência, não presets gravados nem recomendações de tratamento.

## Combinações que exigem esclarecimento

Lactações, localizações ou gestações sobrepostas não autorizam escolher arbitrariamente a primeira linha. Papel ausente não vira NENHUM. Finalidade atual não reclassifica uma produção antiga. Parto sem lactação informada não prova automaticamente LACTANTE; sem registro, também não prova SECA.

Uma origem leiteira não comercial não vira comercial quando a vaca sai da carência. Um animal sem exames/ocorrências não ganha o status SAUDAVEL. Leite de descarte não equivale a animal de descarte e não prova descarte físico do leite.

## Por que não criar mais um status global

“Em pós-parto”, “em PEV”, “em protocolo”, “aguardando DG” e “com custo pendente” respondem a perguntas diferentes. Pós-parto tem uma data; PEV depende da política; protocolo tem tarefas; DG depende de evidência; custo depende de cobertura. Fundi-los perde informação e gera transições erradas.

Se for necessário destacar anestro, cio observado, pré-parto, histórico nunca lactante ou adequação nutricional, primeiro definir fato de origem, responsável, data, condição de encerramento e tratamento do desconhecido. Esses rótulos não estão sendo implementados nesta documentação. Os requisitos em aberto estão em [lacunas](../lacunas.md).

## Fontes da implementação

- `server/src/services/pecuaria/reproducao/regras.calc.ts`: situação e contadores.
- `server/src/services/pecuaria/reproducao/contexto-animal.calc.ts`: lactação, DEL, localização, gestação e pendências na data.
- `server/src/services/pecuaria/reproducao/elegibilidade.calc.ts`: política, decisão, restrição e elegibilidade.
- `server/src/services/pecuaria/rebanho/papel-reprodutivo.calc.ts`: papel e evidências por período.
- `server/src/services/pecuaria/leite/finalidade.calc.ts`: finalidade histórica e exceção comprovada da baixa.
- `server/src/services/pecuaria/sanidade/carencia.calc.ts` e `leite/carencia-producao.ts`: prazos e elegibilidade comercial.
- `server/src/services/pecuaria/nutricao/animalDias.calc.ts`: permanência histórica e animal-dias.

Os testes homônimos e os testes de rotas/integração próximos dessas fontes preservam os casos de fronteira. Schema e baseline SQL complementam as validações de serviço; essa inspeção não executa nem homologa todos os cenários.
