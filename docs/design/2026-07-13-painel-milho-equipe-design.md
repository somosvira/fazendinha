# Painel de visão geral — Milho (cultivo) e Equipe

**Data:** 2026-07-13
**Branch alvo:** novo PR a partir de `main`
**Origem:** último item aberto da auditoria de UI (rev. 3) — dar um painel de visão
geral próprio aos módulos **Milho (cultivo)** e **Equipe & Ponto**, no mesmo molde
dos outros módulos operacionais (Rebanho, Plantio, Corte).

## Contexto

Hoje os módulos Milho e Equipe abrem direto numa lista (`mil-safras` /
`eqp-funcionarios`). Todos os outros módulos operacionais abrem num **painel**:
faixa de KPIs · banda de insight da IA · grid de domínios ("ver →") · rail de
alerta — alimentado por um `useDashboard()`.

O repositório tem **dois padrões** de dashboard de módulo:
- **Backend-computado** (rebanho, corte): rota fina → service → agregação pura →
  DTO `{ k, dominios, alertas }`. O corte é o melhor exemplo porque **respeita o
  escopo de propriedade** (`resolverEscopoLeitura`) e faz o rollup do read-model
  por entidade (`ResumoLote`).
- **Client-derivado** (plantio): `useDashboard()` reduz no cliente a partir de uma
  listagem existente com read-model embutido.

**Decisão (confirmada com o usuário):** seguir o padrão **backend-computado estilo
corte** para os dois módulos novos, e **paridade total de insight da IA** (banda
alimentada por mock, como rebanho/plantio/corte).

### Confirmação de escopo do backend

Não existe endpoint de dashboard/overview para cultivo nem para ponto — só o
`GET /cultivo/safras/:id/resumo` (por safra) e, no ponto, `GET /ponto/custo-mo-setor`
e `GET /ponto/folha?mes=`. **Os dados agregados, porém, já existem e já são
escopados por propriedade**, então a agregação é um rollup fino sobre read-models
prontos:

- **Cultivo:** `SafraCultivo` carrega `propriedadeId` e tem o read-model
  `ResumoSafraCultivo` embutido (`custeioTotal`, `investimentoTotal`, `areaHa`,
  `producaoGraoSc`, `producaoSilagemTon`, `custoHa/custoSaca/custoTonelada`,
  `horasMaquinaTotal`). `Silo` carrega `propriedadeId` e `saldoAtual`/`capacidade`.
  A flag `fechada` distingue safra ativa/fechada (não há status "ATIVO").
- **Ponto:** `Funcionario` carrega `propriedadeId` (+ `ativo`). `custoMOPorSetor` e
  `apurarFolha(mes)` já são escopados e devolvem os agregados (custo de MO por
  setor; totais da folha: `salarios`, `valorExtra`, `totalPagar`, `totalHoras`;
  linhas por funcionário com `diasTrabalhados`/`extra50`/`extra100`).

## Objetivos

1. `GET /api/cultivo/dashboard` e `GET /api/ponto/dashboard` escopados, testados.
2. Painéis `cultivo/components/DashboardView.tsx` e `equipe/components/DashboardView.tsx`
   no molde do rebanho (KPI strip · insight · grid · rail).
3. Milho e Equipe passam a **abrir no painel**; nova sub-aba "Painel" na sidebar.
4. Normalizar o eyebrow contextual dos painéis de Plantio e Corte (item baixo da
   auditoria).

## Não-objetivos (YAGNI)

- Cotação ao vivo, gráficos novos, ou KPIs além dos read-models já existentes.
- Tornar o rebanho consistente com o novo eyebrow (fora de escopo; o rebanho
  hardcoda "Sítio São Francisco" mas não mexeremos nele aqui).
- Deletar os `IaView.tsx` órfãos — fica como follow-up opcional separado.
- Multi-propriedade novo: os endpoints reusam o padrão `resolverEscopoLeitura` já
  existente; nenhum fato novo é escopado.

## Arquitetura & fluxo de dados

