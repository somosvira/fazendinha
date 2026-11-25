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
5. O catálogo pode ser usado em compra de estoque, inventário inicial, bonificação, movimento manual de estoque, aplicação sanitária com origem **Incluso no serviço** fora de fluxos de tarefa e planejamento de aplicação ou inserção no **cadastro de modelos reprodutivos**. Para o modelo, `planoAplicacao` recebe um ID de produto da fazenda ou do catálogo. O salvamento resolve o catálogo dentro da transação da versão, valida o uso sanitário, a categoria ativa e a unidade da dose, e guarda o ID de Produto na estrutura publicada. Consultas e estimativas do modelo são leituras. Tarefas, visitas e atendimento de protocolos continuam aceitando apenas Meus produtos. A aplicação sanitária e o cadastro reprodutivo exigem categoria ativa quando o catálogo não oferece sugestão. Uma adoção concorrente pode retornar 409 para nova tentativa.

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
- Estados: carregando, erro com Tentar novamente, busca sem resultado, conflito de nome na adoção, item do catálogo inativo já adotado. Fluxos com cadastro avulso oferecem **Cadastrar produto** na busca vazia. No cadastro de modelos reprodutivos, o seletor permite escolher produtos existentes ou itens do catálogo para adoção na gravação da versão.

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

## Conteúdo da embalagem e consumo sanitário

O catálogo estrutura apresentações completas e simples em `conteudoEmbalagem`,
`rotuloEmbalagem` e `unidadeSugerida`. Volume é normalizado para mL, massa para g
e apresentações declaradas em doses para DOSE. Kits, concentrações, apresentações
compostas e textos incompletos continuam sem conversão de embalagem. Não se
calcula conteúdo a partir da concentração do princípio ativo.

A compra de estoque pode informar a quantidade na unidade de controle ou em
embalagens inteiras, quando o produto adotado tem a mesma unidade do catálogo e
conteúdo estruturado. Uma embalagem de 100 mL gera entrada de 100 mL. O item da
compra conserva quantidade, unidade e valor da embalagem, com
`embalagemSnapshot` contendo fator e quantidade de estoque daquela operação.
Partidas da compra são informadas na medida escolhida e convertidas para o
movimento. O custo por unidade de estoque divide o valor pelo conteúdo recebido.
Estornos continuam usando os movimentos e valores originais.

A atualização do catálogo não troca a unidade dos produtos já adotados nem
reescreve movimentos, aplicações ou custos. Produto antigo em UN permanece UN
e não ganha conversão implícita para mL. Produtos manuais já controlados em mL
continuam nessa unidade. A regularização de um estoque antigo em embalagens
exige análise do saldo, custo e vínculos antes de converter ou substituir seu
cadastro.

O tablet oferece todas as apresentações sanitárias ativas do catálogo, além dos produtos locais. Selecionar ou enviar uma referência ainda não adotada não cria Produto, saldo ou custo: o envio conserva a identidade do catálogo, apresentação e unidade. A entrada normal de compra/estoque adota o produto; a aprovação resolve esse vínculo, confere a unidade histórica e exige saldo pelo consumo sanitário existente. Sem produto adotado ou saldo suficiente, o envio permanece pendente. Templates aceitam referências do catálogo e produtos locais; vínculos antigos continuam disponíveis sem duplicar apresentações. A busca global dos envios mantém o nome congelado nos itens e o destino da conferência, com os mesmos gates e escopo.

O tablet aceita a unidade real do Produto e até três casas decimais, conservando
a unidade no envio. UN, CX e SC exigem quantidades inteiras. Envios anteriores
sem unidade mantêm a interpretação histórica UN. A aprovação verifica se a
unidade do Produto ainda corresponde ao envio e usa o consumo sanitário
existente para converter unidades compatíveis e atribuir custo proporcional.

### Informações do medicamento

O tablet abre as informações em modal centralizado, com apresentação,
fabricante, classificação, princípios ativos, conservação e orientação técnica
já registrada na fazenda. Prazos desconhecidos continuam desconhecidos.
`orientacaoBula` no catálogo comporta referência documental com fonte HTTPS,
data de consulta, espécie, concentração, dosagem, via e cuidados. O vínculo
exige conferir a formulação e fabricante exatos. Sem referência conferida, a
tela informa a ausência. O catálogo atual não oferece cobertura de dosagem
validada para todos os medicamentos.

A orientação é de consulta e não preenche quantidade, carência ou diagnóstico
automaticamente. Conversão de embalagem é física e independente da dose clínica.

### Curadoria das referências oficiais

As referências conferidas ficam versionadas em
`scripts/catalogo-produtos/bulas/referencias-conferidas.json`; as pendências
investigadas ficam em `pendencias.json`. Cada vínculo identifica IDs,
fabricante e apresentações exatas. A carga por migration valida essa identidade
antes de escrever. O gerador `gerar-migration.ts` valida o contrato Zod
`orientacaoBulaSchema`; migrations já aplicadas permanecem imutáveis.

