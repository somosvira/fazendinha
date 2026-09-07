import { prisma } from "../../db.js";
import { auditar, FinanceiroError } from "./regras.js";

export async function listarParceiros(incluirInativos = false) {
  return prisma.parceiro.findMany({ where: incluirInativos ? {} : { ativo: true }, orderBy: { nome: "asc" } });
}

export async function criarParceiro(input: {
  nome: string; documento?: string | null; tipo: "CLIENTE" | "FORNECEDOR" | "AMBOS" | "FUNCIONARIO" | "PROPRIETARIO" | "OUTRO";
  telefone?: string | null; email?: string | null; usuarioId?: number | null;
}) {
  return prisma.$transaction(async (tx) => {
    const { usuarioId, ...dados } = input;
    const parceiro = await tx.parceiro.create({ data: dados });
    await auditar(tx, { entidade: "Parceiro", entidadeId: parceiro.id, acao: "CRIADO", usuarioId, depois: parceiro });
    return parceiro;
  });
}

export async function atualizarParceiro(id: number, input: Record<string, unknown>, usuarioId?: number | null) {
  return prisma.$transaction(async (tx) => {
    const anterior = await tx.parceiro.findUnique({ where: { id } });
    if (!anterior) throw new FinanceiroError("NAO_ENCONTRADO", "Parceiro não encontrado");
    const parceiro = await tx.parceiro.update({ where: { id }, data: input });
    await auditar(tx, { entidade: "Parceiro", entidadeId: id, acao: "ATUALIZADO", usuarioId, antes: anterior, depois: parceiro });
    return parceiro;
  });
}
