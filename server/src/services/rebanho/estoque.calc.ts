// Motor puro de estoque (Prisma-free, testado por TDD).
// custo vaca/dia = consumo ÷ (vacas × dias). Saldo (Σ entradas − Σ saídas)
// vem de @rionovo/shared — mesma regra de sinal usada no patch otimista do client.
export { saldoProduto, type MovIn } from "@rionovo/shared";

export function custoVacaDia(
  saidas: { valorTotal: number; data: string }[],
  vacasEmLactacao: number,
  hoje: string,
  periodoDias: number,
): number | null {
  if (vacasEmLactacao <= 0) return null;
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() - periodoDias);
  const fim = new Date(hoje);
  const total = saidas
    .filter((s) => new Date(s.data) >= limite && new Date(s.data) <= fim)
    .reduce((a, s) => a + s.valorTotal, 0);
  return Math.round((total / (vacasEmLactacao * periodoDias)) * 100) / 100;
}
