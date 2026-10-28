# Alertas da Pecuária e programação sanitária

Este contrato descreve o núcleo de alertas e seu primeiro produtor, Sanidade: regras por idade/data fixa, programação por meses, consultas e vínculos de atendimento. Backend e interfaces estão codificados localmente; integrações com PostgreSQL foram exercitadas com fixtures próprias. A validação visual integrada e a liberação operacional conservam os gates abaixo. Isso não comprova disponibilidade em ambiente publicado ou homologação da fazenda.

## Conceitos e responsabilidades

Um **cuidado** agrupa necessidades individuais de uma regra ou edição, dentro do sítio operacional. Uma **necessidade** identifica o atendimento de um sujeito naquela origem; realizar um participante não realiza o grupo. O **alerta** é a publicação persistida dessa necessidade, com identidade, resumo, evidência do disparo e histórico próprios. Nenhum desses registros comprova, sozinho, uma aplicação, exame ou tarefa realizada.

O núcleo fica em `server/src/services/alertas/` e contém contratos, registro e publicação/eventos, sem consulta clínica. A fachada SQL agrupada fica em `server/src/services/pecuaria/sanidade/alertas/consulta-alertas.ts`: consulta o que foi persistido e não descobre condições sanitárias a cada GET. Os serviços em `services/pecuaria/sanidade/alertas/` e `services/pecuaria/sanidade/programacoes/` avaliam público, calendário, decisões e fatos. A independência é de responsabilidade dentro do mesmo backend e Worker, sem outro serviço ou provedor.

| Estrutura | Responsabilidade |
|---|---|
| `public.Alerta` | Identidade, ciclo comum, resumo atual, snapshot inicial, referências de origem e prazo |
| `public.EventoAlerta` | Publicação por revisão, comando, hash, conteúdo e autoria humana/técnica |
| `public.AvaliacaoAlertas` | Cobertura temporal, cursor, posse/lease e resultado do processamento |
| `pecuaria.RegraAlertaSanitario` / `RevisaoRegraAlertaSanitario` | Condição por idade ou data fixa e configuração histórica |
| `pecuaria.NecessidadeSanitaria` | Necessidade regra + animal, decisões e vínculos de aplicação/protocolo |
| `pecuaria.ProgramacaoSanitaria` / `NecessidadeProgramacaoSanitaria` | Planejamento mensal e necessidades por edição ou elegibilidade |
| `pecuaria.VinculoAtendimentoAlerta` | Exclusividade do fato usado como evidência entre necessidades de regra e de programação |

O proprietário estável da publicação sanitária é `fazendinha`. A unicidade comum é proprietário + produtor + tipo + chave da ocorrência. Esse proprietário não é o sítio atual do animal. `propriedadeId` representa o contexto operacional autorizado; uma transferência não cria outra identidade de cuidado. O sistema reutiliza a resolução de escopo existente e não introduz uma ACL de sítios por pessoa que a base atual não possui.

## Regras por idade e data fixa

O cadastro aceita **idade OU data fixa**, com produto sanitário compartilhado ou protocolo sanitário publicado/ativo. Produto cadastrado, regra inativa e publicação habilitada são condições diferentes. O público contém sítios, sexo opcional e faixa de idade configurada; peso não participa do disparo ou da elegibilidade.

Idade usa meses completos de calendário, compartilhando a semântica do Rebanho. Não usa meses de 30 dias: nascimentos no fim do mês e em 29/02 conservam as bordas do cálculo existente. O nascimento estimado continua identificado. Data fixa é uma data civil explícita; uma ocorrência isolada não recebe repetição anual automática. As datas operacionais usam o dia da fazenda em `America/Sao_Paulo`.

A antecedência torna a necessidade próxima; o alcance da idade/data torna-a pendente. Atraso é projeção operacional após o prazo configurado, sem conclusão clínica. Adoção após a data teórica ou entrada posterior no público exige conferência inicial, preservando a referência original sem fabricar atraso anterior à adoção.

