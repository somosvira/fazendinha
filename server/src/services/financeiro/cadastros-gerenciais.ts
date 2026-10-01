import type { z } from "zod";
import { prisma } from "../../db.js";
import { auditar, FinanceiroError, traduzirConflitoUnico } from "./regras.js";
import type {
  categoriaCadastroSchema,
  centroCustoSchema,
  patchCategoriaCadastroSchema,
  patchCentroCustoSchema,
} from "./schemas.js";

const includeCentro = { _count: { select: { operacoes: true, produtos: true, safras: true } } };

export async function listarCadastrosGerenciais() {
  const [categorias, centrosCusto] = await Promise.all([
    prisma.categoria.findMany({ include: { _count: { select: { operacoes: true, produtos: true, itens: true } } }, orderBy: [{ ativo: "desc" }, { ordem: "asc" }, { nome: "asc" }] }),
    prisma.centroCusto.findMany({ include: includeCentro, orderBy: [{ ativo: "desc" }, { ordem: "asc" }, { nome: "asc" }] }),
  ]);
  return { categorias, centrosCusto };
}

export async function criarCategoria(input: z.infer<typeof categoriaCadastroSchema>, usuarioId?: number | null) {
  try {
    return await prisma.$transaction(async (tx) => {
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
      if (input.usoSanitario === false && anterior.usoSanitario) {
        const exigido = await tx.produto.findFirst({ where: { categoriaId: id, perfilSanitarioProduto: { isNot: null } }, select: { nome: true } });
        if (exigido) throw new FinanceiroError("CONFLITO", `Uso sanitário exigido pelo perfil de ${exigido.nome}`, "usoSanitario");
      }
      if (input.usoNutricional === false && anterior.usoNutricional) {
        const exigido = await tx.produto.findFirst({ where: { categoriaId: id, OR: [{ perfilNutricionalProduto: { isNot: null } }, { itemDietas: { some: {} } }] }, select: { nome: true } });
        if (exigido) throw new FinanceiroError("CONFLITO", `Uso nutricional exigido por perfil/receita de ${exigido.nome}`, "usoNutricional");
      }
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
