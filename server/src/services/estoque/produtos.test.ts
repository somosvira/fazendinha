import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  produtoCreate: vi.fn(), produtoFindUnique: vi.fn(), produtoUpdate: vi.fn(), produtoFindMany: vi.fn(),
  parceiroFindMany: vi.fn(), centroCustoFindMany: vi.fn(), auditoria: vi.fn(), transaction: vi.fn(), itemFindFirst: vi.fn(),
}));

vi.mock("../../db.js", () => {
  const tx = {
    produto: { create: mocks.produtoCreate, findUnique: mocks.produtoFindUnique, update: mocks.produtoUpdate },
    parceiro: { findMany: mocks.parceiroFindMany },
    centroCusto: { findMany: mocks.centroCustoFindMany },
    auditoriaFinanceira: { create: mocks.auditoria },
  };
  mocks.transaction.mockImplementation(async (fn: (db: unknown) => unknown) => fn(tx));
  return { prisma: { produto: { findMany: mocks.produtoFindMany }, itemOperacao: { findFirst: mocks.itemFindFirst }, $transaction: mocks.transaction } };
});

import { atualizarProduto, criarProduto, obterUltimoPreco } from "./produtos.js";
import { Prisma } from "@prisma/client";

const base = { id: 1, nome: "Ração", unidade: "kg", estocavel: true, minimoEstoque: null, categoriaId: 3, ativo: true, categoria: { id: 3, nome: "Alimentação", classificacao: "CUSTEIO", usoSanitario: false, usoNutricional: true, usoAgricola: false } };
const fornecedor = { id: 7, nome: "Cooperativa", ativo: true, tipo: "FORNECEDOR", papeis: [{ papel: "FORNECEDOR" }] };
const centro = { id: 4, nome: "Pecuária", ativo: true };

import type { ProdutoInput } from "./produtos.schemas.js";

const input = (over: Partial<ProdutoInput> = {}): ProdutoInput => ({
  nome: "Ração", unidade: "kg",
  estocavel: true, minimoEstoque: null, categoriaId: 3, centroCustoIds: [], fornecedorIds: [],
  ...over,
});

