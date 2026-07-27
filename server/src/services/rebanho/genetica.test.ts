import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reprodutorFindFirst: vi.fn(),
  reprodutorFindMany: vi.fn(),
  indicadorCreate: vi.fn(),
  indicadorFindUnique: vi.fn(),
  transaction: vi.fn(),
  txIndicadorFindMany: vi.fn(),
  txValorIndicadorDeleteMany: vi.fn(),
  txValorIndicadorCreateMany: vi.fn(),
  txValorMarcadorDeleteMany: vi.fn(),
  txValorMarcadorCreateMany: vi.fn(),
  txValorCaseinaDeleteMany: vi.fn(),
  txValorCaseinaCreateMany: vi.fn(),
  txReprodutorUpdate: vi.fn(),
  txPedigreeUpsert: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    reprodutor: {
      findFirst: mocks.reprodutorFindFirst,
      findMany: mocks.reprodutorFindMany,
    },
    indicadorGenetico: {
      create: mocks.indicadorCreate,
      findUnique: mocks.indicadorFindUnique,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  GeneticaError,
  criarIndicador,
  obterFichaGenetica,
  rankingReprodutores,
  salvarFichaGenetica,
} from "./genetica.js";

const pedigree = {
  paiNome: "Pai",
  paiCodigo: "P-1",
  maeNome: "Mãe",
  maeCodigo: "M-1",
  avoMaternoNome: null,
  avoMaternoCodigo: null,
  avoPaternoNome: null,
  avoPaternoCodigo: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reprodutorFindFirst.mockResolvedValue({
    id: 31,
    valoresIndicador: [],
    valoresMarcador: [],
    valoresCaseina: [],
    pedigree: null,
  });
  mocks.txIndicadorFindMany.mockResolvedValue([
    { id: 1, colunaLegada: "ptaLeite" },
    { id: 2, colunaLegada: null },
  ]);
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
    indicadorGenetico: { findMany: mocks.txIndicadorFindMany },
    valorIndicadorReprodutor: {
      deleteMany: mocks.txValorIndicadorDeleteMany,
      createMany: mocks.txValorIndicadorCreateMany,
    },
    valorMarcadorReprodutor: {
      deleteMany: mocks.txValorMarcadorDeleteMany,
      createMany: mocks.txValorMarcadorCreateMany,
    },
    valorCaseinaReprodutor: {
      deleteMany: mocks.txValorCaseinaDeleteMany,
      createMany: mocks.txValorCaseinaCreateMany,
    },
    reprodutor: { update: mocks.txReprodutorUpdate },
    pedigreeReprodutor: { upsert: mocks.txPedigreeUpsert },
  }));
});

