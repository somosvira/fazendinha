import type { ReactNode } from "react";

export type KpiTom = "lucro" | "prejuizo" | "atencao" | "info" | "rural" | "neutro";

export interface KpiProps {
  label: string;
  value: ReactNode;
  unit?: string;
  interpretation?: string;
  financialImpact?: string;
  action?: string;
  tom?: KpiTom;
  compact?: boolean;
}

const TOM_TO_COLOR: Record<KpiTom, string | undefined> = {
  lucro:    "var(--lucro)",
  prejuizo: "var(--prejuizo)",
  atencao:  "var(--atencao)",
  info:     "var(--info)",
  rural:    "var(--rural)",
  neutro:   undefined,
};

export function Kpi({
  label,
  value,
  unit,
  interpretation,
  financialImpact,
  action,
  tom = "neutro",
  compact = false,
}: KpiProps) {
  const tomColor = TOM_TO_COLOR[tom];
  const colorValor = tom === "lucro" || tom === "prejuizo" ? tomColor : "var(--ink)";

  return (
    <div className={`kpi-prim${compact ? " is-compact" : ""}`}>
      <div className="kpi-prim-lab">{label}</div>
      <div className="kpi-prim-val" style={{ color: colorValor }}>
        <span className="kpi-prim-num mono-nums">{value}</span>
        {unit ? <span className="kpi-prim-unit">{unit}</span> : null}
      </div>
      {interpretation ? (
        <div className="kpi-prim-int">{interpretation}</div>
      ) : null}
      {financialImpact ? (
        <div className="kpi-prim-fin mono-nums" style={tomColor ? { color: tomColor } : undefined}>
          {financialImpact}
        </div>
      ) : null}
      {action ? <div className="kpi-prim-act">{action}</div> : null}
    </div>
  );
}
