import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  animalFindFirst: vi.fn(),
  eventoFindFirst: vi.fn(),
  transaction: vi.fn(),
  txEstoqueFindFirst: vi.fn(),
  txEstoqueUpdateMany: vi.fn(),
  txEstoqueUpdate: vi.fn(),
  txEventoCreate: vi.fn(),
  txEventoDelete: vi.fn(),
  txAnimalFindUnique: vi.fn(),
  txLactacaoFindMany: vi.fn(),
  txResumoUpsert: vi.fn(),
  getNumero: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    animal: { findFirst: mocks.animalFindFirst },
    eventoReprodutivo: { findFirst: mocks.eventoFindFirst },
    $transaction: mocks.transaction,
  },
}));

vi.mock("./parametros.js", () => ({ getNumero: mocks.getNumero }));

import { criarEventoSchema } from "./eventos.schemas.js";
import { excluirEvento, registrarEvento } from "./eventos.js";

function eventoInseminacao(overrides: Record<string, unknown> = {}) {
  return {
    id: 50,
    animalId: 31,
    tipo: "INSEMINACAO",
    data: new Date("2026-07-26T00:00:00Z"),
    reprodutor: "Touro A",
    protocolo: null,
    observacao: null,
    estoqueSemenId: 18,
    estoqueSemenDoseBaixada: true,
    motivoSecagem: null,
    tipoParto: null,
    animal: { propriedadeId: 7 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.animalFindFirst.mockResolvedValue({ id: 31, propriedadeId: 7 });
  mocks.txEstoqueFindFirst.mockResolvedValue({ id: 18, dosesDisponiveis: 3 });
  mocks.txEstoqueUpdateMany.mockResolvedValue({ count: 1 });
  mocks.txEstoqueUpdate.mockResolvedValue({ id: 18, dosesDisponiveis: 4 });
  mocks.txEventoCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
    eventoInseminacao(data));
  mocks.txEventoDelete.mockResolvedValue(eventoInseminacao());
  mocks.txAnimalFindUnique.mockResolvedValue({
    id: 31,
    numPartosEntrada: 0,
    eventosReprodutivos: [],
  });
  mocks.txLactacaoFindMany.mockResolvedValue([]);
  mocks.txResumoUpsert.mockResolvedValue({});
  mocks.getNumero.mockResolvedValue(null);
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
    estoqueSemen: {
      findFirst: mocks.txEstoqueFindFirst,
      updateMany: mocks.txEstoqueUpdateMany,
      update: mocks.txEstoqueUpdate,
    },
    eventoReprodutivo: {
      create: mocks.txEventoCreate,
      delete: mocks.txEventoDelete,
    },
    animal: { findUnique: mocks.txAnimalFindUnique, update: vi.fn() },
    lactacao: { findMany: mocks.txLactacaoFindMany, create: vi.fn(), update: vi.fn() },
    resumoAnimal: { upsert: mocks.txResumoUpsert },
  }));
});

describe("schema de inseminação com lote de sêmen", () => {
  it("aceita e preserva estoqueSemenId positivo", () => {
    const resultado = criarEventoSchema.safeParse({
      tipo: "INSEMINACAO",
      data: "2026-07-26",
      reprodutor: "Touro A",
      estoqueSemenId: 18,
    });

    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data).toEqual(expect.objectContaining({ estoqueSemenId: 18 }));
  });
});

