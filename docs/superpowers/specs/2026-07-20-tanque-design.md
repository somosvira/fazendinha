# Tanque + análise de tanque — Design

**Data:** 2026-07-20
**Fatia:** IDEagri-gaps (prioridade média). Produção/Qualidade.
**Relacionado:** análise de leite individual (#173, F4); `docs/design/ideagri-gaps.md` "Tanque + análise de tanque".

## 1. Problema

A F4 (#173) fez a análise de leite **individual** (CCS por vaca). Falta a qualidade do leite **do tanque** (bulk): o laticínio paga por CCS/CBT do tanque, então o produtor precisa cadastrar tanques de resfriamento e acompanhar a análise de tanque ao longo do tempo. O IDEagri tem "Tanque" + "Análise de tanque".

## 2. Objetivo / decisão entregue

- **Cadastro de tanques** de resfriamento (nome, capacidade em litros).
- **Análise de tanque**: registrar amostras (data, CCS, CBT, gordura, proteína, temperatura) por tanque + ver a tendência.

## 3. Não-objetivos (YAGNI)

- Sem integração com o laticínio/planilha de pagamento.
- Sem alerta automático de CBT/CCS fora do padrão (fica para quando houver meta configurada).

## 4. Arquitetura

### 4.1 Schema (aditivo)

- `Tanque` — `nome`, `capacidadeLitros?`, `ativo`, `propriedadeId?`.
- `AnaliseTanque` — `tanqueId`, `data`, `ccs?`, `cbt?` (contagem bacteriana total), `gordura?`, `proteina?`, `temperatura?`, `observacao?`. Cascade no tanque.

### 4.2 Cálculo puro (TDD)

`analise-tanque.calc.ts` — `agregarTanque(analises)`: última leitura (CCS/CBT/gordura/proteína), tendência de CCS e de CBT por data (série ordenada), média. Determinístico.

### 4.3 Serviço + rota

`tanque.ts` — CRUD de tanque + registrar/listar análise + `resumo` (via calc). Rotas: `GET/POST /rebanho/tanques`, `DELETE /rebanho/tanques/:id`, `GET/POST /rebanho/tanques/:id/analises`.

### 4.4 Frontend

- `api.ts` — DTOs + hooks.
- `TanquesSection.tsx` — na aba Produção (abaixo da qualidade individual): lista de tanques, registrar análise, tendência de CCS/CBT + últimos valores.

## 5. Testes & entrega

- Vitest: `analise-tanque.calc.test.ts` (última leitura; tendência ordenada; ignora nulos; vazio).
- Smoke local (Postgres): cria tanque → 2 análises → resumo (tendência + última) → limpa.
- Build verde + suítes.
- PR único.

## 6. Reúso

Padrão catálogo configurável (Tanque) + fato (AnaliseTanque), calc-puro-TDD, `MiniBarChart`, aba Produção.
