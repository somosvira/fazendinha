# Assessment B — technical audit (independent)

Target: all `client/src`, with stable synthesis target `client/src/App.tsx`. Review only; no UI or domain changes. This assessment has not read Assessment A. Findings withheld from parent until A completion.

## Evidence and scope

Counted 304 scannable markup files (204 excluding `*.test.*`); full-tree CLI scan is below the 500-file threshold. Detector JSON retained in `.impeccable/detector-B.json`. All ten raw hints reference production files, none test fixtures. Detector first direct invocation was refused by executable permissions; invoking the shipped launcher through `sh` succeeded and returned valid JSON (exit 1, rather than documented 2; output is complete JSON). Do not rerun solely to normalize exit status.

Production build `pnpm --filter rionovo-client run build` succeeded, log `.impeccable/build-B.log`: 2771 transformed modules; JS 1,871.87 kB / 531.55 kB gzip, CSS 278.55 kB / 46.95 kB gzip. Vite emits its >500 kB chunk warning.

Read README, ARCHITECTURE, docs index, current domain contracts and skill/playbooks. Inventory: App/router/auth entrypoints; financial dashboard, operations/form/detail, commitments/liquidation, accounts, reports/form/export, financial catalogs; inventory balances/movements/product and transfer/partidas; herd overview/list/animal/lot and forms; sanitary overview, agenda/cycles/stages, occurrences/applications/exams/withdrawals and forms/catalogs; nutrition overview/recipes/periods/closure/animal/lot; all settings groups and access administration; assistant shell. Static coverage is not an assertion every state was interactively tested.

Browser: own fresh background IAB tab at localhost:41875. Desktop 1280×720 measured; financial overview, herd overview, DEV-018 detail, reversal modal, nutrition overview, inventory and assistant shell inspected. Opened/canceled modal only; no form submission, writes, AI request, audio, upload, logout, seed operation or server startup. Mobile evidence pending coordination. Auth screens assessed in source, without changing session. Not exercised: all form errors/save outcomes, restricted profiles, expired sessions, backend/network failure simulation, actual screen reader, physical touch device, production load/field latency.

## Technical score

| Dimension | 0–4 | Evidence |
|---|---:|---|
| Accessibility | 2 | Good labeled primitives, but active legacy animal modal lacks focus management/keyboard dismissal. |
| Performance | 2 | Large eagerly imported app; nutrition reads entire history and per-lot requests. |
| Theming | 3 | Shared semantic tokens, with leftover literal/legacy presentation values; no theme picker is promised. |
| Responsive | 3 | No page overflow in four mobile domains; small controls and menu/header overlap remain. |
| Implementation integrity | 3 | Coherent shared components, with UTC/local-date divergence. |
| Total | 13/20 | Acceptable: significant work remains; bounded evidence, not WCAG certification. |

## Verified findings

### P1 — Animal confirmation dialog does not take focus or dismiss with Escape

Location: `client/src/financeiro/financeiro-ui.tsx:164` (Modal); active consumers `pecuaria/rebanho/forms/FormBaixa.tsx:77`, `pecuaria/rebanho/ui.tsx:201`, `telas/DetalheAnimal.tsx:397`. Same hand-built dialog defect exists in access invitation `components/Acessos.tsx:133,165`: browser verified opening “Convidar pessoa” leaves focus outside dialog on trigger. Closed without input/submission.

Category: accessibility. Reproduced by opening “Estornar baixa” on DEV-018: focus remains on underlying “Estornar baixa” trigger, main has neither `inert` nor `aria-hidden`, and pressing Escape on focused trigger leaves dialog open. Code is a `div role=dialog aria-modal=true`, with no focus trap, entry/return focus, Escape listener, or portal primitive. Keyboard users can continue into background controls during a destructive confirmation; screen reader modality does not match actual focus. WCAG 2.4.3 / modal dialog keyboard convention. Reuse existing `DialogFinanceiro`/Radix dialog, preserve confirmation guards and focus restoration. Suggested `$impeccable harden`.

