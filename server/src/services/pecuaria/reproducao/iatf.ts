import { eventoRegularizacao, validarSubstitutoTx, substituirEvidenciaAplicacaoTx, listarSubstitutosTx, type RegularizacaoInput } from "./regularizacao.js";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { auditar, RebanhoError, travarAnimais } from "../rebanho/regras.js";
import { transacaoPecuaria } from "../transacao.js";
import { criarAplicacaoTx } from "../sanidade/aplicacoes.js";
import { aplicacaoSchema } from "../sanidade/aplicacoes.schemas.js";
import {
  avaliacaoSchema,
  protocoloSchema,
  programacaoSchema,
  tentativaSchema,
  type EtapaIatf,
} from "./schemas.js";
import { calendarioIatf } from "./regras.calc.js";
import {
  conferirDisponibilidadeTx,
  conferirMatrizTx,
  criarTentativaTx,
  criarAvaliacaoTx,
  dia,
  erro,
} from "./registros.js";
import {
  compararExecucaoIatf,
  snapshotIatf,
  type SnapshotIatf,
} from "./iatf.calc.js";
import { travarUsosProduto } from "../../estoque/usos.js";
import { converterQuantidade } from "../../estoque/unidades.js";
import { operacaoIdempotenteTx } from "./operacoes.js";
const json = (v: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(v));
type EtapaFonte = EtapaIatf & { referencias?: Record<string, unknown> };
async function congelarEtapasTx(
  tx: Prisma.TransactionClient,
  etapas: EtapaIatf[],
) {
  const materiais = await tx.materialGenetico.findMany({
    where: {
      id: {
        in: etapas.flatMap((e) =>
          e.planoTentativa ? [e.planoTentativa.materialId] : [],
        ),
      },
    },
    include: { produto: true },
  });
  await travarUsosProduto(tx, [
    ...etapas.flatMap((e) =>
      e.planoAplicacao ? [e.planoAplicacao.produtoId] : [],
    ),
    ...materiais.map((m) => m.produtoId),
  ]);
  const congeladas: EtapaFonte[] = [];
  for (const [indice, e] of etapas.entries()) {
    const referencias: Record<string, unknown> = {};
    if (e.planoAplicacao) {
      const p = await tx.produto.findUnique({
        where: { id: e.planoAplicacao.produtoId },
      });
      if (!p?.ativo || !p.usoSanitario)
        erro(
          `Etapa ${indice + 1}: selecione Produto ativo de uso sanitário`,
          "etapas",
        );
      try {
        converterQuantidade(
          new Prisma.Decimal(e.planoAplicacao.dose),
          e.planoAplicacao.unidadeDose,
          p.unidade,
        );
      } catch {
        erro(
          `Etapa ${indice + 1}: unidade da dose incompatível com Produto`,
          "etapas",
        );
      }
      referencias.produto = { id: p.id, nome: p.nome, unidade: p.unidade };
    }
    if (e.planoTentativa) {
      const m = materiais.find((m) => m.id === e.planoTentativa!.materialId);
      if (
        !m ||
        m.tipo !== (e.planoTentativa.tipo === "IA" ? "SEMEN" : "EMBRIAO") ||
        !m.produto.ativo ||
        !m.produto.usoGenetico
      )
        erro(
          `Etapa ${indice + 1}: material genético incompatível ou indisponível`,
          "etapas",
        );
      if (new Prisma.Decimal(e.planoTentativa.quantidade).decimalPlaces() > 3)
        erro(
          `Etapa ${indice + 1}: quantidade exige até três casas decimais`,
          "etapas",
        );
      referencias.material = {
        id: m.id,
        tipo: m.tipo,
        produtoId: m.produtoId,
        produtoNome: m.produto.nome,
        unidade: m.produto.unidade,
        touroId: m.touroId,
        touroExternoId: m.touroExternoId,
        doadoraId: m.doadoraId,
        doadoraExternaId: m.doadoraExternaId,
        tipoSemen: m.tipoSemen,
      };
    }
    congeladas.push({ ...e, referencias });
  }
  return congeladas;
}
function dadosTarefa(
  participanteId: string,
  e: EtapaFonte & { etapa: number; previstaEm: Date },
  inicio: Date,
) {
  const { referencias = {}, etapa: indice, previstaEm, ...campos } = e;
  return {
    participanteId,
    etapa: indice,
    tipo: e.tipo,
    nome: e.nome,
    previstaEm,
    previsaoOriginal: previstaEm,
    planejadoSnapshot: json(
      snapshotIatf(campos, referencias, previstaEm, previstaEm, inicio),
    ),
  };
}
export async function criarProtocolo(
  input: z.infer<typeof protocoloSchema>,
  usuarioId: number | null,
) {
  input = protocoloSchema.parse(input);
  const tentativas = input.etapas.filter((e) => e.tipo === "TENTATIVA");
  if (input.publicado && !tentativas.length)
    erro(
      "Protocolo publicado deve definir a etapa de tentativa após início efetivo",
      "etapas",
    );
  return transacaoPecuaria(async (tx) => {
    const etapas = await congelarEtapasTx(tx, input.etapas);
    const p = await tx.protocoloIatf.create({
      data: { ...input, etapas: json(etapas), criadoPorId: usuarioId },
    });
    await auditar(tx, {
      entidade: "ProtocoloIatf",
      entidadeId: p.id,
      acao: "VERSAO_CRIADA",
      usuarioId,
      depois: p,
    });
    return p;
  });
}
export async function criarProgramacaoTx(
  tx: Prisma.TransactionClient,
  input: z.infer<typeof programacaoSchema>,
  usuarioId: number | null,
) {
  const ids = input.animais.map((a) => a.animalId);
  if (new Set(ids).size !== ids.length)
    erro("Participantes duplicados", "animais");
  await travarAnimais(tx, ids);
  const protocolo = await tx.protocoloIatf.findFirst({
    where: { id: input.protocoloId, publicado: true },
  });
  if (!protocolo)
    erro("Selecione uma versão publicada do protocolo", "protocoloId");
  const programacao = await tx.programacaoIatf.create({
    data: {
      propriedadeId: input.propriedadeId,
      protocoloId: protocolo.id,
      nome: input.nome,
      inicioPrevisto: new Date(input.inicioPrevisto),
      criadoPorId: usuarioId,
    },
  });
  for (const animal of input.animais) {
    const inicioPrevisto = new Date(
      animal.inicioPrevisto ?? input.inicioPrevisto,
    );
    const dataDisponibilidade =
      inicioPrevisto > new Date()
        ? new Date(
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "America/Sao_Paulo",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date()),
          )
        : dia(dataNoBrasil(inicioPrevisto));
    await conferirDisponibilidadeTx(
      tx,
      animal.animalId,
      input.propriedadeId,
      dataDisponibilidade,
      "IATF",
      input.cienciaSanitaria,
    );
    const participante = await tx.participanteIatf.create({
      data: {
        programacaoId: programacao.id,
        animalId: animal.animalId,
        inicioPrevisto,
        criadoPorId: usuarioId,
      },
    });
    const calendario = calendarioIatf(
      inicioPrevisto,
      protocolo.etapas as EtapaFonte[],
    );
    await tx.tarefaIatf.createMany({
      data: calendario.map((e) =>
        dadosTarefa(participante.id, e, inicioPrevisto),
      ),
    });
  }
  await auditar(tx, {
    entidade: "ProgramacaoIatf",
    entidadeId: programacao.id,
    propriedadeId: input.propriedadeId,
    acao: "CRIACAO",
    usuarioId,
    depois: { programacao, animais: ids },
  });
  return programacao;
}
export const criarProgramacao = (
  input: z.infer<typeof programacaoSchema>,
  usuarioId: number | null,
) =>
  transacaoPecuaria(async (tx) => {
    await travarAnimais(
      tx,
      input.animais.map((a) => a.animalId),
    );
    return operacaoIdempotenteTx(tx, input, usuarioId, "PROGRAMACAO_IATF", () =>
      criarProgramacaoTx(tx, input, usuarioId),
    );
  });