Salvar cria regra inativa. A prévia apresenta público, situação e aplicações candidatas, sem tratar coincidência de produto como atendimento. A ativação confirma revisão e base calculada com regra, público, destinos e dia; mudança concorrente exige outra prévia. Revisar/inativar exige motivo e destino explícito das abertas (`MANTER` ou `ENCERRAR`). Necessidades anteriores conservam sua revisão; a alteração não reinicia atendimentos concluídos.

As regras reprodutivas por doença (`RegraSanitariaReprodutiva`) são outro contrato; não são convertidas, reativadas ou tratadas como regras de medicação por semelhança de nome. Cadastros de medicação relatados pela fazenda exigem identificação e reconciliação explícitas antes de reaproveitamento.

A identidade sanitária por idade/data fixa é regra + animal. Revisão do cadastro, correção de data ou transferência não autoriza gerar uma segunda necessidade. Uma dose intencionalmente diferente precisa de identidade própria e decisão explícita da fazenda.

## Programação mensal e calendário

A programação aceita nome, tipo `VACINACAO`, `VERIFICACAO` ou `VERMIFUGACAO`, meses de 1 a 12, ano opcional, vigência, precisão, recorrência, produto/procedimento, público, fonte e observação. Cadastrar permanece inativo e não publica.

- `MES` mantém janela mensal e `dia: null`: a interface informa **Dia a definir**. Os limites da janela não são uma aplicação marcada no primeiro/último dia.
- `DIA` exige dia informado e válido para a janela consultada; não normaliza um dia inexistente para outro mês.
- `JANELA_ELEGIBILIDADE` conserva a mesma necessidade por sujeito entre meses e anos; abrir outra janela não cria nova dose.
- `CAMPANHA_ANUAL` usa edição explícita por ano/mês selecionado e sujeito. Concluir uma edição não conclui a seguinte.
- `SEM_REPETICAO` conserva ocorrência única e exige ano para ativação.

Mês do calendário é diferente de meses de vida. O ano escolhido na consulta não preenche o ano ausente no cadastro. Uma ocorrência única com dia explícito perdida na adoção entra em conferência inicial com a referência original. Nas recorrentes diárias, a recuperação considera a última janela vencida após a ativação; não cria campanhas históricas anteriores à adoção nem doses adicionais por pressuposto. A matriz devolve doze meses; a consulta mensal e a célula anual abrem o mesmo identificador de evento, derivado de programação + ano/mês. Totais de previstos, atendidos e pendentes vêm das necessidades individuais; ausência de execução não é realização nem atraso inventado.

A ativação exige público conferido, início de vigência e destino/executor factual compatível. O avaliador atual aceita sexo e faixa de idade; `criterioPendente` bloqueia ativação. Gestação, amamentação, histórico vacinal ou outros critérios clínicos não são inferidos do nome da atividade. Aplicação exige produto; verificação sem insumo pode usar procedimento e tipo de exame compatível com Sanidade. Objetos lote/sítio podem ser cadastrados para planejamento, mas permanecem bloqueados enquanto não houver executor apropriado; não são transformados em animais artificiais.

O calendário fornecido pela fazenda é referência humana em [calendario-fonte.md](../design/alertas/mockup-v1/calendario-fonte.md). Suas atividades não são importadas ou ativadas automaticamente. Ano, produto do sistema, público verificável, significado da recorrência e evidência de execução precisam ser conferidos por atividade (gate G3). O rodapé de 21 dias não produz reforço automático. Fonte sem ano/dia continua sem esses dados.

### Um cuidado compartilhado entre regra e programação

`regraEquivalenteId` é um vínculo explícito e exclusivo, sujeito à conferência de sítio, público, destino e semântica. Coincidência de produto ou de mês não cria equivalência. Programação de campanha não reutiliza, por pressuposto, a necessidade única de uma regra.

