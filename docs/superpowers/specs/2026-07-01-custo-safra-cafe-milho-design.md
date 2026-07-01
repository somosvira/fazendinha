# Custo de Safra — Café (operacional) + Milho (novo) + Toggle Custeio/Investimento

**Data:** 2026-07-01
**Origem:** reunião com a administração da Fazenda Rio Novo (backlog em memória: `adm-meeting-backlog-2026-07`).
**Status:** design aprovado, aguardando revisão do spec antes do plano de implementação.

## 1. Objetivo

"Saber todos os custos de produzir café e milho." Concretamente:

1. **Café** — passar a calcular o custo do café a partir das **operações reais da safra** (adubo, colheita, horas de trator, mão de obra, transporte), não só dos lançamentos financeiros. O custo financeiro atual continua; o operacional é aditivo.
2. **Milho** — módulo novo (hoje inexistente), rastreando custo de safra e **duas saídas: grão (sacas) e silagem (toneladas)**, com **silos** de armazenamento.
3. **Toggle Custeio / Investimento / Tudo** em **todos os dashboards de custo dos módulos** (café, milho, rebanho, corte).

## 2. Decisões (da conversa de brainstorming)

- **Abordagem 1:** rollup operacional no café reusando o que já existe + subárvore nova crop-agnostic pro milho. Sem refactor do café que já funciona.
- **Milho produz grão E silagem** (as duas saídas).
- **Duas granularidades** (revenda / "cada fazenda é um caso"): milho suporta safra inteira **ou** por área (`AreaCultivo` opcional).
- **Módulo `cultivo`** (culturas anuais) crop-agnostic via campo `cultura`; MILHO é o primeiro caso. Rótulo visível na v1: **"Milho"**.
- **v1 enxuta do milho:** sem Dashboard/IA próprios (a aba Custo já é o painel). Fatia futura.
- **Toggle em 4 módulos**, mas implementação **faseada**: café+milho primeiro; rebanho+corte depois.
- Café custo operacional e custo/L (rebanho) e custo/@ (corte) sempre calculados **sobre custeio** (padrão agronômico; investimento amortiza à parte).

## 3. Constrangimentos herdados do projeto

- **Decimais:** todo cálculo financeiro em `Prisma.Decimal(14,2)`; conversão para `number` só na borda do DTO (`mappers.ts`). Nunca `number` cru em cálculo.
- **ESM server:** imports relativos de `.ts` terminam em `.js`.
- **Padrão de rota:** cada arquivo exporta um `Hono()` chained; copiar a forma de `routes/health.ts`. Montar em `index.ts` via `app.route("/api", ...)`.
- **Padrão de custo do corte** (a espelhar): função **pura** (sem DB, testável) + **wrapper** (I/O + monta dados + chama pura + upsert) + **nota de transparência** no DTO. Ver `services/corte/custo.ts` e `services/corte/resumos.recompute.ts`.
- **Migration:** `prisma migrate dev` precisa de `DIRECT_URL` (shadow db); a `DATABASE_URL` pooled só serve pra `migrate deploy`.

## 4. Modelo de dados

### 4.1 Café — nenhum modelo novo

O custo operacional reusa os modelos existentes:
- `TarefaAgricola.custoReal` = custo de **insumo + serviço** da tarefa.
- `ApontamentoMaquina.valorTotal` = **máquina/mão de obra próprias** (horas de trator, diária) não embutidas numa tarefa.
- Produção: `PassadaColheita.sacasBeneficiadas` (sacas na janela da safra).
- Área: `Talhao.areaHa` dos talhões ativos.

**Convenção anti-duplicação:** `custeioOperacional(safra) = Σ TarefaAgricola.custoReal + Σ ApontamentoMaquina.valorTotal`. Tarefas carregam insumo+serviço; apontamentos carregam recurso próprio. Não somar a mesma despesa nas duas.

O custo **financeiro** do café classifica custeio × investimento pelos campos **já existentes** `Categoria.classificacao` (override do usuário) com fallback em `CentroCusto.ehInvestimento` (regra padrão) — **não** por heurística de nome. Se o código atual (`services/plantio/custo.ts`) ainda usa match por nome, migrar para esses campos faz parte do escopo. Reusado pelo toggle. O custo **operacional** do café entra como **custeio** na v1; investimento do café continua vindo do financeiro.

### 4.2 Milho — subárvore nova `cultivo` (crop-agnostic)

