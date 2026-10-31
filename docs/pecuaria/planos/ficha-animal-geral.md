# Plano de implementação — ficha do animal

Status: reorganização original integrada em staging; rodada v8 implementada localmente na branch `codex/etiquetas-ficha-animal`, com validação local concluída. A integração B com Bezerreiro permanece uma dependência separada, não executada nesta rodada. Consumo real de tokens não aferido. Sem publicação ou deploy desta rodada.

## Resultado pretendido

Reorganizar os componentes existentes, sem redesign: unir Resumo, Cadastro e Histórico em **Geral**, na ordem **Identificação → Filiação e composição racial → Peso → Histórico e auditoria**. Manter Produção, Reprodução, Sanidade e Nutrição, com a elegibilidade já vigente. Desmama e castração saem dos controles de Geral e passam à operação do Bezerreiro; seus fatos continuam no histórico do animal.

Este documento consolida as decisões atuais e substitui propostas anteriores conflitantes: não haverá Cadastro como segunda aba; ela será o primeiro conteúdo de Geral. Não haverá bloco Manejo dentro de Peso. A restrição a textos recolhíveis tem uma exceção explícita: os cabeçalhos dos quatro componentes pais de Geral recolhem seu conteúdo. Nos filhos de Peso não haverá recolhimento independente.

## Evidências e dependências

- `client/src/pecuaria/rebanho/telas/DetalheAnimal.tsx` concentra abas, cabeçalho, dados, permissões, filhos, peso e auditoria. O refactor deve preservar comandos e guardas de rascunho, não transplantar o HTML do mockup.
- `HistoricoAnimalVisual.tsx` agrega fatos de localização, finalidade, papel, peso e consultas sanitárias. Há limite explícito de 50 por consulta sanitária; a linha do tempo atual não comprova cobertura integral do histórico.
- `components/AuditoriaAnimal.tsx`, `lib/auditoriaRotulos.ts`, `api.ts` e `types.ts` já oferecem filtros, paginação e alterações legíveis. Servidor: `routes/pecuaria/rebanho.ts`, `services/pecuaria/rebanho/auditoria-animal.ts` e `auditoria.calc.ts`.
- `AuditoriaPecuaria` no schema tem `entidade`, `entidadeId`, `animalId`, `antes`, `depois`, `usuarioId` e `em`; `animalId` conserva a trilha até quando a linha original foi apagada. Não apagar esse caso ao unificar a apresentação.
- `PesoEGanho`, `GraficoPeso`, `SeletorPeriodoGmd`, `CardFicha`, `DadoFicha`, `SecaoFicha`, `SubTabs`, `DateRangePicker`, `LinhaTempoConsulta`, `CartaoConsulta` e os diálogos existentes são pontos de reaproveitamento. Mudanças compartilhadas devem ser opt-in ou comprovadamente compatíveis com outros consumidores.
- `ReproducaoIndividual.tsx` já mostra tentativas com a referência do ciclo. `AcoesReprodutivas.tsx` contém gestação/lactação e vínculos de crias. Contagem de partos segue o contrato de Reprodução, não `array.length` de uma página.
- O PR #343 (`codex/responsividade-densidade-ui` → `staging`) estava aberto na inspeção. O mockup importou componentes desse checkout, cuja versão já mudou durante a revisão. Reconciliar seu diff antes de implementar; não incorporar incidentalmente alterações desse PR.
- **Bezerreiro não está implementado na árvore de `staging` inspecionada.** Há implementação separada em `codex/bezerreiro-correcoes` (inspeção local em `8cf51d62`). `AcompanhamentoBezerreiro.tsx` avisa que a saída não registra desmama nem movimentação. A existência do módulo em outro checkout não prova a existência dos dois comandos nem sua integração em STG. Não fazer merge dessa branch como efeito colateral.
- Contratos relacionados: [Pecuária](../README.md), [Reprodução](../reproducao.md), [Produção](../leite.md), [estados](../estados-animal.md), [busca global](../../busca-global.md), [frontend](../../../client/README.md) e [desenvolvimento](../../desenvolvimento.md). A baseline SQL e migrations posteriores permanecem intactas; não há migration pressuposta para esta reorganização.

### Referência visual e divergências conhecidas

Mockup local v4: `http://127.0.0.1:41879/v4/`. Não é endereço compartilhável fora da máquina e não integra a aplicação. Artefato local: `/Users/montes/.codex/visualizations/2026/10/30/01a18edd-2347-74f3-b6ab-cff6ebbce1bc/ficha-geral/`; fonte em `fonte-v2`, capturas em `v4`. Valores anteriores, autores e alguns estados são demonstrativos: nunca copiar para fixtures operacionais ou dados reais.

A referência foi atualizada para `v5/` nesta execução e comparada com a aplicação por Astra/high. Capturas reais estão no mesmo artefato local em `implementacao/`, incluindo desktop, móvel e modais. A v4 ainda contém Manejo e GMD separado da curva. As decisões posteriores neste plano prevalecem: retirar Manejo, renomear pai para Peso e reunir GMD/curva. A tarefa T1 deve atualizar a referência e apresentá-la antes de escrever a interface da aplicação, conforme AGENTS.md. A skill `impeccable` foi usada nas revisões; `frontend-design` não estava disponível na sessão. Procurar novamente no início de T1 e registrar a indisponibilidade se persistir, sem declarar revisão inexistente.

## Especificação de interface

### Navegação e composição

