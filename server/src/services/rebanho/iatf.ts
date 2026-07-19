import { prisma } from "../../db.js";
import { agendarEtapas, ordenarEtapas, type EtapaAgendada } from "./iatf.calc.js";
import type { CriarProtocoloInput, AtualizarProtocoloInput, AplicarProtocoloInput, EtapaInput } from "./iatf.schemas.js";

export class IatfError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "PROTOCOLO_INATIVO", message: string) { super(message); }
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
  etapas: EtapaAgendada[]; // agenda derivada (dataInicio + etapa.dia)
}

type EtapaRow = { dia: number; acao: string; hormonio: string | null; ordem: number };
type ProtocoloRow = { id: number; nome: string; descricao: string | null; hormonioBase: string | null; ativo: boolean; etapas: EtapaRow[] };

function protocoloDTO(p: ProtocoloRow): ProtocoloDTO {
  return {
    id: p.id, nome: p.nome, descricao: p.descricao, hormonioBase: p.hormonioBase, ativo: p.ativo,
    etapas: ordenarEtapas(p.etapas).map((e) => ({ dia: e.dia, acao: e.acao, hormonio: e.hormonio, ordem: e.ordem })),
  };
}

// Normaliza as etapas do input: quando `ordem` não vem, usa o índice como desempate.
function etapasCreate(etapas: EtapaInput[]) {
  return etapas.map((e, i) => ({ dia: e.dia, acao: e.acao, hormonio: e.hormonio ?? null, ordem: e.ordem ?? i }));
}

// ── Catálogo de protocolos ───────────────────────────────────────────────────

export async function listarProtocolos(propriedadeId: number | null, incluirInativos = false): Promise<ProtocoloDTO[]> {
  const rows = await prisma.protocoloIATF.findMany({
    where: {
      ...(incluirInativos ? {} : { ativo: true }),
      // Escopo: protocolos do sítio + os compartilhados (propriedadeId null).
      ...(propriedadeId != null ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : {}),
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
      ativo: input.ativo ?? true,
      propriedadeId,
      etapas: { create: etapasCreate(input.etapas) },
    },
    include: { etapas: true },
  });
  return protocoloDTO(p);
}

export async function atualizarProtocolo(id: number, input: AtualizarProtocoloInput): Promise<ProtocoloDTO> {
  if (!(await prisma.protocoloIATF.findUnique({ where: { id } }))) throw new IatfError("NAO_ENCONTRADO", "protocolo não encontrado");
  const p = await prisma.$transaction(async (tx) => {
    await tx.protocoloIATF.update({
      where: { id },
      data: {
        ...(input.nome !== undefined ? { nome: input.nome } : {}),
        ...(input.descricao !== undefined ? { descricao: input.descricao } : {}),
        ...(input.hormonioBase !== undefined ? { hormonioBase: input.hormonioBase } : {}),
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

export async function excluirProtocolo(id: number): Promise<void> {
  if (!(await prisma.protocoloIATF.findUnique({ where: { id } }))) throw new IatfError("NAO_ENCONTRADO", "protocolo não encontrado");
  const emUso = await prisma.aplicacaoProtocoloIATF.count({ where: { protocoloId: id } });
  if (emUso > 0) {
    // Preserva a história: protocolo já aplicado só é inativado, não apagado.
    await prisma.protocoloIATF.update({ where: { id }, data: { ativo: false } });
    return;
  }
  await prisma.protocoloIATF.delete({ where: { id } });
}

// ── Aplicação a um animal ────────────────────────────────────────────────────

function aplicacaoDTO(a: { id: number; animalId: number; protocoloId: number; dataInicio: Date; observacao: string | null; protocolo: ProtocoloRow }): AplicacaoDTO {
  const dataInicio = iso(a.dataInicio)!;
  return {
    id: a.id, animalId: a.animalId, protocoloId: a.protocoloId, protocoloNome: a.protocolo.nome,
    dataInicio, observacao: a.observacao,
    etapas: agendarEtapas(a.protocolo.etapas, dataInicio),
  };
}

export async function aplicarProtocolo(animalId: number, input: AplicarProtocoloInput, propriedadeId: number | null): Promise<AplicacaoDTO> {
  if (!(await prisma.animal.findUnique({ where: { id: animalId } }))) throw new IatfError("NAO_ENCONTRADO", "animal não encontrado");
  const protocolo = await prisma.protocoloIATF.findUnique({ where: { id: input.protocoloId } });
  if (!protocolo) throw new IatfError("NAO_ENCONTRADO", "protocolo não encontrado");
  if (!protocolo.ativo) throw new IatfError("PROTOCOLO_INATIVO", "protocolo inativo não pode ser aplicado");
  const a = await prisma.aplicacaoProtocoloIATF.create({
    data: { animalId, protocoloId: input.protocoloId, dataInicio: dataDb(input.dataInicio), observacao: input.observacao ?? null, propriedadeId },
    include: { protocolo: { include: { etapas: true } } },
  });
  return aplicacaoDTO(a);
}

export async function listarAplicacoes(animalId: number): Promise<AplicacaoDTO[]> {
  const rows = await prisma.aplicacaoProtocoloIATF.findMany({
    where: { animalId },
    include: { protocolo: { include: { etapas: true } } },
    orderBy: { dataInicio: "desc" },
  });
  return rows.map(aplicacaoDTO);
}

export async function excluirAplicacao(id: number): Promise<void> {
  if (!(await prisma.aplicacaoProtocoloIATF.findUnique({ where: { id } }))) throw new IatfError("NAO_ENCONTRADO", "aplicação não encontrada");
  await prisma.aplicacaoProtocoloIATF.delete({ where: { id } });
}