### P1 — “Today” defaults become tomorrow at 21:00 in São Paulo

Location: `client/src/financeiro/financeiro-ui.tsx:15`–17; consumers `financeiro/FormOperacao.tsx:136`, `LiquidarCompromissoModal.tsx:88`, `pecuaria/rebanho/forms/FormBaixa.tsx:26,86`.

Category: implementation integrity/error prevention. `new Date().toISOString().slice(0,10)` uses UTC; e.g. 2026-10-15 22:30−03:00 becomes 2026-10-16. Defaults and maximum dates therefore disagree with the local day, risking wrong financial/event dates and future-date validation after 21:00. Existing `client/src/lib/hoje.ts:getHojeISO` explicitly preserves local calendar date; reports also already have `isoLocal`. Consolidate these helpers and calendar arithmetic, cover timezone rollover. Source-proven and DateTimeOffset conversion verified; browser clock was not overridden. Suggested `$impeccable harden`.

### P2 — Full application is downloaded as one large initial JavaScript chunk

Location: `client/src/App.tsx:11`–33; domain entrypoints eagerly import children (`FinanceiroContent.tsx`, `RebanhoContent.tsx`). Build result is 1,871.87 kB minified / 531.55 kB gzip single JS asset.

Category: performance. Login and simple daily tasks pay for financial, herd, sanitary, nutrition, reporting and admin code before those views are needed. On constrained mobile connectivity this increases startup transfer/parse work. Introduce domain/route lazy boundaries with existing loading patterns; keep common shell eager. No invented Lighthouse or latency score: this is build/graph evidence. Suggested `$impeccable optimize`.

### P2 — Nutrition overview cost grows with complete historical closure data

Location: `pecuaria/rebanho/nutricao/api.ts:98`–104 and 132–139.

Category: performance. Overview fetches every closure page serially before rendering summaries, then requests current vigências for every active lot (concurrency is correctly bounded to four). It also filters full history per lot. Cost increases with years of history even when user only wants today's diet coverage. This limitation is acknowledged in architecture/design docs and is not a correctness bug. Prefer authorized server aggregate or bounded/cacheable summary, preserving Decimal/cents and scope/masking semantics. No production-volume timing measured. Suggested `$impeccable optimize`.

### P2 — Successful clipboard state is shown before copy succeeds

Location: `client/src/components/Acessos.tsx:63`–67.

Category: implementation integrity/recovery. `void navigator.clipboard?.writeText(link); setCopiado(true)` unconditionally announces “Copiado” even if API is unavailable or permission/write rejects. Invitation links cannot be recovered later by backend, so false confirmation can lose the intended handoff. Await copy, show success only after resolution, retain selectable field/manual fallback and error. Source-proven; no invitation created or clipboard modified. Suggested `$impeccable harden`.

### P2 — Mobile menu competes with settings tabs and nutrition heading

Location: `components/ConfiguracoesHub.tsx:72` (pt-7 tab wrapper), `components/AppSidebar.tsx:502` (fixed left-3/top-3 menu), `pecuaria/rebanho/nutricao/Nutricao.tsx:27` (focus without preventScroll).

At 390×844 the fixed menu covers the left portion of the first settings tab (Pecuária); navigation into nutrition focuses `.nutricao-pagina`, scrolling away the deliberate top clearance and placing the title directly under the fixed menu. Screenshots `B/acessos-mobile.jpg` and `B/nutricao-mobile.jpg`. Preserve focus announcement with `focus({preventScroll:true})` and provide consistent mobile clearance before settings tab navigation. Suggested `$impeccable adapt`.

### P2 — Several mobile controls fall below the intended 44px target

Location: `components/AppSidebar.tsx:502` uses h-10/w-10; `components/AssistenteConsulta.tsx:100` trigger; `financeiro/financeiro-ui.tsx:81` min-h-10 and later overrides; access filters `components/acessos.css:11`; sanitary compact rules in `pecuaria/pecuaria-refino.css:54`.

