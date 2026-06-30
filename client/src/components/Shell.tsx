/* Rio Novo — report header shell (a navegação mora no AppSidebar) */

import { ReactNode } from "react";
import { DateRangePicker, DateRange } from "./DateRangePicker";

export type Tab =
  | "dashboard" | "gastos" | "lancar" | "plano" | "ia" | "relatorio" | "acessos" | "config" | "cadastros"
  | "reb-dashboard" | "reb-animal" | "reb-reproducao" | "reb-sanidade" | "reb-nutricao" | "reb-producao" | "reb-estoque" | "reb-custo" | "reb-ia"
  | "pla-dashboard" | "pla-talhao" | "pla-fenologia" | "pla-fitossanidade" | "pla-nutricao" | "pla-colheita" | "pla-planejamento" | "pla-estoque" | "pla-custo" | "pla-ia"
  | "cor-dashboard" | "cor-lote" | "cor-pesagem" | "cor-pasto" | "cor-sanidade" | "cor-nutricao" | "cor-comercial" | "cor-custo" | "cor-ia";

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
    <div className="report-header">
      <div className="report-title">
        <span className="eyebrow">Visão executiva</span>
        <h1 className="h1">{subtitle}</h1>
      </div>
      <div className="report-meta">
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
