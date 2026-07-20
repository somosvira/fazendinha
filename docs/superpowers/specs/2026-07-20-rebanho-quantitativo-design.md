# Rebanho quantitativo — Design

**Data:** 2026-07-20
**Fatia:** IDEagri-gaps (prioridade baixa, L1). Rebanho.
**Relacionado:** `docs/design/ideagri-gaps.md` "Rebanho quantitativo (relatório clássico)".

## 1. Problema

Temos KPIs de efetivo no Dashboard, mas falta o **relatório quantitativo clássico** do IDEagri: o efetivo do rebanho **por categoria e por faixa etária**. É a foto do plantel para planejamento.

## 2. Objetivo / decisão entregue

Um **quadro quantitativo** do rebanho ativo: matriz categoria × faixa etária (contagem), com totais por categoria e por faixa. Read-only, derivado dos animais ativos.

## 3. Não-objetivos (YAGNI)

- Sem série histórica (efetivo ao longo do tempo) — é a foto atual.
- Sem entradas/saídas — só o efetivo corrente.

## 4. Arquitetura

### 4.1 Schema

Nenhuma mudança — deriva de `Animal` (categoria + dataNascimento).

### 4.2 Cálculo puro (TDD)

`quantitativo.calc.ts` — `agruparQuantitativo(animais, hoje)`:
- faixas em meses: `0-6`, `6-12`, `12-24`, `24-36`, `36+`, `sem-idade` (nascimento null).
- matriz `{ categoria, faixas: Record<faixa, n>, totalCategoria }[]` (ordem: total desc) + `totalPorFaixa` + `total`.
- idade em meses de dataNascimento; determinístico (`hoje` do chamador).

### 4.3 Serviço + rota

`quantitativo.ts` — lê `Animal` ativo no escopo (categoria, dataNascimento), chama o calc. `GET /rebanho/quantitativo`.

### 4.4 Frontend

- `api.ts` — `QuantitativoDTO` + `useQuantitativo`.
- `QuantitativoSection.tsx` — tabela categoria × faixa etária na aba Carteira.

## 5. Testes & entrega

- Vitest: `quantitativo.calc.test.ts` (faixas; sem idade; totais; ordem; vazio).
- Smoke local (Postgres): total == efetivo ativo.
- Build verde + suítes. PR único.

## 6. Reúso

`Animal`, calc-puro-TDD + rota fina, aba Carteira.
