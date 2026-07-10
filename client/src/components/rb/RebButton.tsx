/* Primitivo compartilhado dos módulos operacionais (rebanho/corte/plantio/
 * cultivo/equipe/caixinha) — Fase 5/6 da migração shadcn.
 *
 * RebButton reproduz .rb-btn / .rb-btn.pri / .rb-btn[aria-pressed] /
 * .rb-btn-danger (rebanho.css) sobre <button> nativo com classes Tailwind.
 * Valores 1:1: 14px/600, radius 8px, padding 7/13. Preflight OFF → bg/reset
 * explícitos. */

import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "pri" | "danger";

export interface RebButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const BASE =
  "cursor-pointer rounded-[var(--radius-btn)] px-[13px] py-[7px] font-sans text-sm font-semibold transition-colors disabled:cursor-not-allowed";

const VARIANTS: Record<Variant, string> = {
  // .rb-btn (base) + aria-pressed
  default:
    "border border-border bg-transparent text-ink-2 aria-pressed:border-ink-2 aria-pressed:bg-[color:var(--bg-card-2)] aria-pressed:text-foreground",
  // .rb-btn.pri
  pri: "border-0 bg-mast text-mast-ink",
  // .rb-btn-danger
  danger:
    "border-0 bg-prejuizo font-semibold text-white hover:not-disabled:bg-[color:color-mix(in_srgb,var(--prejuizo)_88%,black)] disabled:bg-[color:color-mix(in_srgb,var(--prejuizo)_35%,var(--rule-soft))] disabled:text-[rgba(255,255,255,0.8)]",
};

export const RebButton = React.forwardRef<HTMLButtonElement, RebButtonProps>(
  ({ className, variant = "default", type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(BASE, VARIANTS[variant], className)} {...props} />
  ),
);
RebButton.displayName = "RebButton";
