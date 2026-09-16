import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  produtoCreate: vi.fn(), produtoFindUnique: vi.fn(), produtoUpdate: vi.fn(), produtoFindMany: vi.fn(),
  parceiroFindMany: vi.fn(), auditoria: vi.fn(), transaction: vi.fn(),
}));

vi.mock("../../db.js", () => {
  const tx = {
    produto: { create: mocks.produtoCreate, findUnique: mocks.produtoFindUnique, update: mocks.produtoUpdate },
    parceiro: { findMany: mocks.parceiroFindMany }, auditoriaFinanceira: { create: mocks.auditoria },
  };
  mocks.transaction.mockImplementation(async (fn: (db: unknown) => unknown) => fn(tx));
  return { prisma: { produto: { findMany: mocks.produtoFindMany }, $transaction: mocks.transaction } };
});

import { atualizarProduto, criarProduto } from "./produtos.js";

const base = { id: 1, nome: "Ração", tipo: "RACAO", unidade: "kg", custoUnitario: null, estocavel: true, minimoEstoque: null, categoriaId: null, centroCustoId: null, ativo: true };
const fornecedor = { id: 7, nome: "Cooperativa", ativo: true, tipo: "FORNECEDOR", papeis: [{ papel: "FORNECEDOR" }] };

describe("cadastro financeiro de produtos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.produtoCreate.mockImplementation(async ({ data }) => ({ ...base, ...data, fornecedores: [] }));
    mocks.produtoFindUnique.mockResolvedValue({ ...base, fornecedores: [] });
    mocks.produtoUpdate.mockImplementation(async ({ data }) => ({ ...base, ...data, fornecedores: (data.fornecedores?.create ?? []).map(({ fornecedorId }: { fornecedorId: number }) => ({ fornecedor: { ...fornecedor, id: fornecedorId } })) }));
    mocks.parceiroFindMany.mockResolvedValue([fornecedor]);
  });

  it("cria produto sem exigir fornecedor", async () => {
    await criarProduto({ nome: "Ração", tipo: "RACAO", unidade: "kg", custoUnitario: null, estocavel: true, minimoEstoque: null, categoriaId: null, centroCustoId: null, fornecedorIds: [] }, 9);
    expect(mocks.produtoCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ nome: "Ração", fornecedores: { create: [] } }) }));
    expect(mocks.parceiroFindMany).not.toHaveBeenCalled();
    expect(mocks.auditoria).toHaveBeenCalled();
  });

  it("substitui o catálogo por vários fornecedores sem alterar movimentos", async () => {
    const segundo = { ...fornecedor, id: 8, nome: "Agropecuária" };
    mocks.parceiroFindMany.mockResolvedValue([fornecedor, segundo]);
    await atualizarProduto(1, { fornecedorIds: [7, 8] }, 9);
    expect(mocks.produtoUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { fornecedores: { deleteMany: {}, create: [{ fornecedorId: 7 }, { fornecedorId: 8 }] } } }));
    expect(mocks.produtoUpdate.mock.calls[0][0].data).not.toHaveProperty("movimentos");
  });

  it("rejeita parceiro que não seja fornecedor ativo", async () => {
    mocks.parceiroFindMany.mockResolvedValue([{ ...fornecedor, papeis: [{ papel: "CLIENTE" }] }]);
    await expect(criarProduto({ nome: "Sal", tipo: "MINERAL", unidade: "kg", custoUnitario: null, estocavel: true, minimoEstoque: null, categoriaId: null, centroCustoId: null, fornecedorIds: [7] }, 9)).rejects.toMatchObject({ code: "VALIDACAO", campo: "fornecedorIds" });
    expect(mocks.produtoCreate).not.toHaveBeenCalled();
  });
});
