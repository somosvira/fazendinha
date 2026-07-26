import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  animalFindUnique: vi.fn(),
  animalUpdate: vi.fn(),
  lactacaoFindMany: vi.fn(),
  lactacaoCreate: vi.fn(),
  lactacaoUpdate: vi.fn(),
  lactacaoDelete: vi.fn(),
  controleFindMany: vi.fn(),
  resumoUpsert: vi.fn(),
  getNumero: vi.fn(),
}));

vi.mock("../../db.js", () => ({ prisma: {} }));
vi.mock("./parametros.js", () => ({ getNumero: mocks.getNumero }));

import { recomputarAnimal } from "./eventos.js";

const tx = {
  animal: { findUnique: mocks.animalFindUnique, update: mocks.animalUpdate },
  lactacao: {
    findMany: mocks.lactacaoFindMany,
    create: mocks.lactacaoCreate,
    update: mocks.lactacaoUpdate,
    delete: mocks.lactacaoDelete,
  },
  controleLeiteiro: { findMany: mocks.controleFindMany },
  resumoAnimal: { upsert: mocks.resumoUpsert },
};

const parto = {
  id: 20,
  tipo: "PARTO" as const,
  data: "2026-07-20",
  tipoParto: "normal",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getNumero.mockResolvedValue(null);
  mocks.controleFindMany.mockResolvedValue([]);
  mocks.animalFindUnique.mockResolvedValue({
    id: 4,
    categoria: "NOVILHA",
    numPartosEntrada: 0,
    eventosReprodutivos: [{
      id: 20,
      tipo: "PARTO",
      data: new Date("2026-07-20T00:00:00Z"),
      resultado: null,
      dtPartoPrevista: null,
      reprodutor: null,
      protocolo: null,
      tipoParto: "normal",
      motivoSecagem: null,
    }],
  });
  mocks.lactacaoCreate.mockResolvedValue({ id: 12 });
  mocks.lactacaoUpdate.mockResolvedValue({ id: 11 });
  mocks.lactacaoDelete.mockResolvedValue({ id: 12 });
  mocks.animalUpdate.mockResolvedValue({ id: 4 });
  mocks.resumoUpsert.mockResolvedValue({ animalId: 4 });
});

describe("recomputarAnimal — persistência de lactações", () => {
  it("encerra o ciclo aberto, cria o novo e promove a novilha", async () => {
    mocks.lactacaoFindMany
      .mockResolvedValueOnce([{
        id: 11,
        numero: 1,
        dtInicio: new Date("2025-01-10T00:00:00Z"),
        dtFim: null,
        motivoSecagem: null,
      }])
      .mockResolvedValueOnce([{
        numero: 1,
        dtInicio: new Date("2025-01-10T00:00:00Z"),
        dtFim: new Date("2026-07-20T00:00:00Z"),
      }, {
        numero: 2,
        dtInicio: new Date("2026-07-20T00:00:00Z"),
        dtFim: null,
      }]);

    await recomputarAnimal(tx as never, 4, { tipo: "CRIACAO", evento: parto });

    expect(mocks.lactacaoUpdate).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { dtFim: new Date("2026-07-20"), motivoSecagem: "Novo parto" },
    });
    expect(mocks.lactacaoCreate).toHaveBeenCalledWith({
      data: { animalId: 4, numero: 2, dtInicio: new Date("2026-07-20") },
    });
    expect(mocks.animalUpdate).toHaveBeenCalledWith({ where: { id: 4 }, data: { categoria: "VACA" } });
    expect(mocks.resumoUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ del: expect.any(Number), ordemLactacao: 2 }),
    }));
  });

  it("usa lactação importada no resumo mesmo sem evento de parto", async () => {
    mocks.animalFindUnique.mockResolvedValue({
      id: 4,
      categoria: "VACA",
      numPartosEntrada: 2,
      eventosReprodutivos: [{
        id: 30,
        tipo: "CIO",
        data: new Date("2026-06-01T00:00:00Z"),
        resultado: null,
        dtPartoPrevista: null,
        reprodutor: null,
        protocolo: null,
        tipoParto: null,
        motivoSecagem: null,
      }],
    });
    mocks.lactacaoFindMany
      .mockResolvedValueOnce([{
        id: 15,
        numero: 3,
        dtInicio: new Date("2026-01-10T00:00:00Z"),
        dtFim: null,
        motivoSecagem: null,
      }])
      .mockResolvedValueOnce([{
        numero: 3,
        dtInicio: new Date("2026-01-10T00:00:00Z"),
        dtFim: null,
      }]);

    await recomputarAnimal(tx as never, 4, {
      tipo: "CRIACAO",
      evento: { id: 30, tipo: "CIO", data: "2026-06-01" },
    });

    expect(mocks.resumoUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ del: expect.any(Number), ordemLactacao: 3 }),
    }));
    expect(mocks.lactacaoCreate).not.toHaveBeenCalled();
    expect(mocks.lactacaoDelete).not.toHaveBeenCalled();
  });
});
