import type { z } from "zod";
import { prisma } from "../../db.js";
import { auditar, FinanceiroError, traduzirConflitoUnico } from "./regras.js";
import type {
  categoriaCadastroSchema,
  centroCustoSchema,
  grupoCategoriaSchema,
  patchCategoriaCadastroSchema,
  patchCentroCustoSchema,
  patchGrupoCategoriaSchema,
} from "./schemas.js";

const includeGrupo = { categorias: { orderBy: [{ ativo: "desc" as const }, { ordem: "asc" as const }, { nome: "asc" as const }], include: { _count: { select: { operacoes: true, produtos: true } } } } };
const includeCentro = { _count: { select: { operacoes: true, produtos: true, safras: true } } };

export async function listarCadastrosGerenciais() {
  const [gruposCategorias, centrosCusto] = await Promise.all([
    prisma.grupoCategoria.findMany({ include: includeGrupo, orderBy: [{ ativo: "desc" }, { ordem: "asc" }, { nome: "asc" }] }),
    prisma.centroCusto.findMany({ include: includeCentro, orderBy: [{ ativo: "desc" }, { ordem: "asc" }, { nome: "asc" }] }),
  ]);
  return { gruposCategorias, centrosCusto };
}

export async function criarGrupoCategoria(input: z.infer<typeof grupoCategoriaSchema>, usuarioId?: number | null) {
  try {
    return await prisma.$transaction(async (tx) => {
      const grupo = await tx.grupoCategoria.create({ data: input });
      await auditar(tx, { entidade: "GrupoCategoria", entidadeId: grupo.id, acao: "CRIADO", usuarioId, depois: grupo });
      return grupo;
    });
  } catch (erro) { traduzirConflitoUnico(erro, { nome: "Já existe um grupo com este nome" }); }
}

export async function atualizarGrupoCategoria(id: number, input: z.infer<typeof patchGrupoCategoriaSchema>, usuarioId?: number | null) {
  try {
    return await prisma.$transaction(async (tx) => {
      const anterior = await tx.grupoCategoria.findUnique({ where: { id } });
      if (!anterior) throw new FinanceiroError("NAO_ENCONTRADO", "Grupo de categoria não encontrado");
      if (input.ativo === false) {
        const ativas = await tx.categoria.count({ where: { grupoCategoriaId: id, ativo: true } });
        if (ativas > 0) throw new FinanceiroError("VALIDACAO", "Desative as categorias deste grupo antes de desativá-lo", "ativo");
      }
      const grupo = await tx.grupoCategoria.update({ where: { id }, data: input });
      await auditar(tx, { entidade: "GrupoCategoria", entidadeId: id, acao: "ATUALIZADO", usuarioId, antes: anterior, depois: grupo });
      return grupo;
    });
  } catch (erro) { traduzirConflitoUnico(erro, { nome: "Já existe um grupo com este nome" }); }
}

export async function criarCategoria(input: z.infer<typeof categoriaCadastroSchema>, usuarioId?: number | null) {
  try {
    return await prisma.$transaction(async (tx) => {
      const grupo = await tx.grupoCategoria.findFirst({ where: { id: input.grupoCategoriaId, ativo: true } });
      if (!grupo) throw new FinanceiroError("VALIDACAO", "Selecione um grupo ativo", "grupoCategoriaId");
      const categoria = await tx.categoria.create({ data: input });
      await auditar(tx, { entidade: "Categoria", entidadeId: categoria.id, acao: "CRIADA", usuarioId, depois: categoria });
      return categoria;
    });
  } catch (erro) { traduzirConflitoUnico(erro, { nome: "Já existe uma categoria com este nome neste grupo" }); }
}

export async function atualizarCategoria(id: number, input: z.infer<typeof patchCategoriaCadastroSchema>, usuarioId?: number | null) {
  try {
    return await prisma.$transaction(async (tx) => {
      const anterior = await tx.categoria.findUnique({ where: { id } });
      if (!anterior) throw new FinanceiroError("NAO_ENCONTRADO", "Categoria não encontrada");
      if (input.grupoCategoriaId !== undefined) {
        const grupo = await tx.grupoCategoria.findFirst({ where: { id: input.grupoCategoriaId, ativo: true } });
        if (!grupo) throw new FinanceiroError("VALIDACAO", "Selecione um grupo ativo", "grupoCategoriaId");
      }
      const categoria = await tx.categoria.update({ where: { id }, data: input });
      await auditar(tx, { entidade: "Categoria", entidadeId: id, acao: "ATUALIZADA", usuarioId, antes: anterior, depois: categoria });
      return categoria;
    });
  } catch (erro) { traduzirConflitoUnico(erro, { nome: "Já existe uma categoria com este nome neste grupo" }); }
}

export async function criarCentroCusto(input: z.infer<typeof centroCustoSchema>, usuarioId?: number | null) {
  try {
    return await prisma.$transaction(async (tx) => {
      const centro = await tx.centroCusto.create({ data: input });
      await auditar(tx, { entidade: "CentroCusto", entidadeId: centro.id, acao: "CRIADO", usuarioId, depois: centro });
      return centro;
    });
  } catch (erro) { traduzirConflitoUnico(erro, { nome: "Já existe um centro de custo com este nome" }); }
}

export async function atualizarCentroCusto(id: number, input: z.infer<typeof patchCentroCustoSchema>, usuarioId?: number | null) {
  try {
    return await prisma.$transaction(async (tx) => {
      const anterior = await tx.centroCusto.findUnique({ where: { id } });
      if (!anterior) throw new FinanceiroError("NAO_ENCONTRADO", "Centro de custo não encontrado");
      const centro = await tx.centroCusto.update({ where: { id }, data: input });
      await auditar(tx, { entidade: "CentroCusto", entidadeId: id, acao: "ATUALIZADO", usuarioId, antes: anterior, depois: centro });
      return centro;
    });
  } catch (erro) { traduzirConflitoUnico(erro, { nome: "Já existe um centro de custo com este nome" }); }
}
