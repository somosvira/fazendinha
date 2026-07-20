# Grau de cruzamento — Design

**Data:** 2026-07-20
**Fatia:** IDEagri-gaps (prioridade média, `GRAUCRUZAMENTO` 32). Genética.
**Relacionado:** `client/src/rebanho/lib/sangue.ts` (já existe: frações + builder + parser); `docs/design/ideagri-gaps.md` "Grau de cruzamento".

## 1. Problema

O grau de sangue (`grauSangue`, ex.: "5/8 GL, HO") **já é capturado** no cadastro do animal (AnimalForm usa `lib/sangue.ts`), mas: (a) **não é exibido** — o cockpit mostra a raça, nunca o grau; (b) não há **visão de rebanho por grau de cruzamento** — o produtor não vê o perfil de cruzamento do plantel (quantas 1/2, 3/4, puras…). O IDEagri tem `GRAUCRUZAMENTO` como lookup.

## 2. Objetivo / decisão entregue

- Mostrar o grau de sangue no cockpit do animal (junto da raça).
- Uma **composição do rebanho por grau de cruzamento** (distribuição por fração de sangue) na aba Carteira.

## 3. Não-objetivos (YAGNI)

- Sem novo cadastro/tabela de graus — a fração vem do texto de `grauSangue` (o `lib/sangue.ts` já normaliza). Puro/sem grau = "Puro".
- Sem cálculo de heterose/ganho genético (isso é o motor de acasalamento, M11).

## 4. Arquitetura

### 4.1 Schema

Nenhuma mudança — `Animal.grauSangue String?` já existe.

### 4.2 Cálculo puro (TDD)

`composicao-racial.calc.ts` — `agruparPorGrau(animais: { grauSangue: string | null }[])`:
- extrai a **fração** de cada grau (regex `^(\d+/\d+)`), rotulando `null`/sem-fração como "Puro / sem grau";
- devolve a distribuição ordenada por contagem desc (`[{ grau, quantidade, pct }]`) + total.

### 4.3 Serviço + rota

`composicao-racial.ts` — lê `Animal` ativo no escopo (`grauSangue`), chama o calc. `GET /rebanho/composicao-racial`.

### 4.4 Frontend

- Cockpit: `AnimalCockpit` mostra `· grau {grauSangue}` na linha de subtítulo (quando houver).
- `api.ts` — `ComposicaoRacialDTO` + `useComposicaoRacial`.
- `ComposicaoRacialSection.tsx` — barra/lista de distribuição por grau, na aba Carteira.

## 5. Testes & entrega

- Vitest: `composicao-racial.calc.test.ts` (extrai fração; agrupa; "Puro" para null/sem-fração; ordena desc; pct).
- Smoke local (Postgres): roda contra o rebanho real e confere a distribuição.
- Build verde + suítes.
- PR único.

## 6. Reúso

`lib/sangue.ts` (frações), `CarteiraTab` (home do painel), padrão calc-puro-TDD + rota fina.
