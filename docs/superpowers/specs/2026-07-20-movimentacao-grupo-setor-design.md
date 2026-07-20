# Movimentação de grupo/setor como fato histórico — Design

**Data:** 2026-07-20
**Fatia:** IDEagri-gaps #3 (prioridade alta, dado 777: `MOVGRUPOANIMAL` 1504 + `MOVSETORANIMAL` 289). Rebanho.
**Relacionado:** `docs/design/ideagri-gaps.md` linha 21.

## 1. Problema

Hoje o `Animal` guarda só o **estado atual** (`grupoId`, `setor`). Quando o produtor troca a vaca de lote/setor, o valor anterior é sobrescrito e se perde — não dá para responder "onde a vaca esteve" nem auditar movimentações. O IDEagri modela isso em `MOVGRUPOANIMAL` (1504) e `MOVSETORANIMAL` (289).

## 2. Objetivo / decisão entregue

Capturar cada troca de lote/setor como **fato histórico** (`MovimentacaoAnimal`), gravado automaticamente quando o cadastro do animal muda de grupo ou setor, e mostrar o histórico ("onde a vaca esteve") no cockpit.

## 3. Não-objetivos (YAGNI)

- Sem tela de "mover N animais em massa" (isso é a feature "alteração coletiva", outra fatia).
- Sem editar/excluir uma movimentação (é log histórico; imutável).
- Sem UI de "motivo" no form de edição nesta fatia — o campo `motivoMovimentacao` existe no schema/API para um futuro fluxo de "mover animal", mas o form atual grava `motivo: null`.

## 4. Arquitetura

### 4.1 Schema (aditivo)

`MovimentacaoAnimal` unifica MOVGRUPO/MOVSETOR num só fato com `tipo` (enum `TipoMovimentacaoAnimal` = GRUPO|SETOR). Guarda **snapshots de rótulo** (`origem`/`destino`) — sobrevivem a rename/exclusão do grupo — mais `grupoOrigemId`/`grupoDestinoId` para o tipo GRUPO. `origem` null = primeira alocação. Inverse em `Animal` e `Propriedade`. `data` `@db.Date`.

### 4.2 Cálculo puro (TDD)

`movimentacao.calc.ts` — `diffMovimentacoes(atual, edicao)`: recebe o estado de alocação atual e a edição, devolve a lista de fatos a gravar (0, 1 ou 2). Só gera fato quando o valor **muda** (`undefined` = não mexe). Grupo antes de setor. Determinístico, sem I/O.

### 4.3 Serviço

`movimentacao.ts`:
- `registrarMovimentacoes(tx, animalId, atual, edicao, opts)` — grava os fatos do diff dentro da transação de `editarAnimal` (recebe `tx`); no-op quando não houve troca.
- `listarMovimentacoes(animalId)` — histórico desc (data, depois id).

`editarAnimal` (animais.ts) passa a: buscar o grupoNome atual + resolver o grupoNome de destino, e envolver o `update` numa transação que também chama `registrarMovimentacoes`.

### 4.4 Rota fina

`GET /rebanho/animais/:id/movimentacoes` (no animaisRouter). Escopo pelo id do animal (como `/lactacoes`).

### 4.5 Frontend

- `api.ts` — `MovimentacaoDTO` + `listarMovimentacoes` + `useMovimentacoes`.
- `MovimentacoesSection.tsx` — seção só-leitura no cockpit ("Movimentações de lote/setor"): timeline data · tipo · origem→destino · motivo.
- Entra no stack de seções do `AnimalCockpit`.

## 5. Testes & entrega

- Vitest: `movimentacao.calc.test.ts` (sem mudança / troca grupo / troca setor / ambos / primeira alocação / undefined não conta / esvaziar).
- Smoke local (Postgres): move grupo+setor → 2 fatos; editar sem trocar → 0; restaura.
- Build verde nos 2 workspaces + suítes completas.
- PR único.

## 6. Reúso

`editarAnimal` (ponto de captura), `resolverEscopo*`, o stack de `*Section` do cockpit, o padrão calc-puro-TDD.
