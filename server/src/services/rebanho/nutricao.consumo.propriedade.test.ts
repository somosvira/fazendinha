import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  grupoFindFirst: vi.fn(),
  animalCount: vi.fn(),
  movimentoFindMany: vi.fn(),
  consumoFindFirst: vi.fn(),
  consumoFindMany: vi.fn(),
  fechamentoFindMany: vi.fn(),
  consumoDelete: vi.fn(),
  assertMesAberto: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    grupo: { findFirst: mocks.grupoFindFirst },
    animal: { count: mocks.animalCount },
    movimentoEstoque: { findMany: mocks.movimentoFindMany },
    consumoPeriodo: {
      findFirst: mocks.consumoFindFirst,
      findMany: mocks.consumoFindMany,
      delete: mocks.consumoDelete,
    },
    fechamentoMensal: { findMany: mocks.fechamentoFindMany },
  },
}));

vi.mock("../fechamento.js", () => ({
  assertMesAberto: mocks.assertMesAberto,
  FechamentoMensalError: class FechamentoMensalError extends Error {},
}));
vi.mock("../propriedade.js", () => ({ propriedadePrincipalId: vi.fn().mockResolvedValue(1) }));

import { listarConsumosPeriodo, previsaoConsumo, reabrirConsumoPeriodo } from "./nutricao.consumo.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.animalCount.mockResolvedValue(3);
  mocks.movimentoFindMany.mockResolvedValue([]);
  mocks.consumoFindMany.mockResolvedValue([]);
  mocks.fechamentoFindMany.mockResolvedValue([]);
  mocks.assertMesAberto.mockResolvedValue(undefined);
});

describe("consumo de dieta por propriedade", () => {
  it("lê lote, cabeças e saldo somente do sítio ativo", async () => {
    mocks.grupoFindFirst.mockResolvedValue({
      id: 10,
      nome: "Alta",
      propriedadeId: 7,
      dieta: {
        id: 2,
        nome: "Lactação",
        itens: [{
          produtoId: 4,
          unidade: "kg",
          qtdPorCabecaDia: 2,
          produto: { id: 4, nome: "Ração", centrosCusto: [] },
        }],
      },
    });

    await previsaoConsumo(10, "2026-07-01", "2026-07-02", 7);

    expect(mocks.grupoFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 10, propriedadeId: 7 },
    }));
    expect(mocks.animalCount).toHaveBeenCalledWith({
      where: { grupoId: 10, status: "ATIVO", propriedadeId: 7 },
    });
    expect(mocks.movimentoFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { produtoId: { in: [4] }, propriedadeId: 7 },
    }));
  });

  it("valoriza a prévia pelo custo médio das entradas do sítio do lote", async () => {
    mocks.grupoFindFirst.mockResolvedValue({
      id: 10, nome: "Alta", propriedadeId: 7,
      dieta: { id: 2, nome: "Lactação", itens: [{ produtoId: 4, unidade: "kg", qtdPorCabecaDia: 2, produto: { id: 4, nome: "Ração", centrosCusto: [] } }] },
    });
    const { Prisma } = await import("@prisma/client");
    mocks.movimentoFindMany.mockImplementation(async (args: { where: { reversaoDeId?: null } }) => "reversaoDeId" in args.where
      ? [
        { produtoId: 4, tipo: "ENTRADA", origem: "COMPRA", status: "CONFIRMADO", reversaoDeId: null, quantidade: new Prisma.Decimal(10), valorTotal: new Prisma.Decimal(20) },
        { produtoId: 4, tipo: "ENTRADA", origem: "COMPRA", status: "CONFIRMADO", reversaoDeId: null, quantidade: new Prisma.Decimal(10), valorTotal: new Prisma.Decimal(40) },
      ]
      : []);

    const prev = await previsaoConsumo(10, "2026-07-01", "2026-07-02", null);

    // 3 cabeças × 2 kg × 2 dias = 12 kg a R$ 3,00 (médio de 2 e 4)
    expect(prev.linhas[0]).toEqual(expect.objectContaining({ quantidade: 12, custoUnitario: 3, custoTotal: 36 }));
    expect(mocks.movimentoFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ produtoId: { in: [4] }, status: "CONFIRMADO", AND: expect.arrayContaining([{ propriedadeId: 7 }]) }),
    }));
  });

  it("não lista consumo de lote de outro sítio", async () => {
    mocks.grupoFindFirst.mockResolvedValue(null);

    await expect(listarConsumosPeriodo(10, 7)).rejects.toEqual(expect.objectContaining({ code: "NAO_ENCONTRADO" }));
    expect(mocks.consumoFindMany).not.toHaveBeenCalled();
  });

  it("não estorna fechamento de outro sítio", async () => {
    mocks.consumoFindFirst.mockResolvedValue(null);

    await expect(reabrirConsumoPeriodo(44, 7)).rejects.toEqual(expect.objectContaining({ code: "NAO_ENCONTRADO" }));
    expect(mocks.consumoFindFirst).toHaveBeenCalledWith({
      where: { id: 44, grupo: { propriedadeId: 7 } },
      include: { grupo: true },
    });
    expect(mocks.consumoDelete).not.toHaveBeenCalled();
  });
});
