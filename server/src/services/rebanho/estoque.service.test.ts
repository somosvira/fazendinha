import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const root = {
    produtoFindUnique: vi.fn(),
    movimentoCreate: vi.fn(),
    movimentoUpdate: vi.fn(),
    movimentoFindUnique: vi.fn(),
    movimentoDelete: vi.fn(),
    lancamentoCreate: vi.fn(),
    lancamentoDelete: vi.fn(),
    fechamentoFindFirst: vi.fn(),
  };
  const tx = {
    produtoFindUnique: vi.fn(),
    movimentoCreate: vi.fn(),
    movimentoUpdate: vi.fn(),
    movimentoFindFirst: vi.fn(),
    movimentoDelete: vi.fn(),
    lancamentoCreate: vi.fn(),
    lancamentoDelete: vi.fn(),
    fechamentoFindUnique: vi.fn(),
  };
  const transaction = vi.fn(async (fn: (client: unknown) => unknown) => fn({
    produto: { findUnique: tx.produtoFindUnique },
    movimentoEstoque: {
      create: tx.movimentoCreate,
      update: tx.movimentoUpdate,
      findFirst: tx.movimentoFindFirst,
      delete: tx.movimentoDelete,
    },
    lancamento: { create: tx.lancamentoCreate, delete: tx.lancamentoDelete },
    fechamentoMensal: { findUnique: tx.fechamentoFindUnique },
  }));
  return { root, tx, transaction };
});

vi.mock("../../db.js", () => ({
  prisma: {
    produto: { findUnique: mocks.root.produtoFindUnique },
    movimentoEstoque: {
      create: mocks.root.movimentoCreate,
      update: mocks.root.movimentoUpdate,
      findUnique: mocks.root.movimentoFindUnique,
      delete: mocks.root.movimentoDelete,
    },
    lancamento: { create: mocks.root.lancamentoCreate, delete: mocks.root.lancamentoDelete },
    fechamentoMensal: { findFirst: mocks.root.fechamentoFindFirst },
    $transaction: mocks.transaction,
  },
}));

vi.mock("../propriedade.js", () => ({ propriedadePrincipalId: vi.fn().mockResolvedValue(1) }));

import { excluirMovimento, registrarMovimento } from "./estoque.js";

const produto = {
  id: 3,
  nome: "Ração lactação",
  unidade: "kg",
  custoUnitario: 2.5,
  categoriaId: 7,
  centroCustoId: 2,
};

const entrada = {
  produtoId: 3,
  tipo: "ENTRADA" as const,
  data: "2026-07-20",
  quantidade: 10,
  gerarLancamento: true,
  propriedadeId: 5,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.root.produtoFindUnique.mockResolvedValue(produto);
  mocks.root.movimentoCreate.mockResolvedValue({ id: 11 });
  mocks.root.lancamentoCreate.mockResolvedValue({ id: 22 });
  mocks.root.movimentoUpdate.mockResolvedValue({ id: 11 });
  mocks.root.fechamentoFindFirst.mockResolvedValue(null);

  mocks.tx.produtoFindUnique.mockResolvedValue(produto);
  mocks.tx.movimentoCreate.mockResolvedValue({ id: 11 });
  mocks.tx.lancamentoCreate.mockResolvedValue({ id: 22 });
  mocks.tx.movimentoUpdate.mockResolvedValue({ id: 11 });
  mocks.tx.fechamentoFindUnique.mockResolvedValue(null);
});

