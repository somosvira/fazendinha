import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { env } from "../../env.js";
import { exigirContaAtiva } from "./regras.js";
import { hashConfirmacao } from "./idempotencia.js";

/** UPDATE real cria conflito de serialização inclusive quando o snapshot precede a espera. */
export async function travarContasSaldo(tx: Prisma.TransactionClient, ids: string[], propriedadeId?: number) {
  for (const id of [...new Set(ids)].sort()) {
    if (propriedadeId === undefined) await tx.$executeRaw`UPDATE "ContaFinanceira" SET "updatedAt" = "updatedAt" WHERE "id" = ${id}`;
    else await tx.$executeRaw`UPDATE "ContaFinanceira" SET "updatedAt" = "updatedAt" WHERE "id" = ${id} AND "propriedadeId" = ${propriedadeId}`;
  }
}

export type CienciaSaldo = { token?: string; origem: "direta" | "rascunho"; rascunho?: { id: string; versao: number } };
export class SaldoNegativoError extends Error {
  readonly code = "SALDO_NEGATIVO";
  readonly campo = "financeiro.contaId";
  constructor(readonly saldoNegativo: { propriedadeId: number; contaId: string; saldoAtual: string; valorPagamento: string; saldoProjetado: string; token: string }) {
    super("O pagamento deixará a conta com saldo negativo. Confirme sua ciência para continuar.");
  }
}

export async function conferirSaldoNegativo(tx: Prisma.TransactionClient, input: { propriedadeId: number; contaId: string; valor: Prisma.Decimal; intencao: unknown; ciencia: CienciaSaldo }) {
  await travarContasSaldo(tx, [input.contaId], input.propriedadeId);
  const conta = await exigirContaAtiva(tx, input.contaId, input.propriedadeId);
  const movimentos = await tx.movimentoConta.findMany({ where: { contaId: input.contaId }, select: { direcao: true, valor: true } });
  const saldoAtual = movimentos.reduce((saldo, m) => m.direcao === "ENTRADA" ? saldo.plus(m.valor) : saldo.minus(m.valor), new Prisma.Decimal(conta.saldoAbertura));
  const projetado = saldoAtual.minus(input.valor);
  if (!projetado.isNegative()) return;
  const snapshot = { propriedadeId: input.propriedadeId, contaId: input.contaId, saldoAtual: saldoAtual.toFixed(2), valorPagamento: input.valor.toFixed(2), saldoProjetado: projetado.toFixed(2) };
  const assinatura = createHmac("sha256", env.JWT_SECRET).update(`fazendinha:saldo-negativo:v1:${hashConfirmacao({ ...snapshot, origem: input.ciencia.origem, rascunho: input.ciencia.rascunho, intencao: input.intencao })}`).digest("hex");
  const recebido = input.ciencia.token;
  if (recebido && /^[a-f0-9]{64}$/.test(recebido) && timingSafeEqual(Buffer.from(recebido, "hex"), Buffer.from(assinatura, "hex"))) return;
  throw new SaldoNegativoError({ ...snapshot, token: assinatura });
}
