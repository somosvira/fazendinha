# Recomendação de acasalamento — Design

**Data:** 2026-07-20
**Fatia:** IDEagri-gaps (prioridade média). Genética. **Depende da M10** (biblioteca de reprodutores, #185).
**Relacionado:** biblioteca de reprodutores (#185); `docs/design/ideagri-gaps.md` "Recomendação/medida de acasalamento".

## 1. Problema

Com a biblioteca de reprodutores (#185) pronta, falta o **motor de cruzamento dirigido**: dado uma vaca, recomendar os melhores touros — buscando ganho genético (PTA/TPI) e evitando consanguinidade (não cruzar com o próprio pai). O IDEagri tem "Recomendação/medida de acasalamento".

## 2. Objetivo / decisão entregue

Para uma vaca, um **ranking de touros recomendados** do catálogo: cada um com um score (mérito genético normalizado) e uma flag de consanguinidade (excluído/penalizado quando o touro é o pai da vaca). Read-only, derivado — sem materializar acasalamentos.

## 3. Não-objetivos (YAGNI)

- Consanguinidade só pelo pai direto (`paiNome`) — sem árvore genealógica completa (não temos avós de forma estruturada).
- Sem "medida de acasalamento" materializada (registrar o cruzamento planejado) — é continuação; aqui é a recomendação.
- Sem otimização de plantel inteiro (é por vaca).

## 4. Arquitetura

### 4.1 Cálculo puro (TDD)

`acasalamento.calc.ts` — `recomendar(vaca, reprodutores)`:
- normaliza PTA leite e TPI de cada touro para [0,1] (min-max sobre o catálogo) e combina num `score` (média das métricas disponíveis).
- marca `consanguineo: true` quando o nome/código do touro bate com o `paiNome` da vaca (case-insensitive) → excluído do topo (score zerado + flag).
- devolve a lista ordenada por score desc (não-consanguíneos primeiro), com `motivo` (ex.: "alto PTA leite", "melhor TPI", "consanguíneo — evitar").

### 4.2 Serviço + rota

`acasalamento.ts` — lê a vaca (`paiNome`) + a biblioteca de reprodutores do escopo, chama o calc. `GET /rebanho/animais/:id/acasalamento`.

### 4.3 Frontend

- `api.ts` — `RecomendacaoAcasalamentoDTO` + `useAcasalamento`.
- `AcasalamentoSection.tsx` — no cockpit: top touros recomendados com score e motivo; consanguíneos sinalizados.

## 5. Testes & entrega

- Vitest: `acasalamento.calc.test.ts` (ranking por score; normalização; consanguíneo excluído/penalizado; catálogo vazio; sem PTAs).
- Smoke local (Postgres): cria touros + uma vaca → recomenda → confere ranking e consanguinidade → limpa.
- Build verde + suítes.
- PR único.

## 6. Reúso

Biblioteca de reprodutores (#185), `Animal.paiNome`, calc-puro-TDD, cockpit.
