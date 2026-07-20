# Indução de lactação — Design

**Data:** 2026-07-20
**Fatia:** IDEagri-gaps (prioridade média). Produção.
**Relacionado:** histórico de lactações (#146–147); `docs/design/ideagri-gaps.md` "Indução de lactação".

## 1. Problema

O IDEagri marca lactações **induzidas** (`LACTACAO.INDUZIDA`) — quando a vaca é levada à lactação por protocolo hormonal, sem parto. Hoje o campo `induzida` já existe no schema `Lactacao` (default false), mas **não é lido nem editável** — nasce sempre `false` e não aparece em lugar nenhum.

## 2. Objetivo / decisão entregue

Expor `induzida` no histórico de lactações e permitir **marcar/desmarcar** uma lactação como induzida (decisão de manejo, feita depois do registro). Badge "induzida" na seção de lactações.

## 3. Não-objetivos (YAGNI)

- Sem fluxo de "criar lactação induzida do zero" (a lactação nasce do PARTO; a indução é um atributo marcado à parte). Se o produtor precisar de uma lactação sem parto, é outra fatia.
- Sem efeito em cálculo de produção/305 — é só um rótulo classificatório.

## 4. Arquitetura

### 4.1 Schema

Nenhuma mudança — `Lactacao.induzida Boolean @default(false)` já existe.

### 4.2 Serviço + rota

- `LactacaoDTO` ganha `induzida: boolean` (lido do row).
- `marcarInducao(lactacaoId, induzida)` — update simples do flag. Erro `NAO_ENCONTRADO`.
- `PATCH /rebanho/lactacoes/:id` — `{ induzida: boolean }`.

### 4.3 Frontend

- `api.ts` — `induzida` no `LactacaoDTO` + `marcarInducaoLactacao(id, induzida)`.
- `LactacoesSection.tsx` — badge "induzida" quando `l.induzida`; botão "marcar/desmarcar induzida" por lactação.

## 5. Testes & entrega

- Vitest: teste do mapper/serviço não faz sentido isolado (é update trivial) — cobre-se via o teste de rota/serviço existente de lactação se houver; senão, smoke.
- Smoke local (Postgres): marca uma lactação como induzida → confere no read → desmarca.
- Build verde nos 2 workspaces + suítes completas.
- PR único.

## 6. Reúso

`listarLactacoes` + `LactacoesSection` (#146), padrão rota fina.
