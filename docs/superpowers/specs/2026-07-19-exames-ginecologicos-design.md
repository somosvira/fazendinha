# Exames ginecológicos — Design

**Data:** 2026-07-19
**Fatia:** IDEagri-gaps #1 (prioridade alta, dado 777: 248). Reprodução.
**Relacionado:** `docs/design/ideagri-gaps.md`; reusa o pipeline de `EventoReprodutivo`.

## 1. Problema

O IDEagri tem `EXAMEANIMAL` (248 linhas na 777) — exames reprodutivos por animal (palpação/US: estado de útero/ovário, presença de CL, cisto, gestação). Hoje não registramos isso: o produtor faz o exame ginecológico na vaca mas não tem onde lançar o achado, e não há work-list de "quem precisa de exame".

## 2. Objetivo / decisão entregue

Registrar o **exame ginecológico** como evento reprodutivo estruturado (achado clínico do trato) na timeline do animal, e entregar a work-list **"precisa de exame"** — vacas vazias/pós-parto sem exame recente — para o produtor saber quem chamar o veterinário/inseminador.

## 3. Não-objetivos (YAGNI)

- Sem tabela `EXAMEANIMAL` dedicada — reusa `EventoReprodutivo` (o campo `resultado` já existe).
- Sem integração com US/aparelho.
- O achado não altera lactação/status reprodutivo (é diagnóstico, não fato estrutural) — passa inócuo pelo `recomputarAnimal` (que só reage a PARTO/SECAGEM).

## 4. Arquitetura

Reusa `EventoReprodutivo` com novo tipo de enum. Segue o pipeline existente: schema Zod → `registrarEvento` (genérico) → mapper de timeline. Cálculo puro novo só para a work-list.

### 4.1 Schema

Enum `TipoEventoReprodutivo` ganha `EXAME_GINECOLOGICO`. **Sem novos campos** — usa:
- `resultado` — achado clínico (dicionário, ver §4.2).
- `observacao` — texto livre.
- `protocolo` — reusado opcionalmente para a estrutura/método (ex.: "US", "palpação").

### 4.2 Dicionário de achados (`ACHADOS_GINECOLOGICOS`)

Enum de string validado no Zod (espelha `RESULTADOEXAMEGINECOLOGICO` do IDEagri, 44 linhas, condensado nos achados operacionais):
`CICLANDO`, `CIO`, `CORPO_LUTEO`, `GESTANTE`, `ANESTRO`, `CISTO_FOLICULAR`, `CISTO_LUTEO`, `ENDOMETRITE`, `INDEFINIDO`.

Achados que pedem ação viram `alerta: true` na timeline: `ANESTRO`, `CISTO_FOLICULAR`, `CISTO_LUTEO`, `ENDOMETRITE`.

## 5. Backend

- `eventos.schemas.ts` — novo membro do discriminatedUnion: `{ tipo: "EXAME_GINECOLOGICO", data, observacao?, resultado: enum(ACHADOS), metodo?: string }`. (`metodo` mapeia para o campo `protocolo`.)
- `eventos.mappers.ts` — case `EXAME_GINECOLOGICO`: título "Exame ginecológico — {achado}", alerta nos achados acima.
- `eventos.ts` (`registrarEvento`) — já é genérico; só precisa aceitar o novo tipo (spread via `input as any`). `recomputarAnimal` não precisa mudar.
- **Work-list** `precisa-de-exame` — cálculo puro `worklist-exame.calc.ts` (TDD): dado {statusReprodutivo, del, ultimoExameGinecologico}, sinaliza vacas **vazias/pós-PEV** (ou pós-parto além de X dias) **sem** exame ginecológico nos últimos `EXAME_VALIDADE_DIAS` (default 60). Exposta como nova chave de worklist no router de worklists.

## 6. Frontend

- `EventoForm.tsx` — novo tipo "Exame ginecológico" com select de achado + campo método.
- Timeline já renderiza via mapper (novo case aparece automaticamente).
- `api.ts` — tipo do payload + a nova chave de worklist `precisa-de-exame` (com ação → registrar exame).

## 7. Testes & entrega

- Vitest: `eventos.schemas.test.ts` (novo tipo aceito/rejeitado), `eventos.mappers.test.ts` (título/alerta), `worklist-exame.calc.test.ts` (sinaliza/ignora).
- Smoke local: registra exame ginecológico num animal e confere na timeline.
- Build verde nos 2 workspaces + suítes completas.
- PR único.

## 8. Reúso

`EventoReprodutivo` + `registrarEvento` + `toTimeline` + pipeline de worklists (`WorklistCanonica`, chaves) + `EventoForm`.
