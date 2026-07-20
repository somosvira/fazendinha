# Análise de leite (qualidade) — tela dedicada / tendência de CCS — Design

**Data:** 2026-07-20
**Fatia:** IDEagri-gaps #4 (prioridade alta, dado 777: `ANALISELEITE` 467). Produção/Qualidade.
**Relacionado:** `docs/design/ideagri-gaps.md` linha 22.

## 1. Problema

CCS/gordura/proteína já entram como evento EXAME (`EventoSanitario` com `ccs`/`gordura`/`proteina`), mas não há **tela de qualidade**: não dá para ver a **tendência de CCS** do rebanho ao longo do tempo, a distribuição por faixa, nem quem está pior. O IDEagri tem `ANALISELEITE` (467 na 777).

## 2. Objetivo / decisão entregue

Uma **seção dedicada de qualidade** na aba Produção: CCS médio atual + gordura/proteína médias, **tendência de CCS por mês** (média do rebanho), **distribuição por faixa** (da leitura mais recente de cada vaca) e o **ranking dos piores CCS**.

## 3. Não-objetivos (YAGNI)

- Sem schema novo — a fonte já existe (`EventoSanitario` tipo EXAME).
- Sem análise de tanque/bulk (é outra fatia; aqui é CCS individual agregado).
- Sem registrar exame por aqui (o registro já existe no fluxo de sanidade).

## 4. Arquitetura

### 4.1 Cálculo puro (TDD)

`analise-leite.calc.ts`:
- `classificarCCS(ccs)` → faixa EXCELENTE (<200) / ATENCAO (200–399) / ALARME (≥400) — mesmos limiares do cockpit.
- `agregarAnaliseLeite(leituras)` → tendência de CCS por mês (YYYY-MM, média do rebanho), distribuição por faixa e médias/piores **a partir da leitura mais recente de cada animal**, médias de gordura/proteína (todas as leituras). Determinístico, sem I/O.

### 4.2 Serviço + rota

`analise-leite.ts` — lê `EventoSanitario` tipo EXAME com ccs/gordura/proteína (escopo por `animal.propriedadeId`), chama o calc, enriquece os piores com número/nome (top 10).
`GET /rebanho/producao/analise-leite` (escopo de leitura).

### 4.3 Frontend

- `api.ts` — `AnaliseLeiteDTO` + `useAnaliseLeite`.
- `QualidadeLeiteSection.tsx` — KPIs (CCS médio, gordura, proteína) + tendência de CCS (`MiniBarChart` reusado) + barra de distribuição por faixa + lista dos piores CCS.
- Entra no fim da `ProducaoTab` (todos os modos).

## 5. Testes & entrega

- Vitest: `analise-leite.calc.test.ts` (faixas, tendência por mês, distribuição pela leitura mais recente, médias que ignoram nulos, piores desc).
- Smoke local (Postgres): 467 exames reais → 127 vacas, tendência 5 meses, distribuição, invariante soma==animaisComLeitura.
- Build verde nos 2 workspaces + suítes completas.
- PR único.

## 6. Reúso

`EventoSanitario` (fonte), `MiniBarChart`/`RebKpi`, os limiares de CCS do cockpit, o padrão calc-puro-TDD + rota fina.