Quando há equivalência válida, a necessidade de programação aponta para `regraNecessidadeId` e para o mesmo `alertaId` da regra. O atendimento continua na origem da regra; não cria outra aplicação nem outro alerta. Sem equivalência, a programação tem necessidade/alerta próprios. O ledger factual impede usar a mesma aplicação/exame para satisfazer necessidades independentes.

## Publicação, leitura e cobertura

`publicarAlertaTx` recebe a transação do produtor, referências concretas, revisão, comando, resumo registrado e autoria. Tipo/versão não registrados são recusados. O registro de resumos limita os dados operacionais admitidos; resumo não é um campo livre para custos ou conteúdo de outro domínio.

A mesma revisão/conteúdo recupera a identidade já publicada; conteúdo divergente conflita. Revisão antiga não sobrescreve a nova. Encerramento ou invalidação não é reaberto por publicação tardia: reabertura exige comando explícito. `snapshotInicial` conserva a evidência original; resumo atual e detalhe autorizado na origem têm funções distintas. A consulta não publica nem registra fatos.

Central, resumo da Visão geral, resumo da ficha e agenda usam as identidades persistidas. Busca/escopo/filtros entram antes de contagem, agrupamento e paginação. Contagens distinguem cuidados, necessidades e animais únicos. O detalhe revalida o contexto do animal antes de liberar a evidência; origem removida/indisponível tem estado próprio. Respostas de alerta não contêm valores financeiros.

O Worker possui handler `scheduled`, mas `ALERTAS_CRON_ENABLED` é `false` por padrão e `wrangler.jsonc` não habilita cron de ambiente. O handler cria e encerra seu próprio Prisma Client, separado do contexto HTTP. O avaliador processa lotes de até 50 sujeitos/necessidades, com fases de regras, reconciliação de programação e publicação de programação; cursor e alterações do lote confirmam na mesma transação. A trava e a posse/lease protegem execução concorrente. Produtores usam as mesmas identidades de trava do animal e da configuração, com tentativas sem espera: um conflito desfaz o lote e libera o checkpoint antes de uma repetição limitada. A gestão confere a revisão ao encerrar necessidades para não sobrescrever uma decisão concorrente. Uma invocação tem limite de lotes e pode retornar parcial para retomada.

A consulta expõe `ATUALIZADA`, `DESATUALIZADA`, `FALHA` ou `NAO_AVALIADO`, com dia coberto e última conclusão. Lista vazia com cobertura ausente/falha não significa que não há cuidado necessário. Inativar produto, protocolo ou tipo de exame sinaliza reavaliação; não dispara uma varredura ampla de necessidades dentro da gravação do cadastro. Não há SLA ou processamento diário habilitado em ambiente por este código.

## Atendimento, decisões e continuidade

A aplicação usa o executor sanitário existente. Fato, estoque/carências pertinentes, autoria, vínculo, ledger e publicação do atendimento pertencem à mesma transação. Reenvio recupera o recibo idempotente; erro de publicação deve desfazer o conjunto. O coletivo conserva o limite de 100 animais e a seleção explícita, sem concluir um grupo inteiro ou prometer sucesso global implícito de vários blocos.

Reconhecer aplicação histórica exige confirmação de compatibilidade, animal e sítio histórico válidos. Produto coincidente não basta. Adiar conserva a ocorrência/período e registra motivo/data; a agenda usa a nova data operacional sem substituir a referência original; dispensar é decisão, sem aplicação fictícia. A anulação do fato mantém a referência e leva a necessidade a revisão, sem supor ausência de administração ou reaplicação automática.

Programar protocolo vincula a participação do núcleo comum. Tarefa prevista não é fato realizado; a conclusão depende da evidência válida das tarefas. Regularização/anulação deve conservar o histórico e reavaliar a necessidade. A reconciliação protocolar resolve apenas as revisões factuais que ela própria produziu; revisões de contexto (transferência, cadastro ou destino) permanecem até conferência na origem, mesmo com tarefas concluídas. Os motivos factuais canônicos persistidos exigem compatibilidade ao alterar sua redação. Verificação por exame só atende a programação própria com tipo compatível, fato válido e resultado realizado; coleta sem resultado ou exame não realizado não comprova atendimento. Correção/anulação da evidência leva a revisão.

