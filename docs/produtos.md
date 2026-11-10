# Produtos: catálogo do sistema e produtos da fazenda

**Contrato proposto — 09/11/2026. Implementação em andamento no PR #366.** Substitui a versão de 08/11/2026 (importação por fazenda e composição versionada).

O Fazendinha traz um **catálogo de produtos** pronto, igual para todas as instalações. O usuário busca e usa os itens do catálogo sem cadastrá-los. Um **produto da fazenda** (`Produto`) só é criado quando o item é usado numa operação salva, ou quando o usuário cadastra um produto que não está no catálogo. Só o produto da fazenda tem estoque, custo, fornecedores, perfis e demais funções operacionais.

Fonte inicial: lista pública de produtos, extraída do arquivo `DADOS000.FDB` (IDEAGRI) por já trazê-la estruturada. Uso liberado em 09/11/2026.

## Duas camadas

| | Catálogo (`ProdutoCatalogo`) | Produto da fazenda (`Produto`) |
|---|---|---|
| Origem | Migration de dados versionada | Adoção de item do catálogo ou cadastro manual |
| Conteúdo | Nome, apresentação, fabricante, classificação técnica, princípios ativos, unidade e uso sugeridos | Todos os campos atuais: categoria financeira, unidade, centros de custo, estoque mínimo, fornecedores, partidas, perfis sanitário e nutricional, situação |
| Escrita pela aplicação | Nenhuma | Fluxos atuais de cadastro e operação |
| Aparece em | Busca dos seletores de produto | Busca, estoque, operações, relatórios |

O catálogo não tem saldo, custo, categoria financeira, centro de custo, estoque mínimo, fornecedor, carência ou dose. Esses dados existem apenas no `Produto`.

## Modelo de dados

Tabelas do catálogo em `public`. A aplicação só as lê: não há rota nem serviço de escrita; a escrita vem apenas das migrations de dados. (O projeto não separa papéis de banco hoje, então não há `GRANT` específico.) IDs UUID determinísticos (v5 de fonte + código), estáveis entre ambientes e versões do catálogo.

| Entidade | Campos |
|---|---|
| `ProdutoCatalogo` | `id`, `codigoOrigem` (único por `fonte`), `fonte` (ex.: `IDEAGRI_DADOS000`), `nome`, `nomeNormalizado`, `apresentacao?`, `fabricanteId?`, `classificacaoTecnicaId?`, `unidadeSugerida` (`UnidadeMedida`), `usoSanitario`, `usoNutricional`, `usoGenetico`, `ativo`, `versaoCatalogo`, `atualizadoEm` |
| `FabricanteProduto` | `id`, `codigoOrigem`, `nome`, `nomeNormalizado` único, `ativo` |
| `ClassificacaoTecnicaProduto` | `id`, `codigoOrigem`, `nome`, `nomeNormalizado` único, `ativo` |
| `PrincipioAtivo` | `id`, `codigoOrigem`, `nome`, `nomeNormalizado` único, `ativo` |
| `ProdutoCatalogoPrincipioAtivo` | `produtoCatalogoId`, `principioAtivoId`, `ordem`. Lista simples, sem concentração e sem versão |

Acréscimos em `Produto`:

| Campo | Regra |
|---|---|
| `produtoCatalogoId?` | FK `RESTRICT`, **único**: no máximo um produto da fazenda por item do catálogo |
| `nome` | Continua obrigatório e único. Na adoção recebe o nome do catálogo (ver Herança) |
| `apresentacao?`, `fabricanteId?`, `classificacaoTecnicaId?` | Null em produto adotado = herda do catálogo. Preenchido = alterado pela fazenda |
| `codigoReferencia?`, `observacao?`, `conservacao?` | Só da fazenda; não herdam |

Item inativo no catálogo continua legível pelos produtos que o adotaram, mas deixa de aparecer na busca.

## Herança

