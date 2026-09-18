import { getHoje } from "../lib/hoje";
import { PeriodoFinanceiroControl } from "./PeriodoFinanceiroControl";

export function periodoDoAno(ano: number) {
  return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
}

export function periodoDoAnoAtual() {
  return periodoDoAno(getHoje().getFullYear());
}

export function PeriodoGraficoControl({ inicio, fim, onChange, id = "" }: {
  inicio: string;
  fim: string;
  onChange: (periodo: { inicio: string; fim: string }) => void;
  id?: string;
}) {
  return <PeriodoFinanceiroControl inicio={inicio} fim={fim} onChange={onChange} label={`Período${id ? ` ${id}` : ""}`} />;
}
