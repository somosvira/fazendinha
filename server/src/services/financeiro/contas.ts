import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import type { z } from "zod";
import { auditar, FinanceiroError, traduzirConflitoUnico } from "./regras.js";
import type { contaSchema, patchContaSchema } from "./schemas.js";

const CONFLITOS = { nome: "Já existe uma conta com este nome nesta propriedade" };

type MovimentoSaldo = { direcao: "ENTRADA" | "SAIDA"; valor: Prisma.Decimal };

function comResumo<T extends { saldoAbertura: Prisma.Decimal }>(conta: T, movimentos: MovimentoSaldo[]) {
  const saldoAtual = movimentos.reduce(
    (total, movimento) => total.plus(movimento.direcao === "ENTRADA" ? movimento.valor : movimento.valor.negated()),
    new Prisma.Decimal(conta.saldoAbertura),
  );
  return { ...conta, saldoAtual, temMovimentos: movimentos.length > 0 };
}

export async function listarContas(propriedadeId?: number | null, incluirInativas = false) {
  const contas = await prisma.contaFinanceira.findMany({
    where: { ...(propriedadeId ? { propriedadeId } : {}), ...(!incluirInativas ? { ativo: true } : {}) },
    include: {
      movimentos: {
        select: { direcao: true, valor: true, transacao: { select: { data: true, descricao: true, tipo: true } } },
        orderBy: [{ transacao: { data: "desc" } }, { id: "desc" }],
      },
    },
    orderBy: [{ ativo: "desc" }, { ordem: "asc" }, { nome: "asc" }],
  });
  return contas.map(({ movimentos, ...conta }) => ({ ...comResumo(conta, movimentos), ultimaOperacao: movimentos[0]?.transacao ?? null }));
}

export async function resumoSaldos(propriedadeId?: number | null) {
  const contas = await listarContas(propriedadeId);
  const consideradas = contas.filter((conta) => conta.incluirNoSaldoGeral);
  return {
    saldoGeral: consideradas.reduce((total, conta) => total.plus(conta.saldoAtual), new Prisma.Decimal(0)),
    contas,
  };
}

function validarInstituicao(conta: { tipo: string; instituicao?: string | null }) {
  if (["BANCO", "APLICACAO"].includes(conta.tipo) && !conta.instituicao?.trim()) {
    throw new FinanceiroError("VALIDACAO", "Informe a instituição financeira", "instituicao");
  }
}

function validarDadosBancarios(conta: { tipo: string; agencia?: string | null; numeroConta?: string | null; titular?: string | null }) {
  if (conta.tipo !== "BANCO") return;
  if (!conta.agencia?.trim()) throw new FinanceiroError("VALIDACAO", "Informe a agência", "agencia");
  if (!conta.numeroConta?.trim()) throw new FinanceiroError("VALIDACAO", "Informe o número da conta", "numeroConta");
  if (!conta.titular?.trim()) throw new FinanceiroError("VALIDACAO", "Informe o titular", "titular");
  if (/\d/.test(conta.titular)) throw new FinanceiroError("VALIDACAO", "O titular não pode conter números", "titular");
}

export async function criarConta(input: z.infer<typeof contaSchema> & { propriedadeId: number; usuarioId?: number | null }) {
  validarInstituicao(input);
  validarDadosBancarios(input);
  try {
    return await prisma.$transaction(async (tx) => {
      const { usuarioId, ...dados } = input;
      const conta = await tx.contaFinanceira.create({ data: dados });
      await auditar(tx, { entidade: "ContaFinanceira", entidadeId: conta.id, acao: "CRIADA", usuarioId, depois: conta });
      return comResumo(conta, []);
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
      // Um cadastro antigo incompleto ainda pode ser desativado ou renomeado.
      if (input.tipo !== undefined || input.instituicao !== undefined) validarInstituicao({ ...anterior, ...input });
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
      const movimentos = await tx.movimentoConta.findMany({
        where: { contaId: id },
        select: { direcao: true, valor: true },
      });
      return comResumo(conta, movimentos);
    });
  } catch (e) { traduzirConflitoUnico(e, CONFLITOS); }
}

export async function listarExtrato(contaId: number, propriedadeId: number | null, inicio?: Date, fim?: Date) {
  const conta = await prisma.contaFinanceira.findFirst({ where: { id: contaId, ...(propriedadeId != null ? { propriedadeId } : {}) } });
  if (!conta) throw new FinanceiroError("NAO_ENCONTRADO", "Conta financeira não encontrada");
  return prisma.movimentoConta.findMany({
    where: {
      contaId,
      transacao: { ...(inicio || fim ? { data: { ...(inicio ? { gte: inicio } : {}), ...(fim ? { lte: fim } : {}) } } : {}) },
    },
    include: { transacao: { include: { parceiro: true, operacao: true, reversaoDe: { select: { id: true, tipo: true, descricao: true, operacaoId: true } } } } },
    orderBy: [{ transacao: { data: "desc" } }, { id: "desc" }],
  });
}

export async function listarExtratoGeral(propriedadeId: number | null) {
  return prisma.movimentoConta.findMany({
    where: { conta: propriedadeId != null ? { propriedadeId } : {} },
    include: { conta: { select: { id: true, nome: true, instituicao: true } }, transacao: { include: { parceiro: true, operacao: true, reversaoDe: { select: { id: true, tipo: true, descricao: true, operacaoId: true } } } } },
    orderBy: [{ transacao: { data: "desc" } }, { id: "desc" }],
  });
}
