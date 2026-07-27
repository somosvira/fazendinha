import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reprodutorFindFirst: vi.fn(),
  tipoSemenFindMany: vi.fn(),
  tipoSemenFindUnique: vi.fn(),
  tipoSemenCreate: vi.fn(),
  estoqueSemenFindMany: vi.fn(),
  estoqueSemenFindFirst: vi.fn(),
  estoqueSemenCreate: vi.fn(),
  estoqueSemenUpdate: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    reprodutor: { findFirst: mocks.reprodutorFindFirst },
    tipoSemen: {
      findMany: mocks.tipoSemenFindMany,
      findUnique: mocks.tipoSemenFindUnique,
      create: mocks.tipoSemenCreate,
    },
    estoqueSemen: {
      findMany: mocks.estoqueSemenFindMany,
      findFirst: mocks.estoqueSemenFindFirst,
      create: mocks.estoqueSemenCreate,
      update: mocks.estoqueSemenUpdate,
    },
  },
}));

import {
  SemenError,
  ajustarDoses,
  criarLoteSemen,
  criarTipoSemen,
  listarEstoqueSemen,
  listarTiposSemen,
} from "./semen.js";

const lote = {
  id: 18,
  reprodutorId: 31,
  tipoSemenId: 4,
  tipoSemen: { nome: "Sexado" },
  lote: "SX-2026-07",
  localizacao: "Botijão 2",
  dosesDisponiveis: 12,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reprodutorFindFirst.mockResolvedValue({ id: 31 });
  mocks.tipoSemenFindUnique.mockResolvedValue({ id: 4 });
  mocks.tipoSemenFindMany.mockResolvedValue([]);
  mocks.estoqueSemenFindMany.mockResolvedValue([]);
  mocks.estoqueSemenCreate.mockResolvedValue(lote);
  mocks.estoqueSemenUpdate.mockResolvedValue(lote);
});

describe("tipos de sêmen compartilhados", () => {
  it("lista e cria o dicionário sem escopo de propriedade", async () => {
    mocks.tipoSemenFindMany.mockResolvedValue([{ id: 4, sigla: "SEX", nome: "Sexado" }]);
    mocks.tipoSemenCreate.mockResolvedValue({ id: 4, sigla: "SEX", nome: "Sexado" });

    await expect(listarTiposSemen()).resolves.toEqual([{ id: 4, sigla: "SEX", nome: "Sexado" }]);
    await expect(criarTipoSemen({ sigla: "SEX", nome: "Sexado" })).resolves.toEqual({
      id: 4,
      sigla: "SEX",
      nome: "Sexado",
    });

    expect(mocks.tipoSemenFindMany).toHaveBeenCalledWith({
      select: { id: true, sigla: true, nome: true },
      orderBy: { sigla: "asc" },
    });
    expect(mocks.tipoSemenCreate).toHaveBeenCalledWith({
      data: { sigla: "SEX", nome: "Sexado" },
      select: { id: true, sigla: true, nome: true },
    });
  });

  it("mapeia sigla duplicada para conflito de domínio", async () => {
    mocks.tipoSemenCreate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "6.0.0" },
    ));

    await expect(criarTipoSemen({ sigla: "SEX", nome: "Sexado" })).rejects.toEqual(
      expect.objectContaining<Partial<SemenError>>({ code: "CONFLITO", message: "sigla já cadastrada" }),
    );
  });
});

