import { beforeEach, describe, expect, it, vi } from "vitest";
import { uid } from "../../lib/uid.fixture.js";

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
      itens: [itemNaoEstocavel({ centroCustoId: uid(5) })],
    })).rejects.toMatchObject({ code: "VALIDACAO", campo: "itens.0.centroCustoId" });
    expect(mocks.operacaoCreate).not.toHaveBeenCalled();
  });

  it("(c) produto com exatamente 1 centro cadastrado: item sem centroCustoId explícito herda o id do produto e o nome vivo do centro", async () => {
    mocks.produto.mockResolvedValue([{ id: uid(42), unidade: "SC", ativo: true, categoriaId: null, centrosCusto: [{ centroCustoId: uid(3) }] }]);
    mocks.centro.mockResolvedValue([{ id: uid(3), nome: "Pecuária" }]);
    await criarOperacao({
      ...baseServico,
      itens: [itemNaoEstocavel({ produtoId: uid(42), centroCustoId: undefined })],
    });
    expect(mocks.operacaoCreate).toHaveBeenCalledTimes(1);
    const dataArg = mocks.operacaoCreate.mock.calls[0][0].data;
    expect(dataArg.itens.create[0]).toMatchObject({ centroCustoId: uid(3), centroCustoNome: "Pecuária" });
  });

  it("(d) produto com 2 centros cadastrados: item sem centroCustoId explícito não herda nenhum (fica null)", async () => {
    mocks.produto.mockResolvedValue([{ id: uid(42), unidade: "SC", ativo: true, categoriaId: null, centrosCusto: [{ centroCustoId: uid(3) }, { centroCustoId: uid(4) }] }]);
    mocks.centro.mockResolvedValue([{ id: uid(3), nome: "Pecuária" }, { id: uid(4), nome: "Agronomia" }]);
    // Precisa de um centro padrão na operação, já que o item não tem centro
    // próprio (não estocável exige um centro efetivo de algum lugar).
    await criarOperacao({
      ...baseServico,
      centroCustoId: uid(3),
      itens: [itemNaoEstocavel({ produtoId: uid(42), centroCustoId: undefined })],
    });
    const dataArg = mocks.operacaoCreate.mock.calls[0][0].data;
    expect(dataArg.itens.create[0]).toMatchObject({ centroCustoId: null, centroCustoNome: null });
  });

  it("(e) centroCustoId: null explícito no item ignora o centro único do produto e herda o da operação", async () => {
    mocks.produto.mockResolvedValue([{ id: uid(42), unidade: "SC", ativo: true, categoriaId: null, centrosCusto: [{ centroCustoId: uid(3) }] }]);
    mocks.centro.mockResolvedValue([{ id: uid(3), nome: "Pecuária" }, { id: uid(7), nome: "Sede" }]);
    await criarOperacao({
      ...baseServico,
      centroCustoId: uid(7),
      itens: [itemNaoEstocavel({ produtoId: uid(42), centroCustoId: null })],
    });
    const dataArg = mocks.operacaoCreate.mock.calls[0][0].data;
    expect(dataArg.itens.create[0]).toMatchObject({ centroCustoId: null, centroCustoNome: null });
    // O item herda o centro 7 da operação nos relatórios (centroEfetivo), mas
    // o registro do item em si fica com null — quem resolve o efetivo é quem lê.
    expect(dataArg.centroCustoId).toBe(uid(7));
  });

  it("(f) movimentoEstoque.create recebe o centro efetivo (item, senão o da operação)", async () => {
    mocks.produto.mockResolvedValue([
      { id: uid(42), unidade: "SC", ativo: true, categoriaId: null, centrosCusto: [{ centroCustoId: uid(3) }] },
      { id: uid(43), unidade: "SC", ativo: true, categoriaId: null, centrosCusto: [] },
    ]);
    mocks.centro.mockResolvedValue([{ id: uid(3), nome: "Pecuária" }, { id: uid(7), nome: "Sede" }]);
    await criarOperacao({
      tipo: "COMPRA_ESTOQUE",
      data: new Date("2026-09-10T00:00:00Z"),
      descricao: "Compra de insumos",
      propriedadeId: 1,
      centroCustoId: uid(7),
      financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" },
      itens: [
        // Item com centro próprio (via produto de 1 centro): usa o do item.
        { descricao: "Ração", quantidade: 10, unidade: "sc", valorTotal: 500, estocavel: true, produtoId: uid(42) },
        // Item sem centro próprio (produto sem centro cadastrado): usa o da operação.
        { descricao: "Sal mineral", quantidade: 5, unidade: "sc", valorTotal: 200, estocavel: true, produtoId: uid(43) },
      ],
    });
    expect(mocks.movimentoEstoqueCreate).toHaveBeenCalledTimes(2);
    const centrosUsados = mocks.movimentoEstoqueCreate.mock.calls.map((call) => call[0].data.centroCustoId);
    expect(centrosUsados).toEqual([uid(3), uid(7)]);
  });
});

