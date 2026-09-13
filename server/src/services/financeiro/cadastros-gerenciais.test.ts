import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  gruposFindMany: vi.fn(), centrosFindMany: vi.fn(), grupoFindUnique: vi.fn(), grupoFindFirst: vi.fn(), grupoCreate: vi.fn(), grupoUpdate: vi.fn(),
  categoriaCount: vi.fn(), categoriaFindUnique: vi.fn(), categoriaCreate: vi.fn(), categoriaUpdate: vi.fn(),
  centroFindUnique: vi.fn(), centroCreate: vi.fn(), centroUpdate: vi.fn(), auditoria: vi.fn(), transaction: vi.fn(),
}));

vi.mock("../../db.js", () => {
  const tx = {
    grupoCategoria: { findUnique: mocks.grupoFindUnique, findFirst: mocks.grupoFindFirst, create: mocks.grupoCreate, update: mocks.grupoUpdate },
    categoria: { count: mocks.categoriaCount, findUnique: mocks.categoriaFindUnique, create: mocks.categoriaCreate, update: mocks.categoriaUpdate },
    centroCusto: { findUnique: mocks.centroFindUnique, create: mocks.centroCreate, update: mocks.centroUpdate },
    auditoriaFinanceira: { create: mocks.auditoria },
  };
  mocks.transaction.mockImplementation(async (fn: (db: unknown) => unknown) => fn(tx));
  return { prisma: { grupoCategoria: { findMany: mocks.gruposFindMany }, centroCusto: { findMany: mocks.centrosFindMany }, $transaction: mocks.transaction } };
});

import { atualizarCentroCusto, atualizarGrupoCategoria, criarCategoria, listarCadastrosGerenciais } from "./cadastros-gerenciais.js";

describe("cadastros gerenciais", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.gruposFindMany.mockResolvedValue([]); mocks.centrosFindMany.mockResolvedValue([]);
    mocks.grupoFindUnique.mockResolvedValue({ id: 1, nome: "Operacional", ativo: true, ordem: 0 });
    mocks.grupoFindFirst.mockResolvedValue({ id: 1, nome: "Operacional", ativo: true, ordem: 0 });
    mocks.categoriaFindUnique.mockResolvedValue({ id: 2, nome: "Insumos", grupoCategoriaId: 1, ativo: true, ordem: 0 });
    mocks.centroFindUnique.mockResolvedValue({ id: 3, nome: "Leite", ehInvestimento: false, ativo: true, ordem: 0 });
    mocks.categoriaCreate.mockResolvedValue({ id: 2, nome: "Insumos", grupoCategoriaId: 1, ativo: true, ordem: 0 });
    mocks.grupoUpdate.mockImplementation(async ({ data }) => ({ id: 1, nome: "Operacional", ordem: 0, ...data }));
    mocks.centroUpdate.mockImplementation(async ({ data }) => ({ id: 3, nome: "Leite", ordem: 0, ...data }));
  });

  it("lista ativos antes dos inativos com contadores de uso", async () => {
    await listarCadastrosGerenciais();
    expect(mocks.gruposFindMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ ativo: "desc" }, { ordem: "asc" }, { nome: "asc" }] }));
    expect(mocks.centrosFindMany).toHaveBeenCalledWith(expect.objectContaining({ include: { _count: { select: { operacoes: true, produtos: true, safras: true } } } }));
  });

  it("impede desativar grupo que ainda possui categorias ativas", async () => {
    mocks.categoriaCount.mockResolvedValue(1);
    await expect(atualizarGrupoCategoria(1, { ativo: false })).rejects.toMatchObject({ code: "VALIDACAO", campo: "ativo" });
    expect(mocks.grupoUpdate).not.toHaveBeenCalled();
  });

  it("exige grupo ativo ao criar uma categoria", async () => {
    mocks.grupoFindFirst.mockResolvedValue(null);
    await expect(criarCategoria({ nome: "Insumos", grupoCategoriaId: 1, classificacao: null, ordem: 0 })).rejects.toMatchObject({ code: "VALIDACAO", campo: "grupoCategoriaId" });
    expect(mocks.categoriaCreate).not.toHaveBeenCalled();
  });

  it("preserva o cadastro e audita ao desativar centro de custo", async () => {
    await atualizarCentroCusto(3, { ativo: false }, 9);
    expect(mocks.centroUpdate).toHaveBeenCalledWith({ where: { id: 3 }, data: { ativo: false } });
    expect(mocks.auditoria).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ entidade: "CentroCusto", entidadeId: "3", acao: "ATUALIZADO", usuarioId: 9 }) }));
  });
});
