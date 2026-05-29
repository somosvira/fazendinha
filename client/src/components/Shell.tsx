/* Rio Novo — masthead + nav shell */

import { ReactNode } from "react";
import { DateRangePicker, DateRange } from "./DateRangePicker";

export type Tab = "dashboard" | "gastos" | "lancar" | "plano" | "ia" | "relatorio";

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "gastos", label: "Gastos" },
  { id: "lancar", label: "Lançar" },
  { id: "plano", label: "Categorias" },
  { id: "ia", label: "IA" },
  { id: "relatorio", label: "Relatório" },
];

export function Masthead({ current, onNav }: { current: Tab; onNav: (t: Tab) => void }) {
  return (
    <header className="masthead">
      <div className="masthead-inner">
        <div className="brand">
          <div className="brand-mark">RN</div>
          <div>
            <div className="brand-name">Fazenda Rio Novo</div>
            <div className="brand-sub">Relatório Gerencial</div>
          </div>
        </div>
        <nav className="nav-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className="nav-tab"
              aria-current={current === t.id ? "true" : "false"}
              onClick={() => onNav(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="mast-right">
          <div className="user-chip">
            <div className="user-avatar">M</div>
            <span>Marco Antônio</span>
          </div>
        </div>
      </div>
    </header>
  );
}

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