Eventos de cadastro, localização e baixa reavaliam a continuidade no domínio. Uma baixa pode encerrar a atenção sem realização; transferência conserva identidade e exige conferência de contexto, inclusive entre sítios abrangidos pela mesma regra; o histórico encerrado acompanha o sítio operacional atual, preservando o sítio factual e a evidência original; correção depois de decisão não reescreve silenciosamente o atendimento. Inativação/revisão da configuração não apaga necessidades ou fatos anteriores.

## Interface e API

As consultas codificadas incluem central por cuidados, participantes paginados, histórico separado, detalhe com evidência/origem, resumos na Visão geral e ficha, calendário mensal/anual e PDF. A rota de calendário é `/pecuaria/sanidade/calendario`, com alias anterior em `/pecuaria/rebanho/sanidade/calendario`. Ciclos/Tarefas e suas URLs permanecem disponíveis. A prévia G2 foi aprovada pelo usuário. A configuração de regras e programações possui código de listagem, cadastro inativo, prévia, ativação e revisão/inativação com destino das abertas em `/configuracoes/pecuaria/sanidade/alertas`. Programações usam o DTO completo de gestão para preservar ano ausente e demais campos originais; não reconstroem o cadastro a partir do calendário. A interface inclui decisões individuais e aplicação coletiva pelos executores existentes. A inspeção integrada em navegador continua sendo um gate próprio; existência de componentes/endpoints não comprova homologação.

O PDF é gerado no cliente a partir da consulta anual autorizada de exportação. Inclui todos os meses/atividades do escopo, nomes dos sítios e ano consultado, sem truncar na página da tela ou reutilizar a transcrição fictícia. Marcação de mês indica planejamento, não realização.

| Prefixo HTTP | Contrato |
|---|---|
| `/api/pecuaria/rebanho/alertas` | GET central, `/resumo`, `/cuidados/:chave/participantes` e `/:id` para detalhe |
| `…/alertas/regras` | GET/POST; POST `/:id/previa`, `/ativacao`, `/revisao` e `/inativacao` |
| `/api/pecuaria/rebanho/alertas/:id/decisoes` | POST de decisão com revisão esperada, motivo e chave de idempotência |
| `/api/pecuaria/rebanho/sanidade/programacoes` | GET por ano/mês, POST de cadastro inativo; POST `/:id/previa`, `/ativacao`, `/previa-revisao` e `/revisao` |
| `…/programacoes/cadastros` e `…/programacoes/:id/cadastro` | GET de configuração completa para consulta/edição, com ano original e escopo preservados |
| `…/programacoes/agenda-unificada` | GET de tarefas e alertas; participação já representada por tarefa evita segunda linha de alerta |
| `…/programacoes/exportacao` | GET anual completo, sem filtros parciais, com metadados do escopo |
| Rotas sanitárias existentes | Aplicação/exame recebem vínculo de alerta e revisão, mantendo as validações dos executores |

A agenda unificada retorna `propriedadeId` e `participacaoId` por item. Na tarefa, são o sítio factual e a participação do protocolo; no alerta, são o sítio operacional e participação nula. O filtro de população corrente usa a localização atual separadamente. No Consolidado, abrir detalhe/executor usa esses campos explícitos; contexto legado nulo não autoriza inferir sítio pelo cabeçalho.

Essas rotas exigem pessoa real ativa e área Pecuária; a ponte `SHARED_ACCESS_TOKEN`/dono sintético não constitui sessão válida para o recurso. Gestão exige permissão para lançar e acesso a cadastros (ou dono); decisões exigem lançar; exportação exige `exportar` no servidor. O sítio selecionado e o histórico do fato continuam sendo conferidos. Ocultar ação no cliente não autoriza escrita.

## Validação e limites de liberação