```
Client                                    Server
────────────────────────────────────     ───────────────────────────────────────
DashboardView (cultivo)                   GET /api/cultivo/dashboard
  └ useDashboard()  ───────────────────▶    routes/cultivo/dashboard.ts
      obterDashboard()                        └ buildCultivoDashboard(resolverEscopoLeitura(c))
        GET /cultivo/dashboard                    ├ prisma.safraCultivo.findMany({where:{propId}, include:{resumo}})
                                                  ├ prisma.silo.findMany({where:{propId}})
                                                  └ agregarDashboardCultivo(...)  ← puro, testado
                                                        → { k, dominios, alertas }

DashboardView (equipe)                    GET /api/ponto/dashboard?mes=YYYY-MM
  └ useDashboard()  ───────────────────▶    routes/ponto/dashboard.ts
      obterDashboard(mes)                     └ buildPontoDashboard(mes, resolverEscopoLeitura(c))
        GET /ponto/dashboard?mes=…               ├ listarFuncionarios(escopo) → count/setores
                                                 ├ custoMOPorSetor(escopo)
                                                 ├ apurarFolha(mes, escopo)
                                                 └ agregarDashboardPonto(...)   ← puro, testado
                                                       → { k, dominios, alertas }
```

Todos os endpoints devolvem o mesmo *triplo* do corte: `k` (headline numbers) +
`dominios[]` (linhas de resumo por sub-aba) + `alertas[]` (contagens rotuladas com
`tom`). Escopo resolvido por `resolverEscopoLeitura(c)`; `null` = consolidado (sem
filtro), `número` = filtra por `propriedadeId`. O ponto passa o `?mes=` do cliente
(âncora do módulo, `mesesRecentes(1)[0]` = `"2026-05"`); default server-side = mês
corrente quando ausente.

## Backend

### Cultivo

**`server/src/services/cultivo/dashboard.agg.ts`** (puro) + `dashboard.agg.test.ts`.

DTO de saída:

```ts
export interface DashboardCultivoDTO {
  k: {
    safrasAtivas: number;        // fechada = false
    safrasFechadas: number;
    areaHa: number;              // Σ resumo.areaHa
    producaoGraoSc: number;      // Σ resumo.producaoGraoSc
    producaoSilagemTon: number;  // Σ resumo.producaoSilagemTon
    custeioTotal: number;        // Σ resumo.custeioTotal
    investimentoTotal: number;   // Σ resumo.investimentoTotal
    custoSacaMedio: number | null; // Σ custeio ÷ Σ produção grão (null se produção = 0)
    silosAtivos: number;
    siloSaldoTotal: number;      // Σ saldoAtual dos silos ativos
    siloOcupacaoPct: number | null; // Σ saldo ÷ Σ capacidade (null se sem capacidade)
  };
  dominios: { tab: string; titulo: string; linhas: string[] }[];
  alertas: { label: string; n: number; tom?: "up" | "bad"; tab: string }[];
}
```

Domínios (tabs `mil-*`): **Safras** (`mil-safras`), **Produção** (`mil-producao`),
**Silos** (`mil-silos`), **Custo** (`mil-custo`).

Alertas derivados:
- Safras abertas sem produção lançada (`producaoGraoSc + producaoSilagemTon === 0`) — `tom: "up"`, tab `mil-producao`.
- Silos acima de 90% de ocupação — `tom: "bad"`, tab `mil-silos`.
- Safras com custo/saca acima da média — `tom: "up"`, tab `mil-custo`.

**`server/src/services/cultivo/dashboard.ts`** (loader): lê
`safraCultivo.findMany({ where: escopo, include: { resumo: true } })` e
`silo.findMany({ where: { ...escopo, ativo: true } })`, converte Decimal→number na
borda, delega ao `agregarDashboardCultivo`.

**`server/src/routes/cultivo/dashboard.ts`**:

```ts
export const cultivoDashboardRouter = new Hono()
  .get("/cultivo/dashboard", async (c) =>
    c.json(await buildCultivoDashboard(await resolverEscopoLeitura(c))));
```

### Ponto

**`server/src/services/ponto/dashboard.agg.ts`** (puro) + `dashboard.agg.test.ts`.

DTO de saída:

```ts
export interface DashboardPontoDTO {
  k: {
    mes: string;                 // "YYYY-MM"
    funcionariosAtivos: number;
    setores: number;             // nº de setores distintos (custoMOPorSetor.length)
    custoMOMes: number;          // Σ custoMOPorSetor.totalMensal
    folhaTotalPagar: number;     // folha.totais.totalPagar
    valorExtra: number;          // folha.totais.valorExtra
    totalHoras: number;          // folha.totais.totalHoras
    maiorSetor: { nome: string; total: number; qtd: number } | null; // custoMOPorSetor[0]
  };
  dominios: { tab: string; titulo: string; linhas: string[] }[];
  alertas: { label: string; n: number; tom?: "up" | "bad"; tab: string }[];
}
```

