# Composição de produto (ração formulada) — Design

**Data:** 2026-07-20
**Fatia:** IDEagri-gaps (prioridade baixa, L2). Estoque.
**Relacionado:** `Produto` (unificado); princípio ativo (#174, mesmo padrão de join); `docs/design/ideagri-gaps.md` "Composição de produto (ração formulada)".

## 1. Problema

Uma ração formulada é um produto composto por vários ingredientes (milho, farelo de soja, núcleo…) em proporções. Hoje o `Produto` é atômico — não dá para registrar a **receita** de uma ração. O IDEagri tem "Composição de produto".

## 2. Objetivo / decisão entregue

Registrar a **receita** de um produto (tipicamente uma ração): uma lista de ingredientes (outros produtos) com **proporção %**. CRUD da composição + validação (soma das proporções). Espelha a "Composição de produto" do IDEagri; segue o padrão do princípio ativo (#174).

## 3. Não-objetivos (YAGNI)

- Sem cálculo nutricional automático a partir dos ingredientes (macros já existem na Dieta; ligar isso é continuação).
- Sem custo derivado da receita (poderia somar custoUnitário × proporção — fica para depois).
- Sem "produzir lote" (consumir ingredientes → gerar a ração no estoque) — é fluxo de produção, outra fatia.

## 4. Arquitetura

### 4.1 Schema (aditivo)

`ComposicaoProdutoItem` — join do produto "pai" (a ração) com um ingrediente (outro `Produto`) + `proporcao` (%). `@@unique([produtoId, ingredienteId])`. Inverse `composicao` (itens onde é a ração) e `usadoEmComposicoes` (onde é ingrediente) em `Produto`.

### 4.2 Cálculo puro (TDD)

`composicao-produto.calc.ts` — `resumoComposicao(itens)`: soma das proporções, flag `somaOk` (≈100%), nº de ingredientes. Determinístico.

### 4.3 Serviço + rota

`composicao-produto.ts` — `obterComposicao(produtoId)` + `definirComposicao(produtoId, itens)` (substitui a lista, transação, dedup, ignora ids fantasma, veta o próprio produto como ingrediente). Rotas: `GET/PUT /rebanho/produtos/:id/composicao-racao`.

### 4.4 Frontend

- `api.ts` — DTOs + funcs.
- `ComposicaoRacaoSection.tsx` — na aba Estoque: escolhe um produto → lista/edita os ingredientes com proporção; mostra a soma (alerta se ≠100%).

## 5. Testes & entrega

- Vitest: `composicao-produto.calc.test.ts` (soma; somaOk; vazio; nº ingredientes).
- Smoke local (Postgres): cria receita de 2 ingredientes → confere soma → limpa.
- Build verde + suítes. PR único.

## 6. Reúso

`Produto`, padrão join+composição do princípio ativo (#174), calc-puro-TDD, aba Estoque.