1. Abas na ordem Geral, Produção, Reprodução, Sanidade, Nutrição; preservar condicionais por animal e permissões. Usar a aparência de fichário já implementada em `SubTabs`/`abas.css`, sem inventar outra.
2. `#geral` será o destino canônico. Links antigos `#resumo`, `#cadastro`, `#historico` e `#auditoria` devem abrir Geral e revelar/posicionar a seção correspondente. Preservar `retorno`, sítio, filtros, preferência `visualHistoricoAnimal`, voltar/avançar e navegação por teclado. Não desmontar formulários com rascunhos ao recolher ou trocar abas.
3. Quatro cartões pais separados, com ícone, título de 16 px e ações contextualizadas. O título é um botão semântico com chevron, `aria-expanded`, `aria-controls`, foco e Enter/Espaço; abre inicialmente. Ações vizinhas não alternam o recolhimento. Link profundo revela a seção mesmo que esteja recolhida. Não aplicar o comportamento a todos os cartões do sistema.
4. Peso recolhe o conjunto completo; Evolução do peso e Últimas pesagens não têm controles de recolhimento. Histórico mantém título, alternância visual/tabela, busca, datas, filtros e registros dentro do mesmo componente.
5. Botões de ações devem parecer botões. Sem links de texto para detalhes, `details/summary` nos eventos ou painéis laterais. Auditoria/detalhes/filtros usam modal centralizado, padding, rolagem, fechamento por Escape e retorno de foco.

### Cabeçalho e cadastro

- Retirar Ativo; usar Baixado como indicação explícita quando houver baixa. Preservar motivo/data/restrições de escrita e a leitura na data da baixa.
- Retirar idade, peso e data do cabeçalho. A data ali hoje é a **data da última pesagem**, apesar de ter sido interpretada como nascimento na primeira anotação. Nascimento e idade ficam em Identificação; peso/data ficam na tabela de pesagens.
- Ampliar a imagem proporcionalmente à identidade textual (referência desktop 72 px), mantendo adaptação móvel e imagem padrão acessível.
- Preservar `DadoFicha`, ícones por campo e cartões de Identificação/Filiação. Observações do cadastro continuam sendo o campo livre existente, sem presumir interpretação do texto importado.
- Substituir a explicação da regra de categoria por etiqueta da categoria e botão **Categoria**. Manter no fluxo desse botão o modo automático/manual e a explicação da regra quando necessária à decisão; não retirar os comandos existentes.
- Mostrar filhos diretamente na seção, usando a consulta real e seus estados/paginação, sem botão “Consultar filhos”. Não inferir ausência de filhos quando a consulta falha ou não terminou. Conservar filiação interna/externa e composição racial.

Inventário das famílias de etiquetas do cabeçalho na base inspecionada (não lista finita de nomes de categorias/doenças configuráveis):

| Família | Valores/condições atuais | Decisão |
| --- | --- | --- |
| Situação | Ativo; baixa em resumo próprio | Remover Ativo; explicitar Baixado |
| Identificação | Brinco pendente / cadastro provisório | Preservar |
| Categoria | Nome configurável, Manual; sem categoria | Preservar; botão no cadastro |
| Finalidade | Leite, Corte, Reprodução; contexto na baixa | Preservar |
| Papel | Doadora, Receptora; NENHUM não exibido | Preservar |
| Reprodução | Gestante, Vazia, Reprodução a conferir | Preservar sem inferir estado por falta de dados |
| Carência | Leite, abate, ambos; a conferir | Preservar sinais e desconhecimento |
| Ocorrências | Nome da doença ou ocorrência aberta | Preservar evidência existente |
| Protocolos | Em protocolo reprodutivo / programado | Preservar |
| Falha de consulta | Ocorrências não consultadas / Protocolos não consultados | Preservar indicação de indisponibilidade |

Fontes: `CategoriaPill`, `StatusOperacionaisAnimal`, `SinaisClinicosAnimal` e cabeçalho de `DetalheAnimal`. Não remover outras etiquetas por extrapolação da decisão sobre Ativo.

### Peso, GMD e Bezerreiro

- Pai **Peso**, sem Desmama e castração e sem linha redundante “Último peso”.
- Unir métricas de GMD e curva no cartão **Evolução do peso**. Seletor de período dentro desse componente; métricas e gráfico compartilham a janela quando aplicável. GMD recente e desde a entrada mantêm referências próprias, explicitadas nos rótulos/ajudas existentes; não recalcular os três como se fossem o mesmo indicador.
- Um aviso centralizado quando curva e GMD do período não têm base suficiente. Quando só um deles for calculável, mostrar o dado disponível e o aviso específico do outro. Preservar regras de precisão/origem, datas iguais, pesos externos/estimados e baixa; gráfico desenhável não comprova GMD válido. Nenhuma alteração de fórmula é autorizada por este layout.
- Últimas pesagens em tabela: data, peso, tipo, GMD desde a anterior e ações. Preservar detalhes, origem, precisão, observações, restrições de reconciliação, editar/excluir, paginação e permissões. Não perder campos ao trocar cartões por tabela.
- Desmama/castração: destino operacional é o Bezerreiro, mantendo fatos no Histórico. Reutilizar APIs e regras existentes, não criar outro armazenamento ou sincronização. A realocação visual não modifica elegibilidade por idade/categoria nem limita a castração a bezerros por inferência.
- **Gate de entrega:** verificar/integrar uma entrada funcional no Bezerreiro antes de retirar o acesso operacional antigo no produto. Não deixar botão morto nem eliminar a única forma de registrar. Se o módulo ainda não estiver integrado, a tarefa B permanece dependência explícita da conclusão deste escopo; pode ser entregue em PR separado, sem ampliar este PR ao módulo inteiro.

### Histórico e auditoria

