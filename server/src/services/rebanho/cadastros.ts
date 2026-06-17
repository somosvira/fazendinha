import { prisma } from "../../db.js";
import { z } from "zod";

export class CadastroError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "DUPLICADO", message: string) {
    super(message);
  }
}

export const produtoSchema = z.object({
  nome: z.string().min(1).max(80),
  tipo: z.enum(["MEDICAMENTO", "RACAO", "INSUMO", "MINERAL", "OUTRO"]),
  unidade: z.string().min(1).max(12).default("un"),
  custoUnitario: z.number().nonnegative().optional(),
  carencia: z.number().int().nonnegative().optional(),
  percentualMS: z.number().min(0).max(100).optional(),
  estocavel: z.boolean().optional(),
  minimoEstoque: z.number().nonnegative().optional(),
  ativo: z.boolean().optional(),
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
});

export async function listarProdutos(f?: { tipo?: string; q?: string; ativo?: boolean }) {
  const where: any = {};
  if (f?.tipo) where.tipo = f.tipo;
  if (f?.ativo != null) where.ativo = f.ativo;
  if (f?.q) where.nome = { contains: f.q, mode: "insensitive" };
  return (await prisma.produto.findMany({ where, orderBy: { nome: "asc" } })).map(produtoDTO);
}
export async function criarProduto(input: ProdutoInput) {
  if (await prisma.produto.findUnique({ where: { nome: input.nome } })) throw new CadastroError("DUPLICADO", `produto ${input.nome} já existe`);
  return produtoDTO(await prisma.produto.create({ data: input }));
}
export async function editarProduto(id: number, input: Partial<ProdutoInput>) {
  if (!(await prisma.produto.findUnique({ where: { id } }))) throw new CadastroError("NAO_ENCONTRADO", "produto não encontrado");
  return produtoDTO(await prisma.produto.update({ where: { id }, data: input }));
}

export const fornecedorSchema = z.object({
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
  return (await prisma.clienteFornecedor.findMany({ where, orderBy: { nome: "asc" } })).map(fornDTO);
}
export async function criarFornecedor(input: FornecedorInput) {
  if (await prisma.clienteFornecedor.findUnique({ where: { nome: input.nome } })) throw new CadastroError("DUPLICADO", `${input.nome} já existe`);
  return fornDTO(await prisma.clienteFornecedor.create({ data: { ...input, email: input.email || null } }));
}
export async function editarFornecedor(id: number, input: Partial<FornecedorInput>) {
  if (!(await prisma.clienteFornecedor.findUnique({ where: { id } }))) throw new CadastroError("NAO_ENCONTRADO", "fornecedor não encontrado");
  return fornDTO(await prisma.clienteFornecedor.update({ where: { id }, data: { ...input, email: input.email === "" ? null : input.email } }));
}