export function dataNoBrasil(momento: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(momento);
}
export async function iniciarParticipanteTx(
  tx: Prisma.TransactionClient,
  id: string,
  propriedadeId: number,
  inicioEfetivo: string,
  usuarioId: number | null,
  cienciaSanitaria = false,
) {
  const referencia = await tx.participanteIatf.findUnique({ where: { id } });
  if (!referencia)
    throw new RebanhoError("NAO_ENCONTRADO", "Participante não encontrado");
  await travarAnimais(tx, [referencia.animalId]);
  const participante = await tx.participanteIatf.findUniqueOrThrow({
    where: { id },
  });
  const programacao = await tx.programacaoIatf.findFirst({
    where: { id: participante.programacaoId, propriedadeId, status: "ABERTA" },
  });
  if (!programacao || participante.encerradoEm)
    throw new RebanhoError(
      "NAO_ENCONTRADO",
      "Participação não está aberta neste sítio",
    );
  const inicio = new Date(inicioEfetivo);
  if (inicio > new Date() || !Number.isFinite(inicio.getTime()))
    erro("Início efetivo deve ser um momento já ocorrido", "inicioEfetivo");
  if (participante.inicioEfetivo) {
    if (participante.inicioEfetivo.getTime() === inicio.getTime())
      return participante;
    erro(
      "O início efetivo já foi registrado; use reprogramação explícita das tarefas",
      "inicioEfetivo",
    );
  }
  await conferirDisponibilidadeTx(
    tx,
    participante.animalId,
    propriedadeId,
    dia(dataNoBrasil(inicio)),
    "IATF",
    cienciaSanitaria,
  );
  const protocolo = await tx.protocoloIatf.findUniqueOrThrow({
    where: { id: programacao.protocoloId },
  });
  for (const etapa of calendarioIatf(
    inicio,
    protocolo.etapas as EtapaFonte[],
  )) {
    const tarefa = await tx.tarefaIatf.findUniqueOrThrow({
      where: {
        participanteId_etapa: { participanteId: id, etapa: etapa.etapa },
      },
    });
    if (tarefa.realizadaEm)
      erro("Há execução anterior ao início efetivo", "inicioEfetivo");
    await tx.tarefaIatf.update({
      where: { id: tarefa.id },
      data: {
        previstaEm: etapa.previstaEm,
        historicoReprogramacao: [
          ...(Array.isArray(tarefa.historicoReprogramacao)
            ? tarefa.historicoReprogramacao
            : []),
          {
            motivo: "INICIO_EFETIVO",
            anterior: tarefa.previstaEm.toISOString(),
            nova: etapa.previstaEm.toISOString(),
            registradoEm: new Date().toISOString(),
            usuarioId,
          },
        ],
        ...(tarefa.planejadoSnapshot
          ? {
              planejadoSnapshot: json({
                ...(tarefa.planejadoSnapshot as object),
                previstaEm: etapa.previstaEm.toISOString(),
                inicioReferencia: inicio.toISOString(),
              }),
            }
          : {}),
      },
    });
  }
  const salva = await tx.participanteIatf.update({
    where: { id },
    data: { inicioEfetivo: inicio },
  });
  await auditar(tx, {
    entidade: "ParticipanteIatf",
    entidadeId: id,
    animalId: participante.animalId,
    propriedadeId,
    acao: "INICIO_EFETIVO",
    usuarioId,
    antes: participante,
    depois: salva,
  });
  return salva;
}
export const iniciarParticipante = (
  id: string,
  propriedadeId: number,
  inicio: string,
  usuarioId: number | null,
  cienciaSanitaria = false,
) =>
  transacaoPecuaria((tx) =>
    iniciarParticipanteTx(
      tx,
      id,
      propriedadeId,
      inicio,
      usuarioId,
      cienciaSanitaria,
    ),
  );
