import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  produtoCreate: vi.fn(), produtoFindUnique: vi.fn(), produtoUpdate: vi.fn(), produtoFindMany: vi.fn(),
  parceiroFindMany: vi.fn(), centroCustoFindMany: vi.fn(), auditoria: vi.fn(), transaction: vi.fn(), itemFindFirst: vi.fn(),
  movimentoCount: vi.fn(), itemOperacaoCount: vi.fn(), operacaoAgricolaCount: vi.fn(),
  itemDietaCount: vi.fn().mockResolvedValue(0), categoriaFindUnique: vi.fn(),
}));

vi.mock("../../db.js", () => {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(0),
    materialGenetico: { count: vi.fn().mockResolvedValue(0) },
    aplicacaoProduto: { count: vi.fn().mockResolvedValue(0) },
    etapaProtocoloSanitario: { count: vi.fn().mockResolvedValue(0) },
    itemFechamentoConsumo: { count: vi.fn().mockResolvedValue(0) },
    produto: { create: mocks.produtoCreate, findUnique: mocks.produtoFindUnique, update: mocks.produtoUpdate },
    parceiro: { findMany: mocks.parceiroFindMany },
    centroCusto: { findMany: mocks.centroCustoFindMany },
    auditoriaFinanceira: { create: mocks.auditoria },
    movimentoEstoque: { count: mocks.movimentoCount },
    itemOperacao: { count: mocks.itemOperacaoCount },
    operacaoAgricola: { count: mocks.operacaoAgricolaCount },
    itemDieta: { count: mocks.itemDietaCount },
    categoria: { findUnique: mocks.categoriaFindUnique },
  };
  mocks.transaction.mockImplementation(async (fn: (db: unknown) => unknown) => fn(tx));
  return { prisma: { produto: { findMany: mocks.produtoFindMany }, itemOperacao: { findFirst: mocks.itemFindFirst }, $transaction: mocks.transaction } };
});

import { atualizarProduto, criarProduto, obterUltimoPreco } from "./produtos.js";
import { Prisma } from "@prisma/client";
import { uid } from "../../lib/uid.fixture.js";

const base = { id: uid(1), nome: "Ração", unidade: "KG", minimoEstoque: null, categoriaId: uid(3), ativo: true, categoria: { id: uid(3), nome: "Alimentação", classificacao: "CUSTEIO", usoAgricola: false } };
const fornecedor = { id: uid(7), nome: "Cooperativa", ativo: true, tipo: "FORNECEDOR", papeis: [{ papel: "FORNECEDOR" }] };
const centro = { id: uid(4), nome: "Pecuária", ativo: true };

import type { ProdutoInput } from "./produtos.schemas.js";

const input = (over: Partial<ProdutoInput> = {}): ProdutoInput => ({
  nome: "Ração", unidade: "KG",
  minimoEstoque: null, categoriaId: uid(3), centroCustoIds: [], fornecedorIds: [],
  ...over,
});

