# Design — Cockpit do Dia (Painel "Hoje" do rebanho, fatia 1)

> Feature 3 da sessão de 2026-07-19. Escopada via brainstorming + workflow de design
> (4 propostas → julgamento → síntese). Vencedora: `cockpit-diario-com-saldo` (83),
> com enxerto de `so-alertas-criticos-novos` (82).

## 1. Nome + frase de valor

**Cockpit do Dia** — uma faixa no topo do Dashboard do rebanho que responde, numa linha,
*"o que preciso fazer hoje e como está o caixa"*: contadores de ações pendentes por categoria
(reprodução, sanidade, carência de leite, estoque) **+** saldo do dia e do mês. É o único lugar
do sistema que cruza operacional e financeiro num só olhar, e cada contador é um atalho para a
fila/aba que já existe.

## 2. Escopo

**IN**
- Rota fina nova `GET /api/rebanho/hoje` → service `cockpit.ts` → `cockpit.calc.ts` puro.
- 4 contadores agregados:
  - **repro** = soma de `secagem-atrasada` + `vazia-pos-pev` + `dg-pendente` + `parto-proximo`;
  - **sanidade** = `ccs-alta`;
  - **carência** = nº de vacas em lactação com carência de leite ativa (Feature 1 desta sessão);
  - **estoque** = nº de produtos `abaixoMinimo`.
- 2 valores financeiros: **saldoDia** (fluxo líquido de hoje) e **saldoMes** (fluxo do mês), com sinal preservado.
- Faixa `<CockpitDia>` no topo do `DashboardView.tsx`, **acima** do `<Alertas>`, rótulo "resumo do dia".
  Contadores de repro/sanidade abrem a worklist canônica via `onAbrirWorklist(chave)`; carência/estoque
  navegam pela `tab` via `onNav`.
- Escopo de propriedade via `resolverEscopoLeitura(c)`; fetch client via `comPropriedade()` (embutido em `req()`).

**OUT / YAGNI**
- Sub-aba/tela "Hoje" dedicada (colide com `HOJE.ts`; o `<Alertas>` já é a fila). Nada em `nav.ts`.
- Worklist canônica nova de carência ou estoque — aqui só **contamos**; não ampliamos o union
  `ChaveWorklistRebanho` nem o enum Zod de `worklists.ts`. Fila detalhada = fatia futura.
- Card financeiro por atividade (leite×café), timeline, push/notificação, registro de baixa pela faixa.
- Não toca `Lancamento` (só leitura via `buildDashboard`) → **`FechamentoMensal` irrelevante**. Sem schema.

## 3. Backend

### Rota
`GET /api/rebanho/hoje` — novo `server/src/routes/rebanho/hoje.ts` (`rebanhoHojeRouter`), montado em
`server/src/index.ts` junto dos demais routers do rebanho. Sem query params. Resolve
`const propriedadeId = await resolverEscopoLeitura(c);` e delega ao service.

### Service (I/O)
`server/src/services/rebanho/cockpit.ts` — `montarCockpitHoje(propriedadeId, agora = new Date())`.
Reúne 4 fontes já testadas e passa dados crus para o calc:
1. **Worklists**: o agregador de dashboard do rebanho → usa `dashboard.alertas` (array de
   `WorklistRebanhoDTO`, cada um com `chave`/`quantidade`/`severidade`/`tab`).
2. **Estoque**: `listarSaldos(...)` → linhas com `abaixoMinimo: boolean`. Conta as `true`.
3. **Carência**: reusa o padrão batch já existente em `producao.ts` (`agregarProducao`) — busca as
   vacas em lactação ativas do escopo e uma única query
   `prisma.eventoSanitario.findMany({ where: { animalId: { in: idsLact }, tipo: "APLICACAO", carencia: { gt: 0 } }, select: { animalId, data, carencia } })`,
   agrupa por `animalId` e chama `carenciaAtiva(aplics, agora)` por animal. **Sem N+1**.
4. **Financeiro**: dois `buildDashboard` — `{ from: hoje, to: hoje }` (dia) e
   `{ from: 1ºDiaMes, to: hoje }` (mês). Usa `.periodo.fluxo` de cada.

### `cockpit.calc.ts` (puro)
Agrega e prioriza — não faz I/O. Assinatura:

```ts
export interface CockpitInput {
  alertas: { chave: string; quantidade: number; severidade: "alta" | "media" | "baixa" }[];
  estoqueAbaixoMinimo: number;
  carenciaAtivaCount: number;
  fluxoDia: number;
  fluxoMes: number;
}
export interface CockpitContador {
  categoria: "repro" | "sanidade" | "carencia" | "estoque";
  quantidade: number;
  chave: string | null;   // deep-link p/ worklist (repro/sanidade); null p/ carencia/estoque
  tab: string;            // fallback de navegação
}
export interface CockpitDTO {
  contadores: CockpitContador[];
  saldoDia: number;
  saldoMes: number;
}
export function resumirCockpit(input: CockpitInput): CockpitDTO;
```