Enums novos:
```
enum Cultura            { MILHO }                 // extensível
// classe custeio/investimento REUSA o enum já existente `ClassificacaoCategoria { CUSTEIO, INVESTIMENTO }` — NÃO criar enum novo.
enum TipoCustoCultivo   { ADUBACAO, PREPARO_SOLO, PLANTIO, TRATOS, COLHEITA, TRANSPORTE, MAO_DE_OBRA, MAQUINA, OUTRO }
enum TipoProducao       { GRAO, SILAGEM }
enum UnidadeProducao    { SC, TON }
enum DestinoProducao    { VENDA, SILO }
enum TipoSilo           { GRAO, SILAGEM }
enum TipoMovimentoSilo  { ENTRADA, SAIDA }
enum OrigemMovimentoSilo{ COLHEITA, NUTRICAO, VENDA, AJUSTE }
```

Modelos (campos-chave; `id Int @id @default(autoincrement())`, `createdAt/updatedAt` omitidos por brevidade):

**SafraCultivo**
- `cultura Cultura`, `nome String`, `ano Int`
- `dataInicio DateTime @db.Date`, `dataFim DateTime? @db.Date`
- `areaHaTotal Decimal? @db.Decimal(10,2)` — usado quando **não** há `AreaCultivo`
- `fechada Boolean @default(false)`
- `observacao String?`
- relações: `areas AreaCultivo[]`, `custos LancamentoCusto[]`, `producoes ProducaoCultivo[]`, `resumo ResumoSafraCultivo?`
- `@@index([cultura, ano])`

**AreaCultivo** (granularidade opcional)
- `safraCultivoId Int` (relação, `onDelete: Cascade`)
- `codigo String`, `nome String?`, `areaHa Decimal @db.Decimal(10,2)`
- relações: `custos LancamentoCusto[]`, `producoes ProducaoCultivo[]`
- `@@unique([safraCultivoId, codigo])`

**LancamentoCusto** (balde de custo)
- `safraCultivoId Int`, `areaCultivoId Int?`
- `tipo TipoCustoCultivo`, `classe ClassificacaoCategoria @default(CUSTEIO)` (enum já existente)
- `data DateTime @db.Date`, `descricao String`, `valor Decimal @db.Decimal(14,2)`
- `qtd Decimal? @db.Decimal(12,3)`, `unidade String?`
- `horasMaquina Decimal? @db.Decimal(8,2)`, `numMaquinas Int?`, `numCaminhoes Int?`
- `lancamentoId Int? @unique` — ponte financeira opcional
- `observacao String?`
- `@@index([safraCultivoId, data])`, `@@index([classe])`

**ProducaoCultivo** (saída da colheita)
- `safraCultivoId Int`, `areaCultivoId Int?`
- `data DateTime @db.Date`, `tipo TipoProducao`
- `quantidade Decimal @db.Decimal(12,3)`, `unidade UnidadeProducao`
- `destino DestinoProducao?`, `siloId Int?`
- `observacao String?`
- relações: `movimentos MovimentoSilo[]`
- `@@index([safraCultivoId, data])`

**Silo**
- `nome String`, `tipo TipoSilo`
- `capacidade Decimal? @db.Decimal(12,3)`, `unidade String`
- `saldoAtual Decimal @default(0) @db.Decimal(12,3)`, `ativo Boolean @default(true)`
- relações: `movimentos MovimentoSilo[]`

**MovimentoSilo** (razão)
- `siloId Int`, `data DateTime @db.Date`
- `tipo TipoMovimentoSilo`, `quantidade Decimal @db.Decimal(12,3)`
- `origem OrigemMovimentoSilo`, `producaoCultivoId Int?`
- `observacao String?`
- `@@index([siloId, data])`

**ResumoSafraCultivo** (read-model recomputado)
- `safraCultivoId Int @unique` (relação, `onDelete: Cascade`)
- `custeioTotal Decimal @default(0) @db.Decimal(14,2)`
- `investimentoTotal Decimal @default(0) @db.Decimal(14,2)`
- `areaHa Decimal @default(0) @db.Decimal(10,2)`
- `producaoGraoSc Decimal @default(0) @db.Decimal(12,3)`
- `producaoSilagemTon Decimal @default(0) @db.Decimal(12,3)`
- `custoHa Decimal? @db.Decimal(14,2)` — custeio ÷ áreaHa
- `custoSaca Decimal? @db.Decimal(14,2)` — custeio (grão) ÷ sacas
- `custoTonelada Decimal? @db.Decimal(14,2)` — custeio (silagem) ÷ toneladas
- `horasMaquinaTotal Decimal @default(0) @db.Decimal(10,2)`
- `atualizadoEm DateTime @updatedAt`