export async function contextoTarefaTx(
  tx: Prisma.TransactionClient,
  id: string,
  propriedadeId: number,
) {
  const tarefa = await tx.tarefaIatf.findUnique({ where: { id } });
  if (!tarefa)
    throw new RebanhoError("NAO_ENCONTRADO", "Tarefa não encontrada");
  const participante = await tx.participanteIatf.findUniqueOrThrow({
    where: { id: tarefa.participanteId },
  });
  const programacao = await tx.programacaoIatf.findFirst({
    where: { id: participante.programacaoId, propriedadeId },
  });
  if (!programacao)
    throw new RebanhoError(
      "NAO_ENCONTRADO",
      "Tarefa não encontrada neste sítio",
    );
  return { tarefa, participante, programacao };
}
export async function reprogramarTarefa(
  id: string,
  propriedadeId: number,
  previstaEm: string,
  motivo: string,
  usuarioId: number | null,
) {
  return transacaoPecuaria(async (tx) => {
    const referencia = await contextoTarefaTx(tx, id, propriedadeId);
    await travarAnimais(tx, [referencia.participante.animalId]);
    const { tarefa, participante, programacao } = await contextoTarefaTx(
      tx,
      id,
      propriedadeId,
    );
    if (
      tarefa.realizadaEm ||
      tarefa.dispensadaEm ||
      participante.encerradoEm ||
      programacao.status !== "ABERTA"
    )
      erro("Tarefa não está pendente");
    const historico = Array.isArray(tarefa.historicoReprogramacao)
      ? tarefa.historicoReprogramacao
      : [];
    const salva = await tx.tarefaIatf.update({
      where: { id },
      data: {
        previstaEm: new Date(previstaEm),
        historicoReprogramacao: [
          ...historico,
          {
            motivo,
            anterior: tarefa.previstaEm.toISOString(),
            nova: previstaEm,
            usuarioId,
            registradoEm: new Date().toISOString(),
          },
        ],
        ...(tarefa.planejadoSnapshot
          ? {
              planejadoSnapshot: json({
                ...(tarefa.planejadoSnapshot as object),
                previstaEm: new Date(previstaEm).toISOString(),
              }),
            }
          : {}),
      },
    });
    await auditar(tx, {
      entidade: "TarefaIatf",
      entidadeId: id,
      animalId: participante.animalId,
      propriedadeId,
      acao: "REPROGRAMACAO",
      usuarioId,
      antes: tarefa,
      depois: salva,
    });
    return salva;
  });
}
export async function executarTarefaTx(
  tx: Prisma.TransactionClient,
  id: string,
  input: {
    propriedadeId: number;
    realizadaEm: string;
    dados: Record<string, unknown>;
    motivo?: string;
  },
  usuarioId: number | null,
) {
  const referencia = await contextoTarefaTx(tx, id, input.propriedadeId);
  await travarAnimais(tx, [referencia.participante.animalId]);
  const { tarefa, participante, programacao } = await contextoTarefaTx(
    tx,
    id,
    input.propriedadeId,
  );
  if (
    !participante.inicioEfetivo ||
    participante.encerradoEm ||
    tarefa.realizadaEm ||
    tarefa.dispensadaEm ||
    programacao.status !== "ABERTA"
  )
    erro("A tarefa exige participação iniciada e pendente");
  const realizada = new Date(input.realizadaEm);
  if (!Number.isFinite(realizada.getTime()))
    erro("Momento de execução inválido", "realizadaEm");
  const data = dataNoBrasil(realizada);
  if (realizada > new Date() || realizada < participante.inicioEfetivo)
    erro(
      "Execução deve ocorrer após início efetivo e até agora",
      "realizadaEm",
    );
  if (["APLICACAO", "MANEJO", "TENTATIVA"].includes(tarefa.tipo))
    await conferirDisponibilidadeTx(
      tx, participante.animalId, input.propriedadeId, dia(data), "IATF",
      input.dados.cienciaSanitaria === true,
    );
  else
    await conferirMatrizTx(tx, participante.animalId, input.propriedadeId, dia(data));
  const dados = {
    ...input.dados,
    animalId: participante.animalId,
    propriedadeId: input.propriedadeId,
    data,
  };
  let preparado: Record<string, unknown>;
  if (tarefa.tipo === "APLICACAO")
    preparado = aplicacaoSchema.parse({
      ...Object.fromEntries(Object.entries(dados).filter(([k]) => k !== "cienciaSanitaria")),
      aplicadaEm: input.realizadaEm,
    });
  else if (tarefa.tipo === "TENTATIVA")
    preparado = tentativaSchema.parse(dados);
  else if (tarefa.tipo === "AVALIACAO")
    preparado = avaliacaoSchema.parse(dados);
  else if (["MANEJO", "RETIRADA"].includes(tarefa.tipo))
    preparado = z
      .object({
        observacao: z.string().trim().max(1000).nullish(),
        responsavel: z.string().trim().max(160).nullish(),
      })
      .strict()
      .parse(Object.fromEntries(Object.entries(input.dados).filter(([k]) => k !== "cienciaSanitaria")));
  else erro("Tipo de tarefa desconhecido; revise a versão do protocolo");
  const plano = tarefa.planejadoSnapshot as SnapshotIatf | null;
  const desvio = compararExecucaoIatf(
    plano,
    realizada.toISOString(),
    preparado,
  );
  const referenciasRealizadas: Record<string, unknown> = {};
  if (tarefa.tipo === "TENTATIVA" && typeof preparado.materialId === "string") {
    const m = await tx.materialGenetico.findUnique({
      where: { id: preparado.materialId },
      include: { produto: true },
    });
    if (m) {
      referenciasRealizadas.material = {
        id: m.id,
        tipo: m.tipo,
        produtoId: m.produtoId,
        produtoNome: m.produto.nome,
        unidade: m.produto.unidade,
        touroId: m.touroId,
        touroExternoId: m.touroExternoId,
        doadoraId: m.doadoraId,
        doadoraExternaId: m.doadoraExternaId,
        tipoSemen: m.tipoSemen,
      };
      const esperado = plano?.referencias.material as
        | Record<string, unknown>
        | undefined;
      if (esperado && esperado.id === m.id)
        for (const campo of [
          "tipo",
          "produtoId",
          "unidade",
          "touroId",
          "touroExternoId",
          "doadoraId",
          "doadoraExternaId",
          "tipoSemen",
        ]) {
          const atual = (
            referenciasRealizadas.material as Record<string, unknown>
          )[campo];
          if ((esperado[campo] ?? null) !== (atual ?? null))
            desvio.diferencas.push({
              campo: `material.${campo}`,
              planejado: esperado[campo] ?? null,
              realizado: atual ?? null,
            });
        }
    }
  }
  if (tarefa.tipo === "APLICACAO" && typeof preparado.produtoId === "string") {
    const p = await tx.produto.findUnique({
      where: { id: preparado.produtoId },
    });
    if (p)
      referenciasRealizadas.produto = {
        id: p.id,
        nome: p.nome,
        unidade: p.unidade,
      };
  }
  if (
    (!desvio.aferido || desvio.diferencas.length) &&
    (!input.motivo || input.motivo.trim().length < 5)
  )
    erro(
      !desvio.aferido
        ? "Planejamento histórico não aferível: documente motivo antes da execução"
        : `Execução diverge de ${desvio.diferencas.map((d) => d.campo).join(", ")}; informe motivo`,
      "motivo",
    );
  let fato: { id: string } | null = null,
    vinculo: {
      aplicacaoId?: string;
      tentativaId?: string;
      avaliacaoId?: string;
    } = {};
  if (tarefa.tipo === "APLICACAO") {
    fato = await criarAplicacaoTx(
      tx,
      aplicacaoSchema.parse(preparado),
      usuarioId,
    );
    vinculo = { aplicacaoId: fato.id };
  }
  if (tarefa.tipo === "TENTATIVA") {
    fato = await criarTentativaTx(
      tx,
      tentativaSchema.parse(preparado),
      usuarioId,
    );
    vinculo = { tentativaId: fato.id };
  }
  if (tarefa.tipo === "AVALIACAO") {
    fato = await criarAvaliacaoTx(
      tx,
      avaliacaoSchema.parse(preparado),
      usuarioId,
    );
    vinculo = { avaliacaoId: fato.id };
  }
  const realizadoSnapshot = json({
    versao: 1,
    tipo: tarefa.tipo,
    realizadaEm: realizada.toISOString(),
    dados: preparado,
    referencias: referenciasRealizadas,
    fato,
    vinculo,
    usuarioId,
  });
  const desviosSnapshot = json({
    ...desvio,
    motivo: input.motivo ?? null,
    planejamentoAusente: !plano,
    registradoEm: new Date().toISOString(),
    usuarioId,
  });
  const salva = await tx.tarefaIatf.update({
    where: { id },
    data: {
      realizadaEm: realizada,
      motivo: input.motivo,
      realizadoSnapshot,
      desviosSnapshot,
      ...vinculo,
    },
  });
  await auditar(tx, {
    entidade: "TarefaIatf",
    entidadeId: id,
    animalId: participante.animalId,
    propriedadeId: input.propriedadeId,
    acao: "EXECUCAO",
    usuarioId,
    antes: tarefa,
    depois: { ...salva, fato },
  });
  return salva;
}
export const executarTarefa = (
  id: string,
  input: {
    propriedadeId: number;
    chave: string;
    realizadaEm: string;
    dados: Record<string, unknown>;
    motivo?: string;
  },
  usuarioId: number | null,
) =>
  transacaoPecuaria(async (tx) => {
    const contexto = await contextoTarefaTx(tx, id, input.propriedadeId);
    await travarAnimais(tx, [contexto.participante.animalId]);
    return operacaoIdempotenteTx(
      tx,
      { ...input, tarefaId: id },
      usuarioId,
      "EXECUCAO_IATF",
      () => executarTarefaTx(tx, id, input, usuarioId),
    );
  });
