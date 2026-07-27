# Reprodução Bloco C — Sêmen e genética estruturados — Design

**Data:** 2026-07-27
**Branch base:** `main` (Blocos A `#209` e B `#215` mergeados)
**Contrato de aceite:** [`docs/design/reproducao-paridade-ideagri.md`](../../design/reproducao-paridade-ideagri.md)
**Spec-mãe:** [`docs/superpowers/specs/2026-07-26-reproducao-paridade-ideagri-design.md`](2026-07-26-reproducao-paridade-ideagri-design.md) (Bloco C, §4)
**Status:** aprovado no brainstorming (2026-07-27).

---

## 1. Objetivo

Fechar a linha *Reprodutor/sêmen/genética* do contrato de paridade. Hoje `Reprodutor` guarda só 4 PTAs fixos + `tpi` e `acasalamento` compara apenas o texto do pai. Este bloco entrega:

1. **Catálogo genético flexível e gerenciável** — os 271 indicadores do IDEAGRI como catálogo (N:N reprodutor↔indicador), marcadores (20) e caseínas (15) como dicionários com valores por touro, e pedigree do reprodutor. Editável na UI.
2. **Estoque de sêmen** — tipos de sêmen (3), doses/lote/localização por reprodutor, com **baixa opcional-com-aviso** de dose na IA (transacional, reversível no estorno).
3. **Import fail-closed + fixture** — parsers dos blocos genéticos/sêmen com teste sintético; reconciliação 67/271/20/15/3 registrada como pendência da máquina com `DADOS777.FDB`.

## 2. Decisões (do brainstorming)

1. **Baixa de dose = opcional-com-aviso.** IA sem lote continua por texto livre (retrocompat IATF/histórico). Com lote e saldo ≥ 1 → decrementa 1. Com lote e saldo 0 → registra mesmo assim, grava o vínculo e retorna aviso; saldo nunca fica negativo. Estornar/excluir a IA devolve a dose.
2. **Genética totalmente operacional + catálogo gerenciado.** Usuário cria/edita os tipos de indicador (compartilhados) e lança valores/marcadores/caseína/pedigree por reprodutor; ranking configurável por indicador.
3. **PTAs legados convivem com o catálogo via espelho (abordagem A).** As colunas `ptaLeite/ptaGordura/ptaProteina/tpi` permanecem em `Reprodutor`. `IndicadorGenetico.colunaLegada` mapeia siglas conhecidas → colunas; ao gravar/importar um `ValorIndicadorReprodutor` de indicador com `colunaLegada`, o valor é projetado na coluna. `reprodutor.calc`, `acasalamento.calc` e a UI de ranking atual **não mudam**; o Bloco D migra o `recomendar` para indicadores/pedigree quando chegar.
4. **Fonte de dados = parser + fixture agora, reconciliar depois.** Sem seed-semente inventado; a biblioteca opera com o que o usuário cadastrar até a reextração.

## 3. Arquitetura e convenções

Mesmo pipeline do módulo: **rota fina (`routes/rebanho/`) → service (`services/rebanho/`) → cálculo puro (`*.calc.ts`) + schemas (`*.schemas.ts`)**, cada cálculo com TDD. Invariantes herdadas dos Blocos A/B:

- **Escopo de propriedade** via `resolverEscopoLeitura/Escrita(c)`; fatos de sítio (`EstoqueSemen`) levam `propriedadeId Int?`; dicionários (`IndicadorGenetico`, `MarcadorGenetico`, `Caseina`, `TipoSemen`) são **compartilhados** (sem `propriedadeId`). Acesso cruzado → `NAO_ENCONTRADO`.
- **Identidade de origem** `ideagri<Entidade>Id Int? @unique` → import idempotente (upsert por origem); sigla/código inválido no import **aborta** (`main()` fail-closed), nunca colapsa em outro tipo.
- **Decimal** via Prisma Decimal → `Number()` só na borda (mappers). Datas `@db.Date` de `new Date("YYYY-MM-DDT00:00:00Z")`.
- **Sync de schema:** migration aditiva idempotente (`CREATE TABLE IF NOT EXISTS`/`ADD COLUMN IF NOT EXISTS` + FKs guardadas por `pg_constraint`) + `prisma:generate`; `db push` em prod.
- **Operações compostas em transação** (IA + baixa de dose; import): conflito estrutural aborta tudo (padrão `ConflitoLactacaoError`).