- Componente **Histórico e auditoria**, em linha do tempo ou tabela com o mesmo conjunto de fatos e filtros. Busca ocupa o espaço disponível; período e demais filtros à direita no desktop e quebram linha no móvel.
- Eventos compactos mantendo cartões/cronologia atuais: menos padding, sem altura mínima desnecessária, ícone/título/dado/ação alinhados. Títulos “Localização”, “Finalidade”, “Pesagem”, sem “registrada”. Cor e ícone por tipo, estáveis entre telas; nunca cor como único significado.
- Data do fato seguida de ` - Há N dias`, com Hoje/Há 1 dia e futuro corretamente tratados. Contar dias civis locais, não truncar diferença de milissegundos atravessando horário de verão. Atualizar na virada do dia/retorno de foco. Data de registro/correção é distinta e fica identificada na auditoria.
- Localização/finalidade mostram **anterior → atual** quando houver transição comprovada. Localização inclui sítio quando necessário para desambiguar lotes. Sem valor anterior comprovado: primeiro registro conhecido exibe apenas valor; lacuna histórica indica anterior não informado, sem inventar Corte ou outro lote.
- Botão **Ver auditoria** abre responsável, data/hora de registro, ação e campos antes/depois; cabeçalhos e células centralizados conforme revisão. Sem texto técnico explicativo na área de dados. Erro, ausência, falta de permissão e desconhecimento continuam explícitos.
- O resumo do fato e o modal usam a mesma projeção de transição. Correções posteriores do fato são linhas adicionais da trilha, não uma substituição silenciosa da mudança histórica. “Sem anterior” de criação é diferente de snapshot anterior ausente.
- Vincular por identidade de entidade/fato (`entidade` + `entidadeId`, relações e `animalId` autorizado), nunca por coincidência de data, autor ou texto. Tratar aliases legados `DestinoAnimal`/`FinalidadeAnimal`.
- Não buscar só a primeira página de auditoria e filtrar no cliente. Se necessário, acrescentar filtro por entidade/id na rota atual com validação Zod e autorização no servidor; consultar sob demanda ao abrir o modal. Evitar N+1 na listagem.
- Preservar auditorias sem fato vigente: alterações de cadastro, exclusões, desfazimentos, importações e correções. Mostrar entradas próprias no mesmo componente quando não houver fato associável, explicitando a data de alteração, sem criar “fato ocorrido” fictício. Não remover `AuditoriaAnimal` antes de demonstrar paridade de cobertura e filtros.
- Preservar comandos de desfazer movimentação/finalidade, histórico de baixas e links de domínio existentes. Eventos de Sanidade/Reprodução podem resumir e abrir seu domínio; não duplicar formulários nem todo o detalhamento.
- Paginação/limites do histórico devem ser visíveis e consistentes; não apresentar os 50 registros sanitários atuais como histórico completo. A implementação deve escolher consulta paginada estável ou manter limite explícito com acesso aos demais; filtros não podem fingir cobrir dados não carregados.

### Distribuição sem duplicação

| Informação | Destino principal | O que permanece fora dele |
| --- | --- | --- |
| Identificação, idade/nascimento, origem/entrada, observação, categoria, filiação/raças/filhos | Geral / cadastro | Etiquetas resumidas no cabeçalho |
| Pesagens, curva, GMD | Geral / Peso | Evento histórico resumido |
| Situação produtiva, DEL atual, pós-parto e gestação | Bloco existente de Reprodução | Sinais resumidos comprovados no cabeçalho |
| Tentativas e total de partos | Acompanhamento reprodutivo | Cadastro mantém saldo de partos antes da entrada como informação distinta |
| Partos/crias | Componente próprio em Reprodução | Filiação exibe filhos; não é nova cópia do registro do parto |
| Produção por aferição e qualidade individual | Produção | DEL por aferição é histórico, não duplicata do DEL atual |
| Carências, aplicações, protocolos, ocorrências, exames e agenda | Sanidade | Produção pode manter referência contextual à carência do leite com acesso a Sanidade |
| Consumo e participação nutricional | Nutrição | Evento histórico resumido se disponível |
| Desmama e castração | Bezerreiro | Fatos e auditoria permanecem na ficha |

Produção: dados/indicadores primeiro, filtros secundários junto da consulta; reutilizar `DateRangePicker`, com estado independente para produção e qualidade. Reprodução: recuperar tentativas e sua referência; total de partos pela regra do servidor (saldo de entrada e fatos válidos, incluindo desfechos definidos no contrato, sem dupla contagem); bloco de partos reutiliza dados/ações existentes. “Tempo de gestação” pertence ao bloco de gestação e exige evidência. Não registrar zero por falta de consulta. Sanidade/Reprodução: retirar fileiras de botões soltos e colocar cada ação no cabeçalho da sua seção. Ícones das carências proporcionais ao texto (referência 24 px). Títulos de componentes da ficha em todas as abas: 16 px, sem mudar globalmente os demais módulos.

## Plano de execução e modelos

Estimativas de engenharia, não medição de consumo nem limite configurado. Cada faixa abaixo soma **todas as chamadas** da tarefa: entrada inclui releituras/resultados de ferramentas/contexto reenviado; saída inclui raciocínio quando contabilizado e código/texto. `k` = mil tokens. São intervalos para uma passagem de implementação e correção delimitada, com contexto focado; conversas longas, screenshots e retries podem aumentar o consumo.

Modelos disponíveis na sessão: `gpt-6-luna`, `gpt-6.1-terra`, `gpt-6.1-sol`, `gpt-6-astra`. A distribuição abaixo é uma recomendação específica deste trabalho, não garantia de qualidade/custo. Luna para tarefas mecânicas com critérios claros; Terra para ajustes visuais delimitados; Sol para integração de código e invariantes. Astra entra apenas na conferência final autorizada; max/ultra não fazem parte do caminho padrão.

