/* Primitivos compartilhados leves dos módulos operacionais — Fase 7 shadcn.
 *
 * Reproduzem 1:1 (rebanho.css) os elementos de layout pequenos consumidos por
 * rebanho/corte/plantio/cultivo/equipe/caixinha. Cada um sobre elemento nativo
 * com classes Tailwind + tokens; preflight OFF → bg/reset explícitos.
 *
 *  RebMain      → .rb-main       (shell de conteúdo, max-width + padding fluido)
 *  RebBox       → .rb-box        (cartão com <h4> uppercase; + RebBoxSection)
 *  RebKv        → .rb-kv         (linha chave/valor, dashed divider)
 *  RebPill      → .rb-pill       (etiqueta; tom ok/warn/bad)
 *  RebAnm       → .rb-anm        (nome do animal/entidade + <small>)
 *  RebEmpty     → .rb-empty      (estado vazio tracejado)
 *  RebFieldset  → .rb-fieldset   (bloco com <legend> serif itálico)
 */

import * as React from "react";
import { cn } from "@/lib/utils";

/* .rb-main { max-width:1520px; margin:0 auto; padding:28px clamp(24,4vw,56) 80px }
 * @media(min-width:1700px) padding-x clamp(40,5vw,96). O clamp lateral fica no
 * padding via arbitrary; o breakpoint 1700 vira min-[1700px]. */
export const RebMain = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "mx-auto max-w-[1520px] px-[clamp(24px,4vw,56px)] pt-7 pb-20 min-[1700px]:px-[clamp(40px,5vw,96px)]",
        className,
      )}
      {...props}
    />
  ),
);
RebMain.displayName = "RebMain";

/* .rb-box + .rb-box h4 (uppercase, ink-3) */
export const RebBox = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "mb-4 rounded-[10px] border border-[color:var(--rule-soft)] bg-card px-4 py-[15px] [&>h4]:m-0 [&>h4]:mb-[11px] [&>h4]:text-sm [&>h4]:uppercase [&>h4]:tracking-[0.06em] [&>h4]:text-ink-3",
        className,
      )}
      {...props}
    />
  ),
);
RebBox.displayName = "RebBox";

/* .rb-box-section — separador dashed entre seções internas do box */
export const RebBoxSection = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "[&+&]:mt-3.5 [&+&]:border-t [&+&]:border-dashed [&+&]:border-[color:var(--rule-soft)] [&+&]:pt-3.5 [&>h4]:m-0 [&>h4]:mb-[9px] [&>h4]:text-sm [&>h4]:uppercase [&>h4]:tracking-[0.06em] [&>h4]:text-ink-3",
        className,
      )}
      {...props}
    />
  ),
);
RebBoxSection.displayName = "RebBoxSection";

/* .rb-kv { flex justify-between; padding 5px 0; border-bottom dashed } + b:600 */
export const RebKv = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex justify-between border-b border-dashed border-[color:var(--rule-soft)] py-[5px] text-sm last:border-0 [&_b]:font-semibold",
        className,
      )}
      {...props}
    />
  ),
);
RebKv.displayName = "RebKv";

type PillTone = "ok" | "warn" | "bad";
const PILL_TONE: Record<PillTone, string> = {
  // .rb-pill (default outros/sage)
  ok: "bg-[color:var(--outros-soft)] text-[#42523a]",
  // .rb-pill.warn
  warn: "bg-[color:var(--leite-soft)] text-[#6e5a26]",
  // .rb-pill.bad
  bad: "bg-[#EEDAD3] text-prejuizo",
};
export interface RebPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
}
/** .rb-pill — etiqueta arredondada; tom ok(default)/warn/bad. */
export const RebPill = React.forwardRef<HTMLSpanElement, RebPillProps>(
  ({ className, tone = "ok", ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "rounded-[11px] px-[9px] py-0.5 text-sm font-semibold",
        PILL_TONE[tone],
        className,
      )}
      {...props}
    />
  ),
);
RebPill.displayName = "RebPill";

/* .rb-anm { font-weight:600; color:ink } .rb-anm small { ink-2; 500 } */
export const RebAnm = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "font-semibold text-foreground [&_small]:font-medium [&_small]:text-ink-2",
        className,
      )}
      {...props}
    />
  ),
);
RebAnm.displayName = "RebAnm";

/* .rb-empty — estado vazio tracejado */
export const RebEmpty = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[10px] border border-dashed border-border bg-[color:var(--bg-card-2)] p-[22px] text-sm text-ink-3",
        className,
      )}
      {...props}
    />
  ),
);
RebEmpty.displayName = "RebEmpty";

/* Strings de classe para os poucos controles especializados (composição de
 * sangue no form de animal/cobertura; célula editável da grade de Ponto).
 * São reutilizadas inline pelos forms na migração — evitam re-derivar o CSS. */

