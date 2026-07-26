import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  animalFindFirst: vi.fn(),
  resultadoFindUnique: vi.fn(),
  eventoCreate: vi.fn(),
  transaction: vi.fn(),
  txAnimalFindUnique: vi.fn(),
  lactacaoFindMany: vi.fn(),
  resumoUpsert: vi.fn(),
  getNumero: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    animal: { findFirst: mocks.animalFindFirst },
    resultadoExameGinecologico: { findUnique: mocks.resultadoFindUnique },
    $transaction: mocks.transaction,
  },
}));

vi.mock("./parametros.js", () => ({
  getNumero: mocks.getNumero,
}));

import { registrarEvento } from "./eventos.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.animalFindFirst.mockResolvedValue({ id: 31 });
  mocks.resultadoFindUnique.mockResolvedValue({ id: 12 });
  mocks.getNumero.mockResolvedValue(null);
  mocks.eventoCreate.mockResolvedValue({
    id: 50,
    animalId: 31,
    tipo: "EXAME_GINECOLOGICO",
    data: new Date("2026-06-01T00:00:00Z"),
    resultado: "CORPO_LUTEO",
    protocolo: "US",
    observacao: null,
    resultadoGinecologicoId: 12,
  });
  mocks.txAnimalFindUnique.mockResolvedValue({
    id: 31,
    numPartosEntrada: 0,
    eventosReprodutivos: [],
  });
  mocks.lactacaoFindMany.mockResolvedValue([]);
  mocks.resumoUpsert.mockResolvedValue({});
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
    eventoReprodutivo: { create: mocks.eventoCreate },
    animal: { findUnique: mocks.txAnimalFindUnique, update: vi.fn() },
    lactacao: {
      findMany: mocks.lactacaoFindMany,
      create: vi.fn(),
      update: vi.fn(),
    },
    resumoAnimal: { upsert: mocks.resumoUpsert },
  }));
});

describe("resultado oficial no exame ginecológico", () => {
  it("valida a existência e grava resultadoGinecologicoId no evento", async () => {
    await registrarEvento(31, {
      tipo: "EXAME_GINECOLOGICO",
      data: "2026-06-01",
      resultado: "CORPO_LUTEO",
      metodo: "US",
      resultadoGinecologicoId: 12,
    }, 7);

    expect(mocks.resultadoFindUnique).toHaveBeenCalledWith({
      where: { id: 12 },
      select: { id: true },
    });
    expect(mocks.eventoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        animalId: 31,
        resultado: "CORPO_LUTEO",
        resultadoGinecologicoId: 12,
      }),
    });
  });

  it("recusa resultado oficial inexistente antes de abrir a transação", async () => {
    mocks.resultadoFindUnique.mockResolvedValue(null);

    await expect(registrarEvento(31, {
      tipo: "EXAME_GINECOLOGICO",
      data: "2026-06-01",
      resultado: "CORPO_LUTEO",
      resultadoGinecologicoId: 999,
    }, 7)).rejects.toEqual(expect.objectContaining({ code: "NAO_ENCONTRADO" }));

    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
