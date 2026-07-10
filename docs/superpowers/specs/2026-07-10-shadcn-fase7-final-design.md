# Fase 7 (final) — Migração shadcn: encerramento

**Data:** 2026-07-10
**Status:** aprovado — executar as 5 PRs em ordem, sem confirmação intermediária (autonomia total do usuário).
**Precede:** implementação (writing-plans).

## 1. Contexto

A migração `client/` → Tailwind v4 + shadcn (Radix) está nas Fases 0–6 já em `main` (PRs #112/#116/#117/#119). Fase 7 é o **encerramento**: aposentar TODAS as folhas CSS bespoke restantes, ligar o **Tailwind preflight**, e deixar o app inteiro sobre Tailwind + primitivos.

Inventário real (conferido na árvore, não só na memória):

- **`rebanho.css` (434 linhas)** é um monólito global compartilhado por rebanho/corte/plantio/cultivo/equipe/caixinha. Dele:
  - **~70 seletores estão MORTOS** (definidos, 0 consumidores no JSX) → deleção imediata sem risco.
  - **~57 famílias `.rb-*` ainda VIVAS** (definidas E usadas): `rb-fld` (252 usos, todo campo de form), `rb-main` (75), `rb-kv` (35), `rb-anm` (34), `rb-pill` (29), `rb-empty` (24), `rb-k`/`rb-box`/`rb-sec-sub`/`rb-row`/`rb-chip-q`/`rb-toolbar`/`rb-btn`/`rb-drawer`/`rb-select`/`rb-pag`/`rb-crumb`/`rb-sangue-*`/`rb-fieldset`/`rb-inp` + resíduo de cockpit (`rb-tl-card`/`rb-ev-flash` keyframes). Distribuídas em **69 arquivos** de 6 módulos.
- **3 telas legadas** ainda em CSS próprio: **Acessos** (`acessos.css` 10KB), **Vigilância** (`vigilancia.css` 9KB), **Simulador** (`simulador.css` 4KB).
- **Relatório novo** (Fechamento Mensal) em `relatorio.css` (8KB) — supersedeu a versão Tailwind editorial na reconciliação da main; precisa re-migração.
- **Preflight OFF** hoje: `theme.css` importa só `tailwindcss/theme.css`+`utilities.css` (layers) + um shim de border/box em `@layer base`. Ligar preflight pode regredir qualquer tela não 100% migrada — por isso é o ÚLTIMO passo.

Baseline no início da Fase 7: **tsc client limpo, 140/140 testes verdes**. Esse é o estado a preservar.

## 2. Objetivo e não-objetivos

**Objetivo:** ao fim da Fase 7 — `rebanho.css`, `acessos.css`, `vigilancia.css`, `simulador.css`, `relatorio.css` **deletados**; preflight **ON**; nenhuma classe `.rb-*`/legada de layout restante no JSX (exceto keyframes que viram utilitários próprios); identidade editorial (papel/tinta, brass/coffee/sage, Newsreader/DM Sans, cantos retos) preservada pixel-a-pixel.

**Não-objetivos:** mudar comportamento/lógica de qualquer tela; refatorar backend; tocar `base.css`/`dashboard*.css`/`cockpit.css`/`forms.css`/`typescale.css`/`terrano-intro.css` além de remover CSS órfão que a Fase 7 tornar morto (essas folhas têm consumidores legítimos ainda — Dashboard, ClasseToggle, loading trator etc.).

## 3. Decomposição — 5 PRs (cada uma shippável e green-gated)

Gate de cada PR: `tsc --noEmit` client limpo + `pnpm --filter rionovo-client run test` verde + `pnpm build` verde + QA visual das telas tocadas no app rodando. Merge quando verde (autonomia CI-green).

### PR-1 — Primitivos de form + purga do CSS morto (aditivo, risco zero)
- Novos primitivos em `client/src/components/rb/`:
  - **`RebField`** — reproduz `.rb-fld` 1:1: wrapper `<label>` em coluna (serif itálico, ink-3), com `input/select/textarea` de borda-inferior (transparent, border-bottom rule → cafe no focus). O **select-arrow customizado** (hoje `background-image` data-URI em `.rb-fld select`) vira uma **classe utilitária `.rb-field-select` em `@layer components` no `theme.css`** (mantém o data-URI em CSS real, fora do parser de arbitrary-value do Tailwind). Variante `input.rb-fld`/`select.rb-fld` (look de input com borda completa, usado na busca) → prop `variant="boxed"`.
  - **`RebFieldset`** (`.rb-fieldset`+`legend`) e **`RebSangue*`** (`.rb-sangue-row`/`-raca`/`-frac`/`-frac-comp`) — usados só no form de animal (composição sanguínea).
  - **`RebBox`/`RebBoxSection`** (`.rb-box`+`h4`+`.rb-box-section`), **`RebKv`** (`.rb-kv` key/value), **`RebPill`** (`.rb-pill` + `.warn`/`.bad`), **`RebAnm`** (`.rb-anm`), **`RebEmpty`** (`.rb-empty`), **`RebMain`** (`.rb-main` container).
  - Cada primitivo com teste SSR-string (convenção `ui/button.test.ts` / `RebButton.test.tsx`).
- Deletar de `rebanho.css` os ~70 seletores mortos (conferir cada um sem consumidor via grep antes).
- **Sem migração de JSX ainda.** rebanho.css continua vivo para os consumidores atuais.

### PR-2 — Migração dos campos de form (rb-fld/fieldset/sangue)
- Trocar os 252 `rb-fld` + `rb-fieldset` + `rb-sangue-*` + `rb-inp` no JSX pelos primitivos, nos **69 arquivos** dos 6 módulos.
- Execução: subagentes **um por módulo**, no **checkout principal SEM worktree isolation**, em batches sequenciais (lição da Fase 5/6: worktree pega base desatualizada; dirs disjuntos → sem tangle; tudo commitado antes de cada batch). Cada agente lê um form já migrado do rebanho como referência.
- Verificação autoritativa: tsc/build/test UMA vez com TODOS os agentes terminados.

### PR-3 — Migração do chrome restante + deleção do rebanho.css
- Migrar `rb-kv`/`rb-box`/`rb-box-section`/`rb-pill`/`rb-anm`/`rb-empty`/`rb-main`/`rb-drawer*`/`rb-select`/`rb-pag*`/`rb-crumb`/`rb-chip*`/`rb-dcard*`/`rb-ia-band`/`rb-sec-sub`/`rb-sub`/`rb-grid`/`rb-ev`/`rb-tl*`/`rb-confirm-*`/`rb-success-*`/`rb-baixa-*` para primitivos/Tailwind.
- Keyframes (`rb-fade-in`/`rb-modal-in`/`rb-tl-card-flash`/`rb-ev-flash`) → migrar os `@keyframes` para `@layer utilities`/`theme.css` como utilitários próprios OU manter num arquivo `animations.css` mínimo (decidir no plano; preferência: mover p/ theme.css e matar rebanho.css inteiro).
- **Deletar `client/src/rebanho/styles/rebanho.css`** e seu import em `main.tsx`. Confirmar `grep -rn 'rb-' client/src --include=*.tsx` só retorna hooks do RebTable (`rb-row`/`rb-tbl-group`) já reproduzidos pelos seletores descendentes do primitivo.

### PR-4 — Telas legadas: Acessos, Vigilância, Simulador, Relatório
- **Acessos** (`Acessos.tsx`) → Tailwind + primitivos ui/rb; retirar `acessos.css`.
- **Vigilância** (`Vigilancia.tsx`) → Tailwind; retirar `vigilancia.css`.
- **Simulador** (`Simulador.tsx`) → Tailwind (gráficos SVG próprios mantidos); retirar `simulador.css`.
- **Relatório** (`Relatorio.tsx` — Fechamento Mensal) → Tailwind + primitivos `report/` já existentes + o que faltar; retirar `relatorio.css`. `html2pdf`/PDF export preservado.
- 4 telas isoladas → baixo risco; QA visual de cada uma.

### PR-5 — Preflight ON + QA final
- Ligar preflight: em `theme.css` trocar os imports parciais por `@import "tailwindcss"` completo (ou adicionar `tailwindcss/preflight.css layer(base)`), remover o shim manual de border/box do `@layer base`.
- **QA do app inteiro** (todas as abas financeiras + 6 módulos + 3 telas legadas + Relatório) no browser — preflight zera margens/bordas default e pode expor telas que dependiam de reset implícito.
- Remover `@media` órfãs e CSS morto que a Fase 7 tornou sem consumidor (varredura final).
- Atualizar memória [[shadcn-migration-direction]] → migração COMPLETA.

## 4. Arquitetura / unidades

- `client/src/components/rb/*` — primitivos compartilhados (RebButton/RebKpiStrip/RebTable/RebModal já existem; + RebField/RebFieldset/RebSangue/RebBox/RebKv/RebPill/RebAnm/RebEmpty/RebMain). Cada um: um arquivo, API mínima, teste SSR isolado, reproduz o CSS 1:1 sem depender dele.
- `client/src/styles/theme.css` — ganha `@layer components` com utilitários que precisam de CSS real (select-arrow data-URI). No PR-5 vira dono do preflight.
- Telas legadas (`Acessos`/`Vigilancia`/`Simulador`/`Relatorio`) — reescritas sobre primitivos; APIs públicas (`{onNav}` etc.) intactas.

## 5. Riscos & mitigações

1. **Preflight regride telas** → é o ÚLTIMO PR, isolado; QA do app inteiro antes do merge; reversível (1 linha em theme.css).
2. **Drift visual em 252 campos** → RebField reproduz `.rb-fld` 1:1 incl. select-arrow; QA de forms representativos por módulo; DoD exige paridade.
3. **Worktree pega base velha** (custou 3 agentes na Fase 5) → subagentes no checkout principal sem isolation, sequenciais, tudo commitado antes.
4. **rebanho.css compartilhado** → só deletar no fim do PR-3, depois de confirmar 0 consumidores de layout (só hooks do RebTable restam).
5. **Concorrência de tsc entre agentes paralelos** → verificação autoritativa uma vez, com todos terminados.

## 6. Definition of Done (Fase 7 inteira)

- `rebanho.css`, `acessos.css`, `vigilancia.css`, `simulador.css`, `relatorio.css` **deletados** e imports removidos de `main.tsx`.
- Preflight **ON**; shim manual removido.
- `grep -rn 'className=.*\brb-' client/src --include=*.tsx` → só hooks internos do RebTable (`rb-row`/`rb-tbl-group`).
- tsc + build + testes verdes; QA visual do app inteiro pós-preflight.
- Identidade editorial preservada.
