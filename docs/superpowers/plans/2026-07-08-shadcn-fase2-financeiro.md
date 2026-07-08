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
2. **Primitivas de layout (puras, sem estado):** `<Section>` (cockpit-section/report-section, 11×/6×) · `<SectionHead>` (Relatorio, 6×) · `<DashSectionHeader>` (trio `dash-sec-head`+`eyebrow`, 13× inline no Dashboard) · `<ChartLegend>` (22× inline nos dois) · `<UnitCard>` (dup 2× em Relatorio `413`/`437`) · `<SplitBar>` (unifica `cat-bar`/`atv-bar`/`forn-mini-bar`).
3. **Relatorio seções (estático, top-down):** KpiHero→`<KpiTile>` · §III ActivityCard+grid · §V TopCategories · §VI UnitCost · §II CusteioVsInvestimento + §IV MonthlyFlow (embrulhar charts) · **§I QuestionLeite** ("o leite paga o leite", só aqui) · ContextualCards/AlertCard. Aposenta os blocos editoriais de base.css conforme migram.
4. **Dashboard seções vivas (estado/interatividade — cuidado):** KpiCockpit (layout) · FolegoCaixa (layout) · **GastoPorCategoria** (clique no donut + toggle period-switch + drill) · ExplorarCategoria (dropdown) · AtividadeSplit (layout) · InconsistenciasSection (botão reclassificar/mutação) · filter bar (depende de MonthRangePicker). Aposenta cockpit.css conforme migram.
5. **Drill/detail (maior interatividade — por último):** CategoryDrill (+SubcatBreakdown/LancamentosPanel/NotaDrawer) · MonthDetail.
6. **Decidir gated:** migrar ou deletar DRE/Timeline/ResumoExecutivo/BreakEven/OrcadoRealizado/ProdutividadeRebanho.

DoD por slice: build+tsc verdes, testes (jsdom p/ interativo, SSR p/ layout), paridade visual, CSS aposentado deletado (do arquivo real — cockpit.css/base.css), APIs intactas.
