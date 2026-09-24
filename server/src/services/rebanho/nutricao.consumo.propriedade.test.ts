import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  grupoFindFirst: vi.fn(),
  animalCount: vi.fn(),
  movimentoFindMany: vi.fn(),
  movimentoGroupBy: vi.fn(),
  consumoFindFirst: vi.fn(),
  consumoFindMany: vi.fn(),
  fechamentoFindMany: vi.fn(),
  consumoDelete: vi.fn(),
  assertMesAberto: vi.fn(),
  periodoFindUnique: vi.fn(),
  consumoCreate: vi.fn(),
  consumoUpdate: vi.fn(),
  movimentoCreate: vi.fn(),
  auditoriaCreate: vi.fn(),
  txMovFindMany: vi.fn(),
  txMovFindFirst: vi.fn(),
  txMovUpdate: vi.fn(),
  txMovUpdateMany: vi.fn(),
  txConsumoDelete: vi.fn(),
  queryRaw: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    grupo: { findFirst: mocks.grupoFindFirst },
    animal: { count: mocks.animalCount },
    movimentoEstoque: { findMany: mocks.movimentoFindMany, groupBy: mocks.movimentoGroupBy },
    consumoPeriodo: {
      findFirst: mocks.consumoFindFirst,
      findMany: mocks.consumoFindMany,
      delete: mocks.consumoDelete,
    },
    fechamentoMensal: { findMany: mocks.fechamentoFindMany },
    periodoFinanceiro: { findUnique: mocks.periodoFindUnique },
    $transaction: mocks.transaction,
  },
}));

vi.mock("../fechamento.js", () => ({
  assertMesAberto: mocks.assertMesAberto,
  FechamentoMensalError: class FechamentoMensalError extends Error {},
}));
vi.mock("../propriedade.js", () => ({ propriedadePrincipalId: vi.fn().mockResolvedValue(1) }));