describe("estoque de sêmen por sítio", () => {
  it("recusa listar estoque de reprodutor fora do catálogo visível", async () => {
    mocks.reprodutorFindFirst.mockResolvedValue(null);

    await expect(listarEstoqueSemen(31, 7)).rejects.toEqual(
      expect.objectContaining<Partial<SemenError>>({ code: "NAO_ENCONTRADO" }),
    );
    expect(mocks.reprodutorFindFirst).toHaveBeenCalledWith({
      where: { id: 31, OR: [{ propriedadeId: 7 }, { propriedadeId: null }] },
      select: { id: true },
    });
    expect(mocks.estoqueSemenFindMany).not.toHaveBeenCalled();
  });

  it("lista somente lotes do reprodutor e do sítio", async () => {
    mocks.estoqueSemenFindMany.mockResolvedValue([lote]);

    await expect(listarEstoqueSemen(31, 7)).resolves.toEqual([{
      id: 18,
      reprodutorId: 31,
      tipoSemenId: 4,
      tipoSemenNome: "Sexado",
      lote: "SX-2026-07",
      localizacao: "Botijão 2",
      dosesDisponiveis: 12,
    }]);
    expect(mocks.estoqueSemenFindMany).toHaveBeenCalledWith({
      where: { reprodutorId: 31, propriedadeId: 7 },
      include: { tipoSemen: { select: { nome: true } } },
      orderBy: [{ dosesDisponiveis: "desc" }, { id: "asc" }],
    });
  });

  it("recusa criar lote para reprodutor de outro sítio", async () => {
    mocks.reprodutorFindFirst.mockResolvedValue(null);

    await expect(criarLoteSemen(31, { dosesDisponiveis: 12 }, 7)).rejects.toEqual(
      expect.objectContaining<Partial<SemenError>>({ code: "NAO_ENCONTRADO" }),
    );
    expect(mocks.estoqueSemenCreate).not.toHaveBeenCalled();
  });

  it("recusa tipo de sêmen inexistente antes de criar o lote", async () => {
    mocks.tipoSemenFindUnique.mockResolvedValue(null);

    await expect(criarLoteSemen(31, {
      tipoSemenId: 404,
      lote: "SX-2026-07",
      dosesDisponiveis: 12,
    }, 7)).rejects.toEqual(
      expect.objectContaining<Partial<SemenError>>({ code: "NAO_ENCONTRADO", message: "tipo de sêmen não encontrado" }),
    );
    expect(mocks.tipoSemenFindUnique).toHaveBeenCalledWith({
      where: { id: 404 },
      select: { id: true },
    });
    expect(mocks.estoqueSemenCreate).not.toHaveBeenCalled();
  });

  it("cria lote com o escopo do sítio e devolve o nome do tipo", async () => {
    await expect(criarLoteSemen(31, {
      tipoSemenId: 4,
      lote: "SX-2026-07",
      localizacao: "Botijão 2",
      dosesDisponiveis: 12,
    }, 7)).resolves.toEqual({
      id: 18,
      reprodutorId: 31,
      tipoSemenId: 4,
      tipoSemenNome: "Sexado",
      lote: "SX-2026-07",
      localizacao: "Botijão 2",
      dosesDisponiveis: 12,
    });
    expect(mocks.estoqueSemenCreate).toHaveBeenCalledWith({
      data: {
        reprodutorId: 31,
        tipoSemenId: 4,
        lote: "SX-2026-07",
        localizacao: "Botijão 2",
        dosesDisponiveis: 12,
        propriedadeId: 7,
      },
      include: { tipoSemen: { select: { nome: true } } },
    });
  });

  it("trava em zero quando o ajuste levaria o saldo a negativo", async () => {
    mocks.estoqueSemenFindFirst.mockResolvedValue(lote);
    mocks.estoqueSemenUpdate.mockResolvedValue({ ...lote, dosesDisponiveis: 0 });

    await expect(ajustarDoses(18, { delta: -20 }, 7)).resolves.toEqual(
      expect.objectContaining({ id: 18, dosesDisponiveis: 0 }),
    );
    expect(mocks.estoqueSemenFindFirst).toHaveBeenCalledWith({
      where: { id: 18, propriedadeId: 7 },
      include: { tipoSemen: { select: { nome: true } } },
    });
    expect(mocks.estoqueSemenUpdate).toHaveBeenCalledWith({
      where: { id: 18 },
      data: { dosesDisponiveis: 0 },
      include: { tipoSemen: { select: { nome: true } } },
    });
  });

  it("recusa ajustar lote de outro sítio sem revelar sua existência", async () => {
    mocks.estoqueSemenFindFirst.mockResolvedValue(null);

    await expect(ajustarDoses(18, { delta: 3 }, 7)).rejects.toEqual(
      expect.objectContaining<Partial<SemenError>>({ code: "NAO_ENCONTRADO" }),
    );
    expect(mocks.estoqueSemenUpdate).not.toHaveBeenCalled();
  });
});
