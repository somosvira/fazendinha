# Painel "Hoje" preditivo (Sugestões) — V2 §5.1 fatia 1

**Data:** 2026-07-19
**Módulo:** rebanho
**Status do roadmap:** V2 §5 objetivo 1 ("Painel Hoje preditivo — o sistema sugere, o produtor decide") — primeira fatia.

## Problema

O Cockpit do Dia (#155/#157/#162) mostra **contadores de ação** (worklists canônicas: repro, ccs-alta, aSecar, partos). A Carteira (#166) computa score/margem por animal. O que **não existe** é a camada que transforma esses sinais em **sugestões priorizadas com uma decisão** — "cogite descarte de #942 (drena R$4/dia)", "inseminar #1188 — vazia há X dias". Este é o objetivo §5.1 do V2: o sistema sugere, ordenado pelo dinheiro em jogo.

## Escopo desta fatia

- Feed de **sugestões acionáveis**, determinístico (sem ML), derivado de dados que já temos (`ResumoAnimal`, score/margem da Carteira, contagem de mastites).
- 4 tipos: **DESCARTE**, **REPRODUCAO**, **MASTITE** (subclínica recorrente), **QUEDA_PRODUCAO**.
- Ordenado por **impacto em R$/dia** (chave de ordenação e número-herói), rotulado como aproximação.
- **Read-only / stateless**: o feed recomputa dos dados atuais; agir na sugestão (inseminar, secar, descartar) faz o sinal sumir na próxima carga. Sem tabela nova, sem migration.
- Entregue como **card top-3 no Cockpit** (gancho diário) **+ aba dedicada `reb-sugestoes`** (feed completo com motivo/ação).

### Fora de escopo (fatias futuras do V2)

- Persistência de "dispensar/snooze" da sugestão (tabela + expiração).
- Predição real por IA (mastite 14d de antecedência, falha reprodutiva) — objetivo §5.3.
- Resumo diário / decisões via WhatsApp — objetivo §5.5.
- Payback de reposição no descarte.

## Decisões (aprovadas no brainstorming)

- **Formato:** ambos — top-3 no Cockpit + aba dedicada.
- **Tipos:** os 4 (descarte, repro, mastite recorrente, queda de produção).
- **Priorização:** por **impacto em R$/dia** desc.
- **Estado:** read-only / stateless (sem migration).
- **Arquitetura:** Abordagem A — motor próprio que varre o pool uma vez (padrão da Carteira), NÃO um agregador das worklists.
- **Piso de ruído:** cortar sugestões com impacto abaixo de um piso pequeno configurável (constante nomeada).
- **Fatores de perda (CCS/queda):** constantes conservadoras calibráveis nesta fatia; a mensuração real de perda é o objetivo §5.3.

## Arquitetura

Pegada do projeto: `calc puro → service → rota fina → UI`. Mesma forma da Carteira.

### Backend

- **`server/src/services/rebanho/sugestoes.calc.ts`** (puro): uma função por regra + o agregador.
  - `avaliarDescarte(a)`, `avaliarReproducao(a)`, `avaliarMastite(a)`, `avaliarQueda(a)` — cada uma recebe um
    animal já materializado e devolve `SugestaoDTO | null`.
  - `montarSugestoes(animais, cfg)` — roda as 4 por animal, junta, aplica o piso, ordena por
    `impactoDiaEstimado` desc, agrega `totalPorTipo`/`impactoDiaTotal`, devolve `SugestoesDTO`. Puro/testável.
  - Fatores de aproximação (fração de perda por CCS, proxy do dia-vazio, DEL de fase, piso) = constantes
    nomeadas no topo.
- **`server/src/services/rebanho/sugestoes.ts`** (service, único com I/O): **uma varredura** do pool
  (`Animal`+`ResumoAnimal` ATIVO, escopo propriedade), `calcularCustoVacaDia` uma vez, contagem de mastites
  12m **em lote** (`groupBy`, padrão da Carteira), preço do leite; reusa `scoreDoResumo`/lógica de margem
  para materializar cada animal; chama `montarSugestoes`. Exporta uma função de varredura reusável p/ o
  Cockpit (evita reimplementar detecção).
- **`server/src/routes/rebanho/sugestoes.ts`**: `GET /rebanho/sugestoes` (feed completo). Montado em `index.ts`.
- **Cockpit:** `cockpit.ts` chama `obterSugestoes(propriedadeId)` e expõe `sugestoesTop3` + `impactoDiaTotal`
  no `CockpitDTO` existente. NÃO cria rota nova. As duas telas (Hoje e aba) fazem sua própria varredura
  quando carregadas — aceitável (raramente abertas juntas).

### Frontend

- Sub-aba **`reb-sugestoes`** ("Sugestões") — wiring padrão (`Shell.tsx` Tab, `AppSidebar.tsx`, `App.tsx` REB
  map, `RebanhoContent.tsx` dispatch; `router.ts` já cobre `reb-*` por prefixo).
- **`client/src/rebanho/components/SugestoesTab.tsx`**: feed ordenado; cada card = título + motivo + chip de
  impacto R$/dia + prazo (quando houver) + botão de ação (abre ficha/worklist). Estado vazio.
- **Card "Sugestões" no Cockpit** (dentro do conteúdo do Hoje existente): top-3 + "ver todas" → aba.
- `client/src/rebanho/api.ts`: `useSugestoes()` (via `comPropriedade`).

### Limites

- `sugestoes.calc` não conhece Prisma. `sugestoes.ts` é o único com I/O. Impacto por animal é **estimado**
  (rotulado). Cockpit consome a mesma função de varredura — sem duplicar detecção.

## DTOs

```ts
type TipoSugestao = "DESCARTE" | "REPRODUCAO" | "MASTITE" | "QUEDA_PRODUCAO";

interface SugestaoDTO {
  tipo: TipoSugestao;
  animalId: number;
  numero: string;
  nome: string | null;
  titulo: string;               // "Cogite descarte de #942"
  motivo: string;               // "Score DESCARTE + margem −R$4/dia"
  impactoDiaEstimado: number;   // R$/dia em jogo (>=0) — chave de ordenação
  prazoDias: number | null;     // repro/mastite podem ter janela; descarte/queda = null
  acao: { label: string; tab: string; worklistChave?: string }; // "Revisar caso" → ficha/worklist
}

interface SugestoesDTO {
  sugestoes: SugestaoDTO[];      // todas, já ordenadas por impactoDiaEstimado desc
  totalPorTipo: Record<TipoSugestao, number>;
  impactoDiaTotal: number;
  precoLeite: number;
  custoVacaDia: number | null;
}
```

**Pool considerado:** `ATIVO` com `ResumoAnimal` (mesmo pool da Carteira; regras que exigem produção checam
`producaoMediaDia`/`del` internamente).

## Regras e cálculo de impacto (R$/dia)

Constantes de aproximação nomeadas no topo do calc; UI rotula "estimado".

- **DESCARTE** — gatilho: classificação `DESCARTE`, ou (`ATENCAO` **e** margemDiaEstimada ≤ 0).
  Impacto = `max(0, −margemDiaEstimada)` (quanto a vaca drena/dia). `prazoDias = null`.
- **REPRODUCAO** — gatilho: `statusReprodutivo = VAZIA` **e** `del > PEV` (limiar da worklist `vazia-pos-pev`).
  Impacto ≈ `custoVacaDia` (proxy do dia-vazio: cada dia além da meta é lactação futura perdida).
  `prazoDias` = dias até estourar a meta de IEP. Motivo: "Vazia há X dias".
- **MASTITE** — gatilho: `ccs > CCS_LIMITE(400)` **e** `ccsTendencia = subindo` **e** mastites12m ≥ 2.
  Impacto ≈ `producaoMediaDia × precoLeite × FRACAO_PERDA_CCS` (fator conservador). Motivo: "CCS X↑ + N mastites/12m".
- **QUEDA_PRODUCAO** — gatilho: `producaoTendencia = descendo` **e** `del < DEL_FASE_QUEDA(~200)`.
  Impacto ≈ `producaoMediaDia × precoLeite × FRACAO_QUEDA` (aproximação). Motivo: "Produção caindo no DEL X".

Um animal pode gerar >1 sugestão (ex.: descarte + mastite) — mantém ambas; ordenação por R$ resolve.
Sugestões com impacto abaixo de `PISO_IMPACTO` são cortadas.

## Erros e casos vazios

- Sem sugestões → aba em estado vazio ("Nenhuma decisão pendente hoje — rebanho no azul"); card do Cockpit
  mostra "tudo em dia" (ou some).
- `custoVacaDia` null / `precoLeite` fallback → impacto calcula com o que dá, rotulado (igual Carteira).
- Escopo de propriedade em toda leitura.

## Testes (TDD, calc puro primeiro)

- **`sugestoes.calc.test.ts`:** cada `avaliar*` liga/não-liga nas fronteiras (CCS 400/401, DEL no PEV,
  tendência, margem ≤0, mastites ≥2); impacto por tipo; `montarSugestoes` ordena por impacto desc, aplica
  piso, agrega `totalPorTipo`/`impactoDiaTotal`; animal com 2 gatilhos → 2 cards; pool vazio → vazio.
- **`cockpit.calc.test.ts`** (existente): +top-3 é o prefixo do feed ordenado; contadores atuais não mudam.
- Smoke de render do `SugestoesTab` (+ card no Cockpit).

## Métrica de sucesso (V2 §5.1)

Produtor abre o "Hoje" e vê as top-3 decisões que mais valem em R$/dia, com o porquê e um atalho pra agir —
sem varrer listas. Ancorado no score/margem que já usa na Carteira.

## Reuso

- `carteira`/`score.calc` (score + margem por animal) — extraídos, não duplicados.
- `calcularCustoVacaDia` (`estoque.ts`) — custo vaca/dia real.
- `ResumoAnimal` — fonte pré-computada (ccs, ccsTendencia, del, statusReprodutivo, producaoTendencia).
- worklist `vazia-pos-pev` — limiar de PEV.
- Cockpit (`cockpit.ts`/`CockpitDTO`) — recebe top-3 sem rota nova.
- `resolverEscopoLeitura` / `comPropriedade` — escopo de propriedade.
- Padrão de sub-aba `reb-*` (`AppSidebar`, `router.ts`, `RebanhoContent`).

## Entrega

1 PR coeso (calc + service + rota + top-3 no Cockpit + aba). Rito: branch → TDD → service → rota+mount →
UI → verify (typecheck+build+testes 2 workspaces + smoke local Postgres) → PR → CI verde → squash-merge → sync.
