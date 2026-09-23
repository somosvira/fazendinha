import { beforeEach, describe, expect, it, vi } from "vitest";

// Composição da dieta: o produto só entra se já tem estoque (entrada/ajuste
// confirmado) no sítio. O cadastro do produto não diz se ele é estocado.
const mocks = vi.hoisted(() => ({
  dietaFindUnique: vi.fn(),
  produtoFindMany: vi.fn(),
  movimentoGroupBy: vi.fn(),
  dietaItemFindMany: vi.fn(),
  dietaItemDeleteMany: vi.fn(),
  dietaItemCreateMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    dieta: { findUnique: mocks.dietaFindUnique },
    produto: { findMany: mocks.produtoFindMany },
    movimentoEstoque: { groupBy: mocks.movimentoGroupBy },
    dietaItem: { findMany: mocks.dietaItemFindMany },
    $transaction: mocks.transaction,
  },
}));
vi.mock("../propriedade.js", () => ({ propriedadePrincipalId: vi.fn().mockResolvedValue(1) }));
vi.mock("./movimentacao.js", () => ({ registrarMovimentacoes: vi.fn() }));

import { substituirItensDieta } from "./nutricao.js";

const racao = { id: 4, nome: "Ração", unidade: "KG" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({ dietaItem: { deleteMany: mocks.dietaItemDeleteMany, createMany: mocks.dietaItemCreateMany } }));
  mocks.dietaFindUnique.mockResolvedValue({ id: 2 });
  mocks.produtoFindMany.mockResolvedValue([racao]);
  mocks.dietaItemFindMany.mockResolvedValue([]);
});

describe("substituirItensDieta — produto precisa ter estoque no sítio", () => {
  it("produto sem entrada no sítio → erro orientando a registrar compra para estoque", async () => {
    mocks.movimentoGroupBy.mockResolvedValue([]);
    await expect(substituirItensDieta(2, { itens: [{ produtoId: 4, qtdPorCabecaDia: 2 }] }, 7)).rejects.toMatchObject({
      code: "EM_USO",
      message: 'produto "Ração" sem estoque neste sítio — registre uma compra para estoque antes de usar na dieta',
    });
    expect(mocks.dietaItemCreateMany).not.toHaveBeenCalled();
    expect(mocks.movimentoGroupBy).toHaveBeenCalledWith({
      by: ["produtoId"],
      where: { produtoId: { in: [4] }, tipo: { in: ["ENTRADA", "AJUSTE"] }, status: "CONFIRMADO", reversaoDeId: null, propriedadeId: 7 },
    });
  });

  it("produto com entrada no sítio → grava a composição", async () => {
    mocks.movimentoGroupBy.mockResolvedValue([{ produtoId: 4 }]);
    await substituirItensDieta(2, { itens: [{ produtoId: 4, qtdPorCabecaDia: 2 }] }, 7);
    expect(mocks.dietaItemCreateMany).toHaveBeenCalledWith({ data: [{ dietaId: 2, produtoId: 4, qtdPorCabecaDia: 2, unidade: "KG", ordem: 0 }] });
  });
});