Domínios (tabs `eqp-*`): **Funcionários** (`eqp-funcionarios`), **Ponto**
(`eqp-ponto`), **Folha** (`eqp-folha`).

Alertas derivados de `folha.linhas`:
- Sem ponto lançado no mês (`diasTrabalhados === 0`) — `tom: "bad"`, tab `eqp-ponto`.
- Com horas extras (`extra50 + extra100 > 0`) — `tom: "up"`, tab `eqp-folha`.

**`server/src/services/ponto/dashboard.ts`** (loader): compõe
`listarFuncionarios(escopo)` (count + setores) + `custoMOPorSetor(escopo)` +
`apurarFolha(mes, escopo)`, delega ao `agregarDashboardPonto`.

**`server/src/routes/ponto/dashboard.ts`**:

```ts
export const pontoDashboardRouter = new Hono()
  .get("/ponto/dashboard", zValidator("query", z.object({ mes: mesSchema.optional() })), async (c) => {
    const mes = c.req.valid("query").mes ?? mesCorrente();
    return c.json(await buildPontoDashboard(mes, await resolverEscopoLeitura(c)));
  });
```

### Montagem (`server/src/index.ts`)

Importar `cultivoDashboardRouter` e `pontoDashboardRouter` e montá-los com
`app.route("/api", …)` ao lado dos demais routers de dashboard de módulo (depois do
`authMiddleware`, junto com os outros routers de cultivo/ponto).

## Frontend

### API por módulo

- **`cultivo/api.ts`**: `DashboardMilho` (espelha `DashboardCultivoDTO`),
  `obterDashboard()` → `req("/cultivo/dashboard")`, `useDashboard()`
  (contrato `{ data, loading }` como o corte).
- **`equipe/api.ts`**: `DashboardEquipe` (espelha `DashboardPontoDTO`),
  `obterDashboard(mes)` → `req("/ponto/dashboard?mes=…")`, `useDashboard()` que passa
  `mesesRecentes(1)[0]`.

DTOs inline no `api.ts` (mesmo lugar do `DashboardCorte`).

### Painéis

- **`cultivo/components/DashboardView.tsx`** e **`equipe/components/DashboardView.tsx`**
  (novos), copiando o `rebanho/components/DashboardView.tsx`: `RebMain` +
  `RebHeader` + `RebKpiStrip`/`RebKpi` + `IaInsightBand` + grid de domínios
  ("ver →") + rail de alerta. `onNav` mapeia `d.tab` → sub-aba do módulo.
- **Loading shell:** o cultivo mantém `eyebrow="Cultivo · milho"` no estado de
  carregando (o smoke test SSR só vê esse estado e exige a string).
- **Eyebrow carregado:** `Cultivo · milho · {N} safras ativas` (milho) e
  `Equipe · Painel · {N} ativos` (equipe).

### Insight da IA (paridade total)

- **`cultivo/components/IaInsight.tsx`** + **`cultivo/mock/…`** (`insightDoMilho`) e
  **`equipe/components/IaInsight.tsx`** + **`equipe/mock/…`** (`insightDaEquipe`),
  copiando o `corte/components/IaInsight.tsx` (componente `IaInsightBand` + `Enfase`)
  e um gerador de insight mock estático por módulo. Tipo `IaInsight` mínimo
  (`{ texto: string; acoes?: { label: string }[] }`) — a banda só usa `texto` e
  `acoes[0].label`. (Equipe ainda não tem `mock/` — criar.)

### Dispatch

- **`CultivoContent.tsx`**: `MilSub += "dashboard"`; branch `aba === "dashboard"`
  → `<DashboardView onNavMil={onNavMil} />`.
- **`EquipeContent.tsx`**: `EqpSub += "dashboard"`; branch `aba === "dashboard"`
  → `<DashboardView onNavEqp={onNavEqp} />`.

## Wiring de navegação

- **`components/Shell.tsx`** — união `Tab` += `"mil-dashboard"`, `"eqp-dashboard"`.
- **`App.tsx`** — `MIL` map += `"mil-dashboard": "dashboard"`; `EQP` map +=
  `"eqp-dashboard": "dashboard"`.
- **`router.ts`** — `MODULO_BASE`: milho `defaultSub` `"safras" → "dashboard"`;
  equipe `"funcionarios" → "dashboard"` (os módulos passam a abrir no painel; a URL
  base `/milho` e `/equipe` resolvem para o painel).
