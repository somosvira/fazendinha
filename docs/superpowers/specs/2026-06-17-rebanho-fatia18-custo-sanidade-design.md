# Fatia 18 — Custo de sanidade por rateio do gasto real — Design

**Data:** 2026-06-17
**Status:** aprovado (usuário escolheu "Rateio do gasto real").
**Depende de:** Fatia 17 (`EventoSanitario` tipo APLICACAO importado); financeiro real (`Lancamento` categoria "Medicamento Animal").

---

## 1. Problema / decisão
"Custo de sanidade real" por aplicação **não existe no dado**: o `PRODUTO.VRUNITARIOESTOQUE` do Ideagri é NULL pros 15 produtos aplicados (mesma história do `CDCENTROCUSTO` vazio). Mas temos dois lados reais: o **gasto financeiro** "Medicamento Animal" (`Lancamento`, R$ 299.820 nos últimos 12m) e o **consumo** (`EventoSanitario` APLICACAO, 3.153 aplicações/12m por animal). Decisão do usuário: **ratear o gasto real pelas aplicações** → custo estimado por animal/período. Honesto, rotulado como **estimativa por volume** (não pondera custo por produto).

## 2. Método (puro, testável)
```
custoPorAplicacao = totalMedicamento(período) / totalAplicacoes(período)
custoEstimadoAnimal = nAplicacoesAnimal × custoPorAplicacao
```
- `totalMedicamento` = Σ `Lancamento.valor` (categoria "Medicamento Animal", `situacao=LIQUIDADO`, `natureza=DEBITO`, `dataLiquidacao ≥ desde`).
- `nAplicacoesAnimal` = nº de `EventoSanitario` (tipo APLICACAO, `data ≥ desde`) por animal.
- Janela default: **12 meses** (3.153 das 3.257 aplicações caem aí; ~R$ 95/aplicação).

**Limitação (transparente, no card):** rateio por **volume** — uma aplicação cara (Lactotropin/bST) conta igual a uma vacina barata, porque o Ideagri não tem custo por produto. Refina quando houver custo por produto (Fatia futura: usuário informa no Cadastros).

## 3. Componentes

**Motor puro `server/src/services/rebanho/custo-sanidade.ts`** (TDD):
- `ratearCustoSanidade(totalMedicamento, porAnimal: {numero, nome, n}[]) → { custoPorAplicacao, totalAplicacoes, animais: {numero, nome, n, custoEstimado}[] }`. Divide-por-zero → custoPorAplicacao 0.
- Service `agregarCustoSanidade(meses = 12)`: junta o financeiro (Lancamento) + as aplicações (EventoSanitario group-by animal, join Animal p/ numero/nome) + ranking de produtos (`EventoSanitario.produto` group-by, top). Retorna `{ periodoMeses, totalMedicamento, totalAplicacoes, custoPorAplicacao, topAnimais: top10 por custoEstimado, topProdutos: top8 {produto, n}, nota }`.

**API `server/src/routes/rebanho/custo-sanidade.ts`:** `GET /rebanho/custo-sanidade?meses=12` → `c.json(await agregarCustoSanidade(meses))`. Montar no `index.ts`.

**UI — seção "Custo de sanidade" na aba Custo** (`client/src/rebanho/components/CustoProducaoTab.tsx`): abaixo do custo de produção, uma seção nova:
- KPIs: **Gasto Medicamento (real)** R$ X (12m), **Aplicações** N, **R$/aplicação** (estimativa).
- **Ranking** top animais por custo estimado (nome · nº aplicações · R$) — barra como no breakdown.
- **Top produtos** aplicados (nome · nº) — contexto do consumo.
- Card de transparência: rateio por volume, sem custo por produto (a limitação acima).
- Hook `useCustoSanidade(12)` em `api.ts` (espelha `useCustoProducao`).

## 4. Verificação
- **API:** `/rebanho/custo-sanidade` → totalMedicamento ≈ 299.820, totalAplicacoes ≈ 3.153, custoPorAplicacao ≈ 95; topAnimais com nome+custo; topProdutos (Lactotropin no topo).
- **Navegador:** aba Custo mostra a seção de sanidade com os KPIs, ranking de animais e top produtos + card de transparência.
- Motor puro testado (node/vitest); server build/test + client build/test verdes.

## 5. Decisões deferidas
- **Custo por produto exato** (usuário informa custo unitário dos 15 produtos no Cadastros) → substitui o rateio por volume.
- Custo sanitário por animal no **cockpit** (hoje só na aba Custo).
- Separar hormônio (Lactotropin/bST) de medicamento sanitário (categorização financeira distinta).
- Pesagens (PESO→GMD); qualidade do leite + mastite; reclassificação Animal Aquisição.
