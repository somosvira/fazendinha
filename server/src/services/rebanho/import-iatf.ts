import type { PrismaClient } from "@prisma/client";
import { materializarExecucoes } from "./iatf.js";

type DbIatf = Pick<PrismaClient,
  "protocoloIATF" | "etapaProtocoloIATF" | "principioProtocoloIATF" |
  "programacaoIATFLote" | "aplicacaoProtocoloIATF"
>;

export interface ProtocoloIatfLegado { ideagriId: number; nome: string; finalidade: "IATF" | "TETF" }
export interface PrincipioProtocoloLegado { protocoloIdeagriId: number; dia: number; principio: string | null; produto: string | null; dose: string | null; uso: string | null }
export interface ProgramacaoIatfLegada { ideagriId: number; nome: string | null; dataInicio: string; protocoloIdeagriId: number }
export interface AssociacaoProgramacaoLegada { numero: string; ideagriId: number; programacaoIdeagriId: number; usoCidr: boolean; estimulo: string | null; perdaImplante: boolean }
export interface DadosIatfLegado {
  protocolosIatf?: ProtocoloIatfLegado[];
  principiosProtocolo?: PrincipioProtocoloLegado[];
  programacoesIatf?: ProgramacaoIatfLegada[];
  associacoesProgramacao?: AssociacaoProgramacaoLegada[];
}
export interface ResultadoImportIatf { protocolos: number; principios: number; programacoes: number; associacoes: number }

const dataDb = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Importa o contrato intermediário IATF usando IDs da fonte como chaves idempotentes. */
export async function importarIatfLegado(
  db: DbIatf,
  dados: DadosIatfLegado,
  idByNumero: ReadonlyMap<string, number>,
): Promise<ResultadoImportIatf> {
  const protocolos = dados.protocolosIatf ?? [];
  const principios = dados.principiosProtocolo ?? [];
  const programacoes = dados.programacoesIatf ?? [];
  const associacoes = dados.associacoesProgramacao ?? [];
  if (!protocolos.length && !principios.length && !programacoes.length && !associacoes.length) {
    return { protocolos: 0, principios: 0, programacoes: 0, associacoes: 0 };
  }

  const protocoloIdPorOrigem = new Map<number, number>();
  for (const protocolo of protocolos) {
    const row = await db.protocoloIATF.upsert({
      where: { ideagriId: protocolo.ideagriId },
      create: { ideagriId: protocolo.ideagriId, nome: protocolo.nome, finalidade: protocolo.finalidade },
      update: { nome: protocolo.nome, finalidade: protocolo.finalidade },
    });
    protocoloIdPorOrigem.set(protocolo.ideagriId, row.id);
  }

  for (const [origemId, protocoloId] of protocoloIdPorOrigem) {
    const itens = principios.filter((item) => item.protocoloIdeagriId === origemId);
    if (!itens.length) continue;
    await db.principioProtocoloIATF.deleteMany({ where: { protocoloId } });
    await db.principioProtocoloIATF.createMany({
      data: itens.map((item) => ({ protocoloId, dia: item.dia, principio: item.principio, produto: item.produto, dose: item.dose, uso: item.uso })),
    });
    await db.etapaProtocoloIATF.deleteMany({ where: { protocoloId } });
    await db.etapaProtocoloIATF.createMany({
      data: itens.map((item, ordem) => ({
        protocoloId, dia: item.dia, ordem,
        acao: item.uso ?? item.principio ?? item.produto ?? `Etapa D${item.dia}`,
        hormonio: item.principio,
      })),
    });
  }

  const programacaoIdPorOrigem = new Map<number, number>();
  for (const programacao of programacoes) {
    const protocoloId = protocoloIdPorOrigem.get(programacao.protocoloIdeagriId);
    if (protocoloId == null) throw new Error(`protocolo IDEAGRI ${programacao.protocoloIdeagriId} não encontrado`);
    const row = await db.programacaoIATFLote.upsert({
      where: { ideagriId: programacao.ideagriId },
      create: { ideagriId: programacao.ideagriId, protocoloId, nome: programacao.nome, dataInicio: dataDb(programacao.dataInicio) },
      update: { protocoloId, nome: programacao.nome, dataInicio: dataDb(programacao.dataInicio) },
    });
    programacaoIdPorOrigem.set(programacao.ideagriId, row.id);
  }

  for (const associacao of associacoes) {
    const animalId = idByNumero.get(associacao.numero);
    if (animalId == null) throw new Error(`animal ${associacao.numero} não encontrado`);
    const programacaoId = programacaoIdPorOrigem.get(associacao.programacaoIdeagriId);
    if (programacaoId == null) throw new Error(`programação IDEAGRI ${associacao.programacaoIdeagriId} não encontrada`);
    const programacao = await db.programacaoIATFLote.findUniqueOrThrow({
      where: { id: programacaoId },
      include: { protocolo: { include: { etapas: true } } },
    });
    const dataInicio = programacao.dataInicio.toISOString().slice(0, 10);
    await db.aplicacaoProtocoloIATF.upsert({
      where: { ideagriId: associacao.ideagriId },
      create: {
        ideagriId: associacao.ideagriId, animalId, programacaoId,
        protocoloId: programacao.protocoloId, dataInicio: programacao.dataInicio,
        usoCidr: associacao.usoCidr, estimulo: associacao.estimulo,
        perdaImplante: associacao.perdaImplante,
        execucoes: { create: materializarExecucoes(programacao.protocolo.etapas, dataInicio) },
      },
      update: {
        animalId, programacaoId, protocoloId: programacao.protocoloId,
        dataInicio: programacao.dataInicio, usoCidr: associacao.usoCidr,
        estimulo: associacao.estimulo, perdaImplante: associacao.perdaImplante,
      },
    });
  }

  return { protocolos: protocolos.length, principios: principios.length, programacoes: programacoes.length, associacoes: associacoes.length };
}
