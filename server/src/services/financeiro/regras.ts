import { Prisma, type PrismaClient } from "@prisma/client";
import { papelCompativel, papeisDoParceiro } from "./papeis.js";

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
    /** campo do formulário ao qual a mensagem se refere (para a UI exibir junto ao input) */
    public campo?: string,
  ) {
    super(message);
  }
}

/** Traduz violação de unicidade do Prisma (P2002) em FinanceiroError CONFLITO apontando o campo. Relança o resto. */
export function traduzirConflitoUnico(erro: unknown, mensagens: Record<string, string>): never {
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
    const alvos = (erro.meta?.target as string[] | undefined) ?? [];
    for (const [campo, mensagem] of Object.entries(mensagens)) {
      if (alvos.includes(campo)) throw new FinanceiroError("CONFLITO", mensagem, campo);
    }
  }
  throw erro;
}

export const dinheiro = (valor: Prisma.Decimal.Value) => new Prisma.Decimal(valor).toDecimalPlaces(2);

export function exigirPositivo(valor: Prisma.Decimal.Value, campo = "valor") {
  const decimal = dinheiro(valor);
  // `isPositive()` do decimal.js considera zero positivo (sinal +1) — usar
  // lessThanOrEqualTo(0) para realmente exigir um valor > 0 aqui.
  if (decimal.lessThanOrEqualTo(0)) throw new FinanceiroError("VALIDACAO", `${campo} deve ser maior que zero`);
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

export async function exigirContaAtiva(db: DbFinanceiro, contaId: string, propriedadeId: number) {
  const conta = await db.contaFinanceira.findFirst({ where: { id: contaId, propriedadeId, ativo: true } });
  if (!conta) throw new FinanceiroError("NAO_ENCONTRADO", "Conta financeira não encontrada ou inativa");
  return conta;
}

export async function exigirParceiroAtivo(db: DbFinanceiro, parceiroId: string, tipoOperacao?: string) {
  const parceiro = await db.parceiro.findFirst({ where: { id: parceiroId, ativo: true }, include: { papeis: true } });
  if (!parceiro) throw new FinanceiroError("NAO_ENCONTRADO", "Parceiro não encontrado ou inativo", "parceiroId");
  if (tipoOperacao && !papelCompativel(papeisDoParceiro(parceiro), tipoOperacao)) {
    throw new FinanceiroError("VALIDACAO", "Selecione um parceiro com papel compatível com esta operação", "parceiroId");
  }
  return parceiro;
}

export async function auditar(
  db: DbFinanceiro,
  input: { entidade: string; entidadeId: string; acao: string; motivo?: string; usuarioId?: number | null; antes?: unknown; depois?: unknown },
) {
  await db.auditoriaFinanceira.create({
    data: {
      entidade: input.entidade,
      entidadeId: input.entidadeId,
      acao: input.acao,
      motivo: input.motivo,
      usuarioId: input.usuarioId && input.usuarioId > 0 ? input.usuarioId : null,
      estadoAnterior: input.antes == null ? Prisma.JsonNull : JSON.parse(JSON.stringify(input.antes)),
      estadoPosterior: input.depois == null ? Prisma.JsonNull : JSON.parse(JSON.stringify(input.depois)),
    },
  });
}
