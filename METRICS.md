# METRICS.md — Indicadores do Sistema

> **Documento de referência matemática.**
> Toda métrica exibida ao produtor tem sua fórmula aqui, com origem dos dados, janela temporal, interpretação e impacto financeiro.
> Métrica sem documento = métrica que não devia estar na tela.

---

## Sumário

1. [Convenções](#1-convenções)
2. [Métricas financeiras](#2-métricas-financeiras)
3. [Métricas de rebanho](#3-métricas-de-rebanho)
4. [Métricas de reprodução](#4-métricas-de-reprodução)
5. [Métricas de sanidade](#5-métricas-de-sanidade)
6. [Métricas de produção](#6-métricas-de-produção)
7. [Métricas de custo](#7-métricas-de-custo)
8. [Métricas por animal — Score e Insights](#8-métricas-por-animal--score-e-insights)
9. [Janelas temporais padronizadas](#9-janelas-temporais-padronizadas)
10. [Alertas](#10-alertas)
11. [Como apresentar](#11-como-apresentar)

---

## 1. Convenções

| Item | Regra |
|---|---|
| Moeda | `R$ X,XX` via `Intl.NumberFormat('pt-BR', { currency: 'BRL' })`. |
| Datas | `DD/mmm/AAAA` (`28/mai/2026`) em headers; `DD/MM/AAAA` em tabelas. |
| Decimais | Litros 1 casa, R$ 2 casas, % 1 casa. |
| Sinal | `+R$ X` quando ganha, `−R$ X` quando perde. |
| Estimativas | Prefixo `≈` quando o valor é projeção, não realizado. |
| Sem dado | `—` (em-dash), nunca `null` ou `0` enganoso. |
| Janelas | Sempre indicar período (`últimos 30 dias`, `2026 YTD`, etc.). |
| Tabular nums | Sempre em totais e KPIs (`font-variant-numeric: tabular-nums`). |

---

## 2. Métricas financeiras

### 2.1 Receita Realizada (período)

| Item | Detalhe |
|---|---|
| **Fórmula** | `Σ Lancamento.valor` onde `natureza = CREDITO`, `situacao = LIQUIDADO`, `estornado = false`, `dataLiquidacao ∈ período` |
| **Origem** | `Lancamento` (regime de caixa) |
| **Apresentação** | KPI grande, currency BRL |
| **Interpretação** | Dinheiro **que entrou de fato** no caixa no período |
| **Implementação** | `server/src/services/dashboard.ts` |

### 2.2 Despesa Realizada (período)

| Item | Detalhe |
|---|---|
| **Fórmula** | `Σ Lancamento.valor` onde `natureza = DEBITO`, `situacao = LIQUIDADO`, `estornado = false`, `dataLiquidacao ∈ período` |
| **Origem** | `Lancamento` |
| **Apresentação** | KPI, com delta vs período anterior |
| **Interpretação** | Dinheiro **que saiu de fato** do caixa |

### 2.3 Saldo / Fluxo do Período

| Item | Detalhe |
|---|---|
| **Fórmula** | `Receita Realizada − Despesa Realizada` (no mesmo período) |
| **Cor** | `--pos` se positivo, `--neg` se negativo |
| **Apresentação** | Hero KPI no Dashboard |

### 2.4 Projeção (a vencer)

| Item | Detalhe |
|---|---|
| **Fórmula** | `Σ Lancamento.valor × sinal_natureza` onde `situacao = ABERTO`, `estornado = false`, `dataVencimento ∈ período futuro` |
| **Origem** | `Lancamento` |
| **Interpretação** | O que ainda **vai entrar/sair** se nada mudar |
| **Apresentação** | Card "Projeção" com ícone `≈` |

### 2.5 DRE Simplificado

Recortes por período (anos completos e YTD). Em `services/dashboard.ts`:

- **Receita Leite** = `Σ Lancamento(CREDITO)` com categoria "Venda de Leite" e CCusto Leiteira.
- **Custeio Leite Puro** = `Σ Lancamento(DEBITO)` com CCusto "Atividade Leiteira" excluindo aquisição de animais e RN Caminhão.
- **Animal Aquisição** = `Σ Lancamento(DEBITO)` com categoria "Animal Aquisição" — pode ser **reclassificado custeio/investimento** (Fatia 22).
- **RN Caminhão** = `Σ Lancamento(DEBITO)` com categoria "RN — Caminhão e Trator".
- **Investimento Leite** = `Σ Lancamento(DEBITO)` em CCusto.ehInvestimento = true.
- **Custeio BPO** = `custeioLeitePuro + animalAquisição + rnCaminhao`.

### 2.6 Top 12 Categorias (despesa)

| Item | Detalhe |
|---|---|
| **Fórmula** | `Σ Lancamento(DEBITO)` agrupado por categoria, ordenado desc, top 12 |
| **Janela** | 23 meses (Jul/24 → Mai/26) |
| **Delta YoY** | `(YTD 2026 ÷ YTD 2025 − 1) × 100` para mesma janela Jan–Mai |
| **Implementação** | `dashboard.ts:217–242` |
| **Apresentação** | Tabela com nome + total + barra horizontal + delta |

### 2.7 Inconsistências contábeis

Cards no Dashboard sinalizando lançamentos que pedem revisão:

- **Animal Aquisição não classificado** — categoria precisa de override.
- **RN Caminhão grande** — lançamento atípico.
- **Atv Plantio** — pode estar no CCusto errado.
- **Sem CCusto** — `Lancamento.centroCustoId IS NULL`.

Cada card mostra contagem e total, com link para correção.

### 2.8 Fechamento mensal

`FechamentoMensal(ano, mes)` é flag. Lancamentos cuja **data de caixa** (`dataLiquidacao` se LIQUIDADO, senão `dataVencimento`) caia em mês fechado **não podem ser editados**.

---

## 3. Métricas de rebanho

### 3.1 Rebanho ativo

| Item | Detalhe |
|---|---|
| **Fórmula** | `Animal.count({ status: ATIVO })` |
| **Apresentação** | KPI inteiro |

### 3.2 Composição

| Métrica | Fórmula |
|---|---|
| Vacas em lactação | `ResumoAnimal.count({ del ≠ null })` |
| Vacas secas | `Animal.count({ categoria: VACA }) − vacasEmLactação` |
| Novilhas | `Animal.count({ categoria: NOVILHA, status: ATIVO })` |
| Bezerras/Bezerros | `Animal.count({ categoria IN (BEZERRA, BEZERRO), status: ATIVO })` |
| Touros | `Animal.count({ categoria: TOURO, status: ATIVO })` |

### 3.3 Idade média

| Item | Detalhe |
|---|---|
| **Fórmula** | `avg((hoje − Animal.dataNascimento) / 365.25)` para `status = ATIVO` |
| **Apresentação** | Anos, 1 decimal |

### 3.4 Renovação

| Item | Detalhe |
|---|---|
| **Fórmula** | `Animal.count({ categoria: NOVILHA }) ÷ Animal.count({ categoria: VACA })` |
| **Meta** | 20–25% |
| **Interpretação** | Rebanho com fluxo saudável de reposição |

---

## 4. Métricas de reprodução

### 4.1 Status reprodutivo (contagens)

`ResumoAnimal.statusReprodutivo` em `(PEV, VAZIA, INSEMINADA, PRENHE)`. Cards do dashboard mostram contagem de cada.

### 4.2 Taxa de prenhez

| Item | Detalhe |
|---|---|
| **Fórmula** | `prenhes ÷ (prenhes + vazias aptas)` |
| **Apresentação** | `XX,X %` |
| **Meta** | ≥ 25% |
| **Tom** | `--pos` ≥ 25%, `--warn` 15–25%, `--neg` < 15% |

### 4.3 IEP Projetado (médio)

| Item | Detalhe |
|---|---|
| **Origem** | `ResumoAnimal.iepProjetado` |
| **Cálculo individual** | Para PRENHE: `DEL + diasGestacao_restantes`; para VAZIA: `DEL + dias_esperados_concepção + 280` |
| **Agregado** | `avg(iepProjetado)` no rebanho ativo |
| **Meta** | ≤ 395 dias |

### 4.4 Worklists reprodutivas

| Worklist | Filtro | Onde |
|---|---|---|
| A inseminar | `status ∈ (PEV, VAZIA)` | `worklists.ts:aInseminar` |
| DG pendente | `status = INSEMINADA AND últimaIA ≥ 28d` | `worklists.ts:dgPendente` |
| A secar (atrasadas) | `status = PRENHE AND previsaoSecagem ≤ hoje` | `worklists.ts:aSecar` |
| Partos ≤ 30d | `status = PRENHE AND diasGestacao ≥ 250` | `worklists.ts:partosPrevistos` |

### 4.5 Idade ao 1° parto

| Item | Detalhe |
|---|---|
| **Fórmula** | `avg((Animal.primeiroParto − Animal.dataNascimento) / 30)` |
| **Apresentação** | Meses |
| **Meta** | 22–26 |

### 4.6 Taxa de concepção

| Item | Detalhe |
|---|---|
| **Fórmula** | `DG_positivos ÷ inseminações` em janela |
| **Janela típica** | últimos 12 meses |
| **Meta** | ≥ 40% |

---

## 5. Métricas de sanidade

### 5.1 CCS médio do rebanho

| Item | Detalhe |
|---|---|
| **Fórmula** | `avg(ResumoAnimal.ccs)` para vacas em ordenha |
| **Apresentação** | `XXX mil cél/mL` |
| **Faixas** | < 200 excelente · 200–400 ok · 400–750 alerta · > 750 crítico |

### 5.2 % com CCS alto

| Item | Detalhe |
|---|---|
| **Fórmula** | `count(ccs ≥ 400) ÷ count(em ordenha) × 100` |
| **Meta** | < 15% |
| **Tom** | `--pos` < 10%, `--warn` 10–20%, `--neg` ≥ 20% |

### 5.3 Tendência de CCS

`ResumoAnimal.ccsTendencia ∈ ("subindo", "estavel", "caindo")`. Calculado dos **últimos 3 controles**.

**Importante:** CCS *subindo* é **ruim** (cor `--neg`), *caindo* é **bom** (cor `--pos`). Não confundir com produção.

### 5.4 Taxa de mastite clínica

| Item | Detalhe |
|---|---|
| **Fórmula** | `count(EventoSanitario tipo=MASTITE severidade=CLINICA, últimos 30d) ÷ vacasOrdenha × 100` |
| **Meta** | < 5%/mês |

### 5.5 Leite em carência

| Item | Detalhe |
|---|---|
| **Fórmula** | Animais com `EventoSanitario(tipo=APLICACAO, data + carencia_h > hoje)` |
| **Apresentação** | Lista de animais com data de fim de carência |

---

## 6. Métricas de produção

### 6.1 Produção total / dia

| Item | Detalhe |
|---|---|
| **ORDENHA / TOTAL_DIARIO** | `Σ ControleLeiteiro.pesoTotal` na data |
| **TANQUE_LOTE** | `Σ ProducaoLote.litros` na data |
| **Apresentação** | `X.XXX L` |

### 6.2 Produção média por vaca/dia

| Item | Detalhe |
|---|---|
| **Fórmula** | `produçãoTotalDia ÷ vacasEmLactacao` |
| **Apresentação** | `XX,X L/d` |
| **Meta típica** | 25–35 L/d (rebanho intensivo) |

### 6.3 Produção média do animal (rolling)

| Item | Detalhe |
|---|---|
| **Origem** | `ResumoAnimal.producaoMediaDia` |
| **Cálculo** | Média dos **últimos 3 controles** do animal |
| **Implementação** | `services/rebanho/producao.recompute.ts:recomputarProducaoAnimal` |

### 6.4 Produção 305d (P305)

| Item | Detalhe |
|---|---|
| **Real** | Somatório dos controles até 305 dias da lactação |
| **Projetada** | `producaoMediaDia × 305` enquanto lactação aberta |
| **Origem** | `ResumoAnimal.producao305` |
| **Função pura** | `producao.recompute.ts:producao305De(mediaDia, temLactacaoAberta)` |

### 6.5 Tendência de produção

`"subindo" | "estavel" | "descendo"` — comparação dos 2 controles mais recentes vs 2 anteriores.

### 6.6 Curva de lactação

Visualização: scatter de `(DEL, litros)` dos controles, com curva ajustada (futuro).

### 6.7 Rateio Tanque/Lote

Quando modo = `TANQUE_LOTE`:

```
litros_por_vaca = ProducaoLote.litros ÷ vacasEmLactacaoLote
```

Função pura: `producao.recompute.ts:ratearProducao(litros, vacasEmLactacao)`.

---

## 7. Métricas de custo

### 7.1 Custo vaca/dia

| Item | Detalhe |
|---|---|
| **Fórmula** | `Σ MovimentoEstoque(tipo=SAIDA, últimos 30d).valorTotal ÷ (vacasEmLactacao × 30)` |
| **Origem** | `MovimentoEstoque` × `ResumoAnimal` |
| **Implementação** | `services/rebanho/estoque.calc.ts:custoVacaDia` (pura) |
| **Apresentação** | `R$ X,XX /vaca/dia` |

### 7.2 Custo / litro

| Item | Detalhe |
|---|---|
| **Custeio total** | `Σ Lancamento(DEBITO, CCusto="Atividade Leiteira", últimos 12 meses).valor` |
| **Litros estimados** | `Σ ResumoAnimal.producaoMediaDia × dias do período` |
| **Fórmula** | `custeioTotal ÷ litrosEstimados` |
| **Implementação** | `services/rebanho/custo-producao.ts` |
| **Apresentação** | `R$ X,XX /L` (hero do módulo Custo) |
| **Marca** | Marcar como **estimativa** quando litros ainda são projetados |

### 7.3 Breakdown por categoria

Lista categorias do custeio com:

- Total no período
- % do custeio total
- Barra horizontal proporcional

Implementação: `quebrarPorCategoria(ItemCusto[])` em `custo-producao.ts`.

### 7.4 Custo de sanidade

| Item | Detalhe |
|---|---|
| **Específico** | `Σ Produto.custoUnitario` das aplicações registradas para o animal |
| **Por rateio** | `Lancamento("Medicamento Animal") ÷ total aplicações no rebanho × aplicações do animal` |
| **Implementação** | `services/rebanho/custo-sanidade.ts` |

### 7.5 Margem (animal)

| Item | Detalhe |
|---|---|
| **Receita** | `acumuladoLitros × precoLeite` |
| **Custos** | `custoVacaDia × DEL + custoSanidade` |
| **Lucro** | `receita − custos` |
| **Margem** | `lucro ÷ receita` |
| **Tom** | `--pos` ≥ 20% · `--warn` 0–20% · `--neg` < 0% |
| **Implementação** | `services/rebanho/insights.ts:256–274` |

`precoLeite` = `Configuracao.precoLeite` ou fallback **R$ 2,40/L** (`insights.ts:9`).

---

## 8. Métricas por animal — Score e Insights

### 8.1 Score 0–100

Fatores ponderados, calculados em `services/rebanho/insights.ts:120–172`:

| Fator | Peso | Cálculo |
|---|---|---|
| Produção | 30% | `min(120, (produzido ÷ meta) × 100)` |
| CCS | 20% | Escala: 100 (≤200) → 10 (>750), linear |
| Fertilidade | 20% | PRENHE = 90; IEP ≤380 = 100; >420 = 40 |
| Idade | 10% | Bovino 3–7a = 100 (curva fora); caprino 2–5a |
| Saúde | 10% | `100 − (ocorrências últimos 6m × 15)`, mín. 0 |
| Rentabilidade | 10% | Margem ≥ 30% = 100; mapeamento linear |

Fórmula final:

```
score = Σ (pontos_fator × peso) / 100
```

### 8.2 Classificação

| Score | Estrelas | Classe |
|---|---|---|
| ≥ 85 | ★★★★★ | ELITE |
| 70–85 | ★★★★ | MUITO_BOA |
| 55–70 | ★★★ | BOA |
| 40–55 | ★★ | ATENCAO |
| < 40 | ★ | DESCARTE (sugerido) |

### 8.3 Percentis (pool = mesma categoria com produção)

| Eixo | Cálculo |
|---|---|
| Produção | Ranking ordinário ascendente |
| Rentabilidade | `clamp(1, 99, (margem + 0.3) × 100)` |
| Fertilidade | Ranking de IEP invertido (menor é melhor) |
| CCS | Ranking de CCS invertido |

Apresentação: barras horizontais comparando com mediana do pool.

### 8.4 Projeções

| Métrica | Cálculo |
|---|---|
| Produção lactação | `ResumoAnimal.producao305` (NULL se sem lactação aberta) |
| Receita lactação | `producao305 × precoLeite` |
| Lucro lactação | `receita − (305 × custoVacaDia + custoSanidade)` |
| Data secagem | `ResumoAnimal.previsaoSecagem` |
| Data parto | `hoje + (285 − diasGestacao)` se PRENHE |

### 8.5 Insights (string list)

Frases curtas, geradas por regras em `insights.ts`:

- `"CCS subiu em 3 controles — risco de mastite subclínica"`
- `"Vaca está parada há 152 dias — IEP projetado de 412d"`
- `"Margem positiva forte: R$ 4,12/L"`
- `"Produção 28% acima da média da 3ª lactação"`

Cada insight tem `tom: "pos" | "warn" | "neg"`.

---

## 9. Janelas temporais padronizadas

| Janela | Definição | Onde se usa |
|---|---|---|
| **Hoje** | 2026-05-28 (fixo no mock); `new Date()` em produção | KPIs voláteis |
| **Últimos 7 dias** | `[hoje − 7, hoje]` | Atividade recente |
| **Últimos 30 dias** | `[hoje − 30, hoje]` | Custo vaca/dia, dashboards diários |
| **12 meses** | `[hoje − 365, hoje]` | Custo de produção, custo sanidade |
| **YTD 2026** | `[2026-01-01, hoje]` | DRE atual |
| **Ano 2025** | `[2025-01-01, 2025-12-31]` | Comparação anual |
| **23 meses Rio Novo** | Jul/2024 → Mai/2026 | Timeline gráfica do dashboard |
| **2024 H2** | Jul/24 → Dez/24 | DRE histórica |
| **Lactação 305** | `[dataParto, dataParto + 305]` | Curva e P305 |
| **Período seco** | `[secagem, próximo parto]` (~60d) | Manejo |

---

## 10. Alertas

Alertas aparecem no Dashboard Rebanho e em cards das telas de domínio. Regras em `services/rebanho/dashboard.agg.ts`:

| Alerta | Condição | Tom | Ação sugerida |
|---|---|---|---|
| Secagem atrasada | PRENHE & `previsaoSecagem < hoje` | `--neg` | Secar agora |
| Vazia atrasada | VAZIA & DEL > 90 | `--warn` | Inseminar urgente |
| CCS alto | `ccs ≥ 400` | `--warn` | Investigar mastite |
| CCS subindo | `ccsTendencia = "subindo"` | `--neg` | Cultivo + ação |
| Partos ≤ 30d | PRENHE & `diasGestacao ≥ 250` | `--pos` | Preparar parto |
| Estoque mínimo | `Produto.saldo < minimoEstoque` | `--warn` | Comprar |
| Carência ativa | `EventoSanitario.carencia` ainda válida | `--warn` | Não vender leite desta vaca |
| Mês fechado | Tentativa de editar lancamento em mês fechado | `--neg` (bloqueio) | Reabrir mês ou ajustar em mês corrente |

---

## 11. Como apresentar

### Regras gerais

1. **Número grande primeiro**, contexto pequeno depois.
2. **Cor é semântica.** Verde quando o número é bom para o produtor; vermelho quando é ruim — sempre considerando o contexto (CCS sobe = vermelho).
3. **Estimativa marcada** com `≈`.
4. **Sem dado** = `—`. **Nunca zero falso**.
5. **Delta** com seta + comparação explícita (`↗ +3,4% vs abr/2026`).
6. **Janela visível.** Caption sempre dizendo a fonte (`12 meses`, `2026 YTD`, `Últimos 30 dias`).
7. **Impacto financeiro** ao lado de indicadores zootécnicos sempre que possível. Ex: "IEP médio 412d (≈ R$ 28 mil em receita não capturada/ano)".

### Anti-padrões

- ❌ Mostrar % sem o absoluto.
- ❌ Mostrar absoluto sem a janela.
- ❌ Misturar Médias e Totais sem dizer qual é qual.
- ❌ Acumular escalas (mil + milhões na mesma tabela).
- ❌ Decorar projeção como se fosse realizado.

---

## Referências cruzadas

- [`DOMAIN.md`](./DOMAIN.md) — definições e metas dos indicadores.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — onde cada cálculo vive no código.
- [`PRODUCT.md`](./PRODUCT.md) — por que cada métrica existe.
- `server/src/services/dashboard.ts` — agregados financeiros.
- `server/src/services/rebanho/insights.ts` — score + financeiro por animal.
- `server/src/services/rebanho/custo-producao.ts` — R$/litro.
- `server/src/services/rebanho/estoque.calc.ts` — custo vaca/dia.
- `server/src/services/rebanho/producao.recompute.ts` — média móvel e P305.
- `server/src/services/rebanho/dashboard.agg.ts` — KPIs do dashboard rebanho.
