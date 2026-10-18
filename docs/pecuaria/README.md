# Pecuária — contrato atual

O domínio atual usa o schema PostgreSQL `pecuaria` e as rotas `/api/pecuaria/rebanho/*`. A interface está em `client/src/pecuaria/rebanho/`; serviços em `server/src/services/pecuaria/`. A cadeia de migrations entrega Rebanho V1, Genética V2 e Sanidade/Peso/Nutrição V3, incluindo ciclos e desvios sanitários, e Reprodução V4. O [contrato de reprodução e visitas](reproducao.md) detalha as novas regras.

## Disponibilidade e limites

| Eixo | Implementação atual |
|---|---|
| Rebanho | Identidade, lotes, localização/destino históricos, movimentação, categorias, baixa e auditoria |
| Genética | Filiação, genitores externos, composição racial e materiais genéticos ligados a Produto |
| Sanidade | Ocorrências, aplicações, carências, tipos/doenças/exames, protocolos publicados, ciclos, participantes e tarefas |
| Reprodução V4 | IA, cobertura/exposição, TE, avaliação/gestação, parto/crias, lactação mínima, colostro, visitas, planner e IATF |
| Peso e manejo | Pesagem individual/coletiva, GMD, desmama e castração com histórico |
| Nutrição | Receitas versionadas, vigências por lote, conferência/fechamento, participação animal e estorno |

Produção/qualidade do leite e laboratório/FIV não estão implementados. Lactação mínima e fornecimento de colostro não equivalem a controle leiteiro; papéis de doadora/receptora continuam distintos de situação reprodutiva. Formulação automática de dieta, prescrição clínica e integração com balança não fazem parte deste contrato.

O IDEAGRI é fonte da carga inicial e de reconciliação. O importador original cobre Rebanho/Genética; a ferramenta técnica V4 acrescenta prévia e reconciliação de reprodução. Executá-la em produção exige preparação própria; a entrega de código não significa carga realizada. Carga histórica V3 continua pendente. Não reintroduza o módulo anterior no schema `public`, sincronização contínua ou estruturas de estoque paralelo.

## Rebanho e genética

- A contagem de partos soma o saldo de entrada aos partos válidos não incluídos nesse saldo, incluindo aborto e natimorto, conforme a regra aprovada da V4.
- Categoria vem das regras configuráveis `CategoriaAnimal`, avaliadas em ordem; exceção manual tem histórico em `CategoriaManualAnimal`. Não grave categoria calculada como atributo fixo do animal.
- Movimentação reúne cabeçalho, itens com origem por animal e histórico de localização. Desfazer preserva itens e respeita atomicidade; não apaga movimentos antigos.
- Use a localização na data do fato. Transferência/baixa não podem apagar eventos, consumos ou consultas históricas no sítio de origem.
- Baixa tem tipo e motivo compatível pela classe, conforme `baixa.calc.ts`. Excluir cadastro indevido não equivale a apagar animal com fatos reais.
- Cada lado da filiação aponta para animal da fazenda **ou** genitor externo. Constraints da migration protegem a exclusividade. Animal interno não ganha um cadastro externo duplicado.
- Composição calculada dos genitores não sobrescreve composição informada sem aceite. Papel de receptora não altera filiação genética.
- `MaterialGenetico` liga sêmen/embrião ao Produto do estoque único. A V4 usa esse vínculo para validar e consumir material nas tentativas, preservando a genética da época.

Cálculos e regras: `services/pecuaria/rebanho/` (`categoria.calc.ts`, `movimentacao.calc.ts`, `baixa.calc.ts`, `composicao.calc.ts`, `genetica.calc.ts`, `peso.calc.ts`).

A fonte do papel reprodutivo por data é `PeriodoReprodutivoAnimal`; `DestinoAnimal` mantém aptidão. Ausência e conflito de papel ficam explícitos. O [contrato de protocolos, exames e papéis](protocolos-exames.md) detalha a estrutura comum, versões, compatibilidade e rollout.

## Sanidade e rastreabilidade

Aplicações preservam nome/perfil histórico, data/hora, origem, produto/lote, quantidade/unidade, responsável e carências. Estoque, compra direta, origem documentada e reconciliação têm efeitos diferentes. Compra direta destina quantidade comprada sem criar movimento de estoque ou outra despesa; reconciliação conserva a origem e exige produto/unidade compatíveis e confirmação/motivo de equivalência quando aplicável.

Carência zero/encerrada conhecida, desconhecida, não aplicável e em revisão são estados distintos. A baixa considera a situação na data informada e revalida a ciência quando os dados dependentes mudam. Carência é informação operacional, sem recomendação clínica automática.

