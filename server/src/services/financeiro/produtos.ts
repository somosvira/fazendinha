import type { z } from "zod";
import { prisma } from "../../db.js";
import { papeisDoParceiro } from "./papeis.js";
import { auditar, FinanceiroError, traduzirConflitoUnico, type DbFinanceiro } from "./regras.js";
import type { patchProdutoFinanceiroSchema, produtoFinanceiroSchema } from "./schemas.js";

const includeProduto = {
  fornecedores: {
    include: { fornecedor: { include: { papeis: true } } },
    orderBy: { fornecedor: { nome: "asc" as const } },
  },
} as const;

function produtoDTO(produto: any) {
  return {
    id: produto.id, nome: produto.nome, tipo: produto.tipo, unidade: produto.unidade,
    custoUnitario: produto.custoUnitario?.toString() ?? null,
    estocavel: produto.estocavel, minimoEstoque: produto.minimoEstoque?.toString() ?? null,
    categoriaId: produto.categoriaId, centroCustoId: produto.centroCustoId, ativo: produto.ativo,
    fornecedores: produto.fornecedores.map(({ fornecedor }: any) => ({
      id: fornecedor.id, nome: fornecedor.nome, ativo: fornecedor.ativo,
    })),
  };
}

export async function listarProdutosCadastro() {
  return (await prisma.produto.findMany({ include: includeProduto, orderBy: [{ ativo: "desc" }, { nome: "asc" }] })).map(produtoDTO);
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

function separarFornecedores<T extends { fornecedorIds?: number[] }>(input: T) {
  const { fornecedorIds, ...produto } = input;
  return { fornecedorIds, produto };
}

export async function criarProduto(input: z.infer<typeof produtoFinanceiroSchema>, usuarioId?: number | null) {
  try {
    return await prisma.$transaction(async (tx) => {
      const { fornecedorIds = [], produto } = separarFornecedores(input);
      await validarFornecedores(tx, fornecedorIds, new Set());
      const criado = await tx.produto.create({
        data: { ...produto, fornecedores: { create: fornecedorIds.map((fornecedorId) => ({ fornecedorId })) } },
        include: includeProduto,
      });
      const dto = produtoDTO(criado);
      await auditar(tx, { entidade: "Produto", entidadeId: criado.id, acao: "CRIADO", usuarioId, depois: dto });
      return dto;
    });
  } catch (erro) { traduzirConflitoUnico(erro, { nome: "Já existe um produto com este nome" }); }
}

export async function atualizarProduto(id: number, input: z.infer<typeof patchProdutoFinanceiroSchema>, usuarioId?: number | null) {
  try {
    return await prisma.$transaction(async (tx) => {
      const anterior = await tx.produto.findUnique({ where: { id }, include: includeProduto });
      if (!anterior) throw new FinanceiroError("NAO_ENCONTRADO", "Produto não encontrado");
      const { fornecedorIds, produto } = separarFornecedores(input);
      if (fornecedorIds !== undefined) {
        await validarFornecedores(tx, fornecedorIds, new Set(anterior.fornecedores.map((v) => v.fornecedorId)));
      }
      const atualizado = await tx.produto.update({
        where: { id },
        data: {
          ...produto,
          ...(fornecedorIds === undefined ? {} : {
            fornecedores: { deleteMany: {}, create: fornecedorIds.map((fornecedorId) => ({ fornecedorId })) },
          }),
        },
        include: includeProduto,
      });
      const antes = produtoDTO(anterior); const depois = produtoDTO(atualizado);
      await auditar(tx, { entidade: "Produto", entidadeId: id, acao: "ATUALIZADO", usuarioId, antes, depois });
      return depois;
    });
  } catch (erro) { traduzirConflitoUnico(erro, { nome: "Já existe um produto com este nome" }); }
}
