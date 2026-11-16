import { z } from "zod";
import { prisma } from "../../../db.js";
import { transacaoPecuaria } from "../transacao.js";
import { auditar, RebanhoError } from "../rebanho/regras.js";
import { operacaoIdempotenteTx } from "./operacoes.js";
export const regraImpactoProcedimentoSchema = z
  .object({
    chave: z.string().uuid(),
    propriedadeId: z.number().int().positive(),
    tipoAplicacaoId: z.string().uuid(),
    finalidade: z.enum(["PROTOCOLO", "IATF", "TETF", "PRE_SINCRONIZACAO"]),
    efeito: z.enum(["AVISAR", "BLOQUEAR", "RETIRAR"]),
    motivo: z.string().trim().min(5).max(1000),
    ativo: z.boolean(),
  })
  .strict();
export const revisarImpactoProcedimentoSchema = regraImpactoProcedimentoSchema
  .extend({ versaoEsperada: z.number().int().positive() })
  .strict();
export function listarRegrasImpactoProcedimento(propriedadeId: number) {
  return prisma.regraImpactoProcedimentoReprodutivo.findMany({
    where: { propriedadeId },
    orderBy: [{ ativo: "desc" }, { atualizadoEm: "desc" }, { id: "asc" }],
  });
}
export function criarRegraImpactoProcedimento(
  entrada: unknown,
  usuarioId: number,
) {
  const input = regraImpactoProcedimentoSchema.parse(entrada);
  return transacaoPecuaria((tx) =>
    operacaoIdempotenteTx(
      tx,
      input,
      usuarioId,
      "REGRA_IMPACTO_PROCEDIMENTO",
      async () => {
        const tipo = await tx.tipoAplicacaoSanitaria.findFirst({
          where: { id: input.tipoAplicacaoId, ativo: true },
          select: { id: true },
        });
        if (!tipo)
          throw new RebanhoError(
            "VALIDACAO",
            "Selecione classificação de procedimento ativa",
            "tipoAplicacaoId",
          );
        const existente =
          await tx.regraImpactoProcedimentoReprodutivo.findUnique({
            where: {
              propriedadeId_tipoAplicacaoId_finalidade: {
                propriedadeId: input.propriedadeId,
                tipoAplicacaoId: input.tipoAplicacaoId,
                finalidade: input.finalidade,
              },
            },
          });
        if (existente)
          throw new RebanhoError(
            "CONFLITO",
            "Já existe uma regra para este procedimento, sítio e finalidade; revise a regra existente",
          );
        const { chave, ...dados } = input;
        const criada = await tx.regraImpactoProcedimentoReprodutivo.create({
          data: {
            ...dados,
            criadoPorId: usuarioId,
            atualizadoPorId: usuarioId,
          },
        });
        await auditar(tx, {
          entidade: "RegraImpactoProcedimentoReprodutivo",
          entidadeId: criada.id,
          propriedadeId: input.propriedadeId,
          usuarioId,
          acao: "REGISTRO",
          depois: criada,
        });
        return criada;
      },
    ),
  );
}
export function revisarRegraImpactoProcedimento(
  id: string,
  entrada: unknown,
  usuarioId: number,
) {
  const input = revisarImpactoProcedimentoSchema.parse(entrada);
  return transacaoPecuaria(async (tx) => {
    await tx.$queryRaw`SELECT id FROM pecuaria."RegraImpactoProcedimentoReprodutivo" WHERE id=${id} FOR UPDATE`;
    return operacaoIdempotenteTx(
      tx,
      { ...input, id },
      usuarioId,
      "REVISAO_IMPACTO_PROCEDIMENTO",
      async () => {
        const antes = await tx.regraImpactoProcedimentoReprodutivo.findFirst({
          where: { id, propriedadeId: input.propriedadeId },
        });
        if (!antes)
          throw new RebanhoError(
            "NAO_ENCONTRADO",
            "Regra de procedimento não encontrada neste sítio",
          );
        if (antes.versao !== input.versaoEsperada)
          throw new RebanhoError(
            "CONFLITO",
            "A regra mudou; confira novamente antes de salvar",
          );
        if (
          input.ativo &&
          !(await tx.tipoAplicacaoSanitaria.findFirst({
            where: { id: input.tipoAplicacaoId, ativo: true },
            select: { id: true },
          }))
        )
          throw new RebanhoError(
            "VALIDACAO",
            "Selecione classificação de procedimento ativa",
            "tipoAplicacaoId",
          );
        const { chave, versaoEsperada, ...dados } = input;
        const depois = await tx.regraImpactoProcedimentoReprodutivo.update({
          where: { id },
          data: {
            ...dados,
            versao: { increment: 1 },
            atualizadoPorId: usuarioId,
          },
        });
        await auditar(tx, {
          entidade: "RegraImpactoProcedimentoReprodutivo",
          entidadeId: id,
          propriedadeId: input.propriedadeId,
          usuarioId,
          acao: "REVISAO",
          antes,
          depois,
        });
        return depois;
      },
    );
  });
}
