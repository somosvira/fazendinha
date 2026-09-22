import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  talhaoFindUnique: vi.fn(),
  operacaoFindUnique: vi.fn(),
  produtoFindUnique: vi.fn(),
  centroCustoFindFirst: vi.fn(),
  periodoFindUnique: vi.fn(),
  movimentoCreate: vi.fn(),
  movimentoUpdate: vi.fn(),
  movimentoDelete: vi.fn(),
  operacaoCreate: vi.fn(),
  operacaoUpdate: vi.fn(),
  operacaoDelete: vi.fn(),
  propriedadeFindFirst: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    talhao: { findUnique: mocks.talhaoFindUnique },
    operacaoAgricola: {
      findUnique: mocks.operacaoFindUnique,
      create: mocks.operacaoCreate,
      update: mocks.operacaoUpdate,
      delete: mocks.operacaoDelete,
      findMany: vi.fn().mockResolvedValue([]),
    },
    produto: { findUnique: mocks.produtoFindUnique },
    centroCusto: { findFirst: mocks.centroCustoFindFirst },
    periodoFinanceiro: { findUnique: mocks.periodoFindUnique },
    movimentoEstoque: { create: mocks.movimentoCreate, update: mocks.movimentoUpdate, delete: mocks.movimentoDelete },
    propriedade: { findFirst: mocks.propriedadeFindFirst, count: vi.fn().mockResolvedValue(1) },
    inspecaoMIP: { findMany: vi.fn().mockResolvedValue([]) },
    amostraSolo: { findMany: vi.fn().mockResolvedValue([]) },
    amostraFoliar: { findMany: vi.fn().mockResolvedValue([]) },
    passadaColheita: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: mocks.transaction,
  },
}));

import { criarOperacao, editarOperacao, PlantioEventoError } from "./timeline.js";

const talhaoBase = {
  id: 1,
  codigo: "T1",
  propriedadeId: 5,
  areaHa: new Prisma.Decimal(10),
  lavoura: { centroCustoId: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      produto: { findUnique: mocks.produtoFindUnique },
      centroCusto: { findFirst: mocks.centroCustoFindFirst },
      movimentoEstoque: { create: mocks.movimentoCreate, update: mocks.movimentoUpdate, delete: mocks.movimentoDelete },
      operacaoAgricola: { create: mocks.operacaoCreate, update: mocks.operacaoUpdate, delete: mocks.operacaoDelete },
    }),
  );
  mocks.periodoFindUnique.mockResolvedValue(null);
  mocks.propriedadeFindFirst.mockResolvedValue({ id: 5 });
  mocks.centroCustoFindFirst.mockResolvedValue({ id: 9, ativo: true });
});

