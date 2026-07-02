// Regra de negócio: meses fechados não aceitam alterações em Lançamentos
// nem em seus anexos. Centraliza aqui pra reusar em todas as rotas mutáveis.

import { prisma } from "../db.js";

export class FechamentoMensalError extends Error {
  constructor(public ano: number, public mes: number) {
    super(
      `Mês ${mes.toString().padStart(2, "0")}/${ano} está fechado contabilmente e não aceita alterações.`,
    );
    this.name = "FechamentoMensalError";
  }
}

// Recebe a data efetiva de caixa (dataLiquidacao || dataCompetencia) e
// rejeita se o mês correspondente já foi fechado.
export async function assertMesAberto(data: Date): Promise<void> {
  const ano = data.getUTCFullYear();
  const mes = data.getUTCMonth() + 1;
  const fechamento = await prisma.fechamentoMensal.findUnique({
    where: { ano_mes: { ano, mes } },
  });
  if (fechamento) throw new FechamentoMensalError(ano, mes);
}
