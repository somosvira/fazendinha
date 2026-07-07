/* Filtro de MÊS ÚNICO para o Dashboard.
 *
 * O relatório é regime de caixa mensal — filtra um mês por vez (sem períodos
 * arbitrários). Devolve um DateRange encaixado no mês (start = 1º dia, end =
 * último dia), que é o que o servidor espera em ?from=&to=. Navega mês a mês
 * com as setas ‹ › ou pulando pelo dropdown.
 */

import type { DateRange } from "./DateRangePicker";

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

export function MonthRangePicker({ value, onChange, min, max }: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  min: Date;
  max: Date;
}) {
  const meses = mesesEntre(min, max);
  // Mês atual = o do início do range (o fim é sempre o mesmo mês agora).
  const curKey = value.start ? `${value.start.getFullYear()}-${value.start.getMonth()}` : meses[meses.length - 1].key;
  const idx = Math.max(0, meses.findIndex((mo) => mo.key === curKey));
  const cur = meses[idx] ?? meses[meses.length - 1];

  const irPara = (mo: Mes) => onChange({ start: startOfMonth(mo.y, mo.m), end: endOfMonth(mo.y, mo.m) });

  return (
    <div className="mrp">
      <button
        type="button"
        className="mrp-nav"
        onClick={() => idx > 0 && irPara(meses[idx - 1])}
        disabled={idx <= 0}
        aria-label="Mês anterior"
      >
        ‹
      </button>
      <select
        className="mrp-sel"
        value={cur.key}
        onChange={(e) => {
          const mo = meses.find((x) => x.key === e.target.value);
          if (mo) irPara(mo);
        }}
        aria-label="Mês"
      >
        {meses.map((mo) => <option key={mo.key} value={mo.key}>{mo.label}</option>)}
      </select>
      <button
        type="button"
        className="mrp-nav"
        onClick={() => idx < meses.length - 1 && irPara(meses[idx + 1])}
        disabled={idx >= meses.length - 1}
        aria-label="Próximo mês"
      >
        ›
      </button>
    </div>
  );
}
