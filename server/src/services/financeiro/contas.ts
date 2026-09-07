import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { auditar, FinanceiroError } from "./regras.js";

export async function listarContas(propriedadeId?: number | null, incluirInativas = false) {
  const contas = await prisma.contaFinanceira.findMany({
    where: { ...(propriedadeId ? { propriedadeId } : {}), ...(!incluirInativas ? { ativo: true } : {}) },
    include: {
      movimentos: {
        select: { direcao: true, valor: true },
      },
    },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  });
  return contas.map(({ movimentos, ...conta }) => {
    const saldo = movimentos.reduce(
      (total, movimento) => total.plus(movimento.direcao === "ENTRADA" ? movimento.valor : movimento.valor.negated()),
      new Prisma.Decimal(conta.saldoAbertura),
    );
    return { ...conta, saldoAtual: saldo };
  });
}

export async function resumoSaldos(propriedadeId?: number | null) {
  const contas = await listarContas(propriedadeId);
  const consideradas = contas.filter((conta) => conta.incluirNoSaldoGeral);
  return {
    saldoGeral: consideradas.reduce((total, conta) => total.plus(conta.saldoAtual), new Prisma.Decimal(0)),
    contas,
  };
}

export async function criarConta(input: {
  nome: string; tipo: "BANCO" | "CAIXA" | "APLICACAO" | "DINHEIRO"; instituicao?: string | null;
  identificacao?: string | null; saldoAbertura: number; dataSaldoAbertura: Date; incluirNoSaldoGeral: boolean;
  propriedadeId: number; usuarioId?: number | null;
}) {
  return prisma.$transaction(async (tx) => {
    const { usuarioId, ...dados } = input;
    const conta = await tx.contaFinanceira.create({ data: dados });
    await auditar(tx, { entidade: "ContaFinanceira", entidadeId: conta.id, acao: "CRIADA", usuarioId, depois: conta });
    return conta;
  });
}

export async function atualizarConta(
  id: number,
  propriedadeId: number,
  input: Partial<{ nome: string; instituicao: string | null; identificacao: string | null; incluirNoSaldoGeral: boolean; ativo: boolean }>,
  usuarioId?: number | null,
) {
  return prisma.$transaction(async (tx) => {
    const anterior = await tx.contaFinanceira.findFirst({ where: { id, propriedadeId } });
    if (!anterior) throw new FinanceiroError("NAO_ENCONTRADO", "Conta financeira não encontrada");
    const conta = await tx.contaFinanceira.update({ where: { id }, data: input });
    await auditar(tx, { entidade: "ContaFinanceira", entidadeId: id, acao: "ATUALIZADA", usuarioId, antes: anterior, depois: conta });
    return conta;
  });
}

export async function listarExtrato(contaId: number, propriedadeId: number, inicio?: Date, fim?: Date) {
  const conta = await prisma.contaFinanceira.findFirst({ where: { id: contaId, propriedadeId } });
  if (!conta) throw new FinanceiroError("NAO_ENCONTRADO", "Conta financeira não encontrada");
  return prisma.movimentoConta.findMany({
    where: {
      contaId,
      transacao: { ...(inicio || fim ? { data: { ...(inicio ? { gte: inicio } : {}), ...(fim ? { lte: fim } : {}) } } : {}) },
    },
    include: { transacao: { include: { parceiro: true, operacao: true } } },
    orderBy: [{ transacao: { data: "desc" } }, { id: "desc" }],
  });
}