describe("criarOperacao", () => {
  it("cria SAIDA de estoque com quantidade = dose × área e grava movimentoEstoqueId", async () => {
    mocks.talhaoFindUnique.mockResolvedValue(talhaoBase);
    mocks.produtoFindUnique.mockResolvedValue({
      id: 3, nome: "Ureia", estocavel: true, custoUnitario: new Prisma.Decimal(2), unidade: "kg", centrosCusto: [],
    });
    mocks.movimentoCreate.mockResolvedValue({ id: 88, quantidade: new Prisma.Decimal(20) });
    mocks.operacaoCreate.mockResolvedValue({
      id: 1, talhaoId: 1, tipo: "ADUBACAO_SOLO", data: new Date("2026-01-10"),
      produto: "Ureia", observacao: null, responsavel: null,
    });

    await criarOperacao(1, {
      dominio: "NUTRICAO", tipo: "ADUBACAO_SOLO", data: "2026-01-10",
      doseValor: 2, doseUnidade: "kg/ha", produtoId: 3,
    } as any);

    expect(mocks.movimentoCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tipo: "SAIDA", origem: "APLICACAO", propriedadeId: 5,
        quantidade: expect.objectContaining({ toString: expect.any(Function) }),
      }),
    }));
    const criado = mocks.movimentoCreate.mock.calls[0][0].data;
    expect(Number(criado.quantidade)).toBe(20); // 2 kg/ha × 10 ha
    expect(mocks.operacaoCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ movimentoEstoqueId: 88 }),
    }));
  });

  it("usa a propriedade principal quando o talhão não tem propriedadeId", async () => {
    mocks.talhaoFindUnique.mockResolvedValue({ ...talhaoBase, propriedadeId: null });
    mocks.operacaoCreate.mockResolvedValue({ id: 2, talhaoId: 1, tipo: "PODA_DECOTE", data: new Date("2026-01-10") });

    await criarOperacao(1, { dominio: "FENOLOGIA", tipo: "PODA_DECOTE", data: "2026-01-10" } as any);

    expect(mocks.propriedadeFindFirst).toHaveBeenCalled();
    expect(mocks.periodoFindUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { propriedadeId_ano_mes: expect.objectContaining({ propriedadeId: 5 }) },
    }));
  });

  it("rejeita centroCustoId inexistente", async () => {
    mocks.talhaoFindUnique.mockResolvedValue(talhaoBase);
    mocks.produtoFindUnique.mockResolvedValue({
      id: 3, nome: "Ureia", estocavel: true, custoUnitario: new Prisma.Decimal(2), unidade: "kg", centrosCusto: [],
    });
    mocks.centroCustoFindFirst.mockResolvedValue(null);

    await expect(
      criarOperacao(1, {
        dominio: "NUTRICAO", tipo: "ADUBACAO_SOLO", data: "2026-01-10",
        doseValor: 2, doseUnidade: "kg/ha", produtoId: 3, centroCustoId: 999,
      } as any),
    ).rejects.toEqual(expect.objectContaining({ code: "NAO_ENCONTRADO" }));
  });

  it("preserva quantidadeTotal informado quando não há baixa de estoque", async () => {
    mocks.talhaoFindUnique.mockResolvedValue(talhaoBase);
    mocks.operacaoCreate.mockResolvedValue({ id: 4, talhaoId: 1, tipo: "IRRIGACAO", data: new Date("2026-01-10") });

    await criarOperacao(1, {
      dominio: "FENOLOGIA", tipo: "IRRIGACAO", data: "2026-01-10", quantidadeTotal: 40,
    } as any);

    expect(mocks.operacaoCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ quantidadeTotal: 40, movimentoEstoqueId: null }),
    }));
  });
});

describe("editarOperacao", () => {
  const existenteBase = {
    id: 10,
    talhaoId: 1,
    tipo: "ADUBACAO_SOLO",
    data: new Date("2026-01-10"),
    responsavel: null,
    produto: "Ureia",
    observacao: null,
    doseValor: new Prisma.Decimal(2),
    doseUnidade: "kg/ha",
    pragaAlvo: null,
    produtoId: 3,
    quantidadeTotal: new Prisma.Decimal(20),
    movimentoEstoqueId: 88,
    talhao: talhaoBase,
  };

  it("apaga o movimento quando a edição remove o produtoId", async () => {
    mocks.operacaoFindUnique.mockResolvedValue(existenteBase);
    mocks.operacaoUpdate.mockResolvedValue({ id: 10, talhaoId: 1, tipo: "ADUBACAO_SOLO", data: new Date("2026-01-10") });

    await editarOperacao(10, { produtoId: null } as any);

    expect(mocks.movimentoDelete).toHaveBeenCalledWith({ where: { id: 88 } });
    expect(mocks.operacaoUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ movimentoEstoqueId: null }),
    }));
  });

  it("rejeita mudar a data para um mês fechado", async () => {
    mocks.operacaoFindUnique.mockResolvedValue(existenteBase);
    mocks.periodoFindUnique.mockImplementation(async ({ where }: any) => {
      return where.propriedadeId_ano_mes.mes === 2 ? { status: "FECHADO" } : null;
    });

    await expect(editarOperacao(10, { data: "2026-02-05" } as any)).rejects.toEqual(
      expect.objectContaining({ code: "MES_FECHADO" }),
    );
  });

  it("rejeita edição quando o mês ORIGINAL da operação está fechado", async () => {
    mocks.operacaoFindUnique.mockResolvedValue(existenteBase);
    mocks.periodoFindUnique.mockImplementation(async ({ where }: any) => {
      return where.propriedadeId_ano_mes.mes === 1 ? { status: "FECHADO" } : null;
    });

    await expect(editarOperacao(10, { data: "2026-02-05" } as any)).rejects.toEqual(
      expect.objectContaining({ code: "MES_FECHADO" }),
    );
  });
});