import { fecharConsumoPeriodo, listarConsumosPeriodo, previsaoConsumo, reabrirConsumoPeriodo } from "./nutricao.consumo.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.animalCount.mockResolvedValue(3);
  mocks.movimentoFindMany.mockResolvedValue([]);
  mocks.movimentoGroupBy.mockResolvedValue([]);
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
      where: { produtoId: { in: [4] }, status: { in: ["CONFIRMADO", "REVERTIDO"] }, propriedadeId: 7 },
    }));
  });

  it("saldo da prévia segue o sítio do lote; na principal inclui movimento sem propriedade", async () => {
    mocks.grupoFindFirst.mockResolvedValue({
      id: 10, nome: "Alta", propriedadeId: 1,
      dieta: { id: 2, nome: "Lactação", itens: [{ produtoId: 4, unidade: "kg", qtdPorCabecaDia: 2, produto: { id: 4, nome: "Ração", centrosCusto: [] } }] },
    });
    // Consolidado (sem sítio no request): o saldo não soma outros sítios, é o do lote.
    await previsaoConsumo(10, "2026-07-01", "2026-07-02", null);
    expect(mocks.movimentoFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { produtoId: { in: [4] }, status: { in: ["CONFIRMADO", "REVERTIDO"] }, OR: [{ propriedadeId: 1 }, { propriedadeId: null }] },
    }));
  });

  it("valoriza a prévia pelo custo médio das entradas do sítio do lote", async () => {
    mocks.grupoFindFirst.mockResolvedValue({
      id: 10, nome: "Alta", propriedadeId: 7,
      dieta: { id: 2, nome: "Lactação", itens: [{ produtoId: 4, unidade: "kg", qtdPorCabecaDia: 2, produto: { id: 4, nome: "Ração", centrosCusto: [] } }] },
    });
    const { Prisma } = await import("@prisma/client");
    // Compras 10×2 + 10×4 agregadas no banco → base 20 kg / R$ 60.
    mocks.movimentoGroupBy.mockResolvedValue([{ produtoId: 4, _sum: { quantidade: new Prisma.Decimal(20), valorTotal: new Prisma.Decimal(60) } }]);

    const prev = await previsaoConsumo(10, "2026-07-01", "2026-07-02", null);

    // 3 cabeças × 2 kg × 2 dias = 12 kg a R$ 3,00 (médio de 2 e 4)
    expect(prev.linhas[0]).toEqual(expect.objectContaining({ quantidade: 12, custoUnitario: 3, custoTotal: 36 }));
    expect(mocks.movimentoGroupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ produtoId: { in: [4] }, status: "CONFIRMADO", AND: expect.arrayContaining([{ propriedadeId: 7 }]) }),
    }));
  });

  describe("produto sem estoque no sítio do lote não é baixado", () => {
    const grupo = {
      id: 10, nome: "Alta", propriedadeId: 7, centroCustoId: null,
      dieta: { id: 2, nome: "Lactação", itens: [
        { produtoId: 4, unidade: "KG", qtdPorCabecaDia: 2, produto: { id: 4, nome: "Ração", centrosCusto: [] } },
        { produtoId: 5, unidade: "KG", qtdPorCabecaDia: 1, produto: { id: 5, nome: "Sal", centrosCusto: [] } },
      ] },
    };
    beforeEach(async () => {
      const { Prisma } = await import("@prisma/client");
      mocks.grupoFindFirst.mockResolvedValue(grupo);
      // Duas consultas distintas no groupBy: base do custo médio (com _sum) e
      // "tem estoque no sítio" (sem _sum). A base existe para os dois produtos
      // (ex.: o sal só teve AJUSTE negativo valorizado ou entrada em outro
      // contexto) — quem decide a baixa é a consulta de estoque: só a ração (4)
      // tem ENTRADA/AJUSTE positivo no sítio 7.
      mocks.movimentoGroupBy.mockImplementation(async ({ where, _sum }: { where: { produtoId: { in: number[] } }; _sum?: unknown }) =>
        _sum
          ? where.produtoId.in.map((produtoId) => ({ produtoId, _sum: { quantidade: new Prisma.Decimal(20), valorTotal: new Prisma.Decimal(60) } }))
          : where.produtoId.in.filter((id) => id === 4).map((produtoId) => ({ produtoId })));
      mocks.periodoFindUnique.mockResolvedValue(null);
      mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
        consumoPeriodo: { create: mocks.consumoCreate, update: mocks.consumoUpdate },
        movimentoEstoque: { create: mocks.movimentoCreate },
        auditoriaFinanceira: { create: mocks.auditoriaCreate },
      }));
      mocks.consumoCreate.mockResolvedValue({ id: 70 });
      mocks.consumoUpdate.mockImplementation(async ({ data }: { data: { custoTotal: unknown } }) => ({ id: 70, custoTotal: data.custoTotal }));
    });

    it("consulta 'tem estoque' com ENTRADA ou AJUSTE positivo, no sítio do lote", async () => {
      await previsaoConsumo(10, "2026-07-01", "2026-07-02", 7);
      const consulta = mocks.movimentoGroupBy.mock.calls.map(([args]) => args).find((args) => !args._sum);
      expect(consulta).toEqual({
        by: ["produtoId"],
        where: {
          produtoId: { in: [4, 5] }, status: "CONFIRMADO", reversaoDeId: null,
          AND: [{ OR: [{ tipo: "ENTRADA" }, { tipo: "AJUSTE", quantidade: { gt: 0 } }] }, { propriedadeId: 7 }],
        },
      });
    });

    it("a prévia marca a linha sem estoque, sem custo e sem mexer no saldo", async () => {
      const prev = await previsaoConsumo(10, "2026-07-01", "2026-07-02", 7);
      expect(prev.linhas[0]).toMatchObject({ produtoId: 4, semEstoque: false, quantidade: 12, custoTotal: 36 });
      expect(prev.linhas[1]).toMatchObject({ produtoId: 5, semEstoque: true, custoTotal: 0, saldoApos: 0, insuficiente: false });
      expect(prev.temInsuficiencia).toBe(true); // a ração (saldo 0 no mock) fica negativa
    });

    it("o fechamento só grava SAIDA do produto com estoque", async () => {
      const r = await fecharConsumoPeriodo(10, { dataInicio: "2026-07-01", dataFim: "2026-07-02" }, 7);
      expect(mocks.movimentoCreate).toHaveBeenCalledTimes(1);
      expect(mocks.movimentoCreate.mock.calls[0][0].data).toMatchObject({ produtoId: 4, tipo: "SAIDA", origem: "NUTRICAO", propriedadeId: 7 });
      expect(r.movimentos).toBe(1);
    });

    it("o fechamento grava o autor na SAIDA e audita", async () => {
      await fecharConsumoPeriodo(10, { dataInicio: "2026-07-01", dataFim: "2026-07-02" }, 7, 9);
      expect(mocks.movimentoCreate.mock.calls[0][0].data.criadoPorId).toBe(9);
      expect(mocks.auditoriaCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ entidade: "ConsumoPeriodo", entidadeId: "70", acao: "FECHADO", usuarioId: 9 }) });
    });
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

