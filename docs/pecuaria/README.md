# Pecuária — contrato atual

O domínio atual usa o schema PostgreSQL `pecuaria` e as rotas `/api/pecuaria/rebanho/*`. A interface está em `client/src/pecuaria/rebanho/`; serviços em `server/src/services/pecuaria/`. A cadeia de migrations entrega Rebanho V1, Genética V2 e Sanidade/Peso/Nutrição V3, incluindo ciclos e desvios sanitários.

## Disponibilidade e limites

| Eixo | Implementação atual |
|---|---|
| Rebanho | Identidade, lotes, localização/destino históricos, movimentação, categorias, baixa e auditoria |
| Genética | Filiação, genitores externos, composição racial e materiais genéticos ligados a Produto |
| Sanidade | Ocorrências, aplicações, carências, tipos/doenças/exames, protocolos publicados, ciclos, participantes e tarefas |
| Peso e manejo | Pesagem individual/coletiva, GMD, desmama e castração com histórico |
| Nutrição | Receitas versionadas, vigências por lote, conferência/fechamento, participação animal e estorno |

Reprodução operacional (IA/IATF/FIV/TE) e produção de leite não estão implementadas. Materiais genéticos e papéis de doadora/receptora não comprovam esses fluxos. Formulação automática de dieta, prescrição clínica e integração com balança não fazem parte deste contrato.

O IDEAGRI é fonte da carga inicial e de reconciliação. O importador existente cobre Rebanho/Genética; carga histórica V3 continua pendente. Não reintroduza o módulo anterior no schema `public`, sincronização contínua ou estruturas de estoque paralelo.

## Rebanho e genética

- Categoria vem das regras configuráveis `CategoriaAnimal`, avaliadas em ordem; exceção manual tem histórico em `CategoriaManualAnimal`. Não grave categoria calculada como atributo fixo do animal.
- Movimentação reúne cabeçalho, itens com origem por animal e histórico de localização. Desfazer preserva itens e respeita atomicidade; não apaga movimentos antigos.
- Use a localização na data do fato. Transferência/baixa não podem apagar eventos, consumos ou consultas históricas no sítio de origem.
- Baixa tem tipo e motivo compatível pela classe, conforme `baixa.calc.ts`. Excluir cadastro indevido não equivale a apagar animal com fatos reais.
- Cada lado da filiação aponta para animal da fazenda **ou** genitor externo. Constraints da migration protegem a exclusividade. Animal interno não ganha um cadastro externo duplicado.
- Composição calculada dos genitores não sobrescreve composição informada sem aceite. Papel de receptora não altera filiação genética.
- `MaterialGenetico` liga sêmen/embrião ao Produto do estoque único. A existência desse cadastro não significa consumo reprodutivo implementado.

Cálculos e regras: `services/pecuaria/rebanho/` (`categoria.calc.ts`, `movimentacao.calc.ts`, `baixa.calc.ts`, `composicao.calc.ts`, `genetica.calc.ts`, `peso.calc.ts`).

## Sanidade e rastreabilidade

Aplicações preservam nome/perfil histórico, data/hora, origem, produto/lote, quantidade/unidade, responsável e carências. Estoque, compra direta, origem documentada e reconciliação têm efeitos diferentes. Compra direta destina quantidade comprada sem criar movimento de estoque ou outra despesa; reconciliação conserva a origem e exige produto/unidade compatíveis e confirmação/motivo de equivalência quando aplicável.

Carência zero/encerrada conhecida, desconhecida, não aplicável e em revisão são estados distintos. A baixa considera a situação na data informada e revalida a ciência quando os dados dependentes mudam. Carência é informação operacional, sem recomendação clínica automática.

Ocorrências e exames permitem registro pela visão geral ou pela ficha de animal. Coleta, resultado, correção, encerramento e anulação conservam snapshots e autoria. Resultado pendente (`null`) não é zero. O formato de um tipo de exame fica congelado após a primeira coleta, inclusive pendente/anulada; alteração de cadastro não reescreve os resultados.

