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

Um Serviço financeiro pode associar múltiplos procedimentos realizados do mesmo sítio. Valor individual é opcional (`null` difere de zero); vínculo não gera novo fato físico ou despesa e não duplica procedimento já representado pelo protocolo. Custos dependem da permissão financeira. Na interface, use “Gerenciar procedimentos”; nomes internos de rateio permanecem por compatibilidade. Referência técnica sanitária fica no histórico, sem voltar aos formulários.

Serviços atuais: `services/pecuaria/sanidade/`; migrations de V3, catálogos/histórico, lotes por validade e `20261006180000_rodadas_protocolos_desvios`.

## Peso, manejo e nutrição

Pesagens/manejos conservam data, tipo, origem e auditoria. Coletivos não devem duplicar fatos em retry. O GMD usa os critérios e janelas de `peso.calc.ts`, não índices antigos de lactação.

Receitas publicadas e suas vigências definem consumo por lote/período. Participantes e animal-dias derivam da permanência histórica, considerando movimentações e baixas. Vigências não se sobrepõem; alterar limites precisa respeitar fechamentos existentes e ordem transacional segura.

A conferência distingue quantidade, matéria seca desconhecida e custos permitidos. Fechamento identifica receita, intervalo, participantes, quantidades, origens/lotes dos produtos e atribuição por animal. Baixa física e gravação dos fatos são atômicas/idempotentes; estorno recompõe efeitos sem apagar o fechamento. Não deduza outra despesa financeira do consumo.

Serviços atuais: `services/pecuaria/manejo/`, `services/pecuaria/nutricao/`; cálculos de peso, animal-dias e atribuição têm testes próprios.

## Homologação e dados locais

Para a V4, o [material de conceitos e interface](artefatos/conceitos-v4.html) explica os fatos, relacionamentos e sua correspondência com as telas. O contrato de [reprodução](reproducao.md) registra contexto temporal, parto/pós-parto, visitas, elegibilidade e metodologia dos indicadores. O [roteiro manual V4](artefatos/testes-v4-guia.html) reúne preparação, passos, resultados esperados e registro/exportação de evidências. Todas as marcações começam pendentes e usam armazenamento próprio, sem alterar o guia V3. Os esquemas de interface no material conceitual são explicativos, não capturas de um ambiente homologado.

O fluxo de visitas começa pela escolha entre Agenda do dia e Seleção livre, em percursos independentes. A agenda contém apenas demandas previstas; a seleção livre reúne filtros, revisão tabular e definição de atividade. O atendimento é comum. O [material de conceitos](artefatos/conceitos-v4.html#visitas-planner) explica o percurso implementado e sua correspondência com os registros; o [contrato de reprodução](reproducao.md) define navegação, rascunhos, preparação e confirmação. O [mockup aprovado da entrada e seleção livre](artefatos/mockup-selecao-livre.html#entrada) permanece como referência visual com dados fictícios e interações locais, sem acessar o banco. Suas escolhas não aprovam nem alteram roteiros de homologação.

O [guia sequencial V3](artefatos/testes-v3-guia.html) permanece em uso. Seus IDs, chave de armazenamento, resultados e anotações do navegador devem ser preservados. Homologação manual integral e carga histórica IDEAGRI V3 permanecem pendentes; a revisão documental não aprova testes. Um seed demonstrativo não é evidência de homologação.

A preparação, a verificação dos saldos iniciais e a demonstração preenchida estão descritas em [desenvolvimento](../desenvolvimento.md#guia-manual-v3), junto dos comandos. As opções do script não alteram as marcações do HTML.

O único banco local é `fazendinha_seedatev3`, com sua data-base/manifesto preservados. A preparação histórica do guia V3 em banco separado está desativada; preserve as marcações e adapte os casos aos dados atuais, sem recarga. A configuração/retomada e os acessos fictícios estão em [desenvolvimento](../desenvolvimento.md).

## Evolução

Uma feature nova deve declarar fatos, histórico/snapshots, sítio na data, efeitos em estoque/financeiro, permissões e critérios de validação. Verifique schema, migrations e testes antes de afirmar disponibilidade. Atualize este contrato quando mudar o comportamento; planos antigos de versão não direcionam a implementação atual.

O contrato vigente da V4 está em [Reprodução e visitas](reproducao.md). O caderno local de estudo não substitui o contrato nem comprova homologação.

## Navegação e apresentação

A interface desta entrega segue o [guia Cooperativa contemporânea](../design/pecuaria-cooperativa/design.md), compartilhado com Financeiro e Estoque. Rebanho, Reprodução, Visitas, Sanidade e Nutrição compartilham componentes de navegação e tabelas. Pesagem coletiva fica na seleção de Animais; `/pecuaria/pesagem-manejo` é alias de compatibilidade, preservando filtros e fragmento. Configurações próprias ficam em `/configuracoes/pecuaria/*`, com compatibilidade para os endereços sanitários anteriores.

Listagens sanitárias reúnem título, ação, filtros, tabela e paginação no mesmo painel. Tarefas e Carências preservam os estados de domínio, localização histórica e ações existentes. Consulta, mascaramento e gravações continuam sujeitos às permissões do contrato acima.