Os testes próximos do código cobrem publicação/revisões, datas de calendário, idade, recorrência, autorização, paginação, progresso parcial, ledger, rollback propagado e contratos de consulta/exportação. Para conferir o recorte unitário, com flags de integração desabilitadas e ambiente de testes configurado:

```sh
pnpm --filter rionovo-server exec vitest run src/services/alertas src/services/pecuaria/sanidade/alertas src/services/pecuaria/sanidade/programacoes src/routes/pecuaria/alertas.test.ts src/routes/pecuaria/atendimento-alertas.test.ts src/routes/pecuaria/programacoes-sanitarias.test.ts src/worker.test.ts
pnpm --filter rionovo-client exec vitest run src/pecuaria/rebanho/alertas src/pecuaria/rebanho/sanidade/ProgramacoesSanitariasConfig.test.tsx src/pecuaria/rebanho/sanidade/programacoes-config-api.test.ts
```

Integrações opt-in exigem revisão prévia das fixtures/limpeza e, localmente, somente `fazendinha_seedatev3`. As fixtures próprias de alertas/programações validam conexão efetiva antes de escrever e removem seus próprios IDs, sem reset, seed ou recriação estrutural. As integrações PostgreSQL exercitadas comprovaram publicação/replay e revisão concorrente, agrupamento/paginação de um conjunto volumoso de alertas, vínculo/anulação de aplicação e o percurso de programação com agenda unificada. O conjunto volumoso representa publicações e projeções de consulta de fixtures; não representa aplicações clínicas em massa. Os dados do seed foram preservados e nenhuma regra real da fazenda foi ativada.

As duas migrations aditivas de alertas foram aplicadas somente ao PostgreSQL local autorizado. Isso não altera o estado de ambientes remotos. Banco local com baseline consolidada exige conferir o histórico de migrations efetivo antes de qualquer aplicação; não reaplicar a cadeia antiga nem substituir migration por `db push`.

A validação automatizada, a inspeção em navegador, o CI remoto, a publicação e a homologação da fazenda são evidências separadas. Os percursos locais de interface possuem inspeção de desktop e tela pequena; CI remoto, publicação e homologação não são declarados concluídos neste contrato. O cron continua desabilitado, e o calendário real depende da conferência G3 por atividade. Não houve homologação clínica por existir cadastro, prévia ou fixture.

## Extensão por outras origens e tarefas

A integração de atendimento por protocolo não ativa um produtor autônomo de alertas de etapas. Os tipos abaixo continuam sem produtores ativos; exigem critério de domínio, identidade de episódio e resolvedor autorizado antes de entrar na central.

| Origem futura | Evidência e encerramento a definir |
|---|---|
| Previsão de parto | Gestação/previsão válidas; parto, perda ou correção reconciliam a atenção |
| Etapa de protocolo | Identidade da tarefa e sua situação factual, sem duplicar o procedimento |
| Intervalo após inseminação | Tentativa válida e finalidade explícita do acompanhamento; avaliação/correção/anulação vinculadas |
| Tempo sem manejo | Tipos de manejo e marco de acompanhamento conferidos; histórico insuficiente não significa falta de cuidado |
| Ocorrência sanitária prolongada | Ocorrência válida sem encerramento e limite configurado; informar duração do registro, sem afirmar doença persistente |
| Lembrete avulso | Título, data e contexto definidos por pessoa autorizada; conclusão sem simular fato clínico |

Uma futura tarefa/Kanban pode referenciar `alertaId` e sua origem/episódio. A tarefa não substitui a identidade da necessidade, a autorização ou o fato do domínio; uma conclusão genérica não pode gravar aplicação, exame ou encerramento clínico. Não existem tabelas ou execução de tarefas de trabalho nesta entrega.

Peso, prescrição, reforço automático pela última aplicação, sincronização contínua IDEAGRI e notificações externas permanecem fora do fluxo. A aprovação visual G2 não autoriza ativar uma atividade real sem G3, habilitar cron, publicar ou fazer deploy.
