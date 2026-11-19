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

## Aplicações no tablet

Sem um sítio selecionado, a página apresenta o estado vazio **Escolha um sítio**,
com o seletor centralizado. A seleção abre o fluxo no sítio escolhido e o navegador lembra essa escolha por usuário, validando-a contra os sítios ainda disponíveis no acesso. No uso diário não há seletor repetido: o contexto aparece junto ao título, e as abas Tablet, Aprovação e Templates reutilizam a navegação compartilhada. Um sítio explicitamente selecionado no contexto global prevalece e atualiza a preferência. Se o sítio salvo sair dos acessos, a página pede nova escolha sem consultar os dados do sítio anterior; enquanto
carrega ou quando não há sítios disponíveis, a página informa o estado correspondente.

Em Sanidade, **Aplicações no tablet** busca vacas do sítio por brinco exato ou
nome. Selecione uma ou mais vacas que receberam os mesmos itens e quantidades. A lista selecionada separa número e nome, mostra a contagem e oferece um botão X de 48px por animal para retirar apenas aquela seleção.
A lista oferece todas as apresentações sanitárias ativas do catálogo e os produtos locais, com a unidade de cada medicamento. Escolher um item do catálogo não cria saldo. Mesmo sem estoque, é possível enviar para revisão; a administração precisa registrar a entrada de estoque antes de aprovar. **Adicionar medicamentos** abre a lista rolável completa, com pesquisa interna e seleção de vários itens. A busca combina palavras e números em qualquer ordem, ignorando acentos, caixa e espaços. Por exemplo, “abamectina 20” encontra apresentações com ambos os termos; números são comparados integralmente, sem confundir 20 com 200. A mesma regra vale na configuração de templates e mantém os itens selecionados; as quantidades são informadas abaixo do seletor. Quantidades
fracionadas têm até três casas decimais, exceto UN, CX e SC, que exigem inteiros. Templates por doença são configurados por
sítio a partir do catálogo de doenças e produtos. A configuração permite informar a quantidade padrão por vaca, na unidade de cada medicamento; deixar o campo vazio conserva a ausência de um valor confirmado. Ao usar o template, quantidades configuradas preenchem apenas campos vazios, sem substituir valores já digitados. O operador pode retirar itens,
adicionar outros e informar quantidades por vaca na unidade exibida. O envio guarda os
itens, a data do fato e a autoria pela sessão.

Na etapa Medicamentos, **Selecionar doença**, no canto direito do cabeçalho,
abre os templates em modal e atualiza a lista no servidor, preservando vacas e medicamentos já selecionados. Assim, configurações salvas depois da abertura do tablet aparecem sem recarregar o fluxo. Falha de consulta apresenta erro e nova tentativa, sem afirmar ausência de templates. Após escolher a doença, o operador confere os itens
antes de adicioná-los. Em **Informações**, dados já confirmados aparecem com fonte e campos ainda não conferidos aparecem com seus motivos; a pendência de composição não esconde dosagem, via ou carências confirmadas. Dados de consulta não preenchem automaticamente a aplicação ou a aprovação. Cada medicamento selecionado mantém **Informações**, a
quantidade na unidade correspondente e o comando de remover na mesma linha.
Na revisão, a data usa o calendário do sistema e a hora é obrigatória em campo
próprio. Ambos conservam o horário de São Paulo e impedem informar aplicação futura.
O campo de hora aceita digitação em HH:mm ou escolha de hora e minuto pelo
seletor do sistema, sem abrir o controle nativo do navegador.
**Agora** preenche a data e a hora atuais de São Paulo sem exigir digitação.

Ao enviar, as ordenhas do sítio exibem o aviso de conferência. Uma ordenha aberta
atualiza a lista a cada 15 segundos sem recarregar o rascunho. Na classificação
sanitária da produção, uma aplicação pendente anterior à ordenha torna a
carência não aferível. Envio ou devolução não movimenta medicamento nem atribui
custo. A aprovação confere partidas, validade, saldo, data, impactos e carências
pelo fluxo sanitário existente. A confirmação é atômica e vincula o envio às
aplicações, baixas valorizadas e auditoria. Não gera novo pagamento.

O administrador pode devolver com motivo. O autor pode corrigir os itens em
novo envio vinculado, com as mesmas vacas e data. O original fica no histórico
e o aviso permanece até a aprovação do reenvio. As permissões **Enviar
aplicações pelo tablet**, **Revisar aplicações do tablet** e **Gerenciar
templates do tablet** são independentes e exigem acesso à Pecuária e sessão
individual. O perfil do tablet pode ser configurado sem acesso ao Financeiro
ou permissão geral de lançamento.

### Uso em tablet touch

A busca por brinco conserva o teclado numérico da página, sem abrir outro teclado. Nome e medicamento usam o teclado nativo de pesquisa com autocorreção, capitalização automática e sugestões ortográficas desativadas. A pesquisa de medicamentos possui ação de limpar com alvo de toque e conserva o filtro ao marcar itens.

Quantidades de aplicação e template usam teclado decimal nativo, aceitam vírgula ou ponto e selecionam o valor ao receber foco para facilitar sua substituição. Itens indivisíveis e carências usam teclado numérico inteiro; vazio em carências conserva prazo desconhecido, diferente de zero. A validação conserva limites e precisão de três casas. Avançar/Enter em quantidades e data/hora não envia o registro: a confirmação permanece no botão explícito. A data e a hora continuam com seletores próprios e o botão Agora.

Modais e listas acompanham a área visível do navegador quando o teclado abre, com rolagem interna e foco no campo ativo. Em dispositivos com ponteiro de toque, os campos mantêm pelo menos 16px e os principais botões recebem alvos de 48px. Zoom e gestos nativos permanecem disponíveis. A simulação no navegador verifica atributos e comportamento; abertura efetiva do teclado e ergonomia exigem homologação no tablet físico.