## 4. Schema (aditivo)

**Genética:**
- `IndicadorGenetico` (compartilhado): `id`, `ideagriId Int? @unique`, `sigla String @unique`, `nome String`, `unidade String?`, `direcao String` (`maior_melhor`|`menor_melhor`), `colunaLegada String?` (`ptaLeite`|`ptaGordura`|`ptaProteina`|`tpi`|null), `ranking Boolean @default(false)`, `ativo Boolean @default(true)`.
- `ValorIndicadorReprodutor`: `reprodutorId`, `indicadorId`, `valor Decimal @db.Decimal(12,3)`, `@@unique([reprodutorId, indicadorId])`, `@@index([indicadorId])`. FKs `onDelete: Cascade` (reprodutor) / `Cascade` (indicador).
- `MarcadorGenetico` (compartilhado, dicionário): `sigla @unique`, `nome`, `ideagriId Int? @unique`.
- `ValorMarcadorReprodutor`: `reprodutorId`, `marcadorId`, `resultado String`, `@@unique([reprodutorId, marcadorId])`.
- `Caseina` (compartilhado, dicionário): `sigla @unique`, `nome`, `ideagriId Int? @unique`.
- `ValorCaseinaReprodutor`: `reprodutorId`, `caseinaId`, `genotipo String`, `@@unique([reprodutorId, caseinaId])`.
- `PedigreeReprodutor` (1:1 com `Reprodutor`): `reprodutorId Int @unique`, `paiNome?`, `paiCodigo?`, `maeNome?`, `maeCodigo?`, `avoMaternoNome?`, `avoMaternoCodigo?`, `avoPaternoNome?`, `avoPaternoCodigo?`, `ideagriId Int? @unique`.

**Sêmen:**
- `TipoSemen` (compartilhado, dicionário): `sigla @unique`, `nome`, `ideagriId Int? @unique`.
- `EstoqueSemen` (fato de sítio): `reprodutorId`, `tipoSemenId Int?`, `lote String?`, `localizacao String?`, `dosesDisponiveis Int @default(0)`, `propriedadeId Int?`, `ideagriId Int? @unique`, `@@index([reprodutorId])`, `@@index([propriedadeId])`.

**Alteração:** `EventoReprodutivo.estoqueSemenId Int?` + FK `onDelete: SetNull`. `Reprodutor` ganha só os inversos das relações novas; colunas legadas intactas.

## 5. Cálculo puro (TDD)

- `semen-baixa.calc.ts` — `planejarBaixaDose({ estoqueSemenId?, dosesDisponiveis }) → { consumir, novoSaldo, aviso? }`; inverso `planejarDevolucaoDose` para estorno. Casos: sem lote → nada; saldo ≥1 → −1; saldo 0 → não consome + aviso; devolução → +1.
- `genetica-espelho.calc.ts` — `projetarColunasLegadas(valores, indicadoresPorId) → Partial<{ ptaLeite, ptaGordura, ptaProteina, tpi }>` a partir de `colunaLegada`. Um teste por coluna + indicador sem coluna (ignorado).
- `ranking-reprodutor.calc.ts` — `ranquearPorIndicador(reprodutores, indicadorId, direcao) → ordenado`; respeita `maior_melhor`/`menor_melhor`, valores ausentes ao fim. Default (sem indicador) delega ao `resumoIndices` atual.

## 6. Import (fail-closed + fixture)

Estende `scripts/build-rebanho-json.mjs` (+ `.test.mjs`) com parsers puros exportados:
`parseReprodutorGenetico` (`@REPRODUTOR@`), `parseIndicadorGenetico` (`@INDICADOR@`), `parseValorIndicador` (`@VALORIND@`), `parseMarcador`/`parseValorMarcador`, `parseCaseina`/`parseValorCaseina`, `parseTipoSemen`, `parseEstoqueSemen`, `parsePedigree`. Cada um: fixture sintética + rejeição de linha inválida (código/sigla ausente → `null` → `main()` aborta e reporta amostra).

