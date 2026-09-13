import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  contasFindMany: vi.fn(), movimentosFindMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), count: vi.fn(), auditoria: vi.fn(), transaction: vi.fn(),
}));

vi.mock("../../db.js", () => {
  const tx = {
    contaFinanceira: { findFirst: mocks.findFirst, update: mocks.update, create: mocks.create },
    movimentoConta: { count: mocks.count, findMany: mocks.movimentosFindMany },
    auditoriaFinanceira: { create: mocks.auditoria },
  };
  mocks.transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
  return { prisma: { contaFinanceira: { findMany: mocks.contasFindMany, findFirst: mocks.findFirst }, movimentoConta: { findMany: mocks.movimentosFindMany }, $transaction: mocks.transaction } };
});

import { atualizarConta, criarConta, listarContas, listarExtrato } from "./contas.js";
import { FinanceiroError } from "./regras.js";

const anterior = { id: 1, propriedadeId: 1, nome: "Caixa", saldoAbertura: new Prisma.Decimal(50), dataSaldoAbertura: new Date("2026-01-01T00:00:00Z"), ativo: true };
const p2002 = (target: string[]) => new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6", meta: { target } });

describe("contas financeiras", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue(anterior);
    mocks.update.mockImplementation(async ({ data }) => ({ ...anterior, ...data }));
    mocks.create.mockResolvedValue({ ...anterior, id: 3, saldoAbertura: new Prisma.Decimal(25) });
    mocks.movimentosFindMany.mockResolvedValue([]);
  });

  it("consulta extrato no consolidado e recusa conta fora da propriedade selecionada", async () => {
    await listarExtrato(1, null);
    expect(mocks.findFirst).toHaveBeenLastCalledWith({ where: { id: 1 } });
    mocks.movimentosFindMany.mockClear();
    mocks.findFirst.mockResolvedValue(null);
    await expect(listarExtrato(1, 2)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(mocks.findFirst).toHaveBeenLastCalledWith({ where: { id: 1, propriedadeId: 2 } });
    expect(mocks.movimentosFindMany).not.toHaveBeenCalled();
  });

  it("PATCH só de ativo não toca em nenhum outro campo", async () => {
    const conta = await atualizarConta(1, 1, { ativo: false });
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { ativo: false } });
    expect(mocks.count).not.toHaveBeenCalled();
    expect(conta).toMatchObject({ ativo: false, saldoAtual: new Prisma.Decimal(50), temMovimentos: false });
  });

  it("recusa alterar saldo de abertura quando a conta tem movimentos", async () => {
    mocks.count.mockResolvedValue(3);
    await expect(atualizarConta(1, 1, { saldoAbertura: 99 })).rejects.toMatchObject({ code: "VALIDACAO", campo: "saldoAbertura" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("permite alterar data de abertura quando não há movimentos", async () => {
    mocks.count.mockResolvedValue(0);
    await atualizarConta(1, 1, { dataSaldoAbertura: new Date("2026-02-01T00:00:00Z") });
    expect(mocks.update).toHaveBeenCalled();
  });

  it("não consulta movimentos quando o saldo enviado é igual ao atual", async () => {
    await atualizarConta(1, 1, { saldoAbertura: 50, nome: "Caixa 2" });
    expect(mocks.count).not.toHaveBeenCalled();
  });

  it("não encontra conta de outra propriedade", async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(atualizarConta(1, 2, { nome: "X" })).rejects.toBeInstanceOf(FinanceiroError);
  });

  it("traduz nome duplicado na propriedade em CONFLITO com campo", async () => {
    mocks.create.mockRejectedValue(p2002(["propriedadeId", "nome"]));
    await expect(criarConta({ nome: "Caixa", tipo: "CAIXA", saldoAbertura: 0, dataSaldoAbertura: new Date(), incluirNoSaldoGeral: true, propriedadeId: 1 }))
      .rejects.toMatchObject({ code: "CONFLITO", campo: "nome" });
  });

  it("criação devolve saldo e indicador de movimentos consistentes", async () => {
    const conta = await criarConta({ nome: "Reserva", tipo: "CAIXA", saldoAbertura: 25, dataSaldoAbertura: new Date(), incluirNoSaldoGeral: true, propriedadeId: 1 });
    expect(conta).toMatchObject({ id: 3, saldoAtual: new Prisma.Decimal(25), temMovimentos: false });
  });

  it("exige dados bancários mínimos e recusa número no titular", async () => {
    const base = { nome: "Banco", tipo: "BANCO" as const, instituicao: "Sicoob", saldoAbertura: 0, dataSaldoAbertura: new Date(), incluirNoSaldoGeral: true, propriedadeId: 1 };
    await expect(criarConta(base)).rejects.toMatchObject({ campo: "agencia" });
    await expect(criarConta({ ...base, agencia: "1", numeroConta: "2", titular: "João 2" })).rejects.toMatchObject({ campo: "titular" });
    await criarConta({ ...base, agencia: "1", numeroConta: "2", titular: "João Silva" });
    expect(mocks.create).toHaveBeenCalled();
  });

  it("calcula saldo atual e temMovimentos a partir do razão", async () => {
    mocks.contasFindMany.mockResolvedValue([
      { ...anterior, movimentos: [{ direcao: "ENTRADA", valor: new Prisma.Decimal(100) }, { direcao: "SAIDA", valor: new Prisma.Decimal(30) }] },
      { ...anterior, id: 2, movimentos: [] },
    ]);
    const [com, sem] = await listarContas(1, true);
    expect(com.saldoAtual.toNumber()).toBe(120); expect(com.temMovimentos).toBe(true);
    expect(sem.saldoAtual.toNumber()).toBe(50); expect(sem.temMovimentos).toBe(false);
  });
});
