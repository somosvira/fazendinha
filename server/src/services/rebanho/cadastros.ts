import { prisma } from "../../db.js";
import {
  fornecedorEstoqueSchema,
  produtoEstoqueSchema,
  type FornecedorEstoqueInput,
  type ProdutoEstoqueInput,
} from "@fazendinha/shared";

export class CadastroError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "DUPLICADO", message: string) {
    super(message);
  }
}

// Setor operacional do produto (dimensão separada da categoria contábil).
export const SETORES_ESTOQUE = ["LEITE", "CAFE", "CORTE", "MILHO", "GERAL"] as const;

export const produtoSchema = produtoEstoqueSchema;
export type ProdutoInput = ProdutoEstoqueInput;

const produtoDTO = (p: any) => ({
  id: p.id,
  nome: p.nome,
  tipo: p.tipo,
  unidade: p.unidade,
  custoUnitario: p.custoUnitario != null ? Number(p.custoUnitario) : null,
  carencia: p.carencia ?? null,
  percentualMS: p.percentualMS != null ? Number(p.percentualMS) : null,
  estocavel: p.estocavel,
  minimoEstoque: p.minimoEstoque != null ? Number(p.minimoEstoque) : null,
  ativo: p.ativo,
  setor: p.setor ?? null,
  categoriaId: p.categoriaId ?? null,
  centroCustoId: p.centroCustoId ?? null,
  categoriaNome: p.categoria?.nome ?? null,
  centroCustoNome: p.centroCusto?.nome ?? null,
});

const produtoInclude = { categoria: true, centroCusto: true } as const;

export async function listarProdutos(f?: { tipo?: string; q?: string; ativo?: boolean }) {
  const where: any = {};
  if (f?.tipo) where.tipo = f.tipo;
  if (f?.ativo != null) where.ativo = f.ativo;
  if (f?.q) where.nome = { contains: f.q, mode: "insensitive" };
  return (await prisma.produto.findMany({ where, orderBy: { nome: "asc" }, include: produtoInclude })).map(produtoDTO);
}
export async function criarProduto(input: ProdutoInput) {
  if (await prisma.produto.findUnique({ where: { nome: input.nome } })) throw new CadastroError("DUPLICADO", `produto ${input.nome} já existe`);
  return produtoDTO(await prisma.produto.create({ data: input, include: produtoInclude }));
}
export async function editarProduto(id: string, input: Partial<ProdutoInput>) {
  if (!(await prisma.produto.findUnique({ where: { id } }))) throw new CadastroError("NAO_ENCONTRADO", "produto não encontrado");
  return produtoDTO(await prisma.produto.update({ where: { id }, data: input, include: produtoInclude }));
}

export const fornecedorSchema = fornecedorEstoqueSchema;
export type FornecedorInput = FornecedorEstoqueInput;

const fornDTO = (f: any) => ({
  id: f.id,
  nome: f.nome,
  documento: f.documento ?? null,
  tipo: f.tipo,
  telefone: f.telefone ?? null,
  email: f.email ?? null,
  ativo: f.ativo,
});

export async function listarFornecedores(f?: { tipo?: string; q?: string }) {
  const where: any = {};
  if (f?.tipo) where.tipo = f.tipo;
  if (f?.q) where.nome = { contains: f.q, mode: "insensitive" };
  return (await prisma.parceiro.findMany({ where, orderBy: { nome: "asc" } })).map(fornDTO);
}
export async function criarFornecedor(input: FornecedorInput) {
  if (await prisma.parceiro.findFirst({ where: { nome: input.nome } })) throw new CadastroError("DUPLICADO", `${input.nome} já existe`);
  return fornDTO(await prisma.parceiro.create({ data: { ...input, tipo: input.tipo ?? "FORNECEDOR", email: input.email || null } }));
}
export async function editarFornecedor(id: string, input: Partial<FornecedorInput>) {
  if (!(await prisma.parceiro.findUnique({ where: { id } }))) throw new CadastroError("NAO_ENCONTRADO", "fornecedor não encontrado");
  return fornDTO(await prisma.parceiro.update({ where: { id }, data: { ...input, email: input.email === "" ? null : input.email } }));
}
