# Reprodução Bloco E — FIV/TE e pool de doadoras — Design

**Data:** 2026-07-27
**Branch base:** `main` (Blocos A `#209`, B `#215`, C `#216` mergeados; Bloco D em `#217`, aberto)
**Contrato de aceite:** [`docs/design/reproducao-paridade-ideagri.md`](../../design/reproducao-paridade-ideagri.md)
**Spec-mãe:** [`docs/superpowers/specs/2026-07-26-reproducao-paridade-ideagri-design.md`](2026-07-26-reproducao-paridade-ideagri-design.md) (Bloco E, §4)
**Status:** aprovado no brainstorming (2026-07-27, usuário: "tudo aprovado e confirmado, não me peça mais nada").

---

## 1. Objetivo

Fechar as linhas *Coleta FIV/TE* e *Pool de doadoras* do contrato de paridade. Hoje a transferência de embrião (TE) existe só como `EventoReprodutivo` com doadora e sêmen em texto livre; não há coleta, oócito, embrião como estoque, nem grupo de doadoras. Este bloco entrega:

1. **Coleta operacional** — `Coleta` (doadora, técnico, data, método, laboratório, status) com `OocitoColeta` agregado por qualidade/viabilidade e `FertilizacaoColeta` por reprodutor (uma coleta pode usar vários touros).
2. **Embrião como estoque** — `EmbriaoColeta` (classificação oficial, estágio, viabilidade, estado `DISPONIVEL`/`TRANSFERIDO`/`DESCARTADO`) com o dicionário `EmbriaoClassificacao` (6) importado. A TE nova pode selecionar um embrião disponível e o consome atomicamente; excluir/estornar a TE devolve o embrião.
3. **Pool de doadoras** — `GrupoPoolDoadora` + itens + `AplicacaoPoolDoadora` que gera uma `Coleta` em rascunho por doadora ativa. O 777 tem `GRUPOPOOLDOADORA` vazio → validado por fixture, sem seed inventado.
4. **Import fail-closed + fixture** — parsers dos blocos de coleta/embrião/pool com teste sintético; reconciliação 7 coletas + estágios registrada como pendência da máquina com `DADOS777.FDB`.

## 2. Decisões (do brainstorming)

1. **Embrião = estoque controlado.** `EmbriaoColeta` tem estado; a TE nova seleciona um embrião `DISPONIVEL`, marca `TRANSFERIDO` na mesma transação, impede reutilização (só um `EventoReprodutivo.embriaoColetaId` por embrião) e devolve para `DISPONIVEL` no estorno/exclusão da TE. O histórico legado continua registrando TE **sem** embrião interno (preserva `ideagriEmbriaoId`/`doadoraNumero`/`doadoraNome`/`reprodutor` texto).
2. **Oócitos agregados por qualidade+viabilidade+quantidade.** Uma linha por combinação, `quantidade > 0`; sem identidade artificial por oócito.
3. **Fertilização por reprodutor.** `FertilizacaoColeta` liga a coleta a um `Reprodutor` (+ `EstoqueSemen` opcional); cada `EmbriaoColeta` pertence a exatamente uma fertilização → paternidade inequívoca. Doadora vem da coleta.
4. **Baixa de dose na FIV = opcional-com-aviso (mesmo contrato do Bloco C).** Sem lote → segue; lote com saldo ≥ 1 → decrementa 1 atomicamente; saldo 0 → registra com aviso, nunca negativo; cancelar a fertilização antes de ela ter embriões devolve a dose.
5. **Imutabilidade após uso.** Coleta/fertilização podem ser editadas enquanto não têm filhos (embriões); depois disso os campos estruturais (doadora/reprodutor/lote/método) ficam imutáveis. Exclusão só sem dependentes; correção clínica posterior via status/cancelamento auditável.
6. **Aplicar pool = lote com uma coleta por doadora.** `AplicacaoPoolDoadora` audita data/técnico e cria uma `Coleta` em `RASCUNHO` por doadora ativa do grupo; cada coleta mantém oócitos/embriões separados.
7. **Fonte = parser + fixture agora, reconciliar depois.** Sem seed-semente inventado; a biblioteca opera com o que o usuário cadastrar até a reextração do `DADOS777.FDB`.

## 3. Arquitetura e convenções

Mesmo pipeline do módulo: **rota fina (`routes/rebanho/`) → service (`services/rebanho/`) → cálculo puro (`*.calc.ts`) + schemas (`*.schemas.ts`)**, cada cálculo com TDD. Invariantes herdadas dos Blocos A–D:

- **Escopo de propriedade** via `resolverEscopoLeitura/Escrita(c)`; fatos de sítio (`Coleta`, `EmbriaoColeta`, `GrupoPoolDoadora`, `AplicacaoPoolDoadora`) levam `propriedadeId Int?`; o dicionário `EmbriaoClassificacao` é **compartilhado** (sem `propriedadeId`). Acesso cruzado → `NAO_ENCONTRADO` (não vaza existência).
- **Identidade de origem** `ideagri<Entidade>Id Int? @unique` → import idempotente (upsert por origem); código/sigla inválido no import **aborta** (`main()` fail-closed), nunca colapsa.
- **Decimal** via Prisma Decimal → `Number()` só na borda (mappers). Datas `@db.Date` de `new Date("YYYY-MM-DDT00:00:00Z")`.
- **Sync de schema:** migration aditiva idempotente (`CREATE TABLE IF NOT EXISTS`/`ADD COLUMN IF NOT EXISTS` + `CREATE TYPE` guardado por `pg_type` + FKs guardadas por `pg_constraint`) + `prisma:generate`; `db push` em prod.
- **Operações compostas em transação** (TE + baixa de embrião; fertilização + baixa de dose; aplicar pool): conflito estrutural aborta tudo (padrão `EventoError`/`ConflitoLactacaoError`).
- **Não regredir** os Blocos A–D nem a TE v1: a TE por texto livre (doadora/sêmen) continua válida; `embriaoColetaId` é aditivo e opcional.

## 4. Schema (aditivo)

**Dicionário (compartilhado):**
- `EmbriaoClassificacao`: `id`, `ideagriId Int? @unique`, `sigla String @unique`, `nome String`, `ordem Int @default(0)`, `ativo Boolean @default(true)`. Preserva as 6 classificações oficiais do IDEAGRI. `estagio` permanece um campo canônico separado no embrião (`MORULA`, `BLASTOCISTO_INICIAL`, `BLASTOCISTO`, `BLASTOCISTO_EXPANDIDO`, `BLASTOCISTO_ECLODINDO`, `BLASTOCISTO_ECLODIDO`) — o import não presume que classificação e estágio sejam a mesma dimensão.

**Coleta (fato de sítio):**
- `Coleta`: `id`, `ideagriId Int? @unique`, `doadoraId Int` (FK `Animal`, `onDelete: Restrict`), `data DateTime @db.Date`, `tecnico String?`, `metodo String` (`FIV`|`TE_CONVENCIONAL`), `laboratorio String?`, `status String @default("RASCUNHO")` (`RASCUNHO`|`CONCLUIDA`|`CANCELADA`), `canceladaEm DateTime?`, `motivoCancelamento String?`, `observacao String?`, `aplicacaoPoolId Int?` (FK `AplicacaoPoolDoadora`, `onDelete: SetNull`), `propriedadeId Int?`, timestamps. Cancelar preserva filhos/histórico; coleta com embrião transferido não pode ser reaberta. `@@index([doadoraId])`, `@@index([propriedadeId])`, `@@index([aplicacaoPoolId])`.
- `OocitoColeta`: `id`, `coletaId` (FK `onDelete: Cascade`), `qualidade String`, `viavel Boolean`, `quantidade Int`. `@@unique([coletaId, qualidade, viavel])`.
- `FertilizacaoColeta`: `id`, `ideagriId Int? @unique`, `coletaId` (FK `onDelete: Cascade`), `reprodutorId Int` (FK `Reprodutor`, `onDelete: Restrict`), `estoqueSemenId Int?` (FK `EstoqueSemen`, `onDelete: SetNull`), `doseBaixada Boolean @default(false)`, `data DateTime? @db.Date`, `tecnica String?`, `status String @default("ATIVA")` (`ATIVA`|`CANCELADA`), `canceladaEm DateTime?`, `motivoCancelamento String?`. Cancelamento sem embriões devolve a dose; com embriões, preserva histórico e não devolve/reescreve paternidade. `@@index([coletaId])`, `@@index([reprodutorId])`, `@@index([estoqueSemenId])`.

**Embrião (fato de sítio, estoque):**
- `EmbriaoColeta`: `id`, `ideagriId Int? @unique`, `fertilizacaoId Int` (FK `onDelete: Cascade`), `classificacaoId Int?` (FK `EmbriaoClassificacao`, `onDelete: SetNull`), `codigoInterno String?`, `estagio String?`, `viavel Boolean @default(true)`, `estado String @default("DISPONIVEL")` (`DISPONIVEL`|`TRANSFERIDO`|`DESCARTADO`), `propriedadeId Int?`, timestamps. `@@index([fertilizacaoId])`, `@@index([classificacaoId])`, `@@index([estado])`, `@@index([propriedadeId])`.

