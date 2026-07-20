# Desmama / desaleitamento como evento — Design

**Data:** 2026-07-20
**Fatia:** IDEagri-gaps (prioridade média). Rebanho.
**Relacionado:** worklist "a desmamar" (`lib/worklists.ts`); reusa o pipeline de `EventoReprodutivo` (como #170). `docs/design/ideagri-gaps.md` "Desmama/desaleitamento como evento".

## 1. Problema

Hoje o desmame é só um **proxy por categoria/idade/peso** (worklist "a desmamar", parâmetros DESMAME_MODO/DIAS/PESO_KG). Quando o bezerro é desmamado, não há **fato/evento** com data — a informação some quando o animal é recategorizado. O produtor não consegue responder "quando essa bezerra foi desmamada".

## 2. Objetivo / decisão entregue

Registrar o **desmame como evento** na timeline do animal (com data e peso opcional). Vira um fato histórico permanente, não um proxy.

## 3. Não-objetivos (YAGNI)

- Sem alterar a worklist "a desmamar" para excluir animais com evento DESMAME (a recategorização já tira da lista; a exclusão por evento é uma continuação registrada — exige threading do evento no calc da worklist).
- Sem efeito em recompute (é fato de ciclo, como EXAME_GINECOLOGICO — passa inócuo pelo `recomputarAnimal`).

## 4. Arquitetura

Reusa `EventoReprodutivo` + `registrarEvento` genérico (mesmo padrão do #170).

### 4.1 Schema

Enum `TipoEventoReprodutivo` ganha `DESMAME`. Sem novos campos — o peso opcional do desmame é guardado no campo já existente `EventoReprodutivo.resultado` (String livre), como "190". O mapper formata. (Sem migration de coluna nova.)

### 4.2 Schema Zod + mapper

- `criarEventoSchema` += `{ tipo: "DESMAME", data, observacao?, pesoKg?: number }` — `pesoKg` mapeia para `resultado` (string).
- `eventos.mappers` — case DESMAME: título "Desmame" + "· {peso} kg" quando houver.
- `registrarEvento` já é genérico (spread `input as any`); `recomputarAnimal` não muda.

### 4.3 Frontend

- `EventoForm` — novo tipo "Desmame" (domínio reprodução) com campo peso opcional.
- Timeline renderiza via mapper automaticamente.
- `api.ts` — `DESMAME` no union de `EventoPayload.tipo` + `pesoKg?`.

## 5. Testes & entrega

- Vitest: `eventos.schemas.test.ts` (DESMAME aceito; pesoKg opcional), `eventos.mappers.test.ts` (título/peso).
- Smoke local (Postgres): registra desmame num animal → confere na timeline.
- Build verde + suítes.
- PR único.

## 6. Reúso

`EventoReprodutivo` + `registrarEvento` + `toTimeline` + `EventoForm` (#170).
