import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  animalFindFirst: vi.fn(),
  animalFindMany: vi.fn(),
  aptidaoFindMany: vi.fn(),
  aptidaoUpsert: vi.fn(),
  aptidaoCreateMany: vi.fn(),
  getNumero: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    animal: {
      findFirst: mocks.animalFindFirst,
      findMany: mocks.animalFindMany,
    },
    aptidaoAnimal: {
      findMany: mocks.aptidaoFindMany,
      upsert: mocks.aptidaoUpsert,
      createMany: mocks.aptidaoCreateMany,
    },
  },
}));

vi.mock("./parametros.js", () => ({
  getNumero: mocks.getNumero,
}));

import {
  aplicarAptidaoAutomatica,
  listarAptidoes,
  registrarAptidao,
  sugerirAptidaoAutomatica,
} from "./aptidao.js";

const HOJE = "2026-07-26";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getNumero.mockImplementation(async (chave: string) => (
    chave === "APTIDAO_IDADE_MIN_MESES" ? 13 : 320
  ));
  mocks.aptidaoFindMany.mockResolvedValue([]);
  mocks.aptidaoCreateMany.mockResolvedValue({ count: 0 });
});

describe("aptidão manual", () => {
  it("recusa animal de outro sítio sem revelar sua existência", async () => {
    mocks.animalFindFirst.mockResolvedValue(null);

    await expect(registrarAptidao(31, {
      data: HOJE,
      apta: true,
      motivo: "Avaliação do técnico",
    }, 7)).rejects.toEqual(expect.objectContaining({ code: "NAO_ENCONTRADO" }));

    expect(mocks.animalFindFirst).toHaveBeenCalledWith({
      where: { id: 31, propriedadeId: 7 },
      select: { id: true },
    });
    expect(mocks.aptidaoUpsert).not.toHaveBeenCalled();
  });

  it("registra o fato manual com data UTC e escopo do sítio", async () => {
    mocks.animalFindFirst.mockResolvedValue({ id: 31 });
    mocks.aptidaoUpsert.mockResolvedValue({
      id: 9,
      animalId: 31,
      data: new Date("2026-07-26T00:00:00Z"),
      apta: true,
      motivo: "Avaliação do técnico",
      origem: "MANUAL",
    });

    await expect(registrarAptidao(31, {
      data: HOJE,
      apta: true,
      motivo: "Avaliação do técnico",
    }, 7)).resolves.toEqual({
      id: 9,
      animalId: 31,
      data: HOJE,
      apta: true,
      motivo: "Avaliação do técnico",
      origem: "MANUAL",
    });

    expect(mocks.aptidaoUpsert).toHaveBeenCalledWith({
      where: {
        animalId_data_origem: {
          animalId: 31,
          data: new Date("2026-07-26T00:00:00Z"),
          origem: "MANUAL",
        },
      },
      create: {
        animalId: 31,
        data: new Date("2026-07-26T00:00:00Z"),
        apta: true,
        motivo: "Avaliação do técnico",
        origem: "MANUAL",
        propriedadeId: 7,
      },
      update: {
        apta: true,
        motivo: "Avaliação do técnico",
        propriedadeId: 7,
      },
    });
  });

  it("valida o escopo antes de listar o histórico", async () => {
    mocks.animalFindFirst.mockResolvedValue(null);

    await expect(listarAptidoes(31, 7)).rejects.toEqual(
      expect.objectContaining({ code: "NAO_ENCONTRADO" }),
    );
    expect(mocks.aptidaoFindMany).not.toHaveBeenCalled();
  });
});

describe("aptidão automática", () => {
  it("sugere somente novilhas do sítio que atingem idade e peso configurados", async () => {
    mocks.animalFindMany.mockResolvedValue([
      {
        id: 3,
        numero: "30",
        categoria: "NOVILHA",
        dataNascimento: new Date("2025-01-01T00:00:00Z"),
        pesagens: [{ peso: 360 }],
      },
      {
        id: 1,
        numero: "3",
        categoria: "NOVILHA",
        dataNascimento: new Date("2025-01-01T00:00:00Z"),
        pesagens: [{ peso: 300 }],
      },
      {
        id: 2,
        numero: "5",
        categoria: "NOVILHA",
        dataNascimento: new Date("2024-12-01T00:00:00Z"),
        pesagens: [{ peso: 330 }],
      },
    ]);

    await expect(sugerirAptidaoAutomatica(7, HOJE)).resolves.toEqual([
      expect.objectContaining({ animalId: 2, numero: "5", apta: true }),
      expect.objectContaining({ animalId: 3, numero: "30", apta: true }),
    ]);

    expect(mocks.animalFindMany).toHaveBeenCalledWith({
      where: { categoria: "NOVILHA", status: "ATIVO", propriedadeId: 7 },
      select: {
        id: true,
        numero: true,
        categoria: true,
        dataNascimento: true,
        pesagens: { orderBy: { data: "desc" }, take: 1, select: { peso: true } },
      },
    });
    expect(mocks.getNumero).toHaveBeenCalledWith("APTIDAO_IDADE_MIN_MESES");
    expect(mocks.getNumero).toHaveBeenCalledWith("APTIDAO_PESO_MIN_KG");
  });

  it("materializa apenas fatos automáticos ainda inexistentes no dia", async () => {
    mocks.animalFindMany.mockResolvedValue([
      {
        id: 2,
        numero: "5",
        categoria: "NOVILHA",
        dataNascimento: new Date("2024-12-01T00:00:00Z"),
        pesagens: [{ peso: 330 }],
      },
      {
        id: 3,
        numero: "30",
        categoria: "NOVILHA",
        dataNascimento: new Date("2025-01-01T00:00:00Z"),
        pesagens: [{ peso: 360 }],
      },
    ]);
    mocks.aptidaoFindMany.mockResolvedValue([{ animalId: 2 }]);
    mocks.aptidaoCreateMany.mockResolvedValue({ count: 1 });

    await expect(aplicarAptidaoAutomatica(7, HOJE)).resolves.toEqual({
      data: HOJE,
      candidatas: 2,
      aplicadas: 1,
      ignoradas: 1,
    });

    expect(mocks.aptidaoFindMany).toHaveBeenCalledWith({
      where: {
        animalId: { in: [2, 3] },
        data: new Date("2026-07-26T00:00:00Z"),
        origem: "AUTOMATICA",
      },
      select: { animalId: true },
    });
    expect(mocks.aptidaoCreateMany).toHaveBeenCalledWith({
      data: [{
        animalId: 3,
        data: new Date("2026-07-26T00:00:00Z"),
        apta: true,
        motivo: expect.stringContaining("Atinge idade"),
        origem: "AUTOMATICA",
        propriedadeId: 7,
      }],
      skipDuplicates: true,
    });
  });
});
