# Auditoria de cobertura — Indicadores zootécnicos Embrapa

**Data:** 2026-06-28
**Escopo:** Módulo Rebanho (leite) do projeto Fazendinha
**Referência:** 24 indicadores zootécnicos publicados pela Embrapa Gado de Leite para sistemas de produção bovina (e caprina, por extensão)

---

## 1. Resumo executivo

| Status | Quantidade | % |
|---|---|---|
| ✅ Implementado | 6 / 24 | 25% |
| ⚠️ Parcial (dados brutos existem, cálculo/endpoint faltam) | 11 / 24 | 46% |
| ❌ Ausente (sem dado, sem cálculo) | 7 / 24 | 29% |

**Leitura geral:** O módulo cobre bem o **núcleo individual** (CCS, IEP, produção/vaca/dia, status reprodutivo) — o que sustenta as worklists e o cockpit do animal. Os gaps concentram-se em três frentes:

1. **Eventos de perda reprodutiva** (aborto, natimorto) — não modelados.
2. **Indicadores agregados de fazenda** (taxa de lotação, produtividade da terra, produtividade da mão de obra) — faltam as entidades de **área de pastagem** e **funcionário**.
3. **Cálculos "fáceis" mas não expostos** — vários indicadores precisam só de uma query agregadora sobre dados que já existem (período seco, idade ao 1º parto, persistência, duração da lactação).

A boa notícia: a maioria dos gaps de cálculo são **quick wins**. Os gaps que exigem mudança de schema estão concentrados em 4-5 entidades novas.

---

## 2. Stack identificado

- **ORM:** Prisma 6, Postgres (Neon serverless).
- **Schema:** `server/prisma/schema.prisma`, modelo único monolítico contendo financeiro + rebanho leite + plantio café + gado de corte.
- **Backend:** Hono modular, rotas por domínio em `server/src/routes/rebanho/`.
- **Cálculos zootécnicos:** funções puras em `server/src/services/rebanho/*.recompute.ts` (dispatched via *re-compute* após cada evento).
- **Read-model:** `ResumoAnimal` é uma tabela pré-computada com `del`, `ordemLactacao`, `iepProjetado`, `ccs`, `producaoMediaDia` etc — atualizada por triggers de código em cada `POST` de evento.
- **Frontend:** React 18 + Vite. Componentes de rebanho em `client/src/rebanho/components/`.

---

## 3. Tabela completa de cobertura

### 3.1 Indicadores produtivos (nível animal)

| # | Indicador | Status | Onde está / onde deveria estar | Observações |
|---|---|---|---|---|
| 1 | **% Vacas em Lactação (%VL)** | ✅ | `dashboard.agg.ts:10-47` calcula `emLactacao` e `secas` como KPIs. | Computado por `del ≠ null`. Pode ser exibido como `% = emLactacao / (emLactacao + secas)`. |
| 2 | **Duração da Lactação (DL)** | ✅ | Modelo `Lactacao` em `schema.prisma:395-404` com `dtInicio` + `dtFim`. | Cálculo trivial (`dtFim - dtInicio` em dias). Não há endpoint expondo a média; é dado bruto pronto para query. |
| 3 | **Persistência da Lactação** | ⚠️ | Histórico em `ControleLeiteiro` existe. Cálculo não implementado. | DOMAIN.md (seção 3) define meta ≥90% (média 2º mês ÷ pico). Falta agregação. Quick win se já há ≥60 dias de controle. |
| 4 | **Produção por vaca ordenhada (PVO)** | ✅ | `ResumoAnimal.producaoMediaDia` (média móvel 3 controles) + KPI `producaoMedia` em dashboard. | `producao.recompute.ts:1-37`. |
| 5 | **Produção por lactação** | ⚠️ | `insights.ts:387` chama `producaoLactacao` mas usa **`producao305` (projeção)** como proxy. | A **soma real** dos `ControleLeiteiro` entre `Lactacao.dtInicio` e `dtFim` nunca é calculada. Para lactações fechadas isto subestima/superestima conforme a curva. |
| 6 | **Período seco** | ⚠️ | Dados existem: `Lactacao.dtFim` + próximo `EventoReprodutivo` tipo PARTO. | Sem cálculo automático. Worklist "a secar" existe (em `lib/worklists.ts`) mas é prospectiva, não estatística. |

