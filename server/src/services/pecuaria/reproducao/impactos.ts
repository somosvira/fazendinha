import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { transacaoPecuaria } from "../transacao.js";
import { auditar, RebanhoError, travarAnimais } from "../rebanho/regras.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { filtroInsercoesRetirada } from "../protocolos/insercoes-retirada.js";
import { hashDados, operacaoIdempotenteTx } from "./operacoes.js";
import { reconciliarAlertasReprodutivosAnimalTx } from "./alertas/produtor.js";
import {
  previaImpactoSchema,
  regraImpactoProtocolarSchema,
  confirmacaoImpactoSchema,
  revisarImpactoSchema,
} from "./impactos.schemas.js";
import type { z } from "zod";
type Tx = Prisma.TransactionClient;
export type EntradaImpacto = z.infer<typeof previaImpactoSchema>;
export type ConfirmacaoImpacto = z.infer<typeof confirmacaoImpactoSchema>;
const json = (v: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(v));
/** Prévia não executa regra implícita: só extensões versionadas e explicitamente configuradas. */
export async function previaImpactosTx(tx: Tx, entrada: EntradaImpacto) {
  const input = previaImpactoSchema.parse(entrada);
  await conferirAnimalNoFato(
    tx,
    input.animalId,
    input.propriedadeId,
    new Date(input.data),
  );
  const [regras, participacoes, dispositivos] = await Promise.all([
    input.origem === "OCORRENCIA"
      ? tx.regraSanitariaReprodutiva
          .findMany({
            where: {
              propriedadeId: input.propriedadeId,
              ativo: true,
              doencaId: input.doencaId,
              impactoProtocolar: { not: Prisma.DbNull },
            },
            orderBy: { id: "asc" },
          })
          .then((regras) =>
            regras.map((r) => ({
              id: r.id,
              atualizadoEm: r.atualizadoEm,
              acao: r.acao,
              motivo: r.motivo,
              impactoProtocolar: r.impactoProtocolar,
              versao: null,
            })),
          )
      : tx.regraImpactoProcedimentoReprodutivo
          .findMany({
            where: {
              propriedadeId: input.propriedadeId,
              ativo: true,
              tipoAplicacaoId: input.tipoAplicacaoId,
            },
            orderBy: { id: "asc" },
          })
          .then((regras) =>
            regras.map((r) => ({
              id: r.id,
              atualizadoEm: r.atualizadoEm,
              acao: r.finalidade,
              motivo: r.motivo,
              versao: r.versao,
              impactoProtocolar: {
                versao: 1,
                gatilho: "PROCEDIMENTO",
                efeito: r.efeito,
                tipoAplicacaoId: r.tipoAplicacaoId,
              },
            })),
          ),
    tx.participacaoProtocolo.findMany({
      where: {
        animalId: input.animalId,
        propriedadeId: input.propriedadeId,
        canceladaEm: null,
        protocolo: { tipo: "REPRODUTIVO" },
        OR: [{ rodadaId: null }, { rodada: { status: "ABERTA" } }],
      },
      include: {
        protocolo: { select: { nome: true, versao: true, finalidade: true } },
        tarefas: {
          select: {
            id: true,
            nomeSnapshot: true,
            previstaPara: true,
            realizadaEm: true,
            dispensadaEm: true,
            regularizacaoPendente: true,
            momentoSnapshot: true,
            etapa: { select: { nome: true, tipo: true } },
          },
        },
        automacoes: {
          select: {
            id: true,
            estado: true,
            revisao: true,
            atualizadaEm: true,
            programadaPara: true,
          },
        },
      },
      orderBy: { id: "asc" },
    }),
    tx.aplicacaoProduto.findMany({
      where: filtroInsercoesRetirada(input.animalId),
      select: { id: true, data: true, tarefaId: true },
      orderBy: { id: "asc" },
    }),
  ]);
  const aplicaveis = regras.flatMap((r) => {
    const p = regraImpactoProtocolarSchema.safeParse(r.impactoProtocolar);
    if (
      !p.success ||
      p.data.gatilho !== input.origem ||
      (input.origem === "PROCEDIMENTO" &&
        p.data.tipoAplicacaoId !== input.tipoAplicacaoId)
    )
      return [];
    return [
      {
        id: r.id,
        versao: r.versao,
        origem: input.origem,
        atualizadoEm: r.atualizadoEm,
        acao: r.acao,
        motivo: r.motivo,
        regra: p.data,
      },
    ];
  });
  const itens = participacoes.flatMap((p) => {
    const regras = aplicaveis.filter(
      (r) =>
        r.acao === "PROTOCOLO" ||
        r.acao === p.protocolo.finalidade ||
        (r.acao === "IA" && p.protocolo.finalidade === "IATF") ||
        (r.acao === "TE" && p.protocolo.finalidade === "TETF"),
    );
    if (!regras.length) return [];
    const efeito = regras.some((r) => r.regra.efeito === "RETIRAR")
      ? "RETIRAR"
      : regras.some((r) => r.regra.efeito === "BLOQUEAR")
        ? "BLOQUEAR"
        : "AVISAR";
    return [
      {
        participacaoId: p.id,
        protocolo: p.protocolo,
        regras,
        efeito,
        tarefas: p.tarefas.filter((t) => !t.realizadaEm && !t.dispensadaEm),
        automacoes: p.automacoes.filter((j) =>
          ["AGENDADA", "FALHOU"].includes(j.estado),
        ),
        dispositivos: dispositivos.filter((d) =>
          p.tarefas.some((t) => t.id === d.tarefaId),
        ),
      },
    ];
  });
  return {
    versao: 1 as const,
    entrada: input,
    itens,
    dispositivos,
    exigeConfirmacao: itens.length > 0,
    revisao: hashDados({ input, aplicaveis, participacoes, dispositivos }),
  };
}
// Prisma.JsonNull é valor, não NULL SQL; regras sem configuração nunca participam.
export function preverImpactos(entrada: EntradaImpacto) {
  return transacaoPecuaria((tx) => previaImpactosTx(tx, entrada));
}
/** Mesmo lock do executor automático. Deve preceder qualquer escrita do fato e consumo. */
export async function conferirImpactosTx(
  tx: Tx,
  input: EntradaImpacto,
  confirmacao?: ConfirmacaoImpacto,
) {
  await travarAnimais(tx, [input.animalId]);
  const previa = await previaImpactosTx(tx, input);
  if (previa.exigeConfirmacao && !confirmacao)
    throw new RebanhoError(
      "CONFLITO",
      "Confira os impactos nos protocolos antes de registrar o fato",
      "impacto",
    );
  if (confirmacao) {
    const c = confirmacaoImpactoSchema.parse(confirmacao);
    if (c.revisao !== previa.revisao)
      throw new RebanhoError(
        "CONFLITO",
        "As participações, regras ou automações mudaram; confira novamente a prévia",
        "impacto",
      );
  }
  return previa;
}
/** Fato, efeitos e auditoria confirmam ou revertem juntos; dispositivo não é removido por esta decisão. */
export async function aplicarImpactosTx(
  tx: Tx,
  previa: Awaited<ReturnType<typeof previaImpactosTx>>,
  fato: { tipo: "OcorrenciaSanitaria" | "AplicacaoProduto"; id: string },
  confirmacao: ConfirmacaoImpacto | undefined,
  usuarioId: number | null,
) {
  for (const item of previa.itens) {
    if (!confirmacao)
      throw new RebanhoError(
        "CONFLITO",
        "Confirmação dos impactos obrigatória",
      );
    const snapshot = json({
      versao: 1,
      fato,
      regras: item.regras,
      revisaoPrevia: previa.revisao,
      motivo: confirmacao.motivo,
    });
    if (item.efeito === "RETIRAR") {
      await tx.participacaoProtocolo.update({
        where: { id: item.participacaoId },
        data: {
          canceladaEm: new Date(),
          motivoCancelamento: confirmacao.motivo,
          impactoSnapshot: snapshot,
        },
      });
      await tx.tarefaProtocolo.updateMany({
        where: {
          execucaoId: item.participacaoId,
          realizadaEm: null,
          dispensadaEm: null,
        },
        data: { dispensadaEm: new Date(), motivoDispensa: confirmacao.motivo },
      });
    } else if (item.efeito === "BLOQUEAR")
      await tx.participacaoProtocolo.update({
        where: { id: item.participacaoId },
        data: {
          bloqueadaEm: new Date(),
          motivoBloqueio: confirmacao.motivo,
          impactoSnapshot: snapshot,
        },
      });
    if (item.efeito !== "AVISAR")
      await tx.automacaoProtocolo.updateMany({
        where: {
          participacaoId: item.participacaoId,
          estado: { in: ["AGENDADA", "FALHOU"] },
        },
        data: {
          estado: "CANCELADA",
          erro: confirmacao.motivo,
          revisao: { increment: 1 },
        },
      });
    await auditar(tx, {
      entidade: "ParticipacaoProtocolo",
      entidadeId: item.participacaoId,
      animalId: previa.entrada.animalId,
      propriedadeId: previa.entrada.propriedadeId,
      usuarioId,
      acao: `IMPACTO_${item.efeito}`,
      depois: {
        ...item,
        fato,
        motivo: confirmacao.motivo,
        revisaoPrevia: previa.revisao,
      },
    });
  }
  await reconciliarAlertasReprodutivosAnimalTx(
    tx,
    previa.entrada.animalId,
    usuarioId,
  );
}
export function revisarImpactoParticipacao(
  id: string,
  entrada: unknown,
  usuarioId: number,
) {
  const input = revisarImpactoSchema.parse(entrada);
  return transacaoPecuaria(async (tx) => {
    const ref = await tx.participacaoProtocolo.findFirst({
      where: {
        id,
        propriedadeId: input.propriedadeId,
        protocolo: { tipo: "REPRODUTIVO" },
      },
    });
    if (!ref)
      throw new RebanhoError("NAO_ENCONTRADO", "Participação não encontrada");
    await travarAnimais(tx, [ref.animalId]);
    await conferirAnimalNoFato(
      tx,
      ref.animalId,
      input.propriedadeId,
      new Date(
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
        }).format(new Date()),
      ),
    );
    return operacaoIdempotenteTx(
      tx,
      { ...input, id },
      usuarioId,
      "REVISAO_IMPACTO_PROTOCOLO",
      async () => {
        const p = await tx.participacaoProtocolo.findUniqueOrThrow({
          where: { id },
        });
        if (
          !p.bloqueadaEm ||
          p.bloqueadaEm.toISOString() !== input.bloqueadaEm ||
          p.canceladaEm
        )
          throw new RebanhoError(
            "CONFLITO",
            "O bloqueio mudou; confira novamente",
          );
        const salva = await tx.participacaoProtocolo.update({
          where: { id },
          data: {
            bloqueadaEm: null,
            motivoBloqueio: null,
            ...(input.destino === "RETIRAR"
              ? { canceladaEm: new Date(), motivoCancelamento: input.motivo }
              : {}),
          },
        });
        if (input.destino === "RETIRAR")
          await tx.tarefaProtocolo.updateMany({
            where: { execucaoId: id, realizadaEm: null, dispensadaEm: null },
            data: { dispensadaEm: new Date(), motivoDispensa: input.motivo },
          });
        await auditar(tx, {
          entidade: "ParticipacaoProtocolo",
          entidadeId: id,
          animalId: p.animalId,
          propriedadeId: input.propriedadeId,
          usuarioId,
          acao: "REVISAO_IMPACTO",
          antes: p,
          depois: { ...salva, motivo: input.motivo, destino: input.destino },
        });
        await reconciliarAlertasReprodutivosAnimalTx(tx, p.animalId, usuarioId);
        return {
          id,
          bloqueadaEm: salva.bloqueadaEm,
          canceladaEm: salva.canceladaEm,
        };
      },
    );
  });
}
