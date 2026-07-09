# shadcn/ui — Fase 3 (Gastos/Lançar/forms/datepicker) — Plano/slicing

> Segue o playbook `docs/superpowers/specs/2026-07-08-shadcn-migration-playbook.md`. Parent: design §3 fase 3.
> **Recomendação:** cada slice em sessão fresca; verificar visual com app rodando (DevTools), não só build+jsdom.

## Achados críticos do mapeamento (LER ANTES)

- **MonthRangePicker JÁ MIGROU** (PR #112, mês único + Radix Select) — fora do escopo. O primitivo `ui/select.tsx` e o wrapper `ToolbarSelect` já existem.
- **Compartilhamento que trava aposentadoria:** `field-label`/`field-input` são usados por Lançar, PlanoContas **e Acessos** (fase 7); `btn-primary`/`btn-ghost` por 6 arquivos (Dashboard, Relatório, DateRangePicker, Acessos…). Migrar os consumidores da fase 3, mas **os blocos CSS `field-*`/`btn-*` só morrem quando Acessos migrar (fase 7)**. Aposentar de forms.css apenas o que zerar consumo (form-section*, rc-*, etc.).
- **typescale.css sobrepõe forms/drp** (importado por último — conferir SEMPRE o valor real): `.field-label` 14/600 · `.field-input`/`.field-textarea` **16px** · `.form-section-title` 14/600/0.10em · `.drp-trigger` 14/600 · `.drp-preset` 14/500 · `.drp-readout-cell .v` **19px**/500.
- **Gastos.tsx quase não tem CSS próprio** (só `act-pill`, compartilhada) — o peso da tela é `financeiro/ContasAVencer.tsx` (inline styles + `.search-box`) e os cards de vigilância (`anom-*`, dashboard-v2.css). Slice de Gastos é pequeno.
- **Caixinha usa o shell `rb-*`** (rb-fld/rb-btn/rb-k) → pertence à fase 6 com os módulos, NÃO à 3 (o spec já a punha na 6).
- **DateRangePicker: manter o calendário pt-BR próprio** (11 presets, "Hoje" pinado) — migrar só o chrome (drp-*) para Tailwind + primitivo `popover`. NÃO adotar react-day-picker/calendar shadcn nesta fase (muda comportamento, dependência nova, zero ganho).
- **Relatório novo (Fechamento Mensal, relatorio.css ~8KB)** substituiu a versão editorial na main durante a fase 2 — re-migração é o slice final (opcional) desta fase.
- **Antes de abrir a branch: conferir regressão da main** (`grep theme.css client/src/main.tsx` deve bater) — episódio dos PRs #110/111/113 documentado na memória; branches paralelas do usuário podem partir de base velha.
- **Preflight OFF:** todo `<button>` novo precisa `bg-transparent`/reset explícito (classe de bug já pega 2× em reviews).

## APIs (preservar; consumidores em App.tsx)

- `Gastos({ onNav })`, `Lancar()`, `PlanoContas()` — trocas de aba via App.tsx; máscara de valores por flags em Gastos.
- `DateRangePicker({ value, onChange, ... })` + tipo `DateRange` (importado por N arquivos — NÃO mudar a forma).
- `ContasAVencer` usa `useToast` (ToastProvider) e o smoke test SSR `financeiro/__smoke__/render.test.ts` (hoje quebrado em main: asserta "Contas a vencer" vs render "Contas" — **corrigir o teste neste slice**, é a única falha da suíte).

## Slicing (ordem, menor risco primeiro)

1. **Primitivas:** `textarea` (shadcn, forwardRef R18, tokens) + `popover` (Radix `@radix-ui/react-popover`) em `ui/`. Testes SSR/jsdom no padrão de `primitives.test.ts`. (checkbox/radio: só se o inventário do slice 2 exigir — YAGNI.)
2. **Lançar (o grosso):** `Lancar.tsx` (1.254 linhas, 16× field) → Tailwind + ui/input/label/textarea/select. Aposenta de forms.css o monopolizado (`form-section*`, `rc-*`, `req`); `field-*` fica (Acessos). Form tem estado/validação — preservar comportamento; teste jsdom dos fluxos principais.
3. **PlanoContas/Categorias:** field-*/btn-*/cells → Tailwind + primitivos; migrar botões para `ui/button` (blocos btn-* ficam vivos p/ Acessos).
4. **Gastos + ContasAVencer:** `.search-box` → Tailwind (+ `ui/input`); cards `anom-*` → Tailwind (aposentar de dashboard-v2.css se exclusivos — conferir); **corrigir o smoke test ContasAVencer**.
5. **DateRangePicker:** chrome `drp-*` → Tailwind + `ui/popover` (calendário interno intacto); aposenta `datepicker.css` (conferir exclusividade classe a classe antes).
6. **(opcional/estende a fase) Relatório Fechamento:** relatorio.css (`ver-*`/`fech-*`/`veredicto`) → Tailwind + primitivos `report/`; cuidado com o export PDF (html2pdf lê o DOM — validar o PDF depois da migração; foi exatamente o que quebrou antes com `color-mix()`).

DoD por slice (playbook): build+tsc verdes · testes (jsdom p/ interativo, SSR p/ layout) · paridade visual **com app rodando** (typescale conferida classe a classe) · CSS aposentado deletado do arquivo real · APIs intactas · commit por slice.
