# Ampliação do cadastro de Produtos

**Contrato implementado localmente — 08/11/2026. Carga operacional e publicação não executadas.**

Ampliar o cadastro compartilhado de Produtos para identificação comercial, fabricante, classificação técnica, observações e composição aplicável a cada produto. Abrange produtos sanitários, nutricionais, genéticos e de uso geral. Princípios ativos são uma das informações do produto, não o centro nem um limite do escopo.

[Mockup de referência](design/principios-ativos/mockup.html). O HTML é ilustrativo; a implementação funcional está em Estoque. A carga depende da revisão da prévia e de decisões explícitas sobre os produtos de destino.

## Escopo do eixo de Produtos

| Informação da fonte | Aproveitamento | Limite |
|---|---|---|
| Nome e número/código | Nome atual mais código de referência opcional | Código legado identificado por fonte; não virar SKU global automaticamente. |
| Apresentação | Campo comercial opcional, como frasco ou embalagem | A fonte inclui apresentação no nome; separação exige revisão, sem parser que afirme quantidade. |
| Fabricante | Cadastro específico de fabricantes e vínculo opcional | Diferente de fornecedor. Somente pessoas referenciadas por `CDFABRICANTE`; não importar todos os cadastros de pessoas. |
| Classificação técnica | Catálogo de classes do produto | Independente da categoria financeira e dos usos. `ESTRUTURA` da fonte é preservada para revisão; não inferir árvore sem validar sua semântica. |
| Unidade de estoque | Reutilizar enum e regras atuais | Mapear as 25 unidades da fonte explicitamente. Nos produtos inspecionados, a unidade é `un`; não converter para mL pelo nome. |
| Princípios ativos | Catálogo e composição versionada descritos abaixo | Não restringir a modelagem a uso sanitário. Não cria prescrição, indicação ou dose. |
| Nutrientes do produto | Perfil nutricional opcional, integrado ao Produto | Os 32 nutrientes são catálogo; a fonte não traz valores por produto. Preenchimento manual documentado, sem dieta ou formulação. |
| Matéria seca | Reutilizar `PerfilNutricionalProduto.materiaSecaPercentual` | Vazia na fonte; não atribuir zero nem criar segundo campo concorrente. |
| Composição por outros produtos | Preservar estrutura da fonte no inventário técnico | `COMPOSICAOPRODUTO` está vazia. Mistura/fabricação e baixa de ingredientes não são criadas nesta entrega. |
| Estoque mínimo | Reutilizar campo atual | Vazio na fonte; preservar cadastro vigente. |
| Armazenamento | Observação comercial opcional de conservação | A fonte não vincula produtos a locais. Não criar dimensão de saldo por depósito nem confundir com sítio/localização animal. |
| Unidade de aplicação e fator | Preservar como dados de origem quando existirem | Vazios neste arquivo; conversão operacional requer contrato de precisão e consumo próprio. Não aplicar fator implícito. |
| Contas de receita/despesa e centros | Manter categoria financeira e centros atuais | Vazios nos produtos da fonte; revisão explícita para mapear quando houver outra fonte. |
| Saldo/data/valor inicial | Nenhuma carga pelo cadastro de Produtos | Vazios na fonte; saldo e valorização só pelos fluxos existentes de estoque e auditoria. |
| Flags `ESTOCAVEL`, `SAIDAIMEDIATA`, `COMPOSTO`, `EXIBIRNAAGENDA`, `EHINSIGHTLEITE` | Proveniência técnica | Não transferir semântica do IDEAGRI para o Fazendinha. O efeito físico continua definido pela operação. |

Não inclui dietas, alimentação de lotes, regime alimentar da fazenda, fatos animais, agricultura, prescrição, cálculo de doses ou reativação de módulos removidos. O catálogo pode conter produtos de qualquer classe sem criar um módulo agrícola.

## Estrutura de Produtos

Todos os campos novos são opcionais e globais como Produto; o cadastro atual continua válido.

