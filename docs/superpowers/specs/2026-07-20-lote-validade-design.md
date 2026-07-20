# Lote de produto / validade + locais de armazenamento — Design

**Data:** 2026-07-20
**Fatia:** IDEagri-gaps (prioridade baixa, L3). Estoque.
**Relacionado:** `loteProduto` (texto livre em eventos) + `setor` no estoque; `docs/design/ideagri-gaps.md` "Lote de produto / validade + múltiplos locais de armazenamento".

## 1. Problema

Hoje o lote de produto é **texto livre** (`EventoSanitario.loteProduto`) e o estoque tem só `setor`. Falta gestão estruturada de **lotes com validade** e de **locais físicos de armazenamento** — o produtor não consegue ver "quais lotes estão vencendo" nem organizar por local.

## 2. Objetivo / decisão entregue

- **Locais de armazenamento** (cadastro: nome, ex.: "Galpão 1", "Farmácia").
- **Lotes de produto** (código + validade + local + produto) com uma leitura que sinaliza **vencidos / a vencer**.

## 3. Não-objetivos (YAGNI)

- Sem reescrever o motor de MovimentoEstoque para rastrear saldo por lote/local (grande e arriscado) — os lotes são um cadastro/registro paralelo, não o razão de estoque.
- Sem baixa automática por lote (FIFO/FEFO) — fica para quando o razão por lote existir.

## 4. Arquitetura

### 4.1 Schema (aditivo)

- `LocalArmazenamento` — `nome`, `ativo`, `propriedadeId?`.
- `LoteProduto` — `produtoId` (FK), `codigo`, `validade? @db.Date`, `localId?` (FK), `quantidade? @db.Decimal`, `propriedadeId?`. Inverses em `Produto`/`Propriedade`/`LocalArmazenamento`.

### 4.2 Cálculo puro (TDD)

`lote.calc.ts` — `statusValidade(validade, hoje, alertaDias=30)`: `vencido` (validade < hoje), `a-vencer` (≤ alertaDias), `ok`, `sem-validade`. + `agruparLotes(lotes, hoje)`: contagem por status. Determinístico.

### 4.3 Serviço + rota

`lotes.ts` — CRUD de local + CRUD de lote + `listar` (com status de validade calculado). Rotas: `GET/POST/DELETE /rebanho/locais-armazenamento`; `GET/POST/DELETE /rebanho/lotes-produto`.

### 4.4 Frontend

- `api.ts` — DTOs + hooks + funcs.
- `LotesProdutoSection.tsx` — na aba Estoque: lista de lotes com validade (vencidos/a-vencer destacados) + cadastro; gestão de locais.

## 5. Testes & entrega

- Vitest: `lote.calc.test.ts` (status por data; agrupamento; sem validade; limites).
- Smoke local (Postgres): cria local + lote vencido + lote ok → confere status → limpa.
- Build verde + suítes. PR único.

## 6. Reúso

`Produto`, padrão catálogo, calc-puro-TDD, aba Estoque.
