import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  animalFindFirst: vi.fn(),
  resultadoFindUnique: vi.fn(),
  transaction: vi.fn(),
  txEventoFindFirst: vi.fn(),
  txEventoCreate: vi.fn(),
  txAnimalFindFirst: vi.fn(),
  txAnimalFindMany: vi.fn(),
  txAnimalCreate: vi.fn(),
  txAnimalUpdate: vi.fn(),
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

vi.mock("./parametros.js", () => ({ getNumero: mocks.getNumero }));

import { registrarEvento } from "./eventos.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.animalFindFirst.mockResolvedValue({ id: 31, propriedadeId: 7 });
  mocks.getNumero.mockResolvedValue(null);
  mocks.txEventoFindFirst.mockResolvedValue({ tipo: "TRANSFERENCIA_EMBRIAO", doadoraId: 44 });
  mocks.txAnimalFindMany.mockResolvedValue([]);
  mocks.txAnimalCreate.mockResolvedValue({ id: 201 });
  mocks.txEventoCreate.mockResolvedValue({
    id: 50,
    animalId: 31,
    tipo: "PARTO",
    data: new Date("2026-07-26T00:00:00Z"),
    tipoParto: "1",
    numCrias: 1,
    criasVivas: 1,
    criasNatimortas: 0,
    sexoCria: "F",
    criaId: 201,
    observacao: null,
  });
  mocks.txAnimalFindUnique.mockResolvedValue({
    id: 31,
    numPartosEntrada: 0,
    eventosReprodutivos: [],
  });
  mocks.lactacaoFindMany.mockResolvedValue([]);
  mocks.resumoUpsert.mockResolvedValue({});
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
    eventoReprodutivo: {
      findFirst: mocks.txEventoFindFirst,
      create: mocks.txEventoCreate,
    },
    animal: {
      findFirst: mocks.txAnimalFindFirst,
      findMany: mocks.txAnimalFindMany,
      create: mocks.txAnimalCreate,
      update: mocks.txAnimalUpdate,
      findUnique: mocks.txAnimalFindUnique,
    },
    lactacao: {
      findMany: mocks.lactacaoFindMany,
      create: vi.fn(),
      update: vi.fn(),
    },
    resumoAnimal: { upsert: mocks.resumoUpsert },
  }));
});