export async function retirarParticipante(
  id: string,
  propriedadeId: number,
  motivo: string,
  usuarioId: number | null,
) {
  return transacaoPecuaria(async (tx) => {
    const participante = await tx.participanteIatf.findUnique({
      where: { id },
    });
    if (
      !participante ||
      !(await tx.programacaoIatf.count({
        where: { id: participante.programacaoId, propriedadeId },
      }))
    )
      throw new RebanhoError(
        "NAO_ENCONTRADO",
        "Participante não encontrado neste sítio",
      );
    await travarAnimais(tx, [participante.animalId]);
    const atual = await tx.participanteIatf.findUniqueOrThrow({
      where: { id },
    });
    if (atual.encerradoEm) return atual;
    const salva = await tx.participanteIatf.update({
      where: { id },
      data: { encerradoEm: new Date(), motivoEncerramento: motivo },
    });
    await tx.tarefaIatf.updateMany({
      where: { participanteId: id, realizadaEm: null, dispensadaEm: null },
      data: { dispensadaEm: new Date(), motivo },
    });
    await auditar(tx, {
      entidade: "ParticipanteIatf",
      entidadeId: id,
      animalId: participante.animalId,
      propriedadeId,
      acao: "RETIRADA",
      usuarioId,
      antes: participante,
      depois: salva,
    });
    return salva;
  });
}
export async function listarProgramacoes(
  propriedadeId: number | null,
  id?: string,
) {
  const programacoes = await prisma.programacaoIatf.findMany({
    where: {
      ...(propriedadeId == null ? {} : { propriedadeId }),
      ...(id ? { id } : {}),
    },
    orderBy: { inicioPrevisto: "desc" },
    take: 200,
  });
  if (id && !programacoes.length)
    throw new RebanhoError(
      "NAO_ENCONTRADO",
      "Programação não encontrada neste sítio",
    );
  const participantes = await prisma.participanteIatf.findMany({
    where: { programacaoId: { in: programacoes.map((p) => p.id) } },
  });
  const tarefas = await prisma.tarefaIatf.findMany({
    where: { participanteId: { in: participantes.map((p) => p.id) } },
    orderBy: { etapa: "asc" },
  });
  const protocolos = await prisma.protocoloIatf.findMany({
    where: { id: { in: programacoes.map((p) => p.protocoloId) } },
  });
  return programacoes.map((p) => ({
    ...p,
    protocolo: protocolos.find((v) => v.id === p.protocoloId),
    participantes: participantes
      .filter((a) => a.programacaoId === p.id)
      .map((a) => ({
        ...a,
        tarefas: tarefas.filter((t) => t.participanteId === a.id),
      })),
  }));
}
export async function adicionarParticipantes(
  id: string,
  input: {
    propriedadeId: number;
    chave: string;
    animais: { animalId: string; inicioPrevisto: string }[];
    cienciaSanitaria?: boolean;
  },
  usuarioId: number | null,
) {
  return transacaoPecuaria(async (tx) => {
    const ids = input.animais.map((a) => a.animalId);
    if (new Set(ids).size !== ids.length)
      erro("Participante duplicado", "animais");
    await travarAnimais(tx, ids);
    return operacaoIdempotenteTx(
      tx,
      { ...input, programacaoId: id },
      usuarioId,
      "PARTICIPANTES_IATF",
      async () => {
        const programacao = await tx.programacaoIatf.findFirst({
          where: { id, propriedadeId: input.propriedadeId, status: "ABERTA" },
        });
        if (!programacao)
          throw new RebanhoError(
            "NAO_ENCONTRADO",
            "Programação aberta não encontrada neste sítio",
          );
        const protocolo = await tx.protocoloIatf.findUniqueOrThrow({
            where: { id: programacao.protocoloId },
          }),
          participantes = [];
        for (const animal of input.animais) {
          if (
            await tx.participanteIatf.count({
              where: {
                programacaoId: id,
                animalId: animal.animalId,
                encerradoEm: null,
              },
            })
          )
            erro(
              "Animal já tem participação aberta nesta programação",
              "animais",
            );
          const inicio = new Date(animal.inicioPrevisto),
            referencia =
              inicio > new Date()
                ? dia(dataNoBrasil(new Date()))
                : dia(dataNoBrasil(inicio));
          await conferirDisponibilidadeTx(
            tx,
            animal.animalId,
            input.propriedadeId,
            referencia,
            "IATF",
            input.cienciaSanitaria,
          );
          const p = await tx.participanteIatf.create({
            data: {
              programacaoId: id,
              animalId: animal.animalId,
              inicioPrevisto: inicio,
              criadoPorId: usuarioId,
            },
          });
          await tx.tarefaIatf.createMany({
            data: calendarioIatf(inicio, protocolo.etapas as EtapaFonte[]).map(
              (e) => dadosTarefa(p.id, e, inicio),
            ),
          });
          participantes.push(p);
          await auditar(tx, {
            entidade: "ParticipanteIatf",
            entidadeId: p.id,
            animalId: p.animalId,
            propriedadeId: input.propriedadeId,
            acao: "PARTICIPACAO_ADICIONADA",
            usuarioId,
            depois: p,
          });
        }
        return { participantes };
      },
    );
  });
}

