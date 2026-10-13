import crypto from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { auditar, RebanhoError, travarAnimais } from "../rebanho/regras.js";
import { transacaoPecuaria } from "../transacao.js";
import { conferirAnimalNoFato } from "../fatos.js";
import {
  criarAplicacaoTx,
  travarOrigensAplicacoesTx,
} from "../sanidade/aplicacoes.js";
import { aplicacaoSchema } from "../sanidade/aplicacoes.schemas.js";
import { registrarExameTx } from "../sanidade/exames.js";
import { iniciarExecucaoTx } from "../sanidade/protocolos.js";
import { executarExameEtapaSchema } from "../sanidade/execucao-etapas.schemas.js";
import {
  atividadeSchema,
  avaliacaoSchema,
  confirmacaoVisitaSchema,
  visitaSchema,
} from "./schemas.js";
import { criarAvaliacaoTx, dia, erro, painelReproducao } from "./registros.js";
import {
  contextoTarefaTx,
  executarTarefaTx,
  iniciarParticipanteTx,
} from "./iatf.js";
import { hashDados, operacaoIdempotenteTx } from "./operacoes.js";
const json = (v: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(v));
async function visitaTx(
  tx: Prisma.TransactionClient,
  id: string,
  propriedadeId: number,
) {
  const visita = await tx.visitaVeterinaria.findFirst({
    where: { id, propriedadeId },
  });
  if (!visita)
    throw new RebanhoError(
      "NAO_ENCONTRADO",
      "Visita não encontrada neste sítio",
    );
  return visita;
}
export async function criarVisita(
  input: z.infer<typeof visitaSchema>,
  usuarioId: number | null,
) {
  return transacaoPecuaria(async (tx) => {
    const v = await tx.visitaVeterinaria.create({
      data: { ...input, data: dia(input.data), criadoPorId: usuarioId },
    });
    await auditar(tx, {
      entidade: "VisitaVeterinaria",
      entidadeId: v.id,
      propriedadeId: input.propriedadeId,
      acao: "CRIACAO",
      usuarioId,
      depois: v,
    });
    return v;
  });
}
export async function adicionarAtividade(
  id: string,
  input: z.infer<typeof atividadeSchema>,
  usuarioId: number | null,
) {
  return transacaoPecuaria(async (tx) => {
    await travarAnimais(
      tx,
      input.participantes.map((p) => p.animalId),
    );
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-visita:${id}`}))`;
    const v = await visitaTx(tx, id, input.propriedadeId);
    if (v.encerradaEm) erro("Visita encerrada não recebe atividades");
    if (
      new Set(input.participantes.map((p) => p.animalId)).size !==
      input.participantes.length
    )
      erro("Animal duplicado nesta atividade", "participantes");
    const ultima = await tx.atividadeVisita.aggregate({
      where: { visitaId: id },
      _max: { ordem: true },
    });
    const atividade = await tx.atividadeVisita.create({
      data: {
        visitaId: id,
        tipo: input.tipo,
        nome: input.nome,
        extra: input.extra,
        contexto: json(input.contexto),
        ordem: (ultima._max.ordem ?? 0) + 1,
      },
    });
    const participantes = [];
    for (const [i, item] of input.participantes.entries()) {
      const animal = await tx.animal.findUnique({
        where: { id: item.animalId },
      });
      if (!animal) erro("Animal não encontrado", "participantes");
      const local = await tx.localizacaoAnimal.findFirst({
        where: {
          animalId: item.animalId,
          propriedadeId: input.propriedadeId,
          desde: { lte: v.data },
          OR: [{ ate: null }, { ate: { gt: v.data } }],
        },
        include: { lote: true },
      });
      if (!local)
        erro(
          "Animal fora do sítio na data de referência da visita",
          "participantes",
        );
      if (item.tarefaSanitariaId) {
        const tarefa = await tx.tarefaSanitaria.findFirst({
          where: {
            id: item.tarefaSanitariaId,
            dispensadaEm: null,
            execucao: {
              animalId: item.animalId,
              propriedadeId: input.propriedadeId,
              canceladaEm: null,
            },
            aplicacoes: { none: { status: "VALIDO" } },
            exames: { none: { status: "VALIDO" } },
          },
        });
        if (!tarefa)
          erro(
            "Tarefa sanitária não está pendente para este animal/sítio",
            "participantes",
          );
      }
      if (item.tarefaIatfId) {
        const t = await contextoTarefaTx(
          tx,
          item.tarefaIatfId,
          input.propriedadeId,
        );
        if (
          t.participante.animalId !== item.animalId ||
          t.tarefa.realizadaEm ||
          t.tarefa.dispensadaEm
        )
          erro("Tarefa IATF incompatível ou concluída", "participantes");
      }
      if (input.tipo === "TAREFA_IATF" && !item.tarefaIatfId)
        erro("Selecione tarefa IATF", "participantes");
      const [tentativa, gestacao, parto, contagemPartos, restricoes] =
        await Promise.all([
          tx.tentativaReprodutiva.findFirst({
            where: {
              animalId: animal.id,
              status: "VALIDO",
              data: { lte: v.data },
            },
            orderBy: { data: "desc" },
          }),
          tx.gestacaoAnimal.findFirst({
            where: {
              animalId: animal.id,
              status: "VALIDO",
              confirmadaEm: { lte: v.data },
              OR: [{ encerradaEm: null }, { encerradaEm: { gt: v.data } }],
            },
            orderBy: { confirmadaEm: "desc" },
          }),
          tx.partoAnimal.findFirst({
            where: {
              animalId: animal.id,
              status: "VALIDO",
              data: { lte: v.data },
            },
            orderBy: { data: "desc" },
          }),
          tx.partoAnimal.count({
            where: {
              animalId: animal.id,
              status: "VALIDO",
              incluidoSaldoAnterior: false,
              data: { lte: v.data },
            },
          }),
          tx.restricaoReprodutiva.findMany({
            where: {
              animalId: animal.id,
              status: "VALIDO",
              data: { lte: v.data },
              OR: [{ ate: null }, { ate: { gt: v.data } }],
            },
          }),
        ]);
      const snapshot = {
        motivos: item.motivos ?? [],
        tentativa: tentativa
          ? {
              id: tentativa.id,
              data: tentativa.data,
              tipo: tentativa.tipo,
              ordem: tentativa.ordem,
              ciclo: tentativa.ciclo,
              geneticaSnapshot: tentativa.geneticaSnapshot,
            }
          : null,
        gestacao,
        ultimoParto: parto
          ? { id: parto.id, data: parto.data, tipo: parto.tipo }
          : null,
        partos: animal.partosAntesDaEntrada + contagemPartos,
        restricoes,
        animalId: animal.id,
        brinco: animal.brinco,
        nome: animal.nome,
        lote: local.lote ? { id: local.lote.id, nome: local.lote.nome } : null,
        localizacaoId: local.id,
        dataReferencia: v.data.toISOString().slice(0, 10),
        filtros: input.contexto,
        atualizadoEm: animal.atualizadoEm.toISOString(),
      };
      participantes.push(
        await tx.participanteVisita.create({
          data: {
            atividadeId: atividade.id,
            animalId: animal.id,
            ordem: i + 1,
            tarefaSanitariaId: item.tarefaSanitariaId,
            tarefaIatfId: item.tarefaIatfId,
            snapshot: json(snapshot),
          },
        }),
      );
    }
    await auditar(tx, {
      entidade: "AtividadeVisita",
      entidadeId: atividade.id,
      propriedadeId: input.propriedadeId,
      acao: input.extra ? "ATIVIDADE_EXTRA" : "ATIVIDADE_PREVISTA",
      usuarioId,
      depois: { atividade, participantes },
    });
    await tx.visitaVeterinaria.update({
      where: { id },
      data: { status: v.status === "ABERTA" ? "ABERTA" : "PARCIAL" },
    });
    return { ...atividade, participantes };
  });
}
export async function listarVisitas(propriedadeId: number | null) {
  return prisma.visitaVeterinaria.findMany({
    where: propriedadeId == null ? {} : { propriedadeId },
    orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
    take: 200,
  });
}
export async function detalheVisita(
  id: string,
  propriedadeId: number | null,
  tx: Prisma.TransactionClient = prisma,
) {
  const visita = await tx.visitaVeterinaria.findFirst({
    where: { id, ...(propriedadeId == null ? {} : { propriedadeId }) },
  });
  if (!visita)
    throw new RebanhoError(
      "NAO_ENCONTRADO",
      "Visita não encontrada neste sítio",
    );
  const atividades = await tx.atividadeVisita.findMany({
    where: { visitaId: id },
    orderBy: { ordem: "asc" },
  });
  const [participantes, impressoes] = await Promise.all([
    tx.participanteVisita.findMany({
      where: { atividadeId: { in: atividades.map((a) => a.id) } },
      orderBy: { ordem: "asc" },
    }),
    tx.impressaoVisita.findMany({
      where: { visitaId: id },
      orderBy: { versao: "desc" },
    }),
  ]);
  return {
    ...visita,
    atividades: atividades.map((a) => ({
      ...a,
      participantes: participantes.filter((p) => p.atividadeId === a.id),
    })),
    impressoes,
  };
}
export async function salvarRascunho(
  id: string,
  participanteId: string,
  propriedadeId: number,
  rascunho: Record<string, unknown>,
  usuarioId: number | null,
) {
  return transacaoPecuaria(async (tx) => {
    const visita = await visitaTx(tx, id, propriedadeId);
    if (visita.encerradaEm) erro("Visita encerrada não recebe rascunhos");
    const participante = await tx.participanteVisita.findUnique({
      where: { id: participanteId },
    });
    if (
      !participante ||
      !(await tx.atividadeVisita.count({
        where: { id: participante.atividadeId, visitaId: id },
      }))
    )
      throw new RebanhoError(
        "NAO_ENCONTRADO",
        "Participante não pertence à visita",
      );
    await travarAnimais(tx, [participante.animalId]);
    if (participante.status === "CONFIRMADO")
      erro("Fato confirmado não pode ser sobrescrito por rascunho");
    const salva = await tx.participanteVisita.update({
      where: { id: participanteId },
      data: { rascunho: json(rascunho) },
    });
    await auditar(tx, {
      entidade: "ParticipanteVisita",
      entidadeId: participanteId,
      animalId: participante.animalId,
      propriedadeId,
      acao: "RASCUNHO",
      usuarioId,
      antes: participante.rascunho,
      depois: rascunho,
    });
    return salva;
  });
}
export async function imprimirVisita(
  id: string,
  propriedadeId: number,
  usuarioId: number | null,
) {
  return transacaoPecuaria(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-visita:${id}`}))`;
    const detalhe = await detalheVisita(id, propriedadeId, tx),
      versao = (detalhe.impressoes[0]?.versao ?? 0) + 1;
    const { impressoes: _i, ...visita } = detalhe;
    const impressao = await tx.impressaoVisita.create({
      data: {
        visitaId: id,
        versao,
        snapshot: json({ ...visita, dataReferencia: visita.data, versao }),
        criadoPorId: usuarioId,
      },
    });
    await auditar(tx, {
      entidade: "ImpressaoVisita",
      entidadeId: impressao.id,
      propriedadeId,
      acao: "IMPRESSAO",
      usuarioId,
      depois: impressao,
    });
    return impressao;
  });
}
export async function confirmarAtividade(
  id: string,
  atividadeId: string,
  input: z.infer<typeof confirmacaoVisitaSchema>,
  usuarioId: number | null,
) {
  return transacaoPecuaria(async (tx) => {
    const v = await visitaTx(tx, id, input.propriedadeId),
      atividade = await tx.atividadeVisita.findFirst({
        where: { id: atividadeId, visitaId: id },
      });
    if (!atividade)
      throw new RebanhoError(
        "NAO_ENCONTRADO",
        "Atividade não pertence à visita",
      );
    const ids = input.itens.map((i) => i.participanteId);
    if (new Set(ids).size !== ids.length)
      erro("Participante duplicado na confirmação", "itens");
    const participantes = await tx.participanteVisita.findMany({
      where: { id: { in: ids }, atividadeId },
    });
    if (participantes.length !== ids.length)
      erro("Confirmação contém participante de outra atividade", "itens");
    await travarAnimais(
      tx,
      participantes.map((p) => p.animalId),
    );
    return operacaoIdempotenteTx(
      tx,
      { ...input, visitaId: id, atividadeId },
      usuarioId,
      "CONFIRMACAO_VISITA",
      async () => {
        if (v.encerradaEm) erro("Visita encerrada não recebe confirmações");
        if (input.cienciaAlteracoes) {
          const atual = await previaAtividadeTx(
            tx,
            id,
            atividadeId,
            input.propriedadeId,
          );
          if (
            !input.fingerprintPrevia ||
            atual.fingerprint !== input.fingerprintPrevia
          )
            throw new RebanhoError(
              "CONFLITO",
              "O contexto mudou desde a revisão; gere uma nova prévia",
              "fingerprintPrevia",
            );
        }
        // Saldo compartilhado é travado depois de todos os animais e antes da primeira baixa.
        const aplicacoes =
          atividade.tipo === "APLICACAO_SANITARIA"
            ? input.itens
                .filter((i) => i.status === "CONFIRMADO")
                .map((i) => {
                  const p = participantes.find(
                    (p) => p.id === i.participanteId,
                  )!;
                  return aplicacaoSchema.parse({
                    ...(i.dados ?? (p.rascunho as Record<string, unknown>)),
                    animalId: p.animalId,
                    propriedadeId: input.propriedadeId,
                    data:
                      (i.dados?.data as string | undefined) ??
                      v.data.toISOString().slice(0, 10),
                    ...(p.tarefaSanitariaId
                      ? { tarefaId: p.tarefaSanitariaId }
                      : {}),
                  });
                })
            : [];
        await travarOrigensAplicacoesTx(tx, aplicacoes);
        const resultados = [];
        for (const [indice, item] of input.itens.entries()) {
          try {
            const p = await tx.participanteVisita.findUniqueOrThrow({
              where: { id: item.participanteId },
            });
            if (p.status === "CONFIRMADO")
              erro("Participante já confirmado; use a confirmação original");
            if (item.status !== "CONFIRMADO") {
              if (!item.motivo)
                erro("Adiamento/ausência exige motivo", "motivo");
              resultados.push(
                await tx.participanteVisita.update({
                  where: { id: p.id },
                  data: { status: item.status, motivo: item.motivo },
                }),
              );
              continue;
            }
            const { alteracoes } = await compararSnapshotTx(
              tx,
              p,
              v.data,
              input.propriedadeId,
            );
            if (alteracoes.length && !input.cienciaAlteracoes)
              throw new RebanhoError(
                "CONFLITO",
                `Contexto mudou desde a preparação: ${alteracoes.join("; ")}. Revise a prévia e confirme ciência.`,
                "cienciaAlteracoes",
              );
            const bruto = item.dados ?? (p.rascunho as Record<string, unknown>);
            if (
              (bruto.animalId && bruto.animalId !== p.animalId) ||
              (bruto.propriedadeId &&
                bruto.propriedadeId !== input.propriedadeId)
            )
              erro("Os dados não pertencem ao participante/sítio");
            const dados = {
              ...bruto,
              chave: input.chave,
              animalId: p.animalId,
              propriedadeId: input.propriedadeId,
              data:
                (bruto.data as string | undefined) ??
                v.data.toISOString().slice(0, 10),
            };
            let fato: { id: string }, fatoTipo: string;
            if (atividade.tipo === "AVALIACAO_REPRODUTIVA") {
              fato = await criarAvaliacaoTx(
                tx,
                avaliacaoSchema.parse(dados),
                usuarioId,
              );
              fatoTipo = "AvaliacaoReprodutiva";
            } else if (atividade.tipo === "APLICACAO_SANITARIA") {
              fato = await criarAplicacaoTx(
                tx,
                aplicacaoSchema.parse({
                  ...dados,
                  ...(p.tarefaSanitariaId
                    ? { tarefaId: p.tarefaSanitariaId }
                    : {}),
                }),
                usuarioId,
              );
              fatoTipo = "AplicacaoProduto";
            } else if (atividade.tipo === "EXAME_SANITARIO") {
              const exameSchema = executarExameEtapaSchema
                .omit({ tipo: true, tarefaId: true })
                .extend({
                  tarefaId: z.string().uuid().nullish(),
                  observacao: z.string().trim().max(1000).nullish(),
                });
              const { chave: _c, ...camposExame } = dados;
              fato = await registrarExameTx(
                tx,
                exameSchema.parse({
                  ...camposExame,
                  ...(p.tarefaSanitariaId
                    ? { tarefaId: p.tarefaSanitariaId }
                    : {}),
                }),
                usuarioId,
              );
              fatoTipo = "ExameAnimal";
            } else if (atividade.tipo === "INICIAR_SANITARIO") {
              const contexto = atividade.contexto as { protocoloId?: string };
              const esquema = z
                .object({
                  protocoloId: z.string().uuid(),
                  inicio: z.string().date(),
                  animalId: z.string().uuid(),
                  propriedadeId: z.number().int().positive(),
                  responsavel: z.string().nullish(),
                  operacaoServicoId: z.string().uuid().nullish(),
                })
                .strict();
              fato = await iniciarExecucaoTx(
                tx,
                esquema.parse({
                  protocoloId: bruto.protocoloId ?? contexto.protocoloId,
                  inicio: dados.data,
                  animalId: p.animalId,
                  propriedadeId: input.propriedadeId,
                  responsavel: bruto.responsavel,
                  operacaoServicoId: bruto.operacaoServicoId,
                }),
                usuarioId,
              );
              fatoTipo = "ExecucaoProtocoloSanitario";
            } else if (atividade.tipo === "TAREFA_IATF") {
              if (!p.tarefaIatfId) erro("Tarefa IATF não selecionada");
              if (typeof bruto.realizadaEm !== "string")
                erro("Informe horário da execução", "realizadaEm");
              fato = await executarTarefaTx(
                tx,
                p.tarefaIatfId,
                {
                  propriedadeId: input.propriedadeId,
                  realizadaEm: bruto.realizadaEm,
                  dados: (bruto.dados as Record<string, unknown>) ?? {},
                  motivo:
                    typeof bruto.motivo === "string" ? bruto.motivo : undefined,
                },
                usuarioId,
              );
              fatoTipo = "TarefaIatf";
            } else {
              if (
                typeof bruto.participanteIatfId !== "string" ||
                typeof bruto.inicioEfetivo !== "string"
              )
                erro(
                  "Selecione participação e início efetivo",
                  "participanteIatfId",
                );
              const iatf = await tx.participanteIatf.findFirst({
                where: { id: bruto.participanteIatfId, animalId: p.animalId },
              });
              if (!iatf) erro("Participação IATF pertence a outro animal");
              fato = await iniciarParticipanteTx(
                tx,
                iatf.id,
                input.propriedadeId,
                bruto.inicioEfetivo,
                usuarioId,
                bruto.cienciaSanitaria === true,
              );
              fatoTipo = "ParticipanteIatf";
            }
            const salva = await tx.participanteVisita.update({
              where: { id: p.id },
              data: {
                status: "CONFIRMADO",
                fatoTipo,
                fatoId: fato.id,
                rascunho: json(bruto),
              },
            });
            await auditar(tx, {
              entidade: "ParticipanteVisita",
              entidadeId: p.id,
              animalId: p.animalId,
              propriedadeId: input.propriedadeId,
              acao: "CONFIRMACAO",
              usuarioId,
              depois: salva,
            });
            resultados.push(salva);
          } catch (e) {
            if (e instanceof RebanhoError)
              throw new RebanhoError(
                e.code,
                `Linha ${indice + 1}: ${e.message}. Nenhuma linha foi confirmada.`,
                `itens.${indice}.${e.campo ?? "dados"}`,
              );
            throw e;
          }
        }
        const atividades = await tx.atividadeVisita.findMany({
          where: { visitaId: id },
          select: { id: true },
        });
        const pendentes = await tx.participanteVisita.count({
          where: {
            atividadeId: { in: atividades.map((a) => a.id) },
            status: { not: "CONFIRMADO" },
          },
        });
        await tx.visitaVeterinaria.update({
          where: { id },
          data: { status: pendentes ? "PARCIAL" : "CONCLUIDA" },
        });
        return {
          participantes: resultados,
          status: pendentes ? "PARCIAL" : "CONCLUIDA",
        };
      },
    );
  });
}
export async function encerrarVisita(
  id: string,
  propriedadeId: number,
  usuarioId: number | null,
) {
  return transacaoPecuaria(async (tx) => {
    const antes = await visitaTx(tx, id, propriedadeId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-visita:${id}`}))`;
    const v = await tx.visitaVeterinaria.update({
      where: { id },
      data: { status: "ENCERRADA", encerradaEm: new Date() },
    });
    await auditar(tx, {
      entidade: "VisitaVeterinaria",
      entidadeId: id,
      propriedadeId,
      acao: "ENCERRAMENTO_ADMINISTRATIVO",
      usuarioId,
      antes,
      depois: v,
    });
    return v;
  });
}
export async function sugestoesVisita(
  propriedadeId: number | null,
  data: string,
) {
  const scope = propriedadeId == null ? {} : { propriedadeId };
  const [
    tarefasSanitarias,
    programacoes,
    protocolosSanitarios,
    protocolosIatf,
    painel,
  ] = await Promise.all([
    prisma.tarefaSanitaria.findMany({
      where: {
        previstaPara: { lte: dia(data) },
        dispensadaEm: null,
        execucao: { ...scope, canceladaEm: null },
        aplicacoes: { none: { status: "VALIDO" } },
        exames: { none: { status: "VALIDO" } },
      },
      include: {
        execucao: { select: { animalId: true, propriedadeId: true } },
        etapa: true,
      },
      orderBy: { previstaPara: "asc" },
      take: 500,
    }),
    prisma.programacaoIatf.findMany({ where: scope }),
    prisma.protocoloSanitario.findMany({
      where: { publicadoEm: { not: null }, ativo: true },
      orderBy: { nome: "asc" },
    }),
    prisma.protocoloIatf.findMany({
      where: { publicado: true },
      orderBy: { nome: "asc" },
    }),
    painelReproducao(propriedadeId),
  ]);
  const participantes = await prisma.participanteIatf.findMany({
    where: {
      programacaoId: { in: programacoes.map((p) => p.id) },
      encerradoEm: null,
    },
  });
  const tarefasIatf = await prisma.tarefaIatf.findMany({
    where: {
      participanteId: { in: participantes.map((p) => p.id) },
      realizadaEm: null,
      dispensadaEm: null,
      previstaEm: { lte: new Date(`${data}T23:59:59-03:00`) },
    },
    orderBy: { previstaEm: "asc" },
  });
  return {
    tarefasSanitarias: tarefasSanitarias.map((t) => ({
      ...t,
      animalId: t.execucao.animalId,
      nome: `${t.etapa.tipo} · etapa ${t.etapa.ordem}`,
      tipo: t.etapa.tipo,
    })),
    tarefasIatf: tarefasIatf.map((t) => ({
      ...t,
      animalId: participantes.find((p) => p.id === t.participanteId)?.animalId,
    })),
    protocolosSanitarios,
    protocolosIatf,
    participantesIatf: participantes,
    animais: painel.animais,
  };
}
async function compararSnapshotTx(
  tx: Prisma.TransactionClient,
  participante: { animalId: string; snapshot: Prisma.JsonValue },
  data: Date,
  propriedadeId: number,
) {
  const snapshot = participante.snapshot as {
    atualizadoEm?: string;
    localizacaoId?: string;
    tentativa?: { id: string } | null;
    gestacao?: {
      id: string;
      encerradaEm?: string | null;
      sexoFetal?: string | null;
    } | null;
  };
  const [animal, local, tentativa, gestacao] = await Promise.all([
    tx.animal.findUnique({ where: { id: participante.animalId } }),
    tx.localizacaoAnimal.findFirst({
      where: {
        animalId: participante.animalId,
        propriedadeId,
        desde: { lte: data },
        OR: [{ ate: null }, { ate: { gt: data } }],
      },
    }),
    tx.tentativaReprodutiva.findFirst({
      where: {
        animalId: participante.animalId,
        status: "VALIDO",
        data: { lte: data },
      },
      orderBy: { data: "desc" },
    }),
    tx.gestacaoAnimal.findFirst({
      where: {
        animalId: participante.animalId,
        status: "VALIDO",
        confirmadaEm: { lte: data },
        OR: [{ encerradaEm: null }, { encerradaEm: { gt: data } }],
      },
      orderBy: { confirmadaEm: "desc" },
    }),
  ]);
  const alteracoes = [];
  if (
    snapshot.atualizadoEm &&
    animal?.atualizadoEm.toISOString() !== snapshot.atualizadoEm
  )
    alteracoes.push("identidade do animal alterada");
  if (snapshot.localizacaoId && local?.id !== snapshot.localizacaoId)
    alteracoes.push("localização na data alterada");
  if ((snapshot.tentativa?.id ?? null) !== (tentativa?.id ?? null))
    alteracoes.push("tentativa relevante alterada");
  if (
    (snapshot.gestacao?.id ?? null) !== (gestacao?.id ?? null) ||
    (snapshot.gestacao?.sexoFetal ?? null) !== (gestacao?.sexoFetal ?? null)
  )
    alteracoes.push("gestação alterada");
  return {
    alteracoes,
    fingerprintAtual: hashDados({ animal, local, tentativa, gestacao }),
  };
}
async function previaAtividadeTx(
  tx: Prisma.TransactionClient,
  id: string,
  atividadeId: string,
  propriedadeId: number,
) {
  const v = await visitaTx(tx, id, propriedadeId);
  if (
    !(await tx.atividadeVisita.count({
      where: { id: atividadeId, visitaId: id },
    }))
  )
    throw new RebanhoError(
      "NAO_ENCONTRADO",
      "Atividade não encontrada nesta visita",
    );
  const participantes = await tx.participanteVisita.findMany({
    where: { atividadeId, status: { not: "CONFIRMADO" } },
    orderBy: { ordem: "asc" },
  });
  const linhas = await Promise.all(
    participantes.map(async (p) => ({
      participanteId: p.id,
      animalId: p.animalId,
      ...(await compararSnapshotTx(tx, p, v.data, propriedadeId)),
    })),
  );
  return { participantes: linhas, fingerprint: hashDados(linhas) };
}

export const previaAtividade = (
  id: string,
  atividadeId: string,
  propriedadeId: number,
) => previaAtividadeTx(prisma, id, atividadeId, propriedadeId);
