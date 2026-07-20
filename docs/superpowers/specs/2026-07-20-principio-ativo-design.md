# Princípio ativo / composição de medicamento — Design

**Data:** 2026-07-20
**Fatia:** IDEagri-gaps #5 (prioridade alta, dado 777: `PRINCIPIOATIVO` 665 + `PRODUTOPRINCIPIOATIVO` 12445). Estoque/Sanidade.
**Relacionado:** `docs/design/ideagri-gaps.md` linha 23.

## 1. Problema

Um medicamento é composto por um ou mais **princípios ativos**, e a carência efetiva do leite/carne (compliance — não vender leite / não abater dentro da carência) deriva dessa composição. Hoje o `Produto` só tem um campo `carencia` solto; não há catálogo de princípios ativos nem a composição estruturada. O IDEagri modela em `PRINCIPIOATIVO` (665) + `PRODUTOPRINCIPIOATIVO` (12445).

## 2. Objetivo / decisão entregue

Catálogo de **princípios ativos** (nome, flag antibiótico, carência de leite/carne sugerida) + **composição** de cada medicamento (join Produto↔PrincipioAtivo). A partir da composição, derivar no nível do produto: se é antibiótico e a carência sugerida (o máximo entre os princípios — o mais restritivo manda).

## 3. Não-objetivos (YAGNI)

- Não altera automaticamente a `carencia` do Produto nem a carência do evento de aplicação — a composição **sugere**; aplicar é decisão futura (ligação com a carência de leite ativa do #153).
- Sem importar os 665 princípios do IDEagri nesta fatia (cadastro manual + base pronta para import depois).

## 4. Arquitetura

### 4.1 Schema (aditivo)

- `PrincipioAtivo` — `nome` (único), `ehAntibiotico`, `carenciaLeiteHoras?`, `carenciaCarneDias?`, `ativo`.
- `ProdutoPrincipioAtivo` — join N:N (`produtoId`+`principioAtivoId` único, `concentracao?` texto livre), cascade nos dois lados. Inverse em `Produto`.

### 4.2 Cálculo puro (TDD)

`composicao.calc.ts` — `derivarComposicao(principios)`: `ehAntibiotico` (algum princípio antibiótico) + carência sugerida = **máximo** entre os princípios (ignora nulls) + nomes. Determinístico, sem I/O.

### 4.3 Serviço + rota

`principio-ativo.ts` — CRUD do catálogo (excluir princípio em uso só inativa) + `obterComposicao`/`definirComposicao` (substitui a composição inteira numa transação; dedup + ignora ids fantasma). Rotas:
- `GET/POST /rebanho/principios-ativos`, `PATCH/DELETE /rebanho/principios-ativos/:id`.
- `GET/PUT /rebanho/produtos/:id/composicao`.

### 4.4 Frontend

- `api.ts` — DTOs + hooks + funções.
- `PrincipiosAtivosSection.tsx` — catálogo (CRUD, badge ATB, carência) + editor de composição (escolhe medicamento → marca princípios → vê carência sugerida derivada). Na aba **Estoque**.

## 5. Testes & entrega

- Vitest: `composicao.calc.test.ts` (antibiótico se qualquer princípio for; carência = máximo ignorando nulls; nomes na ordem).
- Smoke local (Postgres): cria 2 princípios → compõe um medicamento real → deriva ATB + carência 96h/21d → usoEmProdutos=1 → limpa (0 órfãos).
- Build verde nos 2 workspaces + suítes completas.
- PR único.

## 6. Reúso

`Produto` (fonte do medicamento), padrão de catálogo configurável (ProtocoloIATF), calc-puro-TDD + rota fina.