describe("custo da SAIDA de venda — criarOperacao", () => {
  it("recusa unidade divergente antes de gravar estoque e lote", async () => {
    mocks.produto.mockResolvedValue([{ id: uid(42), ativo: true, unidade: "ML", categoriaId: null, centrosCusto: [] }]);
    await expect(criarOperacao({
      tipo: "COMPRA_ESTOQUE", data: new Date("2026-09-10T00:00:00Z"), descricao: "Compra", propriedadeId: 1,
      financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" },
      itens: [{ descricao: "Medicamento", quantidade: 1, unidade: "L", valorTotal: 70, produtoId: uid(42), estocavel: true }],
    })).rejects.toMatchObject({ code: "VALIDACAO", campo: "itens.0.unidade" });
    expect(mocks.operacaoCreate).not.toHaveBeenCalled();
    expect(mocks.movimentoEstoqueCreate).not.toHaveBeenCalled();
  });
  it("VENDA baixa o estoque pelo custo médio do sítio, não pelo preço de venda", async () => {
    const { Prisma } = await import("@prisma/client");
    mocks.produto.mockResolvedValue([{ id: uid(42), unidade: "SC", ativo: true, categoriaId: null, centrosCusto: [{ centroCustoId: uid(3) }] }]);
    mocks.centro.mockResolvedValue([{ id: uid(3), nome: "Pecuária" }]);
    // Duas consultas distintas: "tem estoque no sítio" (sem _sum) e a base do
    // custo médio agregada no banco (compras 10×5 + 10×7 → 20 / R$ 120).
    mocks.movimentoEstoqueGroupBy.mockImplementation(async (args: { _sum?: unknown }) => args._sum
      ? [{ produtoId: uid(42), _sum: { quantidade: new Prisma.Decimal(20), valorTotal: new Prisma.Decimal(120) } }]
      : [{ produtoId: uid(42) }]);
    await criarOperacao({
      tipo: "VENDA", data: new Date("2026-09-10T00:00:00Z"), descricao: "Venda de ração", propriedadeId: 1,
      financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" },
      itens: [{ descricao: "Ração", quantidade: 5, unidade: "sc", valorTotal: 100, estocavel: true, produtoId: uid(42) }],
    });
    const dados = mocks.movimentoEstoqueCreate.mock.calls[0][0].data;
    expect(dados.tipo).toBe("SAIDA");
    expect(Number(dados.custoUnitario)).toBe(6);
    expect(Number(dados.valorTotal)).toBe(30);
  });

  it("COMPRA_ESTOQUE segue valorizando a ENTRADA pelo item", async () => {
    mocks.produto.mockResolvedValue([{ id: uid(42), unidade: "SC", ativo: true, categoriaId: null, centrosCusto: [{ centroCustoId: uid(3) }] }]);
    mocks.centro.mockResolvedValue([{ id: uid(3), nome: "Pecuária" }]);
    await criarOperacao({
      tipo: "COMPRA_ESTOQUE", data: new Date("2026-09-10T00:00:00Z"), descricao: "Compra", propriedadeId: 1,
      financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" },
      itens: [{ descricao: "Ração", quantidade: 10, unidade: "sc", valorTotal: 70, estocavel: true, produtoId: uid(42) }],
    });
    const dados = mocks.movimentoEstoqueCreate.mock.calls[0][0].data;
    expect(Number(dados.custoUnitario)).toBe(7);
    expect(Number(dados.valorTotal)).toBe(70);
    expect(mocks.movimentoEstoqueFindMany).not.toHaveBeenCalled();
    expect(mocks.movimentoEstoqueGroupBy).not.toHaveBeenCalled();
  });
});

