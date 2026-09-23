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

### Vocabulário financeiro

| Termo | Regra |
|---|---|
| **Regime** | **Caixa.** Só existe "realizado" onde houve `MovimentoConta` (ponta de uma `TransacaoFinanceira`). `CompromissoFinanceiro` é agenda: **nunca** altera saldo. |
| **Data de caixa** | `TransacaoFinanceira.data` (`@db.Date`). É o eixo temporal de tudo que é realizado. Compromisso usa `dataVencimento`. |
| **Período** | Janela `[inicio, fim]` sobre a data de caixa. Default do dashboard = **mês corrente** (`Date.UTC(ano, mes, 1)` → `Date.UTC(ano, mes+1, 0, 23:59:59)`), em `server/src/routes/financeiro.ts`. |
| **Escopo de propriedade** | Toda leitura financeira resolve `propriedadeId` via `resolverEscopoLeitura(c)`. `null` = sem recorte (todas as propriedades). Transação filtra por `propriedadeId` direto; compromisso filtra por `operacao.propriedadeId`. |
| **Transferência** | `TransacaoFinanceira.tipo = TRANSFERENCIA` só redistribui disponibilidade entre contas próprias. **Sempre excluída** de entradas/saídas e de despesas por categoria — se entrar, infla os dois lados. |
| **Estorno** | Não apaga: cria uma `TransacaoFinanceira(tipo = REVERSAO)` com movimentos de direção invertida e marca a original como `REVERTIDA`. Saldo volta sozinho. |
| **Sinal** | Não existe campo de sinal. O sentido do dinheiro vem de `MovimentoConta.direcao` (`ENTRADA`/`SAIDA`). |
| **Decimal** | Todos os valores são `Decimal(14,2)`. Somar sempre com `Prisma.Decimal`, nunca `number` JS. |

---

## 2. Métricas financeiras

> **Modelo de dados.** `Operacao` (+`ItemOperacao`) é o fato de negócio; `CompromissoFinanceiro` (+`Liquidacao`) é valor pendente; `TransacaoFinanceira` → `MovimentoConta` é dinheiro realizado e a **única** fonte de saldo de `ContaFinanceira`; `PeriodoFinanceiro` trava escrita em mês fechado; `Parceiro` é a contraparte.
> Todo o dashboard financeiro vive em **um** service: `server/src/services/financeiro/dashboard.ts:obterDashboard`, servido por `GET /api/financeiro/dashboard?inicio&fim` (`server/src/routes/financeiro.ts`) e consumido por `client/src/financeiro/VisaoGeralFinanceira.tsx`.

### 2.1 Recebimentos realizados (período)

| Item | Detalhe |
|---|---|
| **Fórmula** | `Σ MovimentoConta.valor` onde `direcao = ENTRADA`, `transacao.tipo ≠ TRANSFERENCIA` e `transacao.data ∈ [inicio, fim]` |
| **Origem** | `MovimentoConta` × `TransacaoFinanceira` (regime de caixa) |
| **Escopo** | `transacao.propriedadeId` quando há propriedade ativa |
| **Implementação** | `services/financeiro/dashboard.ts` → `realizado.entradas` |
| **Onde aparece** | KPI "Recebimentos" na Visão geral financeira |
| **Interpretação** | Dinheiro **que entrou de fato** nas contas no período |

### 2.2 Pagamentos realizados (período)

| Item | Detalhe |
|---|---|
| **Fórmula** | Idem 2.1 com `direcao = SAIDA` |
| **Implementação** | `services/financeiro/dashboard.ts` → `realizado.saidas` |
| **Onde aparece** | KPI "Pagamentos" na Visão geral financeira |
| **Interpretação** | Dinheiro **que saiu de fato** das contas no período |

> **Atenção (comportamento real do código):** `obterDashboard` **não filtra `transacao.status`**. Uma transação estornada continua somando, e o `REVERSAO` gerado soma na direção oposta. O **resultado (2.3) fica correto**, mas entradas e saídas ficam infladas pelo par estorno/reversão. Motores que precisam do valor limpo filtram `status = "CONFIRMADA"` explicitamente — é o que fazem `services/consulta/registro/financeiro.ts`, `services/rebanho/custo-producao.ts` e `custo-sanidade.ts`.