- `Produto.codigoReferencia`: texto até 80 caracteres, não único; identificação operacional informada pelo usuário, independente da chave IDEAGRI.
- `Produto.apresentacao`: texto até 200; `observacao`: até 2000; `conservacao`: até 1000. Campos descritivos sem efeitos no consumo, carência ou validade.
- `Produto.fabricanteId`: FK opcional para `FabricanteProduto`, com `id`, `nome` (2–160), `nomeNormalizado` único, `ativo`, `revisao` e autoria/datas. Sem documentos, contatos bancários ou associação automática a Parceiro. Fornecedores atuais permanecem separados.
- `Produto.classificacaoTecnicaId`: FK opcional para `ClassificacaoTecnicaProduto`, com `id`, `nome` (2–160), `nomeNormalizado` único, `ativo`, `revisao` e autoria/datas. Categoria financeira continua obrigatória e distinta.
- `OrigemCadastroProduto`: identidade externa `(sistema, catalogo, entidade, codigoOrigem)` única, destino tipado Produto/Fabricante/Classificação/Nutriente, hash do registro, arquivo e revisão da decisão. FKs específicas e CHECK garantem exatamente um destino. Sem expor contatos ou atributos pessoais de PESSOA.
- `Produto.revisaoCadastro`: contador para concorrência de todos os novos atributos. Importações e novas edições verificam revisão esperada sob a trava de produto já usada pelo estoque. Clientes antigos podem omitir os atributos novos sem limpá-los.

Os catálogos permitem consulta, criação, edição e ativação/desativação, com a mesma normalização, revisão, auditoria, idempotência e preservação de vínculos dos princípios ativos. Não há exclusão pública. Novo vínculo com inativo é rejeitado; vínculo anterior permanece consultável. Código de referência não substitui `id` nem a unicidade de nome vigente. Não truncar nomes de origem para caber no limite atual de 80 caracteres: prévia sinaliza conflito para revisão.

Endpoints: `GET/POST /api/estoque/fabricantes`, `PATCH /api/estoque/fabricantes/:id`, equivalentes em `/classificacoes-tecnicas` e `/nutrientes`. Paginação e gates iguais aos de princípios ativos. DTOs de Produto incluem relações e origem consultável; filtros adicionais `fabricanteId`, `classificacaoTecnicaId` e `principioAtivoId` preservam os atuais.

## Perfil nutricional do produto

`NutrienteProdutoCatalogo` tem nome curto (até 100), nome completo opcional (até 300), unidade de referência (`PERCENTUAL`, `MG_KG`, `MCAL_KG`), situação, revisão e autoria. A fonte tem esses três tipos de unidade; unidades novas exigem alteração explícita do contrato. Não importar definições como recomendação técnica.

`PerfilNutricionalProdutoVersao` e `PerfilNutricionalProdutoItem` preservam referência, revisão, motivo e autoria com as mesmas garantias de imutabilidade e reenvio da composição de princípios ativos. Item associa nutriente, nome/unidade snapshot, valor Decimal(18,6) opcional e base (`MATERIA_NATURAL`, `MATERIA_SECA`, `NAO_INFORMADA`). Unicidade nutriente por versão. Valor e base específica são opcionais somente juntos: se houver valor, base não pode ser `NAO_INFORMADA`; valor ≥0, percentual ≤100 e sem arredondamento silencioso. Zero documentado é distinto de desconhecido. Não somar frações/nutrientes nem converter base automaticamente.

O perfil exige uso nutricional, como hoje. Dados antigos de matéria seca permanecem no campo existente; a nova versão referencia seu valor vigente como snapshot de contexto, sem se tornar outra fonte editável de matéria seca. Salvamento de matéria seca e perfil é atômico. A fonte não autoriza criar nenhum valor de nutriente, ingrediente ou matéria seca. Ausência de perfil aparece como “Informações nutricionais não registradas”.

Produtos genéticos continuam ligados a `MaterialGenetico`, com sua identidade de touro/doadora e tipo. O formulário oferece acesso à identidade existente sem duplicar ou editar sua genealogia nesta ampliação.

## Base atual e extensão

O cadastro vigente é `public.Produto`, com `FormProduto` em `client/src/financeiro/FormProduto.tsx`, apresentado no `PainelCadastro` compartilhado. Validação e persistência ficam em `server/src/services/estoque/produtos.schemas.ts` e `produtos.ts`; as rotas estão em `server/src/routes/estoque.ts`. O perfil sanitário guarda carências, via, orientação e referência técnica; a composição estruturada fica em versões próprias. `pecuaria.AplicacaoProduto` preserva também o snapshot de composição das novas aplicações com produto.

