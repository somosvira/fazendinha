// Seletor do período do GMD (30/90/180/365 dias ou desde a entrada), usado na
// ficha do animal e na página do lote.

import type { PeriodoGmd } from "../types";
import { PERIODOS_GMD } from "../lib/peso";

export function SeletorPeriodoGmd({ id, valor, onChange }: {
  id: string;
  valor: PeriodoGmd;
  onChange: (periodo: PeriodoGmd) => void;
}) {
  return <label htmlFor={id} className="inline-flex items-center gap-2 text-sm font-medium text-ink-2">
    Período do GMD
    <select id={id} value={String(valor)} onChange={(e) => onChange(e.target.value === "entrada" ? "entrada" : (Number(e.target.value) as PeriodoGmd))} className="h-9 rounded-lg border border-border bg-white px-2 text-sm font-normal text-ink">
      {PERIODOS_GMD.map((p) => <option key={String(p.valor)} value={String(p.valor)}>{p.rotulo}</option>)}
    </select>
  </label>;
}