Ocorrências e exames permitem registro pela visão geral ou pela ficha de animal. Coleta, resultado, correção, encerramento e anulação conservam snapshots e autoria. Resultado pendente (`null`) não é zero. O formato de um tipo de exame fica congelado após a primeira coleta, inclusive pendente/anulada, ou uso em protocolo publicado. Novas versões mantêm vínculo com a anterior; alteração de cadastro não reescreve os resultados. A realização comum admite múltiplas observações e interpretação reprodutiva vinculada.

Um protocolo publicado define uma versão. Programação/ciclo (`ProgramacaoProtocolo`) associa essa versão a participações individuais (`ParticipacaoProtocolo`), com datas, tarefas e fatos próprios. Adicionar participantes não recalcula os anteriores; remover exige motivo e encerra pendências; reentrada cria outra participação. Execuções anteriores sem ciclo só são associadas explicitamente, sem agrupamento inferido por data/lote.

Execução de etapa usa prévia/confirmação atômica e idempotente. Desvios de data/produto/dose/unidade/via/tipo exigem motivo e snapshots de planejado, realizado e diferenças; não mudam silenciosamente as próximas etapas. Snapshot antigo ausente significa desvio não aferido, não execução conforme. Listas e contagens respeitam paginação, filtros e sítio, sem revelar participantes externos ao escopo.

Um Serviço financeiro pode associar múltiplos procedimentos realizados do mesmo sítio. Valor individual é opcional (`null` difere de zero); vínculo não gera novo fato físico ou despesa e não duplica procedimento já representado pelo protocolo. A leitura dos custos operacionais atribuídos depende de sessão, área Pecuária e escopo autorizado; edição e documentos financeiros completos conservam as permissões financeiras. Na interface, use “Gerenciar procedimentos”; nomes internos de rateio permanecem por compatibilidade. Referência técnica sanitária fica no histórico, sem voltar aos formulários.

Serviços atuais: `services/pecuaria/sanidade/`; migrations de V3, catálogos/histórico, lotes por validade e `20261006180000_rodadas_protocolos_desvios`.

## Consulta operacional e relatórios

As superfícies de detalhes e formulários usam os tokens semânticos de cartão e agrupamento, com espaçamento próprio. Listas distinguem carregamento, falha de leitura, ausência de cadastros e filtros sem correspondência; erro não comprova ausência de dados. Nutrição informa resultados em relação ao total de lotes e permite limpar os filtros sem perder o contexto da URL. A agenda sanitária orienta ajustar os critérios quando a consulta filtrada não encontra ciclos, sem sugerir cadastro a leitores.

