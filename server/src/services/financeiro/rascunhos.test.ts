import { beforeEach, describe, expect, it, vi } from "vitest";
import { uid } from "../../lib/uid.fixture.js";

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
vi.mock("./operacoes.js", () => ({ envolveAnimais: () => false, confirmarRascunhoOperacao: mocks.confirmarOperacao }));

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
      $executeRaw: vi.fn().mockResolvedValue(0),
      rascunhoOperacao: { findUnique: vi.fn().mockResolvedValue({ id: uid(9), versao: 2, dados: { operacao: {
        tipo: "SERVICO", data: "2026-09-07", descricao: "Manutenção do trator", valorTotal: 500,
        parceiroId: uid(1), itens: [], financeiro: { condicao: "A_PRAZO", parcelas: [{ valor: 500, dataVencimento: "2026-10-07" }] },
      } }, documentos: [{ id: uid(12) }] }), deleteMany: mocks.delete.mockResolvedValue({ count: 1 }) },
      documentoFinanceiro: { updateMany: mocks.documentoUpdateMany },
      operacao: { findUniqueOrThrow: mocks.operacaoFindUniqueOrThrow },
    };
    mocks.transaction.mockImplementation((callback) => callback(tx));
    mocks.confirmarOperacao.mockResolvedValue({ id: uid(20) });
    mocks.operacaoFindUniqueOrThrow.mockResolvedValue({ id: uid(20), status: "CONFIRMADA" });
    await expect(confirmarRascunho(7, 3, 2)).resolves.toMatchObject({ id: uid(20) });
    expect(mocks.documentoUpdateMany).toHaveBeenCalledWith({ where: { rascunhoId: uid(9) }, data: { rascunhoId: null, operacaoId: uid(20) } });
    expect(mocks.delete).toHaveBeenCalledWith({ where: { id: uid(9), versao: 2 } });
  });

  it("frete sem categoria recusa a confirmação apontando o campo, em português", async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      rascunhoOperacao: { findUnique: vi.fn().mockResolvedValue({ id: uid(9), versao: 2, dados: { operacao: {
        chave: uid(1), tipo: "COMPRA_ESTOQUE", data: "2026-10-01", descricao: "Compra com frete", parceiroId: uid(3),
        itens: [{ produtoId: uid(5), descricao: "Material", quantidade: 150, unidade: "DOSE", valorTotal: 300 }],
        logistica: { valor: 10, descricao: "Logística da aquisição", categoriaId: "" }, financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" },
      } }, documentos: [] }), deleteMany: mocks.delete },
    };
    mocks.transaction.mockImplementation((callback) => callback(tx));
    const falha = await confirmarRascunho(7, 3, 2).catch((e: unknown) => e);
    expect(falha).toMatchObject({ code: "VALIDACAO", message: "Selecione a categoria do frete", campo: "logistica.categoriaId" });
    expect(mocks.confirmarOperacao).not.toHaveBeenCalled();
  });
});
