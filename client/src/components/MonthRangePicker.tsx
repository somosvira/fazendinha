/* Filtro de período MENSAL para o Dashboard.
 *
 * O relatório é regime de caixa mensal — não faz sentido filtrar por dia. Este
 * controle escolhe "de mês/ano até mês/ano" e devolve um DateRange já encaixado
 * nos limites do mês (start = 1º dia do mês inicial, end = último dia do final),
 * que é exatamente o que o servidor espera em ?from=&to=.
 */

import type { DateRange } from "./DateRangePicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const startOfMonth = (y: number, m: number) => new Date(y, m, 1);
const endOfMonth = (y: number, m: number) => new Date(y, m + 1, 0); // dia 0 do mês seguinte = último dia

type Mes = { y: number; m: number; label: string; key: string };

function mesesEntre(min: Date, max: Date): Mes[] {
  const out: Mes[] = [];
  let y = min.getFullYear();
  let m = min.getMonth();
  while (y < max.getFullYear() || (y === max.getFullYear() && m <= max.getMonth())) {
    out.push({ y, m, label: `${MES[m]}/${String(y).slice(-2)}`, key: `${y}-${m}` });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return out;
}

const keyOf = (d: Date | null, fallback: string) => (d ? `${d.getFullYear()}-${d.getMonth()}` : fallback);

export function MonthRangePicker({ value, onChange, min, max }: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  min: Date;
  max: Date;
}) {
  const meses = mesesEntre(min, max);
  const startKey = keyOf(value.start, meses[0].key);
  const endKey = keyOf(value.end, meses[meses.length - 1].key);

  const setStart = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    const s = startOfMonth(y, m);
    let e = value.end ?? endOfMonth(y, m);
    if (e < s) e = endOfMonth(y, m); // não deixa o fim ficar antes do início
    onChange({ start: s, end: e });
  };
  const setEnd = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    const e = endOfMonth(y, m);
    let s = value.start ?? startOfMonth(y, m);
    if (s > e) s = startOfMonth(y, m);
    onChange({ start: s, end: e });
  };

  return (
    <div className="inline-flex items-center gap-2">
      <Select value={startKey} onValueChange={setStart}>
        <SelectTrigger aria-label="Mês inicial" className="tabular-nums">
          {/* label como children → visível já no primeiro paint (Radix só resolve na hidratação) */}
          <SelectValue>{meses.find((mo) => mo.key === startKey)?.label}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {meses.map((mo) => <SelectItem key={mo.key} value={mo.key}>{mo.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <span className="text-[13px] text-ink-3">→</span>
      <Select value={endKey} onValueChange={setEnd}>
        <SelectTrigger aria-label="Mês final" className="tabular-nums">
          <SelectValue>{meses.find((mo) => mo.key === endKey)?.label}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {meses.map((mo) => <SelectItem key={mo.key} value={mo.key}>{mo.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
