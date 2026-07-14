/* Primitivo compartilhado dos módulos operacionais — Fase 7 da migração shadcn.
 *
 * RebField reproduz `.rb-fld` (rebanho.css) 1:1: um <label> em coluna (serif
 * itálico, ink-3) cujos input/select/textarea descendentes ganham o look de
 * borda-inferior (transparent, border-bottom rule → cafe no focus). O <select>
 * usa a seta customizada `.rb-field-select` (data-URI em theme.css @layer
 * components). Preflight OFF → resets/bg explícitos.
 *
 * `REB_FIELD_BOXED` reproduz `input.rb-fld` / `select.rb-fld` (look de input com
 * borda completa e cantos, usado na busca) — aplicado direto no controle.
 *
 * Composição: <RebField label="Nome"><input .../></RebField>. O chrome dos
 * controles vem de seletores descendentes ([&_input], [&_select]...), então o
 * caller passa o controle nativo sem classes de estilo. */

import * as React from "react";
import { cn } from "@/lib/utils";

// .rb-fld input/select/textarea + focus, via seletores descendentes.
const CONTROLS =
  "[&_input]:font-sans [&_input]:text-sm [&_input]:text-foreground [&_input]:border-0 [&_input]:border-b [&_input]:border-b-border [&_input]:rounded-none [&_input]:px-0.5 [&_input]:py-2 [&_input]:bg-transparent [&_input]:transition-colors [&_input:focus]:outline-none [&_input:focus]:border-b-[color:var(--cafe)] " +
  "[&_select]:font-sans [&_select]:text-sm [&_select]:text-foreground [&_select]:border-0 [&_select]:border-b [&_select]:border-b-border [&_select]:rounded-none [&_select]:px-0.5 [&_select]:py-2 [&_select]:bg-transparent [&_select]:transition-colors [&_select:focus]:outline-none [&_select:focus]:border-b-[color:var(--cafe)] [&_select:hover]:border-b-ink-2 " +
  "[&_textarea]:font-sans [&_textarea]:text-sm [&_textarea]:text-foreground [&_textarea]:border-0 [&_textarea]:border-b [&_textarea]:border-b-border [&_textarea]:rounded-none [&_textarea]:px-0.5 [&_textarea]:py-2 [&_textarea]:bg-transparent [&_textarea]:transition-colors [&_textarea:focus]:outline-none [&_textarea:focus]:border-b-[color:var(--cafe)]";

// .rb-fld (label wrapper) — serif itálico, ink-3
const LABEL =
  "mb-3.5 flex flex-col gap-1.5 font-serif text-sm font-medium normal-case italic tracking-normal text-ink-3";

// input.rb-fld / select.rb-fld — look de input completo (variante "boxed")
export const REB_FIELD_BOXED =
  "block font-sans not-italic text-sm normal-case tracking-normal text-foreground bg-card border border-border rounded-lg px-3 py-2";

export interface RebFieldProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /** texto do rótulo (serif itálico) — antes do controle */
  label?: React.ReactNode;
}

/** Rótulo + controle de formulário no estilo editorial (.rb-fld). */
export const RebField = React.forwardRef<HTMLLabelElement, RebFieldProps>(
  ({ className, label, children, ...props }, ref) => (
    <label ref={ref} className={cn(LABEL, CONTROLS, className)} {...props}>
      {label != null && <span>{label}</span>}
      {children}
    </label>
  ),
);
RebField.displayName = "RebField";