export async function regularizarTarefaTx(tx: Prisma.TransactionClient, id: string, input: RegularizacaoInput, usuarioId: number | null) {
  const { tarefa, participante, programacao } = await contextoTarefaTx(tx, id, input.propriedadeId);
  if(!tarefa.regularizacaoPendente || !tarefa.realizadaEm)
    erro("Tarefa não exige regularização");
  if(input.acao === "REABRIR" && (participante.encerradoEm || programacao.status !== "ABERTA"))
    erro("A participação precisa estar aberta para reabrir uma tarefa");
  const historicoRegularizacao = eventoRegularizacao(tarefa.historicoRegularizacao, input, tarefa, usuarioId);
  const tipo = tarefa.tipo === "TENTATIVA" ? "TentativaReprodutiva" : tarefa.tipo === "APLICACAO" ? "AplicacaoProduto" : "AvaliacaoReprodutiva";
  const campoVinculo = tarefa.tipo === "TENTATIVA" ? "tentativaId" : tarefa.tipo === "APLICACAO" ? "aplicacaoId" : "avaliacaoId";
  if(input.acao === "VINCULAR_SUBSTITUTO") {
    await validarSubstitutoTx(tx, tipo, input, participante.animalId, dia(dataNoBrasil(tarefa.realizadaEm)), tarefa[campoVinculo]);
    if(await tx.tarefaIatf.count({where: {id: {not:id}, [campoVinculo]: input.fatoId}}))
      erro("Substituto já pertence a outra tarefa", "fatoId");
    if (tipo === "AplicacaoProduto") await substituirEvidenciaAplicacaoTx(tx, tarefa.aplicacaoId, input, usuarioId);
  }
  const salva = await tx.tarefaIatf.update({where:{id},data:{
    regularizacaoPendente:false, historicoRegularizacao,
    ...(input.acao === "REABRIR" ? {realizadaEm:null, tentativaId:null, avaliacaoId:null, aplicacaoId:null, realizadoSnapshot:Prisma.DbNull, desviosSnapshot:Prisma.DbNull, motivo:input.motivo}
      : input.acao === "VINCULAR_SUBSTITUTO" ? {[campoVinculo]: input.fatoId} : {}),
  }});
  const originalId = tarefa[campoVinculo];
  const vinculados = await tx.participanteVisita.findMany({where:{regularizacaoPendente:true,OR:[{tarefaIatfId:id},{fatoTipo:"TarefaIatf",fatoId:id},...(originalId ? [{fatoTipo:tipo,fatoId:originalId}] : [])]}});
  const atividadesVinculadas = await tx.atividadeVisita.findMany({where:{id:{in:vinculados.map(v=>v.atividadeId)}}});
  const visitasVinculadas = await tx.visitaVeterinaria.findMany({where:{id:{in:atividadesVinculadas.map(a=>a.visitaId)}}});
  if(input.acao === "REABRIR" && visitasVinculadas.some(v=>v.encerradaEm))
    erro("Atendimento pertence a visita encerrada; registre a nova intervenção em outra atividade");
  for(const visita of vinculados) await tx.participanteVisita.update({where:{id:visita.id},data:{
    regularizacaoPendente:false,
    historicoRegularizacao:eventoRegularizacao(visita.historicoRegularizacao,input,visita,usuarioId),
    ...(input.acao === "REABRIR" ? {status:"PENDENTE",fatoId:null,fatoTipo:null,rascunho:{},versaoRascunho:{increment:1}} : input.acao === "VINCULAR_SUBSTITUTO" && visita.fatoTipo !== "TarefaIatf" ? {fatoId:input.fatoId} : {}),
  }});
  if(input.acao === "REABRIR") await tx.visitaVeterinaria.updateMany({where:{id:{in:visitasVinculadas.map(v=>v.id)}},data:{status:"PARCIAL"}});
  await auditar(tx,{entidade:"TarefaIatf",entidadeId:id,animalId:participante.animalId,propriedadeId:input.propriedadeId,acao:"REGULARIZACAO",usuarioId,antes:tarefa,depois:salva});
  return salva;
}

export async function substitutosTarefa(id: string, propriedadeId: number) {
  const { tarefa, participante } = await contextoTarefaTx(prisma, id, propriedadeId);
  if (!tarefa.regularizacaoPendente) return [];
  const tipo = tarefa.tipo === "TENTATIVA" ? "TentativaReprodutiva" : tarefa.tipo === "APLICACAO" ? "AplicacaoProduto" : "AvaliacaoReprodutiva";
  return listarSubstitutosTx(prisma, tipo, tarefa.tentativaId ?? tarefa.aplicacaoId ?? tarefa.avaliacaoId, participante.animalId, propriedadeId);
}
export const regularizarTarefa = (id:string,input:RegularizacaoInput,usuarioId:number|null) => transacaoPecuaria(async tx=>{
  const contexto=await contextoTarefaTx(tx,id,input.propriedadeId);
  await travarAnimais(tx,[contexto.participante.animalId]);
  return operacaoIdempotenteTx(tx,{...input,tarefaId:id},usuarioId,"REGULARIZACAO_IATF",()=>regularizarTarefaTx(tx,id,input,usuarioId));
});