**Pool (fato de sítio):**
- `GrupoPoolDoadora`: `id`, `ideagriId Int? @unique`, `nome String`, `ativo Boolean @default(true)`, `propriedadeId Int?`, timestamps. `@@index([propriedadeId])`.
- `ItemGrupoPoolDoadora`: `id`, `grupoId` (FK `onDelete: Cascade`), `doadoraId Int` (FK `Animal`, `onDelete: Cascade`), `ativo Boolean @default(true)`. `@@unique([grupoId, doadoraId])`.
- `AplicacaoPoolDoadora`: `id`, `grupoId Int` (FK `onDelete: Restrict`), `data DateTime @db.Date`, `tecnico String?`, `propriedadeId Int?`, timestamps. `@@unique([grupoId, data])` impede clique duplo de gerar coletas repetidas no mesmo dia; repetição retorna `CONFLITO`. `@@index([grupoId])`, `@@index([propriedadeId])`. `coletas Coleta[]` (inverso).

**Alteração:** `EventoReprodutivo.embriaoColetaId Int? @unique` + FK `onDelete: SetNull` (só um evento por embrião → impede dupla transferência). `Animal` ganha inversos `coletasComoDoadora Coleta[]`, `poolsComoDoadora ItemGrupoPoolDoadora[]`. `Reprodutor` ganha `fertilizacoes FertilizacaoColeta[]`. `EstoqueSemen` ganha `fertilizacoes FertilizacaoColeta[]`. `Propriedade` ganha os inversos dos fatos de sítio.

## 5. Cálculo puro (TDD)

- `embriao-estoque.calc.ts` — `planejarTransferenciaEmbriao({ estadoAtual }) → { transferir, novoEstado, erro? }` e o inverso `planejarDevolucaoEmbriao({ estadoAtual }) → { devolver, novoEstado }`. Só embrião `DISPONIVEL` transfere; `TRANSFERIDO`/`DESCARTADO` → erro `EMBRIAO_INDISPONIVEL`. Devolução só de `TRANSFERIDO` → `DISPONIVEL`. O service faz a baixa **atômica condicional** (`updateMany where estado="DISPONIVEL"` → `count === 1`), espelhando o padrão de dose do Bloco C: dois eventos concorrentes nunca transferem o mesmo embrião.
- `oocitos.calc.ts` — `consolidarOocitos(linhas) → { total, viaveis, inviaveis, porQualidade }` + validação (`quantidade ≤ 0` ou combinação duplicada → erro). Puro sobre a lista.
- `coleta-imutabilidade.calc.ts` — `podeEditarEstrutura({ temEmbrioes }) → boolean` e `podeExcluirColeta({ temFertilizacoes, temEmbrioes })`. Regra: sem filhos → editável/excluível; com filhos → travado.
- Reuso de `planejarBaixaDose`/`planejarDevolucaoDose` (Bloco C) na fertilização FIV — sem novo cálculo de dose.

## 6. Import (fail-closed + fixture)

Estende `scripts/build-rebanho-json.mjs` (+ `.test.mjs`) com parsers puros exportados (delimitador `~|~`):
- `parseEmbriaoClassificacao` (`@EMBCLASS@`: ideagriId · sigla · nome · ordem)
- `parseColeta` (`@COLETA@`: ideagriId · doadoraNumero · data · tecnico · metodo · laboratorio · status)
- `parseOocitoColeta` (`@OOCITO@`: coletaIdeagriId · qualidade · viavel(0|1) · quantidade)
- `parseFertilizacao` (`@FERTCOL@`: ideagriId · coletaIdeagriId · reprodutorIdeagriId · tipoSemenSigla? · data · tecnica)
- `parseEmbriaoColeta` (`@EMBRIAO@`: ideagriId · fertilizacaoIdeagriId · classificacaoSigla · codigoInterno · estagio · viavel(0|1))
- `parseGrupoPool` (`@POOLGRP@`: ideagriId · nome) / `parseItemGrupoPool` (`@POOLITEM@`: grupoIdeagriId · doadoraNumero)

Cada parser: fixture válida + rejeição de linha inválida → `null` → `main()` aborta e reporta amostra.

`server/src/services/rebanho/import-fiv.ts` (testável com mock Prisma, estilo `import-genetica.ts`): upsert idempotente por `ideagriId`/sigla; resolve doadora por `numero`, reprodutor por `ideagriId`, classificação por sigla; referência quebrada (doadora/reprodutor/coleta/fertilização ausente) **aborta**. Depois de importar os embriões, reconcilia `EventoReprodutivo.ideagriEmbriaoId` com `EmbriaoColeta.ideagriId`: um match único ganha `embriaoColetaId` e estado `TRANSFERIDO`; múltiplos eventos para a mesma origem ou divergência de doadora/reprodutor **abortam** em vez de adivinhar. TE sem match continua legado textual. Chamado por `import-rebanho.ts` quando os arrays existem no JSON. Pool vazio na 777 → nenhum registro criado, sem erro (validado por fixture sintética própria, não por seed).