describe("salvarFichaGenetica", () => {
  it("substitui os vínculos e espelha a coluna legada na mesma transação", async () => {
    await salvarFichaGenetica(31, {
      valoresIndicador: [
        { indicadorId: 1, valor: 987.5 },
        { indicadorId: 2, valor: 42 },
      ],
      valoresMarcador: [{ marcadorId: 3, resultado: "TT" }],
      valoresCaseina: [{ caseinaId: 4, genotipo: "A2A2" }],
      pedigree,
    }, 7);

    expect(mocks.reprodutorFindFirst).toHaveBeenCalledWith({
      where: { id: 31, OR: [{ propriedadeId: 7 }, { propriedadeId: null }] },
      select: { id: true },
    });
    expect(mocks.txValorIndicadorDeleteMany).toHaveBeenCalledWith({ where: { reprodutorId: 31 } });
    expect(mocks.txValorIndicadorCreateMany).toHaveBeenCalledWith({
      data: [
        { reprodutorId: 31, indicadorId: 1, valor: 987.5 },
        { reprodutorId: 31, indicadorId: 2, valor: 42 },
      ],
    });
    expect(mocks.txValorMarcadorDeleteMany).toHaveBeenCalledWith({ where: { reprodutorId: 31 } });
    expect(mocks.txValorMarcadorCreateMany).toHaveBeenCalledWith({
      data: [{ reprodutorId: 31, marcadorId: 3, resultado: "TT" }],
    });
    expect(mocks.txValorCaseinaDeleteMany).toHaveBeenCalledWith({ where: { reprodutorId: 31 } });
    expect(mocks.txValorCaseinaCreateMany).toHaveBeenCalledWith({
      data: [{ reprodutorId: 31, caseinaId: 4, genotipo: "A2A2" }],
    });
    expect(mocks.txReprodutorUpdate).toHaveBeenCalledWith({
      where: { id: 31 },
      data: { ptaLeite: 987.5 },
    });
    expect(mocks.txPedigreeUpsert).toHaveBeenCalledWith({
      where: { reprodutorId: 31 },
      create: { reprodutorId: 31, ...pedigree },
      update: pedigree,
    });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it("limpa a coluna legada quando o indicador espelhado sai da ficha", async () => {
    mocks.txIndicadorFindMany.mockResolvedValue([{ id: 1, colunaLegada: "ptaLeite" }]);

    await salvarFichaGenetica(31, {
      valoresIndicador: [],
      valoresMarcador: [],
      valoresCaseina: [],
    }, 7);

    expect(mocks.txReprodutorUpdate).toHaveBeenCalledWith({
      where: { id: 31 },
      data: { ptaLeite: null },
    });
  });
});

describe("obterFichaGenetica", () => {
  it("recusa reprodutor fora do catálogo visível no sítio", async () => {
    mocks.reprodutorFindFirst.mockResolvedValue(null);

    await expect(obterFichaGenetica(31, 7)).rejects.toEqual(
      expect.objectContaining<Partial<GeneticaError>>({ code: "NAO_ENCONTRADO" }),
    );
    expect(mocks.reprodutorFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 31, OR: [{ propriedadeId: 7 }, { propriedadeId: null }] },
    }));
  });
});

describe("criarIndicador", () => {
  it("mapeia sigla duplicada para conflito de domínio", async () => {
    mocks.indicadorCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.0.0",
      }),
    );

    await expect(criarIndicador({ sigla: "PTA", nome: "PTA leite" })).rejects.toEqual(
      expect.objectContaining<Partial<GeneticaError>>({ code: "CONFLITO", message: "sigla já cadastrada" }),
    );
  });
});

describe("rankingReprodutores", () => {
  const rows = [
    { id: 9, ptaLeite: null, ptaGordura: null, ptaProteina: null, tpi: 3000, valoresIndicador: [] },
    { id: 4, ptaLeite: 800, ptaGordura: 20, ptaProteina: 15, tpi: 2500, valoresIndicador: [] },
    { id: 2, ptaLeite: 800, ptaGordura: 18, ptaProteina: 14, tpi: 2700, valoresIndicador: [] },
    { id: 7, ptaLeite: 500, ptaGordura: 10, ptaProteina: 8, tpi: 2200, valoresIndicador: [] },
  ];

  it("sem indicador mantém a preferência legada PTA leite, TPI e id", async () => {
    mocks.reprodutorFindMany.mockResolvedValue(rows);

    await expect(rankingReprodutores(null, 7)).resolves.toEqual({
      ordem: [2, 4, 7, 9],
      indicadorId: null,
    });
    expect(mocks.reprodutorFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { ativo: true, OR: [{ propriedadeId: 7 }, { propriedadeId: null }] },
    }));
  });

  it("com indicador usa a direção configurada e põe ausentes no fim", async () => {
    mocks.indicadorFindUnique.mockResolvedValue({ id: 12, direcao: "menor_melhor" });
    mocks.reprodutorFindMany.mockResolvedValue([
      { ...rows[0], valoresIndicador: [] },
      { ...rows[1], valoresIndicador: [{ indicadorId: 12, valor: 3.5 }] },
      { ...rows[2], valoresIndicador: [{ indicadorId: 12, valor: 1.2 }] },
    ]);

    await expect(rankingReprodutores(12, 7)).resolves.toEqual({
      ordem: [2, 4, 9],
      indicadorId: 12,
    });
  });
});
