/* Rio Novo — previsão de ruptura de caixa + obrigações futuras.
 * Port de src/dataRuptura.js. Combina compromissos conhecidos com a queima
 * difusa do dia a dia para projetar o saldo 35 dias à frente.
 */

import type { Folego } from "./projecao";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Payload = any;

export type Compromisso = {
  data: string;
  dias: number;
  tipo: "entrada" | "saida";
  label: string;
  categoria: string;
  valor: number;
};

export type RupturaCaixaData = {
  caixaInicial: number;
  saldoDiario: { dia: number; saldo: number }[];
  rupturaDia: number | null;
  rupturaData: string | null;
  menorSaldo: number;
  menorSaldoDia: number;
  menorSaldoData: string;
  aporteSugerido: number;
  colchao: number;
  diaParaData: (d: number) => string;
};

// datas relativas a "hoje" = 04/mai/2026
const COMPROMISSOS: Compromisso[] = [
  { data: "10/mai", dias: 6, tipo: "saida", label: "Folha de pagamento — abril", categoria: "Pessoal", valor: 84000 },
  { data: "12/mai", dias: 8, tipo: "entrada", label: "Embaré — 1ª quinzena leite", categoria: "Leite", valor: 78000 },
  { data: "15/mai", dias: 11, tipo: "saida", label: "Cargill — ração concentrada (25t)", categoria: "Ração", valor: 59500 },
  { data: "20/mai", dias: 16, tipo: "saida", label: "Marcondes — lote de matrizes", categoria: "Investimento", valor: 168000 },
  { data: "25/mai", dias: 21, tipo: "saida", label: "Energisa + Sicoob (encargos)", categoria: "Estrutural", valor: 26000 },
  { data: "27/mai", dias: 23, tipo: "entrada", label: "Embaré — 2ª quinzena leite", categoria: "Leite", valor: 80000 },
  { data: "30/mai", dias: 26, tipo: "saida", label: "Curral — Siloking (parcela)", categoria: "Curral", valor: 18500 },
  { data: "05/jun", dias: 32, tipo: "saida", label: "Folha de pagamento — maio", categoria: "Pessoal", valor: 84000 },
];

function diaParaData(d: number): string {
  const base = new Date(2026, 4, 4); // 04/mai
  const dt = new Date(base.getFullYear(), base.getMonth(), base.getDate() + d);
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${String(dt.getDate()).padStart(2, "0")}/${meses[dt.getMonth()]}`;
}

export function buildCompromissos(): Compromisso[] {
  return COMPROMISSOS;
}

export function buildRuptura(d: Payload, folego: Folego): RupturaCaixaData {
  const caixa = d.caixaHoje.total;
  const dias = 35;
  const saldoDiario: { dia: number; saldo: number }[] = [];
  let saldo = caixa;
  // queima de fundo (custeio diário fora dos grandes compromissos) ~ déficit op / 30
  const queimaDiaria = ((folego.queimaCusteioMensal || 500000) / 30) * 0.35;

  const compByDia: Record<number, number> = {};
  COMPROMISSOS.forEach((c) => {
    compByDia[c.dias] = (compByDia[c.dias] || 0) + (c.tipo === "entrada" ? c.valor : -c.valor);
  });

  let rupturaDia: number | null = null;
  let menorSaldo = caixa;
  let menorSaldoDia = 0;
  for (let day = 0; day <= dias; day++) {
    saldo -= queimaDiaria;
    if (compByDia[day]) saldo += compByDia[day];
    if (rupturaDia === null && saldo < 0) rupturaDia = day;
    if (saldo < menorSaldo) {
      menorSaldo = saldo;
      menorSaldoDia = day;
    }
    saldoDiario.push({ dia: day, saldo: Math.round(saldo) });
  }

  const colchao = 50000;
  const aporteSugerido = menorSaldo < colchao ? Math.ceil((colchao - menorSaldo) / 10000) * 10000 : 0;

  return {
    caixaInicial: caixa,
    saldoDiario,
    rupturaDia,
    rupturaData: rupturaDia !== null ? diaParaData(rupturaDia) : null,
    menorSaldo: Math.round(menorSaldo),
    menorSaldoDia,
    menorSaldoData: diaParaData(menorSaldoDia),
    aporteSugerido,
    colchao,
    diaParaData,
  };
}
