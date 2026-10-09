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

Pesagens/manejos conservam data, tipo, origem e auditoria. Coletivos não devem duplicar fatos em retry. O GMD usa os critérios e janelas de `peso.calc.ts`, não índices antigos de lactação.

Receitas publicadas e suas vigências definem consumo por lote/período. Participantes e animal-dias derivam da permanência histórica, considerando movimentações e baixas. Vigências não se sobrepõem; alterar limites precisa respeitar fechamentos existentes e ordem transacional segura.

A conferência distingue quantidade, matéria seca desconhecida e custos permitidos. Fechamento identifica receita, intervalo, participantes, quantidades, origens/lotes dos produtos e atribuição por animal. Baixa física e gravação dos fatos são atômicas/idempotentes; estorno recompõe efeitos sem apagar o fechamento. Não deduza outra despesa financeira do consumo.

Serviços atuais: `services/pecuaria/manejo/`, `services/pecuaria/nutricao/`; cálculos de peso, animal-dias e atribuição têm testes próprios.

## Homologação e dados locais

O [guia sequencial V3](artefatos/testes-v3-guia.html) permanece em uso. Seus IDs, chave de armazenamento, resultados e anotações do navegador devem ser preservados. Homologação manual integral e carga histórica IDEAGRI V3 permanecem pendentes; a revisão documental não aprova testes. Um seed demonstrativo não é evidência de homologação.

A preparação, a verificação dos saldos iniciais e a demonstração preenchida estão descritas em [desenvolvimento](../desenvolvimento.md#guia-manual-v3), junto dos comandos. As opções do script não alteram as marcações do HTML.

Esse guia usa `fazendinha_v3_teste`. O cenário unificado `seedatev3` usa **outro banco**, `fazendinha_seedatev3`, e conserva sua data-base/manifesto. Não combine as preparações. A configuração/retomada e os acessos fictícios estão em [desenvolvimento](../desenvolvimento.md).

## Evolução

Uma feature nova deve declarar fatos, histórico/snapshots, sítio na data, efeitos em estoque/financeiro, permissões e critérios de validação. Verifique schema, migrations e testes antes de afirmar disponibilidade. Atualize este contrato quando mudar o comportamento; planos antigos de versão não direcionam a implementação atual.