Um protocolo publicado define uma versão. Ciclo (`RodadaProtocoloSanitario`) associa essa versão a participações individuais (`ExecucaoProtocoloSanitario`), com datas, tarefas e fatos próprios. Adicionar participantes não recalcula os anteriores; remover exige motivo e encerra pendências; reentrada cria outra participação. Execuções anteriores sem ciclo só são associadas explicitamente, sem agrupamento inferido por data/lote.

Execução de etapa usa prévia/confirmação atômica e idempotente. Desvios de data/produto/dose/unidade/via/tipo exigem motivo e snapshots de planejado, realizado e diferenças; não mudam silenciosamente as próximas etapas. Snapshot antigo ausente significa desvio não aferido, não execução conforme. Listas e contagens respeitam paginação, filtros e sítio, sem revelar participantes externos ao escopo.

Um Serviço financeiro pode associar múltiplos procedimentos realizados do mesmo sítio. Valor individual é opcional (`null` difere de zero); vínculo não gera novo fato físico ou despesa e não duplica procedimento já representado pelo protocolo. Custos dependem da permissão financeira. Na interface, use “Gerenciar procedimentos”; nomes internos de rateio permanecem por compatibilidade. Referência técnica sanitária fica no histórico, sem voltar aos formulários.

Serviços atuais: `services/pecuaria/sanidade/`; migrations de V3, catálogos/histórico, lotes por validade e `20261006180000_rodadas_protocolos_desvios`.

## Peso, manejo e nutrição

Formulários de movimentação sinalizam destino que coincide com a localização atual, sem proibir fatos históricos ou misturar regras do servidor. A busca de animal reduz opções antes da escolha explícita. Coleta de exame pode ser registrada sem resultado, que será informado depois com o formato preservado. A atribuição/correção de dieta apresenta prévia textual de receita, data e lote; correção tem ação visual distinta dos links de consulta. O seletor de Serviço para gerenciar procedimentos explica que associa fatos realizados, sem criar novo fato sanitário.

As consultas de animais/lotes ficam acessíveis no início do panorama. Peso e GMD do período são indicadores principais; GMD recente e desde a entrada mantêm definições e valores em leitura secundária compacta. Na agenda sanitária, atrasadas vêm primeiro dentro da página retornada, depois a data prevista; o filtro continua sendo a consulta do conjunto completo. O ciclo evita um painel dentro de outro e expande a comparação de andamento sob demanda. A confirmação de aplicação repete animal/conjunto, medicamento, lote e carências junto às ações, sem substituir a revisão dos campos. O panorama nutricional mantém totais atuais no resumo e abre comparativos sob demanda para priorizar a tabela de lotes.

A ficha do lote oferece âncoras persistentes para resumo, animais, baixas, histórico, alterações, sanidade e nutrição, mantendo o conteúdo na mesma página. O histórico nutricional individual resume cada período e expande seus ingredientes/custos/origem sob demanda; status e contexto do período continuam visíveis. No detalhe da receita, a tabela permanece como leitura exata e a comparação visual é opcional. Quantidades do formulário usam o nome do ingrediente selecionado. Detalhes sanitários nomeiam a natureza do fato e o diálogo de resultado conserva exame/animal quando disponíveis. Os catálogos de raças e motivos usam busca local sem ampliar dados autorizados.

As submissões nutricionais usam trava síncrona além do estado visual ocupado: criar/editar receita, publicar versão, atribuir/corrigir vigência, confirmar períodos e estornar fechamento não disparam chamadas concorrentes pela mesma instância do formulário. Falhas mantêm os campos para correção ou nova tentativa; a confirmação de períodos reutiliza sua chave enquanto os dados não mudarem. Essa proteção de interface não substitui autorização, idempotência ou concorrência no servidor. Perfis de consulta não recebem ações de escrita, inclusive ao abrir URLs de formulário.

Pesagens/manejos conservam data, tipo, origem e auditoria. Coletivos não devem duplicar fatos em retry. O GMD usa os critérios e janelas de `peso.calc.ts`, não índices antigos de lactação.

