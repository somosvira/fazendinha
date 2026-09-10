import { Prisma, type PrismaClient } from "@prisma/client";

export type DbFinanceiro = Prisma.TransactionClient | PrismaClient;

export class FinanceiroError extends Error {
  constructor(
    public code:
      | "NAO_ENCONTRADO"
      | "VALIDACAO"
      | "PERIODO_FECHADO"
      | "SALDO_INSUFICIENTE"
      | "JA_REVERTIDO"
      | "CONFLITO",
    message: string,
  ) {
    super(message);
  }
}

export const dinheiro = (valor: Prisma.Decimal.Value) => new Prisma.Decimal(valor).toDecimalPlaces(2);

export function exigirPositivo(valor: Prisma.Decimal.Value, campo = "valor") {
  const decimal = dinheiro(valor);
  if (!decimal.isPositive()) throw new FinanceiroError("VALIDACAO", `${campo} deve ser maior que zero`);
  return decimal;
}

export async function exigirPeriodoAberto(db: DbFinanceiro, propriedadeId: number, data: Date) {
  const periodo = await db.periodoFinanceiro.findUnique({
    where: { propriedadeId_ano_mes: { propriedadeId, ano: data.getUTCFullYear(), mes: data.getUTCMonth() + 1 } },
  });
  if (periodo?.status === "FECHADO") {
    throw new FinanceiroError("PERIODO_FECHADO", "O período financeiro está fechado. Reabra o período antes de registrar ou estornar movimentos.");
  }
}

export async function exigirContaAtiva(db: DbFinanceiro, contaId: number, propriedadeId: number) {
  const conta = await db.contaFinanceira.findFirst({ where: { id: contaId, propriedadeId, ativo: true } });
  if (!conta) throw new FinanceiroError("NAO_ENCONTRADO", "Conta financeira não encontrada ou inativa");
  return conta;
}

export async function exigirParceiroAtivo(db: DbFinanceiro, parceiroId: number) {
  const parceiro = await db.parceiro.findFirst({ where: { id: parceiroId, ativo: true } });
  if (!parceiro) throw new FinanceiroError("NAO_ENCONTRADO", "Parceiro não encontrado ou inativo");
  return parceiro;
}

export async function auditar(
  db: DbFinanceiro,
  input: { entidade: string; entidadeId: string | number; acao: string; motivo?: string; usuarioId?: number | null; antes?: unknown; depois?: unknown },
) {
  await db.auditoriaFinanceira.create({
    data: {
      entidade: input.entidade,
      entidadeId: String(input.entidadeId),
      acao: input.acao,
      motivo: input.motivo,
      usuarioId: input.usuarioId && input.usuarioId > 0 ? input.usuarioId : null,
      estadoAnterior: input.antes == null ? Prisma.JsonNull : JSON.parse(JSON.stringify(input.antes)),
      estadoPosterior: input.depois == null ? Prisma.JsonNull : JSON.parse(JSON.stringify(input.depois)),
    },
  });
}
