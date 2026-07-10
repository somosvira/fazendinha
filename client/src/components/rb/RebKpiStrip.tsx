/* Faixa de KPIs dos módulos operacionais — Fase 5/6 da migração shadcn.
 *
 * Reproduz .rb-kstrip / .rb-k / .lab / .val / .d (rebanho.css) em Tailwind.
 * Compositível: <RebKpiStrip cols={n}> com filhos <RebKpi>. Callers que
 * precisam de célula custom (borda colorida, tamanho de fonte) passam
 * className/style no <RebKpi> ou renderizam a própria <div> como filho.
 *
 * Valores 1:1 com o CSS legado: strip margin 22/0/24; cada célula
 * padding 6/22/4 com border-left rule-soft (exceto a 1ª). lab 14px/600
 * uppercase; val serif 32px/500; d 15px. Preflight OFF → cores explícitas. */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface RebKpiStripProps extends React.HTMLAttributes<HTMLDivElement> {
  cols: number;
}

export function RebKpiStrip({ cols, className, style, children, ...props }: RebKpiStripProps) {
  return (
    <div
      className={cn("my-[22px] grid gap-0 overflow-visible", className)}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

export interface RebKpiProps extends React.HTMLAttributes<HTMLDivElement> {
  lab: React.ReactNode;
  val: React.ReactNode;
  /** sufixo pequeno após o valor (ex.: "%", "d") */
  sufixo?: React.ReactNode;
  /** linha de detalhe abaixo do valor */
  d?: React.ReactNode;
  /** tom do detalhe: up (prejuízo/vermelho) ou ok (lucro/verde) */
  tom?: "up" | "ok";
  /** classe extra no valor (ex.: tamanho/cor custom) */
  valClassName?: string;
}

/* .rb-k — a primeira célula perde a border-left e o padding-left (via first:). */
export function RebKpi({
  lab,
  val,
  sufixo,
  d,
  tom,
  valClassName,
  className,
  ...props
}: RebKpiProps) {
  return (
    <div
      className={cn(
        "relative border-l border-[color:var(--rule-soft)] bg-transparent px-[22px] pt-1.5 pb-1 first:border-l-0 first:pl-0.5",
        className,
      )}
      {...props}
    >
      <div className="text-sm font-semibold uppercase tracking-[.06em] text-ink-2">{lab}</div>
      <div className={cn("mt-1.5 font-serif text-[32px] font-medium leading-none text-[color:var(--ink)]", valClassName)}>
        {val}
        {sufixo != null && <small className="text-[13px]">{sufixo}</small>}
      </div>
      {d != null && (
        <div
          className={cn(
            "mt-2 text-[15px] font-medium text-ink-2",
            tom === "up" && "text-prejuizo",
            tom === "ok" && "text-lucro",
          )}
        >
          {d}
        </div>
      )}
    </div>
  );
}