### 3.2 Indicadores reprodutivos (nível animal)

| # | Indicador | Status | Onde está / onde deveria estar | Observações |
|---|---|---|---|---|
| 7 | **Intervalo de Partos (IP)** | ✅ | `ResumoAnimal.iepProjetado` (individual) + média agregada em `dashboard.agg.ts`. | Meta ≤395d documentada em DOMAIN.md. Note: é **projetado**, não histórico real — para vacas com 2+ partos reais bastaria `parto[n].data - parto[n-1].data`. |
| 8 | **Período de Serviço (PS)** | ⚠️ | Dados existem (PARTO + INSEMINACAO + DIAGNOSTICO positivo). | Sem cálculo. PS = data DG+ vencido (concepção estimada) − data parto anterior. |
| 9 | **% Prenhez do rebanho** | ✅ | KPI `prenhez` em `dashboard.agg.ts:10-47` (`PRENHE ÷ total × 100`). | |
| 10 | **% Prenhez ao 1º serviço** | ❌ | `EventoReprodutivo` registra IA e DG, mas **não numera** "qual IA é a primeira após o parto". | Derivável com lógica, mas hoje nenhum campo identifica ordem. Métrica não exposta. |
| 11 | **Taxa de gestação (por DG)** | ⚠️ | `EventoReprodutivo` tipo DIAGNOSTICO tem `resultado: "positivo"/"negativo"`. | Sem agregação. METRICS.md (4.6) documenta a fórmula mas não há endpoint. Quick win. |
| 12 | **Idade ao 1º parto (IPP)** | ⚠️ | `Animal.dataNascimento` + primeiro PARTO em `EventoReprodutivo`. | Sem cálculo. Para animais com `numPartosEntrada > 0`, IPP fica indefinido (parto anterior à entrada). |
| 13 | **Taxa de natalidade** | ⚠️ | `EventoReprodutivo.numCrias` existe. | Sem agregação anual ÷ média de vacas. **Crucial:** não distingue nascidos vivos vs natimortos (`numCrias` é total). |
| 14 | **Taxa de abortos e natimortos** | ❌ | `TipoEventoReprodutivo` (`schema.prisma:366-372`) tem só `CIO, INSEMINACAO, DIAGNOSTICO, PARTO, SECAGEM`. | Sem `ABORTO`. PARTO não tem `criasVivas` separado de `numCrias`. Cabe em OCORRENCIA genérica, mas não estruturado. |

### 3.3 Indicadores produtivo-reprodutivos (nível animal)

