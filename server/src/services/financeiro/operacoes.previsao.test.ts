import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as shared from "@rionovo/shared";
import { valorSaidaPreciso } from "../estoque/estoque.calc.js";
import { uid } from "../../lib/uid.fixture.js";

const mocks = vi.hoisted(() => ({
  prever: vi.fn(),
  produto: vi.fn(),
  centro: vi.fn(),
  categoria: vi.fn(),
  groupBy: vi.fn(),
  operacaoCreate: vi.fn(),
  movimentoCreate: vi.fn(),
  compromissoCreate: vi.fn(),
  transacaoCreate: vi.fn(),
}));

vi.mock("@rionovo/shared", async (original) => {
  const modulo = await original<typeof import("@rionovo/shared")>();
  mocks.prever.mockImplementation(modulo.preverEfeitosOperacao);
  return { ...modulo, preverEfeitosOperacao: mocks.prever };
});

vi.mock("../../db.js", () => {
  const tx = {
    periodoFinanceiro: { findUnique: vi.fn().mockResolvedValue(null) },
    parceiro: { findFirst: vi.fn().mockResolvedValue({ id: uid(1), ativo: true, tipo: "AMBOS", papeis: [{ papel: "FORNECEDOR" }, { papel: "CLIENTE" }] }) },
    contaFinanceira: { findFirst: vi.fn().mockResolvedValue({ id: uid(2) }) },
    produto: { findMany: mocks.produto },
    centroCusto: { findMany: mocks.centro },
    categoria: { findMany: mocks.categoria },
    compromissoFinanceiro: { count: vi.fn().mockResolvedValue(0), create: mocks.compromissoCreate },
    movimentoEstoque: { groupBy: mocks.groupBy, create: mocks.movimentoCreate },
    transacaoFinanceira: { create: mocks.transacaoCreate },
    operacao: {
      create: mocks.operacaoCreate,
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: uid(99) }),
    },
    auditoriaFinanceira: { create: vi.fn().mockResolvedValue({}) },
  };
  return { prisma: { $transaction: async (fn: (t: unknown) => unknown) => fn(tx), propriedade: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) } } };
});

import { criarOperacao } from "./operacoes.js";

const numero = (valor: unknown) => Number(valor as Prisma.Decimal);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.produto.mockResolvedValue([{ id: uid(42), ativo: true, categoriaId: uid(20), centrosCusto: [{ centroCustoId: uid(3) }] }]);
  mocks.centro.mockResolvedValue([{ id: uid(3), nome: "Pecuária" }, { id: uid(7), nome: "Sede" }]);
  mocks.categoria.mockResolvedValue([{ id: uid(20), nome: "Insumos", classificacao: "CUSTEIO" }]);
  mocks.groupBy.mockImplementation(async (args: { _sum?: unknown }) => args._sum
    ? [{ produtoId: uid(42), _sum: { quantidade: new Prisma.Decimal(3), valorTotal: new Prisma.Decimal(100) } }]
    : [{ produtoId: uid(42) }]);
  mocks.operacaoCreate.mockImplementation(async ({ data }: { data: { itens: { create: { ordem: number }[] } } }) =>
    ({ id: uid(99), itens: data.itens.create.map((item) => ({ ...item, id: uid(100 + item.ordem) })) }));
});