describe("reabrir o fechamento de consumo", () => {
  const cp = { id: 44, grupoId: 10, grupo: { id: 10, nome: "Alta", propriedadeId: 7 }, dataInicio: new Date("2026-07-01"), dataFim: new Date("2026-07-02"), numCabecas: 3, custoTotal: 36 };
  beforeEach(() => {
    mocks.consumoFindFirst.mockResolvedValue(cp);
    mocks.periodoFindUnique.mockResolvedValue(null);
    mocks.txMovFindMany.mockResolvedValue([{ id: 501 }, { id: 502 }]);
    mocks.txMovFindFirst.mockImplementation(async ({ where }: { where: { id: number } }) => ({
      id: where.id, produtoId: 4, tipo: "SAIDA", origem: "NUTRICAO", status: "CONFIRMADO", quantidade: new Prisma.Decimal(6), custoUnitario: new Prisma.Decimal(3), valorTotal: new Prisma.Decimal(18),
      propriedadeId: 7, operacaoId: null, reversaoDeId: null, revertidoPor: null, centroCustoId: null, grupoId: 10, animalId: null, talhaoId: null,
    }));
    mocks.movimentoCreate.mockImplementation(async ({ data }: { data: { reversaoDeId: number } }) => ({ id: data.reversaoDeId + 1000 }));
    mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
      movimentoEstoque: { findMany: mocks.txMovFindMany, findFirst: mocks.txMovFindFirst, create: mocks.movimentoCreate, update: mocks.txMovUpdate, updateMany: mocks.txMovUpdateMany },
      consumoPeriodo: { delete: mocks.txConsumoDelete },
      periodoFinanceiro: { findUnique: mocks.periodoFindUnique },
      auditoriaFinanceira: { create: mocks.auditoriaCreate },
      $queryRaw: mocks.queryRaw,
    }));
  });

  it("estorna cada SAIDA (nunca apaga), desvincula do cabeçalho e audita", async () => {
    await reabrirConsumoPeriodo(44, 7, 9);
    // Um inverso (ENTRADA) por SAIDA confirmada, mantendo o lote.
    expect(mocks.movimentoCreate).toHaveBeenCalledTimes(2);
    expect(mocks.movimentoCreate.mock.calls[0][0].data).toMatchObject({ tipo: "ENTRADA", reversaoDeId: 501, grupoId: 10, criadoPorId: 9 });
    expect(mocks.txMovUpdate).toHaveBeenCalledWith({ where: { id: 501 }, data: { status: "REVERTIDO" } });
    // As SAIDAs saem do cabeçalho antes de ele ser removido (nada cai em cascata).
    expect(mocks.txMovUpdateMany).toHaveBeenCalledWith({ where: { consumoPeriodoId: 44 }, data: { consumoPeriodoId: null } });
    expect(mocks.txMovUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(mocks.txConsumoDelete.mock.invocationCallOrder[0]);
    expect(mocks.consumoDelete).not.toHaveBeenCalled();
    expect(mocks.auditoriaCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ entidade: "ConsumoPeriodo", entidadeId: "44", acao: "REABERTO", usuarioId: 9 }) });
  });

  it("mês fechado bloqueia a reabertura", async () => {
    mocks.periodoFindUnique.mockResolvedValue({ status: "FECHADO" });
    await expect(reabrirConsumoPeriodo(44, 7, 9)).rejects.toMatchObject({ code: "MES_FECHADO" });
    expect(mocks.movimentoCreate).not.toHaveBeenCalled();
  });
});
