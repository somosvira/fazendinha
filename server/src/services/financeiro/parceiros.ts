import type { z } from "zod";
import { prisma } from "../../db.js";
import { auditar, FinanceiroError, traduzirConflitoUnico } from "./regras.js";
import type { parceiroSchema, patchParceiroSchema } from "./schemas.js";

const CONFLITOS = { documento: "Já existe um parceiro com este CPF/CNPJ" };

/* `referencias` = operações + compromissos + transações ligadas ao parceiro;
 * a UI usa para explicar o impacto de desativar. */
export async function listarParceiros(incluirInativos = false) {
  const lista = await prisma.parceiro.findMany({
    where: incluirInativos ? {} : { ativo: true },
    orderBy: { nome: "asc" },
    include: { _count: { select: { operacoes: true, compromissos: true, transacoes: true } } },
  });
  return lista.map(({ _count, ...parceiro }) => ({ ...parceiro, referencias: _count.operacoes + _count.compromissos + _count.transacoes }));
}

export async function criarParceiro(input: z.infer<typeof parceiroSchema> & { usuarioId?: number | null }) {
  try {
    return await prisma.$transaction(async (tx) => {
      const { usuarioId, ...dados } = input;
      const parceiro = await tx.parceiro.create({ data: dados });
      await auditar(tx, { entidade: "Parceiro", entidadeId: parceiro.id, acao: "CRIADO", usuarioId, depois: parceiro });
      return parceiro;
    });
  } catch (e) { traduzirConflitoUnico(e, CONFLITOS); }
}

export async function atualizarParceiro(id: number, input: z.infer<typeof patchParceiroSchema>, usuarioId?: number | null) {
  try {
    return await prisma.$transaction(async (tx) => {
      const anterior = await tx.parceiro.findUnique({ where: { id } });
      if (!anterior) throw new FinanceiroError("NAO_ENCONTRADO", "Parceiro não encontrado");
      const parceiro = await tx.parceiro.update({ where: { id }, data: input });
      await auditar(tx, { entidade: "Parceiro", entidadeId: id, acao: "ATUALIZADO", usuarioId, antes: anterior, depois: parceiro });
      return parceiro;
    });
  } catch (e) { traduzirConflitoUnico(e, CONFLITOS); }
}
