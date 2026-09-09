import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), count: vi.fn(), auditoria: vi.fn(), transaction: vi.fn(),
}));

vi.mock("../../db.js", () => {
  const tx = {
    contaFinanceira: { findFirst: mocks.findFirst, update: mocks.update, create: mocks.create },
    movimentoConta: { count: mocks.count },
    auditoriaFinanceira: { create: mocks.auditoria },
  };
  mocks.transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
  return { prisma: { contaFinanceira: { findMany: mocks.findMany }, $transaction: mocks.transaction } };
});

import { atualizarConta, criarConta, listarContas } from "./contas.js";
import { FinanceiroError } from "./regras.js";

const anterior = { id: 1, propriedadeId: 1, nome: "Caixa", saldoAbertura: new Prisma.Decimal(50), dataSaldoAbertura: new Date("2026-01-01T00:00:00Z"), ativo: true };
const p2002 = (target: string[]) => new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6", meta: { target } });

describe("contas financeiras", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.findFirst.mockResolvedValue(anterior); mocks.update.mockImplementation(async ({ data }) => ({ ...anterior, ...data })); });

  it("PATCH só de ativo não toca em nenhum outro campo", async () => {
    await atualizarConta(1, 1, { ativo: false });
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { ativo: false } });
    expect(mocks.count).not.toHaveBeenCalled();
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

  it("calcula saldo atual e temMovimentos a partir do razão", async () => {
    mocks.findMany.mockResolvedValue([
      { ...anterior, movimentos: [{ direcao: "ENTRADA", valor: new Prisma.Decimal(100) }, { direcao: "SAIDA", valor: new Prisma.Decimal(30) }] },
      { ...anterior, id: 2, movimentos: [] },
    ]);
    const [com, sem] = await listarContas(1, true);
    expect(com.saldoAtual.toNumber()).toBe(120); expect(com.temMovimentos).toBe(true);
    expect(sem.saldoAtual.toNumber()).toBe(50); expect(sem.temMovimentos).toBe(false);
  });
});
