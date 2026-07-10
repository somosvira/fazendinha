/* Tabela dos módulos operacionais — Fase 5/6 da migração shadcn.
 *
 * Reproduz .rb-tbl-wrap + table.rb-tbl (rebanho.css) em Tailwind. É só o
 * "chrome" estilizado: o caller passa <thead>/<tbody> como filhos, então
 * cada tela mantém suas próprias colunas/linhas. th/td são estilizados via
 * seletores descendentes arbitrários (Preflight OFF → precisa ser explícito).
 *
 * Valores 1:1 com o CSS: wrap com scroll-x; table w-full border-collapse
 * bg-card border rule-soft radius 10; th serif italic 14/500 ink-3
 * padding 12/14 border-b rule; td padding 12/14 border-b rule-soft 14 ink-2;
 * última linha sem borda. Linha clicável = classe "rb-row" (hover bg-card-2). */

import * as React from "react";
import { cn } from "@/lib/utils";

/* seletores descendentes que recriam .rb-tbl th/td e o hover de tr.rb-row */
const TABLE_CHROME = [
  "w-full border-collapse rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)]",
  // th
  "[&_th]:border-b [&_th]:border-[color:var(--rule)] [&_th]:px-[14px] [&_th]:py-3 [&_th]:text-left [&_th]:font-serif [&_th]:text-sm [&_th]:font-medium [&_th]:italic [&_th]:text-ink-3",
  // td
  "[&_td]:border-b [&_td]:border-[color:var(--rule-soft)] [&_td]:px-[14px] [&_td]:py-3 [&_td]:text-sm [&_td]:text-ink-2",
  // última linha sem borda
  "[&_tr:last-child_td]:border-0",
  // linha clicável
  "[&_tr.rb-row]:cursor-pointer [&_tr.rb-row:hover_td]:bg-[color:var(--bg-card-2)]",
].join(" ");

export interface RebTableProps extends React.HTMLAttributes<HTMLTableElement> {
  /** classe no wrapper externo (scroll-x) */
  wrapClassName?: string;
}

export function RebTable({ className, wrapClassName, children, ...props }: RebTableProps) {
  return (
    <div className={cn("overflow-x-auto", wrapClassName)}>
      <table className={cn("overflow-hidden", TABLE_CHROME, className)} {...props}>
        {children}
      </table>
    </div>
  );
}