| ID | Entrega / aceite | Dependência | Modelo / esforço | Entrada k | Saída k |
| --- | --- | --- | --- | ---: | ---: |
| T0 | Reconferir base, PR #343, mapa de dados/ações/URLs e gate Bezerreiro; inventário sem perdas | — | gpt-6.1-sol / medium | 20–35 | 4–7 |
| T1 | Atualizar mockup: Peso sem Manejo, GMD+curva e estados mistos; revisão visual e apresentação | T0 | gpt-6.1-terra / medium | 15–25 | 3–5 |
| T2 | Composição Geral, aliases/hash, foco, rascunhos, cabeçalhos recolhíveis e busca global | T1 revisada | gpt-6.1-sol / medium | 30–50 | 6–10 |
| T3 | Cadastro/cabeçalho, filhos inline, etiquetas, ícones/títulos e ajustes responsivos | T2 | gpt-6.1-terra / medium | 20–35 | 4–7 |
| T4 | Peso: GMD+curva, tabela e estados mistos; regras e ações preservadas | T2 | gpt-6.1-sol / medium | 25–45 | 5–9 |
| T5 | Histórico/auditoria: projeção, cobertura, antes/depois, vínculo autorizado e modal paginado | T0, T2 | gpt-6.1-sol / high | 50–90 | 10–18 |
| T6 | Reprodução: contagens reais, partos e ações contextuais; retirar duplicatas | T2 | gpt-6.1-sol / medium | 25–45 | 5–9 |
| T7 | Produção/Sanidade: filtros reais, ações nas seções, escalas e paridade de estados | T2 | gpt-6.1-terra / medium | 20–35 | 4–7 |
| T8 | Textos/rótulos e matriz de critérios automatizáveis, sem alterar regras | T3–T7 | gpt-6-luna / low | 10–18 | 2–4 |
| T9 | Integração, regressões de autorização/dados/URL, testes e revisão crítica do diff | T3–T8, B se necessário | gpt-6.1-sol / high | 30–50 | 6–10 |
| T10 | Conferência visual desktop/móvel, teclado, foco, estados e uma rodada de correção | T9 | gpt-6.1-terra / medium | 15–25 | 3–5 |
| T11 | Incorporar contrato vigente, evidências e descrição final do PR; retirar este plano ao concluir | T10 | gpt-6-luna / low | 8–15 | 2–3 |
| T12 | Conferência final independente contra mockup atualizado + revisão de código, invariantes, testes e diff; resolver achados materiais antes de concluir | T9–T11 | gpt-6-astra / high | 30–60 | 6–12 |
| B | Integrar os acessos específicos no Bezerreiro reutilizando APIs; validar antes de remover acesso antigo | T0 e módulo integrado | gpt-6.1-sol / high | 35–65 | 7–13 |

B é estimativa condicional de integração pequena, **não de implementar o Bezerreiro inteiro**. Se o módulo não estiver pronto, registrar dependência separada e reestimar. Não absorver outra feature para satisfazer a retirada do cartão.

### Custo previsto e controle

