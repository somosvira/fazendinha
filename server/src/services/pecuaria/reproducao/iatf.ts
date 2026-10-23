import { resolverTipoAplicacaoCadastroTx } from "../protocolos/cadastros-produtos.js";
import { validarReferenciasCusto } from "../custos/referencias-planejadas.js";
import { executarManejoDaTarefaIatfTx } from "../protocolos/execucao.manejos.js";
import { associarMomentosAcoesTx } from "../protocolos/momentos.js";
import { impactosInicioLegado } from "../protocolos/inicio-legado.calc.js";
import crypto from "node:crypto";
import { registrarEventoTarefaTx } from "../protocolos/eventos.js";
import { garantirDemandaProtocoloTx, reconciliarDemandasAnimalTx } from "./acompanhamento.js";
import { lerDataIatf, diaIatf, anteriorIatf, serializarDataIatf, type PrecisaoIatf } from "./horarios.calc.js";
import { conferirFormatoReprodutivo } from "../exames/formatos.js";
import { TIPO_EXAME_REPRODUTIVO } from "../exames/evidencia-reprodutiva.js";
import { regularizarTarefaComumTx, substitutosTarefaComum } from "../protocolos/regularizacao.js";
import { registrarExameTx, travarTiposExame } from "../sanidade/exames.js";
import { executarExameEtapaSchema } from "../sanidade/execucao-etapas.schemas.js";
import { carregarVersaoTx, publicarVersaoTx, inativarVersaoTx } from "../protocolos/versoes.js";
import { etapasReprodutivasDoContrato } from "../protocolos/reproducao.js";
import { resolverIdReprodutivoTx } from "../protocolos/reproducao.js";
import { atualizarParticipacaoReprodutivaTx, atualizarTarefaReprodutivaTx, criarParticipacaoReprodutivaTx, criarProgramacaoReprodutivaTx, criarProtocoloReprodutivoTx, criarTarefasReprodutivasTx, dispensarPendenciasReprodutivasTx } from "../protocolos/reproducao.js";
import type { RegularizacaoInput } from "./regularizacao.js";
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
  dataOuHorario,
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
import { condicaoSituacaoTarefa } from "../protocolos/situacao.js";
import { exigeMotivoExecucao } from "../desvios.calc.js";
const exameDaTarefaSchema = executarExameEtapaSchema.omit({ tipo: true, tarefaId: true }).extend({ chave: z.string().uuid().optional(), observacao: z.string().trim().max(1000).nullish(), formatoExameHash: z.string().regex(/^[a-f0-9]{64}$/).optional() });
const json = (v: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(v));
type EtapaFonte = EtapaIatf & { referencias?: Record<string, unknown> };
async function congelarEtapasTx(
  tx: Prisma.TransactionClient,
  etapas: EtapaIatf[],
  builder = false,
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
  await travarTiposExame(tx, etapas.flatMap(e => e.planoAvaliacao ? [e.planoAvaliacao.tipoExameId ?? TIPO_EXAME_REPRODUTIVO] : e.planoExame ? [e.planoExame.tipoExameId] : []));
  const congeladas: EtapaFonte[] = [];
  for (const [indice, original] of etapas.entries()) {
    let e = original;
    const referencias: Record<string, unknown> = {};
    if (e.planoAplicacao) {
      const p = await tx.produto.findUnique({
        where: { id: e.planoAplicacao.produtoId }, include: { perfilSanitarioProduto: true },
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
      validarReferenciasCusto(e.referenciasCusto, e.planoAplicacao.unidadeDose, true);
      if (builder && e.planoAplicacao.unidadeDose !== p.unidade) erro(`Etapa ${indice + 1}: unidade deve ser herdada do produto`, "etapas");
      const classificacao = await resolverTipoAplicacaoCadastroTx(tx, e.planoAplicacao.tipoAplicacaoId, builder ? p.perfilSanitarioProduto?.tipoAplicacaoId : null, e.momento?.modoAtendimento === "AUTOMATIZADA", `etapas.${indice}.planoAplicacao.tipoAplicacaoId`);
      if (classificacao) e = { ...e, planoAplicacao: { ...e.planoAplicacao, tipoAplicacaoId: classificacao.id } };
      if (builder) e = { ...e, planoAplicacao: { ...e.planoAplicacao!, via: p.perfilSanitarioProduto?.viaPadrao ?? null, orientacaoUso: p.perfilSanitarioProduto?.orientacaoUso ?? null } };
      referencias.produto = { id: p.id, nome: p.nome, unidade: p.unidade, ...(builder ? { viaPadrao: p.perfilSanitarioProduto?.viaPadrao ?? null, orientacaoUso: p.perfilSanitarioProduto?.orientacaoUso ?? null } : {}) };
      if (classificacao) referencias.tipoAplicacao = classificacao;
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
      validarReferenciasCusto(e.referenciasCusto, m.produto.unidade, true);
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
    if (e.planoExame) {
      const tipo = await tx.tipoExame.findFirst({ where: { id: e.planoExame.tipoExameId, ativo: true, contexto: { not: "REPRODUTIVO" } } });
      if (!tipo) erro(`Etapa ${indice + 1}: selecione exame sanitário ativo`, "etapas");
      referencias.exame = { id: tipo.id, nome: tipo.nome, versao: tipo.versaoFormato, tipoResultado: tipo.tipoResultado, campos: tipo.campos, unidade: tipo.unidade, opcoes: tipo.opcoes };
    }
    if (e.planoAvaliacao) {
      const tipoExameId = e.planoAvaliacao.tipoExameId ?? TIPO_EXAME_REPRODUTIVO;
      const tipo = await tx.tipoExame.findFirst({ where: { id: tipoExameId, ativo: true, tipoResultado: "MULTIPLO", contexto: { in: ["REPRODUTIVO", "COMPARTILHADO"] } } });
      if (!tipo) erro(`Etapa ${indice + 1}: selecione exame reprodutivo ativo com vários resultados`, "etapas");
      conferirFormatoReprodutivo(tipo.tipoResultado, tipo.campos);
      referencias.exame = { id: tipo.id, nome: tipo.nome, versao: tipo.versaoFormato, tipoResultado: tipo.tipoResultado, campos: tipo.campos };
      congeladas.push({ ...e, planoAvaliacao: { ...e.planoAvaliacao, tipoExameId }, referencias });
    } else congeladas.push({ ...e, referencias });
  }
  return congeladas;
}
function dadosTarefa(
  participanteId: string,
  e: EtapaFonte & { etapa: number; previstaEm: Date; precisaoTemporal: PrecisaoIatf; previsaoPendente: boolean },
  inicio: Date,
) {
  const { referencias = {}, etapa: indice, previstaEm, precisaoTemporal, previsaoPendente, ...campos } = e;
  return {
    participanteId,
    etapa: indice,
    tipo: e.tipo,
    nome: e.nome,
    previstaEm,
    previsaoOriginal: previstaEm, precisaoTemporal, previsaoPendente,
    planejadoSnapshot: json(
      snapshotIatf(campos, referencias, previstaEm, previstaEm, inicio, precisaoTemporal, previsaoPendente),
    ),
  };
}
export async function criarProtocolo(
  input: z.infer<typeof protocoloSchema>,
  usuarioId: number | null,
) {
  input = protocoloSchema.parse(input);
  return transacaoPecuaria(async (tx) => {
    const origem=input.origemVersaoId?await tx.protocolo.findFirst({where:{id:input.origemVersaoId,tipo:"REPRODUTIVO"}}):null;
    if(input.origemVersaoId&&!origem)erro("Versão de origem reprodutiva não encontrada", "origemVersaoId");
    if (origem && input.nome.trim() !== origem.nome) erro("Uma nova versão deve preservar o protocolo-base", "nome");
    const etapas = await congelarEtapasTx(tx, input.etapas, input.finalidade != null);
    const p = await criarProtocoloReprodutivoTx(tx, {
      data: { ...input, etapas: json(etapas), criadoPorId: usuarioId,...(origem?.referenciaTecnica?{referenciaTecnica:json({...origem.referenciaTecnica as Record<string,unknown>,protocoloOrigemId:origem.id})}:{}) },
    });
    await auditar(tx, {
      entidade: "ProtocoloIatf",
      entidadeId: p.id,
      acao: "VERSAO_CRIADA",
      usuarioId,
      depois: p,
    });
    return { ...p, finalidade: input.finalidade ?? null };
  });
}
export async function listarProtocolos() {
  const [versoes, contratos] = await Promise.all([
    prisma.protocolo.findMany({ where: { tipo: "REPRODUTIVO" }, select: { id: true, ativo: true, finalidade: true, referenciaTecnica:true, descricao: true, publicadoEm: true, atualizadoEm: true, _count: { select: { execucoes: true, rodadas: true } } } }),
    prisma.protocoloIatf.findMany({ orderBy: [{ nome: "asc" }, { versao: "desc" }] }),
  ]);
  const metas = new Map(versoes.map(v => [v.id, v]));
  return contratos.map(p => { const v = metas.get(p.id)!; return { ...p, finalidade: v.finalidade, ativo: v.ativo, referenciaTecnica:v.referenciaTecnica, descricao: v.descricao, publicadoEm: v.publicadoEm, atualizadoEm: v.atualizadoEm, utilizada: v._count.execucoes > 0 || v._count.rodadas > 0 }; });
}
function etapaSemReferencias(e: Prisma.JsonValue) {
  if (!e || typeof e !== "object" || Array.isArray(e)) erro("Etapa de protocolo inválida", "etapas");
  const { referencias: _referencias, ...etapa } = e;
  return etapa;
}
async function publicarReprodutivoTx(tx: Prisma.TransactionClient, id: string, usuarioId: number | null) {
  await publicarVersaoTx(tx, id, "REPRODUTIVO", usuarioId, async p => {
    const validado = protocoloSchema.parse({ nome: p.nome, versao: p.versao, publicado: true, finalidade: p.finalidade, etapas: p.etapas.map(e => etapaSemReferencias(e.configuracao)) });
    const congeladas = await congelarEtapasTx(tx, validado.etapas, validado.finalidade != null);
    const etapas = etapasReprodutivasDoContrato(json(congeladas));
    for (const [i, etapa] of etapas.entries()) await tx.etapaProtocolo.update({ where: { id: p.etapas[i].id }, data: etapa });
  });
  const [contrato, meta] = await Promise.all([tx.protocoloIatf.findUniqueOrThrow({ where: { id } }), tx.protocolo.findUniqueOrThrow({ where: { id }, select: { finalidade: true } })]);
  return { ...contrato, finalidade: meta.finalidade };
}
export async function editarProtocolo(id: string, input: z.infer<typeof protocoloSchema>, usuarioId: number | null) {
  return transacaoPecuaria(async tx => {
    const identidade = await resolverIdReprodutivoTx(tx, "protocolo", id);
    const antes = await carregarVersaoTx(tx, identidade, "REPRODUTIVO", true);
    input = protocoloSchema.parse({ ...input, finalidade: input.finalidade ?? antes.finalidade });
    if (input.versao !== antes.versao) erro("A edição de um rascunho conserva o número da versão", "versao");
    const congeladas = await congelarEtapasTx(tx, input.etapas, input.finalidade != null);
    await tx.etapaProtocolo.deleteMany({ where: { protocoloId: identidade } });
    await tx.momentoProtocolo.deleteMany({ where: { protocoloId: identidade } });
    await tx.protocolo.update({ where: { id: identidade, tipo: "REPRODUTIVO" }, data: { nome: input.nome, descricao: input.descricao, finalidade: input.finalidade, etapas: { deleteMany: {}, create: etapasReprodutivasDoContrato(json(congeladas)) } } });
    await associarMomentosAcoesTx(tx, identidade, input.etapas);
    if (input.publicado) await publicarReprodutivoTx(tx, identidade, usuarioId);
    const depois = await tx.protocoloIatf.findUniqueOrThrow({ where: { id: identidade } });
    await auditar(tx, { entidade: "ProtocoloIatf", entidadeId: identidade, acao: "RASCUNHO_EDITADO", usuarioId, antes, depois });
    return { ...depois, finalidade: input.finalidade ?? antes.finalidade };
  });
}
export async function publicarProtocolo(id: string, usuarioId: number | null) {
  return transacaoPecuaria(async tx => publicarReprodutivoTx(tx, await resolverIdReprodutivoTx(tx, "protocolo", id), usuarioId));
}
export async function inativarProtocolo(id: string, usuarioId: number | null) {
  return transacaoPecuaria(async tx => inativarVersaoTx(tx, await resolverIdReprodutivoTx(tx, "protocolo", id), "REPRODUTIVO", usuarioId));
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
  const protocoloId = await resolverIdReprodutivoTx(tx, "protocolo", input.protocoloId);
  const versaoAtiva = await tx.protocolo.findFirst({ where: { id: protocoloId, tipo: "REPRODUTIVO", ativo: true, publicado: true } });
  const protocolo = versaoAtiva && await tx.protocoloIatf.findFirst({
    where: { id: protocoloId, publicado: true },
  });
  if (!protocolo)
    erro("Selecione uma versão publicada do protocolo", "protocoloId");
  const programacao = await criarProgramacaoReprodutivaTx(tx, {
    data: {
      propriedadeId: input.propriedadeId,
      protocoloId: protocolo.id,
      nome: input.nome,
      inicioPrevisto: lerDataIatf(input.inicioPrevisto).instante,
      precisaoTemporal: lerDataIatf(input.inicioPrevisto).precisao,
      criadoPorId: usuarioId,
    },
  });
  for (const animal of input.animais) {
    const referenciaTemporal = lerDataIatf(animal.inicioPrevisto ?? input.inicioPrevisto);
    const inicioPrevisto = referenciaTemporal.instante;
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
        : dia(referenciaTemporal.data);
    await conferirDisponibilidadeTx(
      tx,
      animal.animalId,
      input.propriedadeId,
      dataDisponibilidade,
      "IATF",
      input.cienciaSanitaria,
    );
    const participante = await criarParticipacaoReprodutivaTx(tx, {
      data: {
        programacaoId: programacao.id,
        animalId: animal.animalId,
        inicioPrevisto, precisaoTemporal: referenciaTemporal.precisao,
        criadoPorId: usuarioId,
      },
    });
    const calendario = calendarioIatf(
      inicioPrevisto,
      protocolo.etapas as EtapaFonte[], referenciaTemporal.precisao,
    );
    await criarTarefasReprodutivasTx(tx, {
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
export const dataNoBrasil = diaIatf;
/** Adesão individual usa a mesma versão e os mesmos executores, sem criar um grupo. */
export const participacaoIndividualReprodutivaSchema = z.object({
  chave: z.string().uuid(), protocoloId: z.string().uuid(), animalId: z.string().uuid(),
  propriedadeId: z.number().int().positive().max(2147483647), inicioReferencia: dataOuHorario,
  cienciaSanitaria: z.boolean().optional(), confirmarSobreposicao: z.boolean().optional(),
  justificativaSobreposicao: z.string().trim().min(5).max(1000).optional(),
}).strict();
export async function criarParticipacaoIndividualReprodutiva(entrada: z.infer<typeof participacaoIndividualReprodutivaSchema>, usuarioId: number | null) {
  const input = participacaoIndividualReprodutivaSchema.parse(entrada);
  return transacaoPecuaria(async tx => {
    await travarAnimais(tx, [input.animalId]);
    return operacaoIdempotenteTx(tx, input, usuarioId, "PARTICIPACAO_REPRODUTIVA_INDIVIDUAL", async () => {
      const protocoloId = await resolverIdReprodutivoTx(tx, "protocolo", input.protocoloId);
      const p = await carregarVersaoTx(tx, protocoloId, "REPRODUTIVO");
      if (!p.ativo || !p.publicado || !p.publicadoEm) erro("Selecione uma versão publicada e ativa do protocolo", "protocoloId");
      const protocolo = await tx.protocoloIatf.findUniqueOrThrow({ where: { id: protocoloId } });
      const temporal = lerDataIatf(input.inicioReferencia);
      await conferirDisponibilidadeTx(tx, input.animalId, input.propriedadeId,
        temporal.instante > new Date() ? dia(diaIatf(new Date())) : dia(temporal.data), "IATF", input.cienciaSanitaria);
      if (temporal.instante > new Date() && !await tx.localizacaoAnimal.findFirst({ where: {
        animalId: input.animalId, propriedadeId: input.propriedadeId, desde: { lte: temporal.instante },
        OR: [{ ate: null }, { ate: { gt: temporal.instante } }],
      } })) erro("Animal não estará neste sítio na referência prevista", "inicioReferencia");
      const sobreposta = await tx.participacaoProtocolo.findFirst({ where: { animalId: input.animalId, canceladaEm: null,
        protocolo: { tipo: "REPRODUTIVO", nome: { equals: p.nome, mode: "insensitive" } },
        tarefas: { some: { realizadaEm: null, dispensadaEm: null } },
      } });
      if (sobreposta && (!input.confirmarSobreposicao || !input.justificativaSobreposicao))
        throw new RebanhoError("CONFLITO", "O animal já tem este protocolo pendente; confirme a sobreposição com justificativa", "confirmarSobreposicao");
      const participante = await tx.participacaoProtocolo.create({ data: { protocoloId, animalId: input.animalId,
        propriedadeId: input.propriedadeId, inicio: temporal.instante, precisaoTemporal: temporal.precisao,
        origemCalendario: "REFERENCIA_PROGRAMADA", criadoPorId: usuarioId } });
      await criarTarefasReprodutivasTx(tx, { data: calendarioIatf(temporal.instante, protocolo.etapas as EtapaFonte[], temporal.precisao)
        .map(e => dadosTarefa(participante.id, e, temporal.instante)) });
      await auditar(tx, { entidade: "ParticipacaoProtocolo", entidadeId: participante.id, animalId: input.animalId,
        propriedadeId: input.propriedadeId, acao: "ADESAO_INDIVIDUAL", usuarioId,
        depois: { ...participante, ...(sobreposta ? { sobreposicao: { participacaoId: sobreposta.id, motivo: input.justificativaSobreposicao } } : {}) } });
      return participante;
    });
  });
}

export async function criarParticipacaoPlanejadaTx(
  tx: Prisma.TransactionClient,
  programacaoId: string,
  animalId: string,
  inicioPrevisto: string,
  usuarioId: number | null,
) {
  const programacao = await tx.programacaoIatf.findUniqueOrThrow({ where: { id: programacaoId } });
  const protocolo = await tx.protocoloIatf.findUniqueOrThrow({ where: { id: programacao.protocoloId } });
  const temporal = lerDataIatf(inicioPrevisto);
  const participante = await criarParticipacaoReprodutivaTx(tx, { data: {
    programacaoId, animalId, inicioPrevisto: temporal.instante,
    precisaoTemporal: temporal.precisao, criadoPorId: usuarioId,
  } });
  await criarTarefasReprodutivasTx(tx, { data: calendarioIatf(temporal.instante, protocolo.etapas as EtapaFonte[], temporal.precisao)
    .map(e => dadosTarefa(participante.id, e, temporal.instante)) });
  await auditar(tx, { entidade: "ParticipanteIatf", entidadeId: participante.id, animalId,
    propriedadeId: programacao.propriedadeId, acao: "PARTICIPACAO_ADICIONADA", usuarioId, depois: participante });
  return participante;
}
async function contextoParticipacaoReprodutivaTx(tx: Prisma.TransactionClient, id: string, propriedadeId: number) {
  const comum = await tx.participacaoProtocolo.findFirst({ where: { id, propriedadeId, protocolo: { tipo: "REPRODUTIVO" } }, include: { rodada: true } });
  if (!comum || comum.rodada && comum.rodada.propriedadeId !== propriedadeId)
    throw new RebanhoError("NAO_ENCONTRADO", "Participação não encontrada neste sítio");
  const participante = await tx.participanteIatf.findUniqueOrThrow({ where: { id } });
  return { comum, participante, programacao: { id: comum.rodada?.id ?? null, protocoloId: comum.protocoloId,
    propriedadeId, status: comum.rodada?.status ?? "ABERTA" } };
}

export async function iniciarParticipanteTx(
  tx: Prisma.TransactionClient,
  id: string,
  propriedadeId: number,
  inicioEfetivo: string,
  usuarioId: number | null,
  cienciaSanitaria = false,
  acaoInicial?: "APLICACAO" | "EXAME" | "AVALIACAO" | "TENTATIVA" | "MANEJO" | "RETIRADA",
) {
  id = await resolverIdReprodutivoTx(tx, "participacao", id);
  const referencia = await tx.participanteIatf.findUnique({ where: { id } });
  if (!referencia)
    throw new RebanhoError("NAO_ENCONTRADO", "Participante não encontrado");
  await travarAnimais(tx, [referencia.animalId]);
  const { participante, comum, programacao } = await contextoParticipacaoReprodutivaTx(tx, id, propriedadeId);
  if (programacao.status !== "ABERTA" || participante.encerradoEm)
    throw new RebanhoError("CONFLITO", "Participação não está aberta neste sítio");
  const temporal = lerDataIatf(inicioEfetivo);
  const inicio = temporal.instante;
  if (anteriorIatf(new Date(), "HORA", inicio, temporal.precisao))
    erro("Início efetivo deve ser um momento já ocorrido", "inicioEfetivo");
  if (participante.inicioEfetivo) {
    if (participante.inicioEfetivo.getTime() === inicio.getTime() && (participante.precisaoInicioEfetivo ?? "HORA") === temporal.precisao)
      return participante;
    erro(
      "O início efetivo já foi registrado; use reprogramação explícita das tarefas",
      "inicioEfetivo",
    );
  }
  if (acaoInicial) await conferirMatrizTx(tx, participante.animalId, propriedadeId, dia(temporal.data));
  else await conferirDisponibilidadeTx(
    tx,
    participante.animalId,
    propriedadeId,
    dia(temporal.data),
    "IATF",
    cienciaSanitaria,
  );
  const protocolo = await tx.protocoloIatf.findUniqueOrThrow({
    where: { id: programacao.protocoloId },
  });
  if (comum.origemCalendario === "INICIO_EFETIVO_LEGADO") for (const etapa of calendarioIatf(
    inicio,
    protocolo.etapas as EtapaFonte[], temporal.precisao,
  )) {
    const tarefa = await tx.tarefaIatf.findUniqueOrThrow({
      where: {
        participanteId_etapa: { participanteId: id, etapa: etapa.etapa },
      },
    });
    if (tarefa.realizadaEm && await tx.tarefaProtocolo.count({where:{id:tarefa.id,...condicaoSituacaoTarefa("REALIZADA")}}))
      erro("Há execução anterior ao início efetivo", "inicioEfetivo");
    if (tarefa.dispensadaEm) continue;
    await atualizarTarefaReprodutivaTx(tx, { usuarioId,
      where: { id: tarefa.id },
      data: {
        previstaEm: etapa.previstaEm, precisaoTemporal: etapa.precisaoTemporal, previsaoPendente: etapa.previsaoPendente,
        historicoReprogramacao: [
          ...(Array.isArray(tarefa.historicoReprogramacao)
            ? tarefa.historicoReprogramacao
            : []),
          {
            motivo: "INICIO_EFETIVO",
            anterior: serializarDataIatf(tarefa.previstaEm, tarefa.precisaoTemporal),
            nova: serializarDataIatf(etapa.previstaEm, etapa.precisaoTemporal),
            precisaoAnterior: tarefa.precisaoTemporal, precisaoNova: etapa.precisaoTemporal, previsaoPendente: etapa.previsaoPendente,
            registradoEm: new Date().toISOString(),
            usuarioId,
          },
        ],
        ...(tarefa.planejadoSnapshot
          ? {
              planejadoSnapshot: json({
                ...(tarefa.planejadoSnapshot as object),
                previstaEm: serializarDataIatf(etapa.previstaEm, etapa.precisaoTemporal),
                inicioReferencia: inicioEfetivo, precisaoTemporal: etapa.precisaoTemporal, previsaoPendente: etapa.previsaoPendente,
              }),
            }
          : {}),
      },
    });
  }
  const salva = await atualizarParticipacaoReprodutivaTx(tx, {
    where: { id },
    data: { inicioEfetivo: inicio, precisaoInicioEfetivo: temporal.precisao },
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
  id = await resolverIdReprodutivoTx(tx, "tarefa", id);
  const tarefa = await tx.tarefaIatf.findUnique({ where: { id } });
  if (!tarefa)
    throw new RebanhoError("NAO_ENCONTRADO", "Tarefa não encontrada");
  const { participante, programacao, comum } = await contextoParticipacaoReprodutivaTx(tx, tarefa.participanteId, propriedadeId);
  return { tarefa, participante, programacao, comum };
}
export async function reprogramarTarefa(id: string, propriedadeId: number, previstaEm: string, motivo: string, usuarioId: number | null, chave?: string) {
  return transacaoPecuaria(async tx => {
    const identidade = await resolverIdReprodutivoTx(tx, "tarefa", id);
    await registrarEventoTarefaTx(tx, identidade, { chave: chave ?? crypto.randomUUID(), propriedadeId, tipo: "ADIAMENTO",
      ocorridaEm: new Date().toISOString(), motivo, previstaPara: previstaEm }, usuarioId, "REPRODUTIVO");
    return tx.tarefaIatf.findUniqueOrThrow({ where: { id: identidade } });
  });
}
export const previaInicioExecucaoSchema = z.object({
  propriedadeId: z.number().int().positive().max(2147483647), realizadaEm: dataOuHorario,
  pagina: z.number().int().positive().default(1), porPagina: z.number().int().positive().max(10).default(10),
}).strict();
type EntradaPreviaInicio = z.input<typeof previaInicioExecucaoSchema>;

async function impactosInicioExecucaoTx(tx: Prisma.TransactionClient, contexto: Awaited<ReturnType<typeof contextoTarefaTx>>, realizadaEm: string) {
  const modoLegado = contexto.comum.origemCalendario === "INICIO_EFETIVO_LEGADO";
  if (!modoLegado || contexto.participante.inicioEfetivo) return { modoLegado, itens: [] };
  const [protocolo, tarefas] = await Promise.all([
    tx.protocoloIatf.findUniqueOrThrow({ where: { id: contexto.comum.protocoloId } }),
    tx.tarefaIatf.findMany({ where: { participanteId: contexto.participante.id }, orderBy: [{ etapa: "asc" }, { id: "asc" }] }),
  ]);
  const marcadas=tarefas.filter(t=>t.realizadaEm).map(t=>t.id);
  if (marcadas.length && await tx.tarefaProtocolo.count({where:{id:{in:marcadas},...condicaoSituacaoTarefa("REALIZADA")}})) erro("Há execução anterior ao início efetivo", "inicioEfetivo");
  return { modoLegado, itens: impactosInicioLegado(realizadaEm, protocolo.etapas as EtapaFonte[], tarefas) };
}

/** Sem auditoria, chave de reenvio ou escritas de domínio; a transação também proíbe escrita no PostgreSQL. */
export async function preverInicioExecucaoTarefa(id: string, entrada: EntradaPreviaInicio) {
  const input = previaInicioExecucaoSchema.parse(entrada);
  const temporal = lerDataIatf(input.realizadaEm);
  if (anteriorIatf(new Date(), "HORA", temporal.instante, temporal.precisao)) erro("A realização deve ter ocorrido até agora", "realizadaEm");
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const referencia = await tx.tarefaProtocolo.findFirst({ where: { OR: [{ id }, { legadoIatfId: id }],
      execucao: { propriedadeId: input.propriedadeId } }, select: { execucao: { select: { protocolo: { select: { tipo: true } } } } } });
    if (!referencia) throw new RebanhoError("NAO_ENCONTRADO", "Tarefa não encontrada neste sítio");
    if (referencia.execucao.protocolo.tipo !== "REPRODUTIVO")
      return { exigeCiencia: false, modoLegado: false, itens: [], total: 0, pagina: 1, porPagina: input.porPagina };
    const contexto = await contextoTarefaTx(tx, id, input.propriedadeId);
    if (contexto.participante.encerradoEm || contexto.tarefa.realizadaEm || contexto.tarefa.dispensadaEm || contexto.programacao.status !== "ABERTA")
      erro("A tarefa exige participação aberta e pendente");
    const { modoLegado, itens } = await impactosInicioExecucaoTx(tx, contexto, input.realizadaEm);
    const total = itens.length, pagina = Math.min(input.pagina, Math.max(1, Math.ceil(total / input.porPagina)));
    return { exigeCiencia: total > 0, modoLegado, itens: itens.slice((pagina - 1) * input.porPagina, pagina * input.porPagina),
      total, pagina, porPagina: input.porPagina };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function prepararExecucaoTarefaTx(
  tx: Prisma.TransactionClient,
  id: string,
  input: {
    chave: string;
    propriedadeId: number;
    realizadaEm: string;
    dados: Record<string, unknown>;
    motivo?: string;
    cienciaRecalendarioLegado?: boolean;
  },
  usuarioId: number | null,
) {
  const referencia = await contextoTarefaTx(tx, id, input.propriedadeId);
  await travarAnimais(tx, [referencia.participante.animalId]);
  let contexto = await contextoTarefaTx(tx, id, input.propriedadeId);
  if (contexto.participante.encerradoEm || contexto.tarefa.dispensadaEm || contexto.programacao.status !== "ABERTA")
    erro("A tarefa exige participação aberta e pendente");
  const comum = await tx.tarefaProtocolo.findUniqueOrThrow({ where: { id: contexto.tarefa.id }, include: {
    vinculos: { include: { aplicacao: true, tentativa: true, exame: true } },
    aplicacoes: { where: { status: "VALIDO" } }, exames: { where: { status: "VALIDO" } }, tentativas: { where: { status: "VALIDO" } },
  } });
  if (comum.regularizacaoPendente || comum.vinculos.some(v => v.estado === "ENCERRADO" || v.aplicacao?.consumoMantido || v.tentativa?.consumoMantido || v.estado === "ATUAL" && (v.aplicacao?.status === "VALIDO" || v.tentativa?.status === "VALIDO" || (v.exame?.status === "VALIDO" && v.exame.realizacao !== "NAO_REALIZADO"))) || comum.aplicacoes.length || comum.exames.some(e => e.realizacao !== "NAO_REALIZADO") || comum.tentativas.length)
    erro("A tarefa já possui execução ou exige regularização");
  if (contexto.tarefa.realizadaEm && !comum.exames.some(e => e.realizacao === "NAO_REALIZADO")
    && !comum.vinculos.some(v => v.estado === "ATUAL" && v.exame?.status === "VALIDO" && v.exame.realizacao === "NAO_REALIZADO"))
    erro("A tarefa já possui realização registrada");
  const impactosInicio = !contexto.participante.inicioEfetivo ? await impactosInicioExecucaoTx(tx, contexto, input.realizadaEm) : { modoLegado: contexto.comum.origemCalendario === "INICIO_EFETIVO_LEGADO", itens: [] };
  if (!contexto.participante.inicioEfetivo) {
    const impactos = impactosInicio;
    // Projeta o início e o calendário somente em memória. Esta função nunca
    // inicia participação, reprograma tarefa ou grava auditoria.
    const temporalInicio = lerDataIatf(input.realizadaEm);
    const impacto = impactos.itens.find(i => i.id === contexto.tarefa.id);
    contexto = { ...contexto,
      participante: { ...contexto.participante, inicioEfetivo: temporalInicio.instante, precisaoInicioEfetivo: temporalInicio.precisao },
      tarefa: impacto ? { ...contexto.tarefa, previstaEm: new Date(impacto.previstaNova), precisaoTemporal: impacto.precisaoNova, previsaoPendente: impacto.previsaoPendente } : contexto.tarefa };
  }
  const { tarefa, participante } = contexto;
  const temporal = lerDataIatf(input.realizadaEm);
  const realizada = temporal.instante;
  const data = temporal.data;
  if (anteriorIatf(new Date(), "HORA", realizada, temporal.precisao) || anteriorIatf(realizada, temporal.precisao, participante.inicioEfetivo!, participante.precisaoInicioEfetivo ?? "HORA"))
    erro("Execução deve ocorrer após início efetivo e até agora", "realizadaEm");
  if (tarefa.tipo === "TENTATIVA")
    await conferirDisponibilidadeTx(
      tx, participante.animalId, input.propriedadeId, dia(data), tentativaSchema.shape.tipo.parse(input.dados.tipo),
      input.dados.cienciaSanitaria === true,
    );
  else if (tarefa.tipo === "APLICACAO")
    await conferirDisponibilidadeTx(
      tx, participante.animalId, input.propriedadeId, dia(data), "IATF",
      input.dados.cienciaSanitaria === true,
    );
  else
    await conferirMatrizTx(tx, participante.animalId, input.propriedadeId, dia(data));
  const planoOriginal = tarefa.planejadoSnapshot as SnapshotIatf | null;
  // A referência operacional pode ser adiada sem reescrever o snapshot publicado.
  const plano = planoOriginal ? { ...planoOriginal, previstaEm: serializarDataIatf(tarefa.previstaEm, tarefa.precisaoTemporal),
    precisaoTemporal: tarefa.precisaoTemporal, previsaoPendente: tarefa.previsaoPendente } : null;
  const demanda = tarefa.tipo === "AVALIACAO"
    ? await tx.demandaAcompanhamentoReprodutivo.findUnique({ where: { tarefaId: tarefa.id } })
    : null;
  const dadosAcompanhamento: Record<string, unknown> = {};
  if (demanda) {
    if (demanda.estado !== "PENDENTE") erro("A demanda desta tarefa não está pendente; revise o acompanhamento", "demandaAcompanhamentoId");
    Object.assign(dadosAcompanhamento, { demandaAcompanhamentoId: demanda.id, finalidade: demanda.finalidade, tentativaId: demanda.tentativaId, gestacaoId: demanda.gestacaoId });
    const regra = demanda.regraSnapshot as Record<string, unknown>;
    if (regra.tipoExameId) dadosAcompanhamento.tipoExameId = regra.tipoExameId;
    for (const [campo, esperado] of Object.entries(dadosAcompanhamento))
      if (input.dados[campo] != null && input.dados[campo] !== esperado)
        erro("Os dados informados divergem da demanda vinculada à tarefa", campo);
  }
  const dados = {
    ...(tarefa.tipo === "AVALIACAO" ? { tipoExameId: plano?.etapa.planoAvaliacao?.tipoExameId ?? TIPO_EXAME_REPRODUTIVO } : {}),
    ...input.dados,
    ...dadosAcompanhamento,
    chave: input.chave,
    animalId: participante.animalId,
    propriedadeId: input.propriedadeId,
    data,
  };
  let preparado: Record<string, unknown>;
  if (tarefa.tipo === "APLICACAO")
    preparado = aplicacaoSchema.parse({
      ...Object.fromEntries(Object.entries(dados).filter(([k]) => k !== "cienciaSanitaria")),
      aplicadaEm: temporal.precisao === "HORA" ? input.realizadaEm : undefined,
    });
  else if (tarefa.tipo === "EXAME")
    preparado = exameDaTarefaSchema.parse(dados);
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
  if(plano?.etapa.orientacaoTemporal){
    const regra=plano.etapa.orientacaoTemporal;
    if(regra.referencia==="INICIO_EFETIVO")plano.referenciaTemporalEfetiva={data:participante.inicioEfetivo!.toISOString(),precisao:participante.precisaoInicioEfetivo??"DIA",fatoId:participante.id};
    else {
      const anteriores=await tx.tarefaIatf.findMany({where:{participanteId:participante.id,etapa:{lt:tarefa.etapa}},orderBy:{etapa:"desc"}});
      const anterior=anteriores[0];
      const atual=anterior?await tx.tarefaProtocolo.findUnique({where:{id:anterior.id},include:{vinculos:{where:{estado:"ATUAL"},include:{aplicacao:true,exame:true,tentativa:true}}}}):null;
      const historico=Array.isArray(atual?.historicoRegularizacao)?atual.historicoRegularizacao:[];
      const ultima=historico.at(-1) as {acao?:string}|undefined;
      const lastro=!!atual&&!atual.regularizacaoPendente&&ultima?.acao!=="ENCERRAR_SEM_SUBSTITUICAO"&&(["MANEJO","RETIRADA"].includes(anterior!.tipo)||atual.vinculos.some(v=>v.aplicacao?.status==="VALIDO"||v.exame?.status==="VALIDO"&&v.exame.realizacao!=="NAO_REALIZADO"||v.tentativa?.status==="VALIDO"));
      plano.referenciaTemporalEfetiva=anterior?.realizadaEm&&lastro?{data:anterior.realizadaEm.toISOString(),precisao:anterior.precisaoRealizacao??"DIA",fatoId:anterior.id}:null;
    }
  }
  const desvio = compararExecucaoIatf(
    plano,
    input.realizadaEm,
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
  return { contexto, tarefa, participante, temporal, realizada, data, preparado, desvio, referenciasRealizadas, plano, impactosInicio };
}

/** Confirmação e prévia usam a mesma preparação; só este limite produz os fatos. */
export async function executarTarefaTx(
  tx: Prisma.TransactionClient,
  id: string,
  input: Parameters<typeof prepararExecucaoTarefaTx>[2],
  usuarioId: number | null,
) {
  const contextoAcao = await contextoTarefaTx(tx, id, input.propriedadeId);
  if (["MANEJO", "RETIRADA"].includes(contextoAcao.tarefa.tipo))
    return executarManejoDaTarefaIatfTx(tx, id, input, usuarioId);
  let preparacao = await prepararExecucaoTarefaTx(tx, id, input, usuarioId);
  if (!preparacao.contexto.comum.inicioEfetivo) {
    if (preparacao.impactosInicio.itens.length && input.cienciaRecalendarioLegado !== true)
      erro("Revise a prévia e confirme ciência das mudanças no calendário legado", "cienciaRecalendarioLegado");
    await iniciarParticipanteTx(tx, preparacao.participante.id, input.propriedadeId, input.realizadaEm, usuarioId, input.dados.cienciaSanitaria === true, z.enum(["APLICACAO", "EXAME", "AVALIACAO", "TENTATIVA"]).parse(preparacao.tarefa.tipo));
    preparacao = await prepararExecucaoTarefaTx(tx, id, input, usuarioId);
  }
  const { tarefa, participante, temporal, realizada, preparado, desvio, referenciasRealizadas, plano } = preparacao;
  if (exigeMotivoExecucao(desvio) && (!input.motivo || input.motivo.trim().length < 5))
    erro(!desvio.aferido ? "Planejamento histórico não aferível: documente motivo antes da execução" : `Execução diverge de ${desvio.diferencas.map(d => d.campo).join(", ")}; informe motivo`, "motivo");
  let fato: { id: string } | null = null,
    vinculo: {
      aplicacaoId?: string;
      tentativaId?: string;
      avaliacaoId?: string;
      exameId?: string;
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
  if (tarefa.tipo === "EXAME") {
    fato = await registrarExameTx(tx, exameDaTarefaSchema.parse(preparado), usuarioId);
    vinculo = { exameId: fato.id };
  }
  const realizadoSnapshot = json({
    versao: 1,
    tipo: tarefa.tipo,
    realizadaEm: serializarDataIatf(realizada, temporal.precisao), precisaoRealizacao: temporal.precisao,
    dados: preparado,
    referencias: referenciasRealizadas,
    fato,
    vinculo,
    usuarioId,
  });
  const desviosSnapshot = json({
    versao: 1,
    ...desvio,
    motivo: input.motivo ?? null,
    planejamentoAusente: !plano,
    registradoEm: new Date().toISOString(),
    usuarioId,
  });
  const salva = await atualizarTarefaReprodutivaTx(tx, { usuarioId,
    where: { id },
    data: {
      realizadaEm: realizada, precisaoRealizacao: temporal.precisao,
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
  if (tarefa.tipo === "AVALIACAO" && preparado.resultado === "INCONCLUSIVO" && fato)
    await garantirDemandaProtocoloTx(tx, tarefa.id, fato.id, usuarioId);
  await reconciliarDemandasAnimalTx(tx, participante.animalId, usuarioId);
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
    cienciaRecalendarioLegado?: boolean;
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
    const participanteId = await resolverIdReprodutivoTx(tx, "participacao", id);
    const participante = await tx.participanteIatf.findUnique({
      where: { id: participanteId },
    });
    if (!participante) throw new RebanhoError("NAO_ENCONTRADO", "Participante não encontrado neste sítio");
    await contextoParticipacaoReprodutivaTx(tx, participanteId, propriedadeId);
    await travarAnimais(tx, [participante.animalId]);
    const atual = await tx.participanteIatf.findUniqueOrThrow({
      where: { id: participanteId },
    });
    if (atual.encerradoEm) return atual;
    const salva = await atualizarParticipacaoReprodutivaTx(tx, {
      where: { id: participanteId },
      data: { encerradoEm: new Date(), motivoEncerramento: motivo },
    });
    await dispensarPendenciasReprodutivasTx(tx, {
      where: { participanteId, realizadaEm: null, dispensadaEm: null },
      data: { dispensadaEm: new Date(), motivo },
    });
    await auditar(tx, {
      entidade: "ParticipanteIatf",
      entidadeId: participanteId,
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
  animalId?: string,
) {
  if (id) id = await resolverIdReprodutivoTx(prisma, "programacao", id);
  const participacoes = animalId ? await prisma.participacaoProtocolo.findMany({
    where: { animalId, protocolo: { tipo: "REPRODUTIVO" }, ...(propriedadeId == null ? {} : { propriedadeId }) },
    select: { rodadaId: true },
  }) : null;
  const programacoes = await prisma.programacaoIatf.findMany({
    where: {
      ...(propriedadeId == null ? {} : { propriedadeId }),
      ...(id ? { id } : participacoes ? { id: { in: participacoes.flatMap(p => p.rodadaId ? [p.rodadaId] : []) } } : {}),
    },
    orderBy: { inicioPrevisto: "desc" },
    ...(animalId ? {} : { take: 200 }),
  });
  if (id && !programacoes.length)
    throw new RebanhoError(
      "NAO_ENCONTRADO",
      "Programação não encontrada neste sítio",
    );
  const participantes = await prisma.participanteIatf.findMany({
    where: { programacaoId: { in: programacoes.map((p) => p.id) }, ...(animalId ? { animalId } : {}) },
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
        const programacaoId = await resolverIdReprodutivoTx(tx, "programacao", id);
        const programacao = await tx.programacaoIatf.findFirst({
          where: { id: programacaoId, propriedadeId: input.propriedadeId, status: "ABERTA" },
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
                programacaoId: programacao.id,
                animalId: animal.animalId,
                encerradoEm: null,
              },
            })
          )
            erro(
              "Animal já tem participação aberta nesta programação",
              "animais",
            );
          const temporal = lerDataIatf(animal.inicioPrevisto);
          const inicio = temporal.instante,
            referencia =
              inicio > new Date()
                ? dia(dataNoBrasil(new Date()))
                : dia(temporal.data);
          await conferirDisponibilidadeTx(
            tx,
            animal.animalId,
            input.propriedadeId,
            referencia,
            "IATF",
            input.cienciaSanitaria,
          );
          const p = await criarParticipacaoReprodutivaTx(tx, {
            data: {
              programacaoId: programacao.id,
              animalId: animal.animalId,
              inicioPrevisto: inicio, precisaoTemporal: temporal.precisao,
              criadoPorId: usuarioId,
            },
          });
          await criarTarefasReprodutivasTx(tx, {
            data: calendarioIatf(inicio, protocolo.etapas as EtapaFonte[], temporal.precisao).map(
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
  id = await resolverIdReprodutivoTx(tx, "tarefa", id);
  const { tarefa } = await contextoTarefaTx(tx, id, input.propriedadeId);
  await regularizarTarefaComumTx(tx, id, input, usuarioId, "REPRODUTIVO", tarefa);
  return tx.tarefaIatf.findUniqueOrThrow({ where: { id } });
}

export async function substitutosTarefa(id: string, propriedadeId: number) {
  const identidade = await resolverIdReprodutivoTx(prisma, "tarefa", id);
  return substitutosTarefaComum(identidade, propriedadeId, "REPRODUTIVO");
}

export const regularizarTarefa = (id:string,input:RegularizacaoInput,usuarioId:number|null) => transacaoPecuaria(async tx=>{
  const contexto=await contextoTarefaTx(tx,id,input.propriedadeId);
  await travarAnimais(tx,[contexto.participante.animalId]);
  return operacaoIdempotenteTx(tx,{...input,tarefaId:id},usuarioId,"REGULARIZACAO_IATF",()=>regularizarTarefaTx(tx,id,input,usuarioId));
});