| # | Indicador | Status | Onde está / onde deveria estar | Observações |
|---|---|---|---|---|
| 15 | **PDIP — Produção por Dia de Intervalo de Partos** | ❌ | Requer produção real por lactação (#5) + IP real (#7). | Como #5 usa projeção e #7 usa IEP **projetado**, o PDIP não está implementado. Cálculo final: `producao_real_lactacao / IP_real_dias`. |
| 16 | **PLVA — Produção de Leite por Vaca/Ano** | ❌ | Mesma raiz que #15. | Requer #5 real + média anual. Não implementado. |

### 3.4 Indicadores de gestão (nível fazenda)

| # | Indicador | Status | Onde está / onde deveria estar | Observações |
|---|---|---|---|---|
| 17 | **Taxa de lotação (UA/ha)** | ❌ | Não há entidade de pastagem/piquete para o **rebanho leite**. | `Piquete.areaHa` existe **só no módulo Corte** (`schema.prisma:1063-1078`). Leite não tem `areaHa` em lugar nenhum. |
| 18 | **Produtividade da terra (L/ha/ano)** | ❌ | Mesmo motivo de #17 — sem `areaHa` para leite. | Café (Talhao) e corte (Piquete) têm; leite não. |
| 19 | **Produtividade da mão de obra (L/funcionário/dia)** | ❌ | Sem modelo `Funcionario` no schema. | Folha de pagamento vive só como `Lancamento` (categoria), sem contagem de cabeças. |
| 20 | **Relação leite/concentrado** | ⚠️ | `MovimentoEstoque` de `Produto.tipo=RACAO` (consumo) + `ControleLeiteiro`/`ProducaoLote` (produção). | Sem cálculo. `nutricao.ts` (rota e service) trata consumo x dieta, mas não cruza com produção. Quick win. |
| 21 | **Taxa de descarte** | ⚠️ | `Animal.dataBaixa` + `Animal.motivoBaixa` (string livre — `schema.prisma:331-332`). | Conta-se baixas, mas **`motivoBaixa` não é enum** — distinguir descarte (mastite/baixa fertilidade/baixa produção) vs venda vs morte é inconsistente. |

### 3.5 Indicadores sanitários

| # | Indicador | Status | Onde está / onde deveria estar | Observações |
|---|---|---|---|---|
| 22 | **Mortalidade de adultos** | ⚠️ | `Animal.motivoBaixa` cobre como texto livre. | Sem normalização: "morte por mastite", "óbito", "morreu" — qualquer string. Agregação difícil. |
| 23 | **Mortalidade de bezerros até 1 ano** | ⚠️ | Mesmo. `Animal.dataNascimento` + baixa antes de 365d daria a métrica. | Sem normalização do motivo. |
| 24 | **CCS (Contagem de Células Somáticas)** | ✅ | `EventoSanitario.ccs` + `ResumoAnimal.ccs` + `ccsTendencia` (subindo/estavel/caindo via últimos 3 exames). | `sanidade.recompute.ts:1-16`. Cálculo de tendência ativo, KPI `ccsMedio` no dashboard. |

---

## 4. Gaps críticos — priorizados para schema

Ordenados por **impacto × esforço** (impacto editorial Embrapa ÷ tamanho da mudança):

### 4.1 Aborto e natimorto (indicador #14) — **prioridade máxima**

**Impacto:** Sem isto, o sistema não fecha taxa de natalidade nem ciclo reprodutivo completo.

Sugestão de schema:

```prisma
enum TipoEventoReprodutivo {
  CIO
  INSEMINACAO
  DIAGNOSTICO
  PARTO
  SECAGEM
  ABORTO         // novo
}

model EventoReprodutivo {
  // ... campos atuais
  criasVivas     Int?     // novo — para PARTO: nascidos vivos
  criasNatimortas Int?    // novo — para PARTO: natimortos
  causaAborto    String?  // novo — para ABORTO: infeccioso/nutricional/mecânico/desconhecido
}
```

Migração: trivial (adição de coluna + extensão do enum). `recomputarResumoReproducao()` precisa tratar ABORTO como "reset" para VAZIA (igual DG negativo).

### 4.2 Motivo de baixa estruturado (indicadores #21, #22, #23)

**Impacto:** Destrava taxa de descarte e mortalidades, três indicadores de uma vez.

Sugestão:

```prisma
enum MotivoBaixa {
  VENDA
  DESCARTE_FERTILIDADE
  DESCARTE_PRODUCAO
  DESCARTE_MASTITE
  DESCARTE_OUTROS
  MORTE_DOENCA
  MORTE_PARTO
  MORTE_ACIDENTE
  MORTE_OUTRA
}

model Animal {
  // ... campos atuais
  motivoBaixa     String?         // manter para histórico textual
  motivoBaixaEnum MotivoBaixa?    // novo
}
```

Quem categoriza pode ser uma migração com mapa de strings comuns. Mantém o `String?` por compatibilidade.

### 4.3 Área de pastagem do rebanho leite (indicadores #17, #18)

**Impacto:** Destrava dois indicadores de gestão de fazenda.

O módulo Corte já tem `Piquete` com `areaHa` e `capim` — replicar não faz sentido se a fazenda leiteira opera por lote/grupo:

```prisma
model Grupo {
  // ... campos atuais
  areaPastagemHa  Decimal?  @db.Decimal(7, 2)  // novo
  tipoPastagem    String?                       // novo (Tifton, Mombaça, etc)
}
```

Alternativa mais robusta: usar `Piquete` (já existe) para leite também, com FK `Grupo.piqueteId`.

### 4.4 Funcionário (indicador #19)

**Impacto:** Único indicador sem nenhum dado bruto.

```prisma
enum FuncaoFuncionario {
  ORDENHADOR
  CAMPEIRO
  TRATORISTA
  GERENTE
  OUTRO
}

model Funcionario {
  id          Int       @id @default(autoincrement())
  nome        String
  funcao      FuncaoFuncionario
  dataAdmissao DateTime @db.Date
  dataDemissao DateTime? @db.Date
  ativo       Boolean   @default(true)
  // opcional: ligar com Lancamento (folha)
}
```

Mínimo viável: só `count(ativo=true)` já permite calcular produtividade da mão de obra.

### 4.5 Composição do leite linkada à produção (acima do indicador #24, mas relacionado)

O schema tem `gordura` e `proteina` em `EventoSanitario` (tipo EXAME) — **desconectados** do `ControleLeiteiro`. Considerando que CCS, gordura e proteína geralmente vêm do mesmo laudo do tanque/individual, fica estranho. Sugestão: mover para `ControleLeiteiro` ou criar relação cruzada.

---

## 5. Quick wins — dados brutos prontos, só falta cálculo

Estes são endpoints novos (ou colunas computadas no `ResumoAnimal`) sem mudança de schema:

| # | Indicador | O que falta | Onde implementar |
|---|---|---|---|
| 2 | Duração da Lactação | `avg(Lactacao.dtFim - Lactacao.dtInicio)` para lactações fechadas | Novo endpoint em `dashboard.agg.ts` ou serviço de relatórios |
| 3 | Persistência da Lactação | `producaoMes2 / picoProducao` por vaca | Adicionar ao `producao.recompute.ts` ou criar `persistencia.calc.ts` |
| 5 | Produção por lactação (real) | `sum(ControleLeiteiro.pesoTotal where data between dtInicio and dtFim)` | Substituir alias em `insights.ts:387` por soma real quando lactação está fechada |
| 6 | Período seco | `proximoParto.data - Lactacao.dtFim` | Pode ir no `ResumoAnimal` como `periodoSecoMedioDias` |
| 8 | Período de Serviço | `concepcaoEstimada - partoAnterior.data` | Adicionar ao `reproducao.recompute.ts` |
| 11 | Taxa de gestação | `count(DG positivo) / count(IA com DG)` | KPI no `dashboard.agg.ts` |
| 12 | Idade ao 1º parto (IPP) | `primeiroParto.data - dataNascimento` (em meses); ignorar animais com `numPartosEntrada > 0` | Adicionar ao `ResumoAnimal` ou agregador |
| 13 | Taxa de natalidade (parcial) | `sum(numCrias) / count(vacas)` por ano | Bom o suficiente até resolver gap #14 (natimortos) |
| 20 | Relação leite/concentrado | `sum(producao_litros) / sum(MovimentoEstoque RACAO kg)` no período | Já existe `nutricao.ts` — adicionar cruzamento |

**Estimativa:** os 9 quick wins acima cabem em 1-2 sprints sem nenhuma migration. Subiriam a cobertura de **25% para ~60%** (6 → ~15 dos 24).

---

## 6. Observações finais

1. **Cobertura individual vs agregada:** o módulo Rebanho prioriza visão por animal (cockpit + worklists). Indicadores de fazenda como um todo (#17–19) ficam descobertos porque o foco foi "Marco Antônio toma decisões de manejo" e não "gerar relatório técnico Embrapa". Decidir se vamos cobrir os dois usos ou só o primeiro é uma escolha de produto, não de engenharia.

2. **Caprinos herdam tudo:** as categorias CABRA/CABRITA/CABRITO/BODE já estão no enum, e a maioria dos indicadores se aplica também. Só "Período Seco" e "IEP" têm constantes diferentes (caprino: gestação ~150d vs bovino 283d). Vale parametrizar `GESTACAO_DIAS` por espécie em `reproducao.recompute.ts:1-63` se for incluir caprinocultura no escopo Embrapa.

3. **DOMAIN.md já documenta as metas Embrapa** (seção "Indicadores zootécnicos", linhas ~449-489) — mas várias dessas metas não têm cálculo. Há gap entre o que está prometido na documentação e o que está implementado.

4. **Sistema é jovem mas tem boas fundações:** `ResumoAnimal` como read-model + serviços `*.recompute.ts` é um padrão limpo. Os quick wins listados encaixam no mesmo modelo sem refatoração.
