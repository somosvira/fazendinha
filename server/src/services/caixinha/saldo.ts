// Motor de saldo da caixinha — espelha cultivo/silo.ts (razão + saldo):
// função PURA testável + wrapper que recarrega o razão e atualiza saldoAtual.
// Decimal→number só na borda (mapeamento antes de chamar a função pura).

import { prisma } from "../../db.js";
import { Prisma } from "@prisma/client";

export type MovimentoSaldoCaixinha = { tipo: "ENTRADA" | "SAIDA"; valor: number };

// Σ ENTRADA − Σ SAIDA, arredondado a 2 casas. Valores não-finitos (NaN/Infinity)
// são ignorados — o saldo nunca vira NaN.
export function calcularSaldoCaixinha(movimentos: MovimentoSaldoCaixinha[]): number {
  const saldo = movimentos.reduce((acc, m) => {
    const v = Number(m.valor);
    if (!Number.isFinite(v)) return acc;
    return acc + (m.tipo === "ENTRADA" ? v : -v);
  }, 0);
  return Math.round(saldo * 100) / 100;
}

// Recarrega o razão inteiro e grava o saldo pré-computado em Caixinha.saldoAtual.
export async function recomputarSaldoCaixinha(caixinhaId: number): Promise<void> {
  const movs = await prisma.movimentoCaixinha.findMany({ where: { caixinhaId } });
  const saldo = calcularSaldoCaixinha(
    movs.map((m) => ({ tipo: m.tipo as "ENTRADA" | "SAIDA", valor: Number(m.valor) })),
  );
  await prisma.caixinha.update({
    where: { id: caixinhaId },
    data: { saldoAtual: new Prisma.Decimal(saldo.toFixed(2)) },
  });
}
