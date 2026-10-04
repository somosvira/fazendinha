import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../../db.js";
import { getStorage } from "../../lib/storage.js";
import { confirmarRascunhoOperacao } from "./operacoes.js";
import { auditar, FinanceiroError } from "./regras.js";
import { operacaoSchema, type rascunhoOperacaoSchema } from "./schemas.js";
import { includeOperacaoConfirmada } from "./idempotencia.js";

type SalvarRascunhoInput = z.infer<typeof rascunhoOperacaoSchema> & {
  propriedadeId: number;
  usuarioId: number;
};

export const documentoRascunhoPublico = {
  id: true, tipo: true, nome: true, numero: true, mimeType: true,
  tamanhoBytes: true, createdAt: true,
} as const;

function chave(propriedadeId: number, usuarioId: number) {
  return { propriedadeId_criadoPorId: { propriedadeId, criadoPorId: usuarioId } };
}

export function obterRascunho(propriedadeId: number, usuarioId: number) {
  return prisma.rascunhoOperacao.findUnique({
    where: chave(propriedadeId, usuarioId),
    include: { documentos: { select: documentoRascunhoPublico, orderBy: { createdAt: "asc" } } },
  });
}

export async function salvarRascunho(input: SalvarRascunhoInput) {
  const where = chave(input.propriedadeId, input.usuarioId);
  const atual = await prisma.rascunhoOperacao.findUnique({ where, select: { versao: true } });
  if (atual && input.versao !== undefined && atual.versao !== input.versao) {
    throw new FinanceiroError("CONFLITO", "O rascunho foi atualizado em outra sessão. Recarregue a página antes de continuar.");
  }
  return prisma.rascunhoOperacao.upsert({
    where,
    create: {
      propriedadeId: input.propriedadeId,
      criadoPorId: input.usuarioId,
      dados: input.dados as Prisma.InputJsonObject,
    },
    update: {
      dados: input.dados as Prisma.InputJsonObject,
      versao: { increment: 1 },
    },
    include: { documentos: { select: documentoRascunhoPublico, orderBy: { createdAt: "asc" } } },
  });
}

export async function descartarRascunho(propriedadeId: number, usuarioId: number) {
  const atual = await prisma.rascunhoOperacao.findUnique({
    where: chave(propriedadeId, usuarioId),
    include: { documentos: { select: { storageKey: true } } },
  });
  if (!atual) return null;
  const removido = await prisma.rascunhoOperacao.delete({ where: { id: atual.id } });
  const storage = await getStorage();
  await Promise.allSettled(atual.documentos.flatMap((documento) => documento.storageKey ? [storage.deleteObject({ key: documento.storageKey })] : []));
  return removido;
}

export async function confirmarRascunho(propriedadeId: number, usuarioId: number, versao?: number, chaveReenvio?: string) {
  return prisma.$transaction(async (tx) => {
    if (chaveReenvio) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fin-rascunho-confirmacao:${chaveReenvio}`}))`;
      const anterior = await tx.auditoriaFinanceira.findFirst({ where: { acao: "CONFIRMACAO_RASCUNHO_IDEMPOTENTE", estadoPosterior: { path: ["chave"], equals: chaveReenvio } } });
      if (anterior) {
        const resultado = anterior.estadoPosterior as { propriedadeId: number; versao: number | null };
        if (anterior.usuarioId !== usuarioId || resultado.propriedadeId !== propriedadeId || resultado.versao !== (versao ?? null)) throw new FinanceiroError("CONFLITO", "Chave de reenvio usada com outros dados");
        const atual = await tx.rascunhoOperacao.findUnique({ where: chave(propriedadeId, usuarioId) });
        if (atual) throw new FinanceiroError("CONFLITO", "Já existe uma confirmação com esta chave. Confira o histórico antes de confirmar o novo rascunho.");
        return tx.operacao.findUniqueOrThrow({ where: { id: anterior.entidadeId }, include: includeOperacaoConfirmada });
      }
    }
    const rascunho = await tx.rascunhoOperacao.findUnique({
      where: chave(propriedadeId, usuarioId),
      include: { documentos: true },
    });
    if (!rascunho) throw new FinanceiroError("NAO_ENCONTRADO", "Rascunho não encontrado");
    if (versao !== undefined && rascunho.versao !== versao) {
      throw new FinanceiroError("CONFLITO", "Existem alterações mais recentes neste rascunho. Recarregue a página antes de confirmar.");
    }
    const conteudo = rascunho.dados as { operacao?: unknown };
    const validacao = operacaoSchema.safeParse(conteudo.operacao);
    if (!validacao.success) {
      throw new FinanceiroError("VALIDACAO", validacao.error.issues[0]?.message ?? "Preencha todos os campos obrigatórios");
    }
    const operacao = await confirmarRascunhoOperacao(tx, { ...validacao.data, ...(chaveReenvio ? { chave: chaveReenvio } : {}), propriedadeId, usuarioId });
    await tx.documentoFinanceiro.updateMany({
      where: { rascunhoId: rascunho.id },
      data: { rascunhoId: null, operacaoId: operacao.id },
    });
    await tx.rascunhoOperacao.delete({ where: { id: rascunho.id } });
    if (chaveReenvio) await auditar(tx, { entidade: "Operacao", entidadeId: operacao.id, acao: "CONFIRMACAO_RASCUNHO_IDEMPOTENTE", usuarioId,
      depois: { chave: chaveReenvio, propriedadeId, versao: versao ?? null } });
    return tx.operacao.findUniqueOrThrow({
      where: { id: operacao.id },
      include: {
        parceiro: true, itens: true, compromissos: true,
        transacoes: { include: { movimentos: true } }, movimentosEstoque: true,
        documentos: { select: documentoRascunhoPublico },
      },
    });
  });
}
