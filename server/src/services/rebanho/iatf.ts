import { prisma } from "../../db.js";
import {
  agendarEtapas, ordenarEtapas, etapasComStatus, progressoExecucao,
  type EtapaComStatus, type ExecucaoEtapa,
} from "./iatf.calc.js";
import type {
  CriarProtocoloInput, AtualizarProtocoloInput, AplicarProtocoloInput, EtapaInput, ExecutarEtapaInput,
} from "./iatf.schemas.js";

export class IatfError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "PROTOCOLO_INATIVO" | "CONFLITO", message: string) { super(message); }
}

const iso = (x: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : null);
// @db.Date gravado a partir de uma Date UTC-meia-noite para não escorregar de dia por fuso.
const dataDb = (isoDia: string) => new Date(`${isoDia}T00:00:00Z`);

export interface EtapaDTO { dia: number; acao: string; hormonio: string | null; ordem: number }
export interface ProtocoloDTO {
  id: number;
  nome: string;
  descricao: string | null;
  hormonioBase: string | null;
  finalidade: "IATF" | "TETF";
  ativo: boolean;
  etapas: EtapaDTO[];
}
export interface AplicacaoDTO {
  id: number;
  animalId: number;
  protocoloId: number;
  protocoloNome: string;
  dataInicio: string;
  observacao: string | null;
  usoCidr: boolean;
  estimulo: string | null;
  perdaImplante: boolean;
  etapas: EtapaComStatus[];
  progresso: {
    total: number;
    resolvidas: number;
    concluidas: number;
    puladas: number;
    pendentes: number;
    proxima: EtapaComStatus | null;
    concluido: boolean;
  };
}

type EtapaRow = { dia: number; acao: string; hormonio: string | null; ordem: number };
type ProtocoloRow = { id: number; nome: string; descricao: string | null; hormonioBase: string | null; finalidade: "IATF" | "TETF"; ativo: boolean; etapas: EtapaRow[] };

function protocoloDTO(p: ProtocoloRow): ProtocoloDTO {
  return {
    id: p.id, nome: p.nome, descricao: p.descricao, hormonioBase: p.hormonioBase,
    finalidade: p.finalidade, ativo: p.ativo,
    etapas: ordenarEtapas(p.etapas).map((e) => ({ dia: e.dia, acao: e.acao, hormonio: e.hormonio, ordem: e.ordem })),
  };
}

// Normaliza as etapas do input: quando `ordem` não vem, usa o índice como desempate.
function etapasCreate(etapas: EtapaInput[]) {
  return etapas.map((e, i) => ({ dia: e.dia, acao: e.acao, hormonio: e.hormonio ?? null, ordem: e.ordem ?? i }));
}

// Catálogos legados com propriedadeId null são compartilhados; registros de sítio
// só podem ser lidos ou alterados no próprio escopo.
function catalogoNoEscopo(propriedadeId: number | null) {
  return propriedadeId != null ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : {};
}

function animalNoEscopo(animalId: number, propriedadeId: number | null) {
  return { id: animalId, ...(propriedadeId != null ? { propriedadeId } : {}) };
}

// ── Catálogo de protocolos ───────────────────────────────────────────────────

export async function listarProtocolos(propriedadeId: number | null, incluirInativos = false): Promise<ProtocoloDTO[]> {
  const rows = await prisma.protocoloIATF.findMany({
    where: {
      ...(incluirInativos ? {} : { ativo: true }),
      // Escopo: protocolos do sítio + os compartilhados (propriedadeId null).
      ...catalogoNoEscopo(propriedadeId),
    },
    include: { etapas: true },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  });
  return rows.map(protocoloDTO);
}

export async function criarProtocolo(input: CriarProtocoloInput, propriedadeId: number | null): Promise<ProtocoloDTO> {
  const p = await prisma.protocoloIATF.create({
    data: {
      nome: input.nome,
      descricao: input.descricao ?? null,
      hormonioBase: input.hormonioBase ?? null,
      finalidade: input.finalidade ?? "IATF",
      ativo: input.ativo ?? true,
      propriedadeId,
      etapas: { create: etapasCreate(input.etapas) },
    },
    include: { etapas: true },
  });
  return protocoloDTO(p);
}