describe("registrarMovimento — atomicidade da ponte financeira", () => {
  it("grava movimento, lançamento e vínculo na mesma transação", async () => {
    await expect(registrarMovimento(entrada)).resolves.toEqual({
      id: 11,
      lancamentoCriado: true,
      lancamentoId: 22,
    });

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.tx.produtoFindUnique).toHaveBeenCalledWith({ where: { id: 3 } });
    expect(mocks.tx.movimentoCreate).toHaveBeenCalledTimes(1);
    expect(mocks.tx.lancamentoCreate).toHaveBeenCalledTimes(1);
    expect(mocks.tx.movimentoUpdate).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { lancamentoId: 22 },
    });
    expect(mocks.root.movimentoCreate).not.toHaveBeenCalled();
    expect(mocks.root.lancamentoCreate).not.toHaveBeenCalled();
    expect(mocks.root.movimentoUpdate).not.toHaveBeenCalled();
  });

  it("propaga falha no vínculo para a transação fazer rollback", async () => {
    mocks.tx.movimentoUpdate.mockRejectedValue(new Error("falha no vínculo"));

    await expect(registrarMovimento(entrada)).rejects.toThrow("falha no vínculo");
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.tx.movimentoCreate).toHaveBeenCalledTimes(1);
    expect(mocks.tx.lancamentoCreate).toHaveBeenCalledTimes(1);
  });

  it("consulta o fechamento dentro da transação e não cria lançamento em mês fechado", async () => {
    mocks.tx.fechamentoFindUnique.mockResolvedValue({ ano: 2026, mes: 7 });

    await expect(registrarMovimento(entrada)).resolves.toEqual({
      id: 11,
      lancamentoCriado: false,
      motivo: "mês fechado",
    });

    expect(mocks.tx.fechamentoFindUnique).toHaveBeenCalledWith({
      where: { ano_mes: { ano: 2026, mes: 7 } },
    });
    expect(mocks.tx.movimentoCreate).toHaveBeenCalledTimes(1);
    expect(mocks.tx.lancamentoCreate).not.toHaveBeenCalled();
    expect(mocks.root.fechamentoFindFirst).not.toHaveBeenCalled();
  });
});

describe("excluirMovimento — origem, escopo e atomicidade", () => {
  const movimento = {
    id: 11,
    origem: "MANUAL",
    consumoPeriodoId: null,
    lancamentoId: 22,
    lancamento: {
      id: 22,
      dataLiquidacao: new Date("2026-07-20T00:00:00Z"),
      dataCompetencia: new Date("2026-07-20T00:00:00Z"),
    },
  };

  beforeEach(() => {
    mocks.tx.movimentoFindFirst.mockResolvedValue(movimento);
    mocks.tx.movimentoDelete.mockResolvedValue(movimento);
    mocks.tx.lancamentoDelete.mockResolvedValue(movimento.lancamento);
  });

  it("exclui movimento e lançamento na mesma transação e dentro do sítio", async () => {
    await excluirMovimento(11, 5);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.tx.movimentoFindFirst).toHaveBeenCalledWith({
      where: { id: 11, propriedadeId: 5 },
      include: { lancamento: true },
    });
    expect(mocks.tx.movimentoDelete).toHaveBeenCalledWith({ where: { id: 11 } });
    expect(mocks.tx.lancamentoDelete).toHaveBeenCalledWith({ where: { id: 22 } });
    expect(mocks.root.movimentoDelete).not.toHaveBeenCalled();
    expect(mocks.root.lancamentoDelete).not.toHaveBeenCalled();
  });

  it.each(["SANIDADE", "NUTRICAO"])("bloqueia exclusão manual de origem %s", async (origem) => {
    mocks.tx.movimentoFindFirst.mockResolvedValue({ ...movimento, origem, lancamentoId: null, lancamento: null });

    await expect(excluirMovimento(11, 5)).rejects.toEqual(
      expect.objectContaining({ code: "ORIGEM_AUTOMATICA" }),
    );
    expect(mocks.tx.movimentoDelete).not.toHaveBeenCalled();
  });

  it("não encontra movimento pertencente a outro sítio", async () => {
    mocks.tx.movimentoFindFirst.mockResolvedValue(null);

    await expect(excluirMovimento(11, 5)).rejects.toEqual(
      expect.objectContaining({ code: "NAO_ENCONTRADO" }),
    );
    expect(mocks.tx.movimentoDelete).not.toHaveBeenCalled();
  });

  it("não exclui nada quando o lançamento está em mês fechado", async () => {
    mocks.tx.fechamentoFindUnique.mockResolvedValue({ ano: 2026, mes: 7 });

    await expect(excluirMovimento(11, 5)).rejects.toEqual(
      expect.objectContaining({ code: "MES_FECHADO" }),
    );
    expect(mocks.tx.movimentoDelete).not.toHaveBeenCalled();
    expect(mocks.tx.lancamentoDelete).not.toHaveBeenCalled();
  });
});