describe("criarOperacao grava exatamente a previsão compartilhada", () => {
  it.each(["COMPRA_ESTOQUE", "VENDA"] as const)("%s", async (tipo) => {
    await criarOperacao({
      tipo, data: new Date("2026-09-10T00:00:00Z"), descricao: "Operação", propriedadeId: 1, parceiroId: uid(1), centroCustoId: uid(7),
      itens: [
        { produtoId: uid(42), descricao: "Ração", quantidade: 2, unidade: "sc", valorTotal: 70, estocavel: false },
        { descricao: "Frete", quantidade: 1, unidade: "un", valorUnitario: 30, estocavel: false, centroCustoId: null },
      ],
      financeiro: { condicao: "PARCIAL", contaId: uid(2), valorPago: 40, parcelas: [{ id: uid(50), valor: 60, dataVencimento: new Date("2026-10-01") }] },
      usuarioId: 5,
    });

    expect(mocks.prever).toHaveBeenCalledTimes(1);
    const efeitos = mocks.prever.mock.results[0].value as shared.EfeitosOperacao;
    const [, contexto] = mocks.prever.mock.calls[0] as [unknown, shared.ContextoOperacao];
    expect(contexto).toMatchObject({
      produtos: [{ id: uid(42), categoriaId: uid(20), centrosCustoIds: [uid(3)] }],
      produtosComEstoque: tipo === "VENDA" ? [uid(42)] : [],
      basesCusto: tipo === "VENDA" ? [{ produtoId: uid(42), quantidade: "3", valor: "100" }] : [],
    });

    const operacao = mocks.operacaoCreate.mock.calls[0][0].data;
    expect(numero(operacao.valorTotal)).toBe(efeitos.valorTotal);
    expect(operacao).toMatchObject({ categoriaId: efeitos.categoriaId, categoriaNome: efeitos.categoriaNome, classificacao: efeitos.classificacao, centroCustoId: uid(7) });
    expect(operacao.itens.create.map((item: Record<string, unknown>) => ({
      ...item, quantidade: numero(item.quantidade), valorUnitario: numero(item.valorUnitario), valorTotal: numero(item.valorTotal),
    }))).toEqual(efeitos.itens.map(({ centroCustoEfetivoId: _, ...item }) => item));

    const itensCriados = (await mocks.operacaoCreate.mock.results[0].value).itens as { id: string; ordem: number }[];
    const ordemPorId = new Map(itensCriados.map((item) => [item.id, item.ordem]));
    expect(mocks.movimentoCreate.mock.calls.map(([{ data }]) => ({
      ordemItem: ordemPorId.get(data.itemOperacaoId), produtoId: data.produtoId, tipo: data.tipo, origem: data.origem,
      quantidade: numero(data.quantidade), custoUnitario: numero(data.custoUnitario), valorTotal: numero(data.valorTotal), centroCustoId: data.centroCustoId,
    }))).toEqual(efeitos.movimentosEstoque);
    expect(efeitos.movimentosEstoque).toHaveLength(1);

    expect(mocks.compromissoCreate.mock.calls.map(([{ data }]) => ({
      id: data.id, tipo: data.tipo, valorOriginal: numero(data.valorOriginal), dataVencimento: data.dataVencimento,
      numeroParcela: data.numeroParcela, totalParcelas: data.totalParcelas,
    }))).toEqual(efeitos.compromissos);

    const transacao = mocks.transacaoCreate.mock.calls[0][0].data;
    expect({ tipo: transacao.tipo, valor: numero(transacao.valorTotal), contaId: transacao.movimentos.create.contaId, direcao: transacao.movimentos.create.direcao })
      .toEqual({ tipo: efeitos.transacao!.tipo, valor: efeitos.transacao!.valor, contaId: efeitos.transacao!.contaId, direcao: efeitos.transacao!.direcao });
  });

  it("erro da previsão vira FinanceiroError com o mesmo campo, sem gravar nada", async () => {
    await expect(criarOperacao({
      tipo: "SERVICO", data: new Date("2026-09-10T00:00:00Z"), descricao: "Serviço", propriedadeId: 1, valorTotal: 10,
      centroCustoId: uid(8), itens: [], financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" },
    })).rejects.toMatchObject({ code: "VALIDACAO", message: "Selecione um centro de custo ativo", campo: "centroCustoId" });
    expect(mocks.operacaoCreate).not.toHaveBeenCalled();
  });
});

describe("saída pelo custo médio compartilhada", () => {
  it("bate com valorSaidaPreciso do estoque", () => {
    let semente = 7;
    const aleatorio = () => (semente = (semente * 48271) % 2147483647) / 2147483647;
    for (let i = 0; i < 500; i++) {
      const quantidade = Math.round(aleatorio() * 1e6) / 1000;
      const base = { quantidade: String(Math.round(aleatorio() * 1e7) / 1000), valor: String(Math.round(aleatorio() * 1e8) / 100) };
      const esperado = valorSaidaPreciso({ quantidadeSaida: quantidade, quantidadeBase: base.quantidade, valorBase: base.valor });
      expect(shared.valorSaidaPelaBase(quantidade, base)).toEqual({ custoUnitario: esperado.custoUnitario.toNumber(), valorTotal: esperado.valorTotal.toNumber() });
    }
  });
});