describe("parto cria ou vincula Animal", () => {
  it("cria a bezerra com mãe genética e grava o vínculo no evento na mesma transação", async () => {
    await registrarEvento(31, {
      tipo: "PARTO",
      data: "2026-07-26",
      tipoParto: "1",
      numCrias: 1,
      criasVivas: 1,
      criasNatimortas: 0,
      sexoCria: "F",
      criarCria: true,
      criaNumero: "B-101",
    }, 7);

    expect(mocks.txEventoFindFirst).toHaveBeenCalledWith({
      where: {
        animalId: 31,
        tipo: { in: ["INSEMINACAO", "COBERTURA", "TRANSFERENCIA_EMBRIAO", "PARTO"] },
        data: { lte: new Date("2026-07-26T00:00:00Z") },
      },
      orderBy: [{ data: "desc" }, { id: "desc" }],
      select: { tipo: true, doadoraId: true },
    });
    expect(mocks.txAnimalCreate).toHaveBeenCalledWith({
      data: {
        numero: "B-101",
        sexo: "F",
        categoria: "BEZERRA",
        dataNascimento: new Date("2026-07-26T00:00:00Z"),
        dataEntrada: new Date("2026-07-26T00:00:00Z"),
        maeId: 44,
        propriedadeId: 7,
        resumo: { create: { statusReprodutivo: "VAZIA" } },
      },
      select: { id: true },
    });
    expect(mocks.txEventoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ animalId: 31, criaId: 201 }),
    });
  });

  it("recusa vincular uma cria que não pertence ao sítio", async () => {
    mocks.txEventoFindFirst.mockResolvedValue(null);
    mocks.txAnimalFindFirst.mockResolvedValue(null);

    await expect(registrarEvento(31, {
      tipo: "PARTO",
      data: "2026-07-26",
      tipoParto: "1",
      numCrias: 1,
      criasVivas: 1,
      criasNatimortas: 0,
      sexoCria: "F",
      criaId: 77,
    }, 7)).rejects.toEqual(expect.objectContaining({ code: "NAO_ENCONTRADO" }));

    expect(mocks.txAnimalFindFirst).toHaveBeenCalledWith({
      where: { id: 77, propriedadeId: 7 },
      select: {
        id: true,
        sexo: true,
        categoria: true,
        maeId: true,
        dataNascimento: true,
        partoDeOrigem: { select: { id: true } },
      },
    });
    expect(mocks.txEventoCreate).not.toHaveBeenCalled();
  });

  it("recusa vincular a própria paridora como cria", async () => {
    await expect(registrarEvento(31, {
      tipo: "PARTO",
      data: "2026-07-26",
      tipoParto: "1",
      numCrias: 1,
      criasVivas: 1,
      criasNatimortas: 0,
      sexoCria: "F",
      criaId: 31,
    }, 7)).rejects.toEqual(expect.objectContaining({ code: "CONFLITO" }));

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("recusa vincular animal adulto como cria", async () => {
    mocks.txEventoFindFirst.mockResolvedValue(null);
    mocks.txAnimalFindFirst.mockResolvedValue({
      id: 77,
      categoria: "VACA",
      maeId: null,
      dataNascimento: null,
      partoDeOrigem: null,
    });

    await expect(registrarEvento(31, {
      tipo: "PARTO",
      data: "2026-07-26",
      tipoParto: "1",
      numCrias: 1,
      criasVivas: 1,
      criasNatimortas: 0,
      sexoCria: "F",
      criaId: 77,
    }, 7)).rejects.toEqual(expect.objectContaining({ code: "CONFLITO" }));

    expect(mocks.txAnimalUpdate).not.toHaveBeenCalled();
    expect(mocks.txEventoCreate).not.toHaveBeenCalled();
  });

  it("preserva genealogia existente e recusa mãe divergente", async () => {
    mocks.txEventoFindFirst.mockResolvedValue(null);
    mocks.txAnimalFindFirst.mockResolvedValue({
      id: 77,
      categoria: "BEZERRA",
      maeId: 99,
      dataNascimento: new Date("2026-07-26T00:00:00Z"),
      partoDeOrigem: null,
    });

    await expect(registrarEvento(31, {
      tipo: "PARTO",
      data: "2026-07-26",
      tipoParto: "1",
      numCrias: 1,
      criasVivas: 1,
      criasNatimortas: 0,
      sexoCria: "F",
      criaId: 77,
    }, 7)).rejects.toEqual(expect.objectContaining({ code: "CONFLITO" }));

    expect(mocks.txAnimalUpdate).not.toHaveBeenCalled();
    expect(mocks.txEventoCreate).not.toHaveBeenCalled();
  });

  it("vincula cria elegível e preenche somente genealogia e nascimento ausentes", async () => {
    mocks.txEventoFindFirst.mockResolvedValue(null);
    mocks.txAnimalFindFirst.mockResolvedValue({
      id: 77,
      sexo: "F",
      categoria: "BEZERRA",
      maeId: null,
      dataNascimento: null,
      partoDeOrigem: null,
    });

    await registrarEvento(31, {
      tipo: "PARTO",
      data: "2026-07-26",
      tipoParto: "1",
      numCrias: 1,
      criasVivas: 1,
      criasNatimortas: 0,
      sexoCria: "F",
      criaId: 77,
    }, 7);

    expect(mocks.txAnimalUpdate).toHaveBeenCalledWith({
      where: { id: 77 },
      data: { maeId: 31, dataNascimento: new Date("2026-07-26T00:00:00Z") },
    });
    expect(mocks.txEventoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ criaId: 77 }),
    });
  });

  it("preserva genealogia e nascimento já coincidentes sem reescrever a cria", async () => {
    mocks.txEventoFindFirst.mockResolvedValue(null);
    mocks.txAnimalFindFirst.mockResolvedValue({
      id: 77,
      sexo: "F",
      categoria: "BEZERRA",
      maeId: 31,
      dataNascimento: new Date("2026-07-26T00:00:00Z"),
      partoDeOrigem: null,
    });

    await registrarEvento(31, {
      tipo: "PARTO",
      data: "2026-07-26",
      tipoParto: "1",
      numCrias: 1,
      criasVivas: 1,
      criasNatimortas: 0,
      sexoCria: "F",
      criaId: 77,
    }, 7);

    expect(mocks.txAnimalUpdate).not.toHaveBeenCalled();
    expect(mocks.txEventoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ criaId: 77 }),
    });
  });

  it("recusa vínculo quando sexo cadastrado contradiz o parto", async () => {
    mocks.txEventoFindFirst.mockResolvedValue(null);
    mocks.txAnimalFindFirst.mockResolvedValue({
      id: 77,
      sexo: "M",
      categoria: "BEZERRO",
      maeId: null,
      dataNascimento: null,
      partoDeOrigem: null,
    });

    await expect(registrarEvento(31, {
      tipo: "PARTO",
      data: "2026-07-26",
      tipoParto: "1",
      numCrias: 1,
      criasVivas: 1,
      criasNatimortas: 0,
      sexoCria: "F",
      criaId: 77,
    }, 7)).rejects.toEqual(expect.objectContaining({ code: "CONFLITO" }));

    expect(mocks.txAnimalUpdate).not.toHaveBeenCalled();
    expect(mocks.txEventoCreate).not.toHaveBeenCalled();
  });

  it("aborta o parto quando o número planejado já existe", async () => {
    mocks.txEventoFindFirst.mockResolvedValue(null);
    mocks.txAnimalFindMany.mockResolvedValue([{ numero: "B-101" }]);

    await expect(registrarEvento(31, {
      tipo: "PARTO",
      data: "2026-07-26",
      tipoParto: "1",
      numCrias: 1,
      criasVivas: 1,
      criasNatimortas: 0,
      sexoCria: "F",
      criarCria: true,
      criaNumero: "B-101",
    }, 7)).rejects.toEqual(expect.objectContaining({ code: "CONFLITO" }));

    expect(mocks.txAnimalCreate).not.toHaveBeenCalled();
    expect(mocks.txEventoCreate).not.toHaveBeenCalled();
  });
});
