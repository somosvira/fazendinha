import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import type { z } from "zod";
import { auditar, FinanceiroError, traduzirConflitoUnico } from "./regras.js";
import type { patchContaSchema } from "./schemas.js";

const CONFLITOS = { nome: "Já existe uma conta com este nome nesta propriedade" };

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
    return { ...conta, saldoAtual: saldo, temMovimentos: movimentos.length > 0 };
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
  try {
    return await prisma.$transaction(async (tx) => {
      const { usuarioId, ...dados } = input;
      const conta = await tx.contaFinanceira.create({ data: dados });
      await auditar(tx, { entidade: "ContaFinanceira", entidadeId: conta.id, acao: "CRIADA", usuarioId, depois: conta });
      return conta;
    });
  } catch (e) { traduzirConflitoUnico(e, CONFLITOS); }
}

export async function atualizarConta(
  id: number,
  propriedadeId: number,
  input: z.infer<typeof patchContaSchema>,
  usuarioId?: number | null,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const anterior = await tx.contaFinanceira.findFirst({ where: { id, propriedadeId } });
      if (!anterior) throw new FinanceiroError("NAO_ENCONTRADO", "Conta financeira não encontrada");
      /* Saldo/data de abertura só mudam enquanto a conta não tem movimentos —
       * depois disso o saldo atual derivado do razão perderia a referência. */
      const mexeSaldo = input.saldoAbertura !== undefined && !new Prisma.Decimal(input.saldoAbertura).equals(anterior.saldoAbertura);
      const mexeData = input.dataSaldoAbertura !== undefined && input.dataSaldoAbertura.getTime() !== anterior.dataSaldoAbertura.getTime();
      if (mexeSaldo || mexeData) {
        const movimentos = await tx.movimentoConta.count({ where: { contaId: id } });
        if (movimentos > 0) throw new FinanceiroError("VALIDACAO", "Saldo e data de abertura não podem ser alterados em conta que já possui movimentos", mexeSaldo ? "saldoAbertura" : "dataSaldoAbertura");
      }
      const conta = await tx.contaFinanceira.update({ where: { id }, data: input });
      await auditar(tx, { entidade: "ContaFinanceira", entidadeId: id, acao: "ATUALIZADA", usuarioId, antes: anterior, depois: conta });
      return conta;
    });
  } catch (e) { traduzirConflitoUnico(e, CONFLITOS); }
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
