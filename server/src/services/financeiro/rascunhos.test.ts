import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn(), transaction: vi.fn(),
  documentoUpdateMany: vi.fn(), operacaoFindUniqueOrThrow: vi.fn(), confirmarOperacao: vi.fn(),
  deleteObject: vi.fn(),
}));

vi.mock("../../db.js", () => ({ prisma: {
  rascunhoOperacao: { findUnique: mocks.findUnique, upsert: mocks.upsert, delete: mocks.delete },
  $transaction: mocks.transaction,
} }));
vi.mock("../../lib/storage.js", () => ({ getStorage: vi.fn(async () => ({ deleteObject: mocks.deleteObject })) }));
vi.mock("./operacoes.js", () => ({ confirmarRascunhoOperacao: mocks.confirmarOperacao }));

import { confirmarRascunho, salvarRascunho } from "./rascunhos.js";

describe("rascunho único de operação", () => {
  beforeEach(() => vi.clearAllMocks());

  it("faz upsert pela combinação propriedade e usuário", async () => {
    mocks.findUnique.mockResolvedValue(null);
    mocks.upsert.mockResolvedValue({ id: 1, versao: 1, dados: {}, documentos: [] });
    await salvarRascunho({ propriedadeId: 7, usuarioId: 3, dados: { formulario: {} } });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { propriedadeId_criadoPorId: { propriedadeId: 7, criadoPorId: 3 } },
    }));
  });

  it("recusa sobrescrever uma versão mais nova", async () => {
    mocks.findUnique.mockResolvedValue({ versao: 4 });
    await expect(salvarRascunho({ propriedadeId: 7, usuarioId: 3, versao: 3, dados: {} })).rejects.toThrow("outra sessão");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("confirma efeitos, promove documentos e remove o rascunho na mesma transação", async () => {
    const tx = {
      rascunhoOperacao: { findUnique: vi.fn().mockResolvedValue({ id: 9, versao: 2, dados: { operacao: {
        tipo: "SERVICO", data: "2026-09-07", descricao: "Manutenção do trator", valorTotal: 500,
        parceiroId: 1, itens: [], financeiro: { condicao: "A_PRAZO", parcelas: [{ valor: 500, dataVencimento: "2026-10-07" }] },
      } }, documentos: [{ id: 12 }] }), delete: mocks.delete },
      documentoFinanceiro: { updateMany: mocks.documentoUpdateMany },
      operacao: { findUniqueOrThrow: mocks.operacaoFindUniqueOrThrow },
    };
    mocks.transaction.mockImplementation((callback) => callback(tx));
    mocks.confirmarOperacao.mockResolvedValue({ id: 20 });
    mocks.operacaoFindUniqueOrThrow.mockResolvedValue({ id: 20, status: "CONFIRMADA" });
    await expect(confirmarRascunho(7, 3, 2)).resolves.toMatchObject({ id: 20 });
    expect(mocks.documentoUpdateMany).toHaveBeenCalledWith({ where: { rascunhoId: 9 }, data: { rascunhoId: null, operacaoId: 20 } });
    expect(mocks.delete).toHaveBeenCalledWith({ where: { id: 9 } });
  });
});
