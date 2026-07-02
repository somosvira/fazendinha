import { prisma } from "../../db.js";
import { Prisma } from "@prisma/client";

export type MovimentoSaldo = { tipo: "ENTRADA" | "SAIDA"; quantidade: number };

export function calcularSaldoSilo(movimentos: MovimentoSaldo[]): number {
  return movimentos.reduce((acc, m) => acc + (m.tipo === "ENTRADA" ? m.quantidade : -m.quantidade), 0);
}

export async function recomputarSaldoSilo(siloId: number): Promise<void> {
  const movs = await prisma.movimentoSilo.findMany({ where: { siloId } });
  const saldo = calcularSaldoSilo(movs.map((m) => ({ tipo: m.tipo as "ENTRADA" | "SAIDA", quantidade: Number(m.quantidade) })));
  await prisma.silo.update({ where: { id: siloId }, data: { saldoAtual: new Prisma.Decimal(saldo.toFixed(3)) } });
}
