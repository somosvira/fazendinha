import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  localFindFirst: vi.fn(),
  localCreate: vi.fn(),
  localUpdate: vi.fn(),
  localDelete: vi.fn(),
  loteFindFirst: vi.fn(),
  loteCreate: vi.fn(),
  loteDelete: vi.fn(),
  loteCount: vi.fn(),
  produtoFindUnique: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    localArmazenamento: {
      findFirst: mocks.localFindFirst,
      create: mocks.localCreate,
      update: mocks.localUpdate,
      delete: mocks.localDelete,
    },
    loteProduto: {
      findFirst: mocks.loteFindFirst,
      create: mocks.loteCreate,
      delete: mocks.loteDelete,
      count: mocks.loteCount,
    },
    produto: { findUnique: mocks.produtoFindUnique },
  },
}));

import { criarLote, excluirLocal, excluirLote, LoteError } from "./lotes.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loteCount.mockResolvedValue(0);
});

// Regressão: escritas de escopo de sítio não podem apagar/ler recurso de outra
// propriedade (services/rebanho/lotes.ts é usado por /estoque/locais-armazenamento
// e /estoque/lotes-produto — a query precisa checar (propriedadeId ?? null)
// ANTES do delete, senão o service dá NAO_ENCONTRADO em vez de vazar entre sítios).
describe("excluirLocal — escopo de propriedade", () => {
  it("filtra por propriedadeId (ou compartilhado) antes de excluir", async () => {
    mocks.localFindFirst.mockResolvedValue({ id: 1 });
    await excluirLocal(1, 3);
    expect(mocks.localFindFirst).toHaveBeenCalledWith({
      where: { id: 1, OR: [{ propriedadeId: 3 }, { propriedadeId: null }] },
    });
    expect(mocks.localDelete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it("lança NAO_ENCONTRADO quando o local pertence a outra propriedade", async () => {
    mocks.localFindFirst.mockResolvedValue(null);
    await expect(excluirLocal(1, 3)).rejects.toEqual(expect.objectContaining({ code: "NAO_ENCONTRADO" }));
    expect(mocks.localDelete).not.toHaveBeenCalled();
  });

  it("sem propriedadeId (ponte legada) não filtra por sítio", async () => {
    mocks.localFindFirst.mockResolvedValue({ id: 1 });
    await excluirLocal(1, null);
    expect(mocks.localFindFirst).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});

describe("excluirLote — escopo de propriedade", () => {
  it("filtra por propriedadeId (ou compartilhado) antes de excluir", async () => {
    mocks.loteFindFirst.mockResolvedValue({ id: 5 });
    await excluirLote(5, 3);
    expect(mocks.loteFindFirst).toHaveBeenCalledWith({
      where: { id: 5, OR: [{ propriedadeId: 3 }, { propriedadeId: null }] },
    });
    expect(mocks.loteDelete).toHaveBeenCalledWith({ where: { id: 5 } });
  });

  it("lança NAO_ENCONTRADO quando o lote pertence a outra propriedade", async () => {
    mocks.loteFindFirst.mockResolvedValue(null);
    await expect(excluirLote(5, 3)).rejects.toEqual(expect.objectContaining({ code: "NAO_ENCONTRADO" }));
    expect(mocks.loteDelete).not.toHaveBeenCalled();
  });
});

describe("criarLote — localId de outro sítio", () => {
  it("rejeita localId que pertence a outra propriedade", async () => {
    mocks.produtoFindUnique.mockResolvedValue({ id: 9 });
    mocks.localFindFirst.mockResolvedValue(null);
    await expect(criarLote({ produtoId: 9, codigo: "L1", localId: 42 }, 3)).rejects.toBeInstanceOf(LoteError);
    expect(mocks.localFindFirst).toHaveBeenCalledWith({
      where: { id: 42, OR: [{ propriedadeId: 3 }, { propriedadeId: null }] },
    });
    expect(mocks.loteCreate).not.toHaveBeenCalled();
  });

  it("aceita localId do mesmo sítio (ou compartilhado)", async () => {
    mocks.produtoFindUnique.mockResolvedValue({ id: 9 });
    mocks.localFindFirst.mockResolvedValue({ id: 42 });
    mocks.loteCreate.mockResolvedValue({
      id: 1, produtoId: 9, codigo: "L1", validade: null, localId: 42,
      quantidade: null, produto: { nome: "Sal" }, local: { nome: "Depósito" },
    });
    await criarLote({ produtoId: 9, codigo: "L1", localId: 42 }, 3);
    expect(mocks.loteCreate).toHaveBeenCalled();
  });
});