describe("cadastro de produtos (estoque)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.produtoCreate.mockImplementation(async ({ data }) => ({ ...base, ...data, fornecedores: [], centrosCusto: [] }));
    mocks.produtoFindUnique.mockResolvedValue({ ...base, fornecedores: [], centrosCusto: [] });
    mocks.produtoUpdate.mockImplementation(async ({ data }) => ({
      ...base, ...data,
      fornecedores: (data.fornecedores?.create ?? []).map(({ fornecedorId }: { fornecedorId: string }) => ({ fornecedor: { ...fornecedor, id: fornecedorId } })),
      centrosCusto: (data.centrosCusto?.create ?? []).map(({ centroCustoId }: { centroCustoId: string }) => ({ centroCusto: { ...centro, id: centroCustoId } })),
    }));
    mocks.parceiroFindMany.mockResolvedValue([fornecedor]);
    mocks.centroCustoFindMany.mockResolvedValue([centro]);
    mocks.movimentoCount.mockResolvedValue(0);
    mocks.itemOperacaoCount.mockResolvedValue(0);
    mocks.operacaoAgricolaCount.mockResolvedValue(0);
  });

  it("cria produto sem exigir fornecedor nem centro de custo", async () => {
    await criarProduto(input(), 9);
    expect(mocks.produtoCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ nome: "Ração", fornecedores: { create: [] }, centrosCusto: { create: [] } }) }));
    expect(mocks.parceiroFindMany).not.toHaveBeenCalled();
    expect(mocks.centroCustoFindMany).not.toHaveBeenCalled();
    expect(mocks.auditoria).toHaveBeenCalled();
  });

  it("substitui o catálogo por vários fornecedores e centros de custo sem alterar movimentos", async () => {
    const segundoFornecedor = { ...fornecedor, id: uid(8), nome: "Agropecuária" };
    const segundoCentro = { ...centro, id: uid(5), nome: "Agronomia" };
    mocks.parceiroFindMany.mockResolvedValue([fornecedor, segundoFornecedor]);
    mocks.centroCustoFindMany.mockResolvedValue([centro, segundoCentro]);
    await atualizarProduto(uid(1), { fornecedorIds: [uid(7), uid(8)], centroCustoIds: [uid(4), uid(5)] }, 9);
    expect(mocks.produtoUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        fornecedores: { deleteMany: {}, create: [{ fornecedorId: uid(7) }, { fornecedorId: uid(8) }] },
        centrosCusto: { deleteMany: {}, create: [{ centroCustoId: uid(4) }, { centroCustoId: uid(5) }] },
      },
    }));
    expect(mocks.produtoUpdate.mock.calls[0][0].data).not.toHaveProperty("movimentos");
  });

  it("patch parcial sem centroCustoIds preserva os centros existentes", async () => {
    mocks.produtoFindUnique.mockResolvedValue({ ...base, fornecedores: [], centrosCusto: [{ centroCustoId: uid(4), centroCusto: centro }] });
    await atualizarProduto(uid(1), { nome: "Ração premium" }, 9);
    const data = mocks.produtoUpdate.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("centrosCusto");
    expect(data).not.toHaveProperty("fornecedores");
  });

  it("rejeita parceiro que não seja fornecedor ativo", async () => {
    mocks.parceiroFindMany.mockResolvedValue([{ ...fornecedor, papeis: [{ papel: "CLIENTE" }] }]);
    await expect(criarProduto(input({ fornecedorIds: [uid(7)] }), 9)).rejects.toMatchObject({ code: "VALIDACAO", campo: "fornecedorIds" });
    expect(mocks.produtoCreate).not.toHaveBeenCalled();
  });

  it("rejeita centro de custo inativo", async () => {
    mocks.centroCustoFindMany.mockResolvedValue([{ ...centro, ativo: false }]);
    await expect(criarProduto(input({ centroCustoIds: [uid(4)] }), 9)).rejects.toMatchObject({ code: "VALIDACAO", campo: "centroCustoIds" });
    expect(mocks.produtoCreate).not.toHaveBeenCalled();
  });

  it("exige categoria em todo produto no create", async () => {
    await expect(criarProduto(input({ categoriaId: null as unknown as string }), 9)).rejects.toMatchObject({ code: "VALIDACAO", campo: "categoriaId", message: "Produto precisa de uma categoria" });
    expect(mocks.produtoCreate).not.toHaveBeenCalled();
  });

  it("cria com categoria e não grava nenhum atributo de estoque no cadastro", async () => {
    await criarProduto(input(), 9);
    const data = mocks.produtoCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({ categoriaId: uid(3) });
    expect(data).not.toHaveProperty("estocavel");
  });

  it("patch que remove a categoria é rejeitado", async () => {
    await expect(atualizarProduto(uid(1), { categoriaId: null as unknown as string }, 9)).rejects.toMatchObject({ code: "VALIDACAO", campo: "categoriaId" });
    expect(mocks.produtoUpdate).not.toHaveBeenCalled();
  });

  it("patch de produto legado sem categoria exige informar a categoria", async () => {
    mocks.produtoFindUnique.mockResolvedValue({ ...base, categoriaId: null, categoria: null, fornecedores: [], centrosCusto: [] });
    await expect(atualizarProduto(uid(1), { nome: "Ração premium" }, 9)).rejects.toMatchObject({ code: "VALIDACAO", campo: "categoriaId" });
    await atualizarProduto(uid(1), { nome: "Ração premium", categoriaId: uid(3) }, 9);
    expect(mocks.produtoUpdate).toHaveBeenCalledTimes(1);
  });

  it("produto legado sem categoria ainda pode ser ativado/desativado", async () => {
    mocks.produtoFindUnique.mockResolvedValue({ ...base, categoriaId: null, categoria: null, fornecedores: [], centrosCusto: [] });
    await atualizarProduto(uid(1), { ativo: false }, 9);
    expect(mocks.produtoUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { ativo: false } }));
  });
});