Receitas publicadas e suas vigências definem consumo por lote/período. Participantes e animal-dias derivam da permanência histórica, considerando movimentações e baixas. Vigências não se sobrepõem; alterar limites precisa respeitar fechamentos existentes e ordem transacional segura.

A conferência distingue quantidade, matéria seca desconhecida e custos permitidos. Fechamento identifica receita, intervalo, participantes, quantidades, origens/lotes dos produtos e atribuição por animal. Baixa física e gravação dos fatos são atômicas/idempotentes; estorno recompõe efeitos sem apagar o fechamento. Não deduza outra despesa financeira do consumo.

Serviços atuais: `services/pecuaria/manejo/`, `services/pecuaria/nutricao/`; cálculos de peso, animal-dias e atribuição têm testes próprios.

O panorama e o resumo nutricional por lote usam `GET /api/pecuaria/rebanho/nutricao/resumo` (`loteId` opcional), com sítio e visibilidade de custos resolvidos no servidor. O agregado conserva todo o histórico confirmado, exclui estornos e soma custos conhecidos arredondados por fechamento, sem transferir itens ou participações ao cliente. Ausência de fechamento representa custo zero; histórico sem custo conhecido representa `null`; cobertura parcial continua explícita. Vigência atual usa intervalo semiaberto e a programação é a próxima vigência futura no dia da fazenda. Histórico detalhado permanece paginado; seu filtro `status` é aplicado antes da contagem/paginação. Nenhuma dessas consultas cria fatos ou movimentos.

O catálogo `GET /api/pecuaria/rebanho/nutricao/dietas` inclui `lotesEmUso` por receita. O catálogo de receitas permanece compartilhado; seus usos são exclusivamente lotes ativos do sítio autorizado (ou todos no escopo global autorizado), com vigência no intervalo semiaberto do dia da fazenda. Receita sem uso devolve lista vazia. Duas consultas em snapshot RepeatableRead substituem consultas individuais por lote, sem truncar usos, carregar histórico ou consultar valores financeiros. Quantidades e demais campos da receita permanecem inalterados.

## Homologação e dados locais

O [guia sequencial V3](artefatos/testes-v3-guia.html) permanece em uso. Seus IDs, chave de armazenamento, resultados e anotações do navegador devem ser preservados. Homologação manual integral e carga histórica IDEAGRI V3 permanecem pendentes; a revisão documental não aprova testes. Um seed demonstrativo não é evidência de homologação.

