# Alteração coletiva de animais (bulk) — Design

**Data:** 2026-07-20
**Fatia:** IDEagri-gaps (prioridade média). Rebanho.
**Relacionado:** movimentação de lote/setor (#172, `registrarMovimentacoes`); `docs/design/ideagri-gaps.md` "Alteração coletiva".

## 1. Problema

Editar N animais um a um é lento. O IDEagri tem "alteração coletiva" — aplicar uma mudança (mover de lote/setor) a vários animais de uma vez. Hoje só dá para editar animal a animal.

## 2. Objetivo / decisão entregue

Um painel de **alteração coletiva** na aba Animal: seleciona vários animais (por checkbox, filtrando por grupo/setor) e aplica um novo **grupo** e/ou **setor** a todos de uma vez — gravando o histórico de movimentação de cada um (reusa #172).

## 3. Não-objetivos (YAGNI)

- Só grupo/setor no bulk (os campos de maior valor operacional). Não faz bulk de raça/nascimento/etc.
- Sem checkbox retrofit no HerdDomainView (lista compartilhada) — o painel tem sua própria lista leve com seleção.
- Sem baixa/exclusão em massa.

## 4. Arquitetura

### 4.1 Schema

Nenhuma mudança.

### 4.2 Serviço + rota

`alterarColetivo(animalIds, { grupoId?, setor? })` (em `animais.ts`):
- valida que os animais existem; para cada um, aplica a mudança numa transação e chama `registrarMovimentacoes` (mesma lógica do `editarAnimal`) para gravar o fato histórico de troca de lote/setor.
- retorna `{ atualizados, movimentacoes }`.
- Respeita escopo de escrita.

`PATCH /rebanho/animais/bulk` — `{ animalIds: number[], grupoId?: number | null, setor?: string | null }` (ao menos um de grupoId/setor). Schema Zod.

### 4.3 Frontend

- `api.ts` — `alterarAnimaisColetivo(animalIds, patch)`.
- `AlteracaoColetivaPanel.tsx` — na aba Animal (botão "Alteração coletiva"): filtra por grupo/setor, lista os animais com checkbox (+ "selecionar todos"), escolhe grupo/setor de destino, aplica. Mostra o resultado.

## 5. Testes & entrega

- Vitest: calc puro `bulk.calc.ts` — `montarPatchBulk({grupoId?, setor?})` valida que há ao menos um campo e normaliza; testes de "nada a mudar" e "só setor".
- Smoke local (Postgres): move 2 animais de setor em massa → confere setor + 2 movimentações → restaura.
- Build verde + suítes.
- PR único.

## 6. Reúso

`registrarMovimentacoes` (#172), `editarAnimal` (mesmo padrão de captura), `listarAnimais`.