### 2.3 Resultado do período

| Item | Detalhe |
|---|---|
| **Fórmula** | `entradas − saídas` (2.1 − 2.2, mesmo período) |
| **Implementação** | `services/financeiro/dashboard.ts` → `realizado.resultado` |
| **Cor** | `--pos` se positivo, `--neg` se negativo |
| **Onde aparece** | Devolvido pela API; a Visão geral hoje exibe entradas e saídas separadas |

### 2.4 Saldo por conta e saldo geral

| Item | Detalhe |
|---|---|
| **Saldo da conta** | `saldoAbertura + Σ MovimentoConta(ENTRADA) − Σ MovimentoConta(SAIDA)` — **todos** os movimentos da conta, sem recorte de período |
| **Saldo geral** | `Σ saldoAtual` das contas com `ativo = true` **e** `incluirNoSaldoGeral = true` |
| **Origem** | `ContaFinanceira` × `MovimentoConta` |
| **Implementação** | `services/financeiro/contas.ts:listarContas` (saldo por conta) e `resumoSaldos` (saldo geral) |
| **Onde aparece** | KPI "Saldo geral" + painel "Contas e disponibilidades" (Visão geral) e a tela de Contas |
| **Interpretação** | Disponibilidade **agora**, não no período selecionado. Transferência entre duas contas incluídas não muda o saldo geral; envolvendo conta excluída, o impacto depende da inclusão de origem e destino. |

O impacto de uma transferência no saldo geral é `valor × (destino incluído − origem incluída)`, considerando somente contas ativas. O saldo histórico dos relatórios inclui todas as contas da fazenda, inclusive inativas e excluídas da disponibilidade atual.

### 2.5 Compromissos a pagar / a receber

| Item | Detalhe |
|---|---|
| **Fórmula** | `Σ (valorOriginal − Σ Liquidacao.valor com transacao.status = CONFIRMADA)` sobre `CompromissoFinanceiro` com `status ∈ (PENDENTE, PARCIAL)`, separado por `tipo` (`PAGAR` / `RECEBER`) |
| **Janela** | **Nenhuma.** O dashboard soma todo o pendente, não só o que vence no período. |
| **Escopo** | `operacao.propriedadeId` |
| **Implementação** | `services/financeiro/dashboard.ts` → `compromissos.aPagar` / `aReceber` |
| **Onde aparece** | KPIs "A pagar" / "A receber" e o painel "Próximos compromissos" |
| **Interpretação** | Agenda financeira. **Não** compõe o saldo até virar liquidação. |

A listagem (`services/financeiro/operacoes.ts:listarCompromissos`, `GET /api/financeiro/compromissos`) devolve por compromisso:

- `valorLiquidado` = soma das `Liquidacao` cuja transação está `CONFIRMADA`;
- `saldoPendente` = `valorOriginal − valorLiquidado`;
- `vencido` = `status ∉ (LIQUIDADO, CANCELADO)` **e** `dataVencimento < hoje`.

Uma liquidação nunca pode exceder o saldo pendente (`FinanceiroError("VALIDACAO")`), e ao zerar o saldo o compromisso vira `LIQUIDADO`; caso contrário, `PARCIAL`.

Liquidações e estornos da mesma operação são serializados por bloqueio no PostgreSQL. O saldo é relido sob o bloqueio antes de persistir a liquidação. Estornar um pagamento preserva sua `Liquidacao` para o histórico; a transação `REVERTIDA` deixa de compor o valor liquidado.

### 2.6 Despesas por categoria

