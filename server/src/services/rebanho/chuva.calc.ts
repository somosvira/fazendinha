// Cálculo puro do registro de chuva (pluviômetro) — sem I/O. Agrega mm de chuva por dia no
// acumulado mensal. Espelha "Clima / registro de chuva" (Análise) do IDEagri — só o pluviômetro.

export interface RegistroChuvaInput {
  data: string; // YYYY-MM-DD
  mm: number;
}

export interface MesChuva {
  mes: string; // YYYY-MM
  total: number; // acumulado de mm no mês
  dias: number; // nº de dias com chuva (mm > 0) no mês
}

export interface ResumoChuva {
  meses: MesChuva[]; // crescente por mês (YYYY-MM)
  total: number; // soma de todos os mm
  diasComChuva: number; // nº de registros com mm > 0
}

// Arredonda a 1 casa — mm tem 1 decimal (Decimal(6,1)); evita ruído de ponto flutuante na soma.
const r1 = (n: number) => Math.round(n * 10) / 10;

export function agruparChuva(registros: readonly RegistroChuvaInput[]): ResumoChuva {
  const porMes = new Map<string, { total: number; dias: number }>();
  let total = 0;
  let diasComChuva = 0;

  for (const r of registros) {
    const mes = r.data.slice(0, 7); // YYYY-MM
    const acc = porMes.get(mes) ?? { total: 0, dias: 0 };
    acc.total += r.mm;
    if (r.mm > 0) {
      acc.dias++;
      diasComChuva++;
    }
    porMes.set(mes, acc);
    total += r.mm;
  }

  const meses: MesChuva[] = [...porMes.entries()]
    .map(([mes, { total, dias }]) => ({ mes, total: r1(total), dias }))
    .sort((a, b) => a.mes.localeCompare(b.mes));

  return { meses, total: r1(total), diasComChuva };
}
