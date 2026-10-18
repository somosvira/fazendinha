import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { operacaoSchema } from "./schemas.js";
import { uid } from "../../lib/uid.fixture.js";

const mocks = vi.hoisted(() => ({
  gruposFindMany: vi.fn(), grupoFindUnique: vi.fn(), grupoCreate: vi.fn(), grupoUpdate: vi.fn(), queryRaw: vi.fn(),
  categoriasFindMany: vi.fn(), centrosFindMany: vi.fn(),
  categoriaCount: vi.fn(), categoriaFindUnique: vi.fn(), categoriaCreate: vi.fn(), categoriaUpdate: vi.fn(),
  centroFindUnique: vi.fn(), centroCreate: vi.fn(), centroUpdate: vi.fn(), auditoria: vi.fn(), transaction: vi.fn(),
}));

vi.mock("../../db.js", () => {
  const tx = {
    $queryRaw: mocks.queryRaw,
    grupoCategoria: { findUnique: mocks.grupoFindUnique, create: mocks.grupoCreate, update: mocks.grupoUpdate },
    categoria: { count: mocks.categoriaCount, findUnique: mocks.categoriaFindUnique, create: mocks.categoriaCreate, update: mocks.categoriaUpdate },
    centroCusto: { findUnique: mocks.centroFindUnique, create: mocks.centroCreate, update: mocks.centroUpdate },
    auditoriaFinanceira: { create: mocks.auditoria },
  };
  mocks.transaction.mockImplementation(async (fn: (db: unknown) => unknown) => fn(tx));
  return { prisma: { grupoCategoria: { findMany: mocks.gruposFindMany }, categoria: { findMany: mocks.categoriasFindMany }, centroCusto: { findMany: mocks.centrosFindMany }, $transaction: mocks.transaction } };
});

import { atualizarGrupoCategoria, criarGrupoCategoria, atualizarCategoria, atualizarCentroCusto, criarCategoria, listarCadastrosGerenciais } from "./cadastros-gerenciais.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.gruposFindMany.mockResolvedValue([]);
  mocks.queryRaw.mockResolvedValue([{ ativo: true }]);
  mocks.grupoCreate.mockResolvedValue({ id: uid(8), nome: "Administrativo", ativo: true });
  mocks.grupoFindUnique.mockResolvedValue({ id: uid(8), nome: "Administrativo", ativo: true });
  mocks.grupoUpdate.mockImplementation(async ({ data }) => ({ id: uid(8), nome: "Administrativo", ...data }));
  mocks.categoriasFindMany.mockResolvedValue([]); mocks.centrosFindMany.mockResolvedValue([]);
  mocks.categoriaFindUnique.mockResolvedValue({ id: uid(2), nome: "Insumos", ativo: true, ordem: 0 });
  mocks.centroFindUnique.mockResolvedValue({ id: uid(3), nome: "Leite", ativo: true, ordem: 0 });
  mocks.categoriaCreate.mockResolvedValue({ id: uid(2), nome: "Insumos", ativo: true, ordem: 0 });
  mocks.centroUpdate.mockImplementation(async ({ data }) => ({ id: uid(3), nome: "Leite", ordem: 0, ...data }));
});

describe("cadastros gerenciais", () => {
  it("lista ativos antes dos inativos com contadores de uso", async () => {
    await listarCadastrosGerenciais();
    expect(mocks.categoriasFindMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ ativo: "desc" }, { ordem: "asc" }, { nome: "asc" }] }));
    expect(mocks.centrosFindMany).toHaveBeenCalledWith(expect.objectContaining({ include: { _count: { select: { operacoes: true, produtos: true } } } }));
  });

  it("cria categoria sem grupo e registra auditoria", async () => {
    await criarCategoria({ nome: "Insumos", classificacao: null, ordem: 0 }, 9);
    expect(mocks.categoriaCreate).toHaveBeenCalledWith({ data: { nome: "Insumos", classificacao: null, ordem: 0 } });
    expect(mocks.auditoria).toHaveBeenCalled();
  });

  it("preserva o cadastro e audita ao desativar centro de custo", async () => {
    await atualizarCentroCusto(uid(3), { ativo: false }, 9);
    expect(mocks.centroUpdate).toHaveBeenCalledWith({ where: { id: uid(3) }, data: { ativo: false } });
    expect(mocks.auditoria).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ entidade: "CentroCusto", entidadeId: uid(3), acao: "ATUALIZADO", usuarioId: 9 }) }));
  });
});