export async function atualizarProtocolo(
  id: number,
  input: AtualizarProtocoloInput,
  propriedadeId: number | null = null,
): Promise<ProtocoloDTO> {
  const existente = await prisma.protocoloIATF.findFirst({
    where: { id, ...catalogoNoEscopo(propriedadeId) },
    select: { id: true },
  });
  if (!existente) throw new IatfError("NAO_ENCONTRADO", "protocolo não encontrado");
  const p = await prisma.$transaction(async (tx) => {
    await tx.protocoloIATF.update({
      where: { id },
      data: {
        ...(input.nome !== undefined ? { nome: input.nome } : {}),
        ...(input.descricao !== undefined ? { descricao: input.descricao } : {}),
        ...(input.hormonioBase !== undefined ? { hormonioBase: input.hormonioBase } : {}),
        ...(input.finalidade !== undefined ? { finalidade: input.finalidade } : {}),
        ...(input.ativo !== undefined ? { ativo: input.ativo } : {}),
      },
    });
    // Etapas são substituídas por completo quando vêm no payload (o front sempre
    // manda a lista inteira do editor). Delete-then-create dentro da transação.
    if (input.etapas !== undefined) {
      await tx.etapaProtocoloIATF.deleteMany({ where: { protocoloId: id } });
      await tx.etapaProtocoloIATF.createMany({ data: etapasCreate(input.etapas).map((e) => ({ ...e, protocoloId: id })) });
    }
    return tx.protocoloIATF.findUniqueOrThrow({ where: { id }, include: { etapas: true } });
  });
  return protocoloDTO(p);
}

export async function excluirProtocolo(id: number, propriedadeId: number | null = null): Promise<void> {
  const existente = await prisma.protocoloIATF.findFirst({
    where: { id, ...catalogoNoEscopo(propriedadeId) },
    select: { id: true },
  });
  if (!existente) throw new IatfError("NAO_ENCONTRADO", "protocolo não encontrado");
  const emUso = await prisma.aplicacaoProtocoloIATF.count({ where: { protocoloId: id } });
  if (emUso > 0) {
    // Preserva a história: protocolo já aplicado só é inativado, não apagado.
    await prisma.protocoloIATF.update({ where: { id }, data: { ativo: false } });
    return;
  }
  await prisma.protocoloIATF.delete({ where: { id } });
}

// ── Aplicação a um animal ────────────────────────────────────────────────────

type ExecRow = {
  id: number; dia: number; acao: string; hormonio: string | null; ordem: number;
  dataPlanejada: Date; status: "PENDENTE" | "CONCLUIDA" | "PULADA";
  dataExecucao: Date | null; produto: string | null; dose: string | null; observacao: string | null;
};
type AplicacaoRow = {
  id: number; animalId: number; protocoloId: number; dataInicio: Date; observacao: string | null;
  usoCidr: boolean; estimulo: string | null; perdaImplante: boolean;
  protocolo: ProtocoloRow;
  execucoes: ExecRow[];
};

const INCLUDE_APLICACAO = {
  protocolo: { include: { etapas: true } },
  execucoes: true,
} as const;

function toExecucao(e: ExecRow): ExecucaoEtapa {
  return {
    id: e.id, dia: e.dia, acao: e.acao, hormonio: e.hormonio, ordem: e.ordem,
    dataPlanejada: iso(e.dataPlanejada)!, status: e.status, dataExecucao: iso(e.dataExecucao),
    produto: e.produto, dose: e.dose, observacao: e.observacao,
  };
}

function aplicacaoDTO(a: AplicacaoRow, hoje = new Date().toISOString().slice(0, 10)): AplicacaoDTO {
  const dataInicio = iso(a.dataInicio)!;
  // Prefer materializadas; se vazias (legado), deriva da agenda do catálogo.
  const etapasTpl = a.protocolo.etapas;
  const execs = a.execucoes.map(toExecucao);
  const etapas = etapasComStatus(etapasTpl, dataInicio, execs, hoje);
  return {
    id: a.id, animalId: a.animalId, protocoloId: a.protocoloId, protocoloNome: a.protocolo.nome,
    dataInicio, observacao: a.observacao,
    usoCidr: a.usoCidr, estimulo: a.estimulo, perdaImplante: a.perdaImplante,
    etapas, progresso: progressoExecucao(etapas),
  };
}

/** Snapshot das etapas do catálogo → linhas de execução PENDENTE na data planejada. */
export function materializarExecucoes(
  etapas: { dia: number; acao: string; hormonio: string | null; ordem: number }[],
  dataInicio: string,
) {
  return agendarEtapas(etapas, dataInicio).map((e) => ({
    dia: e.dia, acao: e.acao, hormonio: e.hormonio, ordem: e.ordem,
    dataPlanejada: dataDb(e.data), status: "PENDENTE" as const,
  }));
}

