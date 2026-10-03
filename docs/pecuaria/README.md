# Pecuária — base de documentação

Esta pasta concentra o contexto funcional e técnico da reconstrução da pecuária. Ela substitui a dependência de uma sessão privada do Claude: os artefatos originais agora estão versionados no repositório e podem ser consultados por qualquer pessoa ou agente que trabalhe no projeto.

## Estado documental em 02/10/2026

Auditoria local da branch `codex/pecuaria-v3`, commit `dce3311`. Os estados remotos dos PRs abaixo são o registro anterior, não uma nova consulta ao GitHub.

| Entrega | Estado | Referência |
|---|---|---|
| v1 · Rebanho | mesclada na `main` em 25/09/2026 | [PR #296](https://github.com/somosvira/fazendinha/pull/296) |
| Follow-up da v1 | mesclado na `main` em 28/09/2026 | [PR #306](https://github.com/somosvira/fazendinha/pull/306) |
| v2 · Genética | PR em rascunho, reconciliado com a `main`, aguardando CI e homologação | [PR #305](https://github.com/somosvira/fazendinha/pull/305) |
| Validação da v2 com dados reais | pendente | executar a carga com o dump real do IDEAGRI e confirmar `ANIMAL.CDCENTRALSEMEN` |
| v3 · Sanidade, peso e nutrição | Correção operacional V3-01 a V3-13 em andamento no PR #308; migrations e 58 testes PostgreSQL executados no banco local, homologação visual/manual ainda pendente; carga IDEAGRI V3 fora desta rodada | [Artefato V3 — estado atual, contrato e auditoria anterior](./artefatos/pecuaria-v3-sanidade-peso-nutricao.html#correcao-operacional) |

Validação automatizada da rodada V3 em 02/10: a rodada anterior registrou 1.064 testes de servidor sem banco e 785 de interface; após a atualização de Produto/Estoque, a suíte backend passou com 1.077 testes em 107 arquivos e 62 ignorados. A suíte completa de interface passou com 793 testes em 105 arquivos, além de 3 testes focados novos do seletor. As duas migrations V3 anteriores foram aplicadas em `fazendinha_v3_teste`; os 58 testes PostgreSQL daquela rodada passaram (51 de Pecuária/Estoque e 7 de Financeiro/Auth). A migration `20261002190000_produto_usos_proprios` também foi aplicada no Docker sem recriar o banco, e 60 testes de integração PostgreSQL distintos passaram nesta rodada (55 de Pecuária/Estoque e 5 de Financeiro). `prisma migrate status` confirmou schema atualizado e os índices parciais foram conferidos no banco. A conferência visual pontual a 1180/720 px passou na ordem dos campos e na mensagem de MS -1; a homologação visual integral e o roteiro manual completo continuam pendentes. A seção inicial do artefato V3 registra também as lacunas remanescentes de carências/paginação sanitária e confirmação idempotente universal.

“Concluída” significa que a implementação e os testes automatizados foram feitos. A v2 só estará disponível para o restante do time depois de sair de rascunho, passar pela validação real, ser revisada e entrar na `main`.

## Ordem de leitura

1. [Pecuária Schema Map — v1](./artefatos/pecuaria-schema-map-v1.html): modelo do Rebanho, invariantes, efeitos das ações e roadmap original.
2. [Pecuária v2 · Genética](./artefatos/pecuaria-v2-genetica.html): decisões da v2, tabelas, regras, telas e integração com estoque.
3. [Roteiro de Testes do Rebanho](./artefatos/roteiro-testes-rebanho-v1-v2.html): QA manual de ponta a ponta para v1, v2 e contrato-alvo da v3. As marcações ficam apenas no navegador de quem executar; o nome histórico do arquivo foi mantido para preservar links.
4. [IDEAGRI Schema Map](./artefatos/ideagri-schema-map.html): inventário do banco legado e relações usadas para preparar a carga inicial.
5. [Pecuária v3 · Sanidade, peso e nutrição](./artefatos/pecuaria-v3-sanidade-peso-nutricao.html): fonte canônica do escopo V3, com mapa funcional, estado auditado, lacunas, diagramas, contratos, efeitos, comparação com o IDEAGRI e critérios de aceite. Começar pelo inventário atual antes de ler as telas-alvo.

Os arquivos são snapshots HTML e preservam os diagramas e a interatividade dos artefatos originais. Alguns recursos visuais carregam bibliotecas pela internet. Se o GitHub mostrar apenas o código-fonte, baixe o arquivo e abra-o no navegador.

## Como interpretar os documentos

- O **Fazendinha é a fonte de verdade operacional** depois da carga inicial. O IDEAGRI é apenas origem de migração e referência para reconciliação; não deve virar dependência de execução.
- O mapa do IDEAGRI descreve o legado, não o modelo que o Fazendinha deve copiar.
- O Schema Map da v1 é um retrato anterior à implementação da v2. A seção “Genética” do roadmap nele propõe `Reprodutor`, `CentralSemen` e `EstoqueSemen`, mas foi superada pela decisão documentada na v2: `GenitorExterno`, `MaterialGenetico` e o estoque único do produto.
- O documento da v2 é o contrato de produto e arquitetura do PR #305. Para detalhes exatos de implementação, prevalecem a migration, o schema Prisma e os testes da branch.
- O artefato da v3 preserva o contrato aprovado, registra a correção operacional em seção própria e mantém separadamente a auditoria de base em `dce3311`. Regras ainda não implementadas continuam requisitos, não devem ser apagadas para acomodar limitações do código. Os diagramas representam relações, não prova de fluxo concluído.
- A auditoria de 02/10 encontrou pendências de implementação: reexecução de tarefa após anulação, sítio da agenda/partidas, indicação de dieta futura, atribuição nutricional individual, navegação entre fatos e origens, manutenção de catálogos, adiamento de tarefa, detalhes de rastreabilidade, paginação/estados de tela, manejo histórico e contratos de confirmação. A carga IDEAGRI V3 também precisa ser implementada, não apenas homologada. Ver IDs V3-01 a V3-14 no artefato.
- O inventário abaixo registra componentes disponíveis em 01/10, com as limitações da auditoria acima. Não significa completude dos quatro eixos nem V3 homologada.
  - Atualização da interface em 01/10/2026: navegação direta em `/pecuaria/rebanho/sanidade` e `/pecuaria/rebanho/nutricao`; aplicação sanitária com quatro origens, Serviço opcional no estoque, quantidade/unidade e responsável; cadastros de tipos configuráveis (nome histórico preservado), doenças, tipos de exame e protocolos com rascunhos/publicação; ocorrências, agenda/execução/dispensa/cancelamento e coleta/resultado/correção/anulação de exames; carência por destino e correção auditada, com ciência revalidada na baixa; pesagem coletiva idempotente e manejo/anulação; edição/clonagem/publicação de receitas, participantes/MS/saldo/custo permitido na conferência, centro de custo no lote e estorno de consumo; perfis no Produto, ativação e identificação auditada de partidas legadas, movimentos por partida, distribuição nos itens financeiros, ajustes contados e aplicação agrícola. Acrescentadas reconciliação de origem com justificativa preservada, aplicações coletivas atômicas/idempotentes, leite condicional, abas Lotes/Receitas/Fechamentos, correção de vigências e divisão de períodos por mês/vigência com lacunas e confirmação conjunta idempotente.
  - Complementos disponíveis: rateio manual opcional de Serviço (soma limitada ao valor confirmado e sem duplicação entre protocolo e fatos); coletivos atômicos/idempotentes de protocolos e exames; filtros/paginação sanitários no servidor, busca de animal e lista geral de carências; históricos sanitários nas fichas de animais/lotes; transferência entre sítios e perda física com partidas e estornos conservados; documentação excepcional auditada de aplicação vencida, distinta de autorização operacional; prévia detalhada das devoluções de fechamento. Custos transferidos entram na base do sítio de destino, mas não são contados duas vezes no consolidado. Homologação manual integral, cenários completos de permissões e concorrência e validação visual a 1180/720 px seguem como critérios de aceite. Embalagens, frasco aberto e perdas durante aplicação ficam para melhoria posterior, preservando a baixa parcial na unidade do Produto.
- O roteiro de testes combina v1, v2 e 193 casos-alvo da v3, embora v2 e v3 ainda não estejam na `main`. Cada passo v3 mostra numeração, caminho na aplicação, ação e resultado esperado; caminhos marcados como tela prevista ainda não são navegáveis no PR atual, e os de apoio técnico não são testes de interface. O grupo 26 prepara somente o cenário local descartável; não exige cópia V2, reexecução de migration nem carga IDEAGRI. Para executar a v3 inteira, use o PR #308 sobre a base conciliada da v2, seguindo os critérios de aceite, sem confundir implementação com homologação. Um caso não executado fica pendente; um fluxo ausente ou incorreto deve ser marcado como falha, nunca como aprovado. A carga histórica requer o dump real do IDEAGRI.

Quando houver divergência, o contrato aprovado no artefato define o comportamento desejado; migration/schema, serviços, interface e testes demonstram o comportamento implementado. Registre a diferença como pendência, sem substituir requisito por limitação acidental do código. Documentos históricos não anulam decisões posteriores. Atualize artefato, implementação e testes na mesma mudança que resolver a divergência.

### Correção operacional de 02/10 — validação manual ainda aberta

- Escopo confirmado: desmama e castração individuais, pesagem coletiva; carga histórica IDEAGRI V3 fora desta rodada, explicitamente pendente. Embalagens, ECC, formulação automática, recomendação clínica e balança física continuam fora.
- Backend de fatos/histórico, sítio, snapshot na baixa, idempotência e retry: 29 testes focados passaram. Nutrição: 14 testes de serviço, 10 de interface e 30 de ficha passaram. Estoque: 78 testes focados do servidor e 31 da interface passaram. Esses números são por pacote e podem se sobrepor; não representam a suíte completa.
- Depois da retomada do Docker, as migrations foram aplicadas sem reset ou recriação do banco. Os 58 testes PostgreSQL da rodada V3 anterior e 60 testes distintos de integração PostgreSQL desta rodada passaram. Builds de cliente e servidor passaram; as suítes completas passaram com 1.077 testes backend (62 ignorados) e 793 frontend, além de 3 novos testes focados do seletor. A conferência visual pontual a 1180/720 px não substitui homologação integral, permissões, todos os fluxos manuais ou carga IDEAGRI V3.
- O [roteiro manual](./artefatos/roteiro-testes-rebanho-v1-v2.html) permanece sem execução/homologação nesta rodada. Não declarar a V3 homologada nem a carga IDEAGRI entregue.
- Contrato de Produto/Estoque atualizado em 02/10: Categoria mantém somente a classificação financeira; os usos Agrícola, Genético, Sanitário e Nutricional são booleanos independentes do Produto e podem coexistir. A migration `20261002190000_produto_usos_proprios` migra os dados anteriores de categoria e vínculos, além de inserir Sanidade/Nutrição como Custeio de forma idempotente, sem sobrescrever registros existentes. Material genético aceita qualquer categoria financeira e cria Produto com uso Genético.
- O formulário de Produto reúne nome, categoria, tipos, unidade e mínimo, perfis, lotes, centros e fornecedores; perfis aparecem conforme os tipos escolhidos e os campos salvam na criação. Lotes rastreados usam o termo de interface “Lote do produto”; modelos internos `PartidaProduto`/`partidaId` permanecem. A consulta de Estoque fica em “Lotes dos produtos” (`/estoque?produtoId=...#lotes`), com saldo, validade e movimentos. Ativar rastreio de saldo legado exige prévia, é irreversível e preserva saldo/valor; identificar lote legado distribui sem efeito líquido. Divisão de movimento é explícita e saídas sugerem vencimento conhecido, sem escolher lote de validade desconhecida automaticamente.
- Produto e item financeiro usam a mesma unidade; divergência é recusada no servidor, sem conversão de embalagens. A consulta geral abre pela seção “Lotes dos produtos” (`/estoque?produtoId=ID#lotes`); o cadastro mostra configuração e o atalho “Consultar lotes no Estoque”.
- A validação do Produto aceita vírgula decimal e MS vazia como desconhecida (`null`), inclusive 0–100; erro -1/101 aparece em português junto ao campo, com foco e dados preservados. Retirar uso exigido por perfil, receita, material, aplicação, protocolo ou agricultura é bloqueado com explicação.
- Evidências da rodada informadas em 02/10: migration aplicada no Docker local sem recriar banco; builds de servidor e interface passaram; suíte backend completa passou com 1.077 testes e 62 ignorados; suíte de interface passou com 793 testes em 105 arquivos, além de 3 testes focados novos do seletor. Foram aprovados 60 testes distintos de integração PostgreSQL (55 de Pecuária/Estoque e 5 de Financeiro), além dos casos focados de concorrência entre receita/remoção de uso (5), remoção de usos (4), seletor de lotes (3), FormProduto (13), rota (46) e retry de estoque (2); grupos focados podem se sobrepor às suítes. O reteste adicional de 5 casos PostgreSQL de ativação/identificação/sanidade também passou, incluindo consumo de 10 mL (saldo restante de 40 mL) e estorno que recompõe 50 mL. Conferência visual pontual a 1180/720 px confirmou ordem dos campos, erro de MS -1 localizado em português e ausência de overflow/erros de página. Isso não equivale a reteste manual completo; os casos afetados do roteiro continuam pendentes.
- Os passos afetados dos grupos 27/28 e referências de tipagem no roteiro precisam ser reexecutados. Se os Produtos V3 já existirem, reutilize-os e edite os campos necessários; não duplique cadastros. A revisão documental não alterou os estados nem os dados locais de marcação do roteiro; nenhum caso manual foi aprovado por esta atualização. Embalagens e frascos continuam fora do escopo.

### Validação da auditoria de base de 02/10 (antes da correção)

- Inspeção de schema, migrations, rotas, serviços, componentes e testes da branch, sem alteração de código operacional ou banco.
- Reexecutados 6 testes de cálculo (carência e animal-dias) e 10 testes de interface (aplicação, baixa e conferência nutricional): todos passaram. Esses testes focados não cobrem todas as lacunas identificadas.
- A aplicação não respondeu na porta local 41875 nesta sessão; não foi feita nova homologação visual nem dos fluxos de banco.
- O artefato registra 14 grupos de divergências, caminhos de navegação, relação entre entidades e ordem recomendada de conclusão. A revisão não marca casos manuais como aprovados.

### Registro anterior de validação — 01/10 (não reexecutado integralmente nesta auditoria)

- Servidor: 1.023 testes unitários passaram; testes de banco são executados separadamente.
- Interface: 771 testes passaram na suíte completa; repetida a regressão de estoque, aplicação e conferência após os últimos ajustes.
- PostgreSQL local: 33 casos passaram, incluindo genética/material genético V2, baixa parcial, reconciliação, coletivos de sanidade, protocolos/exames, nutrição, transferência/perda e estornos por partida.
- Navegação e conferência visual em Chromium: Sanidade, Nutrição, Cadastros, Estoque, Animais e ficha de lote a 1180/720 px; painéis de aplicação e tipo sanitário nas duas larguras. Sem erro de API ou transbordamento horizontal nesses caminhos. Isso não aprova automaticamente os 193 casos manuais nem comprova todas as combinações de permissão.
- Custos também são ocultados no servidor nas consultas genéricas de estoque sem Financeiro e `verValores`; saldo físico e partidas permanecem consultáveis.

## Decisões centrais preservadas

- O eixo é construído em cascata: v1 Rebanho → v2 Genética → v3 Sanidade, peso e nutrição → v4 Reprodução → v5 Leite.
- Filiação é identidade: mãe e pai podem ser animais da fazenda ou genitores externos, nunca os dois no mesmo lado.
- Receptora gesta, mas não transmite genética.
- Composição racial usa 64 avos e distingue origem informada de calculada.
- Sêmen e embrião são produtos do estoque único; compra e saldo usam o fluxo existente. O consumo será ligado aos eventos reprodutivos na v4.
- Dados com histórico não são sobrescritos silenciosamente. Escritas relevantes são auditadas e respeitam o escopo do sítio.

## Próximos passos recomendados

1. **Acompanhar a CI do PR #305 após a conciliação.** Os conflitos em `Cadastros.tsx`, `DetalheAnimal.tsx`, `DetalheAnimal.test.tsx` e `NovoAnimal.tsx` foram resolvidos preservando a ficha em cards e o datepicker da v1, sem retirar filiação, descendência e composição racial da v2.
2. **Homologar os gaps fechados na conciliação.** O saldo e o histórico do estoque agora permitem navegar até o material genético associado, respeitando a permissão da área de pecuária; avisos não bloqueantes de filiação também permanecem visíveis depois de salvar um animal ou editar sua filiação.
3. **Rodar a carga real da v2.** Confirmar a consulta de genitores externos, especialmente `ANIMAL.CDCENTRALSEMEN`; executar a importação duas vezes para verificar idempotência e depois `validar:pecuaria`.
4. **Executar o roteiro manual completo.** Cobrir filiação, composição calculada versus informada, genitor inativo, animal baixado como genitor, material genético, saldo e os avisos de idade/ciclo.
5. **Tirar o PR #305 de rascunho, revisar e mesclar.** Só então atualizar esta página para marcar a v2 como presente na `main`.
6. **Concluir e homologar o PR #308 da v3 sobre a v2.** Usar o [artefato V3](./artefatos/pecuaria-v3-sanidade-peso-nutricao.html) como contrato e os grupos v3 do [roteiro de testes](./artefatos/roteiro-testes-rebanho-v1-v2.html) como critérios manuais de aceite. Se a v2 ainda estiver aberta, manter a base na branch do #305 e depois ajustar para a `main`. Não liberar a v3 enquanto houver casos obrigatórios não implementados, falhos ou dependentes da carga real.

## Manutenção

Toda PR que altere a pecuária deve:

- atualizar esta página quando mudar estado, sequência ou decisão transversal;
- atualizar ou substituir o artefato do domínio quando mudar contrato, tabelas ou regras;
- registrar o PR associado e a data do retrato;
- evitar depender de links privados do Claude ou de outro chat como única fonte de contexto.

Os quatro HTMLs originais (v1, v2, roteiro de testes e mapa IDEAGRI) foram exportados do Claude em 28/09/2026 e copiados sem alteração de conteúdo. O planejamento da v3 foi elaborado no repositório nessa mesma data e usa diagramas locais, sem bibliotecas externas.