describe("registrarEvento — baixa opcional de dose", () => {
  const input = {
    tipo: "INSEMINACAO" as const,
    data: "2026-07-26",
    reprodutor: "Touro A",
    estoqueSemenId: 18,
  };

  it("valida o lote no sítio dentro da transação e consome uma dose atomicamente", async () => {
    const resultado = await registrarEvento(31, input, 7);

    expect(mocks.txEstoqueFindFirst).toHaveBeenCalledWith({
      where: { id: 18, propriedadeId: 7 },
      select: { id: true, dosesDisponiveis: true },
    });
    expect(mocks.txEstoqueUpdateMany).toHaveBeenCalledWith({
      where: { id: 18, propriedadeId: 7, dosesDisponiveis: { gte: 1 } },
      data: { dosesDisponiveis: { decrement: 1 } },
    });
    expect(mocks.txEventoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        estoqueSemenId: 18,
        estoqueSemenDoseBaixada: true,
      }),
    });
    expect(resultado).not.toHaveProperty("aviso");
  });

  it("registra vínculo sem baixa e avisa quando o saldo já está zerado", async () => {
    mocks.txEstoqueFindFirst.mockResolvedValue({ id: 18, dosesDisponiveis: 0 });

    const resultado = await registrarEvento(31, input, 7);

    expect(mocks.txEstoqueUpdateMany).not.toHaveBeenCalled();
    expect(mocks.txEventoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        estoqueSemenId: 18,
        estoqueSemenDoseBaixada: false,
      }),
    });
    expect(resultado).toEqual(expect.objectContaining({ aviso: expect.stringMatching(/estoque zerado/i) }));
  });

  it("preserva o registro sem baixa quando outra transação consome a última dose", async () => {
    mocks.txEstoqueFindFirst.mockResolvedValue({ id: 18, dosesDisponiveis: 1 });
    mocks.txEstoqueUpdateMany.mockResolvedValue({ count: 0 });

    const resultado = await registrarEvento(31, input, 7);

    expect(mocks.txEventoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ estoqueSemenDoseBaixada: false }),
    });
    expect(resultado).toEqual(expect.objectContaining({ aviso: expect.stringMatching(/estoque zerado/i) }));
  });

  it("usa a propriedade efetiva do animal mesmo quando o chamador está consolidado", async () => {
    await registrarEvento(31, input, null);

    expect(mocks.txEstoqueFindFirst).toHaveBeenCalledWith({
      where: { id: 18, propriedadeId: 7 },
      select: { id: true, dosesDisponiveis: true },
    });
    expect(mocks.txEstoqueUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 18, propriedadeId: 7 }),
    }));
  });

  it("não revela nem grava lote de outro sítio", async () => {
    mocks.txEstoqueFindFirst.mockResolvedValue(null);

    await expect(registrarEvento(31, input, 7)).rejects.toEqual(
      expect.objectContaining({ code: "NAO_ENCONTRADO" }),
    );

    expect(mocks.txEventoCreate).not.toHaveBeenCalled();
    expect(mocks.txEstoqueUpdateMany).not.toHaveBeenCalled();
  });
});

describe("excluirEvento — devolução condicionada ao marcador", () => {
  it("devolve exatamente uma dose antes de excluir evento que teve baixa", async () => {
    mocks.eventoFindFirst.mockResolvedValue(eventoInseminacao());

    await excluirEvento(50, 7);

    expect(mocks.txEstoqueFindFirst).toHaveBeenCalledWith({
      where: { id: 18, propriedadeId: 7 },
      select: { id: true, dosesDisponiveis: true },
    });
    expect(mocks.txEstoqueUpdate).toHaveBeenCalledWith({
      where: { id: 18 },
      data: { dosesDisponiveis: { increment: 1 } },
    });
    expect(mocks.txEventoDelete).toHaveBeenCalledWith({ where: { id: 50 } });
  });

  it("usa a propriedade efetiva do animal na devolução consolidada", async () => {
    mocks.eventoFindFirst.mockResolvedValue(eventoInseminacao());

    await excluirEvento(50, null);

    expect(mocks.eventoFindFirst).toHaveBeenCalledWith({
      where: { id: 50 },
      include: { animal: { select: { propriedadeId: true } } },
    });
    expect(mocks.txEstoqueFindFirst).toHaveBeenCalledWith({
      where: { id: 18, propriedadeId: 7 },
      select: { id: true, dosesDisponiveis: true },
    });
  });

  it("não devolve dose de evento registrado com estoque zerado", async () => {
    mocks.eventoFindFirst.mockResolvedValue(eventoInseminacao({ estoqueSemenDoseBaixada: false }));

    await excluirEvento(50, 7);

    expect(mocks.txEstoqueFindFirst).not.toHaveBeenCalled();
    expect(mocks.txEstoqueUpdate).not.toHaveBeenCalled();
    expect(mocks.txEventoDelete).toHaveBeenCalledWith({ where: { id: 50 } });
  });
});
