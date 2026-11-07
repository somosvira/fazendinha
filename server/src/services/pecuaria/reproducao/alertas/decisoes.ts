import type { Prisma } from "@prisma/client";
import { prisma } from "../../../../db.js";
import { transacaoPecuaria } from "../../transacao.js";
import {
  auditar,
  hojeFazendaDate,
  RebanhoError,
  travarAnimais,
} from "../../rebanho/regras.js";
import { conferirAnimalNoFato } from "../../fatos.js";
import { operacaoIdempotenteTx } from "../operacoes.js";
import { registrarEventoTarefaTx } from "../../protocolos/eventos.js";
import {
  politicaAtencaoSchema,
  decisaoAtencaoSchema,
  dia,
} from "./contratos.js";
import { reconciliarAlertasReprodutivosAnimalTx } from "./produtor.js";
const json = (v: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(v));
export function listarPoliticasAtencao(propriedadeId: number) {
  return prisma.politicaAtencaoReprodutiva.findMany({
    where: { propriedadeId },
    orderBy: { versao: "desc" },
  });
}
export function criarPoliticaAtencao(entrada: unknown, usuarioId: number) {
  const input = politicaAtencaoSchema.parse(entrada);
  return transacaoPecuaria(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`politica-atencao-reprodutiva:${input.propriedadeId}`},0))`;
    return operacaoIdempotenteTx(
      tx,
      input,
      usuarioId,
      "POLITICA_ATENCAO_REPRODUTIVA",
      async () => {
        const anterior = await tx.politicaAtencaoReprodutiva.findFirst({
          where: { propriedadeId: input.propriedadeId },
          orderBy: { versao: "desc" },
        });
        if (anterior && dia(input.vigenteDesde) <= anterior.vigenteDesde)
          throw new RebanhoError(
            "VALIDACAO",
            "A vigência deve suceder a última versão",
          );
        const criada = await tx.politicaAtencaoReprodutiva.create({
          data: {
            propriedadeId: input.propriedadeId,
            versao: (anterior?.versao ?? 0) + 1,
            vigenteDesde: dia(input.vigenteDesde),
            parametros: json(input.parametros),
            criadoPorId: usuarioId,
          },
        });
        await auditar(tx, {
          entidade: "PoliticaAtencaoReprodutiva",
          entidadeId: criada.id,
          propriedadeId: input.propriedadeId,
          usuarioId,
          acao: "REGISTRO",
          depois: criada,
        });
        await tx.avaliacaoAlertas.upsert({
          where: { id: "reproducao" },
          create: {
            id: "reproducao",
            produtor: "reproducao",
            estado: "DESATUALIZADO",
          },
          update: { estado: "DESATUALIZADO", diaCoberto: null, cursor: null },
        });
        return criada;
      },
    );
  });
}
export function decidirAtencaoReprodutiva(
  alertaId: string,
  entrada: unknown,
  usuarioId: number,
) {
  const input = decisaoAtencaoSchema.parse(entrada);
  return transacaoPecuaria(async (tx) => {
    const ref = await tx.necessidadeReprodutiva.findFirst({
      where: { alertaId, propriedadeId: input.propriedadeId },
    });
    if (!ref)
      throw new RebanhoError(
        "NAO_ENCONTRADO",
        "Necessidade reprodutiva não encontrada neste sítio",
      );
    await travarAnimais(tx, [ref.animalId]);
    await conferirAnimalNoFato(
      tx,
      ref.animalId,
      input.propriedadeId,
      hojeFazendaDate(),
    );
    return operacaoIdempotenteTx(
      tx,
      { ...input, alertaId },
      usuarioId,
      "DECISAO_ATENCAO_REPRODUTIVA",
      async () => {
        // Um fato pode ter sido gravado entre a consulta e a decisão.
        await reconciliarAlertasReprodutivosAnimalTx(
          tx,
          ref.animalId,
          usuarioId,
        );
        const n = await tx.necessidadeReprodutiva.findUniqueOrThrow({
          where: { id: ref.id },
        });
        if (
          n.revisao !== input.revisao ||
          ["RESOLVIDO", "ENCERRADO", "DISPENSADO"].includes(n.situacao)
        )
          throw new RebanhoError(
            "CONFLITO",
            "A necessidade mudou ou foi encerrada; confira novamente",
          );
        if (
          n.tipo === "DISPOSITIVO_SEM_RETIRADA" &&
          ["DISPENSAR", "RETIRAR"].includes(input.tipo)
        )
          throw new RebanhoError(
            "VALIDACAO",
            "A necessidade física só é resolvida pela retirada registrada",
          );
        if (input.data && dia(input.data) <= hojeFazendaDate())
          throw new RebanhoError(
            "VALIDACAO",
            "Informe uma data futura para a revisão",
            "data",
          );
        if (input.tipo === "RETIRAR" && !n.participacaoId)
          throw new RebanhoError(
            "VALIDACAO",
            "Esta necessidade não pertence a uma participação",
          );
        if (input.tipo === "DISPENSAR" && n.tarefaId)
          await registrarEventoTarefaTx(
            tx,
            n.tarefaId,
            {
              chave: input.chave,
              propriedadeId: input.propriedadeId,
              tipo: "DISPENSA",
              ocorridaEm: new Date().toISOString(),
              motivo: input.motivo,
            },
            usuarioId,
            "REPRODUTIVO",
            { reciboCompartilhado: true },
          );
        if (input.tipo === "REAGENDAR") {
          if (n.tarefaId)
            await registrarEventoTarefaTx(
              tx,
              n.tarefaId,
              {
                chave: input.chave,
                propriedadeId: input.propriedadeId,
                tipo: "ADIAMENTO",
                ocorridaEm: new Date().toISOString(),
                motivo: input.motivo,
                previstaPara: input.data!,
              },
              usuarioId,
              "REPRODUTIVO",
              { reciboCompartilhado: true },
            );
          if (n.demandaId)
            await tx.demandaAcompanhamentoReprodutivo.update({
              where: { id: n.demandaId },
              data: {
                previstaPara: dia(input.data!),
                versao: { increment: 1 },
              },
            });
        }
        if (input.tipo === "RETIRAR") {
          await tx.participacaoProtocolo.update({
            where: { id: n.participacaoId! },
            data: { canceladaEm: new Date(), motivoCancelamento: input.motivo },
          });
          // Mantém fatos/consumos e a consulta física de dispositivos sem retirada válida.
          await tx.tarefaProtocolo.updateMany({
            where: {
              execucaoId: n.participacaoId!,
              realizadaEm: null,
              dispensadaEm: null,
            },
            data: { dispensadaEm: new Date(), motivoDispensa: input.motivo },
          });
        }
        if (
          ["RETIRAR", "SUSPENDER", "REAGENDAR"].includes(input.tipo) &&
          n.participacaoId
        ) {
          // Suspensão não vira impedimento clínico. A reautorização exige revisão explícita.
          const momento = n.tarefaId
            ? await tx.tarefaProtocolo.findUnique({
                where: { id: n.tarefaId },
                select: { momentoSnapshot: true },
              })
            : null;
          const snapshot = momento?.momentoSnapshot as Record<
            string,
            unknown
          > | null;
          await tx.automacaoProtocolo.updateMany({
            where: {
              participacaoId: n.participacaoId,
              estado: { in: ["AGENDADA", "FALHOU"] },
              ...(input.tipo === "REAGENDAR" && typeof snapshot?.id === "string"
                ? { momentoId: snapshot.id }
                : {}),
            },
            data: {
              estado: "CANCELADA",
              erro: input.motivo,
              revisao: { increment: 1 },
            },
          });
        }
        const salva = await tx.necessidadeReprodutiva.update({
          where: { id: n.id },
          data: {
            decisao: input.tipo,
            decisaoMotivo: input.motivo,
            decisaoDestino: input.destino ?? null,
            revisaoEm: input.data ? dia(input.data) : null,
            decisaoPorId: usuarioId,
            ...(input.tipo === "REAGENDAR"
              ? { previstaPara: dia(input.data!) }
              : {}),
            situacao:
              input.tipo === "DISPENSAR"
                ? "DISPENSADO"
                : input.tipo === "RETIRAR"
                  ? "ENCERRADO"
                  : input.tipo === "SUSPENDER"
                    ? "SUSPENSO"
                    : "ADIADO",
            motivo: input.motivo,
            revisao: { increment: 1 },
          },
        });
        await auditar(tx, {
          entidade: "NecessidadeReprodutiva",
          entidadeId: n.id,
          animalId: n.animalId,
          propriedadeId: input.propriedadeId,
          usuarioId,
          acao: input.tipo,
          antes: n,
          depois: salva,
        });
        await reconciliarAlertasReprodutivosAnimalTx(tx, n.animalId, usuarioId);
        return tx.necessidadeReprodutiva.findUniqueOrThrow({
          where: { id: n.id },
        });
      },
    );
  });
}

/** Reavaliação explícita para operar sem cron habilitado; GET permanece sem efeitos. */
export function reavaliarAtencaoAnimal(
  animalId: string,
  propriedadeId: number,
  usuarioId: number,
) {
  return transacaoPecuaria(async (tx) => {
    await travarAnimais(tx, [animalId]);
    await conferirAnimalNoFato(tx, animalId, propriedadeId, hojeFazendaDate());
    await reconciliarAlertasReprodutivosAnimalTx(tx, animalId, usuarioId);
    return tx.necessidadeReprodutiva.findMany({
      where: { animalId, propriedadeId },
      select: {
        id: true,
        alertaId: true,
        chave: true,
        tipo: true,
        situacao: true,
        revisao: true,
        tarefaId: true,
        demandaId: true,
        participacaoId: true,
        origemId: true,
        previstaPara: true,
      },
    });
  });
}
