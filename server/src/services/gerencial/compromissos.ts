import type { Prisma } from "@prisma/client";
import { calcularCompromissos } from "./compromissos.calc.js";

/** Snapshot de todas as obrigações atuais: o período histórico do painel não filtra vencimentos. */
export async function consultarCompromissosTx(tx: Prisma.TransactionClient, propriedadeId: number | null, hoje: Date) {
  const compromissos = await tx.compromissoFinanceiro.findMany({
    where: {
      tipo: "PAGAR", status: { in: ["PENDENTE", "PARCIAL"] },
      ...(propriedadeId == null ? {} : { operacao: { propriedadeId } }),
    },
    select: {
      tipo: true, status: true, dataVencimento: true, valorOriginal: true,
      liquidacoes: { select: { valor: true, transacao: { select: { status: true } } } },
    },
  });
  return calcularCompromissos(compromissos, hoje);
}
