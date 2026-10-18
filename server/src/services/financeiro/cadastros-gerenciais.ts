import type { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { auditar, FinanceiroError, traduzirConflitoUnico } from "./regras.js";
import type {
  categoriaCadastroSchema,
  centroCustoSchema,
  patchCategoriaCadastroSchema,
  patchCentroCustoSchema,
  grupoCategoriaSchema,
  patchGrupoCategoriaSchema,
} from "./schemas.js";

const includeCentro = { _count: { select: { operacoes: true, produtos: true } } };

export async function listarCadastrosGerenciais() {
  const [categorias, centrosCusto, gruposCategorias] = await Promise.all([
    prisma.categoria.findMany({ include: { grupo: true, _count: { select: { operacoes: true, produtos: true, itens: true } } }, orderBy: [{ ativo: "desc" }, { ordem: "asc" }, { nome: "asc" }] }),
    prisma.centroCusto.findMany({ include: includeCentro, orderBy: [{ ativo: "desc" }, { ordem: "asc" }, { nome: "asc" }] }),
    prisma.grupoCategoria.findMany({ include: { _count: { select: { categorias: true } } }, orderBy: [{ ativo: "desc" }, { ordem: "asc" }, { nome: "asc" }] }),
  ]);
  return { categorias, centrosCusto, gruposCategorias };
}

async function validarGrupo(tx: Prisma.TransactionClient, grupoId: string | null | undefined, anterior?: string | null) {
  if (!grupoId || grupoId === anterior) return;
  // Serializa novas associações com a desativação do grupo.
  const grupos = await tx.$queryRaw<{ ativo: boolean }[]>`SELECT "ativo" FROM "public"."GrupoCategoria" WHERE "id" = ${grupoId} FOR SHARE`;
  if (!grupos[0]?.ativo) throw new FinanceiroError("VALIDACAO", "Selecione um grupo de categorias ativo", "grupoId");
}

export async function criarGrupoCategoria(input: z.infer<typeof grupoCategoriaSchema>, usuarioId?: number | null) {
  try {
    return await prisma.$transaction(async (tx) => {
      const grupo = await tx.grupoCategoria.create({ data: input });
      await auditar(tx, { entidade: "GrupoCategoria", entidadeId: grupo.id, acao: "CRIADO", usuarioId, depois: grupo });
      return grupo;
    });
  } catch (erro) { traduzirConflitoUnico(erro, { nome: "Já existe um grupo de categorias com este nome" }); }
}

export async function atualizarGrupoCategoria(id: string, input: z.infer<typeof patchGrupoCategoriaSchema>, usuarioId?: number | null) {
  try {
    return await prisma.$transaction(async (tx) => {
      const anterior = await tx.grupoCategoria.findUnique({ where: { id } });
      if (!anterior) throw new FinanceiroError("NAO_ENCONTRADO", "Grupo de categorias não encontrado");
      const grupo = await tx.grupoCategoria.update({ where: { id }, data: input });
      await auditar(tx, { entidade: "GrupoCategoria", entidadeId: id, acao: "ATUALIZADO", usuarioId, antes: anterior, depois: grupo });
      return grupo;
    });
  } catch (erro) { traduzirConflitoUnico(erro, { nome: "Já existe um grupo de categorias com este nome" }); }
}

export async function criarCategoria(input: z.infer<typeof categoriaCadastroSchema>, usuarioId?: number | null) {
  try {
    return await prisma.$transaction(async (tx) => {
      await validarGrupo(tx, input.grupoId);
      const categoria = await tx.categoria.create({ data: input });
      await auditar(tx, { entidade: "Categoria", entidadeId: categoria.id, acao: "CRIADA", usuarioId, depois: categoria });
      return categoria;
    });
  } catch (erro) { traduzirConflitoUnico(erro, { nome: "Já existe uma categoria com este nome" }); }
}

export async function atualizarCategoria(id: string, input: z.infer<typeof patchCategoriaCadastroSchema>, usuarioId?: number | null) {
  try {
    return await prisma.$transaction(async (tx) => {
      const anterior = await tx.categoria.findUnique({ where: { id } });
      if (!anterior) throw new FinanceiroError("NAO_ENCONTRADO", "Categoria não encontrada");
      await validarGrupo(tx, input.grupoId, anterior.grupoId);
      const categoria = await tx.categoria.update({ where: { id }, data: input });
      await auditar(tx, { entidade: "Categoria", entidadeId: id, acao: "ATUALIZADA", usuarioId, antes: anterior, depois: categoria });
      return categoria;
    });
  } catch (erro) { traduzirConflitoUnico(erro, { nome: "Já existe uma categoria com este nome" }); }
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

export async function atualizarCentroCusto(id: string, input: z.infer<typeof patchCentroCustoSchema>, usuarioId?: number | null) {
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