Referências oficiais consultadas em 30/10/2026: [seleção de modelos](https://learn.chatgpt.com/docs/models) e [preços/consumo do Codex](https://learn.chatgpt.com/docs/pricing). A tabela oficial de créditos em velocidade Standard informa, por milhão de tokens (entrada / entrada em cache / saída): Luna **2,5 / 0,25 / 12,5**, Terra **25 / 1,25 / 125**, Sol **50 / 2,5 / 250**. Revalidar na execução; disponibilidade da conta e limites incluídos não são dedutíveis dessa tabela. Não confundir preço de API com crédito/plano Codex.

Para comparar as tarefas, usar cenário conservador sem cache: `créditos = entrada/1.000.000 × taxaEntrada + saída/1.000.000 × taxaSaída`. Não presumir desconto de cache nem orçamento em reais. Não foram alterados modelo, velocidade ou configurações desta conversa; esta é a alocação proposta para a execução futura.

| Cenário | Tokens totais estimados | Créditos Standard estimados, sem cache |
| --- | ---: | ---: |
| T0–T11 | 322–562 mil | 21.59–37.67 |
| B, se necessária | 42–78 mil | 3.50–6.50 |
| T0–T11 + reserva de 25% | 402.5–702.5 mil | 26.99–47.09 |
| T0–T11 + B + reserva de 25% | 455.0–800.0 mil | 31.37–55.21 |

Reserva é margem de planejamento para integração/retries, não autorização para consumir até o teto nem garantia de cobrança. Os custos desta etapa de planejamento já realizada não estão incluídos nas estimativas de execução futura.

- Executar serialmente por padrão. Separar contexto por tarefa com brief curto, caminhos e critérios; não replicar a conversa inteira nem carregar o repositório completo em cada chamada.
- Antes de T5, fechar a identidade do vínculo fato/auditoria em T0; usar `high` ali evita retrabalho caro. Token volume sozinho não determina capacidade: risco de perda de histórico e autorização também conta.
- No máximo dois trabalhos independentes simultâneos se a execução paralela for explicitamente escolhida; um único integrador edita `DetalheAnimal.tsx`. Não usar paralelismo só para reduzir tempo, pois ele duplica contexto e revisão.
- Em 75% da faixa superior de uma tarefa, registrar consumo e trabalho restante. Ao exceder a estimativa ou repetir duas falhas pelo mesmo motivo, interromper tentativas cegas, reduzir escopo/contexto e reestimar. Não promover automaticamente para modelo mais caro; mudança fora desta matriz exige justificativa e nova escolha.
- Astra/high foi autorizado pelo usuário para T12: revisão final visual e de código. Estimativa adicional de 36–72 mil tokens e 15–30 créditos Standard sem cache (250 créditos/M entrada, 1.250/M saída, mesma fonte oficial). Essa etapa deve comparar capturas reais com o mockup atualizado, revisar o diff e registrar achados/limitações, sem aprovar apenas pela existência dos testes. Não elevar para max/ultra automaticamente. Não repetir revisão ou suites completas sem alteração/falha que motive.
- Registrar consumo real por tarefa (entrada, cache, saída e modelo), onde a ferramenta expuser essas métricas; quando não expuser, marcar não aferido. Comparar qualidade e retrabalho, não apenas menor número de tokens.

## Validação e critérios de conclusão

Testes a adaptar, não duplicar mecanicamente: `DetalheAnimal.test.tsx`, `PesoEGanho.test.tsx`, `lib/peso.test.ts`, `ReproducaoIndividual.test.tsx`, testes de auditoria da interface/servidor e `routes/pecuaria/rebanho.test.ts`. Acrescentar casos significativos onde não houver cobertura:

- Links antigos, query de retorno/sítio, voltar/avançar, preferência visual/tabela, foco e abertura automática de seção; estado de formulário preservado.
- Fêmea/macho, animal baixado, leitores sem lançamento, valores ocultos, troca rápida de animal/sítio e respostas antigas. Tags independentes da aba já visitada.
- Pesos com 0/1/2+ pontos, mesma data, precisões incompatíveis, histórico externo, baixa, erro e ausência; GMD e curva parcialmente disponíveis; tabela conserva comandos protegidos.
- Auditoria de criação, transição, correção, exclusão/desfazer, cadastro sem fato, aliases legados, snapshot ausente, mais de uma página e fatos no mesmo dia. Modal e resumo concordam; sem vazamento entre sítios/animais nem acesso a valores mascarados.
- Data relativa: ontem/hoje/futuro, virada de dia e fuso; não transformar desconhecido em data do registro.
- Partos: saldo anterior, válidos/anulados, aborto/natimorto conforme contrato; contagens não dependem de uma página ou filtro visual. Tentativas conservam referência ao ciclo.
- Produção/qualidade com períodos independentes; falha não vira produção zero. Filhos carregando/erro/vazio/mais de uma página.
- Recolhimento: apenas quatro pais em Geral; ações não alternam título; navegação por teclado, leitores de tela e foco no modal.
- Bezerreiro: permissão/escopo, registro e correção preservam autoria/idempotência; retirada de comandos na ficha apenas após destino real funcionar. Sem migração de fatos nem regra clínica nova.

Executar testes direcionados primeiro, depois builds/typecheck do(s) workspace(s) alterado(s) e checks exigidos pelo CI. Navegador: desktop e móvel, todas as abas, estados relevantes e modais. Capturar evidência sem marcar homologação da fazenda como concluída.

Banco: somente `fazendinha_seedatev3`; não resetar, clonar, reexecutar seed nem criar banco para validar. Integrações reais exigem inspecionar fixtures e cleanup antes de habilitar flags. Nenhum deploy, merge ou migration aplicada faz parte deste plano.

Ao finalizar implementação: atualizar os contratos de Pecuária/Reprodução/Leite/Busca e frontend apenas onde o comportamento mudou; remover o plano temporário e conservar as referências visuais úteis com status correto. O PR final descreve o resultado implementado, os testes executados e limites de homologação, não esta conversa.

## Evidência e pendência da execução

Implementação comparada com o mockup v5 e anotações finais. Revisão independente Astra/high concluída sem achados materiais pendentes após corrigir datas civis, cronologia intradia, acesso histórico para leitores/baixados, compatibilidade dos períodos legados de Reprodução e ajustes visuais. A regressão final em `America/Sao_Paulo` passou 92 casos em DetalheAnimal, ReproducaoIndividual e AuditoriaAnimal; os testes direcionados de peso, produção/sanidade, auditoria por identidade e servidor também passaram. Builds de cliente e servidor aprovados; o cliente emitiu aviso de chunk acima de 500 kB. Os três testes do componente compartilhado ConsultaVisual passaram.

Navegador local: DEV-001 em `fazendinha_seedatev3`, Geral desktop/móvel, Produção, Reprodução, Sanidade, Nutrição e modais de auditoria, filtros e categoria. Conferidos recolhimento e manutenção desse estado entre abas, abertura de edição e retorno de foco sem salvar dados. Estados adicionais de leitores/baixados, races, 0/1/2+ pesagens e erros têm cobertura automatizada; não foram todos homologados manualmente. A referência BETÂNIA do mockup não existe nessa base e não foi recriada.

B permanece pendente: o Bezerreiro não integra a árvore de staging desta entrega. Desmama/castração saiu de Geral, com acesso transitório em Mais ações para animais ativos de quem lança e no cabeçalho para leitores/baixados. Não remover esses acessos até integrar e validar o destino real no Bezerreiro. Após as correções da rodada v6 abaixo, o plano permanece ativo apenas para essa dependência e é retirado quando ela for concluída. Não houve deploy, merge, migration aplicada, reset ou reexecução de seed; integração PostgreSQL e homologação em STG/campo não foram executadas.

Modelos usados nas tarefas delegadas: Sol (medium/high) para implementação e regressões, Terra/medium para Produção/Sanidade, Luna/medium para documentação e Astra/high para revisão final. Entrada/cache/saída e custo real não expostos pelas ferramentas: não aferidos, sem confundir estimativas com consumo.


## Rodada de correções aprovada — referência v6

Execução autorizada em 30/10/2026. A composição aprovada no mockup v6 orienta cadastro, localização, peso e histórico; para as abas prevalece o componente compartilhado `SubTabs`/`abas-pasta` da mesma base da aplicação, sem as exceções de espaçamento, altura ou tipografia do mockup. Preservar URLs, foco, permissões, autoria e comandos de correção.

| Trabalho | Modelo / esforço | Entrada estimada | Saída estimada |
| --- | --- | ---: | ---: |
| Correções da ficha e regressões direcionadas | gpt-6.1-sol / medium | 20–35 mil | 4–8 mil |
| Revisão final independente de código e capturas | gpt-6-astra / high | 8–15 mil | 2–4 mil |

Integração, documentação e navegador permanecem com o integrador da conversa, sem abrir outro agente para tarefas pequenas. Sol concentra os arquivos acoplados da ficha para evitar contexto duplicado e conflitos; Astra recebe somente o diff desta rodada, critérios e evidências. Estimativas não são consumo aferido nem limite automático. Não mudar esforço para max/ultra ou promover implementação para Astra por padrão.

Preços e orientação de seleção reconsultados nas fontes oficiais acima em 30/10/2026: Sol tem taxa Standard menor que Astra; a revisão usa Astra por autorização explícita e risco de regressão funcional/visual. A tabela desta rodada não inclui o contexto anterior nem o custo do integrador. Consumo real só será registrado se exposto pela ferramenta.

Escopo: abas compartilhadas; formulário alinhado; finalidade/papel na identificação; categoria e localização atual identificadas; histórico de movimentações em tabela própria; nenhuma seção de baixas em Geral; ações de baixa/auditoria existentes preservadas; GMD distribuído e sem legenda redundante; eixos do gráfico separados; cabeçalho da tabela padrão; retirada do parágrafo de limites no histórico; setas à direita e ações dos pais somente quando expandidos. Validação: testes direcionados, build do cliente, navegador desktop/móvel e revisão Astra antes de atualizar o PR.


Rodada v6 concluída: 98 testes em oito arquivos passaram (SubTabs, DetalheAnimal, FormDadosAnimal, PesoEGanho, SecaoRecolhivel, HistoricoMovimentacoes, HistoricoBaixas e GraficoPeso); TypeScript e build do cliente passaram, com aviso de chunk acima de 500 kB. Detector mecânico impeccable não retornou achados nos componentes alterados. Navegador confirmou Geral desktop e largura de 390 px, ausência de overflow da página, seleção de aba, alinhamento do formulário, recolhimento sem desmontagem e modal de movimentações vazio para DEV-001. A tabela de movimentações com registros em largura estreita foi validada por teste, não por captura desse animal. Revisão Astra/high do diff desta rodada e capturas finais terminou sem achados materiais; não foi reauditoria integral do PR. Modelos delegados: Sol/medium e Astra/high; consumo real não aferido. Permanecem os limites de homologação e a dependência B registrados acima.


## Cabeçalho aprovado em 31/10/2026

Decisão aprovada para implementação futura: opção A ajustada do mockup `http://127.0.0.1:41879/headers/`. Esta seção registra o desenho aprovado; não declara a implementação concluída nem altera o status das etapas anteriores.

- Ordem: brinco → nome, quando informado → lote. Brinco sem formato de etiqueta.
- Tipografia: brinco **20 px / peso 750**, nome **18 px / peso 600**, lote **16 px / peso 500**; mesma família Manrope, altura de linha de 24 px e alinhamento pela linha de base. A experiência de três textos em 18 px foi revertida a pedido do usuário.
- Lote separado por divisória discreta e com cor secundária. Nome ausente não deve gerar placeholder ou espaço vazio.
- Etiquetas abaixo da identificação, com intervalo de 8 px. Imagem de bovino de 72 × 72 px; identificação e etiquetas contidas na altura da imagem no desktop. Botão Mais ações à direita.
- Preservar as regras vigentes de dados, permissões e etiquetas; esta aprovação trata da composição do cabeçalho.
- Conferência final: comparar com a opção A ajustada; validar animal sem nome, nome/lote longos e largura estreita, sem sobreposição ou overflow horizontal. Preservar leitura e acesso às ações na adaptação responsiva.


## Padronização das abas e Sanidade (mockup v8)

Status: execução autorizada e implementação local concluída em 31/10/2026; revisão Astra concluída sem achados pendentes, builds de cliente/servidor e testes direcionados aprovados. Referência visual: `http://127.0.0.1:41879/v8/#sanidade`, incluindo seus diálogos e estados com/sem dados. O mockup é demonstrativo: seus valores, vínculos, resultados e datas não comprovam contratos do servidor. Esta rodada complementa o cabeçalho A aprovado acima e não reabre o escopo já entregue pela rodada v6. O histórico de execução anterior não deve ser interpretado como validação desta rodada.

### 1. Conferir contratos e preservar a base

- Preservar as alterações locais de etiquetas e a documentação já existentes na branch `codex/etiquetas-ficha-animal`; revisar o diff antes de integrar a rodada.
- Inspecionar `SanidadeAnimal`, `DetalheSanitario`, `CarenciasSanitarias`, os DTOs em `sanidade/api.ts`, `CustosDiretos`, rotas/serviços sanitários, schema e migrations pertinentes. Rastrear testes de anulação, escopo, custos e tarefas.
- `AplicacaoSanitaria` já expõe `produtoId`, `produto`, `operacaoServicoId`, status e estados de carência; não expõe custo exato no DTO inspecionado. `DetalheSanitario` já usa `CustosDiretos` e link de produto. Reaproveitar essas fontes antes de criar consultas novas.
- Custo vem do registro econômico vinculado ao fato, com Decimal e a autorização operacional existente (`podeConsultarCustosPecuaria`); documentos/totais financeiros continuam exigindo área Financeiro e `verValores`. Não calcular pelo preço atual do produto nem somar o valor integral de um atendimento a cada aplicação. Evitar dupla contagem de insumo incluso em serviço. Se a atribuição não for comprovada ou estiver incompleta, apresentar indisponibilidade/pendência em vez de zero ou um total supostamente exato. Só ampliar DTO/serviço após definir e testar a origem de cada parcela.
- Links exigem IDs reais e acesso autorizado. Serviço veterinário somente por vínculo explícito; nunca inferir por data, nome ou profissional. Nenhum ID/valor fictício do mockup entra na implementação.

### 2. Corrigir shell e padronizar componentes

- Aplicar o cabeçalho A aprovado: brinco 20 px, nome 18 px, lote 16 px; tags abaixo e altura compatível com imagem de 72 px no desktop.
- Reutilizar a seção de Geral nas demais abas: títulos de 16 px, ícones, radius e espaçamento consistentes; seta na extrema direita, ações somente quando expandido; preservar montagem do conteúdo, rascunhos, foco e hashes.
- Alinhar as bordas externas dos componentes às abas; remover padding lateral duplicado sem retirar o padding interno dos componentes. Pais recolhíveis; filhos de Peso sem recolhimento independente.
- **Sidebar solicitada nesta conversa:** usuário relatou desorganização em laptop 1024 × 768 e pediu retorno ao padrão já corrigido. Inspecionar `AppSidebar.tsx`, `sidebar-clara.css` e `styles/base.css`. O código prevê trilho de 64 px na faixa 901–1100 px e expansão por hover; corrigir conflitos entre largura, labels, ícones, controles, offset do conteúdo e rodapé. A sidebar simplificada de 200 px do mockup NÃO substitui esse contrato. Preservar recolhimento manual, navegação por teclado e drawer abaixo do breakpoint.

### 3. Reorganizar Sanidade

Ordem dos pais: **Aplicações sanitárias → Protocolos sanitários → Histórico sanitário → Agenda sanitária**.

- Carências integradas no topo de Aplicações: dois blocos alinhados (leite e abate/carne), divisória vertical no desktop e horizontal quando empilhados. Preservar estados conhecidos, não informados, não aplicáveis e revisões pendentes; ausência de aplicações não significa automaticamente liberação.
- Aplicações em tabela com radius discreto de 8 px, cabeçalho do padrão do app, custo autorizado e ações Detalhes/Anular. Ações primárias no padrão de Registrar aplicação; Anular mantém tratamento destrutivo.
- Protocolos sem “do animal” no título; conservar dados reais de execução, etapas, situação e acesso ao protocolo.
- Estados vazios centralizados com ícone, seguindo GMD. Diferenciar vazio real, carregamento, falha e nenhum resultado após filtro.
- Histórico sanitário reutiliza LinhaTempoConsulta/CartaoConsulta e tabela: ocorrências e exames com data, dias decorridos, tipo, nome, situação e detalhes. Nome e status agrupados como `Nome - Status`, centralizados no espaço disponível, com tipo/ícone e botão Detalhes nas extremidades. Quebra somente quando necessário. Busca e filtros devem operar sobre o recorte real e respeitar paginação, sem tratar página parcial como histórico completo.
- Nova ocorrência/Registrar exame no cabeçalho do Histórico, com comportamento de recolhimento igual aos demais componentes.
- Agenda em componente separado, com Lista/Calendário. Referência definitiva é **CalendarioCompromissos**, não o seletor mensal de Reprodução: grade mensal com tarefas dentro dos dias, navegação de mês, Hoje e clique para detalhes. Reutilizar helpers e extrair apresentação comum se útil, mantendo o fluxo financeiro intacto; não adaptar tarefas sanitárias como compromissos financeiros fictícios. Preservar datas/status reais e comportamento móvel legível.

### 4. Detalhes e anulação

- Modal com título fixo, corpo rolável (min-height: 0 e altura limitada ao viewport) e rodapé fixo. Anular aplicação ao lado de Fechar; evitar botões Fechar duplicados no corpo.
- Nenhuma seção recolhível dentro do modal. Bloco **Detalhes** integra aplicação, produto, carências e observações. Status Válida/Anulada no cabeçalho desse bloco; remover a antiga faixa redundante de identidade.
- Grade: Animal / Responsável; Data / Tempo desde a aplicação; Produto / Lote do produto; Dose e via / Vínculo; Local / Serviço veterinário quando comprovado. Preservar dados históricos e não inventar campos ausentes.
- Nome do produto e identificação do serviço são links textuais aos registros reais, com foco visível e comportamento nativo de link. Não usar os diálogos substitutos do mockup como navegação definitiva.
- Bloco Custo separado: total e parcelas comprovadas, visibilidade pela política operacional vigente; documentos integrais protegidos por `verValores`; origem e disponibilidade verificadas na etapa 1.
- Dias decorridos por data civil no fuso do produto, incluindo Hoje/Há 1 dia/Há N dias; não fixar a referência 31/10/2026 do mockup na aplicação.
- Anular reutiliza o fluxo existente: motivo, permissões e regras de consumo/administração, carência, custos e auditoria. Não simplificar a anulação real à confirmação demonstrativa; atualizar os dados após sucesso e impedir submissão duplicada. Aplicações anuladas permanecem rastreáveis e não oferecem nova anulação.
- Detalhes de ocorrência, exame e tarefa seguem a mesma estrutura de modal sem recolhimento, mostrando campos próprios e histórico/resultados quando existentes. Não criar previsões de reavaliação ou vínculos a partir dos exemplos fictícios.

### 5. Validar e concluir

- Testes direcionados: DTO/custos e permissões se alterados; anulação e atualização das carências; links com/sem vínculo; calendários e navegação; datas civis; detalhe/rolagem; recolhimento e rascunhos; regressão dos consumidores compartilhados.
- TypeScript e build do cliente; servidor e seus testes quando houver alteração de contrato/cálculo. Integração local somente em `fazendinha_seedatev3`, sem reset ou seed adicional; não usar o proxy de STG para testes de escrita.
- Conferência no navegador com e sem dados, aplicações válidas/anuladas, custo indisponível, ausência de vínculo, textos longos, falhas e permissões reduzidas. Conferir tabela, timeline e calendário, abertura e rolagem até rodapé dos modais.
- Responsividade: 1280/1440 px, **1024 × 768**, 931 × 698 (captura relatada), limites 900/901 e 1100/1101 px, e 390 px. Verificar trilho/hover/foco/drawer, ausência de sobreposição involuntária e overflow da página; rolagem horizontal apenas nas regiões previstas.
- Revisão final independente de código e comparação com mockup usando Astra, conforme solicitação anterior do usuário. Corrigir divergências antes de apresentar a implementação. Mockup de sidebar simplificado não é prova de correção do shell real.
- Atualizar contratos vigentes com comportamento entregue e retirar os trechos temporários concluídos. Relatar separadamente checks automatizados, inspeção visual e homologação. Sem merge/deploy nesta etapa de planejamento.

Sequência: contratos e dependências → shell/componentes → Sanidade e diálogos → calendário/histórico → regressões e revisão final. Distribuição de modelos e custos deve ser definida antes da execução, com preços vigentes verificados; nenhuma estimativa antiga é tratada como consumo real ou orçamento aprovado desta rodada.

Ajuste posterior do Histórico sanitário: nome e situação formam um grupo centralizado no espaço disponível, separados por hífen (`Nome - Status`); tipo/ícone à esquerda e botão Detalhes à direita, nas extremidades. Permitir quebra em larguras menores sem sobreposição.


### Ordem de execução consolidada após a revisão final do mockup

O usuário encerrou a revisão visual e solicitou este plano. Referência final: mockup v8 com nome/status centralizados no Histórico sanitário, detalhes não recolhíveis e calendário de Compromissos. A execução foi autorizada posteriormente e realizada em agentes; publicação e deploy não integram esta rodada.

| Etapa | Entrega concreta | Critério de conclusão |
| --- | --- | --- |
| 1. Diagnóstico de dados | Mapeamento de custos, vínculos, anulação e DTOs existentes | Origem comprovada de cada valor; lacunas explícitas, sem valores inferidos |
| 2. Shell e componentes | Sidebar de laptop corrigida; alinhamento de abas/painéis; cabeçalho A; seções das demais abas padronizadas | Conferência de 1024 × 768, breakpoints do shell e preservação de rascunhos/URLs |
| 3. Aplicações e protocolos | Carências integradas, tabela arredondada, custos e ações, estados vazios e protocolos | Dados reais, gates e estados clínicos preservados; ausência de dados não interpretada como liberação |
| 4. Modais sanitários | Detalhes da aplicação, ocorrência, exame e tarefa; anulação existente integrada | Corpo rolável; rodapé fixo; ausência de seções recolhíveis; links reais autorizados |
| 5. Histórico e agenda | Linha do tempo/tabela; Nome - Status centralizados; agenda separada em grade mensal/lista | Busca e paginação coerentes; clique em tarefa abre detalhe; nenhum evento previsto inventado |
| 6. Verificação e documentação | Testes, builds, inspeção visual e revisão independente | Comparação com mockup concluída, regressões corrigidas e contratos atualizados |

A etapa 1 antecede custo e links. A etapa 2 define o padrão compartilhado antes das etapas 3–5. A revisão final ocorre após a integração de todas as etapas, sem aprovar apenas uma captura isolada.

Detalhes finais do modal de aplicação: Animal / Responsável na primeira linha; Data / Tempo desde a aplicação na segunda. Produto, lote, dose/via, vínculo e local nas linhas seguintes; serviço veterinário apenas com vínculo comprovado. Válida/Anulada no cabeçalho do bloco Detalhes. Produto e serviço são links no texto. Carências e observações pertencem ao mesmo bloco Detalhes; custo em bloco próprio. Anular aplicação e Fechar juntos no rodapé fixo. Não reproduzir os placeholders de navegação do mockup.

Critérios de encerramento adicionais: verificar retorno do foco ao fechar modais, leitura por teclado, ação de anulação indisponível para aplicação anulada ou usuário sem permissão, custos operacionais restritos ao fato autorizado e documentos/totais financeiros não expostos sem `verValores` e calendário financeiro sem regressão após eventual extração compartilhada. Custos incompletos devem permanecer explicitamente incompletos. A sidebar é mudança do shell: validar também Compromissos, além da ficha do animal.


### Execução autorizada — divisão por agentes

Usuário autorizou execução e divisão por custo-benefício nesta conversa. As frentes compartilham a branch `codex/etiquetas-ficha-animal`, com ownership de arquivos para evitar sobrescrita; alterações locais anteriores são preservadas.

| Agente/frente | Modelo e esforço | Entrada estimada | Saída estimada |
| --- | --- | ---: | ---: |
| Shell, cabeçalho, padronização de abas | GPT-6.1 Sol / medium | 25–45 mil tokens | 5–10 mil |
| Aplicações, modais, vínculos e custos | GPT-6.1 Sol / high | 35–65 mil tokens | 8–15 mil |
| Histórico e agenda | GPT-6.1 Sol / medium | 25–45 mil tokens | 5–10 mil |
| Revisão independente final | GPT-6 Astra / high | 15–30 mil tokens | 3–6 mil |

Integrador responsável por composição, ambiente local, navegador, documentação e checks finais. Estimativas orientam escopo/contexto, não são orçamento fechado nem consumo medido. Evitar agentes extras para tarefas pequenas; Astra somente revisão, com diff e evidências focados. A seleção Sol para execução segue a orientação oficial de equilíbrio custo/capacidade, consultada em https://developers.openai.com/api/docs/models em 31/10/2026. Não equivaler preços públicos da API à cobrança efetiva desta sessão. Nenhuma execução de escrita em STG, deploy ou merge está incluída.

### Encerramento da rodada v8

Implementação local e revisão independente Astra/high concluídas. Builds do cliente e servidor e testes direcionados de ficha, abas, sidebar, Sanidade, custos, permissões, calendário e navegação passaram. Conferência no navegador usou apenas o banco local `fazendinha_seedatev3`, com estados vazios/preenchidos, recolhimento, calendário/tarefa, detalhes e rolagem/retorno de foco. A matriz completa de dispositivos e homologação operacional em STG não foram executadas. Não houve migration, gravação sanitária de validação, deploy ou merge nesta rodada. Decisões funcionais vigentes incorporadas ao contrato de Pecuária; a dependência de Bezerreiro continua separada.
