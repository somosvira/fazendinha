import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  categoriasFindMany: vi.fn(), centrosFindMany: vi.fn(),
  categoriaCount: vi.fn(), categoriaFindUnique: vi.fn(), categoriaCreate: vi.fn(), categoriaUpdate: vi.fn(),
  centroFindUnique: vi.fn(), centroCreate: vi.fn(), centroUpdate: vi.fn(), auditoria: vi.fn(), transaction: vi.fn(),
}));

vi.mock("../../db.js", () => {
  const tx = {
    categoria: { count: mocks.categoriaCount, findUnique: mocks.categoriaFindUnique, create: mocks.categoriaCreate, update: mocks.categoriaUpdate },
    centroCusto: { findUnique: mocks.centroFindUnique, create: mocks.centroCreate, update: mocks.centroUpdate },
    auditoriaFinanceira: { create: mocks.auditoria },
  };
  mocks.transaction.mockImplementation(async (fn: (db: unknown) => unknown) => fn(tx));
  return { prisma: { categoria: { findMany: mocks.categoriasFindMany }, centroCusto: { findMany: mocks.centrosFindMany }, $transaction: mocks.transaction } };
});

import { atualizarCentroCusto, criarCategoria, listarCadastrosGerenciais } from "./cadastros-gerenciais.js";

describe("cadastros gerenciais", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.categoriasFindMany.mockResolvedValue([]); mocks.centrosFindMany.mockResolvedValue([]);
    mocks.categoriaFindUnique.mockResolvedValue({ id: 2, nome: "Insumos", ativo: true, ordem: 0 });
    mocks.centroFindUnique.mockResolvedValue({ id: 3, nome: "Leite", ativo: true, ordem: 0 });
    mocks.categoriaCreate.mockResolvedValue({ id: 2, nome: "Insumos", ativo: true, ordem: 0 });
    mocks.centroUpdate.mockImplementation(async ({ data }) => ({ id: 3, nome: "Leite", ordem: 0, ...data }));
  });

  it("lista ativos antes dos inativos com contadores de uso", async () => {
    await listarCadastrosGerenciais();
    expect(mocks.categoriasFindMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ ativo: "desc" }, { ordem: "asc" }, { nome: "asc" }] }));
    expect(mocks.centrosFindMany).toHaveBeenCalledWith(expect.objectContaining({ include: { _count: { select: { operacoes: true, produtos: true, safras: true } } } }));
  });

  it("cria categoria sem grupo e registra auditoria", async () => {
    await criarCategoria({ nome: "Insumos", classificacao: null, ordem: 0 }, 9);
    expect(mocks.categoriaCreate).toHaveBeenCalledWith({ data: { nome: "Insumos", classificacao: null, ordem: 0 } });
    expect(mocks.auditoria).toHaveBeenCalled();
  });

  it("preserva o cadastro e audita ao desativar centro de custo", async () => {
    await atualizarCentroCusto(3, { ativo: false }, 9);
    expect(mocks.centroUpdate).toHaveBeenCalledWith({ where: { id: 3 }, data: { ativo: false } });
    expect(mocks.auditoria).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ entidade: "CentroCusto", entidadeId: "3", acao: "ATUALIZADO", usuarioId: 9 }) }));
  });
});