| Item | Detalhe |
|---|---|
| **Fórmula** | Para cada `MovimentoConta` `SAIDA` realizado no período global, rateia o valor por categoria (`ratearTransacao`, fallback `"Sem categoria"`) e soma por `categoriaId` |
| **Estornos** | O estorno abate a natureza original **na data do evento inverso** (`dashboard.calc.ts:movimentoRealizado`). Uma categoria pode ficar com total líquido **negativo** (estorno de despesa de outro período) |
| **Exclusões** | `TRANSFERENCIA` e reversões de transferência; entradas nunca entram como despesa |
| **Ordenação** | Total desc, sem corte no backend; grupos com total zero são descartados |
| **Implementação** | `services/financeiro/dashboard.ts` → `despesasPorCategoria` (`{ categoriaId, categoria, valor }`) |
| **Onde aparece** | Bloco "Despesas por categoria" (Visão geral), donut monetário (`MonetaryDonutChart`). Único filtro local: multiselect de categorias (vazio = todas; "Sem categoria" = `categoriaId` nulo) |
| **Interpretação** | Onde o dinheiro saiu no período do topo, líquido de estornos. Valores negativos abatem o total e aparecem em texto, sem fatia. Passando de 6 categorias positivas, as menores são agrupadas em "Outras (N)". Transação avulsa (sem operação) cai em `"Sem categoria"`. |

Não há delta YoY nem recorte por centro de custo nesta métrica. O bloco "Despesas realizadas" deixou de existir.

### 2.7 Período financeiro (bloqueio de escrita)

`PeriodoFinanceiro(propriedadeId, ano, mes)` com `status = FECHADO` **bloqueia toda escrita financeira** daquele mês. Implementado em `services/financeiro/regras.ts:exigirPeriodoAberto`, que resolve `ano`/`mes` da data em **UTC** e lança `FinanceiroError("PERIODO_FECHADO")` → HTTP **409**.

Chamado em `services/financeiro/operacoes.ts` por:

| Escrita | Data avaliada |
|---|---|
| Criar operação (inclusive confirmação de rascunho) | `operacao.data` |
| Criar transação (à vista, parcial e liquidação de compromisso) | `transacao.data` |
| Transferência entre contas | `data` da transferência |
| Estorno de transação e cancelamento de operação | **data de hoje** |

O mesmo `PeriodoFinanceiro` é consultado fora do financeiro por `services/estoque/estoque.ts`, `services/rebanho/nutricao.consumo.ts` e `services/plantio/timeline.ts`.

> **Sem endpoint.** Não existe rota HTTP para fechar ou reabrir período — os registros só nascem via banco/seed. A trava funciona; a operação de fechamento ainda não tem UI nem API.

### 2.8 Base financeira (rastreabilidade da Visão geral)

Calculada **no servidor** para o período global do topo (`services/financeiro/dashboard.ts:obterDashboard` → `base`), sem carregar todas as operações no cliente. Cada etapa da cadeia **Operação → Compromisso → Transação → Movimento de conta** usa a sua própria data de corte e a sua própria grandeza; elas não são somadas entre si:

| Etapa | Data usada | Contagens e estados | Grandeza financeira |
|---|---|---|---|
| Operação | `Operacao.data` | total; `CONFIRMADA`/`RASCUNHO`/`CANCELADA`; com estoque; sem parceiro; sem efeitos vinculados | Volume econômico: `Σ valorTotal` das **confirmadas**, por tipo (`base.porTipo`, sem tipos zerados) |
| Compromisso | `dataVencimento` | total; `PENDENTE`/`PARCIAL`/`LIQUIDADO`/`CANCELADO` | Saldo pendente a pagar / a receber |
| Transação | `TransacaoFinanceira.data` | total; `CONFIRMADA`/`REVERTIDA`; estornos; avulsas; com liquidação; sem movimentos; transferências incompletas | Dinheiro realizado líquido de estornos (`realizado`) |
| Movimento de conta | data da transação | total; confirmados; revertidos; estornos | Inclui as duas pontas de cada transferência, sem somá-las ao realizado |

`base.vinculosAusentes` lista até 20 transações sem movimento de conta ou com transferência sem as duas pontas, com o link para a operação de origem quando existe. Os links da tela levam a Operações, Compromissos e Contas preservando `?inicio&fim` (e `?efeito=SEM_EFEITOS`). Volume por tipo de operação é exibido como donut com total, participação por tipo e estado vazio. Exportação e relatórios documentais seguem em §2.9.

### 2.9 Métricas sem implementação atual

