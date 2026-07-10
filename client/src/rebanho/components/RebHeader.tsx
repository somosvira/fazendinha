/* Cabeçalho editorial padrão das telas do rebanho (eyebrow + título com régua).
 * Reproduz .rb-eyebrow + .rb-head (rebanho.css) em Tailwind, usado tanto pelo
 * HerdDomainView quanto pelos estados de loading/erro das abas. Mantém a mesma
 * régua (border-b rule) e o respiro (mb-18) para não colar no que vem depois. */

import * as React from "react";
import { cn } from "@/lib/utils";

export function RebHeader({
  eyebrow,
  title,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <>
      {eyebrow != null && (
        <div className="text-sm font-bold uppercase tracking-[.1em] text-cafe">{eyebrow}</div>
      )}
      <div className={cn("mb-[18px] mt-1 flex items-end justify-between gap-5 border-b border-[color:var(--rule)] pb-4", className)}>
        <h1 className="mt-1 font-serif text-[38px] font-medium leading-[1.05]">{title}</h1>
        {actions}
      </div>
    </>
  );
}
