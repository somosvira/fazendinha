import { prisma } from "../../db.js";
import { z } from "zod";
import { entityIdSchema } from "@fazendinha/shared";

export class CadastroError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "DUPLICADO", message: string) {
    super(message);
  }
}

// Limites compatíveis com Produto.custoUnitario / minimoEstoque (Decimal(12,2))
const MAX_PRODUTO_VALOR = 9_999_999_999.99;

// Setor operacional do produto (dimensão separada da categoria contábil).
export const SETORES_ESTOQUE = ["LEITE", "CAFE", "CORTE", "MILHO", "GERAL"] as const;

export const produtoSchema = z.object({
  nome: z.string().min(1).max(80),
  tipo: z.enum(["MEDICAMENTO", "RACAO", "INSUMO", "MINERAL", "OUTRO"]),
  unidade: z.string().min(1).max(12).default("un"),
  custoUnitario: z.number().nonnegative().max(MAX_PRODUTO_VALOR, "custo muito alto").optional(),
  carencia: z.number().int().nonnegative().max(9999, "carência muito alta").optional(),
  percentualMS: z.number().min(0).max(100).optional(),
  estocavel: z.boolean().optional(),
  minimoEstoque: z.number().nonnegative().max(MAX_PRODUTO_VALOR, "estoque mínimo muito alto").optional(),
  ativo: z.boolean().optional(),
  // Setor operacional (atividade). Nullable/opcional — sem setor = GERAL na exibição.
  setor: z.enum(SETORES_ESTOQUE).nullable().optional(),
  // Mapeamento contábil (ponte com o financeiro). Nullable para permitir desvincular.
  categoriaId: entityIdSchema.nullable().optional(),
  centroCustoId: entityIdSchema.nullable().optional(),
});
export type ProdutoInput = z.infer<typeof produtoSchema>;

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
export async function editarProduto(id: number, input: Partial<ProdutoInput>) {
  if (!(await prisma.produto.findUnique({ where: { id } }))) throw new CadastroError("NAO_ENCONTRADO", "produto não encontrado");
  return produtoDTO(await prisma.produto.update({ where: { id }, data: input, include: produtoInclude }));
}

export const fornecedorSchema = z.object({
  id: entityIdSchema.optional(),
  nome: z.string().min(1).max(120),
  documento: z.string().max(20).optional(),
  tipo: z.enum(["CLIENTE", "FORNECEDOR", "AMBOS"]).optional(),
  telefone: z.string().max(20).optional(),
  email: z.string().email().max(120).optional().or(z.literal("")),
  ativo: z.boolean().optional(),
});
export type FornecedorInput = z.infer<typeof fornecedorSchema>;

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