A extensão reutiliza Produto, o painel de cadastro, CampoFormulario, os seletores pesquisáveis, a barra de consulta e a tabela existentes. Rotas continuam Hono/Zod, serviços transacionais e Prisma; SQL das migrations garante integridade. Não altera o modelo de estoque ou cria catálogo operacional paralelo.

## Modelo de dados

Cadastros e composição ficam em `public`, compartilhados entre sítios como Produto. Fatos e snapshots sanitários permanecem em `pecuaria`. Todos os IDs novos são UUID. Datas de autoria são timestamps UTC.

| Entidade | Campos e regras |
|---|---|
| `PrincipioAtivo` | `id`, `nome` (2–100 caracteres), `nomeNormalizado`, `ativo` (padrão true), `revisao` (inteiro positivo), `criadoEm`, `criadoPorId`, `atualizadoEm`, `atualizadoPorId`. Nome normalizado único, inclusive para inativos. |
| `ComposicaoProdutoVersao` | `id`, `produtoId`, `numero`, `situacao` (`NAO_INFORMADA` ou `INFORMADA`), `referencia` (até 500 caracteres), `motivoAlteracao` (até 500), `criadoEm`, `criadoPorId`. Versões imutáveis, unicidade `(produtoId, numero)`. |
| `ComposicaoProdutoItem` | `id`, `versaoId`, `principioAtivoId`, `nomePrincipioSnapshot`, `ordem`, `concentracaoValor` Decimal(18,6) opcional, `concentracaoUnidade` opcional. Unicidade `(versaoId, principioAtivoId)` e `(versaoId, ordem)`. |
| `OrigemPrincipioAtivo` | `id`, `principioAtivoId`, `sistema`, `catalogo`, `codigoOrigem`, `hashRegistro`, `arquivoSha256`, `importadoEm`, `importadoPorId`. Unicidade `(sistema, catalogo, codigoOrigem)`; o hash do arquivo não faz parte da identidade. |
| `OrigemComposicaoProdutoItem` | `id`, `itemId`, `sistema`, `catalogo`, `codigoProdutoOrigem`, `codigoVinculoOrigem`, `hashRegistro`, `arquivoSha256`, `revisaoImportacaoId`. Vínculo de proveniência do item imutável, com unicidade de `itemId`. |

`Produto` recebe `composicaoVersaoAtualId` opcional. FK composta `(id, composicaoVersaoAtualId)` → `(produtoId, id)` impede apontar para versão de outro produto. A versão possui chave única `(produtoId, id)` para essa garantia. As tabelas de origem estão preparadas; não há registros de carga automática nesta entrega.

Nome normalizado: trim, espaços internos colapsados, caixa baixa e remoção de diacríticos, preservando pontuação e qualificadores químicos. Uma função SQL imutável e versionada, com a mesma tabela explícita de normalização usada no serviço, valida o campo e sua unicidade. Não retirar termos como sódico, zinco ou nomes de sais. Sem fusão automática por semelhança; duplicidade retorna conflito e orienta consultar o cadastro existente, inclusive inativo. Sinônimos e fusão de entidades ficam fora desta primeira entrega.

## Concentração e significado dos estados

- `NAO_INFORMADA`: zero itens; referência opcional. Produto sem versão é apresentado assim. Não significa ausência de ingredientes.
- `INFORMADA`: ao menos um item; significa que há ingredientes registrados, sem afirmar que a lista é completa ou validada clinicamente.
- Concentração desconhecida: **valor e unidade ambos null**. A interface mostra “Não informada”.
- Concentração informada: valor estritamente positivo até 999999999999,999999; unidade obrigatória. Não aceitar arredondamento silencioso de mais de seis casas.
- Unidades iniciais: `MG_ML`, `MG_G`, `G_L`, `UI_ML`, `UI_G`, `PERCENTUAL_MASSA_MASSA`, `PERCENTUAL_MASSA_VOLUME`, `PERCENTUAL_VOLUME_VOLUME`. Percentual exige base e valor ≤100. Outras bases exigem evolução explícita do catálogo, sem texto livre convertido em dose.
- API recebe/devolve decimais como strings com ponto; interface aceita vírgula e apresenta formato pt-BR. Tipos de concentração são independentes de `UnidadeMedida` de compra/baixa.
- Não somar concentrações de unidades diferentes, converter automaticamente, extrair valores do nome comercial ou interpretar quantidade de embalagem como concentração.
- Referência de composição é opcional quando só se conhece o ingrediente e obrigatória ao informar concentração. Aceita rótulo/bula/documento em texto, sem exigir URL. Não implica verificação clínica.

