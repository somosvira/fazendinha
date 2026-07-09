# shadcn/ui — Fase 2 (Financeiro core: Dashboard + Relatório) — Plano/slicing

> Segue o playbook `docs/superpowers/specs/2026-07-08-shadcn-migration-playbook.md`. Parent: `2026-07-08-shadcn-migration-design.md` §3 fase 2.
> **Recomendação:** rodar cada slice em sessão fresca (contexto/custo menores) e, para as seções editoriais grandes, verificar visualmente com o app rodando/staging — não só build+jsdom.

## Achados críticos do mapeamento (LER ANTES)
- **Os arquivos `dashboard.css`/`dashboard-v2.css` NÃO são onde mora o estilo vivo.** O estilo real de `Dashboard.tsx` está em **`cockpit.css`** (`cockpit-section`, `kpi-cockpit-*`, `folego-*`/`fmc-*`/`fp-*`, `donut-*`, `atv-*`, `ex-cell`, `forn-mini-*`, `dash-sec-*`). O de `Relatorio.tsx` está em **`base.css`** (`kpi-row`, `activity-card`, `cat-list`, `unit-card`, `alert-card`, `dual-stat`, `two-up`, `section-head`). Migrar de verdade = tocar cockpit.css (Dashboard) e base.css (Relatorio).
- **Slice 1 (limpeza) JÁ FEITO** (merge `15c4e90`): 48 classes mortas removidas de dashboard.css/dashboard-v2.css (−54%). `.dre-row` mantido (ainda usado na DRERow gated).
- **Seções gated-off renderizam NADA hoje** (`MOSTRAR_MULTI_PERIODO=false`, `Dashboard.tsx:49`): `DRESection`, `TimelineSection`, e o cluster `SECOES_SEM_DADO` (`ResumoExecutivo`, `RupturaCaixa`, `BreakEvenLeite`, `OrcadoRealizado`, `ProdutividadeRebanho`). **Confirmar com o dono: migrar ou DELETAR** antes de gastar esforço (provavelmente deletar).
- **Charts fora de escopo:** `charts.tsx` + os SVGs locais do Dashboard (`TimelineChart`/`BarSeries`/`Donut`) — embrulhar, não reescrever. Mount points preservados.
- **`MonthRangePicker`/`mrp-*` e `DateRangePicker`** são widgets separados — manter até uma fase própria. `period-switch` (base.css) compartilhado — manter.

## APIs (preservar; consumidores só em App.tsx)
- `Dashboard({ onNav:(t:Tab)=>void, user?:User })` — App.tsx:240. Estado: range/drillCat/monthIdx/data/error; máscara de valor por `user.flags`. Período = `MonthRangePicker`.
- `Relatorio({ onNav })` — App.tsx:245. Estado: range. Período via `ReportHeader` (já migrado). Quase todo estático/editorial.

## Slicing (ordem, menor risco primeiro)
1. ✅ **Dead-CSS cleanup** — FEITO (15c4e90).
2. ✅ **Primitivas de layout (puras, sem estado)** — FEITO (merge `f9985f1`). Criadas em `client/src/components/report/primitives.tsx` (Tailwind + tokens): `Section`, `SectionHead`, `KpiRow`/`KpiTile`, `ChartLegend`/`LegendItem` (reaproveitam `.legend*` compartilhada), `SplitBar`, `UnitCard`, `ActivityCard`, `AlertCard`. `<DashSectionHeader>` fica p/ o slice 4 (Dashboard). Testes SSR em `primitives.test.ts`.
3. ✅ **Relatorio seções** — FEITO (merge `f9985f1`). `Relatorio.tsx` 100% Tailwind; todas as seções (KpiHero, §I QuestionLeite, §II CusteioVsInvestimento, §III ActivityComparison, §IV MonthlyFlow, §V TopCategories+ContextualCards, §VI UnitCost) migradas. Charts (WaterfallChart/MonthlyFlowChart/Leite2025CoverageChart) embrulhados, não reescritos. CSS aposentado em base.css: report-section, section-head/num/lede, kpi-row/kpi-value/kpi-delta/kpi-note, answer-block/verdict, dual-stat, activity-*, unit-*/un-*, two-up, context-cards-row. **Pegadinha resolvida no review:** `typescale.css` (carregado por último) sobrepõe base.css → tamanhos reais eram 46/23/16px, não 44/22/15. **Pendências p/ próxima sessão:** (a) paridade visual com app rodando NÃO verificada (só build+tsc+testes); (b) as `@media` de base.css que citam kpi-row/activity-grid/unit-grid/context-cards-row viraram CSS morto — o responsivo foi restaurado via variantes `max-[..px]` no JSX, mas os blocos @media órfãos só saem na Fase 7.
4. **Dashboard seções vivas (estado/interatividade — cuidado):** KpiCockpit (layout) · FolegoCaixa (layout) · **GastoPorCategoria** (clique no donut + toggle period-switch + drill) · ExplorarCategoria (dropdown) · AtividadeSplit (layout) · InconsistenciasSection (botão reclassificar/mutação) · filter bar (depende de MonthRangePicker). Aposenta cockpit.css conforme migram.
5. **Drill/detail (maior interatividade — por último):** CategoryDrill (+SubcatBreakdown/LancamentosPanel/NotaDrawer) · MonthDetail.
6. **Decidir gated:** migrar ou deletar DRE/Timeline/ResumoExecutivo/BreakEven/OrcadoRealizado/ProdutividadeRebanho.

DoD por slice: build+tsc verdes, testes (jsdom p/ interativo, SSR p/ layout), paridade visual, CSS aposentado deletado (do arquivo real — cockpit.css/base.css), APIs intactas.
