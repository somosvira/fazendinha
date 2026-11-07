import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../db.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { auditar, RebanhoError, travarAnimais } from "../rebanho/regras.js";
import { diaIatf } from "../reproducao/horarios.calc.js";
import { transacaoPecuaria } from "../transacao.js";
import {
  criarDemandasDoFatoTx,
  reconciliarDemandasAnimalTx,
} from "../reproducao/acompanhamento.js";
import { hashDados, operacaoIdempotenteTx } from "../reproducao/operacoes.js";

const comando = {
  chave: z.string().uuid(),
  propriedadeId: z.number().int().positive(),
  motivo: z.string().trim().min(5).max(1000),
};
export const vincularTentativaParticipacaoSchema = z
  .object({
    ...comando,
    tentativaId: z.string().uuid(),
    revisao: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const revogarTentativaParticipacaoSchema = z.object(comando).strict();
export type VincularTentativaParticipacao = z.infer<
  typeof vincularTentativaParticipacaoSchema
>;
export type RevogarTentativaParticipacao = z.infer<
  typeof revogarTentativaParticipacaoSchema
>;
const diaParticipacao = (d: Date, precisao?: string | null) =>
  precisao === "HORA" ? diaIatf(d) : d.toISOString().slice(0, 10);
const falhar = (mensagem: string, campo?: string): never => {
  throw new RebanhoError("VALIDACAO", mensagem, campo);
};

export function validarTentativaExterna(
  p: {
    animalId: string;
    propriedadeId: number | null;
    inicio: Date;
    inicioEfetivo: Date | null;
    canceladaEm: Date | null;
    precisaoTemporal?: string;
    precisaoInicioEfetivo?: string | null;
    protocolo: {
      tipo: string;
      finalidade: string | null;
      modalidadeTentativa: string | null;
    };
  },
  t: {
    animalId: string;
    propriedadeId: number | null;
    data: Date;
    tipo: string;
    status: string;
    tarefaId: string | null;
  },
  propriedadeId: number,
) {
  if (
    p.propriedadeId !== propriedadeId ||
    t.propriedadeId !== propriedadeId ||
    p.animalId !== t.animalId
  )
    falhar(
      "Tentativa e participação devem pertencer ao mesmo animal e sítio",
      "tentativaId",
    );
  if (
    p.protocolo.tipo !== "REPRODUTIVO" ||
    p.protocolo.modalidadeTentativa !== "EXTERNA"
  )
    falhar(
      "Este modelo não acompanha tentativa separadamente",
      "participacaoId",
    );
  if (t.status !== "VALIDO" || t.tarefaId)
    falhar(
      "Selecione uma tentativa válida registrada fora de uma tarefa",
      "tentativaId",
    );
  if (
    t.tipo !==
    (p.protocolo.finalidade === "IATF"
      ? "IA"
      : p.protocolo.finalidade === "TETF"
        ? "TE"
        : null)
  )
    falhar(
      "Tipo de tentativa incompatível com a finalidade do modelo",
      "tentativaId",
    );
  const dia = diaParticipacao;
  if (
    !p.inicioEfetivo ||
    dia(t.data) < dia(p.inicio, p.precisaoTemporal) ||
    dia(t.data) <
      dia(p.inicioEfetivo, p.precisaoInicioEfetivo ?? p.precisaoTemporal) ||
    (p.canceladaEm && dia(t.data) > dia(p.canceladaEm, "HORA"))
  )
    falhar(
      "A tentativa deve estar no período comprovado da participação iniciada",
      "tentativaId",
    );
}

function revisaoVinculo(
  p: Parameters<typeof validarTentativaExterna>[0],
  t: Parameters<typeof validarTentativaExterna>[1],
) {
  return hashDados({
    participacao: {
      animalId: p.animalId,
      propriedadeId: p.propriedadeId,
      inicio: p.inicio,
      inicioEfetivo: p.inicioEfetivo,
      canceladaEm: p.canceladaEm,
      precisaoTemporal: p.precisaoTemporal ?? null,
      precisaoInicioEfetivo: p.precisaoInicioEfetivo ?? null,
      protocolo: {
        tipo: p.protocolo.tipo,
        finalidade: p.protocolo.finalidade,
        modalidadeTentativa: p.protocolo.modalidadeTentativa,
      },
    },
    tentativa: {
      animalId: t.animalId,
      propriedadeId: t.propriedadeId,
      data: t.data,
      tipo: t.tipo,
      status: t.status,
      tarefaId: t.tarefaId,
    },
  });
}
export async function vincularTentativaParticipacao(
  participacaoId: string,
  input: VincularTentativaParticipacao,
  usuarioId: number,
) {
  if (!(usuarioId > 0))
    falhar("Sessão de usuário necessária para vincular o fato");
  const alvo = await prisma.participacaoProtocolo.findFirst({
    where: { id: participacaoId, propriedadeId: input.propriedadeId },
    select: { animalId: true },
  });
  if (!alvo)
    throw new RebanhoError(
      "NAO_ENCONTRADO",
      "Participação não encontrada neste sítio",
    );
  return transacaoPecuaria(async (tx) => {
    await travarAnimais(tx, [alvo.animalId]);
    const p = await tx.participacaoProtocolo.findFirst({
      where: { id: participacaoId, propriedadeId: input.propriedadeId },
      include: { protocolo: true },
    });
    if (!p)
      throw new RebanhoError(
        "NAO_ENCONTRADO",
        "Participação não encontrada neste sítio",
      );
    return operacaoIdempotenteTx(
      tx,
      { ...input, participacaoId },
      usuarioId,
      "VINCULAR_TENTATIVA_PARTICIPACAO",
      async () => {
        const t = await tx.tentativaReprodutiva.findUnique({
          where: { id: input.tentativaId },
        });
        if (!t)
          throw new RebanhoError("NAO_ENCONTRADO", "Tentativa não encontrada");
        validarTentativaExterna(p, t, input.propriedadeId);
        if (revisaoVinculo(p, t) !== input.revisao)
          throw new RebanhoError(
            "CONFLITO",
            "A tentativa ou participação mudou. Atualize os candidatos antes de confirmar o vínculo",
          );
        await conferirAnimalNoFato(
          tx,
          p.animalId,
          input.propriedadeId,
          t.data,
          "tentativaId",
        );
        if (
          (await tx.vinculoTentativaParticipacao.findFirst({
            where: {
              revogadoEm: null,
              OR: [{ participacaoId }, { tentativaId: t.id }],
            },
          })) ||
          (await tx.vinculoTarefaProtocolo.findFirst({
            where: { tentativaId: t.id, estado: "ATUAL" },
          }))
        )
          throw new RebanhoError(
            "CONFLITO",
            "A participação ou a tentativa já possui vínculo factual; confira o registro existente",
          );
        const snapshot = {
          tentativaId: t.id,
          animalId: t.animalId,
          data: t.data.toISOString().slice(0, 10),
          tipo: t.tipo,
          propriedadeId: input.propriedadeId,
          protocoloId: p.protocoloId,
          protocoloVersao: p.protocolo.versao,
        };
        const vinculo = await tx.vinculoTentativaParticipacao.create({
          data: {
            participacaoId,
            tentativaId: t.id,
            propriedadeId: input.propriedadeId,
            motivo: input.motivo,
            snapshot,
            criadoPorId: usuarioId,
          },
        });
        const prazosPreservados =
          await tx.demandaAcompanhamentoReprodutivo.count({
            where: { tentativaId: t.id },
          });
        await criarDemandasDoFatoTx(
          tx,
          {
            tentativaId: t.id,
            tipoTentativa: t.tipo,
            animalId: t.animalId,
            propriedadeId: input.propriedadeId,
            data: t.data,
          },
          usuarioId,
          undefined,
          participacaoId,
        );
        await reconciliarDemandasAnimalTx(tx, t.animalId, usuarioId);
        await auditar(tx, {
          entidade: "VinculoTentativaParticipacao",
          entidadeId: vinculo.id,
          animalId: p.animalId,
          propriedadeId: input.propriedadeId,
          acao: "VINCULO_FACTUAL",
          usuarioId,
          depois: vinculo,
        });
        return {
          id: vinculo.id,
          participacaoId,
          tentativaId: t.id,
          prazosPreservados,
        };
      },
    );
  });
}

export async function revogarTentativaParticipacao(
  vinculoId: string,
  input: RevogarTentativaParticipacao,
  usuarioId: number,
) {
  if (!(usuarioId > 0))
    falhar("Sessão de usuário necessária para revogar o vínculo");
  const alvo = await prisma.vinculoTentativaParticipacao.findFirst({
    where: { id: vinculoId, propriedadeId: input.propriedadeId },
    select: { participacao: { select: { animalId: true } } },
  });
  if (!alvo)
    throw new RebanhoError(
      "NAO_ENCONTRADO",
      "Vínculo não encontrado neste sítio",
    );
  return transacaoPecuaria(async (tx) => {
    await travarAnimais(tx, [alvo.participacao.animalId]);
    const v = await tx.vinculoTentativaParticipacao.findFirst({
      where: { id: vinculoId, propriedadeId: input.propriedadeId },
      include: { tentativa: true, participacao: true },
    });
    if (!v)
      throw new RebanhoError(
        "NAO_ENCONTRADO",
        "Vínculo não encontrado neste sítio",
      );
    return operacaoIdempotenteTx(
      tx,
      { ...input, vinculoId },
      usuarioId,
      "REVOGAR_TENTATIVA_PARTICIPACAO",
      async () => {
        if (v.revogadoEm)
          throw new RebanhoError("CONFLITO", "O vínculo já foi revogado");
        const agora = new Date();
        const salva = await tx.vinculoTentativaParticipacao.update({
          where: { id: vinculoId },
          data: {
            revogadoEm: agora,
            revogadoPorId: usuarioId,
            motivoRevogacao: input.motivo,
          },
        });
        await auditar(tx, {
          entidade: "VinculoTentativaParticipacao",
          entidadeId: vinculoId,
          animalId: v.participacao.animalId,
          propriedadeId: input.propriedadeId,
          acao: "REVOGACAO_VINCULO",
          usuarioId,
          antes: v,
          depois: salva,
        });
        return { id: salva.id, revogadoEm: agora.toISOString() };
      },
    );
  });
}

export async function listarTentativasCandidatas(
  participacaoId: string,
  propriedadeId: number,
  pagina: number,
) {
  return prisma.$transaction(
    async (tx) => {
      const p = await tx.participacaoProtocolo.findFirst({
        where: { id: participacaoId, propriedadeId },
        include: { protocolo: true },
      });
      if (!p)
        throw new RebanhoError(
          "NAO_ENCONTRADO",
          "Participação não encontrada neste sítio",
        );
      if (p.protocolo.modalidadeTentativa !== "EXTERNA")
        falhar("Este modelo realiza a tentativa nas etapas");
      if (!p.inicioEfetivo)
        return { itens: [], total: 0, pagina: 1, porPagina: 10 };
      const where = {
        animalId: p.animalId,
        propriedadeId,
        status: "VALIDO",
        tipo: p.protocolo.finalidade === "IATF" ? "IA" : "TE",
        tarefaId: null,
        vinculosProtocolo: { none: { estado: "ATUAL" } },
        participacoesExplicitas: { none: { revogadoEm: null } },
        data: {
          gte: new Date(
            `${diaParticipacao(p.inicioEfetivo, p.precisaoInicioEfetivo ?? p.precisaoTemporal)}T00:00:00Z`,
          ),
          ...(p.canceladaEm ? { lte: p.canceladaEm } : {}),
        },
      } satisfies Prisma.TentativaReprodutivaWhereInput;
      const total = await tx.tentativaReprodutiva.count({ where });
      const atual = Math.min(pagina, Math.max(1, Math.ceil(total / 10)));
      const itens = await tx.tentativaReprodutiva.findMany({
        where,
        select: {
          id: true,
          animalId: true,
          propriedadeId: true,
          tipo: true,
          data: true,
          responsavel: true,
          status: true,
          tarefaId: true,
        },
        orderBy: [{ data: "desc" }, { id: "asc" }],
        skip: (atual - 1) * 10,
        take: 10,
      });
      return {
        itens: itens.map((t) => ({
          id: t.id,
          tipo: t.tipo,
          data: t.data,
          responsavel: t.responsavel,
          revisao: revisaoVinculo(p, t),
        })),
        total,
        pagina: atual,
        porPagina: 10,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