- **`components/AppSidebar.tsx`** — dois ícones novos em `ICON` (`mil-dashboard`,
  `eqp-dashboard`, grid como os outros painéis) + prepend `{ id: "mil-dashboard",
  label: "Painel" }` nas subs do módulo `cultivo` e `{ id: "eqp-dashboard", label:
  "Painel" }` no `equipe`.
- **`lib/searchIndex.ts`** — dois `Comando` "Painel" (grupos Milho / Administração,
  espelhando os existentes `mil-*`/`eqp-*`) + adicionar `mil-dashboard`/`eqp-dashboard`
  a `CURADORIA_IDS`.

Gate: o módulo Equipe inteiro já é gated por `verSalarios` (App renderiza
`GatedTab` e a sidebar esconde o módulo). `eqp-dashboard` herda o gate; o `podeVer`
do ⌘K já trata `eqp-*` por `canSeeFolha` e `mil-*` como sempre-visível.

## Item 4 — eyebrow contextual (Plantio + Corte)

Normalizar o eyebrow do painel para `Módulo · métrica` (lidera com o rótulo do
módulo, como os eyebrows das sub-abas, e remove o nome de fazenda hardcoded —
alinhado à direção de revenda/multi-tenant):

- **Plantio** (`plantio/components/DashboardView.tsx`): `Lavoura Rio Novo · {area} ha ·
  {talhoes} talhões ativos` → `Plantio · café · {area} ha · {talhoes} talhões`.
- **Corte** (`corte/components/DashboardView.tsx`): `Atividade Corte · Rio Novo ·
  {cabecas} cabeças · {lotes} lotes` → `Gado de corte · {cabecas} cabeças · {lotes} lotes`.

Nenhum teste fixa essas strings (verificado). Rebanho fica como está.

## Testes & verificação

- **Novos (server):** `services/cultivo/dashboard.agg.test.ts`,
  `services/ponto/dashboard.agg.test.ts` — cobrem os cálculos puros (rollup,
  custo/saca médio, ocupação de silo, alertas por limiar; folha: totais, alertas
  por linha).
- **`cultivo/__smoke__/render.test.ts`:** adicionar `"dashboard"` ao array `ABAS`
  (a loading shell renderiza `"Cultivo · milho"`).
- **Novo `equipe/__smoke__/render.test.ts`:** paridade (renderiza cada sub incl. o
  painel; assere `"Equipe ·"`).
- **Gate de saída:** `tsc` limpo · `pnpm --filter rionovo-client run test` (166 →
  ainda verdes) · `pnpm --filter rionovo-server run test` · `pnpm build` · conferir
  os dois painéis no navegador (desktop e mobile).

## Manifesto de arquivos

**Novos (server):**
- `server/src/services/cultivo/dashboard.ts`
- `server/src/services/cultivo/dashboard.agg.ts`
- `server/src/services/cultivo/dashboard.agg.test.ts`
- `server/src/routes/cultivo/dashboard.ts`
- `server/src/services/ponto/dashboard.ts`
- `server/src/services/ponto/dashboard.agg.ts`
- `server/src/services/ponto/dashboard.agg.test.ts`
- `server/src/routes/ponto/dashboard.ts`

**Novos (client):**
- `client/src/cultivo/components/DashboardView.tsx`
- `client/src/cultivo/components/IaInsight.tsx`
- `client/src/cultivo/mock/…` (insight do milho)
- `client/src/equipe/components/DashboardView.tsx`
- `client/src/equipe/components/IaInsight.tsx`
- `client/src/equipe/mock/…` (insight da equipe)
- `client/src/equipe/__smoke__/render.test.ts`

**Editados (server):**
- `server/src/index.ts` (montar 2 routers)

**Editados (client):**
- `client/src/cultivo/api.ts`, `client/src/equipe/api.ts`
- `client/src/cultivo/CultivoContent.tsx`, `client/src/equipe/EquipeContent.tsx`
- `client/src/components/Shell.tsx`, `client/src/App.tsx`, `client/src/router.ts`
- `client/src/components/AppSidebar.tsx`, `client/src/lib/searchIndex.ts`
- `client/src/cultivo/__smoke__/render.test.ts`
- `client/src/plantio/components/DashboardView.tsx`, `client/src/corte/components/DashboardView.tsx` (eyebrow)

## Follow-up opcional (fora deste PR)

Deletar os 3 `IaView.tsx` órfãos (rebanho/plantio/corte) + ajustar o
`rebanho/__smoke__/render.test.ts` que os referencia.