Estavam neste documento sobre o modelo antigo (`Lancamento`/`FechamentoMensal`) e **não têm equivalente no código hoje**. Ficam listadas para não serem reinventadas por engano:

| Métrica antiga | Situação | O que existe no lugar |
|---|---|---|
| **DRE simplificado** (Receita Leite, Custeio Leite Puro, Animal Aquisição, RN Caminhão, Investimento Leite, Custeio BPO) | Sem implementação | Nenhuma. O único recorte por centro de custo que sobrou é o custeio da Atividade Leiteira em `services/rebanho/custo-producao.ts` (§7.2). |
| **Timeline de 23 meses** e **delta YoY** de categorias | Sem implementação | `despesasPorCategoria` (§2.6), de um único período, sem comparação. |
| **Projeção de fluxo / a vencer** | Sem implementação | Saldo pendente dos compromissos (§2.5) — total, não distribuído no tempo. |
| **Cards de inconsistência contábil** (Animal Aquisição não classificado, RN Caminhão grande, Atv Plantio, Sem CCusto) | Sem implementação | Só sobrou o override de classificação da categoria: `PATCH /api/categorias/:id/classificacao` (`server/src/routes/categorias.ts`, grava `Categoria.classificacao ∈ CUSTEIO/INVESTIMENTO`). Nada calcula nem exibe os cards. |
| **Fôlego de caixa / queima mensal** | Sem implementação | `DASHBOARD_MESES_QUEIMA` continua declarado em `server/src/env.ts:34` mas **não é lido em lugar nenhum** do server. No front, `client/src/api.ts:fetchDashboard` ainda monta `d.folego` a partir de `GET /api/dashboard` — rota que **não existe mais** no backend. |

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

O saldo físico soma entradas e ajustes e subtrai saídas, incluindo movimentos `CONFIRMADO` e `REVERTIDO`. O original estornado e seu inverso se anulam em quantidade e valor; no movimento inverso de um ajuste, quantidade e valor têm seus sinais invertidos.

| Item | Detalhe |
|---|---|
| **Fórmula** | `Σ MovimentoEstoque(tipo=SAIDA, status=CONFIRMADO, reversaoDeId=null, últimos 30d).valorTotal ÷ (vacasEmLactacao × 30)` |
| **Origem** | `MovimentoEstoque` × `ResumoAnimal` |
| **Implementação** | `services/estoque/estoque.calc.ts:custoVacaDia` (pura) |
| **Apresentação** | `R$ X,XX /vaca/dia` |

### 7.2 Custo / litro

| Item | Detalhe |
|---|---|
| **Custeio total** | `Σ TransacaoFinanceira.valorTotal` onde `status = CONFIRMADA`, `tipo = PAGAMENTO`, `data ≥ hoje − N meses` e `operacao.centroCusto.nome = "Atividade Leiteira"` (escopo por `propriedadeId`) |
| **Litros estimados** | `Σ ResumoAnimal.producaoMediaDia` dos animais `ATIVO` com `del ≠ null`, × `N × 30` dias |
| **Fórmula** | `custeioTotal ÷ litrosEstimados` (2 casas; `null` quando os litros estimados são 0) |
| **Janela** | `N = 12` meses por padrão |
| **Implementação** | `services/rebanho/custo-producao.ts:agregarCustoProducao` |
| **Apresentação** | `R$ X,XX /L` (hero do módulo Custo) |
| **Marca** | Sempre **estimativa** — os litros são projetados da produção atual, não medidos no período |

### 7.3 Breakdown por categoria

Quebra o **mesmo** custeio de 7.2 por `operacao.categoria.nome` (fallback `"Sem categoria"`), com:

- Total por categoria (2 casas)
- `pct = valor ÷ total` (1 casa)
- Ordenação desc; barra horizontal proporcional

Motor puro: `quebrarPorCategoria(ItemCusto[])` em `services/rebanho/custo-producao.ts` — testável sem Prisma.

### 7.4 Custo de sanidade

