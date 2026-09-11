import type { z } from "zod";
import { prisma } from "../../db.js";
import { auditar, FinanceiroError, traduzirConflitoUnico } from "./regras.js";
import type { parceiroSchema, patchParceiroSchema } from "./schemas.js";

const CONFLITOS = { documento: "Já existe um parceiro com este CPF/CNPJ" };

type ContagensParceiro = { operacoes: number; compromissos: number; transacoes: number };

const totalReferencias = (contagens: ContagensParceiro) => contagens.operacoes + contagens.compromissos + contagens.transacoes;

function comReferencias<T>(parceiro: T, contagens: ContagensParceiro) {
  return { ...parceiro, referencias: totalReferencias(contagens) };
}

/* `referencias` = operações + compromissos + transações ligadas ao parceiro;
 * a UI usa para explicar o impacto de desativar. */
export async function listarParceiros(incluirInativos = false) {
  const lista = await prisma.parceiro.findMany({
    where: incluirInativos ? {} : { ativo: true },
    orderBy: { nome: "asc" },
    include: { _count: { select: { operacoes: true, compromissos: true, transacoes: true } } },
  });
  return lista.map(({ _count, ...parceiro }) => comReferencias(parceiro, _count));
}

export async function criarParceiro(input: z.infer<typeof parceiroSchema> & { usuarioId?: number | null }) {
  try {
    return await prisma.$transaction(async (tx) => {
      const { usuarioId, ...dados } = input;
      const parceiro = await tx.parceiro.create({ data: dados });
      await auditar(tx, { entidade: "Parceiro", entidadeId: parceiro.id, acao: "CRIADO", usuarioId, depois: parceiro });
      return { ...parceiro, referencias: 0 };
    });
  } catch (e) { traduzirConflitoUnico(e, CONFLITOS); }
}

export async function atualizarParceiro(id: number, input: z.infer<typeof patchParceiroSchema>, usuarioId?: number | null) {
  try {
    return await prisma.$transaction(async (tx) => {
      const encontrado = await tx.parceiro.findUnique({
        where: { id },
        include: { _count: { select: { operacoes: true, compromissos: true, transacoes: true } } },
      });
      if (!encontrado) throw new FinanceiroError("NAO_ENCONTRADO", "Parceiro não encontrado");
      const { _count, ...anterior } = encontrado;
      const parceiro = await tx.parceiro.update({ where: { id }, data: input });
      await auditar(tx, { entidade: "Parceiro", entidadeId: id, acao: "ATUALIZADO", usuarioId, antes: anterior, depois: parceiro });
      return comReferencias(parceiro, _count);
    });
  } catch (e) { traduzirConflitoUnico(e, CONFLITOS); }
}