describe("VENDA/DEVOLUCAO só retiram do estoque produto que teve entrada no sítio — criarOperacao", () => {
  const venda = (itens: unknown[], extra: Record<string, unknown> = {}) => criarOperacao({
    tipo: "VENDA", data: new Date("2026-09-10T00:00:00Z"), descricao: "Venda", propriedadeId: 1,
    financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" }, itens, ...extra,
  } as never);

  beforeEach(() => {
    // Produto 42 teve entrada no sítio; 43 nunca teve.
    mocks.produto.mockResolvedValue([
      { id: uid(42), unidade: "SC", ativo: true, categoriaId: null, centrosCusto: [] },
      { id: uid(43), unidade: "UN", ativo: true, categoriaId: null, centrosCusto: [] },
    ]);
    mocks.centro.mockResolvedValue([{ id: uid(3), nome: "Pecuária" }]);
    mocks.movimentoEstoqueGroupBy.mockImplementation(async (args: { _sum?: unknown; where: { produtoId: { in: string[] } } }) =>
      args._sum ? [] : args.where.produtoId.in.filter((id) => id === uid(42)).map((produtoId) => ({ produtoId })));
  });

  it("consulta o estoque de todos os produtos em lote, uma vez, no escopo do sítio", async () => {
    await venda([
      { descricao: "Ração", quantidade: 1, unidade: "sc", valorTotal: 10, produtoId: uid(42) },
      { descricao: "Bezerro", quantidade: 1, unidade: "un", valorTotal: 10, produtoId: uid(43), centroCustoId: uid(3) },
    ]);
    const temEstoque = mocks.movimentoEstoqueGroupBy.mock.calls.filter(([args]) => !args._sum);
    expect(temEstoque).toHaveLength(1);
    expect(temEstoque[0][0].where).toMatchObject({ produtoId: { in: [uid(42), uid(43)] }, status: "CONFIRMADO", reversaoDeId: null });
  });

  it("venda de produto com entrada no sítio gera SAIDA", async () => {
    await venda([{ descricao: "Ração", quantidade: 2, unidade: "sc", valorTotal: 50, produtoId: uid(42) }]);
    expect(mocks.movimentoEstoqueCreate).toHaveBeenCalledTimes(1);
    expect(mocks.movimentoEstoqueCreate.mock.calls[0][0].data).toMatchObject({ produtoId: uid(42), tipo: "SAIDA" });
    expect(mocks.operacaoCreate.mock.calls[0][0].data.itens.create[0].estocavel).toBe(true);
  });

  it("venda de produto sem entrada no sítio não movimenta estoque e exige centro de custo", async () => {
    await expect(venda([{ descricao: "Bezerro", quantidade: 1, unidade: "un", valorTotal: 900, produtoId: uid(43) }]))
      .rejects.toMatchObject({ code: "VALIDACAO", campo: "itens.0.centroCustoId" });
    expect(mocks.operacaoCreate).not.toHaveBeenCalled();

    await venda([{ descricao: "Bezerro", quantidade: 1, unidade: "un", valorTotal: 900, produtoId: uid(43) }], { centroCustoId: uid(3) });
    expect(mocks.movimentoEstoqueCreate).not.toHaveBeenCalled();
    expect(mocks.operacaoCreate.mock.calls[0][0].data.itens.create[0]).toMatchObject({ produtoId: uid(43), estocavel: false });
  });

  it("mesmo com estocavel: true do cliente, produto sem entrada no sítio não gera SAIDA", async () => {
    await venda([{ descricao: "Bezerro", quantidade: 1, unidade: "un", valorTotal: 900, produtoId: uid(43), estocavel: true, centroCustoId: uid(3) }]);
    expect(mocks.movimentoEstoqueCreate).not.toHaveBeenCalled();
  });

  it("DEVOLUCAO segue a mesma regra", async () => {
    await criarOperacao({
      tipo: "DEVOLUCAO", data: new Date("2026-09-10T00:00:00Z"), descricao: "Devolução", propriedadeId: 1, centroCustoId: uid(3),
      financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" },
      itens: [
        { descricao: "Ração", quantidade: 1, unidade: "sc", valorTotal: 10, produtoId: uid(42) },
        { descricao: "Outro", quantidade: 1, unidade: "un", valorTotal: 10, produtoId: uid(43) },
      ],
    } as never);
    expect(mocks.movimentoEstoqueCreate).toHaveBeenCalledTimes(1);
    expect(mocks.movimentoEstoqueCreate.mock.calls[0][0].data).toMatchObject({ produtoId: uid(42), tipo: "SAIDA", origem: "DEVOLUCAO" });
  });

  it("venda sem produto (leite em texto livre) continua válida com centro de custo, sem movimento", async () => {
    mocks.produto.mockResolvedValue([]);
    await venda([{ descricao: "Leite — quinzena", quantidade: 3000, unidade: "L", valorTotal: 7500, centroCustoId: uid(3) }]);
    expect(mocks.operacaoCreate).toHaveBeenCalledTimes(1);
    expect(mocks.movimentoEstoqueCreate).not.toHaveBeenCalled();
    expect(mocks.movimentoEstoqueGroupBy).not.toHaveBeenCalled(); // nada a consultar
  });

  it("tipos que põem no estoque não consultam o estoque prévio (compra de produto novo entra)", async () => {
    await criarOperacao({
      tipo: "COMPRA_ESTOQUE", data: new Date("2026-09-10T00:00:00Z"), descricao: "Compra", propriedadeId: 1,
      financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" },
      itens: [{ descricao: "Outro", quantidade: 1, unidade: "un", valorTotal: 10, produtoId: uid(43) }],
    } as never);
    expect(mocks.movimentoEstoqueGroupBy).not.toHaveBeenCalled();
    expect(mocks.movimentoEstoqueCreate.mock.calls[0][0].data).toMatchObject({ produtoId: uid(43), tipo: "ENTRADA" });
  });
});