Regras:
- **repro** = soma das quantidades de `secagem-atrasada`+`vazia-pos-pev`+`dg-pendente`+`parto-proximo`;
  `chave` do deep-link = a de **maior severidade** entre as presentes (`alta`>`media`>`baixa`; empate →
  primeira na ordem canônica declarada, determinístico); `tab: "reproducao"`.
- **sanidade** = quantidade de `ccs-alta`; `chave: "ccs-alta"`, `tab: "sanidade"`.
- **carencia** = `carenciaAtivaCount`; `chave: null`, `tab: "producao"`.
- **estoque** = `estoqueAbaixoMinimo`; `chave: null`, `tab: "nutricao"`.
- `saldoDia`/`saldoMes` = `fluxoDia`/`fluxoMes` diretos (sinal preservado, negativo continua negativo).

### Casos de teste (`cockpit.calc.test.ts`)
1. Rebanho zerado: `alertas: []`, contagens 0, fluxos 0 → contadores `quantidade: 0`, saldos 0.
2. Repro somada + deep-link por severidade: `secagem-atrasada` q2 alta, `dg-pendente` q3 media,
   `parto-proximo` q1 baixa → repro `quantidade: 6`, `chave: "secagem-atrasada"`.
3. Estoque: `estoqueAbaixoMinimo: 2` → estoque `quantidade: 2`, `chave: null`, `tab: "nutricao"`.
4. Carência: `carenciaAtivaCount: 3` → carencia `quantidade: 3`, `chave: null`, `tab: "producao"`.
5. Sinais financeiros: `fluxoDia: -1234.5`, `fluxoMes: 8900` → `saldoDia: -1234.5`, `saldoMes: 8900`.
6. Sanidade isolada + empate de severidade em repro → determinístico pela ordem canônica.

**Reusa** (nada reimplementado): `WorklistRebanhoDTO`/chaves/severidade de `dashboard.types.ts`;
agregador de dashboard do rebanho (`construirWorklists`); `listarSaldos` (`abaixoMinimo`);
`carenciaAtiva` de `carencia.calc.ts` + o padrão batch de `producao.ts`; `buildDashboard` (`periodo.fluxo`).
**Cria** só: `cockpit.calc.ts` (+`.test.ts`), `cockpit.ts`, `hoje.ts`.

## 4. Frontend

- **Onde**: novo `<CockpitDia>` (`client/src/rebanho/components/CockpitDia.tsx`), renderizado **acima**
  do `<Alertas>` no `DashboardView.tsx`, dentro do `<RebMain>`. **Não** cria sub-aba nem toca `nav.ts`
  → evita colisão com `HOJE.ts` (helper de data). Nome do componente `CockpitDia`, jamais `Hoje`.
- **Componente**: 4 contadores + 2 tiles de saldo. Reusa `fmtMoney`/`fmtBR` de `components/charts.tsx`
  (não recriar formatadores). Saldo negativo em cor de prejuízo via `var()`.
- **Deep-links**: cada contador é um botão.
  - repro/sanidade → `onAbrirWorklist(chave)` (mesmo caminho dos cards do `<Alertas>`).
  - carência/estoque (`chave: null`) → `onNav(tab)` (`producao` / `nutricao`). Sem botão "Registrar".
- **Fetch**: `fetchCockpitHoje()` novo em `client/src/rebanho/api.ts` via `req()` (injeta `comPropriedade()`).
  Tipos `CockpitDTO` espelhando o backend.

## 5. Verificação
- **Unit**: `vitest run src/services/rebanho/cockpit.calc.test.ts` (6 casos).
- **Smoke no Postgres local**: chamar `montarCockpitHoje(propriedadeId)` (ou `GET /rebanho/hoje`) num
  script temporário; conferir `contadores` coerentes e `saldoDia`/`saldoMes`. Inserir 1 aplicação com
  carência>0 e conferir o contador de carência subir; remover ao fim.

## 6. Riscos e mitigação
- **Redundância visual** (faixa some as mesmas worklists dos cards): faixa é agregador/atalho explícito
  ("resumo do dia") acima; `<Alertas>` continua a fila. Duplicação de informação, não de código.
- **N+1 na carência**: eliminado — query batch único (`animalId: { in: idsLact }`), como `producao.ts`.
- **Carência/estoque sem `chave` canônica**: por isso `chave: null` + navegação por `tab` (`onNav`),
  não `onAbrirWorklist`. Union/enum/`obterWorklist` intocados.
- **`periodo` null**: só sem `from`/`to`; o service sempre passa ambos.
- **Duas chamadas a `buildDashboard`**: aceitável (1×/carga). Otimização futura fora da fatia.

## Arquivos
- Novos: `server/src/routes/rebanho/hoje.ts`, `server/src/services/rebanho/cockpit.ts`,
  `cockpit.calc.ts`, `cockpit.calc.test.ts`; `client/src/rebanho/components/CockpitDia.tsx`.
- Editados: `server/src/index.ts` (montar router), `client/src/rebanho/api.ts` (`fetchCockpitHoje`+tipos),
  `client/src/rebanho/components/DashboardView.tsx` (renderizar `<CockpitDia>`).
- Sem schema, sem migration, sem toque em `Lancamento`.
