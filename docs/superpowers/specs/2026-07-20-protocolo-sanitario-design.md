# Protocolo sanitário + aplicação por animal — Design

**Data:** 2026-07-20
**Fatia:** IDEagri-gaps (prioridade média, 9 protocolos / 0 aplicações). Sanidade.
**Relacionado:** catálogo IATF (#163) + aplicação (#171) — mesmo padrão; agenda unificada (#183); `docs/design/ideagri-gaps.md` "Protocolo sanitário / aplicação por animal".

## 1. Problema

O IDEagri tem um catálogo de **protocolos sanitários** (9 protocolos — sequências de manejos sanitários: vacinas/tratamentos com offset de dias) e a aplicação por animal (0 aplicadas na 777). Hoje não temos isso — vacinas são agendadas uma a uma (#160), sem protocolo reutilizável.

## 2. Objetivo / decisão entregue

Um **catálogo de protocolos sanitários** (nome + etapas D0/D+n com ação e produto) + aplicar a um animal a partir de um D0, com a agenda derivada. Espelha a estrutura do IATF (#163/#171) para o domínio sanitário.

## 3. Não-objetivos (YAGNI)

- Sem aplicar por lote nesta fatia (o IATF-lote é #171; o sanitário-lote entra numa continuação se houver demanda).
- Sem materializar as etapas como VacinaAgendada automaticamente (a agenda é derivada; a integração com a agenda de manejos #183 fica registrada como continuação).

## 4. Arquitetura

### 4.1 Schema (aditivo)

Espelha ProtocoloIATF/EtapaProtocoloIATF/AplicacaoProtocoloIATF:
- `ProtocoloSanitario` — `nome`, `descricao?`, `ativo`, `propriedadeId?`.
- `EtapaProtocoloSanitario` — `protocoloId`, `dia` (offset D0), `acao`, `produto?`, `ordem`.
- `AplicacaoProtocoloSanitario` — `animalId`, `protocoloId`, `dataInicio` (@db.Date), `observacao?`, `propriedadeId?`.

### 4.2 Cálculo

Reusa `agendarEtapas`/`ordenarEtapas` de `iatf.calc.ts` (offset de dias a partir do D0 é idêntico) — sem calc novo. A agenda de cada aplicação = `agendarEtapas(etapas, dataInicio)`.

### 4.3 Serviço + rota

`protocolo-sanitario.ts` — CRUD do catálogo (excluir em uso só inativa) + aplicar/listar/excluir aplicação por animal. Rotas espelham as do IATF:
- `GET/POST /rebanho/protocolos-sanitarios`, `PATCH/DELETE /:id`.
- `GET/POST /rebanho/animais/:id/protocolo-sanitario`, `DELETE /rebanho/protocolos-sanitarios/aplicacoes/:id`.

### 4.4 Frontend

- `api.ts` — DTOs + hooks + funcs (espelham os do IATF).
- `ProtocolosSanitarios.tsx` (catálogo, na aba Sanidade) + `ProtocoloSanitarioSection.tsx` (aplicação no cockpit, espelha IatfSection).

## 5. Testes & entrega

- Vitest: `protocolo-sanitario.schemas.test.ts` (etapas válidas; aplicar). O agendamento já é coberto por `iatf.calc.test.ts` (reuso).
- Smoke local (Postgres): cria protocolo D0/D+21 → aplica num animal → confere a agenda derivada → exclui.
- Build verde + suítes.
- PR único.

## 6. Reúso

`agendarEtapas`/`ordenarEtapas` (#163), padrão catálogo+aplicação do IATF, aba Sanidade + cockpit.