describe("grupos de categorias", () => {
  it("associa categoria a grupo ativo com validação transacional", async () => {
    mocks.queryRaw.mockResolvedValue([{ ativo: true }]);
    await criarCategoria({ nome: "Internet", classificacao: null, ordem: 0, grupoId: uid(8) }, 9);
    expect(mocks.categoriaCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ grupoId: uid(8) }) });
    expect(mocks.queryRaw).toHaveBeenCalled();
  });

  it.each([{ grupos: [] }, { grupos: [{ ativo: false }] }])("recusa nova associação a grupo inexistente ou inativo", async ({ grupos }) => {
    mocks.categoriaCreate.mockClear();
    mocks.queryRaw.mockResolvedValue(grupos);
    await expect(criarCategoria({ nome: "Internet", classificacao: null, ordem: 0, grupoId: uid(8) })).rejects.toMatchObject({ campo: "grupoId", code: "VALIDACAO" });
    expect(mocks.categoriaCreate).not.toHaveBeenCalled();
  });

  it("permite editar categoria que conserva seu grupo inativo e remover o vínculo", async () => {
    mocks.queryRaw.mockClear();
    mocks.categoriaFindUnique.mockResolvedValue({ id: uid(2), grupoId: uid(8) });
    await atualizarCategoria(uid(2), { nome: "Internet rural", grupoId: uid(8) });
    await atualizarCategoria(uid(2), { grupoId: null });
    expect(mocks.queryRaw).not.toHaveBeenCalled();
    expect(mocks.categoriaUpdate).toHaveBeenLastCalledWith({ where: { id: uid(2) }, data: { grupoId: null } });
  });

  it("valida também a troca de grupo na edição", async () => {
    mocks.categoriaFindUnique.mockResolvedValue({ id: uid(2), grupoId: uid(8) });
    mocks.queryRaw.mockResolvedValue([{ ativo: false }]);
    await expect(atualizarCategoria(uid(2), { grupoId: uid(9) })).rejects.toMatchObject({ campo: "grupoId" });
  });

  it("audita criação e desativação sem alterar categorias", async () => {
    mocks.grupoCreate.mockResolvedValue({ id: uid(8), nome: "Administrativo" });
    mocks.grupoFindUnique.mockResolvedValue({ id: uid(8), nome: "Administrativo", ativo: true });
    mocks.categoriaUpdate.mockClear();
    await criarGrupoCategoria({ nome: "Administrativo", ordem: 0 }, 9);
    await atualizarGrupoCategoria(uid(8), { ativo: false }, 9);
    expect(mocks.auditoria).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ entidade: "GrupoCategoria", usuarioId: 9, acao: "ATUALIZADO" }) }));
    expect(mocks.categoriaUpdate).not.toHaveBeenCalled();
  });
  it("traduz duplicidade de nome para conflito no cadastro", async () => {
    mocks.grupoCreate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicado", { code: "P2002", clientVersion: "6", meta: { target: ["nome"] } }));
    await expect(criarGrupoCategoria({ nome: "Administrativo", ordem: 0 })).rejects.toMatchObject({ code: "CONFLITO", campo: "nome" });
  });

  it("não aceita grupo independente na operação ou nos itens", () => {
    const operacao = operacaoSchema.parse({ tipo: "SERVICO", valorTotal: 100, data: "2026-10-17", descricao: "Serviço", parceiroId: uid(3), categoriaId: uid(2), grupoId: uid(8),
      itens: [{ descricao: "Serviço", unidade: "UN", quantidade: 1, valorTotal: 100, categoriaId: uid(2), grupoId: uid(9) }], financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" } });
    expect(operacao).not.toHaveProperty("grupoId");
    expect(operacao.itens[0]).not.toHaveProperty("grupoId");
  });

});