describe("troca de unidade com movimento/dieta registrados", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.produtoUpdate.mockImplementation(async ({ data }) => ({ ...base, ...data, fornecedores: [], centrosCusto: [] }));
    mocks.movimentoCount.mockResolvedValue(0);
    mocks.itemOperacaoCount.mockResolvedValue(0);
    mocks.operacaoAgricolaCount.mockResolvedValue(0);
  });

  it("produto sem movimento nem histórico pode trocar de unidade", async () => {
    mocks.produtoFindUnique.mockResolvedValue({ ...base, unidade: "KG", fornecedores: [], centrosCusto: [] });
    await atualizarProduto(uid(1), { unidade: "SC" }, 9);
    expect(mocks.produtoUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ unidade: "SC" }) }));
  });

  it("produto com movimento de estoque não pode trocar de unidade", async () => {
    mocks.produtoFindUnique.mockResolvedValue({ ...base, unidade: "KG", fornecedores: [], centrosCusto: [] });
    mocks.movimentoCount.mockResolvedValue(3);
    await expect(atualizarProduto(uid(1), { unidade: "SC" }, 9)).rejects.toMatchObject({ code: "VALIDACAO", campo: "unidade" });
    expect(mocks.produtoUpdate).not.toHaveBeenCalled();
  });

  it("produto com item de operação (compra/venda) não pode trocar de unidade", async () => {
    mocks.produtoFindUnique.mockResolvedValue({ ...base, unidade: "KG", fornecedores: [], centrosCusto: [] });
    mocks.itemOperacaoCount.mockResolvedValue(1);
    await expect(atualizarProduto(uid(1), { unidade: "SC" }, 9)).rejects.toMatchObject({ code: "VALIDACAO", campo: "unidade" });
    expect(mocks.produtoUpdate).not.toHaveBeenCalled();
  });

  it("produto com operação agrícola com doseValor não pode trocar de unidade", async () => {
    mocks.produtoFindUnique.mockResolvedValue({ ...base, unidade: "KG", fornecedores: [], centrosCusto: [] });
    mocks.operacaoAgricolaCount.mockResolvedValue(1);
    await expect(atualizarProduto(uid(1), { unidade: "SC" }, 9)).rejects.toMatchObject({ code: "VALIDACAO", campo: "unidade" });
    expect(mocks.produtoUpdate).not.toHaveBeenCalled();
  });

  it("produto sem nenhum histórico continua livre para trocar de unidade", async () => {
    mocks.produtoFindUnique.mockResolvedValue({ ...base, unidade: "KG", fornecedores: [], centrosCusto: [] });
    await atualizarProduto(uid(1), { unidade: "SC" }, 9);
    expect(mocks.produtoUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ unidade: "SC" }) }));
  });

  it("produto com movimento mas SEM trocar a unidade continua passando", async () => {
    mocks.produtoFindUnique.mockResolvedValue({ ...base, unidade: "KG", fornecedores: [], centrosCusto: [] });
    mocks.movimentoCount.mockResolvedValue(3);
    await atualizarProduto(uid(1), { nome: "Ração premium" }, 9);
    expect(mocks.produtoUpdate).toHaveBeenCalled();
    expect(mocks.movimentoCount).not.toHaveBeenCalled();
  });

  it("mesma unidade enviada explicitamente não dispara a checagem", async () => {
    mocks.produtoFindUnique.mockResolvedValue({ ...base, unidade: "KG", fornecedores: [], centrosCusto: [] });
    mocks.movimentoCount.mockResolvedValue(3);
    await atualizarProduto(uid(1), { unidade: "KG" }, 9);
    expect(mocks.produtoUpdate).toHaveBeenCalled();
    expect(mocks.movimentoCount).not.toHaveBeenCalled();
  });
});

describe("obterUltimoPreco", () => {
  const item = (valor: string, parceiro: { id: string; nome: string } | null) => ({ valorUnitario: new Prisma.Decimal(valor), operacao: { data: new Date("2026-09-01T00:00:00Z"), parceiro } });
  beforeEach(() => vi.clearAllMocks());

  it("prefere a última compra confirmada do fornecedor informado", async () => {
    mocks.itemFindFirst.mockResolvedValueOnce(item("7.5", { id: uid(4), nome: "Cooperativa" }));
    expect(await obterUltimoPreco(uid(12), { parceiroId: uid(4), propriedadeId: 3 })).toEqual({ valorUnitario: "7.5", data: "2026-09-01", parceiro: { id: uid(4), nome: "Cooperativa" } });
    expect(mocks.itemFindFirst).toHaveBeenCalledTimes(1);
    expect(mocks.itemFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { produtoId: uid(12), operacao: { tipo: { in: ["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO"] }, status: "CONFIRMADA", propriedadeId: 3, parceiroId: uid(4) } },
      orderBy: [{ operacao: { data: "desc" } }, { operacao: { numero: "desc" } }],
    }));
  });

  it("sem compra do fornecedor, cai na última compra de qualquer fornecedor", async () => {
    mocks.itemFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(item("6", { id: uid(9), nome: "Agro Sul" }));
    expect(await obterUltimoPreco(uid(12), { parceiroId: uid(4) })).toEqual({ valorUnitario: "6", data: "2026-09-01", parceiro: { id: uid(9), nome: "Agro Sul" } });
    expect(mocks.itemFindFirst.mock.calls[1][0].where.operacao).not.toHaveProperty("parceiroId");
  });

  it("sem histórico devolve null", async () => {
    mocks.itemFindFirst.mockResolvedValue(null);
    expect(await obterUltimoPreco(uid(12))).toBeNull();
    expect(mocks.itemFindFirst).toHaveBeenCalledTimes(1);
  });
});