**Reconciliação 7 coletas + estágios** registrada como pendência da máquina em `docs/reproducao-teste-na-maquina-ideagri.md`.

## 7. Services e rotas

- `fiv.ts` — CRUD de `Coleta` (com oócitos e fertilizações), `EmbriaoColeta` e dicionário `EmbriaoClassificacao`; regras de imutabilidade (`coleta-imutabilidade.calc`); fertilização FIV aplica `planejarBaixaDose` na transação; cancelar fertilização sem embriões devolve a dose.
- `pool-doadora.ts` — CRUD de `GrupoPoolDoadora` + itens; `aplicarPool(grupoId, { data, tecnico })` cria `AplicacaoPoolDoadora` + uma `Coleta` em `RASCUNHO` por doadora ativa, na mesma transação.
- `eventos.ts` — `registrarEvento` TE aceita `embriaoColetaId?`; valida o embrião no sítio; na transação aplica `planejarTransferenciaEmbriao`, grava `embriaoColetaId`, marca o embrião `TRANSFERIDO` e deriva doadora (via coleta) e touro (via fertilização) quando o embrião interno é informado. `excluirEvento` devolve o embrião (`DISPONIVEL`) quando `embriaoColetaId` estava setado. TE por texto livre (sem `embriaoColetaId`) permanece intacta.
- Rotas finas em `routes/rebanho/` (fiv, pool; eventos estendido), escopo resolvido no handler; erros de domínio (`FivError`/`PoolError` com `NAO_ENCONTRADO`/`CONFLITO`) → 404/409.

## 8. UI (padrão `rb-*`, sem deps/paleta novas)

- **Nova sub-aba `reb-fiv` (FIV/TE)** no módulo Rebanho (`nav.ts` + `router.ts` + sidebar + searchIndex): lista de coletas por doadora/data/status, com estado vazio.
- **Cadastro de coleta:** doadora, data, técnico, método, laboratório; oócitos por qualidade/viabilidade (linhas somáveis); fertilizações por reprodutor (+ lote de sêmen opcional com saldo/aviso). Campos estruturais bloqueados quando a coleta já tem embriões.
- **Embriões da coleta:** tabela com classificação/estágio/viabilidade/estado; ação de descartar; embrião `TRANSFERIDO` mostra a TE vinculada (read-only).
- **Pool de doadoras:** CRUD do grupo + itens; botão "Aplicar pool" (data/técnico) que cria as coletas em rascunho e as lista.
- **TE (`EventoForm`):** seletor opcional de embrião disponível da coleta; ao escolher, doadora e touro passam a vir do embrião (campos de texto ficam read-only). Sem embrião, o fluxo por texto livre continua. Helpers de payload puros extraídos e testados por literal.

## 9. Testes e gate

- **Puro:** `embriao-estoque.calc`, `oocitos.calc`, `coleta-imutabilidade.calc`, parsers (fixture + rejeição).
- **Service (Vitest + mock Prisma):** escopo de `Coleta`/`EmbriaoColeta`/pool; transferência atômica de embrião + devolução no estorno; baixa de dose na fertilização + devolução no cancelamento; imutabilidade após embriões; `aplicarPool` cria N coletas; upsert idempotente no import; pool vazio no-op.
- **Client:** render smoke das seções (FIV/TE, pool); payload helpers por literal; fetchers `api.ts` (path/método).
- **Gate:** novos testes server+client verdes · `node --test build-rebanho-json.test.mjs` · `pnpm build` · migration idempotente + `prisma:generate` · doc de reconciliação atualizado.

## 10. Interfaces entre blocos

- **C→E:** `EstoqueSemen`/`Reprodutor` são referenciados por `FertilizacaoColeta` (paternidade + baixa de dose reusando o Bloco C).
- **B→E:** o evento TE (`ideagriEmbriaoId`, `doadoraId`) já liga o embrião legado à receptora; `embriaoColetaId` é a ponte nova para o embrião interno.
- **E→F:** `Coleta`/`EmbriaoColeta`/estágios alimentam a reconciliação e os relatórios reprodutivos do Bloco F.
- **Retrocompat:** a TE v1 por texto livre e todos os testes A–D permanecem sem reescrita; `embriaoColetaId` é aditivo/opcional.

## 11. Fora de escopo

Relatórios reprodutivos e reconciliação final (Bloco F); import real dos dados do `DADOS777.FDB` (pendência de máquina — a reconciliação exata de 7 coletas + estágios finaliza na máquina do usuário); integrações de dispositivo/mobile e "Receber coletas" (N/A arquitetural, Bloco F); sexagem/genotipagem de embrião além de viável/inviável e classificação oficial.
