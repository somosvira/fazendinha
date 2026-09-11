import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), auditoria: vi.fn(), transaction: vi.fn() }));

vi.mock("../../db.js", () => {
  const tx = { parceiro: { findUnique: mocks.findUnique, update: mocks.update, create: mocks.create }, auditoriaFinanceira: { create: mocks.auditoria } };
  mocks.transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
  return { prisma: { parceiro: { findMany: mocks.findMany }, $transaction: mocks.transaction } };
});

import { atualizarParceiro, criarParceiro, listarParceiros } from "./parceiros.js";

const p2002 = (target: string[]) => new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6", meta: { target } });

describe("parceiros", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue({ id: 5, nome: "Zé", ativo: true, _count: { operacoes: 2, compromissos: 1, transacoes: 1 } });
    mocks.update.mockResolvedValue({ id: 5, nome: "Zé", ativo: false });
    mocks.create.mockResolvedValue({ id: 6, nome: "Maria", ativo: true });
  });

  it("traduz documento duplicado em CONFLITO apontando o campo", async () => {
    mocks.create.mockRejectedValue(p2002(["documento"]));
    await expect(criarParceiro({ nome: "Zé", tipo: "FORNECEDOR", documento: "12345678909" })).rejects.toMatchObject({ code: "CONFLITO", campo: "documento" });
  });

  it("relança erros que não são de unicidade", async () => {
    mocks.create.mockRejectedValue(new Error("boom"));
    await expect(criarParceiro({ nome: "Zé", tipo: "FORNECEDOR" })).rejects.toThrow("boom");
  });

  it("desativar audita antes e depois e envia só ativo", async () => {
    const parceiro = await atualizarParceiro(5, { ativo: false }, 9);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { ativo: false } });
    expect(mocks.auditoria).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ entidade: "Parceiro", acao: "ATUALIZADO", usuarioId: 9 }) }));
    expect(parceiro).toMatchObject({ id: 5, ativo: false, referencias: 4 });
  });

  it("criação devolve zero referências", async () => {
    const parceiro = await criarParceiro({ nome: "Maria", tipo: "CLIENTE" });
    expect(parceiro).toMatchObject({ id: 6, referencias: 0 });
  });

  it("agrega referencias a partir das contagens", async () => {
    mocks.findMany.mockResolvedValue([{ id: 1, nome: "A", _count: { operacoes: 2, compromissos: 1, transacoes: 3 } }]);
    const [p] = await listarParceiros(true);
    expect(p).toEqual({ id: 1, nome: "A", referencias: 6 });
  });
});
