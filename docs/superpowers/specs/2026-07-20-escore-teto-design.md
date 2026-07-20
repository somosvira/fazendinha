# Escore de teto (hiperqueratose) — Design

**Data:** 2026-07-20
**Fatia:** IDEagri-gaps (prioridade média). Sanidade.
**Relacionado:** saúde de úbere por quarto (#168, `ExameQuarto`); `docs/design/ideagri-gaps.md` "Escore de teto".

## 1. Problema

A saúde de úbere por quarto (#168) modela CMT/mastite por teta, mas **não o escore de teto** (hiperqueratose da ponta do teto — grau 1 a 4, indicador de dano por ordenha/vácuo). O produtor não consegue avaliar/acompanhar a condição da ponta do teto, que é um preditor de mastite.

## 2. Objetivo / decisão entregue

Registrar o **escore de teto** (1–4) por quarto, na mesma passada do CMT, e mostrá-lo no mapa de úbere.

## 3. Não-objetivos (YAGNI)

- Sem análise/tendência dedicada do escore de teto (é um atributo por quarto; a leitura mais recente basta por ora).
- Sem regra de sugestão automática a partir do escore (fica para quando houver dado).

## 4. Arquitetura

### 4.1 Schema (aditivo)

`ExameQuarto` ganha `escoreTeto Int?` (1–4, hiperqueratose; null = não avaliado). Nullable → retrocompatível.

### 4.2 Schema Zod + serviço

- `quartoSchema` += `escoreTeto: z.number().int().min(1).max(4).optional()`.
- O serviço `registrarExameQuarto` já grava os campos do quarto — só passar `escoreTeto`.
- A leitura do estado do quarto (`quarto.recompute`/saúde de úbere) inclui o `escoreTeto` da leitura mais recente.

### 4.3 Frontend

- `api.ts` — `escoreTeto` no `QuartoInput` + no `EstadoQuarto` (leitura).
- `SaudeUbereSection` — campo de escore de teto (1–4) por quarto na passada; e exibição do escore no mapa de úbere.

## 5. Testes & entrega

- Vitest: `exames-quarto.schemas.test.ts` (escoreTeto 1–4 aceito; fora da faixa rejeitado).
- Smoke local (Postgres): registra passada com escore de teto → confere na leitura do quarto.
- Build verde + suítes.
- PR único.

## 6. Reúso

`ExameQuarto` + `registrarExameQuarto` + `SaudeUbereSection` (#168), padrão schema+serviço+front.