CHECKs SQL garantem o par valor/unidade, limites, enum e número de versão positivo. Constraint triggers diferidos garantem contagem de itens conforme situação ao commit. FKs usam RESTRICT para preservar referências. Versões e itens confirmados não podem ser alterados/excluídos pelo papel de escrita da aplicação; proteção SQL e serviço impedem mutação retroativa.

## Escrita, auditoria e concorrência

Salvar o formulário grava Produto, nova versão/itens e auditoria em **uma transação**. Os demais campos conservam seus contratos. O cliente envia a versão de composição que leu (`versaoEsperada`, null na primeira gravação) e uma `chaveReenvio` UUID. O servidor trava Produto, verifica a versão, valida princípios ativos sob travas compartilhadas em ordem de ID, grava e troca o ponteiro. Desativar um princípio exige trava incompatível para impedir corrida com nova associação.

Chave de reenvio e hash canônico do payload são persistidos na mesma transação, com unicidade por usuário/operação/chave. Repetição idêntica devolve o resultado; payload diferente com a mesma chave retorna conflito. A chave cobre o salvamento inteiro, inclusive criação de Produto. O reenvio é reconhecido antes de rejeitar a versão esperada antiga. Payload idêntico ao estado atual não gera versão de composição desnecessária.

Alterar composição existente exige motivo (5–500 caracteres), inclusive removê-la integralmente. Primeira inclusão não exige motivo. Remover todos os ingredientes gera versão `NAO_INFORMADA`; nunca apaga as anteriores. Cancelar o painel descarta o rascunho; falha ou conflito conserva os dados digitados. HTTP 409 não sobrescreve: oferece carregar a versão atual e reaplicar a edição explicitamente.

Criar, renomear e desativar princípios ativos usa `revisaoEsperada`, chave de reenvio e auditoria antes/depois. Desativação impede novas associações; vínculos existentes continuam legíveis e podem ser conservados sem trocar seu ID ou removidos. Renomear mantém identidade e auditoria; nomes de versões históricas não mudam. Não há DELETE público nem reativação implícita por importação.

## Histórico sanitário

`composicaoSnapshot` JSONB opcional a `pecuaria.AplicacaoProduto`, com schema versionado: versão de composição, situação, referência, nomes e IDs dos ingredientes, valores e unidades, instante de captura e contexto (`CADASTRO_NA_GRAVACAO` ou `CONFIRMADA_NO_ATENDIMENTO`). Snapshot é cópia imutável, validada no serviço e por CHECK de objeto/schemaVersion no SQL; não apenas um link para o cadastro atual.

No registro de aplicação com produto, resolver a composição sob a mesma coordenação transacional do cadastro. Captura automática é identificada como **cadastro consultado na gravação**, e não comprovação da fórmula do lote administrado. Em lançamento retroativo, a interface mantém esse contexto explícito; não presume validade da fórmula na data do fato. O enum reserva `CONFIRMADA_NO_ATENDIMENTO`, mas a confirmação explícita da fórmula usada não tem fluxo nesta entrega; não é atribuída automaticamente.

Aplicações antigas mantêm null e, no detalhe, exibem “Composição não registrada neste atendimento”. Não fazer backfill com o cadastro atual. Aplicações sem produto não recebem composição presumida. Correções históricas seguem o fluxo auditado de correção do fato, sem reescrever silenciosamente o snapshot. Carências continuam no produto/atendimento; nenhum valor é derivado do princípio ativo.

## API e autorização

