# Score do Rebanho (Carteira) — V2 fatia 1

**Data:** 2026-07-19
**Módulo:** rebanho
**Status do roadmap:** V2 §5.2 ("Score 0–100 do rebanho" como portfólio) — primeira fatia.

## Problema

O **score por animal** já existe (`server/src/services/rebanho/insights.ts`: `ScoreDTO` 0–100, classificação ELITE→DESCARTE, 6 fatores ponderados). O que **não existe** é a visão agregada do **rebanho como carteira**: distribuição por classificação, ranking das melhores/piores, e a simulação "descartar as N piores → impacto na margem/dia". Este é o objetivo §5.2 do V2.

## Escopo desta fatia

- Painel "Carteira" (nova sub-aba `reb-carteira`) com: distribuição por classificação, KPIs (score médio, nº ELITE, nº DESCARTE), ranking top/bottom N, e slider de **simulação de descarte** (Δ margem/dia, litros que saem, CCS antes/depois).
- **Determinístico** (sem ML, sem treino, sem migration). Reusa o score por animal e o motor de custo vaca/dia (#164).

### Fora de escopo (fatias futuras do V2)

- Payback de reposição na simulação de descarte (§5.2 menciona; fica para depois).
- Predição por IA (mastite subclínica, falha reprodutiva) — outra fatia do V2.
- Materializar score no `ResumoAnimal` (só se performance exigir mais tarde).

## Decisões (aprovadas no brainstorming)

- **Fatia do V2:** Score do rebanho (carteira).
- **Impacto do descarte:** margem estimada por animal (reuso da lógica de `insights.ts`), rotulada como aproximação.
- **Superfície:** nova aba "Carteira" no módulo rebanho.
- **Arquitetura:** Abordagem A — extrair as funções puras de score de `insights.ts` para `score.calc.ts`, computar a carteira numa varredura única do pool (sem chamar `obterInsights` N vezes).

## Arquitetura

Pegada do projeto: `calc puro → service → rota fina → UI`.

### Backend

- **`server/src/services/rebanho/score.calc.ts`** (extraído de `insights.ts`, puro):
  funções `pontosProducao/pontosCCS/pontosFertilidade/pontosIdade/pontosSaude/pontosRentab`,
  `classificar`, e `scoreDoResumo(insumos) → { valor, classificacao, estrelas, fatores }`.
  `insights.ts` passa a **importar** daqui — refactor comportamento-preservador
  (os testes atuais de `insights` provam que o número não muda).
- **`server/src/services/rebanho/carteira.calc.ts`** (puro): recebe animais já com
  score + margem e produz distribuição, score médio ponderado, ranking top/bottom,
  `margemDiaTotal`, e `simularDescarte(animais, n)`.
- **`server/src/services/rebanho/carteira.ts`** (service, único com I/O): uma varredura
  do pool (animais ATIVO com `ResumoAnimal.producaoMediaDia != null`, escopado por
  propriedade), `calcularCustoVacaDia` **uma vez**, custo de sanidade rateado **em lote**,
  monta score+margem via os calc puros, devolve `CarteiraDTO`.
- **`server/src/routes/rebanho/carteira.ts`**: `GET /rebanho/carteira` e
  `GET /rebanho/carteira/simular-descarte?n=N`. Montado em `index.ts` (sob auth `/api/*`).
  Ambos são **stateless**: `simular-descarte` recomputa a mesma base do pool internamente
  (não recebe a lista do cliente), garantindo consistência com `GET /carteira`.

### Frontend

- Sub-aba **`reb-carteira`** ("Carteira") no `AppSidebar.tsx` + `router.ts` + `nav.ts`.
- **`client/src/rebanho/components/CarteiraTab.tsx`**: KPIs, distribuição (reuso
  `Donut`/`MiniBarChart` de `components/charts.tsx`), ranking, slider de descarte.
- `client/src/rebanho/api.ts`: `useCarteira()` + `simularDescarte(n)` (via `comPropriedade`).

### Limites

- `score.calc` não conhece Prisma. `carteira.calc` recebe dados materializados e só
  agrega/simula. `carteira.ts` é o único com I/O. Margem por animal é **estimada**
  (receita lactação − custo vaca/dia − sanidade/dia rateada), rotulada como aproximação.

## DTOs

```ts
interface AnimalCarteiraDTO {
  animalId: number;
  numero: string;
  nome: string | null;
  score: number;                    // 0–100 (mesma fórmula da ficha)
  classificacao: "ELITE" | "MUITO_BOA" | "BOA" | "ATENCAO" | "DESCARTE";
  producaoDia: number | null;       // L/dia (ResumoAnimal.producaoMediaDia)
  ccs: number | null;
  margemDiaEstimada: number | null; // R$/dia ≈ (litros×preço) − custoVacaDia − sanidade/dia
}

interface CarteiraDTO {
  totalAnimais: number;             // vacas em lactação consideradas
  scoreMedio: number;               // média ponderada por produção
  distribuicao: { classificacao: string; cabecas: number; pctRebanho: number }[];
  margemDiaTotal: number;
  ranking: { melhores: AnimalCarteiraDTO[]; piores: AnimalCarteiraDTO[] }; // N default 5
  precoLeite: number;               // preço usado (config do rebanho), p/ transparência
  custoVacaDia: number | null;      // custo médio usado
}

interface SimulacaoDescarteDTO {
  n: number;                        // clampado a [0, totalAnimais]
  cabecas: number;
  litrosDiaSai: number;
  margemDiaAntes: number;
  margemDiaDepois: number;
  margemDiaDelta: number;           // depois − antes (positivo = descarte melhora)
  ccsMedioAntes: number | null;
  ccsMedioDepois: number | null;
  scoreMedioDepois: number;
}
```

**Pool considerado:** `ATIVO` com `ResumoAnimal.producaoMediaDia != null` (vacas em
lactação). Novilhas/secas sem produção ficam de fora (mesma regra do percentil da ficha).

## Fluxo de cálculo

`GET /rebanho/carteira`:
1. Pool: `animal.findMany({ status: ATIVO, resumo: { producaoMediaDia not null }, propriedadeId })`
   com `resumo`, `dataNascimento`, `categoria`.
2. `custoVacaDia` **uma vez** (`calcularCustoVacaDia`, escopado). Sanidade/dia **rateada em
   lote**: total "Medicamento Animal" 12m ÷ aplicações globais 12m → por nº de aplicações do
   animal (mesma fórmula de `insights.ts`, mas uma query para o pool inteiro).
3. Por animal: `scoreDoResumo(...)` + `margemDiaEstimada = producaoDia × precoLeite −
   custoVacaDia − sanidadeDiaRateada`.
4. `carteira.calc` agrega: distribuição, score médio ponderado, ranking, `margemDiaTotal`.

**Simulação (`simularDescarte(animais, n)`, puro):** ordena por score ascendente, remove as
`n` piores, recalcula margem/CCS/score do remanescente. `margemDiaDelta = depois − antes`.
Vaca de margem negativa descartada → delta positivo (o insight desejado). Documentado: "impacto
no tanque e na margem/dia; não inclui payback de reposição".

## Erros e casos vazios

- Sem vacas em lactação → `CarteiraDTO` com `totalAnimais: 0`, listas vazias; UI em estado
  vazio ("nenhuma vaca em lactação com dados"), não quebra.
- `custoVacaDia` null (sem consumo) → margem = `litros×preço` (sem custo), rotulado.
- `n` da simulação clampado a `[0, totalAnimais]`.

## Testes (TDD, calc puro primeiro)

- **`score.calc.test.ts`:** cada `pontos*`, `classificar` nas fronteiras (85/70/55/40),
  `scoreDoResumo` com resumo sintético → score conhecido. Garante que o refactor não muda o número.
- **`carteira.calc.test.ts`:** distribuição conta por faixa; ranking ordena e corta N;
  `simularDescarte` — descartar vaca de margem negativa sobe a margem (delta>0), CCS médio cai,
  clamp de `n`, lista vazia.
- Testes existentes de `insights.ts` seguem passando (extração comportamento-preservadora).

## Métrica de sucesso (V2 §5.2)

Produtor consegue responder "descartando as 10 piores, qual o impacto no lucro?" direto no painel,
com número de cabeças, litros que saem, e Δ margem/dia — ancorado no score que já usa na ficha.

## Reuso

- `insights.ts` (funções de score, lógica de custo/margem) — extraídas, não duplicadas.
- `calcularCustoVacaDia` (`rebanho/estoque.ts`) — custo vaca/dia real.
- `ResumoAnimal` — fonte pré-computada (produção, CCS, IEP, status, tendência, DEL).
- `components/charts.tsx` (`Donut`, `MiniBarChart`, `fmtMoney`) — sem libs novas.
- `resolverEscopoLeitura` / `comPropriedade` — escopo de propriedade.
- Padrão de sub-aba `reb-*` (`AppSidebar`, `router.ts`, `nav.ts`).

## Entrega

1 PR coeso (refactor de extração + carteira backend + aba). Rito: branch → TDD → service →
rota+mount → UI → verify (typecheck+build+testes 2 workspaces + smoke local Postgres) → PR →
CI verde → squash-merge → sync.