- **Valor efetivo** de `apresentacao`, `fabricante` e `classificacaoTecnica`: valor do `Produto` se não nulo, senão o do item do catálogo. Calculado no serviço (DTO), nunca gravado como cópia.
- **Nome**: por causa da unicidade atual de `Produto.nome`, a adoção grava no `Produto` o nome completo do item, `"<nome> (<apresentação>)"` quando houver apresentação. Na fonte, 703 nomes se repetem com apresentações diferentes (ex.: "Biomox 20% PS" em sachês de tamanhos distintos), então o nome sozinho colidiria. A flag `nomeAlterado` (default false) indica se o usuário mudou o nome; enquanto false, uma atualização do catálogo também atualiza o nome do produto, se não houver colisão. Colisão mantém o nome atual.
- **Princípios ativos**: sempre do catálogo, sem edição pela fazenda nesta entrega. Produto manual não tem princípios ativos.
- **Restaurar** um campo grava null (ou `nomeAlterado = false` e o nome do catálogo) e volta a herdar.
- A ficha marca cada campo herdável como "do catálogo" ou "alterado pela fazenda".

Produto manual (sem `produtoCatalogoId`) não herda nada; `fabricanteId` e `classificacaoTecnicaId` podem apontar para os cadastros do catálogo, opcionalmente.

## Adoção

1. O seletor devolve itens de dois grupos: **Meus produtos** (`Produto` ativos) e **Catálogo** (itens ativos ainda não adotados). Itens já adotados aparecem só como Meus produtos.
2. A operação (compra, aplicação sanitária, movimento de estoque etc.) envia `produtoId` **ou** `produtoCatalogoId`, nunca os dois.
3. Ao salvar com `produtoCatalogoId`, o serviço chama `adotarProdutoCatalogoTx(tx, produtoCatalogoId, sugestoes)` dentro da transação da operação:
   - `INSERT … ON CONFLICT (produtoCatalogoId) DO NOTHING`, depois lê o `Produto` vinculado. Duas operações simultâneas resolvem para o mesmo produto.
   - Campos gravados: `nome`, `unidade` (sugerida pelo catálogo ou escolhida na linha), `categoriaId`, usos sanitário/nutricional/genético do catálogo, `produtoCatalogoId`. Herdáveis ficam null.
   - Se `nome` colidir com outro `Produto` sem vínculo, a operação falha com conflito que identifica o produto existente; a interface oferece usá-lo. Não há fusão automática.
4. Operação cancelada ou com erro não cria produto (mesma transação).
5. Itens do catálogo só são aceitos em compra de estoque, inventário inicial e bonificação, na aplicação sanitária com origem "Incluso no serviço" fora de fluxos de tarefa (tarefa, visita, IATF e execução de protocolo usam só Meus produtos) e no movimento manual de estoque; os demais tipos de operação e fluxos rejeitam `produtoCatalogoId` com erro de validação. Quando o item não traz categoria sugerida, a aplicação sanitária exige a escolha de uma categoria ativa. Uma adoção concorrente sob o ajuste de estoque Serializable pode responder 409; a pessoa tenta salvar de novo.

### Categoria financeira sugerida

A linha da operação mostra a categoria antes de salvar:

- Categorias ativas com a mesma flag de uso do item (`usoSanitario`, `usoNutricional`, `usoGenetico`). Exatamente uma → preenchida. Zero ou várias → campo vazio, obrigatório como hoje.
- Item com mais de um uso: interseção das flags; mesma regra.
- A escolha do usuário na linha vale para a adoção e não é memorizada no catálogo.

## Carga e atualização do catálogo

O deploy de STG e produção executa apenas migrations (ver [DEPLOY.md](../DEPLOY.md)). Por isso o catálogo é carregado por **migration de dados**:

- Uma migration por versão do catálogo, gerada por script a partir da extração curada (`scripts/catalogo-produtos/`). O SQL gerado é revisado e versionado no repositório; a fonte FDB não entra no repositório.
- Inserção e atualização por `(fonte, codigoOrigem)` com `ON CONFLICT DO UPDATE`. Itens que saem da fonte ficam `ativo = false`; nunca são apagados.
- Atualizar o catálogo nunca altera campos preenchidos pela fazenda; afeta apenas valores herdados e o nome não alterado.