| Operação | Contrato |
|---|---|
| `GET /api/estoque/principios-ativos` | `busca`, `ativo`, `pagina`, `porPagina` (10 padrão, máximo 50), `selecionadoId` para mostrar inativo já associado. Retorna itens/total/paginação. Busca normalizada, ordem nome/id. |
| `POST /api/estoque/principios-ativos` | Nome, chave de reenvio; situação inicial ativa. |
| `PATCH /api/estoque/principios-ativos/:id` | Nome e/ou ativo, revisão esperada, motivo quando desativar/reativar e chave. |
| `GET /api/estoque/produtos/:id/composicoes` | Histórico paginado das versões, com autor/data/referência/motivo. |
| POST/PATCH de Produto existentes | Campo opcional `composicao`: situação, itens, referência, versão esperada, motivo e chave. Omissão preserva a composição. Esvaziamento só com situação explícita e itens vazios. |
| GET de Produto existentes | Acrescentar resumo da composição atual; histórico carregado sob demanda. |
| GET de produtos existente | Acrescentar `principioAtivoId`; filtrar por EXISTS na versão atual antes da paginação, sem duplicar produtos. Busca livre por nome do produto conserva semântica. |

Leitura exige sessão e acesso a Estoque por Financeiro ou Pecuária; escrita exige `lancar`, como o cadastro atual de produtos. Perfil de leitura não recebe ações de edição e o servidor rejeita as escritas. Catálogo global não concede acesso a fatos de todos os sítios: aplicações, custos, saldos e vínculos operacionais continuam com o escopo autorizado e `verValores`. Não incluir contagens de tratamentos no catálogo compartilhado.

## Extração e prévia IDEAGRI

A fonte inspecionada contém 665 princípios e 12.417 vínculos para 9.846 produtos. Concentrações e carências estruturadas estão vazias. A prévia inventaria os 10.120 registros sem criar produtos ou incorporar módulos agrícolas. Novos produtos podem ser propostos como candidatos inativos, sujeitos à revisão de identidade, apresentação, categoria financeira e unidade; não há ativação em massa.

As regras abaixo orientam a carga futura. Nesta entrega estão implementadas a extração e a comparação; não há comando de aplicação nem ledger de aceites.

1. Ler fonte isolada em modo somente leitura e produzir prévia com hash SHA-256, códigos, nomes, duplicidades, vínculos órfãos e proposta de correspondências.
2. Revisar os 665 nomes antes da criação. Nome normalizado exatamente igual é candidato a reutilização; inativo ou conflito requer decisão explícita. Não inferir sinonímia química.
3. Selecionar produtos existentes por mapa confirmado com identidade da fonte. Igualdade de código entre `DADOS000` e `DADOS777` isoladamente não comprova equivalência. Apresentação e nome são evidências auxiliares.
4. Registrar aceite por produto e revisão de composição esperada. Aplicar a composição inteira de cada produto atomicamente; falha em um não pode deixar seus ingredientes parcialmente gravados. Relatório diferencia aplicados, preservados e pendentes.
5. Persistir proveniência e ledger idempotente de aceites: chave `(sistema, catalogo, codigoProdutoOrigem, hashConjunto, produtoDestinoId)` e hash da decisão. Reexecução idêntica não cria versão; origem alterada ou destino modificado exige nova prévia e revisão, sem overwrite.
6. Concentração continua null. Fabricante e classificação técnica só são associados a destinos revisados com referência íntegra na fonte; carência, validade, saldo e categoria financeira não são inferidos. Produto com composição manual não é substituído sem revisão explícita.

Os scripts disponíveis apenas geram arquivos de extração e prévia, sem acesso de escrita ao banco. O futuro importador técnico terá modo prévia como padrão. Aplicar em um ambiente é ação separada da aprovação deste desenho. Desenvolvimento e integração usam apenas `fazendinha_seedatev3`, sem reset ou banco auxiliar; fonte FDB não é banco operacional de teste.

## Interface

- Consulta em Estoque centrada em Produtos, com acesso aos catálogos auxiliares. Rota `/estoque?aba=principios-ativos`; o parser e as abas existentes devem aceitar a extensão sem substituir os parâmetros das consultas atuais.
- Princípios: busca, situação Todos/Ativos/Inativos, tabela Nome/Situação, paginação de 10 e botão Novo princípio ativo. Edição curta em diálogo compacto, com nome, situação, origem somente leitura quando existir e salvar/cancelar.
- Produtos: mesma ficha de cadastro e todos os campos atuais. Seção Composição após identificação/unidade e antes do perfil sanitário, disponível independentemente dos usos, sem apagar conteúdo ao desmarcar uso sanitário.
- Cada ingrediente oferece seletor pesquisável, concentração opcional e unidade/base; botão Remover rotulado por linha. Adicionar ingrediente cria rascunho; não salva o produto. A referência pertence à composição inteira.
- Acesso ao catálogo a partir do formulário conserva o rascunho, foco e retorno. Evitar dois formulários sobrepostos; cadastro rápido curto usa diálogo compacto existente.
- Filtro de princípio ativo em Produtos preserva URL e demais filtros. Produto inativo e princípio inativo são situações independentes.
- Histórico expõe versões e motivos em consulta, sem ação para editar versão antiga. Composição no atendimento deve mostrar origem temporal do snapshot.

