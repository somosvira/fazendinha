import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  grupoFindMany: vi.fn(),
  grupoFindFirst: vi.fn(),
  grupoFindUnique: vi.fn(),
  grupoCreate: vi.fn(),
  grupoUpdate: vi.fn(),
  animalFindMany: vi.fn(),
  animalUpdate: vi.fn(),
  dietaFindUnique: vi.fn(),
  registrarMovimentacoes: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    grupo: {
      findMany: mocks.grupoFindMany,
      findFirst: mocks.grupoFindFirst,
      findUnique: mocks.grupoFindUnique,
    },
    animal: { findMany: mocks.animalFindMany },
    dieta: { findUnique: mocks.dietaFindUnique },
    $transaction: mocks.transaction,
  },
}));

vi.mock("./movimentacao.js", () => ({ registrarMovimentacoes: mocks.registrarMovimentacoes }));

import { criarLote, editarLote, listarAnimaisDisponiveis, listarLotes, obterLote } from "./nutricao.js";

const loteDetalhe = {
  id: 30,
  nome: "Alta produção",
  dietaId: null,
  dieta: null,
  animais: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
    grupo: {
      create: mocks.grupoCreate,
      update: mocks.grupoUpdate,
      findFirst: mocks.grupoFindFirst,
      findUnique: mocks.grupoFindUnique,
    },
    animal: { findMany: mocks.animalFindMany, update: mocks.animalUpdate },
    dieta: { findUnique: mocks.dietaFindUnique },
  }));
  mocks.grupoFindMany.mockResolvedValue([]);
  mocks.grupoFindFirst.mockResolvedValue(null);
  mocks.grupoFindUnique.mockResolvedValue(null);
  mocks.dietaFindUnique.mockResolvedValue(null);
  mocks.grupoCreate.mockResolvedValue({ id: 30 });
  mocks.grupoUpdate.mockResolvedValue({ id: 30 });
  mocks.registrarMovimentacoes.mockResolvedValue(1);
});

describe("nutrição por propriedade", () => {
  it("filtra lotes e animais disponíveis pelo sítio", async () => {
    mocks.animalFindMany.mockResolvedValue([]);

    await listarLotes(7);
    await listarAnimaisDisponiveis(7);

    expect(mocks.grupoFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { propriedadeId: 7 } }));
    expect(mocks.animalFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "ATIVO", propriedadeId: 7 },
    }));
  });

  it("não expõe lote de outro sítio", async () => {
    mocks.grupoFindFirst.mockResolvedValue(null);

    await expect(obterLote(30, 7)).rejects.toEqual(expect.objectContaining({ code: "NAO_ENCONTRADO" }));
    expect(mocks.grupoFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 30, propriedadeId: 7 },
    }));
  });

  it("cria lote carimbado no sítio e registra a movimentação", async () => {
    mocks.animalFindMany.mockResolvedValue([{ id: 1, propriedadeId: 7, grupoId: null, setor: "Leite", grupo: null }]);
    mocks.grupoFindUnique.mockResolvedValue(loteDetalhe);

    await criarLote({ nome: "Alta produção", animalIds: [1] }, 7);

    expect(mocks.grupoCreate).toHaveBeenCalledWith({
      data: { nome: "Alta produção", dietaId: null, centroCustoId: null, propriedadeId: 7 },
    });
    expect(mocks.animalUpdate).toHaveBeenCalledWith({ where: { id: 1 }, data: { grupoId: 30 } });
    expect(mocks.registrarMovimentacoes).toHaveBeenCalledWith(
      expect.anything(),
      1,
      expect.objectContaining({ grupoId: null }),
      expect.objectContaining({ grupoId: 30, grupoNome: "Alta produção" }),
      { propriedadeId: 7, motivo: "edição do lote" },
    );
  });

  it("recusa criar lote com animal que não pertença ao sítio", async () => {
    mocks.animalFindMany.mockResolvedValue([{ id: 1, propriedadeId: 7, grupoId: null, setor: null, grupo: null }]);

    await expect(criarLote({ nome: "Alta produção", animalIds: [1, 2] }, 7)).rejects.toEqual(
      expect.objectContaining({ code: "ANIMAL_FORA_ESCOPO" }),
    );
    expect(mocks.grupoCreate).not.toHaveBeenCalled();
  });

  it("edita lote e registra movimentação de cada animal alterado", async () => {
    mocks.grupoFindFirst
      .mockResolvedValueOnce({ id: 30, nome: "Alta", propriedadeId: 7 })
      .mockResolvedValueOnce(null);
    mocks.animalFindMany
      .mockResolvedValueOnce([
        { id: 2, propriedadeId: 7, grupoId: null, setor: "Leite", grupo: null },
      ])
      .mockResolvedValueOnce([{ id: 1, propriedadeId: 7, grupoId: 30, setor: "Leite", grupo: { nome: "Alta" } }]);
    mocks.grupoFindUnique.mockResolvedValue(loteDetalhe);

    await editarLote(30, { nome: "Alta produção", animalIds: [2] }, 7);

    expect(mocks.animalUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.registrarMovimentacoes).toHaveBeenCalledTimes(2);
    expect(mocks.registrarMovimentacoes).toHaveBeenCalledWith(
      expect.anything(),
      2,
      expect.objectContaining({ grupoId: null }),
      expect.objectContaining({ grupoId: 30, grupoNome: "Alta produção" }),
      { propriedadeId: 7, motivo: "edição do lote" },
    );
  });
});
