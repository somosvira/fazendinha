import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  periodo: vi.fn(),
  parceiro: vi.fn(),
  categoria: vi.fn(),
  centro: vi.fn(),
  produto: vi.fn(),
  operacaoCreate: vi.fn(),
  operacaoFindUniqueOrThrow: vi.fn(),
  movimentoEstoqueCreate: vi.fn(),
  movimentoEstoqueFindMany: vi.fn(),
  movimentoEstoqueGroupBy: vi.fn(),
  auditoriaCreate: vi.fn(),
}));

vi.mock("../../db.js", () => {
  const tx = {
    periodoFinanceiro: { findUnique: mocks.periodo },
    parceiro: { findFirst: mocks.parceiro },
    categoria: { findFirst: mocks.categoria },
    centroCusto: { findMany: mocks.centro },
    produto: { findMany: mocks.produto },
    operacao: { create: mocks.operacaoCreate, findUniqueOrThrow: mocks.operacaoFindUniqueOrThrow },
    movimentoEstoque: { create: mocks.movimentoEstoqueCreate, findMany: mocks.movimentoEstoqueFindMany, groupBy: mocks.movimentoEstoqueGroupBy },
    auditoriaFinanceira: { create: mocks.auditoriaCreate },
  };
  mocks.transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
  return { prisma: { $transaction: mocks.transaction, propriedade: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) } } };
});

import { criarOperacao } from "./operacoes.js";

// Item base de uma operação SERVICO (sem efeito de estoque) — usado nos
// testes de validação de centro por item, que não precisam de produto.
const baseServico = {
  tipo: "SERVICO" as const,
  data: new Date("2026-09-10T00:00:00Z"),
  descricao: "Serviço de manutenção",
  propriedadeId: 1,
  financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" as const },
};

function itemNaoEstocavel(parcial: Partial<Record<string, unknown>> = {}) {
  return {
    descricao: "Item", quantidade: 1, unidade: "un", valorTotal: 100, estocavel: false,
    ...parcial,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.periodo.mockResolvedValue(null);
  mocks.parceiro.mockResolvedValue(null);
  mocks.categoria.mockResolvedValue(null);
  mocks.centro.mockResolvedValue([]);
  mocks.produto.mockResolvedValue([]);
  // A criação em si não importa para os testes (a)-(e): o que se verifica é
  // o payload que chegou em `operacao.create`.
  mocks.operacaoCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
    ({ id: 99, itens: (data.itens as { create: unknown[] }).create.map((item, indice) => ({ id: 100 + indice, ...(item as object) })) }));
  mocks.operacaoFindUniqueOrThrow.mockImplementation(async () => ({ id: 99, itens: [], compromissos: [], transacoes: [], movimentosEstoque: [], documentos: [], parceiro: null }));
  mocks.auditoriaCreate.mockResolvedValue({});
});

