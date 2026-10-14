import { condicaoSituacaoTarefa } from "../protocolos/situacao.js";
import { conferirFormatoReprodutivo } from "../exames/formatos.js";
import { hashFormatoExame } from "../exames/formato-snapshot.js";
import { TIPO_EXAME_REPRODUTIVO } from "../exames/evidencia-reprodutiva.js";
import { travarTiposExame } from "../sanidade/exames.js";
import { regularizarTarefaComumTx, substitutosTarefaComum } from "../protocolos/regularizacao.js";
import { resolverIdReprodutivoTx } from "../protocolos/reproducao.js";
import { resolverPapelReprodutivo } from "../rebanho/papel-reprodutivo.calc.js";
import { eventoRegularizacao, validarSubstitutoTx, substituirEvidenciaAplicacaoTx, listarSubstitutosTx, type RegularizacaoInput } from "./regularizacao.js";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { auditar, RebanhoError, travarAnimais } from "../rebanho/regras.js";
import { transacaoPecuaria } from "../transacao.js";
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
  criteriosVisitaSchema,
  type CriteriosVisita,
} from "./schemas.js";
import { criarAvaliacaoTx, dia, erro, obterEstadosReprodutivosTx } from "./registros.js";
import {
  contextoTarefaTx,
  executarTarefaTx,
  iniciarParticipanteTx,
} from "./iatf.js";
import { avaliarCategoria } from "../rebanho/categoria.calc.js";
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
    const cache = await carregarContextosVisitaTx(tx, input.participantes.map(p => p.animalId), v.data);
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
      if (item.tarefaSanitariaId && item.tarefaIatfId) erro("Selecione somente uma tarefa por atendimento", "participantes");
      if (item.tarefaSanitariaId && !["APLICACAO_SANITARIA", "EXAME_SANITARIO"].includes(input.tipo)) erro("Tarefa sanitária incompatível com a atividade", "participantes");
      if (item.tarefaIatfId && input.tipo !== "TAREFA_IATF") erro("Tarefa reprodutiva incompatível com a atividade", "participantes");
      if (item.tarefaSanitariaId) {
        const tarefa = await tx.tarefaProtocolo.findFirst({
          where: {
            id: item.tarefaSanitariaId,
            AND: [condicaoSituacaoTarefa("PENDENTE")],
            execucao: {
              protocolo: { tipo: "SANITARIO" },
              animalId: item.animalId,
              propriedadeId: input.propriedadeId,
              canceladaEm: null,
            },
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
      const snapshot = await contextoAnimalVisitaTx(tx, animal.id, input.propriedadeId, v.data, cache);
      const criterios = criteriosVisitaSchema.parse(Object.fromEntries(Object.entries((input.contexto.criterios ?? {}) as Record<string, unknown>).filter(([k,v]) => ["categoriaId","loteId","situacao","diasTentativaMin","diasTentativaMax","diasPartoMin","diasPartoMax","diasGestacaoMin","diasGestacaoMax"].includes(k) && v !== "" && v != null)));
      Object.assign(snapshot, {
        motivos: [...(item.motivos ?? []), ...motivosCriterios(criterios)],
        criterios, filtros: input.contexto,
      });
      participantes.push(
        await tx.participanteVisita.create({
          data: {
            atividadeId: atividade.id,
            animalId: animal.id,
            ordem: i + 1,
            tarefaId: item.tarefaIatfId ? await resolverIdReprodutivoTx(tx, "tarefa", item.tarefaIatfId) : item.tarefaSanitariaId,
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
      participantes: participantes.filter((p) => p.atividadeId === a.id).map(p => ({ ...p, tarefaSanitariaId: a.tipo !== "TAREFA_IATF" ? p.tarefaId : null, tarefaIatfId: a.tipo === "TAREFA_IATF" ? p.tarefaId : null })),
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
  versaoRascunho: number,
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
    const atividade = await tx.atividadeVisita.findUniqueOrThrow({ where: { id: participante.atividadeId } });
    if (atividade.tipo === "AVALIACAO_REPRODUTIVA" && typeof rascunho.tipoExameId === "string") {
      await travarTiposExame(tx, [rascunho.tipoExameId]);
      const tipo = await tx.tipoExame.findFirst({ where: { id: rascunho.tipoExameId, ativo: true, tipoResultado: "MULTIPLO", contexto: { in: ["REPRODUTIVO", "COMPARTILHADO"] } } });
      if (!tipo) erro("Selecione um tipo de exame reprodutivo ativo", "tipoExameId");
      conferirFormatoReprodutivo(tipo.tipoResultado, tipo.campos);
      const formatoExameHash = hashFormatoExame(tipo);
      if (rascunho.formatoExameHash && rascunho.formatoExameHash !== formatoExameHash) erro("O formato do exame mudou. Atualize a lista de tipos e revise os resultados", "tipoExameId");
      rascunho = { ...rascunho, formatoExameHash };
    }
    const alteracao = await tx.participanteVisita.updateMany({
      where: { id: participanteId, versaoRascunho, status: { not: "CONFIRMADO" } },
      data: { rascunho: json(rascunho), versaoRascunho: { increment: 1 } },
    });
    if (alteracao.count !== 1)
      throw new RebanhoError("CONFLITO", "O rascunho mudou; recarregue antes de salvar novamente", "versaoRascunho");
    const salva = await tx.participanteVisita.findUniqueOrThrow({ where: { id: participanteId } });
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
                    ...(p.tarefaId
                      ? { tarefaId: p.tarefaId }
                      : {}),
                  });
                })
            : [];
        await travarOrigensAplicacoesTx(tx, aplicacoes);
        if (atividade.tipo === "AVALIACAO_REPRODUTIVA") await travarTiposExame(tx, input.itens.filter(i => i.status === "CONFIRMADO").map(i => {
          const p = participantes.find(p => p.id === i.participanteId)!;
          const dados = i.dados ?? p.rascunho as Record<string, unknown>;
          return typeof dados.tipoExameId === "string" ? dados.tipoExameId : TIPO_EXAME_REPRODUTIVO;
        }));
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
            const dados: Record<string, unknown> = {
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
              const salvo = p.rascunho as Record<string, unknown>;
              const tipoExameId = typeof dados.tipoExameId === "string" ? dados.tipoExameId : TIPO_EXAME_REPRODUTIVO;
              if (tipoExameId !== TIPO_EXAME_REPRODUTIVO && (salvo.tipoExameId !== tipoExameId || typeof salvo.formatoExameHash !== "string"))
                erro("Salve e revise o rascunho deste tipo de exame antes de confirmar", "tipoExameId");
              const { status: _status, dados: _procedimento, inicioEfetivo: _inicio, realizadaEm: _realizada, ...clinicos } = dados;
              fato = await criarAvaliacaoTx(
                tx,
                avaliacaoSchema.parse({ ...clinicos, ...(salvo.tipoExameId === tipoExameId ? { formatoExameHash: salvo.formatoExameHash } : {}) }),
                usuarioId,
              );
              fatoTipo = "AvaliacaoReprodutiva";
            } else if (atividade.tipo === "APLICACAO_SANITARIA") {
              fato = await criarAplicacaoTx(
                tx,
                aplicacaoSchema.parse({
                  ...dados,
                  ...(p.tarefaId
                    ? { tarefaId: p.tarefaId }
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
                  ...(p.tarefaId
                    ? { tarefaId: p.tarefaId }
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
                  inicio: bruto.inicio ?? dados.data,
                  animalId: p.animalId,
                  propriedadeId: input.propriedadeId,
                  responsavel: bruto.responsavel,
                  operacaoServicoId: bruto.operacaoServicoId,
                }),
                usuarioId,
              );
              fatoTipo = "ExecucaoProtocoloSanitario";
            } else if (atividade.tipo === "TAREFA_IATF") {
              if (!p.tarefaId) erro("Tarefa IATF não selecionada");
              if (typeof bruto.realizadaEm !== "string")
                erro("Informe horário da execução", "realizadaEm");
              fato = await executarTarefaTx(
                tx,
                p.tarefaId,
                {
                  propriedadeId: input.propriedadeId,
                  realizadaEm: bruto.realizadaEm,
                  chave: input.chave,
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
                versaoRascunho: { increment: 1 },
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
function motivosCriterios(c: CriteriosVisita) {
  return Object.entries(c).map(([campo, valor]) => `Critério ${campo}: ${valor}`);
}
function correspondeCriterios(a: Record<string, unknown>, c: CriteriosVisita) {
  if(c.categoriaId && (a.categoria as {id:string}|null)?.id !== c.categoriaId)return false;
  if(c.loteId && (a.lote as {id:string}|null)?.id !== c.loteId)return false;
  if(c.situacao && a.situacao !== c.situacao)return false;
  for(const eixo of ["Tentativa", "Parto", "Gestacao"] as const){
    const valor = a[`dias${eixo}`] as number|null, min = c[`dias${eixo}Min`], max = c[`dias${eixo}Max`];
    if((min != null || max != null) && (valor == null || (min != null && valor < min) || (max != null && valor > max)))return false;
  }
  return true;
}
async function carregarContextosVisitaTx(tx: Prisma.TransactionClient, ids: string[], data: Date) {
  const periodo = { desde: { lte: data }, OR: [{ ate: null }, { ate: { gt: data } }] };
  const [animais, locais, estados, categorias, manuais, destinos, ocorrencias, regras, papeis] = await Promise.all([
    tx.animal.findMany({ where: { id: { in: ids } } }),
    tx.localizacaoAnimal.findMany({ where: { animalId: { in: ids }, ...periodo }, include: { lote: true } }),
    obterEstadosReprodutivosTx(tx, ids, data),
    tx.categoriaAnimal.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] }),
    tx.categoriaManualAnimal.findMany({ where: { animalId: { in: ids }, ...periodo }, include: { categoria: true } }),
    tx.destinoAnimal.findMany({ where: { animalId: { in: ids }, ...periodo } }),
    tx.ocorrenciaSanitaria.findMany({ where: { animalId: { in: ids }, status: "VALIDO", inicio: { lte: data }, OR: [{ fim: null }, { fim: { gte: data } }] } }),
    tx.regraSanitariaReprodutiva.findMany({ where: { ativo: true }, orderBy: { id: "asc" } }),
    tx.periodoReprodutivoAnimal.findMany({ where: { animalId: { in: ids }, revogadoEm: null } }),
  ]);
  return { animais, locais, estados, categorias, manuais, destinos, ocorrencias, regras, papeis };
}
async function contextoAnimalVisitaTx(tx: Prisma.TransactionClient, animalId: string, propriedadeId: number, data: Date, cache?: Awaited<ReturnType<typeof carregarContextosVisitaTx>>): Promise<Record<string, unknown>> {
  const dados = cache ?? await carregarContextosVisitaTx(tx, [animalId], data);
  const animal = dados.animais.find(a => a.id === animalId);
  if(!animal)throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado");
  const local = dados.locais.find(l => l.animalId === animalId && l.propriedadeId === propriedadeId);
  const estado = dados.estados.get(animalId)!;
  const manual = dados.manuais.find(m => m.animalId === animalId);
  const destino = dados.destinos.find(d => d.animalId === animalId);
  const ocorrencias = dados.ocorrencias.filter(o => o.animalId === animalId);
  const regras = dados.regras.filter(r => r.propriedadeId === propriedadeId);
  const categorias = dados.categorias;
  const dias = (referencia: Date|null|undefined) => referencia ? Math.floor((data.getTime()-referencia.getTime())/86400000) : null;
  return JSON.parse(JSON.stringify({
    animalId, brinco: animal.brinco, nome: animal.nome, propriedadeId,
    situacao: estado.situacao, partos: estado.partos, tentativasCiclo: estado.tentativasCiclo,
    tentativa: estado.ultimaTentativa, ultimaTentativa: estado.ultimaTentativa,
    gestacao: estado.gestacao, ultimoParto: estado.ultimoParto, restricoes: estado.restricoes,
    restricoesSanitarias: regras.filter(r => ocorrencias.some(o => o.doencaId === r.doencaId)),
    categoria: avaliarCategoria({ ...animal, partos: estado.partos }, categorias, manual?.categoria ?? null, data).categoria,
    aptidao: destino?.aptidao ?? null, papelReprodutivo: resolverPapelReprodutivo(dados.papeis.filter(p => p.animalId === animalId), data).papel,
    papelReprodutivoEstado: resolverPapelReprodutivo(dados.papeis.filter(p => p.animalId === animalId), data).estado,
    lote: local?.lote ? { id: local.lote.id, nome: local.lote.nome } : null,
    localizacaoId: local?.id ?? null, dataReferencia: data.toISOString().slice(0,10), atualizadoEm: animal.atualizadoEm.toISOString(),
    diasTentativa: dias(estado.ultimaTentativa?.data), diasParto: dias(estado.ultimoParto?.data), diasGestacao: dias(estado.gestacao?.confirmadaEm),
  }));
}
export async function sugestoesVisita(
  propriedadeId: number | null,
  data: string,
  criterios: CriteriosVisita = {},
) {
  const scope = propriedadeId == null ? {} : { propriedadeId };
  const [
    tarefasSanitarias,
    programacoes,
    protocolosSanitarios,
    protocolosIatf,
    locais, categorias,
  ] = await Promise.all([
    prisma.tarefaProtocolo.findMany({
      where: {
        previstaPara: { lte: dia(data) },
        AND: [condicaoSituacaoTarefa("PENDENTE")],
        execucao: { ...scope, protocolo: { tipo: "SANITARIO" } },
      },
      include: {
        execucao: { select: { animalId: true, propriedadeId: true } },
        etapa: true,
      },
      orderBy: { previstaPara: "asc" },
      take: 500,
    }),
    prisma.programacaoIatf.findMany({ where: { ...scope, status: "ABERTA" } }),
    prisma.protocolo.findMany({
      where: { publicadoEm: { not: null }, ativo: true },
      orderBy: { nome: "asc" },
    }),
    prisma.protocoloIatf.findMany({
      where: { publicado: true },
      orderBy: { nome: "asc" },
    }),
    prisma.localizacaoAnimal.findMany({
      where: { ...scope, desde: { lte: dia(data) }, OR: [{ ate: null }, { ate: { gt: dia(data) } }], animal: { sexo: "F", dataEntrada: { lte: dia(data) }, dataNascimento: { lte: dia(data) }, baixas: { none: { estornadaEm: null, data: { lt: dia(data) } } } } },
      include: { lote: true }, orderBy: { animalId: "asc" },
    }),
    prisma.categoriaAnimal.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" } }),
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
    },
    orderBy: { previstaEm: "asc" },
  });
  const cache = await carregarContextosVisitaTx(prisma, locais.map(l => l.animalId), dia(data));
  const candidatos: Array<Record<string, unknown>> = await Promise.all(locais.map(l => contextoAnimalVisitaTx(prisma, l.animalId, l.propriedadeId, dia(data), cache).then(a => ({ ...a, motivos: motivosCriterios(criterios), criterios }))));
  const [avaliacoesHistorico, gestacoesPrevistas, tentativasDiagnostico] = await Promise.all([
    prisma.avaliacaoReprodutiva.findMany({ where: { animalId: { in: locais.map(l => l.animalId) }, status: "VALIDO", data: { lte: dia(data) } }, orderBy: [{ data: "desc" }, { criadoEm: "desc" }] }),
    prisma.gestacaoAnimal.findMany({ where: { animalId: { in: locais.map(l => l.animalId) }, status: "VALIDO", confirmadaEm: { lte: dia(data) }, OR: [{ encerradaEm: null }, { encerradaEm: { gt: dia(data) } }], previsaoParto: { not: null } } }),
    prisma.tentativaReprodutiva.findMany({where:{id:{in:candidatos.flatMap(a=>(a.ultimaTentativa as {id:string}|null)?.id ? [(a.ultimaTentativa as {id:string}).id] : [])}},select:{id:true,animalId:true,propriedadeId:true}}),
  ]);
  // Uma avaliação válida posterior substitui o retorno anterior do mesmo animal.
  const avaliacoesRetorno = avaliacoesHistorico.filter((a, i, todas) => a.retornoEm && todas.findIndex(v => v.animalId === a.animalId) === i);
  return {
    tarefasSanitarias: tarefasSanitarias.map((t) => ({
      ...t,
      animalId: t.execucao.animalId,
      nome: `${t.etapa.tipo} · etapa ${t.etapa.ordem}`,
      tipo: t.etapa.tipo,
    })),
    tarefasIatf: tarefasIatf.filter(t => t.previstaEm <= new Date(`${data}T23:59:59-03:00`)).map((t) => ({
      ...t,
      animalId: participantes.find((p) => p.id === t.participanteId)?.animalId,
    })),
    protocolosSanitarios,
    protocolosIatf,
    participantesIatf: participantes,
    animais: candidatos.filter(a => correspondeCriterios(a, criterios)),
    categorias: categorias.map(c => ({ id: c.id, nome: c.nome })),
    lotes: [...new Map(locais.flatMap(l => l.lote ? [[l.lote.id, { id: l.lote.id, nome: l.lote.nome }] as const] : [])).values()],
    criterios,
    retornos: [
      ...tentativasDiagnostico.filter(t => candidatos.some(a => a.animalId === t.animalId && a.situacao === "AGUARDANDO_DIAGNOSTICO" && (a.ultimaTentativa as {id:string})?.id === t.id)).map(t => ({ origem: "TENTATIVA", origemConsultavel:propriedadeId == null || t.propriedadeId === propriedadeId, origemId:propriedadeId == null || t.propriedadeId === propriedadeId ? t.id : null, animalId:t.animalId, propriedadeId:locais.find(l=>l.animalId === t.animalId)!.propriedadeId, data:null, status:"AGUARDANDO_DIAGNOSTICO" })),
      ...avaliacoesRetorno.map(a => ({ origem: "AVALIACAO", origemConsultavel: propriedadeId == null || a.propriedadeId === propriedadeId, origemId: propriedadeId == null || a.propriedadeId === propriedadeId ? a.id : null, animalId: a.animalId, propriedadeId: locais.find(l => l.animalId === a.animalId)!.propriedadeId, data: a.retornoEm, status: a.retornoEm! < dia(data) ? "ATRASADO" : "PENDENTE" })),
      ...tarefasIatf.map(t => ({ origem: "TAREFA_IATF", origemConsultavel: true, origemId: t.id, programacaoId: participantes.find(p => p.id === t.participanteId)?.programacaoId, animalId: participantes.find(p => p.id === t.participanteId)?.animalId, propriedadeId: programacoes.find(p => p.id === participantes.find(a => a.id === t.participanteId)?.programacaoId)?.propriedadeId, data: t.previstaEm, status: t.previstaEm < new Date(`${data}T00:00:00-03:00`) ? "ATRASADO" : "PENDENTE" })),
      ...gestacoesPrevistas.map(g => ({ origem: "PREVISAO_PARTO", origemConsultavel: propriedadeId == null || g.propriedadeId === propriedadeId, origemId: propriedadeId == null || g.propriedadeId === propriedadeId ? g.id : null, animalId: g.animalId, propriedadeId: locais.find(l => l.animalId === g.animalId)!.propriedadeId, data: g.previsaoParto, status: "PREVISTO" })),
    ],
  };
}
async function compararSnapshotTx(
  tx: Prisma.TransactionClient,
  participante: { animalId: string; snapshot: Prisma.JsonValue },
  data: Date,
  propriedadeId: number,
) {
  const snapshot = participante.snapshot as Record<string, unknown>;
  const atual = await contextoAnimalVisitaTx(tx, participante.animalId, propriedadeId, data);
  const alteracoes: string[] = [];
  for (const [campo, mensagem] of [
    ["atualizadoEm", "identidade do animal alterada"], ["localizacaoId", "localização na data alterada"],
    ["tentativa", "tentativa relevante alterada"], ["gestacao", "gestação alterada"],
    ["restricoes", "restrições reprodutivas alteradas"], ["restricoesSanitarias", "restrições sanitárias alteradas"],
    ["ultimoParto", "último parto alterado"], ["partos", "contagem de partos alterada"],
    ["categoria", "categoria alterada"], ["papelReprodutivo", "papel reprodutivo alterado"],
    ["situacao", "situação reprodutiva alterada"],
  ]) {
    if (hashDados(snapshot[campo] ?? null) !== hashDados(atual[campo] ?? null)) alteracoes.push(mensagem);
  }
  return { alteracoes, fingerprintAtual: hashDados(atual) };
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

export async function regularizarParticipanteVisita(id:string, participanteId:string,input:RegularizacaoInput,usuarioId:number|null){
  return transacaoPecuaria(async tx=>{
    const visita = await visitaTx(tx,id,input.propriedadeId);
    if(input.acao === "REABRIR" && visita.encerradaEm)erro("Visita encerrada não pode reabrir um atendimento");
    const p=await tx.participanteVisita.findUnique({where:{id:participanteId}});
    if(!p || !await tx.atividadeVisita.count({where:{id:p.atividadeId,visitaId:id}}))throw new RebanhoError("NAO_ENCONTRADO","Participante não pertence à visita");
    await travarAnimais(tx,[p.animalId]);
    return operacaoIdempotenteTx(tx,{...input,participanteId},usuarioId,"REGULARIZACAO_VISITA",async()=>{
      const atual=await tx.participanteVisita.findUniqueOrThrow({where:{id:participanteId}});
      if(!atual.regularizacaoPendente || atual.status !== "CONFIRMADO")erro("Participante não exige regularização");
      if(atual.tarefaId){
        await regularizarTarefaComumTx(tx,atual.tarefaId,input,usuarioId);
        return tx.participanteVisita.findUniqueOrThrow({where:{id:participanteId}});
      }
      const historicoRegularizacao=eventoRegularizacao(atual.historicoRegularizacao,input,atual,usuarioId);
      if(input.acao === "VINCULAR_SUBSTITUTO"){
        const original = atual.fatoTipo === "TentativaReprodutiva" ? await tx.tentativaReprodutiva.findUnique({where:{id:atual.fatoId!}}) : atual.fatoTipo === "AplicacaoProduto" ? await tx.aplicacaoProduto.findUnique({where:{id:atual.fatoId!}}) : atual.fatoTipo === "ExameAnimal" ? await tx.exameAnimal.findUnique({where:{id:atual.fatoId!}}) : await tx.avaliacaoReprodutiva.findUnique({where:{id:atual.fatoId!}});
        if(!original)erro("Fato original não encontrado");
        await validarSubstitutoTx(tx,atual.fatoTipo!,input,atual.animalId,original.data,atual.fatoId);
        if(await tx.participanteVisita.count({where:{id:{not:participanteId},fatoId:input.fatoId,fatoTipo:atual.fatoTipo}}))erro("Substituto já pertence a outro participante", "fatoId");
        if (atual.fatoTipo === "AplicacaoProduto") await substituirEvidenciaAplicacaoTx(tx, atual.fatoId, input, usuarioId);
      }
      const salvo=await tx.participanteVisita.update({where:{id:participanteId},data:{
        regularizacaoPendente:false,historicoRegularizacao,
        ...(input.acao === "REABRIR" ? {status:"PENDENTE",fatoId:null,fatoTipo:null,rascunho:{},versaoRascunho:{increment:1}} : input.acao === "VINCULAR_SUBSTITUTO" ? {fatoId:input.fatoId} : {}),
      }});
      if(input.acao === "REABRIR")await tx.visitaVeterinaria.update({where:{id},data:{status:"PARCIAL"}});
      await auditar(tx,{entidade:"ParticipanteVisita",entidadeId:participanteId,animalId:p.animalId,propriedadeId:input.propriedadeId,acao:"REGULARIZACAO",usuarioId,antes:atual,depois:salvo});
      return salvo;
    });
  });
}

export async function substitutosParticipanteVisita(id: string, participanteId: string, propriedadeId: number) {
  await visitaTx(prisma, id, propriedadeId);
  const p = await prisma.participanteVisita.findUnique({ where: { id: participanteId } });
  if (!p || !await prisma.atividadeVisita.count({ where: { id: p.atividadeId, visitaId: id } })) throw new RebanhoError("NAO_ENCONTRADO", "Participante não pertence à visita");
  if (!p.regularizacaoPendente) return [];
  if (p.tarefaId) return substitutosTarefaComum(p.tarefaId, propriedadeId);
  return listarSubstitutosTx(prisma, p.fatoTipo ?? "", p.fatoId, p.animalId, propriedadeId);
}
