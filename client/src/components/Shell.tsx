/* Rio Novo — report header shell (a navegação mora no AppSidebar) */

import { ReactNode } from "react";
import { DateRangePicker, DateRange } from "./DateRangePicker";

export type Tab =
  | "inicio"
  | "dashboard" | "gastos" | "lancar" | "caixinha" | "plano" | "ia" | "relatorio" | "acessos" | "config" | "cadastros"
  | "reb-dashboard" | "reb-animal" | "reb-reproducao" | "reb-sanidade" | "reb-nutricao" | "reb-producao" | "reb-estoque" | "reb-custo" | "reb-carteira" | "reb-sugestoes"
  | "pla-dashboard" | "pla-talhao" | "pla-fenologia" | "pla-fitossanidade" | "pla-nutricao" | "pla-colheita" | "pla-planejamento" | "pla-estoque" | "pla-custo"
  | "cor-dashboard" | "cor-lote" | "cor-pesagem" | "cor-pasto" | "cor-sanidade" | "cor-nutricao" | "cor-comercial" | "cor-custo"
  | "eqp-dashboard" | "eqp-funcionarios" | "eqp-ponto" | "eqp-folha"
  | "mil-dashboard" | "mil-safras" | "mil-custos" | "mil-producao" | "mil-silos" | "mil-custo";

export type NavTab = { id: Tab; label: string };

export function ReportHeader({
  subtitle,
  eyebrow = "Visão executiva",
  range,
  onRangeChange,
  updatedAt,
  rightExtra,
}: {
  subtitle: string;
  /** Eyebrow contextual (ex.: "Financeiro · Contas a pagar"). Diz ONDE se está,
   *  em vez do genérico "Visão executiva". */
  eyebrow?: ReactNode;
  range?: DateRange | null;
  onRangeChange?: (r: DateRange) => void;
  updatedAt?: string;
  rightExtra?: ReactNode;
}) {
  return (
    <div
      data-slot="report-header"
      className="grid grid-cols-[1fr_auto] items-end gap-6 border-b border-border pt-7 pb-[22px] max-[640px]:grid-cols-1 max-[640px]:items-start max-[640px]:gap-3"
    >
      <div className="flex flex-col gap-2">
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="h1 text-balance">{subtitle}</h1>
      </div>
      <div className="flex flex-col gap-1 text-right max-[640px]:text-left">
        {range && onRangeChange && <DateRangePicker value={range} onChange={onRangeChange} anchor="right" />}
        {updatedAt && (
          <span className="caption" style={{ marginTop: 8 }}>
            Atualizado {updatedAt}
          </span>
        )}
        {rightExtra}
      </div>
    </div>
  );
}