describe("cadastro de produtos (estoque)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.produtoCreate.mockImplementation(async ({ data }) => ({ ...base, ...data, fornecedores: [], centrosCusto: [] }));
    mocks.produtoFindUnique.mockResolvedValue({ ...base, fornecedores: [], centrosCusto: [] });
    mocks.produtoUpdate.mockImplementation(async ({ data }) => ({
      ...base, ...data,
      fornecedores: (data.fornecedores?.create ?? []).map(({ fornecedorId }: { fornecedorId: number }) => ({ fornecedor: { ...fornecedor, id: fornecedorId } })),
      centrosCusto: (data.centrosCusto?.create ?? []).map(({ centroCustoId }: { centroCustoId: number }) => ({ centroCusto: { ...centro, id: centroCustoId } })),
    }));
    mocks.parceiroFindMany.mockResolvedValue([fornecedor]);
    mocks.centroCustoFindMany.mockResolvedValue([centro]);
  });

  it("cria produto sem exigir fornecedor nem centro de custo", async () => {
    await criarProduto(input(), 9);
    expect(mocks.produtoCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ nome: "Ração", fornecedores: { create: [] }, centrosCusto: { create: [] } }) }));
    expect(mocks.parceiroFindMany).not.toHaveBeenCalled();
    expect(mocks.centroCustoFindMany).not.toHaveBeenCalled();
    expect(mocks.auditoria).toHaveBeenCalled();
  });

  it("substitui o catálogo por vários fornecedores e centros de custo sem alterar movimentos", async () => {
    const segundoFornecedor = { ...fornecedor, id: 8, nome: "Agropecuária" };
    const segundoCentro = { ...centro, id: 5, nome: "Agronomia" };
    mocks.parceiroFindMany.mockResolvedValue([fornecedor, segundoFornecedor]);
    mocks.centroCustoFindMany.mockResolvedValue([centro, segundoCentro]);
    await atualizarProduto(1, { fornecedorIds: [7, 8], centroCustoIds: [4, 5] }, 9);
    expect(mocks.produtoUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        fornecedores: { deleteMany: {}, create: [{ fornecedorId: 7 }, { fornecedorId: 8 }] },
        centrosCusto: { deleteMany: {}, create: [{ centroCustoId: 4 }, { centroCustoId: 5 }] },
      },
    }));
    expect(mocks.produtoUpdate.mock.calls[0][0].data).not.toHaveProperty("movimentos");
  });

  it("patch parcial sem centroCustoIds preserva os centros existentes", async () => {
    mocks.produtoFindUnique.mockResolvedValue({ ...base, fornecedores: [], centrosCusto: [{ centroCustoId: 4, centroCusto: centro }] });
    await atualizarProduto(1, { nome: "Ração premium" }, 9);
    const data = mocks.produtoUpdate.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("centrosCusto");
    expect(data).not.toHaveProperty("fornecedores");
  });

  it("rejeita parceiro que não seja fornecedor ativo", async () => {
    mocks.parceiroFindMany.mockResolvedValue([{ ...fornecedor, papeis: [{ papel: "CLIENTE" }] }]);
    await expect(criarProduto(input({ fornecedorIds: [7] }), 9)).rejects.toMatchObject({ code: "VALIDACAO", campo: "fornecedorIds" });
    expect(mocks.produtoCreate).not.toHaveBeenCalled();
  });

  it("rejeita centro de custo inativo", async () => {
    mocks.centroCustoFindMany.mockResolvedValue([{ ...centro, ativo: false }]);
    await expect(criarProduto(input({ centroCustoIds: [4] }), 9)).rejects.toMatchObject({ code: "VALIDACAO", campo: "centroCustoIds" });
    expect(mocks.produtoCreate).not.toHaveBeenCalled();
  });

  it("exige categoria quando o produto é estocável", async () => {
    await expect(criarProduto(input({ categoriaId: null }), 9)).rejects.toMatchObject({ code: "VALIDACAO", campo: "categoriaId" });
    expect(mocks.produtoCreate).not.toHaveBeenCalled();
  });

  it("permite produto não estocável sem categoria", async () => {
    await criarProduto(input({ estocavel: false, categoriaId: null }), 9);
    expect(mocks.produtoCreate).toHaveBeenCalled();
  });
});

describe("obterUltimoPreco", () => {
  const item = (valor: string, parceiro: { id: number; nome: string } | null) => ({ valorUnitario: new Prisma.Decimal(valor), operacao: { data: new Date("2026-09-01T00:00:00Z"), parceiro } });
  beforeEach(() => vi.clearAllMocks());

  it("prefere a última compra confirmada do fornecedor informado", async () => {
    mocks.itemFindFirst.mockResolvedValueOnce(item("7.5", { id: 4, nome: "Cooperativa" }));
    expect(await obterUltimoPreco(12, { parceiroId: 4, propriedadeId: 3 })).toEqual({ valorUnitario: "7.5", data: "2026-09-01", parceiro: { id: 4, nome: "Cooperativa" } });
    expect(mocks.itemFindFirst).toHaveBeenCalledTimes(1);
    expect(mocks.itemFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { produtoId: 12, operacao: { tipo: { in: ["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO"] }, status: "CONFIRMADA", propriedadeId: 3, parceiroId: 4 } },
      orderBy: [{ operacao: { data: "desc" } }, { id: "desc" }],
    }));
  });

  it("sem compra do fornecedor, cai na última compra de qualquer fornecedor", async () => {
    mocks.itemFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(item("6", { id: 9, nome: "Agro Sul" }));
    expect(await obterUltimoPreco(12, { parceiroId: 4 })).toEqual({ valorUnitario: "6", data: "2026-09-01", parceiro: { id: 9, nome: "Agro Sul" } });
    expect(mocks.itemFindFirst.mock.calls[1][0].where.operacao).not.toHaveProperty("parceiroId");
  });

  it("sem histórico devolve null", async () => {
    mocks.itemFindFirst.mockResolvedValue(null);
    expect(await obterUltimoPreco(12)).toBeNull();
    expect(mocks.itemFindFirst).toHaveBeenCalledTimes(1);
  });
});