Reprodução apresenta Partos e pós-parto com os últimos 90 dias e Indicadores com os últimos doze meses até hoje, carregados ao abrir e com filtros de período. Em Consolidado, a própria página oferece seleção de sítio. Filtros completos, exportações e emissões preservadas ficam em Pecuária → Relatórios (`/pecuaria/relatorios`). A política reprodutiva fica em Configurações → Pecuária → Reprodução, com resumo em Animais e acompanhamentos. Consulte o [contrato de navegação e consultas](reproducao.md#consultas-operacionais-e-navegação).

## Custos diretos

Classificação gerencial e composição de custos utilizam os fatos existentes. A [explicação completa da V4](artefatos/follow-up-v4-entrega.html) reúne a base mergeada no PR #319 e os complementos do PR #322, com fluxos e diagramas, separando validação automatizada de homologação da rotina. A valorização do estoque está detalhada no [contrato financeiro](../financeiro-rebuild-contrato.md#valorização-do-saldo).

`ClassificacaoCustoPecuaria` pertence a exatamente um fato: tentativa, aplicação, exame, participação em protocolo ou participação no consumo nutricional. Finalidade (reprodução, sanidade ou rotina/manutenção) é diferente do vínculo operacional. Ausência de classificação permanece explícita. Na nutrição, a classificação altera apenas a finalidade; quantidade e custo vêm do fechamento existente, com seu período identificado.

`VinculoPreparoTentativa` atribui à tentativa uma aplicação, exame ou participação preparatória do mesmo animal, anterior ou na data da tentativa. Atribuição integral é exclusiva; compartilhamento exige parcelas explícitas por material e serviço, limitadas ao valor conhecido da origem. Encerrar um vínculo exige explicação e conserva o histórico. Reclassificação usa versão, autoria, auditoria e conferência dos vínculos já existentes.

As consultas distinguem custo direto registrado completo, parcial, desconhecido e oculto por permissão. Zero comprovado não é desconhecido; não aplicável e incluído em pacote são estados próprios. Um pacote que cobre apenas material não comprova que o procedimento foi custeado. Material de estoque com Serviço no mesmo atendimento é permitido, mas material separado não pode ser somado novamente quando já incluído no pacote. Origem documentada pode receber valor com referência e evidência, sem movimento fictício de estoque.

Valores da compra, do pagamento e do consumo não são somados como despesas diferentes. As consultas de tentativa, participação/programação e animal/período usam as identidades dos fatos; somar seus resumos produziria duplicação. Mão de obra própria, instalações, despesas gerais e logística não atribuída ficam fora do total denominado custo direto registrado. Consulte os serviços e cálculos em `services/pecuaria/custos/`.

## Peso, manejo e nutrição

Pesagens/manejos conservam data, tipo, origem e auditoria. Coletivos não devem duplicar fatos em retry. O GMD usa os critérios e janelas de `peso.calc.ts`, não índices antigos de lactação.

Receitas publicadas e suas vigências definem consumo por lote/período. Participantes e animal-dias derivam da permanência histórica, considerando movimentações e baixas. Vigências não se sobrepõem; alterar limites precisa respeitar fechamentos existentes e ordem transacional segura.

A conferência distingue quantidade, matéria seca desconhecida e custos permitidos. Fechamento identifica receita, intervalo, participantes, quantidades, origens/lotes dos produtos e atribuição por animal. Baixa física e gravação dos fatos são atômicas/idempotentes; estorno recompõe efeitos sem apagar o fechamento. Não deduza outra despesa financeira do consumo.

Serviços atuais: `services/pecuaria/manejo/`, `services/pecuaria/nutricao/`; cálculos de peso, animal-dias e atribuição têm testes próprios.

## Ficha e auditoria do animal

Quando a ficha não está disponível no sítio selecionado, a interface explica o contexto e oferece retorno à lista, sem revelar a localização em outro sítio. Falhas técnicas continuam sendo apresentadas como erro. Na auditoria, as linhas usam “Ver detalhes” com indicação acessível de expansão.

A ficha organiza Visão geral, Reprodução, Sanidade e Nutrição; peso, manejo e histórico geral ficam na Visão geral. Os componentes podem ser recolhidos pelo título sem apagar rascunhos. A sidebar usa a altura da janela e permite rolar o menu independentemente do conteúdo. O [contrato reprodutivo](reproducao.md#ficha-e-acompanhamento-individual) detalha protocolos, histórico factual e referência das tentativas.

Os cabeçalhos recolhíveis internos e externos usam título, resumo e chevron com acionamento por teclado; ações no cabeçalho não alternam a seção. Os quatro indicadores de peso/GMD abrem antes da curva. Curva e últimas pesagens ficam lado a lado quando há largura, empilhando em contêiner estreito; manejo fica abaixo em seção compacta recolhível. Ausência de pesagens não gera curva ou GMD fictícios. Menus agrupam as ações de reprodução e sanidade, mantendo visíveis apenas ações autorizadas. Links para programação, protocolo, detalhes e fechamento conservam semântica de navegação com aparência de botão.

Na ficha sanitária, “Protocolos sanitários do animal” identifica participações comprovadas; o nome interno de ciclo permanece compatível. Ocorrências, exames e agenda usam cabeçalhos completos. O fechamento nutricional mantém botão de origem no cabeçalho, quantidades atribuídas e destaque de estorno; não representa ingestão individual medida.

A auditoria apresenta data/hora da alteração, eixo com ícone e nome, ação, registro afetado, autoria e diferenças conhecidas. O período inicial é de trinta dias até hoje, ajustável; filtros por eixo, ação, responsável e busca são aplicados ao conjunto antes da paginação. Autoria ausente permanece não informada. O detalhamento usa campos conhecidos e autorizados, sem expor snapshots crus ou valores financeiros a quem não pode consultá-los.

Eventos de nutrição do fechamento coletivo só entram quando a participação persistida do animal comprova o vínculo. Eventos de programação/lote sem vínculo individual não são atribuídos por suposição. Auditorias antigas sem campos comparáveis permanecem consultáveis com a limitação explícita; o redesign não cria evidência de antes/depois ausente. Histórico operacional descreve fatos do animal; auditoria descreve ações sobre os registros, sem confundir as duas datas.

### Listas, filtros e detalhes operacionais

A largura das páginas de Pecuária acompanha a área útil, sem alterar o limite das páginas financeiras. Colunas de identidade de animais/lotes têm largura contida; outras colunas absorvem o espaço. Filtros selecionados têm espaçamento próprio abaixo da barra. Abas da ficha usam seleção destacada e texto centralizado.

Animais aceita listas em parâmetros repetidos: `propriedadeIds`, `loteIds`, `categoriaIds`, `sexos`, `origens`, `racaIds`, `aptidoes`, `papeisReprodutivos` e `situacoes`. Valores do mesmo campo usam OR; campos distintos usam AND, antes da contagem e paginação. Aliases escalares continuam válidos quando a família plural está ausente; enviar ambos é erro de validação. Sem categoria e categoria manual mantêm seus contratos. O padrão é Ativos; remover todas as situações representa Todos explicitamente, e Limpar filtros restaura Ativos. Os filtros de baixa permanecem, sem coluna redundante de Baixa. Mudar sítios remove lotes e seleção coletiva anterior. O escopo autorizado continua sendo aplicado no servidor.

Movimentações usam tabela, filtros de sítios/lotes/período e detalhe em modal central. Os parâmetros `movSitioIds`, `movLoteIds`, `movDe`, `movAte`, `movDesfeitas` e `movPagina` recompõem a consulta; cada filtro alterado reinicia sua página. Uma movimentação desfeita continua consultável; a confirmação de desfazer permanece separada e autorizada.

As tags da ficha só anunciam ocorrência vigente e participação em protocolo comprovadas; programação sem início difere de protocolo iniciado. Falha na leitura não significa ausência ou saúde confirmada. Observações de cadastro ficam em área secundária acessível. Sem consumo atribuído, Nutrição explica a dependência de lote/período e oferece acesso à conferência, sem afirmar que não há dieta definida.

## Homologação e dados locais

O [roteiro manual da branch V4](artefatos/testes-manuais-branch-v4.html) reúne os fluxos do follow-up, as alterações locais de interface e suas regressões, distinguindo consultas, gravações e contraprovas técnicas. A revisão da ficha acrescenta o grupo MB-REV com trocas de sítio, filtros/preparatórios de custos, atualização da aptidão, confirmações e permissões. Os IDs e a chave das marcações anteriores são preservados; os casos novos começam pendentes, com exportação/importação em JSON; resultados de automação ou dos guias anteriores não aprovam a execução humana. O mapa da massa é referência da preparação, não consulta do estado atual. Preserve o banco e marque dependências indisponíveis, incluindo R2, como bloqueio ao executar o respectivo caso.

A [seed V4 de demonstração](../desenvolvimento.md#seed-v4-completa-para-simular-a-rotina) complementa a V3 no mesmo banco, pelos serviços do domínio. Prepara ciclos com uma, duas e três tentativas, protocolos em etapas diferentes, gestações/perdas/partos/crias, pós-parto, visitas, políticas e custos, com 120 participantes para diagnóstico coletivo. O guia local `server/.seedatev3/v4/guia.html` identifica os cenários e seus links. A carga é aditiva, preserva o manifesto V3 e não restaura alterações do usuário; R2 permanece pendente. A existência da massa não aprova testes nem substitui homologação.

A [consolidação local](../desenvolvimento.md#manutenção-local-dos-dois-sítios) reúne os dados V3/V4 em somente dois cadastros: **V4 · Fazenda Escola** e **V4 · Fazenda Destino**. Os sítios anteriores foram excluídos após remapear os fatos preservados; as fixtures QA322/QA322R foram removidas com seus vínculos. Os roteiros e resultados históricos continuam disponíveis, mas seus IDs QA não representam mais registros existentes. Não recrie essas fixtures nem use a preparação antiga no ambiente consolidado.

O [roteiro do follow-up do PR #322](artefatos/testes-follow-up-v4.html) acrescenta 164 casos de valorização, desconto, custos, acompanhamento, biblioteca, horários, visitas, perdas, indicadores e permissões. A retomada de 17/10 registra evidência para todos os 164 casos: 161 aprovados tecnicamente e três bloqueados (arquivo/R2, aborto legado sem fixture compatível e aceite humano da fazenda). Distingue navegador real, HTTP/SQL e contraprovas React com API simulada. Seu aceite manual começa pendente, em chave própria; os guias anteriores permanecem preservados. A [preparação e retomada da automação](../../scripts/qa-pr322/README.md) usam somente o banco local existente, com fixtures QA322 aditivas e sem recarga ou backup. As 23 coberturas parciais foram complementadas. O resultado técnico não substitui a homologação integral pela fazenda.

Para a V4, o [material de conceitos e interface](artefatos/conceitos-v4.html) explica os fatos, relacionamentos e sua correspondência com as telas. O contrato de [reprodução](reproducao.md) registra contexto temporal, parto/pós-parto, visitas, elegibilidade e metodologia dos indicadores. O [roteiro manual V4](artefatos/testes-v4-guia.html) reúne preparação, passos, resultados esperados e registro/exportação de evidências. Todas as marcações começam pendentes e usam armazenamento próprio, sem alterar o guia V3. Os esquemas de interface no material conceitual são explicativos, não capturas de um ambiente homologado.

O fluxo de visitas começa pela escolha entre Agenda do dia e Seleção livre, em percursos independentes. A agenda contém apenas demandas previstas; a seleção livre reúne filtros, revisão tabular e definição de atividade. O atendimento é comum. O [material de conceitos](artefatos/conceitos-v4.html#visitas-planner) explica o percurso implementado e sua correspondência com os registros; o [contrato de reprodução](reproducao.md) define navegação, rascunhos, preparação e confirmação. O [mockup aprovado da entrada e seleção livre](artefatos/mockup-selecao-livre.html#entrada) permanece como referência visual com dados fictícios e interações locais, sem acessar o banco. Suas escolhas não aprovam nem alteram roteiros de homologação.

O [guia sequencial V3](artefatos/testes-v3-guia.html) permanece em uso. Seus IDs, chave de armazenamento, resultados e anotações do navegador devem ser preservados. Homologação manual integral e carga histórica IDEAGRI V3 permanecem pendentes; a revisão documental não aprova testes. Um seed demonstrativo não é evidência de homologação.

A preparação, a verificação dos saldos iniciais e a demonstração preenchida estão descritas em [desenvolvimento](../desenvolvimento.md#guia-manual-v3), junto dos comandos. As opções do script não alteram as marcações do HTML.

O único banco local é `fazendinha_seedatev3`, com sua data-base/manifesto preservados. A preparação histórica do guia V3 em banco separado está desativada; preserve as marcações e adapte os casos aos dados atuais, sem recarga. A configuração/retomada e os acessos fictícios estão em [desenvolvimento](../desenvolvimento.md).

## Evolução

Uma feature nova deve declarar fatos, histórico/snapshots, sítio na data, efeitos em estoque/financeiro, permissões e critérios de validação. Verifique schema, migrations e testes antes de afirmar disponibilidade. Atualize este contrato quando mudar o comportamento; planos antigos de versão não direcionam a implementação atual.

O contrato vigente da V4 está em [Reprodução e visitas](reproducao.md). O [caderno de estudo](artefatos/caderno-estudo-v4.html) conserva os capítulos datados, fontes e anotações anteriores; sua [consolidação vigente](artefatos/caderno-estudo-v4.html#consolidacao-implementacao) acompanha as decisões do follow-up. A [explicação completa de produto e entidades](artefatos/follow-up-v4-entrega.html) reúne os fluxos individuais e coletivos, a estrutura e os métodos de toda a V4: base do PR #319, mergeada em `2d3ebae5`, e evolução do PR #322 com correções locais. Distingue os 94 casos do roteiro base dos 164 do follow-up e seus limites de validação. O [roteiro de testes](artefatos/testes-v4-guia.html#preparacao-qa) conserva suas marcações e a referência do complemento QA, sem nova carga ou aprovação pela revisão documental.

Permanecem fora deste PR, com [tracking preservado](artefatos/follow-up-v4-entrega.html#backlog): ECC longitudinal, elegibilidade ampliada de novilhas e imunidade passiva da cria. Produção e qualidade do leite ficam para V5; produção de embriões/FIV não faz parte do escopo. Nenhuma proposta de estudo substitui o contrato operacional ou comprova homologação.


### Apresentação da ficha individual

A visão geral agrupa filiação e composição racial em um cartão, lado a lado quando há espaço e empilhadas no celular, preservando vínculos, filhos e ações. Peso e manejo mantém a curva existente; sem pesagens ou com menos de duas no período, mostra um estado explicativo em vez de um gráfico vazio. O consumo nutricional individual usa cartões de fechamento com período, dias de permanência, dieta/versionamento e tabela de produtos, quantidades atribuídas e média diária; estornos ficam destacados fora do consumo atual. A leitura dos custos operacionais atribuídos respeita sessão, área Pecuária e escopo de sítio/animal, inclusive para quem não possui `verValores`; edição e documentos financeiros completos continuam protegidos. Quantidade atribuída não significa ingestão medida.