## 5. Regras de cálculo

### 5.1 Custo por unidade em safra de saída mista (grão + silagem)

Uma safra pode produzir **as duas** saídas. Atribuir o custeio total às duas dividindo por cada saída **duplicaria** o custo. Regra:

- **`custoHa = custeioTotal / areaHa`** — sempre válido.
- **Se a safra tem `AreaCultivo`s** (cada área normalmente destina-se a uma saída):
  - `custoSaca = Σ(custeio das áreas cuja produção é GRAO) / Σ(sacas)`
  - `custoTonelada = Σ(custeio das áreas cuja produção é SILAGEM) / Σ(toneladas)`
- **Se a safra é nível-safra (sem áreas):**
  - Saída única → `custoSaca` **ou** `custoTonelada` = `custeio / produção`.
  - Saídas mistas → `custoSaca` e `custoTonelada` = `null`, com **nota**: "safra mista sem áreas — cadastre áreas para custo por unidade". (`custoHa` continua válido.)
- **Sem produção** → o custo por unidade correspondente = `null` (nunca `NaN`/divisão por zero).

Rateio proporcional configurável entre grão/silagem numa mesma área fica **fora do escopo** (futuro).

### 5.2 Silo

- `saldoAtual = Σ ENTRADA − Σ SAIDA` (razão `MovimentoSilo`). Mantido incrementalmente na escrita e recomputável a partir do razão.
- `ProducaoCultivo` com `destino=SILO` e `siloId` cria automaticamente `MovimentoSilo{ tipo: ENTRADA, origem: COLHEITA }` e atualiza `Silo.saldoAtual`.
- Saídas (`origem: NUTRICAO | VENDA | AJUSTE`) são lançadas manualmente. **Integração com a nutrição do rebanho fica fora do escopo** (v1 só registra `origem=NUTRICAO`).

## 6. Backend

### 6.1 Café
- **`services/plantio/custo-operacional.ts`**
  - pura: `calcularCustoOperacionalCafe({ tarefas, apontamentos, sacas, areaHa }) → { custeioTotal, custoSaca, custoHa }`.
  - wrapper: `agregarCustoOperacionalCafe(safraId) → DTO` (carrega `TarefaAgricola` + `ApontamentoMaquina` da safra + `PassadaColheita` na janela; área dos talhões ativos).
- Rota: `GET /plantio/safras/:id/custo-operacional`. Endpoint financeiro existente `GET /plantio/custo` ganha `?classe=custeio|investimento|tudo`.

### 6.2 Milho — `routes/cultivo/` + `services/cultivo/`
- `services/cultivo/schemas.ts` (Zod), `mappers.ts` (Prisma→DTO).
- `services/cultivo/resumo.recompute.ts`
  - pura: `calcularResumoSafra(input) → { custeioTotal, investimentoTotal, areaHa, producaoGraoSc, producaoSilagemTon, custoHa, custoSaca, custoTonelada, horasMaquinaTotal, nota }` (aplica as regras da §5.1).
  - wrapper: `recomputarResumoSafra(safraCultivoId)` → upsert `ResumoSafraCultivo`.
- `services/cultivo/silo.ts` — aplica movimento e mantém `saldoAtual`; `recomputarSaldoSilo(siloId)`.
- Rotas (Hono chained, montadas em `index.ts`):
  - `safras.ts` — CRUD `SafraCultivo` (`GET ?cultura=MILHO`), `POST /cultivo/safras/:id/fechar`.
  - `areas.ts` — CRUD `AreaCultivo`.
  - `custos.ts` — CRUD `LancamentoCusto` (`?classe=`) → **dispara `recomputarResumoSafra`**.
  - `producao.ts` — CRUD `ProducaoCultivo` → **recompute** + movimento de silo se `destino=SILO`.
  - `silos.ts` — CRUD `Silo` + `MovimentoSilo`.
  - `resumo` — `GET /cultivo/safras/:id/resumo?classe=`.

### 6.3 Fechamento
`SafraCultivo.fechada=true` bloqueia criar/editar/excluir `LancamentoCusto` e `ProducaoCultivo` daquela safra (erro PT-BR claro, HTTP 409). Espelha `FechamentoMensal` / `SafraTalhao.fechada`.

