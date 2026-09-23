import { prisma } from "../../db.js";
import { z } from "zod";
import { papeisDoParceiro, papeisLegados } from "../financeiro/papeis.js";

export class CadastroError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "DUPLICADO", message: string) {
    super(message);
  }
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
  return (await prisma.parceiro.findMany({ where, orderBy: { nome: "asc" } })).map(fornDTO);
}
export async function criarFornecedor(input: FornecedorInput) {
  if (await prisma.parceiro.findFirst({ where: { nome: input.nome } })) throw new CadastroError("DUPLICADO", `${input.nome} já existe`);
  const tipo = input.tipo ?? "FORNECEDOR";
  return fornDTO(await prisma.parceiro.create({ data: { ...input, tipo, email: input.email || null, papeis: { create: papeisLegados(tipo).map((papel) => ({ papel })) } } }));
}
export async function editarFornecedor(id: number, input: Partial<FornecedorInput>) {
  return prisma.$transaction(async (tx) => {
    const anterior = await tx.parceiro.findUnique({ where: { id }, include: { papeis: true } });
    if (!anterior) throw new CadastroError("NAO_ENCONTRADO", "fornecedor não encontrado");
    // A tela legada edita somente os papéis comerciais, sem apagar prestador/sócio.
    const papeis = input.tipo && input.tipo !== anterior.tipo
      ? [...papeisDoParceiro(anterior).filter((p) => p !== "CLIENTE" && p !== "FORNECEDOR"), ...papeisLegados(input.tipo)]
      : null;
    return fornDTO(await tx.parceiro.update({ where: { id }, data: {
      ...input, email: input.email === "" ? null : input.email,
      ...(papeis ? { papeis: { deleteMany: {}, create: papeis.map((papel) => ({ papel })) } } : {}),
    } }));
  });
}
