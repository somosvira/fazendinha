# Agenda de eventos / manejos futuros (calendário unificado) — Design

**Data:** 2026-07-20
**Fatia:** IDEagri-gaps (prioridade média). Sanidade/Reprodução.
**Relacionado:** vacinação agendada (#160, `VacinaAgendada`); programação IATF por lote (#171, `ProgramacaoIATFLote`); `docs/design/ideagri-gaps.md` "Agenda de eventos / manejos futuros".

## 1. Problema

Os manejos futuros hoje vivem em silos: vacinas agendadas (#160) e etapas de protocolo IATF por lote (#171) cada um na sua tela. Falta um **calendário unificado** — o produtor quer bater o olho e ver TUDO que vem pela frente (e o que atrasou), em ordem de data.

## 2. Objetivo / decisão entregue

Uma **agenda unificada de manejos**: junta as vacinas agendadas pendentes + as próximas etapas das programações IATF de lote num só calendário ordenado por data, marcando **atrasado** (data < hoje) vs **futuro**, com o animal/lote e a ação.

## 3. Não-objetivos (YAGNI)

- Sem criar/editar manejos por aqui (a agenda é uma VISÃO agregada; o registro continua nas telas de origem).
- Sem exames/protocolos sanitários (o protocolo sanitário é a M9; quando existir, entra na agenda numa continuação).
- Sem schema novo — só lê fontes existentes.

## 4. Arquitetura

### 4.1 Cálculo puro (TDD)

`agenda.calc.ts` — `montarAgenda(itens, hoje)`: recebe itens já normalizados de cada fonte (`{ tipo, data, titulo, alvo }`) e devolve a lista **ordenada por data asc** com `status` (`atrasado` se data < hoje, senão `futuro`) e `diasParaData`. Determinístico.

### 4.2 Serviço + rota

`agenda.ts` — lê:
- `VacinaAgendada` pendentes (aplicadaEm null) do escopo → item `{ tipo: "VACINA", data: dataPrevista, titulo: vacina, alvo: "#numero" }`.
- `ProgramacaoIATFLote` do escopo → para cada uma, a **próxima etapa** (via `proximaEtapa`/`resumoProgramacao`) vira um item `{ tipo: "IATF", data, titulo: "D<n> — ação", alvo: lote }` (só as não concluídas).

Chama o calc. `GET /rebanho/agenda?dias=<janela>` (default: tudo; janela opcional filtra o futuro).

### 4.3 Frontend

- `api.ts` — `AgendaItemDTO` + `useAgenda`.
- `AgendaSection.tsx` — lista o calendário unificado (atrasados destacados no topo), na aba Sugestões/Hoje do rebanho (ou uma seção própria). Reusa o cockpit "Hoje".

## 5. Testes & entrega

- Vitest: `agenda.calc.test.ts` (ordena por data; marca atrasado/futuro; diasParaData; vazio).
- Smoke local (Postgres): monta a agenda real (vacinas + IATF) e confere a ordenação.
- Build verde + suítes.
- PR único.

## 6. Reúso

`VacinaAgendada` + `ProgramacaoIATFLote` + `proximaEtapa`/`resumoProgramacao` (#171), calc-puro-TDD, aba Sugestões.