// .rb-sangue-row (grid 1fr 130px, dashed divider)
export const REB_SANGUE_ROW =
  "grid grid-cols-[1fr_130px] items-center gap-3 border-b border-dashed border-[color:var(--rule-soft)] py-2 last:border-b-0";
// .rb-sangue-raca (nome da raça principal)
export const REB_SANGUE_RACA = "font-sans text-sm font-medium text-foreground";
// .rb-sangue-frac / .rb-sangue-raca-sec (select/input de borda-inferior)
export const REB_SANGUE_INPUT =
  "font-sans text-sm text-foreground bg-transparent border-0 border-b border-b-border rounded-none px-0.5 py-1.5 transition-colors focus:outline-none focus:border-b-[color:var(--cafe)]";
// .rb-sangue-frac-comp (fração composta, ink-3 itálico)
export const REB_SANGUE_FRAC_COMP = "font-sans text-sm italic text-ink-3";

// .rb-inp (input inline de célula editável — grade de Ponto)
export const REB_INP =
  "font-sans text-sm text-foreground bg-[color:var(--bg)] border border-border rounded-lg px-2.5 py-1.5 leading-tight transition-colors hover:border-ink-2 focus:outline-none focus:border-[color:var(--cafe)] placeholder:text-ink-3";

/* Chrome de cabeçalho/seção reutilizado nas telas (não são wrappers próprios —
 * strings de classe aplicadas inline no PR-3). Reproduzem rebanho.css 1:1. */

// .rb-sub (subtítulo do cabeçalho, ink-3)
export const REB_SUB = "mt-[7px] text-sm text-ink-3";
// .rb-sec-sub (subtítulo de seção, ink-3)
export const REB_SEC_SUB = "mb-4 text-sm text-ink-3";
// .rb-crumb (breadcrumb-botão) + <b> ink-2
export const REB_CRUMB =
  "mb-4 cursor-pointer border-0 bg-none p-0 font-sans text-sm text-ink-3 [&_b]:text-ink-2";
// .rb-chips (linha de chips)
export const REB_CHIPS = "flex flex-wrap gap-2";
// .rb-chip (chip base) — tons preg/lact via classe extra (ver REB_CHIP_PREG/LACT)
export const REB_CHIP =
  "rounded-[13px] border border-border px-[11px] py-[5px] text-sm font-semibold";
export const REB_CHIP_PREG =
  "bg-[color:var(--cafe-soft)] text-cafe border-[#D8C3A8]";
export const REB_CHIP_LACT = "bg-[color:var(--leite-soft)] text-[#6e5a26] border-[#E0CF9E]";
// .rb-chip-q (chip de pergunta sugerida da IA)
export const REB_CHIP_Q =
  "cursor-pointer rounded-[14px] border border-border bg-card px-3 py-1.5 font-sans text-sm text-ink-2 hover:border-cafe hover:text-cafe disabled:cursor-default disabled:opacity-55";
// .rb-chip-demo (etiqueta "demonstração")
export const REB_CHIP_DEMO =
  "mt-[9px] inline-block rounded-[10px] border border-[color:var(--rule-soft)] px-2 py-0.5 text-sm font-semibold uppercase tracking-[0.04em] text-ink-2";
// .rb-grid (cockpit: conteúdo + coluna lateral; empilha < 900px via max-[900px])
export const REB_GRID =
  "mt-2 grid grid-cols-[minmax(0,1fr)_clamp(280px,24vw,360px)] gap-[clamp(20px,2.4vw,36px)] max-[900px]:grid-cols-1";
// .rb-pag / -info / -ctrl / -page (paginação de tabela)
export const REB_PAG =
  "mt-3 flex items-center justify-between gap-3 font-sans text-[13.5px] text-ink-3";
export const REB_PAG_INFO = "italic";
export const REB_PAG_CTRL = "flex items-center gap-2.5";
export const REB_PAG_PAGE = "font-semibold text-ink-2";

/* .rb-fieldset + > legend (serif itálico, ink-3) */
export const RebFieldset = React.forwardRef<
  HTMLFieldSetElement,
  React.FieldsetHTMLAttributes<HTMLFieldSetElement>
>(({ className, ...props }, ref) => (
  <fieldset
    ref={ref}
    className={cn(
      "mx-0 mb-3.5 mt-0 rounded-[10px] border border-[color:var(--rule-soft)] bg-card px-3.5 pb-1 pt-3 [&>legend]:px-1.5 [&>legend]:font-serif [&>legend]:text-sm [&>legend]:italic [&>legend]:text-ink-3",
      className,
    )}
    {...props}
  />
));
RebFieldset.displayName = "RebFieldset";
