# Pecuária · Sanidade

## Conceito: ocorrência, tratamento e evidência

Ocorrência registra um problema acompanhado. Aplicação registra produto administrado. Exame registra coleta e resultados. Protocolo planeja ações; tarefa agenda uma realização. Carência representa uma restrição temporal associada à evidência de aplicação. Esses fatos podem se relacionar, mas um não prova automaticamente o outro.

Não existe um diagnóstico global de “saudável” por ausência de ocorrências. Encerrar um caso não comprova cura de todas as condições do animal. Uma aplicação pode ocorrer preventivamente; um exame pode ser inconclusivo.

## Rotina operacional

1. Selecione animal e data no sítio do fato.
2. Registre ocorrência com doença/classificação e observação disponíveis, quando houver um caso a acompanhar.
3. Registre a aplicação real: produto, origem, quantidade/unidade, precisão da data/hora, responsável e carências informadas.
4. Se houver exame, registre a coleta; informe resultados quando conhecidos, no formato original.
5. Acompanhe retorno, tarefas e restrições. Não concluir pelo silêncio do histórico.
6. Encerre/corrija/anule com motivo, preservando fatos e dependências.

Datas de aplicação são diferentes da data do lançamento. Perfil atual de um produto não substitui o snapshot usado numa aplicação passada. Alteração retroativa precisa considerar leite produzido/vendido e demais fatos afetados.

## Origens e custos

Estoque exige saldo/partida e gera saída vinculada. Compra direta destina material comprovado sem criar outro estoque nem despesa. Origem documentada e reconciliação preservam evidência e compatibilidade de unidade/produto. Equivalência de produto exige a confirmação prevista no fluxo, sem troca silenciosa.

Serviço financeiro pode reunir procedimentos realizados. Parcela monetária é opcional e zero difere de não informado. Material incluído em pacote não é somado de novo. O custo direto do animal reúne fontes identificadas, não soma repetidamente os resumos da aplicação, protocolo e visita.

## Carência de leite e carne

Carências de leite e carne são calculadas separadamente. O prazo vem da aplicação histórica e da precisão disponível. Com apenas data, o cálculo adota uma referência conservadora no fim do dia local e identifica aproximação; não inventa horário exato.

| Estado/contexto | Significado |
|---|---|
| Prazo conhecido e ativo | Existe restrição até o instante calculado |
| Prazo zero informado | Evidência explícita de zero; diferente de campo vazio |
| Prazo conhecido encerrado | Aquele prazo terminou; outras restrições continuam sendo consideradas |
| `NAO_INFORMADO` | Falta prazo; não equivale a liberação |
| `NAO_APLICAVEL` | A carência não se aplica ao destino conforme o registro |
| `NENHUMA` | Nenhuma aplicação no conjunto consultado; não é certificado de saúde |
| Em revisão | Administração/dados não confirmados exigem esclarecimento |

Na produção, essa evidência é apresentada como SEM_RESTRICAO_REGISTRADA, EM_CARENCIA ou NAO_AFERIVEL. Comercialização valida o contexto da produção; expiração posterior não torna comercial a origem restrita. Não há escolha de prazo clínico universal pelo software.

## Correção de aplicação com material já usado

Anular o lançamento pode manter o consumo. Nesse caso é preciso distinguir administração confirmada, descarte sem administração e informação não confirmada. Administração confirmada conserva a evidência de carência; informação não confirmada deixa o contexto em revisão. Uma aplicação substituta válida pode assumir o vínculo clínico sem duplicar o consumo.

O sistema não devolve ao saldo utilizável uma dose realmente usada só porque o registro foi corrigido. Também não conserva um diagnóstico falso por conveniência contábil: fato clínico e efeito físico precisam de regularização coerente.

## Exames e resultados

O tipo define campos, unidade e formato. Depois da primeira coleta, inclusive pendente/anulada, ou do uso em protocolo publicado, esse formato fica protegido; mudanças exigem versão nova. Coleta sem resultado não é negativo, zero ou falso.

Resultados e interpretações reprodutivas compartilham ExameAnimal, evitando dois exames para o mesmo atendimento. Várias observações podem existir no mesmo fato. Qualidade do leite reutiliza o núcleo para amostras individuais e tem suas guardas e anexos próprios.

## Protocolos individuais e coletivos

Versão publicada define ações e momentos. A programação/ciclo reúne participações; cada animal mantém suas tarefas, datas e fatos. Adicionar participante não recalcula os anteriores. Retirar exige motivo e encerra pendências; reentrada cria outra participação.

Prévia de execução mostra planejado, realizado, diferenças, carências e consumo. Data, dose, produto, unidade, via ou tipo divergentes exigem os motivos do contrato. Snapshot antigo ausente significa desvio não aferido, não execução conforme.

Não atendimento e adiamento são eventos de tarefa. Não administram produto e não geram resultado clínico. Tarefa concluída com exame inconclusivo pode deixar acompanhamento clínico em aberto. Listas paginadas não mudam o conjunto da confirmação.

## Interface e leitura dos estados

Sanidade reúne ciclos, tarefas, ocorrências, aplicações e exames; a ficha oferece o contexto individual. Visões gráficas complementam tabelas e precisam declarar recorte. O progresso de tarefas é operacional, sem afirmar eficácia do tratamento.

Tags anunciam ocorrência vigente e participação comprovada. Programação futura é diferente de protocolo iniciado. Participação sem pendências pode deixar de aparecer como ativa; necessidade de regularização continua visível. Erro de leitura não significa ausência de doença.

Restrições reprodutivas por doença/ação dependem de configuração por sítio, podendo alertar ou bloquear. Não são inferidas de qualquer ocorrência. Encerrar uma ocorrência não remove outras restrições ou carências independentes.

## Implementação e verificações

Rotas em `server/src/routes/pecuaria/sanidade.ts`, `rodadas.ts`, `execucao-etapas.ts` e protocolos comuns. Serviços em `server/src/services/pecuaria/sanidade/`, `exames/` e `protocolos/`. OcorrenciaSanitaria, AplicacaoProduto, ExameAnimal, ResultadoExame, InterpretacaoReprodutiva e o núcleo Protocolo/Participacao/Tarefa preservam fatos e snapshots.

Testes de carência, desvios, permissões, consumos, versões e execução atômica acompanham os serviços e rotas. Referências: [Pecuária](../pecuaria/README.md) e [Protocolos e exames](../pecuaria/protocolos-exames.md).