## Interface

- **Seletor de produto**: grupos "Meus produtos" e "Catálogo", com apresentação e fabricante na linha. Escolher item do catálogo preenche a linha como qualquer produto; nenhum diálogo extra.
- **Cadastrar produto**: ação no seletor e na tela de Produtos, com o formulário atual (`FormProduto`).
- **Ficha do produto adotado**: campos herdáveis com indicação de origem e ação Restaurar; princípios ativos somente leitura; campos da fazenda editáveis como hoje.
- **Tela de Produtos (Estoque)**: lista só Meus produtos. Busca no catálogo apenas pelo seletor e pela aba única de consulta "Catálogo" (`/estoque?aba=catalogo`), somente leitura, com produto, fabricante, classificação, uso e situação na fazenda. Fabricantes, classificações e princípios ativos não têm abas próprias; seguem como filtros de Produtos. Links antigos `?aba=fabricantes|classificacoes-tecnicas|principios-ativos` abrem o Catálogo.
- Estados: carregando, erro com Tentar novamente, busca sem resultado (oferecer Cadastrar produto), conflito de nome na adoção, item do catálogo inativo já adotado.

## API

| Operação | Contrato |
|---|---|
| `GET /api/estoque/produtos/busca?q=&uso=&limite=` | `{ meus, catalogo }`, cada grupo até `limite` (padrão 10, máximo 50). `meus`: produtos ativos no formato do cadastro, com a mesma busca por nome de `GET /estoque/produtos`. `catalogo`: itens ativos não adotados, por nome normalizado ou fabricante, com `nomeCompleto`, `apresentacao`, `fabricante`, `unidadeSugerida` e `categoriaSugeridaId` |
| `GET /api/estoque/catalogo?busca=&pagina=&porPagina=` | Consulta paginada (padrão 20, máximo 50) dos itens ativos; cada item indica o `produtoId` que o adotou |
| `GET /api/estoque/catalogo/:id` | Item, ativo ou não, com fabricante, classificação e princípios ativos em ordem |
| Operações que recebem `produtoCatalogoId` | Item de operação financeira (categoria da própria linha; unidade da linha quando reconhecida), aplicação sanitária (individual e coletiva) e ajuste manual de estoque. Aplicação e ajuste aceitam `categoriaId` opcional, só junto de `produtoCatalogoId`, para a categoria do Produto adotado. Nunca `produtoId` e `produtoCatalogoId` juntos; o retorno traz o `produtoId` efetivo. Conflito de nome responde 409 com `produtoExistente: { id, nome }`. Os demais fluxos recebem só `produtoId` |
| `PATCH /api/estoque/produtos/:id` | Herdáveis com `null` restauram a herança; mudar `nome` de produto adotado marca `nomeAlterado`; `restaurarNome: true` volta ao nome do catálogo (409 se colidir) |

O DTO do produto traz os valores efetivos de `apresentacao`, `fabricante` e `classificacaoTecnica`, além de `produtoCatalogoId`, `nomeAlterado`, `origemCampos` (`catalogo` ou `fazenda` por campo), `catalogo` (`nomeCompleto`, `ativo`) e os `principiosAtivos` do item. A adoção usa `INSERT … ON CONFLICT DO NOTHING` sem alvo, que cobre as unicidades de `produtoCatalogoId` e `nome` sem abortar a transação; a releitura distingue adoção concorrente (mesmo produto) de nome já usado (conflito).

Leitura do catálogo exige sessão com acesso a Estoque (Financeiro ou Pecuária). Adoção acontece com a permissão da operação que a dispara.

## Fora desta entrega

Composição com concentração, versionamento de composição, perfil nutricional versionado, snapshot de composição na aplicação sanitária, catálogo de nutrientes, importação por fazenda com aceites, sinônimos de princípios ativos, edição do catálogo pela interface e sugestão de vínculo para produtos já cadastrados (fase posterior).
