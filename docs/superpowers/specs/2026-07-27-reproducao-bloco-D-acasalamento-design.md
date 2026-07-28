# Reprodução Bloco D — Acasalamento dirigido — Design

**Data:** 2026-07-27
**Branch base:** `main` (Blocos A `#209`, B `#215`, C `#216` mergeados; base do fork `b7ceb2f`)
**Branch de trabalho:** `feat/reproducao-acasalamento`
**Contrato de aceite:** [`docs/design/reproducao-paridade-ideagri.md`](../../design/reproducao-paridade-ideagri.md) (linha *Medidas/recomendação de acasalamento*)
**Spec-mãe:** [`docs/superpowers/specs/2026-07-26-reproducao-paridade-ideagri-design.md`](2026-07-26-reproducao-paridade-ideagri-design.md) (Bloco D, §4)
**Precursor (v1 read-only):** [`docs/superpowers/specs/2026-07-20-recomendacao-acasalamento-design.md`](2026-07-20-recomendacao-acasalamento-design.md) (PR #186)
**Status:** aprovado no brainstorming (2026-07-27).

---

## 1. Objetivo

Fechar a linha *Medidas/recomendação de acasalamento* do contrato de paridade IDEAGRI. Hoje o `recomendar` puro (`acasalamento.calc.ts`, PR #186) combina só `ptaLeite`+`tpi` normalizados e detecta consanguinidade comparando o **texto do pai** (`paiNome`). Este bloco entrega:

1. **Motor de mérito configurável** sobre os indicadores estruturados do Bloco C (`ValorIndicadorReprodutor` + `IndicadorGenetico.direcao`), com peso e direção por indicador — não mais duas colunas fixas.
2. **Restrição de consanguinidade por pedigree/endogamia**: coeficiente de parentesco estimado da genealogia da fêmea (`Animal.paiId`/`maeId` recursivo + fallback `paiNome`) e do `PedigreeReprodutor` do touro (pai/mãe/avós), com limiar configurável — substituindo a comparação textual.
3. **`MedidaAcasalamento`** (medidas, tipos, combinações): catálogo compartilhado que é a peça de paridade com `frmCadastroMedidaAcasalamento`. Uma medida = conjunto nomeado de pesos de indicadores + parâmetros de restrição; combinações reúnem medidas.
4. **Plano de acasalamento salvo por lote** (`Grupo`), **versionado**: ranking por fêmea, escolha do touro e snapshot das fórmulas/restrições/resultados para auditoria (paridade com `frmLancarRecomendacaoAcasalamento`).
5. **UI**: nova sub-aba `reb-acasalamento` (planos por lote) + cadastro de medidas/combinações + evolução da seção do cockpit para o novo motor.

## 2. Decisões (do brainstorming)

1. **Motor configurável + gate de paridade (não aproximação).** O motor é utilizável **agora** com fixtures determinísticas; a paridade com o IDEAGRI **não é declarada** até os metadados reais (fórmulas/tipos de medida e casos dourados de `frmCadastroMedidaAcasalamento`/`frmLancarRecomendacaoAcasalamento`) serem extraídos do `DADOS777.FDB` e passarem. Import fail-closed: tipo/fórmula não representável **aborta**, nunca colapsa. A finalização da paridade exata acontece **na máquina do usuário com acesso ao IDEAGRI** — esta fatia entrega estrutura + extrator + casos sintéticos; a outra máquina carrega os dados reais e fecha o gate.
2. **Componentes tipados (não DSL/JSON de fórmula).** Medida = termos tipados (peso/direção/piso/teto por indicador) + parâmetros de restrição; combinação = medidas com peso/obrigatoriedade/ordem. Sem parser de expressão nem árvore JSON executável — integridade no banco, validação Zod, comparação direta com casos dourados. Operação nova revelada pelo IDEAGRI vira operador explícito novo (e o import falha fechado até existir).
3. **Plano salvo por lote (`Grupo`), versionado.** Recalcular **cria uma versão nova** com `configSnapshot` + `rankingSnapshot` por fêmea; versões anteriores não são apagadas (auditoria). Escolha do touro por fêmea. Sem otimização global de plantel/distribuição automática de doses (fora de escopo).
4. **Pedigree insuficiente = permitir com alerta.** Relações conhecidas acima do limiar eliminam; candidato sem evidência suficiente fica com status `nao_verificavel`, **abaixo** dos verificados, e exige confirmação explícita (`confirmadoNaoVerificavel`) para ser escolhido no plano.
5. **UI: aba de planos + cockpit.** Nova sub-aba `reb-acasalamento` para criar/rever planos por lote; a seção do cockpit evolui para o novo motor.

## 3. Arquitetura e convenções

Mesmo pipeline do módulo: **rota fina (`routes/rebanho/`) → service (`services/rebanho/`) → cálculo puro (`*.calc.ts`) + schemas (`*.schemas.ts`)**, cada cálculo com TDD. Invariantes herdadas dos Blocos A–C:

- **Escopo de propriedade** via `resolverEscopoLeitura/Escrita(c)`; fatos de sítio (`PlanoAcasalamento`) levam `propriedadeId Int?`; dicionários (`MedidaAcasalamento`, `CombinacaoMedidaAcasalamento`) são **compartilhados** (sem `propriedadeId`, `catalogoNoEscopo`). Acesso cruzado → `NAO_ENCONTRADO`.
- **Identidade de origem** `ideagri<Entidade>Id Int? @unique` → import idempotente (upsert por origem); tipo/sigla inválido **aborta** (`main()` fail-closed).
- **Decimal** via Prisma Decimal → `Number()` só na borda (mappers). `configSnapshot`/`rankingSnapshot` em `Json` guardam o resultado já numérico (auditoria imutável).
- **Sync de schema:** migration aditiva idempotente (`CREATE TABLE IF NOT EXISTS` + FKs guardadas por `pg_constraint`) + `prisma:generate`; `db push` em prod.
- **Operações compostas em transação** (recalcular versão; escolher reprodutor).
- **Retrocompat:** `acasalamento.calc.ts` (v1) e seus testes permanecem; a genética do Bloco C (`Reprodutor`, colunas PTA, `ValorIndicadorReprodutor`, `PedigreeReprodutor`) **não é alterada** — o Bloco D só consome.

## 4. Schema (aditivo, idempotente)

**Catálogo de medidas (compartilhado — `frmCadastroMedidaAcasalamento`):**

- `MedidaAcasalamento`: `id`, `ideagriId Int? @unique`, `nome String @unique`, `tipo String` (`MERITO`|`RESTRICAO_INDICADOR`|`CONSANGUINIDADE`|`PEDIGREE`|`SEMEN` — `z.enum` fechado, import rejeita desconhecido), `consanguinidadeMax Decimal? @db.Decimal(5,4)`, `exigePedigree Boolean @default(false)`, `ativo Boolean @default(true)`, inversos `itens`/`combinacoes`.
- `ItemMedidaAcasalamento`: termo por indicador — `medidaId`, `indicadorId` (FK `IndicadorGenetico`), `peso Decimal @db.Decimal(8,4) @default(1)`, `minimo Decimal? @db.Decimal(12,3)`, `maximo Decimal? @db.Decimal(12,3)`, `@@unique([medidaId, indicadorId])`, `@@index([indicadorId])`. FK a `MedidaAcasalamento` `onDelete: Cascade`.
- `CombinacaoMedidaAcasalamento`: `id`, `ideagriId Int? @unique`, `nome String @unique`, `ativo`, inversos `itens`/`planos`.
- `ItemCombinacaoMedida`: `combinacaoId`, `medidaId` (FK `MedidaAcasalamento`), `peso Decimal @db.Decimal(8,4) @default(1)`, `obrigatoria Boolean @default(false)` (restrição dura vs. preferencial), `ordem Int @default(0)`, `@@unique([combinacaoId, medidaId])`, `@@index([medidaId])`. FK a `CombinacaoMedidaAcasalamento` `onDelete: Cascade`.

**Plano por lote (fato de sítio) + snapshot versionado:**

- `PlanoAcasalamento`: `grupoId` (FK `Grupo`), `combinacaoId` (FK `CombinacaoMedidaAcasalamento`), `nome String`, `propriedadeId Int?`, inverso `versoes`, `@@index([grupoId])`, `@@index([propriedadeId])`.
- `VersaoPlanoAcasalamento`: `planoId` (FK `onDelete: Cascade`), `versao Int`, `configSnapshot Json` (pesos/direções/limiar efetivos), inverso `linhas`, `@@unique([planoId, versao])`.
- `LinhaPlanoAcasalamento`: `versaoId` (FK `onDelete: Cascade`), `femeaId` (FK `Animal`), `rankingSnapshot Json` (touros ordenados com score/parentesco/status resolvidos), `reprodutorEscolhidoId Int?` (FK `Reprodutor`), `confirmadoNaoVerificavel Boolean @default(false)`, `@@unique([versaoId, femeaId])`, `@@index([femeaId])`.

**Alterações em modelos existentes:** só inversos das novas relações em `Grupo` (`planosAcasalamento`), `Animal` (`linhasAcasalamento`), `Reprodutor` (`escolhasAcasalamento`), `IndicadorGenetico` (`itensMedida`), `Propriedade` (`planosAcasalamento`). Nenhuma coluna existente muda.

Migration `server/prisma/migrations/<timestamp>_acasalamento_dirigido/migration.sql` (o `<timestamp>` no formato `YYYYMMDDHHMMSS` é definido na criação, posterior a `20260727120000`): 7 `CREATE TABLE IF NOT EXISTS`, índices/uniques `IF NOT EXISTS`, FKs guardadas por `pg_constraint` (mesmo estilo de `20260727120000_genetica_semen`). Depois `pnpm prisma:generate`.

## 5. Cálculo puro (TDD, sem I/O)

**5.1 `parentesco.calc.ts`** — coeficiente de parentesco por pedigree.
```ts
export interface Ancestral { chave: string; grau: number } // grau = fração de genes: pai/mãe 0.5, avós 0.25
export interface Genealogia { ancestrais: Ancestral[]; profundidade: number }
export function coeficienteParentesco(femea: Genealogia, touro: Genealogia): number; // Wright a 2 gerações; 0 sem ancestral comum
export function pedigreeVerificavel(femea: Genealogia, touro: Genealogia): boolean; // exige ≥ pai conhecido dos dois lados
```
`chave` = nome/código normalizado (minúsculo, sem acento/espaço). Fórmula (Wright a 2 gerações) é a aproximação **declarada** e gravada no snapshot; se o IDEAGRI usar outra profundidade/coeficiente, ajusta-se na fase de paridade.

**5.2 `merito-acasalamento.calc.ts`** — mérito configurável.
```ts
export interface ValorPorIndicador { indicadorId: number; valor: number | null }
export interface TermoMedida { indicadorId: number; peso: number; direcao: "maior_melhor" | "menor_melhor"; minimo: number | null; maximo: number | null }
export function meritoPorMedida(
  candidatos: { id: number; valores: ValorPorIndicador[] }[],
  termos: readonly TermoMedida[],
): Map<number, number>; // [0,1] min-max por indicador respeitando direção, ponderado; ausente não pontua nem penaliza
```
Generaliza o `normalizar` da v1 (só `ptaLeite`/`tpi`) para N indicadores. `minimo`/`maximo` marcam violação de piso/teto (consumida pela restrição dura).

**5.3 `recomendar-acasalamento.calc.ts`** — o novo `recomendar`.
```ts
export type StatusCandidato = "ok" | "consanguineo" | "restrito" | "nao_verificavel";
export interface CandidatoRecomendado {
  reprodutorId: number; nome: string;
  merito: number; parentesco: number; status: StatusCandidato;
  score: number; motivos: string[]; // score = mérito ajustado; 0 quando eliminado por restrição dura
}
export interface ConfigRecomendacao { termos: TermoMedida[]; consanguinidadeMax: number; medidasDuras: { tipo: string; limites: unknown }[] }
export function recomendarAcasalamento(femea: Genealogia, candidatos: CandidatoInput[], config: ConfigRecomendacao): CandidatoRecomendado[];
```
Regras (substituem a comparação textual do pai):
- **`consanguineo`**: `parentesco > consanguinidadeMax` → eliminado (score 0), ao fim.
- **`restrito`**: viola piso/teto de indicador de medida obrigatória → eliminado.
- **`nao_verificavel`** (decisão 4): pedigree insuficiente → mantido, abaixo dos verificados, exige confirmação para escolha.
- **Ordenação**: verificados-ok por score desc → `nao_verificavel` → eliminados; desempate por id (determinístico).

**Retrocompat:** `acasalamento.calc.ts` v1 e seu teste permanecem. O service resolve uma **medida default** ("Mérito PTA leite + TPI") que reproduz o comportamento da v1 quando não há combinação configurada — nenhum teste existente quebra.

## 6. Services e rotas

- `medidas-acasalamento.ts` (+ `.schemas.ts`, `.test.ts`): CRUD compartilhado (`catalogoNoEscopo`) de medidas/itens/combinações/itens-combinação; `tipo`/`direcao` via `z.enum`; `P2002`→`CONFLITO`; excluir **inativa** se em uso.
- `acasalamento.ts` (migração): monta `Genealogia` da fêmea (recursão `paiId`/`maeId` até avós + `paiNome`) e dos touros (`PedigreeReprodutor`), resolve `ConfigRecomendacao` (combinação ou medida default), chama `recomendarAcasalamento`. `GET /rebanho/animais/:id/acasalamento` responde DTO **superset** do atual (campos v1 preservados; novos opcionais).
- `planos-acasalamento.ts` (+ `.schemas.ts`, `.test.ts`): fato de sítio. `criarPlano(grupoId, combinacaoId)`; `recalcularPlano` (nova versão com snapshots, não apaga anteriores); `escolherReprodutor(linhaId, reprodutorId, confirmadoNaoVerificavel?)` (exige confirmação quando `nao_verificavel`; saldo de `EstoqueSemen` só como aviso, sem baixar dose). Acesso cruzado → `NAO_ENCONTRADO`. Operações em transação.
- Rotas finas em `routes/rebanho/` montadas em `index.ts`: `medidasAcasalamentoRouter`, `planosAcasalamentoRouter`; `acasalamentoRouter` estendido.

## 7. Import (fail-closed + fixture) e paridade

- Estende `scripts/ideagri-repro-inventory.sql` (telas/colunas/dicionários de medida de acasalamento) e `scripts/rebanho-dump.sql` (linhas reais), quando a fonte existir.
- Parsers puros em `scripts/build-rebanho-json.mjs` (+ `.test.mjs`): `parseMedidaAcasalamento`, `parseItemMedida`, `parseCombinacao`, `parseItemCombinacao`, `parseCasoDouradoAcasalamento` — fixture sintética + rejeição de linha inválida (tipo desconhecido → `null` → `main()` aborta).
- `server/src/services/rebanho/import-acasalamento.ts` (+ `.test.ts`, mock Prisma): upsert idempotente por `ideagriId`; tipo/fórmula não representável **aborta**. Ligado em `import-rebanho.ts` quando os arrays existem.
- **Casos dourados**: harness `entrada → ranking esperado` compara com `recomendarAcasalamento`. Agora contra fixtures sintéticas; na máquina com o IDEAGRI, contra os reais. Linha do contrato só vira `✅` quando os reais passam.
- **Pendência da máquina** registrada em `docs/reproducao-teste-na-maquina-ideagri.md` (junto de B: 44/248; C: 67/271/20/15/3): extrair `MEDIDAACASALAMENTO` + correlatas + casos dourados de `frmLancarRecomendacaoAcasalamento`; carregar; rodar o harness; fechar a paridade exata.

## 8. UI (`rb-*`, sem deps/paleta novas)

- **Sub-aba `reb-acasalamento`** (nav do rebanho): lista de planos por lote; criar plano (`Grupo` + combinação); ver versão (tabela fêmea → top touros com mérito/parentesco/status/motivos); escolher touro por fêmea (confirmação extra em `nao_verificavel`); histórico de versões. `RebTable`/`RebBox`/`RebButton`.
- **Cadastro de medidas/combinações** no `CadastrosView`: pesos por indicador, limiar de consanguinidade, tipo, obrigatoriedade.
- **Cockpit** `AcasalamentoSection`: evolui para o novo DTO (selos `consanguineo`/`restrito`/`nao_verificavel`; parentesco estimado no lugar de "pai da vaca"), reusando `fmt*` e cores via `var()`.
- `api.ts`: DTOs + fetchers via `req<T>`/`comPropriedade`; teste de path/método.

## 9. Tratamento de erros

Erros de domínio tipados (`code: "NAO_ENCONTRADO" | "CONFLITO"`) → 404/409; Zod → 400; tipo desconhecido no import → **abort** com amostra. `recalcularPlano`/`escolherReprodutor` em transação. Escopo de propriedade nega acesso cruzado com `NAO_ENCONTRADO` (não vaza existência).

## 10. Testes e gate

- **Puro (TDD):** `parentesco.calc` (grau por geração; ancestral comum; verificável; sem comum → 0), `merito-acasalamento.calc` (min-max por direção; peso; piso/teto; ausente neutro), `recomendar-acasalamento.calc` (consanguíneo/restrito/não-verificável; ordenação e desempate; medida default = comportamento v1), parsers (fixture + rejeição), harness de casos dourados.
- **Service (Vitest + mock Prisma):** escopo de propriedade dos planos; versão nova não apaga anterior; confirmação de não-verificável; conflito de sigla; medida default retrocompatível.
- **Client:** fetchers (path/método); render smoke da aba e do cadastro; payload por literal.
- **Gate:** server + client vitest verdes · `node --test scripts/build-rebanho-json.test.mjs` · `pnpm build` · migration idempotente + `pnpm prisma:generate` · `prisma validate` · doc de pendência atualizado. `acasalamento.calc.test.ts` (v1) e a suíte dos Blocos A–C permanecem verdes (sem regressão).

## 11. Interfaces entre blocos

- **C→D (entrada):** `ValorIndicadorReprodutor` + `IndicadorGenetico.direcao` alimentam `meritoPorMedida`; `PedigreeReprodutor` + `Animal.paiId`/`maeId` alimentam `parentesco.calc`. `EstoqueSemen` só exibe saldo (aviso na escolha) — a baixa de dose é da IA (Bloco C), não do plano.
- **D→F:** contagens de medidas/combinações e o resultado dos casos dourados alimentam a reconciliação final.
- **Retrocompat:** `acasalamento.calc.ts` (v1) preservado; DTO do cockpit é superset; genética do Bloco C intocada.

## 12. Fora de escopo

Otimização global de plantel / distribuição automática de doses; coleta FIV/TE e pool de doadoras (Bloco E); relatórios e reconciliação final (Bloco F); import real do `DADOS777.FDB` (pendência de máquina — a paridade exata das fórmulas e dos casos dourados é finalizada na máquina do usuário com acesso ao IDEAGRI).