describe("centro de custo efetivo do item — criarOperacao", () => {
  it("(a) item não estocável sem centro efetivo (nem próprio, nem da operação) é recusado", async () => {
    await expect(criarOperacao({
      ...baseServico,
      itens: [itemNaoEstocavel()],
    })).rejects.toMatchObject({ code: "VALIDACAO", campo: "itens.0.centroCustoId" });
    expect(mocks.operacaoCreate).not.toHaveBeenCalled();
  });

  it("(b) centro informado no item mas inativo (não devolvido por centroCusto.findMany) é recusado", async () => {
    // O item pede o centro 5, mas o findMany (filtro ativo: true) não o devolve.
    mocks.centro.mockResolvedValue([]);
    await expect(criarOperacao({
      ...baseServico,
      itens: [itemNaoEstocavel({ centroCustoId: 5 })],
    })).rejects.toMatchObject({ code: "VALIDACAO", campo: "itens.0.centroCustoId" });
    expect(mocks.operacaoCreate).not.toHaveBeenCalled();
  });

  it("(c) produto com exatamente 1 centro cadastrado: item sem centroCustoId explícito herda o id do produto e o nome vivo do centro", async () => {
    mocks.produto.mockResolvedValue([{ id: 42, ativo: true, categoriaId: null, centrosCusto: [{ centroCustoId: 3 }] }]);
    mocks.centro.mockResolvedValue([{ id: 3, nome: "Pecuária" }]);
    await criarOperacao({
      ...baseServico,
      itens: [itemNaoEstocavel({ produtoId: 42, centroCustoId: undefined })],
    });
    expect(mocks.operacaoCreate).toHaveBeenCalledTimes(1);
    const dataArg = mocks.operacaoCreate.mock.calls[0][0].data;
    expect(dataArg.itens.create[0]).toMatchObject({ centroCustoId: 3, centroCustoNome: "Pecuária" });
  });

  it("(d) produto com 2 centros cadastrados: item sem centroCustoId explícito não herda nenhum (fica null)", async () => {
    mocks.produto.mockResolvedValue([{ id: 42, ativo: true, categoriaId: null, centrosCusto: [{ centroCustoId: 3 }, { centroCustoId: 4 }] }]);
    mocks.centro.mockResolvedValue([{ id: 3, nome: "Pecuária" }, { id: 4, nome: "Agronomia" }]);
    // Precisa de um centro padrão na operação, já que o item não tem centro
    // próprio (não estocável exige um centro efetivo de algum lugar).
    await criarOperacao({
      ...baseServico,
      centroCustoId: 3,
      itens: [itemNaoEstocavel({ produtoId: 42, centroCustoId: undefined })],
    });
    const dataArg = mocks.operacaoCreate.mock.calls[0][0].data;
    expect(dataArg.itens.create[0]).toMatchObject({ centroCustoId: null, centroCustoNome: null });
  });

  it("(e) centroCustoId: null explícito no item ignora o centro único do produto e herda o da operação", async () => {
    mocks.produto.mockResolvedValue([{ id: 42, ativo: true, categoriaId: null, centrosCusto: [{ centroCustoId: 3 }] }]);
    mocks.centro.mockResolvedValue([{ id: 3, nome: "Pecuária" }, { id: 7, nome: "Sede" }]);
    await criarOperacao({
      ...baseServico,
      centroCustoId: 7,
      itens: [itemNaoEstocavel({ produtoId: 42, centroCustoId: null })],
    });
    const dataArg = mocks.operacaoCreate.mock.calls[0][0].data;
    expect(dataArg.itens.create[0]).toMatchObject({ centroCustoId: null, centroCustoNome: null });
    // O item herda o centro 7 da operação nos relatórios (centroEfetivo), mas
    // o registro do item em si fica com null — quem resolve o efetivo é quem lê.
    expect(dataArg.centroCustoId).toBe(7);
  });

  it("(f) movimentoEstoque.create recebe o centro efetivo (item, senão o da operação)", async () => {
    mocks.produto.mockResolvedValue([
      { id: 42, ativo: true, categoriaId: null, centrosCusto: [{ centroCustoId: 3 }] },
      { id: 43, ativo: true, categoriaId: null, centrosCusto: [] },
    ]);
    mocks.centro.mockResolvedValue([{ id: 3, nome: "Pecuária" }, { id: 7, nome: "Sede" }]);
    await criarOperacao({
      tipo: "COMPRA_ESTOQUE",
      data: new Date("2026-09-10T00:00:00Z"),
      descricao: "Compra de insumos",
      propriedadeId: 1,
      centroCustoId: 7,
      financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" },
      itens: [
        // Item com centro próprio (via produto de 1 centro): usa o do item.
        { descricao: "Ração", quantidade: 10, unidade: "sc", valorTotal: 500, estocavel: true, produtoId: 42 },
        // Item sem centro próprio (produto sem centro cadastrado): usa o da operação.
        { descricao: "Sal mineral", quantidade: 5, unidade: "sc", valorTotal: 200, estocavel: true, produtoId: 43 },
      ],
    });
    expect(mocks.movimentoEstoqueCreate).toHaveBeenCalledTimes(2);
    const centrosUsados = mocks.movimentoEstoqueCreate.mock.calls.map((call) => call[0].data.centroCustoId);
    expect(centrosUsados).toEqual([3, 7]);
  });
});

describe("custo da SAIDA de venda — criarOperacao", () => {
  it("VENDA baixa o estoque pelo custo médio do sítio, não pelo preço de venda", async () => {
    const { Prisma } = await import("@prisma/client");
    mocks.produto.mockResolvedValue([{ id: 42, ativo: true, categoriaId: null, centrosCusto: [{ centroCustoId: 3 }] }]);
    mocks.centro.mockResolvedValue([{ id: 3, nome: "Pecuária" }]);
    // Base agregada no banco: compras 10×5 + 10×7 → 20 / R$ 120.
    mocks.movimentoEstoqueGroupBy.mockResolvedValue([{ produtoId: 42, _sum: { quantidade: new Prisma.Decimal(20), valorTotal: new Prisma.Decimal(120) } }]);
    await criarOperacao({
      tipo: "VENDA", data: new Date("2026-09-10T00:00:00Z"), descricao: "Venda de ração", propriedadeId: 1,
      financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" },
      itens: [{ descricao: "Ração", quantidade: 5, unidade: "sc", valorTotal: 100, estocavel: true, produtoId: 42 }],
    });
    const dados = mocks.movimentoEstoqueCreate.mock.calls[0][0].data;
    expect(dados.tipo).toBe("SAIDA");
    expect(Number(dados.custoUnitario)).toBe(6);
    expect(Number(dados.valorTotal)).toBe(30);
  });

  it("COMPRA_ESTOQUE segue valorizando a ENTRADA pelo item", async () => {
    mocks.produto.mockResolvedValue([{ id: 42, ativo: true, categoriaId: null, centrosCusto: [{ centroCustoId: 3 }] }]);
    mocks.centro.mockResolvedValue([{ id: 3, nome: "Pecuária" }]);
    await criarOperacao({
      tipo: "COMPRA_ESTOQUE", data: new Date("2026-09-10T00:00:00Z"), descricao: "Compra", propriedadeId: 1,
      financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" },
      itens: [{ descricao: "Ração", quantidade: 10, unidade: "sc", valorTotal: 70, estocavel: true, produtoId: 42 }],
    });
    const dados = mocks.movimentoEstoqueCreate.mock.calls[0][0].data;
    expect(Number(dados.custoUnitario)).toBe(7);
    expect(Number(dados.valorTotal)).toBe(70);
    expect(mocks.movimentoEstoqueFindMany).not.toHaveBeenCalled();
    expect(mocks.movimentoEstoqueGroupBy).not.toHaveBeenCalled();
  });
});