`server/src/services/rebanho/import-genetica.ts` (testável com mock Prisma, estilo `import-iatf.ts`): upsert idempotente por `ideagriId`/sigla; resolve reprodutor por `ideagriId`; ao gravar `ValorIndicadorReprodutor` de indicador com `colunaLegada`, projeta na coluna de `Reprodutor` (usa `genetica-espelho.calc`). Chamado por `import-rebanho.ts` quando os arrays existem no JSON.

**Reconciliação 67/271/20/15/3** (+ valores) registrada como pendência da máquina em `docs/reproducao-teste-na-maquina-ideagri.md`.

## 7. Services e rotas

- `genetica.ts` — CRUD `IndicadorGenetico`/`MarcadorGenetico`/`Caseina` (dicionários compartilhados, `catalogoNoEscopo`); listagem para os seletores; upsert de valores/pedigree por reprodutor (grava N:N + espelha colunas na mesma escrita).
- `semen.ts` — CRUD `TipoSemen` (dicionário) + `EstoqueSemen` (escopo de sítio); entrada/ajuste de doses.
- `eventos.ts` — `registrarEvento` INSEMINACAO aceita `estoqueSemenId?`; valida no sítio; na transação, aplica `planejarBaixaDose` e grava `estoqueSemenId`. `excluirEvento`/estorno devolve a dose. `iatf.ts` (`atualizarExecucaoNaTransacao`): quando a execução terminal informa lote, mesma baixa.
- Rotas finas em `routes/rebanho/` (genetica, semen; eventos estendido), escopo resolvido no handler.

## 8. UI (padrão `rb-*`, sem deps/paleta novas)

- **Cadastro de indicadores** (Cadastros/Reprodução): CRUD do catálogo + flag "de ranking".
- **Ficha do reprodutor** (expande `ReprodutoresSection`): valores por indicador, marcadores, caseína, pedigree; tabela dos indicadores importados.
- **Ranking configurável:** seletor "ordenar por"; default = PTA leite/TPI atuais.
- **Estoque de sêmen:** dose/lote/localização por reprodutor + entrada de doses (`RebTable`/`RebBox`).
- **IA (`EventoForm`):** seletor opcional de lote (`EstoqueSemen` do reprodutor) com saldo + aviso de "estoque zerado". Helpers puros de payload extraídos e testados por literal.

## 9. Testes e gate

- **Puro:** `semen-baixa.calc`, `genetica-espelho.calc`, `ranking-reprodutor.calc`, parsers (fixture + rejeição).
- **Service (Vitest + mock Prisma):** escopo de `EstoqueSemen`; baixa atômica + devolução no estorno; upsert idempotente + espelho no import; CRUD de dicionários compartilhados.
- **Client:** render smoke das seções; payload helpers por literal; fetchers `api.ts` (path/método).
- **Gate:** novos testes server+client verdes · `node --test build-rebanho-json.test.mjs` · `pnpm build` · migration idempotente + `prisma:generate` · doc de reconciliação atualizado.

## 10. Interfaces entre blocos

- **C→D:** `ValorIndicadorReprodutor` + `PedigreeReprodutor` são a entrada do `recomendar` puro (o Bloco D migra o cálculo).
- **C→E:** `EstoqueSemen`/reprodutor referenciados por `Coleta`/`EmbriaoColeta`.
- **Retrocompat:** colunas legadas espelhadas mantêm `reprodutor.calc`/`acasalamento.calc`/ranking atuais sem reescrita.

## 11. Fora de escopo

Migrar `acasalamento`/`recomendar` para indicadores+pedigree (Bloco D); coleta FIV/TE e pool de doadoras (Bloco E); relatórios e reconciliação final (Bloco F); import real dos dados do `DADOS777.FDB` (pendência de máquina).