Estados obrigatórios: carga, erro com Tentar novamente, nenhum cadastro, busca sem resultados, somente leitura, salvando, salvo, duplicidade, concentração parcial inválida, princípio inativo associado, conflito entre editores e descarte de rascunho. Mobile empilha os campos, conserva ações acessíveis e usa diálogo dentro da altura visível. Rótulos associados, foco visível, navegação por teclado, anúncio de erros e retorno de foco são critérios de aceite.

## Verificação e limites

Schemas e serviços têm regressões de normalização, precisão, pares valor/unidade, revisão, motivo de transição e bloqueio de unidade de nutriente utilizado. O teste `server/src/services/estoque/produtos-ampliados.integration.test.ts` usa `exigirBancoIntegracaoPecuaria()`, cria somente fixtures próprias em transação e força as constraints diferidas antes de rollback integral. Cobre versões, no-op, reenvio, revisão antiga, motivos, matéria seca e captura imutável. Não é um teste concorrente de duas conexões nem autorização de carga.

Builds e testes automatizados passaram localmente. A conferência no navegador exercitou catálogo, formulário desktop/móvel e acesso de consulta; chamadas reais da API verificaram criação/edição, reenvio, conflito, duplicidade e recusa de escrita sem permissão. Fixtures temporárias de acesso/catálogo foram removidas. Não houve homologação da fazenda, teste de leitor de tela ou publicação.

A conferência visual inicial ocorreu no checkout de origem, anterior à base `staging` deste PR, e encontrou divergência no enum `RETIRADA_LEITE`. A base atual já contém esse enum; não foi necessário alterar ou apagar movimentos. A validação automatizada deve ser repetida após integrar as alterações à base de destino.

## Operação e limites de entrega

- Catálogos: `/estoque?aba=principios-ativos`, `fabricantes`, `classificacoes-tecnicas` e `nutrientes`. Produto conserva a ficha de cadastro existente e filtros na URL.
- Alterar a unidade de um nutriente já utilizado em qualquer versão é bloqueado. Outra unidade exige outro cadastro, para não reinterpretar valores históricos.
- A migration `20261108120000_produtos_catalogos_composicao` é aditiva. Não carrega o catálogo IDEAGRI nem altera aplicações antigas.
- O ambiente local usado tem histórico consolidado de migrations diferente deste checkout. Foi aplicada somente esta migration, em transação com seu registro/checksum, após ensaio com rollback; não foi executado `migrate deploy` sobre a sequência divergente. Uma publicação exige reconciliar o histórico do ambiente de destino antes de migrar.
- Extração: `node scripts/extract-ideagri-products.mjs <FDB-original> <diretorio-de-saida>`. Requer Docker e a imagem Firebird indicada nos metadados; opera sobre cópia isolada, não monta o original e confere seu hash ao final.
- Comparação: `node scripts/preview-ideagri-products.mjs <extracao.json> <snapshot-produtos.json> <previa.json> [decisoes.json]`. O snapshot deve conter `produtos` com ID, nome, situação, unidade e metadados de ambiente/data. Candidatos por nome não são correspondências confirmadas. Decisões usam o código da origem e ações `map_existing`/`create_inactive`; a prévia não executa essas ações.
- Não há importação operacional, publicação, reativação em massa ou preenchimento de concentrações ausentes. A carga selecionada exige implementar o executor/ledger, revisar equivalências, unidades e categorias, e validar no destino autorizado.

O mockup permanece como referência visual, com dados fictícios e estado em memória. Não substitui a interface funcional nem comprova homologação. A validação local automatizada e a conferência de navegador não equivalem a aceite da fazenda ou publicação.
