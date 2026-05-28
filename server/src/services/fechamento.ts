import { prisma } from "../db.js";

// Data de caixa de um lançamento: liquidação se houver, senão vencimento.
export function dataCaixa(l: { dataLiquidacao?: Date | null; dataVencimento: Date }): Date {
  return l.dataLiquidacao ?? l.dataVencimento;
}

export async function mesFechado(d: Date): Promise<boolean> {
  const f = await prisma.fechamentoMensal.findUnique({
    where: { ano_mes: { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 } },
  });
  return !!f;
}

// Lança erro se a data cair num mês fechado.
export async function garantirMesAberto(d: Date): Promise<string | null> {
  if (await mesFechado(d)) {
    return `Mês ${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()} está fechado.`;
  }
  return null;
}
