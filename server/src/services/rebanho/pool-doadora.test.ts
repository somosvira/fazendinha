import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ grupoFindMany: vi.fn(), grupoFindFirst: vi.fn(), grupoCreate: vi.fn(), grupoUpdate: vi.fn(), animalFindMany: vi.fn(), itemDeleteMany: vi.fn(), itemCreateMany: vi.fn(), aplicacaoCreate: vi.fn(), coletaCreateMany: vi.fn(), transaction: vi.fn() }));
vi.mock("../../db.js", () => ({ prisma: { grupoPoolDoadora: { findMany: mocks.grupoFindMany, findFirst: mocks.grupoFindFirst }, animal: { findMany: mocks.animalFindMany }, $transaction: mocks.transaction } }));

import { PoolDoadoraError, aplicarPool, criarGrupoPool, salvarItensGrupoPool } from "./pool-doadora.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.grupoFindFirst.mockResolvedValue({ id: 5, nome: "Elite", ativo: true, propriedadeId: 7, itens: [{ doadoraId: 31, ativo: true }, { doadoraId: 32, ativo: true }] });
  mocks.animalFindMany.mockResolvedValue([{ id: 31 }, { id: 32 }]); mocks.grupoCreate.mockResolvedValue({ id: 5 }); mocks.grupoUpdate.mockResolvedValue({ id: 5 }); mocks.aplicacaoCreate.mockResolvedValue({ id: 9 }); mocks.coletaCreateMany.mockResolvedValue({ count: 2 });
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({ grupoPoolDoadora: { create: mocks.grupoCreate, update: mocks.grupoUpdate }, itemGrupoPoolDoadora: { deleteMany: mocks.itemDeleteMany, createMany: mocks.itemCreateMany }, aplicacaoPoolDoadora: { create: mocks.aplicacaoCreate }, coleta: { createMany: mocks.coletaCreateMany } }));
});

describe("grupo de pool", () => {
  it("cria grupo no sítio com doadoras validadas", async () => {
    await criarGrupoPool({ nome: "Elite", doadoraIds: [31, 32] }, 7);
    expect(mocks.animalFindMany).toHaveBeenCalledWith({ where: { id: { in: [31, 32] }, propriedadeId: 7 }, select: { id: true } });
    expect(mocks.grupoCreate).toHaveBeenCalledWith({ data: { nome: "Elite", propriedadeId: 7, itens: { create: [{ doadoraId: 31 }, { doadoraId: 32 }] } }, include: expect.any(Object) });
  });
  it("recusa lista duplicada ou doadora de outro sítio", async () => {
    await expect(criarGrupoPool({ nome: "Elite", doadoraIds: [31, 31] }, 7)).rejects.toEqual(expect.objectContaining<Partial<PoolDoadoraError>>({ code: "CONFLITO" }));
    mocks.animalFindMany.mockResolvedValueOnce([{ id: 31 }]);
    await expect(criarGrupoPool({ nome: "Elite", doadoraIds: [31, 32] }, 7)).rejects.toEqual(expect.objectContaining<Partial<PoolDoadoraError>>({ code: "NAO_ENCONTRADO" }));
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("substitui itens na mesma transação", async () => {
    mocks.animalFindMany.mockResolvedValueOnce([{ id: 32 }]);
    await salvarItensGrupoPool(5, [32], 7);
    expect(mocks.itemDeleteMany).toHaveBeenCalledWith({ where: { grupoId: 5 } });
    expect(mocks.itemCreateMany).toHaveBeenCalledWith({ data: [{ grupoId: 5, doadoraId: 32 }] });
  });
});

describe("aplicar pool", () => {
  it("cria aplicação e uma coleta em rascunho por doadora ativa", async () => {
    const out = await aplicarPool(5, { data: "2026-07-27", tecnico: "Dra. Ana" }, 7);
    expect(mocks.aplicacaoCreate).toHaveBeenCalledWith({ data: { grupoId: 5, data: new Date("2026-07-27T00:00:00Z"), tecnico: "Dra. Ana", propriedadeId: 7 }, select: { id: true } });
    expect(mocks.coletaCreateMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ doadoraId: 31, aplicacaoPoolId: 9, status: "RASCUNHO", metodo: "FIV", propriedadeId: 7 }), expect.objectContaining({ doadoraId: 32, aplicacaoPoolId: 9, status: "RASCUNHO", metodo: "FIV", propriedadeId: 7 })] });
    expect(out).toEqual({ aplicacaoId: 9, coletasCriadas: 2 });
  });
  it("mapeia aplicação repetida no mesmo dia para conflito", async () => {
    mocks.aplicacaoCreate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Unique", { code: "P2002", clientVersion: "6" }));
    await expect(aplicarPool(5, { data: "2026-07-27" }, 7)).rejects.toEqual(expect.objectContaining<Partial<PoolDoadoraError>>({ code: "CONFLITO" }));
  });
});
