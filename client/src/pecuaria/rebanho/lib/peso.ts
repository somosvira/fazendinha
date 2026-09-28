// Formatação de peso e GMD (ganho médio diário) compartilhada pela ficha, pela
// página do lote e pela lista. O cálculo em si vive no servidor (peso.calc.ts);
// aqui só se apresenta o que a API devolve.

import type { PeriodoGmd } from "../types";

export const PERIODOS_GMD: { valor: PeriodoGmd; rotulo: string }[] = [
  { valor: 30, rotulo: "Últimos 30 dias" },
  { valor: 90, rotulo: "Últimos 90 dias" },
  { valor: 180, rotulo: "Últimos 180 dias" },
  { valor: 365, rotulo: "Últimos 12 meses" },
  { valor: "entrada", rotulo: "Desde a entrada" },
];

/** "Desde a entrada" mostra a curva inteira do animal — é o que se quer ver ao abrir a ficha. */
export const PERIODO_GMD_PADRAO: PeriodoGmd = "entrada";

/** Início ("aaaa-mm-dd") da janela do GMD do período, contada para trás a partir de `limite`
 *  (hoje, ou a data da baixa) — mesma conta de `resumoPeso` em peso.calc.ts no servidor, para o
 *  gráfico mostrar exatamente as pesagens que entram no "GMD do período". `null` = sem limite
 *  inferior ("desde a entrada"). */
export function inicioJanelaGmd(periodo: PeriodoGmd, limite: string): string | null {
  if (periodo === "entrada") return null;
  const data = new Date(`${limite.slice(0, 10)}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() - periodo);
  return data.toISOString().slice(0, 10);
}

export function rotuloPeriodoGmd(periodo: PeriodoGmd | number | null): string {
  if (periodo === null || periodo === "entrada") return "desde a entrada";
  if (periodo === 365) return "últimos 12 meses";
  return `últimos ${periodo} dias`;
}

/** "+0,512 kg/dia", "−0,100 kg/dia" ou "—". */
export function formatarGmd(gmd: number | null | undefined): string {
  if (gmd == null || !Number.isFinite(gmd)) return "—";
  const sinal = gmd > 0 ? "+" : gmd < 0 ? "−" : "";
  return `${sinal}${Math.abs(gmd).toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg/dia`;
}

/** "262 kg", "262,5 kg" ou "—". */
export function formatarKg(kg: number | null | undefined): string {
  if (kg == null || !Number.isFinite(kg)) return "—";
  return `${kg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;
}