### 6.4 Toggle — contrato uniforme
Todos os endpoints de custo aceitam `?classe=custeio|investimento|tudo` (default `custeio`) e retornam `custeioTotal` **e** `investimentoTotal`. A classificação de despesa financeira usa os campos existentes `Categoria.classificacao` (override) → fallback `CentroCusto.ehInvestimento` (padrão). Extensão dos serviços existentes:
- **Rebanho** (`custo-producao`, `custo-sanidade`): expõem `investimentoTotal` via `Categoria.classificacao`/`CentroCusto.ehInvestimento` (compra de matrizes/novilhas, formação). Custo/L segue sobre custeio.
- **Corte** (`services/corte/custo.ts`): custo é operacional (sem centro de custo), então `investimentoTotal` = `OperacaoComercial` tipo `COMPRA` (aquisição/reposição). Custo/@ segue sobre custeio.

## 7. Frontend

### 7.1 Componente compartilhado
- `client/src/components/ClasseToggle.tsx` — toggle de 3 estados (`custeio | investimento | tudo`) reutilizável; devolve o valor selecionado. Estilo via `var()` (sem hex hardcode).

### 7.2 Café
- `CustoTab` ganha seletor de safra (padrão da `PlanejamentoTab`) + bloco **Operacional × Financeiro** + `<ClasseToggle>` filtrando KPIs/breakdown.
- `plantio/api.ts`: `obterCustoOperacionalCafe(safraId)` + hook; `obterCustoPlantio` aceita `classe`.

### 7.3 Milho — módulo novo `client/src/cultivo/`
- `CultivoContent.tsx` (roteia sub-abas), `api.ts`, `types.ts`, `components/`.
- Sub-abas v1: **Safras** (CRUD + cockpit), **Custos** (baldes: adubo, horas de trator, nº tratores, nº caminhões, valor; classe), **Produção** (grão SC + silagem TON, destino), **Silos** (saldo + razão), **Custo** (`ResumoSafraCultivo` + `<ClasseToggle>`).
- Reuso: KPI strip, `fmtMoney`/`fmt*` de `charts.tsx`.

### 7.4 Integração no shell
- `App.tsx`: novo prefixo `mil-`, mapa `MIL`, import de `CultivoContent` (espelha os blocos `reb-`/`pla-`/`cor-`/`eqp-`).
- `lib/searchIndex.ts`, `CommandPalette.tsx`, navegação/masthead: entradas do módulo Milho.

### 7.5 Rebanho + corte (fase 2)
Adicionar `<ClasseToggle>` às views de custo existentes desses módulos, consumindo o `?classe=` novo.

## 8. Testes e edge cases

- **Funções puras (sem DB):** `calcularCustoOperacionalCafe`, `calcularResumoSafra`, saldo de silo. Casos: zero produção (`null`, não `NaN`), zero área, só custeio, só investimento, safra mista sem áreas (`custoSaca`/`custoTonelada`=`null`+nota), safra mista com áreas (rateio por área).
- **Recompute:** criar/editar/excluir `LancamentoCusto`/`ProducaoCultivo` reflete no `ResumoSafraCultivo`; `destino=SILO` gera movimento e atualiza saldo.
- **Fechamento:** safra fechada bloqueia edição (409 + mensagem PT-BR).
- **Contrato `classe`:** `custeio`/`investimento`/`tudo` filtram corretamente em café, milho, rebanho, corte.
- **Sem regressão:** custo financeiro do café e custos de rebanho/corte existentes continuam idênticos com `classe=custeio` (default).

## 9. Faseamento da implementação

1. **Fase 1 (núcleo):** schema + migration (`cultivo` + enums); backend milho (serviços + rotas + fechamento + recompute); café custo-operacional; `<ClasseToggle>`; módulo frontend Milho; toggle nas abas Custo de café e milho.
2. **Fase 2 (toggle cross-módulo):** estender serviços de custo de rebanho e corte pra expor `investimentoTotal`; `<ClasseToggle>` nas views de custo desses módulos.

## 10. Fora de escopo (futuro)

- Dashboard e IA próprios do módulo Milho.
- Integração automática silagem → nutrição do rebanho.
- Rateio proporcional configurável de custeio entre grão/silagem numa mesma área.
- Multi-tenancy real (modelo de fazenda/tenant, auth por fazenda) — o design só evita suposições de modo único.
- Toggle no Dashboard principal do app (DRE/categorias).