Measured 390×844: menu 40×40, assistant 125.6×36, access invitation/filter controls 40 high; sanitary Gerenciar protocolos/procedimentos, Novo ciclo, filters and pagination 40 high. This is a usability/44px comfort finding, not an automatic WCAG 2.5.8 AA failure (24px minimum and spacing exceptions differ). Shared mobile CSS already attempts a 44px minimum but late/specific rules defeat it. Consolidate touch geometry while preserving desktop density. Suggested `$impeccable adapt`.

## Mobile evidence and limitations

IAB viewport emulation 390×844, not physical device or synthesized touch. Financial overview, access screen/invitation, sanitary cycles, inventory and nutrition overview were measured/captured and screenshots inspected. All four main mobile domains and access page had document scrollWidth/clientWidth 375/375 (15px reserved scrollbar), so no page-level horizontal overflow in this sample. Inventory correctly switches tables to cards (desktop table parents display:none). Sanitary tabs deliberately use own horizontal scroll. Nutrition auto-focus moved header beneath fixed menu as noted. Invitation dialog is taller than viewport (854.9px vs844px), with document scrolling; not classified as blocked. Viewport override reset afterward. Screenshots retained under `C:/Users/mathe/.codex/visualizations/2026/10/15/impeccable-client/B/` (estoque-desktop, acessos-mobile, convite-mobile, financeiro-mobile, sanidade-mobile, estoque-mobile, nutricao-mobile). Did not exercise touch gestures, 200% zoom, all forms, every detail/mobile tab, or offline flows. Seven verified issues: P0=0, P1=2, P2=5, P3=0 (raw border hints excluded).

## Detector: deterministic hints, not automatic defects

10 raw warnings, 2 rules: `side-tab` 7; `border-accent-on-rounded` 3. Locations:

- side-tab: `financeiro/CalendarioCompromissos.tsx:63`; `financeiro/DetalheCategoriaDespesa.tsx:19`; `pecuaria/pecuaria-refino.css:71,132`; `pecuaria/rebanho/sanidade/sanidade.css:8`; `styles/acessos.css:81`; `styles/base.css:754`.
- border-accent-on-rounded: `pecuaria/pecuaria-refino.css:106,124,128`.

Context verification: calendar and category borders carry incoming/outgoing/reversal meaning plus explicit text/icon, so they are not misleading content or accessibility violations. `sanidade-ciclo-ativo` is not currently applied to the list: list only renders when no rodadaId, and detail replaces it when rodadaId exists (AgendaRodadas.tsx:23), so that active-style hit is unreachable there. Access warning is `.mask-notice`, a meaningful masked-values notice, not a generic decorative card. Base hit is toast border with state/notification role. Rounded accent hits match actual recipe/help/new-animal containers; animal header and vigente diet use left accent. They verify visual repetition of border accents, but do not justify P1/P2 technical failure on their own. Keep as optional P3 consistency observations for visual assessment, rather than inflate defect count or automatically remove them.

## Positive practices

Shared `TabelaFinanceira` adapts columns into mobile cards, isolates horizontal table overflow, avoids nested mobile action buttons and supplies captions. Searchable Radix select keeps filtered options mounted for native form value, removes them from navigation, supports accent-insensitive search and restores focus. `CampoFormulario` connects labels/errors; financial form focuses first invalid input. Most async queries invalidate stale responses. Assistant uses status/log live regions, labels media controls, announces processing, and explicitly states read-only scope; legacy assistant remains feature-disabled. Semantic domain tokens and operational text labels prevent reliance on chart color alone.

## Run notes for parent synthesis

CLI complete; full JSON and build log retained intentionally as audit evidence. Overlay unavailable: browser evaluate is explicitly read-only, so no mutation preflight/injection/live-server attempted; no overlay claimed. Browser remained background; visibility not forced. Existing dev servers unchanged, no critique server started. No temporary report-body files yet; no UI fixes. Parent owns final slug/persistence/trend/question gate.
