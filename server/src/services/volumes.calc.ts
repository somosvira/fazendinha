/* Volume físico → KPIs por unidade (R$/L de leite, R$/saca de café).
 * Puro e testável (sem Prisma). Alimenta os KPIs do Relatório que dependem de
 * volume produzido — antes chumbados (Custo/L, Preço médio, Sacas, Preço/saca).
 *
 * Leite: não há série histórica de litros por mês, só a taxa diária atual das
 * vacas em lactação; estimamos o volume de um período por taxa × dias (mesma
 * lógica de rebanho/custo-producao.ts). Café: sacas beneficiadas são reais
 * (somam-se as passadas de colheita do período). */

/** Litros estimados num período: taxa diária atual × dias. Arredonda p/ inteiro. */
export function estimarLitros(litrosDia: number, dias: number): number {
  if (!(litrosDia > 0) || !(dias > 0)) return 0;
  return Math.round(litrosDia * dias);
}

/** Soma de sacas beneficiadas (2 casas). */
export function somarSacas(valores: number[]): number {
  const t = valores.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
  return Math.round(t * 100) / 100;
}

/** R$ por unidade física (preço médio / custo unitário). `null` se volume ≤ 0
 *  — o consumidor esconde o KPI em vez de exibir NaN/∞. Arredonda p/ centavos. */
export function porUnidade(valorReais: number, volume: number): number | null {
  if (!(volume > 0) || !Number.isFinite(valorReais)) return null;
  return Math.round((valorReais / volume) * 100) / 100;
}