A versão 2 da orientação guarda o tipo de fonte (bula ou ficha técnica oficial),
URL, data de consulta, SHA-256 do documento, espécie, formulação e referências
por campo com seção e página quando disponível. O documento completo é acessado
na fonte, enquanto o catálogo armazena um resumo. Relações por peso conservam
faixas, unidades e condições. Uma dose por quarto, faixa etária ou indicação
não é convertida em dose universal por kg.

Quando uma ficha é complementada por catálogo técnico, imagem de tabela ou
prova oficial de sucessão do fabricante, `documentosComplementares` guarda
também URL, SHA-256, seção e página desses documentos. A referência por campo
aponta ao documento que sustenta o valor, sem preencher lacunas por analogia.
O lote `referencias-lote-ampliado.json` segue essa regra e é aplicado por
migration própria. Uma referência publicada pode continuar com campos
explicitamente não informados; publicação da fonte não significa ficha clínica
completa nem confirmação das demais apresentações do mesmo nome.

Carências têm estado próprio PRAZO, PROIBIDO ou NAO_INFORMADO. PRAZO aceita
zero somente quando expresso na fonte. Proibição e informação ausente usam
horas nulas. A indicação de prazo mantém a espécie, via e demais condições;
carências diferentes por via não são fundidas. Formulações divergentes, bulas
incompatíveis e apresentações não confirmadas ficam pendentes. Fabricantes
antigos não são substituídos por empresas atuais por semelhança de marca.

O Catálogo do Estoque abre as referências conferidas pelo nome do produto.
A URL `/estoque?aba=catalogo&referenciaCatalogo=ID&buscaCatalogo=NOME` permite
abrir a referência exata, inclusive pela busca global. A leitura exige as
permissões existentes de Estoque. O tablet reutiliza a mesma apresentação de
fontes, doses e carências. O conteúdo documental não altera os perfis técnicos
da fazenda ou o histórico sanitário, nem preenche automaticamente aplicações.
A cobertura é parcial e depende da confirmação individual das fontes.

O complemento conferido fica em `scripts/catalogo-produtos/bulas/referencias-complementares.json`, aplicado por migration própria. `pendencias.json` registra os motivos das divergências examinadas; `cobertura-pendente.json` conserva o levantamento inicial, sem representar a cobertura atual após novas rodadas. Esses arquivos não representam ausência comprovada de bula no mercado. A situação operacional vigente vem do catálogo no banco.

A rodada `referencias-prioridade-estoque.json` prioriza nomes encontrados no saldo local. Itens sintéticos/demonstrativos e produtos sem fabricante/apresentação/vínculo não recebem referência por aproximação e não são vinculados automaticamente. A identidade entre fabricante histórico e grupo atual exige evidência oficial guardada na curadoria, além da conferência de nome, princípio ativo e apresentação. Tabelas oficiais publicadas como imagem mantêm URL e SHA-256 adicionais; doses em UI ou por indicação não viram relações por kg. A leitura de saldo considera apenas movimentos confirmados: entradas e ajustes com seu sinal, saídas com sinal invertido.

### Referências históricas do DADOS777

Cadastros próprios da fazenda que não existem no catálogo comercial podem ser incorporados sob a fonte distinta `IDEAGRI_DADOS777`, conservando o código original e a evidência da extração. A migration `20261118143000_medicamentos_historicos_ideagri` inclui Banamine (11268), Catosal B12 (11269) e Kinetomax (11357), a partir do arquivo de SHA-256 `65eada38680c2c71e8ff72f1676924eeda4c5d88c3552ec311e99a0877ded56a`. A unidade mL vem das anotações explícitas de aplicação; o frasco de Kinetomax de 100 mL vem do nome cadastrado na origem. Banamine e Catosal permanecem sem apresentação ou fator de embalagem. Esses cadastros não conferem fabricante, formulação, via, dose, bula ou carência; desconhecimento não é zero. Compra por embalagem exige identificar seu conteúdo antes da conversão. A incorporação cria apenas referências, sem adotar Produto, gerar saldo ou custo.

Templates do tablet podem reutilizar composições documentadas, com autoria e auditoria contendo a origem, SHA-256, identificadores dos fatos e critério de seleção. São pré-seleções editáveis. Quantidades padrão por vaca podem ser explicitamente configuradas por medicamento, com unidade congelada, autoria e auditoria; não são inferidas do histórico nem calculadas por peso. A unidade divergente impede salvar e uma mudança posterior de unidade retira o preenchimento automático até revisão. Valores já digitados pelo operador são preservados ao reaplicar o template. Templates anteriores continuam sem quantidade configurada. Intervalos e carências não são preenchidos automaticamente; variações históricas não são unidas num tratamento único. Tamanho de embalagem escolhido entre referências comerciais existentes não comprova o tamanho utilizado no fato histórico. A conferência local e as alternativas pendentes ficam em `.backups/ideagri-tratamentos-20261118/`, fora do versionamento de dados privados.