| Item | Detalhe |
|---|---|
| **Gasto financeiro** | `Σ TransacaoFinanceira.valorTotal` com `status = CONFIRMADA`, `tipo = PAGAMENTO`, `data ≥ hoje − N meses` e `operacao.categoria.nome = "Medicamento Animal"` |
| **Aplicações** | `EventoSanitario` com `tipo ∈ (APLICACAO, VACINA)` na mesma janela |
| **Rateio por volume** | `custoPorAplicacao = gastoFinanceiro ÷ totalAplicações`; custo do animal = `nºAplicações × custoPorAplicacao` |
| **Custo exato** | Por aplicação: `quantidadeUsada × custo médio` do produto no sítio (ou o valor do `MovimentoEstoque` CONFIRMADO da baixa quando disponível — mais confiável, tem prioridade); `null` sem produto/quantidade — cai no rateio por volume |
| **Implementação** | `services/rebanho/custo-sanidade.ts` — motor puro `ratearCustoSanidade(total, porAnimal[])` |
| **Marca** | Estimativa por **volume**: uma aplicação cara conta igual a uma barata enquanto os produtos não tiverem custo apurado pelas compras |

### 7.5 Margem (animal)

| Item | Detalhe |
|---|---|
| **Receita** | `acumuladoLitros × precoLeite` |
| **Custos** | `custoVacaDia × DEL + custoSanidadeAnimal` |
| **Lucro** | `receita − custos` |
| **Margem** | `lucro ÷ receita` (0 quando a receita é 0) |
| **Tom** | `--pos` ≥ 20% · `--warn` 0–20% · `--neg` < 0% |
| **Implementação** | `services/rebanho/insights.ts:221–225` |

`custoSanidadeAnimal` = custo **exato** (soma do custo real de cada aplicação dos últimos 12 meses — quantidade × custo médio, ou valor do movimento de estoque quando disponível) quando > 0; senão o **rateio** do gasto real das categorias de uso sanitário — mesma consulta de 7.4, sobre `TransacaoFinanceira` `CONFIRMADA`/`PAGAMENTO` (`insights.ts:224–238`).

`precoLeite` = `Configuracao.precoLeite` ou fallback **R$ 2,40/L** (`insights.ts:13`).

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
| **12 meses** | `[hoje − 12 meses, hoje]` | Custo de produção (§7.2), custo sanidade (§7.4) |
| **Mês corrente** | `[Date.UTC(a, m, 1), Date.UTC(a, m+1, 0, 23:59:59)]` | Default do dashboard financeiro (`routes/financeiro.ts`) |
| **Mês selecionado** | `[inicio, fim]` do seletor de mês | Visão geral financeira (`limitesMes` em `financeiro-ui.tsx`) |
| **Lactação 305** | `[dataParto, dataParto + 305]` | Curva e P305 |
| **Período seco** | `[secagem, próximo parto]` (~60d) | Manejo |

> Janelas de comparação anual (YTD, ano cheio, 23 meses) **não existem mais** no financeiro — não há DRE nem timeline histórica implementadas (§2.9).

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
| Período fechado | Escrita financeira em mês com `PeriodoFinanceiro.status = FECHADO` | `--neg` (bloqueio) | Erro `PERIODO_FECHADO` (HTTP 409) — registrar em período aberto |

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
- [`docs/financeiro-rebuild-contrato.md`](./docs/financeiro-rebuild-contrato.md) — contrato do modelo financeiro atual.
- `server/src/services/financeiro/dashboard.ts` — agregados financeiros (realizado, compromissos, categorias).
- `server/src/services/financeiro/contas.ts` — saldo por conta e saldo geral.
- `server/src/services/financeiro/regras.ts` — trava de `PeriodoFinanceiro` e auditoria.
- `server/src/services/financeiro/operacoes.ts` — operações, compromissos, liquidações, transferências, estorno.
- `server/src/services/consulta/registro/financeiro.ts` — fatos financeiros expostos à IA.
- `server/src/services/rebanho/insights.ts` — score + financeiro por animal.
- `server/src/services/rebanho/custo-producao.ts` — R$/litro.
- `server/src/services/estoque/estoque.calc.ts` — custo vaca/dia.
- `server/src/services/rebanho/producao.recompute.ts` — média móvel e P305.
- `server/src/services/rebanho/dashboard.agg.ts` — KPIs do dashboard rebanho.
