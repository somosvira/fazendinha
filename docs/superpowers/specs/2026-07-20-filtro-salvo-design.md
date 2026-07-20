# Filtro de animais salvo — Design

**Data:** 2026-07-20
**Fatia:** IDEagri-gaps (prioridade média, `FILTRO` 52). Rebanho.
**Relacionado:** `docs/design/ideagri-gaps.md` "Seleção/filtro de animais salvo".

## 1. Problema

A aba Animal tem filtros simples (status, grupo, setor, busca) mas eles se perdem ao trocar de tela. O IDEagri tem um **construtor de filtros salvos** (`FILTRO`, 52) — o produtor salva um conjunto de critérios ("Vacas do lote Alta em lactação") e reaplica com um clique.

## 2. Objetivo / decisão entregue

Salvar/nomear um **filtro de animais** (status + grupo + setor + categoria + busca) e reaplicá-lo com um clique. CRUD do catálogo + aplicação na aba Animal.

## 3. Não-objetivos (YAGNI)

- Sem construtor de expressões booleanas arbitrárias (o IDEagri tem; aqui salvamos o conjunto de filtros simples já existentes + categoria).
- Sem compartilhar filtro entre usuários (é um catálogo simples; escopo por propriedade como os demais cadastros).

## 4. Arquitetura

### 4.1 Schema (aditivo)

`FiltroAnimal` — `nome`, os critérios como colunas tipadas (`status`, `grupoId?`, `setor?`, `categoria?`, `busca?`), `propriedadeId?`. Colunas tipadas (não JSON) mantêm a validação e o índice simples.

### 4.2 Cálculo puro (TDD)

`filtro.calc.ts` — `criteriosParaQuery(filtro)`: normaliza os critérios salvos no formato do `listarAnimais` (ignora vazios). Determinístico.

### 4.3 Serviço + rota

`filtros.ts` — CRUD (`listar/criar/excluir`). `GET/POST /rebanho/filtros`, `DELETE /rebanho/filtros/:id`.

### 4.4 Frontend

- `api.ts` — `FiltroAnimalDTO` + `useFiltrosAnimais` + criar/excluir.
- `AnimalTab` — dropdown "Filtros salvos" (aplica: seta status/setor/grupo/categoria/busca) + "salvar filtro atual" + excluir.

## 5. Testes & entrega

- Vitest: `filtro.calc.test.ts` (normaliza; ignora vazios; status default).
- Smoke local (Postgres): cria filtro → lista → aplica (checa que os critérios voltam) → exclui.
- Build verde + suítes.
- PR único.

## 6. Reúso

`listarAnimais` (aplicação), padrão catálogo configurável, calc-puro-TDD + rota fina.
