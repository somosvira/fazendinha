/* Rio Novo — report header shell (a navegação mora no AppSidebar) */

import { ReactNode } from "react";
import { DateRangePicker, DateRange } from "./DateRangePicker";

export type Tab =
  | "dashboard" | "gastos" | "lancar" | "caixinha" | "plano" | "ia" | "relatorio" | "acessos" | "config" | "cadastros"
  | "reb-dashboard" | "reb-animal" | "reb-reproducao" | "reb-sanidade" | "reb-nutricao" | "reb-producao" | "reb-estoque" | "reb-custo" | "reb-ia"
  | "pla-dashboard" | "pla-talhao" | "pla-fenologia" | "pla-fitossanidade" | "pla-nutricao" | "pla-colheita" | "pla-planejamento" | "pla-estoque" | "pla-custo" | "pla-ia"
  | "cor-dashboard" | "cor-lote" | "cor-pesagem" | "cor-pasto" | "cor-sanidade" | "cor-nutricao" | "cor-comercial" | "cor-custo" | "cor-ia"
  | "eqp-funcionarios" | "eqp-ponto" | "eqp-folha"
  | "mil-safras" | "mil-custos" | "mil-producao" | "mil-silos" | "mil-custo";

export type NavTab = { id: Tab; label: string };

export function ReportHeader({
  subtitle,
  range,
  onRangeChange,
  updatedAt,
  rightExtra,
}: {
  subtitle: string;
  range?: DateRange | null;
  onRangeChange?: (r: DateRange) => void;
  updatedAt?: string;
  rightExtra?: ReactNode;
}) {
  return (
    <div
      data-slot="report-header"
      className="grid grid-cols-[1fr_auto] items-end gap-6 border-b border-border pt-7 pb-[22px]"
    >
      <div className="flex flex-col gap-2">
        <span className="eyebrow">Visão executiva</span>
        <h1 className="h1">{subtitle}</h1>
      </div>
      <div className="flex flex-col gap-1 text-right">
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
