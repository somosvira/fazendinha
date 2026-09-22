import { DateRangePicker, dateFromIso, isoDate } from "../components/DateRangePicker";

export function PeriodoFinanceiroControl({ inicio, fim, onChange, label = "Período", allowAll = false }: {
  inicio: string;
  fim: string;
  onChange: (periodo: { inicio: string; fim: string }) => void;
  label?: string;
  allowAll?: boolean;
}) {
  return <DateRangePicker value={{ start: dateFromIso(inicio), end: dateFromIso(fim) }} allowAll={allowAll} triggerAriaLabel={label} onChange={({ start, end }) => onChange({ inicio: start ? isoDate(start) : "", fim: end ? isoDate(end) : "" })} />;
}