A conferência das doenças efetivamente registradas no DADOS777 usa `DOENCAANIMAL` e, para mamites, `MAMITE`/`TRATAMENTOBASE`; nomes do catálogo sem ocorrências não comprovam uso. Os nomes resumidos são preservados inclusive para categorias como Grumo, CCS e Mancando, sem convertê-las em diagnósticos. Cada template histórico representa uma composição identificável de um atendimento, não a união dos medicamentos de todos os animais. Observações abreviadas ou formulações ambíguas permanecem pendentes; Outros não recebe composição automática porque agrega problemas distintos. Um item isolado nas observações não comprova tratamento completo. Templates já configurados são preservados.

A migration `20261118220000_catalogo_historico_templates` acrescenta as referências próprias ECP (11179), Flumax (11199), Pencivet Plus (11203) e Excede (11294). Pencivet Plus não é associado por suposição às variantes PPU, Forte ou Superforte. Somente Excede tem embalagem identificada pelo nome de origem (100 mL); os demais permanecem sem fator. O vínculo das composições com os fatos e as pendências fica na auditoria e na conferência privada local, sem importar novas aplicações, movimentar estoque ou atribuir custos. A disponibilidade no tablet é verificada pela consulta operacional de opções; isso não equivale à homologação pela interface. A busca global continua encontrando os cadastros de doenças; templates mantêm a busca interna por doença/medicamento, conforme seu contrato.

### Conferência parcial por campo

A referência pode conservar dados oficiais confirmados mesmo quando outros campos ainda dependem de conferência. `orientacaoBula` versão 2 preserva o contrato anterior; versão 3 admite espécie, composição quantitativa, dosagem, via e cuidados nulos, exigindo motivo para cada ausência e fonte para cada valor preenchido. Carências desconhecidas continuam `NAO_INFORMADO` com horas nulas e motivo explícito; zero exige declaração oficial. A versão parcial não completa dados por semelhança de nome, cálculo indireto ou bula de outro país. Cada documento conserva URL, data, hash e seção/página por campo.

Itens sem referência validada guardam `conferenciaBula`, com estado de pesquisa, conferência ou identidade pendente, motivos por campo e links que ainda precisam de conferência. Esses links não validam os dados clínicos. O tablet e o catálogo mostram os mesmos dados confirmados e a lista de pendências; campos pendentes não ocultam os demais. Cadastros demonstrativos e produtos sem vínculo recebem explicação específica. O Banamine histórico, sem apresentação ou forma farmacêutica, não herda automaticamente dados do Banamine Injetável, pois existe também a versão transdérmica.

A migration `20261118170000_conferencia_parcial_bulas` acrescenta a conferência ao catálogo sanitário vigente, incorpora cinco referências do arquivo `referencias-parciais.json` e aproveita os motivos já documentados em `pendencias.json`. Doses dos templates, perfis da fazenda, aplicações e carências operacionais não são preenchidos a partir desse conteúdo de consulta. O vínculo com a referência oficial e sua versão não renomeia produtos históricos nem gera estoque, custo ou aplicação. O catálogo é a fonte de consulta; a confirmação administrativa conserva as guardas do fluxo sanitário.

Lotes posteriores usam `gerar-migration-incremental.ts`: cada atualização exige identidade exata e referência ainda vazia, sem reinicializar pendências ou sobrescrever referências anteriores. `referencias-continuacao-msd.json` conserva também as tabelas oficiais de dosagem como documentos complementares. Condições dependentes do parto permanecem descritas por extenso e sem horas fixas após aplicação; redação oficial contraditória mantém o campo pendente. Nenhum desses dados preenche automaticamente os perfis operacionais ou as quantidades dos templates.

O lote `referencias-lote-multifabricantes.json` amplia a consulta com fichas parciais por campo e uma tabela oficial de diluição. `pendencias-lote-multifabricantes.json` registra os motivos específicos das apresentações examinadas que não receberam vínculo. Relações de diluição para pulverização ou higiene permanecem no texto da fonte, sem se tornarem dose por kg ou conversão de saldo; espécies não bovinas permanecem explícitas. Divergência interna de carência, dosagem ou esquema especial mantém a pendência correspondente sem ocultar os outros campos confirmados.

A revisão ampliada fica em `referencias-revisao-catalogo.json`. `pesquisa-catalogo.json` registra todos os itens sem referência no início da rodada, o método efetivamente utilizado, fontes consultadas e consultas agrupadas com hash da evidência. Leitura de índice e tentativa de busca não equivalem a conferência exaustiva nem comprovam inexistência de bula; resultados de busca não validam conteúdo clínico. Formulação, apresentação, carências e demais campos continuam pendentes até confirmação individual. Os motivos anteriores são preservados nos itens não publicados. `gerar-migration-pesquisa.ts` acrescenta à migration apenas os motivos pendentes, exigindo identidade e conferência anterior iguais ao snapshot; referências confirmadas são geradas pelo fluxo incremental já existente. As evidências completas de consulta e documentos ficam no diretório privado indicado no levantamento.