export async function aplicarProtocolo(animalId: number, input: AplicarProtocoloInput, propriedadeId: number | null): Promise<AplicacaoDTO> {
  const animal = await prisma.animal.findFirst({
    where: animalNoEscopo(animalId, propriedadeId),
    select: { id: true },
  });
  if (!animal) throw new IatfError("NAO_ENCONTRADO", "animal não encontrado");
  const protocolo = await prisma.protocoloIATF.findFirst({
    where: { id: input.protocoloId, ...catalogoNoEscopo(propriedadeId) },
    include: { etapas: true },
  });
  if (!protocolo) throw new IatfError("NAO_ENCONTRADO", "protocolo não encontrado");
  if (!protocolo.ativo) throw new IatfError("PROTOCOLO_INATIVO", "protocolo inativo não pode ser aplicado");

  const execs = materializarExecucoes(protocolo.etapas, input.dataInicio);
  const a = await prisma.aplicacaoProtocoloIATF.create({
    data: {
      animalId, protocoloId: input.protocoloId,
      dataInicio: dataDb(input.dataInicio),
      observacao: input.observacao ?? null,
      usoCidr: input.usoCidr ?? false,
      estimulo: input.estimulo ?? null,
      perdaImplante: input.perdaImplante ?? false,
      propriedadeId,
      execucoes: { create: execs },
    },
    include: INCLUDE_APLICACAO,
  });
  return aplicacaoDTO(a as unknown as AplicacaoRow);
}

export async function listarAplicacoes(animalId: number, propriedadeId: number | null = null): Promise<AplicacaoDTO[]> {
  const animal = await prisma.animal.findFirst({
    where: animalNoEscopo(animalId, propriedadeId),
    select: { id: true },
  });
  if (!animal) throw new IatfError("NAO_ENCONTRADO", "animal não encontrado");
  const rows = await prisma.aplicacaoProtocoloIATF.findMany({
    where: { animalId },
    include: INCLUDE_APLICACAO,
    orderBy: { dataInicio: "desc" },
  });
  const hoje = new Date().toISOString().slice(0, 10);
  return rows.map((r) => aplicacaoDTO(r as unknown as AplicacaoRow, hoje));
}

export async function excluirAplicacao(id: number, propriedadeId: number | null = null): Promise<void> {
  const existente = await prisma.aplicacaoProtocoloIATF.findFirst({
    where: {
      id,
      ...(propriedadeId != null ? { animal: { propriedadeId } } : {}),
    },
    select: { id: true },
  });
  if (!existente) throw new IatfError("NAO_ENCONTRADO", "aplicação não encontrada");
  await prisma.aplicacaoProtocoloIATF.delete({ where: { id } }); // cascade execuções
}

/** Marca uma etapa materializada como CONCLUIDA / PULADA / PENDENTE. */
export async function executarEtapa(
  execucaoId: number,
  input: ExecutarEtapaInput,
  propriedadeId: number | null = null,
): Promise<AplicacaoDTO> {
  const ex = await prisma.execucaoEtapaIATF.findFirst({
    where: {
      id: execucaoId,
      ...(propriedadeId != null ? { aplicacao: { animal: { propriedadeId } } } : {}),
    },
    include: { aplicacao: { include: INCLUDE_APLICACAO } },
  });
  if (!ex) throw new IatfError("NAO_ENCONTRADO", "execução de etapa não encontrada");

  const dataExec = input.status === "PENDENTE"
    ? null
    : dataDb(input.dataExecucao ?? new Date().toISOString().slice(0, 10));

  await prisma.execucaoEtapaIATF.update({
    where: { id: execucaoId },
    data: {
      status: input.status,
      dataExecucao: dataExec,
      ...(input.produto !== undefined ? { produto: input.produto } : {}),
      ...(input.dose !== undefined ? { dose: input.dose } : {}),
      ...(input.observacao !== undefined ? { observacao: input.observacao } : {}),
    },
  });

  const a = await prisma.aplicacaoProtocoloIATF.findUniqueOrThrow({
    where: { id: ex.aplicacaoId },
    include: INCLUDE_APLICACAO,
  });
  return aplicacaoDTO(a as unknown as AplicacaoRow);
}