A preparação, a verificação dos saldos iniciais e a demonstração preenchida estão descritas em [desenvolvimento](../desenvolvimento.md#guia-manual-v3), junto dos comandos. As opções do script não alteram as marcações do HTML.

Esse guia usa `fazendinha_v3_teste`. O cenário unificado `seedatev3` usa **outro banco**, `fazendinha_seedatev3`, e conserva sua data-base/manifesto. Não combine as preparações. A configuração/retomada e os acessos fictícios estão em [desenvolvimento](../desenvolvimento.md).

## Evolução

Uma feature nova deve declarar fatos, histórico/snapshots, sítio na data, efeitos em estoque/financeiro, permissões e critérios de validação. Verifique schema, migrations e testes antes de afirmar disponibilidade. Atualize este contrato quando mudar o comportamento; planos antigos de versão não direcionam a implementação atual.

## Navegação e apresentação

Motivos de baixa e os catálogos de doenças, tipos de aplicação e tipos de exame têm busca local sem distinguir caixa ou acentos, limitada aos registros autorizados já carregados. Esses catálogos sanitários e o resultado de exame usam diálogos compactos, com corpo rolável quando necessário, preservando as validações e o aviso de saída com alterações. Na criação do animal, o resumo distingue pendências de dados previstos, sem sinalizar aprovação por check. A auditoria da ficha traduz os resumos técnicos conhecidos para português somente na apresentação; descrições específicas e eventos desconhecidos são preservados integralmente.

Abrir um ciclo sanitário navega para uma página dedicada, identificada por `rodadaId` na URL da agenda, sem expandir a linha nem manter a lista ao redor. O histórico do navegador e o retorno para ciclos preservam os filtros da agenda; paginações de etapas, participantes e tarefas continuam próprias do detalhe. Links anteriores com `rodadaId` seguem válidos, com os mesmos gates e ações.

O andamento do ciclo usa rosca compacta e legenda sem estados zerados. Nas etapas, as contagens visuais omitem zeros; sem tarefas, aparece o estado vazio. Ciclo/sítio e filtro são mostrados separadamente apenas quando seus números diferem em alguma etapa da página. A soma do gráfico continua restrita às etapas da página no filtro atual, sem misturar atrasadas às fatias de situação.

A visão geral de Rebanho começa pela composição por categoria em rosca, com o total ativo no centro e receptoras como informação secundária das fêmeas. Não há a fileira de quatro indicadores. A distribuição por sítio aparece somente quando o escopo do shell é Consolidado; em um sítio selecionado, a composição ocupa toda a largura. Essa decisão usa o escopo selecionado, não a quantidade de sítios do agregado. Links de categoria, efetivo e receptoras levam à consulta de animais com os filtros correspondentes.

Baixas ficam em um único painel, com total do período selecionado (30 dias ou 12 meses), gráfico e consulta por tipo. Motivos de descarte e baixas sem motivo ficam em detalhes expansíveis; mortes não são repetidas como uma segunda contagem por classe. O percentual de descarte voluntário conserva seu denominador e exclusões. A consulta de todas as baixas acompanha o período selecionado, não `baixas30d`, e fica indisponível durante a atualização do agregado. A atividade recente mantém cadastros, baixas e estornos como histórico separado, não como outra métrica de saídas. Não se calcula taxa de mortalidade nem evolução histórica a partir desses dados.

Os gráficos usam os agregados reais de `GET /api/pecuaria/rebanho/painel`. Valores e links de filtro permanecem em listas acessíveis, independentes das cores e tooltips. Sem efetivo/baixas, aparece o estado vazio correspondente; sem fêmeas ativas, receptoras informa a ausência de denominador em vez de exibir uma proporção artificial.

O painel expõe `femeasAtivas` e `receptorasAtivas` para mostrar numerador/denominador junto de `receptorasPct`; `porCategoria` inclui `sexo` da categoria (ou `null` sem categoria), distinguindo nomes iguais sem fundir IDs/filtros. As contagens continuam no escopo autorizado e sobre o conjunto completo, antes da paginação. O número de sítios não inclui o grupo “Sem sítio”. `baixas30d` sempre usa 30 dias, enquanto `baixasPorTipo`/`baixasPorClasse` seguem `periodoDias` (30 ou 365), preservando exclusões de cadastros indevidos e baixas estornadas. Não há novas escritas nem migrations.

A interface desta entrega segue o [guia Cooperativa contemporânea](../design/pecuaria-cooperativa/design.md), compartilhado com Financeiro e Estoque. Rebanho, Sanidade e Nutrição usam o mesmo padrão de abas e tabelas. Pesagem coletiva fica na seleção de Animais; `/pecuaria/pesagem-manejo` é alias de compatibilidade, preservando filtros e fragmento. Configurações próprias ficam em `/configuracoes/pecuaria/*`, com compatibilidade para os endereços sanitários anteriores.

Listagens sanitárias reúnem título, ação, filtros, tabela e paginação no mesmo painel. Tarefas e Carências preservam os estados de domínio, localização histórica e ações existentes. Consulta, mascaramento e gravações continuam sujeitos às permissões do contrato acima.

Na lista de Carências, situação e data ficam em linhas separadas com ícones e texto. Prazo vigente, encerrado, zero confirmado, desconhecido, não aplicável e ausência de aplicações continuam distintos; revisão de aplicabilidade tem prioridade visual. Atalhos de vigentes/desconhecidos reutilizam o filtro de situação e sua URL, sem criar contagens globais a partir da página. A linha abre a consulta sanitária individual, também acessível pelo link do animal.

O refinamento operacional mantém a ficha contínua, com navegação interna fixa e superfícies separadas para resumo, identificação/genética, sanidade, peso/manejo, nutrição e histórico. Composição racial usa a base de 64 avos e explicita a parcela não informada. O lote usa seus agregados completos (categorias e sexo), não a página de animais, nos gráficos. Listagens de animais e lotes conservam os filtros e ações coletivas. Os comparativos de efetivo mostram até seis lotes e informam esse limite.

A lista de animais reúne indicadores com ícones e composição por categoria em um resumo compacto. Usa exclusivamente os ativos do agregado de `GET /animais` nos filtros, antes da paginação; um recorte só de baixados não fabrica uma composição de ativos. A legenda refina a categoria na mesma lista, conservando os demais filtros e a seleção coletiva. Acima de seis categorias, mostra as cinco maiores e o restante agrupado como “Outras categorias”, sem fundir IDs homônimos. O recorte em atualização é identificado e não aceita cliques no agregado anterior. Tabela, GMD e navegação foram compactados apenas nesta tela; o assistente usa um acionador menor e uma faixa livre no desktop.

Indicadores de ativos, fêmeas e receptoras refinam a situação/sexo/papel na consulta atual; Lotes abre os filtros. Segmentos do gráfico repetem a ação da legenda e o tooltip mostra apenas a categoria apontada, sua contagem e proporção. “Outras categorias” abre os filtros para escolher uma categoria real, sem inventar filtro de grupo. “Selecionar todos” fica junto à busca/filtros; a barra de ações coletivas aparece quando há seleção, preservando o fluxo de pesagem. Os dropdowns dos filtros e formulários usam a busca local do seletor compartilhado descrito em [ARCHITECTURE.md](../../ARCHITECTURE.md), sem mudar URLs, opções autorizadas ou payloads de domínio.

Sanidade destaca estados com texto e cor, sem transformar resultado informado em diagnóstico ou ausência de aplicações em carência liberada. Totais já apresentados nas linhas/paginação não têm outro bloco de indicadores; os estados úteis aparecem como texto compacto no cabeçalho da lista, ao lado das ações, sem repetir a origem da contagem. Tarefas mostram pendentes e o subconjunto atrasado, no mesmo fuso usado nos estados das linhas; exames conservam resultados pendentes e aplicações conservam origens pendentes. Ciclos não repetem o total de ciclos/participações acima das linhas. O gráfico de andamento fica integrado à seção de etapas e usa as etapas da página, preferindo as contagens filtradas; tarefas atrasadas estão incluídas nas pendentes, não formam uma segunda fatia. As contagens integrais/filtradas continuam separadas nas tabelas. Enquanto a consulta atualiza, listas, ciclos, aplicações e detalhes usam skeletons acessíveis; cabeçalho, abas e filtros permanecem disponíveis e erros preservam a ação de tentar novamente.

O catálogo de protocolos distingue versões cadastradas, publicadas ativas e rascunhos; versões do mesmo protocolo são contadas separadamente. A sequência visual usa os dias relativos das etapas existentes, sem calcular recomendações ou modificar a imutabilidade de versões publicadas. Cadastros de apoio e formulários breves usam os mesmos componentes, com diálogos compactos quando o conteúdo permite.

A agenda de tarefas solicita `ordenacaoTarefas=prioridade` em `GET /tarefas`: todas as pendências vêm antes do histórico, ordenadas por previsão e ID (atrasadas antes das futuras), antes da paginação. O serviço particiona pendências/histórico com os mesmos filtros e escopo em leitura Repeatable Read, buscando somente a página; sem essa opção, permanece a ordem cronológica anterior. Realização considera fatos válidos, não aplicações/exames anulados; dispensas e execuções canceladas não são promovidas a pendências. As colunas de ações das listagens sanitárias ficam fixas à direita durante a rolagem horizontal, sem mudar os gates ou efeitos das ações. A tabela reúne tipo/protocolo/ciclo e previsão/situação nas mesmas células; Aplicações reúne registro e aplicação/origem para caber no painel em desktop, preservando a adaptação em telas estreitas. O ciclo é lido de `execucao.rodada`, como entregue pela API. Abas têm espaçamento compacto e mantêm navegação por teclado e rolagem em telas estreitas. Busca fica sempre visível, com rótulo acessível e ícone no campo; os demais filtros ficam em Filtros, com contagem de critérios ativos, abertos ao restaurar uma URL filtrada e sem apagar critérios ao recolher. Carências não repete a coluna de orientação genérica: o aviso histórico aparece uma vez abaixo da tabela; a revisão de finalidade permanece junto à carência de leite do animal. Estados desconhecido/não aplicável/prazo zero/encerrado e expiração continuam distintos. Não há novas escritas nem migrations.

Nutrição compara cobertura de dietas e efetivo atual por lote sem construir séries históricas estimadas. Receitas e fechamentos apresentam quantidades por ingrediente separadas por unidade, sem somar KG/L ou converter matéria seca. Quantidades e taxas usam apresentação PT-BR de até seis casas; não alteram os fatos nem cálculos do servidor. A ficha individual separa os períodos confirmados e estornados, preservando o aviso de atribuição por permanência, a paginação e o mascaramento de custos. Formulários relacionados mantêm as etapas de prévia/confirmação, validações e regras de escrita existentes. As consultas exibem skeletons conforme a estrutura esperada (panorama, cartões, lista ou detalhe), anunciam o carregamento para leitores de tela e não substituem o estado de erro com repetição.

Na visão geral nutricional, cobertura e efetivo dividem um único panorama, sem quatro cards repetindo suas contagens. O panorama representa todos os lotes ativos do contexto; os filtros da tabela não mudam esse denominador, e os atalhos de cobertura preservam a busca na URL. A dieta vigente vem antes do resumo histórico na ficha do lote. Custo total/médio, animal-dias e fechamentos ficam juntos em Consumo confirmado, mantendo custo desconhecido/parcial e `verValores`; animais ativos hoje pertencem ao contexto da dieta, não ao histórico de custos. No fechamento, período/base histórica e custos ficam no resumo existente, participantes na atribuição e gráficos de ingredientes junto da tabela de consumo/estoque. Estornos continuam identificados como históricos e fora dos custos atuais. Não há novos cálculos de domínio nem escritas nesta reorganização.

Listas e fichas usam cabeçalhos e gráficos compactos. Em Lotes, a busca local por nome/sítio e a tabela antecedem a comparação do efetivo; a ficha reúne as métricas em uma faixa, incorpora sexo à composição por categoria e agrupa perfil e peso/GMD na tabela. Na ficha individual, categoria e local permanecem no cabeçalho e nas seções próprias, sem repetir dois cards no resumo; em baixados, o último local histórico continua explícito. As ações coletivas e os períodos do GMD são preservados.

Ocorrências reúne início/fim em Período; Exames reúne coleta e resultado/situação sem duplicar o texto de pendência. Atalhos de situação em Ocorrências, Exames e Tarefas reutilizam os filtros e URLs existentes. Receitas recolhe a composição no catálogo e distingue rascunhos visualmente; os ingredientes completos permanecem disponíveis ao expandir ou abrir o detalhe. Fechamentos mostra o total filtrado no cabeçalho e a situação junto do período, sem contagens da página em outro painel. Custos parciais/ocultos, versões e estornos continuam distintos.

O hub de configurações oferece busca local por grupo/cadastro e descrições de finalidade; cadastros internos têm retorno ao hub. Protocolos oferece busca por nome e contagens de versões no cabeçalho. As tabelas de categorias e genética agrupam identificação e classificações para reduzir largura, sem alterar a lista usada para simulação/reordenação de regras ou seus gates. Sítios oferece busca local por nome/cidade/UF. Nenhuma dessas buscas consulta registros além do conjunto autorizado retornado pelas APIs.
