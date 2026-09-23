import type { Prisma, TipoProduto } from "@prisma/client";
import { prisma } from "../../db.js";
import { papeisDoParceiro } from "../financeiro/papeis.js";
import { auditar, FinanceiroError, traduzirConflitoUnico, type DbFinanceiro } from "../financeiro/regras.js";
import type { ProdutoInput, ProdutoPatchInput } from "./produtos.schemas.js";

export const includeProduto = {
  fornecedores: {
    include: { fornecedor: { include: { papeis: true } } },
    orderBy: { fornecedor: { nome: "asc" as const } },
  },
  centrosCusto: { include: { centroCusto: true }, orderBy: { centroCusto: { nome: "asc" as const } } },
  categoria: true,
} as const;

export function produtoDTO(produto: Prisma.ProdutoGetPayload<{ include: typeof includeProduto }>) {
  return {
    id: produto.id,
    nome: produto.nome,
    tipo: produto.tipo,
    subtipoPlantio: produto.subtipoPlantio ?? null,
    unidade: produto.unidade,
    custoUnitario: produto.custoUnitario != null ? produto.custoUnitario.toString() : null,
    carencia: produto.carencia ?? null,
    percentualMS: produto.percentualMS != null ? produto.percentualMS.toString() : null,
    estocavel: produto.estocavel,
    minimoEstoque: produto.minimoEstoque != null ? produto.minimoEstoque.toString() : null,
    categoriaId: produto.categoriaId ?? null,
    categoriaNome: produto.categoria?.nome ?? null,
    classificacao: produto.categoria?.classificacao ?? null,
    ativo: produto.ativo,
    centroCustoIds: produto.centrosCusto.map(({ centroCustoId }) => centroCustoId),
    centrosCusto: produto.centrosCusto.map(({ centroCusto }) => ({ id: centroCusto.id, nome: centroCusto.nome, ativo: centroCusto.ativo })),
    fornecedores: produto.fornecedores.map(({ fornecedor }) => ({ id: fornecedor.id, nome: fornecedor.nome, ativo: fornecedor.ativo })),
  };
}

async function validarFornecedores(db: DbFinanceiro, fornecedorIds: number[], permitidosInativos: Set<number>) {
  if (!fornecedorIds.length) return;
  const fornecedores = await db.parceiro.findMany({ where: { id: { in: fornecedorIds } }, include: { papeis: true } });
  const validos = new Set(fornecedores.filter((p) =>
    (p.ativo || permitidosInativos.has(p.id)) && papeisDoParceiro(p).includes("FORNECEDOR")
  ).map((p) => p.id));
  if (fornecedorIds.some((id) => !validos.has(id))) {
    throw new FinanceiroError("VALIDACAO", "Selecione somente parceiros ativos com papel de fornecedor", "fornecedorIds");
  }
}

async function validarCentrosCusto(db: DbFinanceiro, centroCustoIds: number[], permitidosInativos: Set<number>) {
  if (!centroCustoIds.length) return;
  const centros = await db.centroCusto.findMany({ where: { id: { in: centroCustoIds } } });
  const validos = new Set(centros.filter((c) => c.ativo || permitidosInativos.has(c.id)).map((c) => c.id));
  if (centroCustoIds.some((id) => !validos.has(id))) {
    throw new FinanceiroError("VALIDACAO", "Selecione somente centros de custo ativos", "centroCustoIds");
  }
}

function separarRelacoes<T extends { fornecedorIds?: number[]; centroCustoIds?: number[] }>(input: T) {
  const { fornecedorIds, centroCustoIds, ...produto } = input;
  return { fornecedorIds, centroCustoIds, produto };
}

export async function listarProdutos(f?: { tipo?: string; q?: string; ativo?: boolean; incluirInativos?: boolean }) {
  const where: Prisma.ProdutoWhereInput = {};
  if (f?.tipo) where.tipo = f.tipo as TipoProduto;
  if (f?.q) where.nome = { contains: f.q, mode: "insensitive" };
  if (f?.ativo != null) where.ativo = f.ativo;
  else if (!f?.incluirInativos) where.ativo = true;
  return (await prisma.produto.findMany({ where, orderBy: [{ ativo: "desc" }, { nome: "asc" }], include: includeProduto })).map(produtoDTO);
}

export async function listarProdutosCadastro() {
  return (await prisma.produto.findMany({ include: includeProduto, orderBy: [{ ativo: "desc" }, { nome: "asc" }] })).map(produtoDTO);
}

export async function criarProduto(input: ProdutoInput, usuarioId?: number | null) {
  try {
    return await prisma.$transaction(async (tx) => {
      const { fornecedorIds = [], centroCustoIds = [], produto } = separarRelacoes(input);
      if (produto.estocavel && produto.categoriaId == null) {
        throw new FinanceiroError("VALIDACAO", "Produto estocável precisa de uma categoria", "categoriaId");
      }
      await validarFornecedores(tx, fornecedorIds, new Set());
      await validarCentrosCusto(tx, centroCustoIds, new Set());
      const criado = await tx.produto.create({
        data: {
          ...produto,
          fornecedores: { create: fornecedorIds.map((fornecedorId) => ({ fornecedorId })) },
          centrosCusto: { create: centroCustoIds.map((centroCustoId) => ({ centroCustoId })) },
        },
        include: includeProduto,
      });
      const dto = produtoDTO(criado);
      await auditar(tx, { entidade: "Produto", entidadeId: criado.id, acao: "CRIADO", usuarioId, depois: dto });
      return dto;
    });
  } catch (erro) { traduzirConflitoUnico(erro, { nome: "Já existe um produto com este nome" }); }
}

export async function atualizarProduto(id: number, input: ProdutoPatchInput, usuarioId?: number | null) {
  try {
    return await prisma.$transaction(async (tx) => {
      const anterior = await tx.produto.findUnique({ where: { id }, include: includeProduto });
      if (!anterior) throw new FinanceiroError("NAO_ENCONTRADO", "Produto não encontrado");
      const { fornecedorIds, centroCustoIds, produto } = separarRelacoes(input);

      const estocavel = produto.estocavel ?? anterior.estocavel;
      const categoriaId = produto.categoriaId !== undefined ? produto.categoriaId : anterior.categoriaId;
      if (estocavel && categoriaId == null) {
        throw new FinanceiroError("VALIDACAO", "Produto estocável precisa de uma categoria", "categoriaId");
      }

      if (fornecedorIds !== undefined) {
        await validarFornecedores(tx, fornecedorIds, new Set(anterior.fornecedores.map((v) => v.fornecedorId)));
      }
      if (centroCustoIds !== undefined) {
        await validarCentrosCusto(tx, centroCustoIds, new Set(anterior.centrosCusto.map((v) => v.centroCustoId)));
      }

      const atualizado = await tx.produto.update({
        where: { id },
        data: {
          ...produto,
          ...(fornecedorIds === undefined ? {} : {
            fornecedores: { deleteMany: {}, create: fornecedorIds.map((fornecedorId) => ({ fornecedorId })) },
          }),
          ...(centroCustoIds === undefined ? {} : {
            centrosCusto: { deleteMany: {}, create: centroCustoIds.map((centroCustoId) => ({ centroCustoId })) },
          }),
        },
        include: includeProduto,
      });
      const antes = produtoDTO(anterior);
      const depois = produtoDTO(atualizado);
      await auditar(tx, { entidade: "Produto", entidadeId: id, acao: "ATUALIZADO", usuarioId, antes, depois });
      return depois;
    });
  } catch (erro) { traduzirConflitoUnico(erro, { nome: "Já existe um produto com este nome" }); }
}
