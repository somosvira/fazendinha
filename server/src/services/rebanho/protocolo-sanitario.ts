import { prisma } from "../../db.js";
import { agendarEtapas, ordenarEtapas, type EtapaAgendada } from "./iatf.calc.js";
import type { CriarProtocoloSanitarioInput, AtualizarProtocoloSanitarioInput, AplicarProtocoloSanitarioInput, EtapaSanitariaInput } from "./protocolo-sanitario.schemas.js";

export class ProtocoloSanitarioError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "PROTOCOLO_INATIVO", message: string) { super(message); }
}

const iso = (x: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : null);
const dataDb = (isoDia: string) => new Date(`${isoDia}T00:00:00Z`);

// A etapa sanitária guarda `produto`; o calc `agendarEtapas` usa a chave genérica `hormonio`,
// então mapeamos produto↔hormonio na fronteira (o calc só soma o offset de dias — é agnóstico).
export interface EtapaSanitariaDTO { dia: number; acao: string; produto: string | null; ordem: number }
export interface ProtocoloSanitarioDTO { id: number; nome: string; descricao: string | null; ativo: boolean; etapas: EtapaSanitariaDTO[] }
export interface AplicacaoSanitariaDTO {
  id: number; animalId: number; protocoloId: number; protocoloNome: string;
  dataInicio: string; observacao: string | null;
  etapas: { dia: number; acao: string; produto: string | null; ordem: number; rotulo: string; data: string }[];
}

type EtapaRow = { dia: number; acao: string; produto: string | null; ordem: number };
type ProtocoloRow = { id: number; nome: string; descricao: string | null; ativo: boolean; etapas: EtapaRow[] };

function protocoloDTO(p: ProtocoloRow): ProtocoloSanitarioDTO {
  return {
    id: p.id, nome: p.nome, descricao: p.descricao, ativo: p.ativo,
    etapas: ordenarEtapas(p.etapas.map((e) => ({ ...e, hormonio: e.produto }))).map((e) => ({ dia: e.dia, acao: e.acao, produto: e.produto, ordem: e.ordem })),
  };
}

function etapasCreate(etapas: EtapaSanitariaInput[]) {
  return etapas.map((e, i) => ({ dia: e.dia, acao: e.acao, produto: e.produto ?? null, ordem: e.ordem ?? i }));
}

export async function listarProtocolos(propriedadeId: number | null, incluirInativos = false): Promise<ProtocoloSanitarioDTO[]> {
  const rows = await prisma.protocoloSanitario.findMany({
    where: {
      ...(incluirInativos ? {} : { ativo: true }),
      ...(propriedadeId != null ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : {}),
    },
    include: { etapas: true },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  });
  return rows.map(protocoloDTO);
}

export async function criarProtocolo(input: CriarProtocoloSanitarioInput, propriedadeId: number | null): Promise<ProtocoloSanitarioDTO> {
  const p = await prisma.protocoloSanitario.create({
    data: { nome: input.nome, descricao: input.descricao ?? null, ativo: input.ativo ?? true, propriedadeId, etapas: { create: etapasCreate(input.etapas) } },
    include: { etapas: true },
  });
  return protocoloDTO(p);
}

export async function atualizarProtocolo(id: number, input: AtualizarProtocoloSanitarioInput): Promise<ProtocoloSanitarioDTO> {
  if (!(await prisma.protocoloSanitario.findUnique({ where: { id } }))) throw new ProtocoloSanitarioError("NAO_ENCONTRADO", "protocolo não encontrado");
  const p = await prisma.$transaction(async (tx) => {
    await tx.protocoloSanitario.update({
      where: { id },
      data: {
        ...(input.nome !== undefined ? { nome: input.nome } : {}),
        ...(input.descricao !== undefined ? { descricao: input.descricao } : {}),
        ...(input.ativo !== undefined ? { ativo: input.ativo } : {}),
      },
    });
    if (input.etapas !== undefined) {
      await tx.etapaProtocoloSanitario.deleteMany({ where: { protocoloId: id } });
      await tx.etapaProtocoloSanitario.createMany({ data: etapasCreate(input.etapas).map((e) => ({ ...e, protocoloId: id })) });
    }
    return tx.protocoloSanitario.findUniqueOrThrow({ where: { id }, include: { etapas: true } });
  });
  return protocoloDTO(p);
}

export async function excluirProtocolo(id: number): Promise<void> {
  if (!(await prisma.protocoloSanitario.findUnique({ where: { id } }))) throw new ProtocoloSanitarioError("NAO_ENCONTRADO", "protocolo não encontrado");
  const emUso = await prisma.aplicacaoProtocoloSanitario.count({ where: { protocoloId: id } });
  if (emUso > 0) { await prisma.protocoloSanitario.update({ where: { id }, data: { ativo: false } }); return; }
  await prisma.protocoloSanitario.delete({ where: { id } });
}

// ── Aplicação a um animal ────────────────────────────────────────────────────

function aplicacaoDTO(a: { id: number; animalId: number; protocoloId: number; dataInicio: Date; observacao: string | null; protocolo: ProtocoloRow }): AplicacaoSanitariaDTO {
  const dataInicio = iso(a.dataInicio)!;
  const agenda: EtapaAgendada[] = agendarEtapas(a.protocolo.etapas.map((e) => ({ ...e, hormonio: e.produto })), dataInicio);
  return {
    id: a.id, animalId: a.animalId, protocoloId: a.protocoloId, protocoloNome: a.protocolo.nome, dataInicio, observacao: a.observacao,
    etapas: agenda.map((e) => ({ dia: e.dia, acao: e.acao, produto: e.hormonio, ordem: e.ordem, rotulo: e.rotulo, data: e.data })),
  };
}

export async function aplicarProtocolo(animalId: number, input: AplicarProtocoloSanitarioInput, propriedadeId: number | null): Promise<AplicacaoSanitariaDTO> {
  if (!(await prisma.animal.findUnique({ where: { id: animalId } }))) throw new ProtocoloSanitarioError("NAO_ENCONTRADO", "animal não encontrado");
  const protocolo = await prisma.protocoloSanitario.findUnique({ where: { id: input.protocoloId } });
  if (!protocolo) throw new ProtocoloSanitarioError("NAO_ENCONTRADO", "protocolo não encontrado");
  if (!protocolo.ativo) throw new ProtocoloSanitarioError("PROTOCOLO_INATIVO", "protocolo inativo não pode ser aplicado");
  const a = await prisma.aplicacaoProtocoloSanitario.create({
    data: { animalId, protocoloId: input.protocoloId, dataInicio: dataDb(input.dataInicio), observacao: input.observacao ?? null, propriedadeId },
    include: { protocolo: { include: { etapas: true } } },
  });
  return aplicacaoDTO(a);
}

export async function listarAplicacoes(animalId: number): Promise<AplicacaoSanitariaDTO[]> {
  const rows = await prisma.aplicacaoProtocoloSanitario.findMany({
    where: { animalId }, include: { protocolo: { include: { etapas: true } } }, orderBy: { dataInicio: "desc" },
  });
  return rows.map(aplicacaoDTO);
}

export async function excluirAplicacao(id: number): Promise<void> {
  if (!(await prisma.aplicacaoProtocoloSanitario.findUnique({ where: { id } }))) throw new ProtocoloSanitarioError("NAO_ENCONTRADO", "aplicação não encontrada");
  await prisma.aplicacaoProtocoloSanitario.delete({ where: { id } });
}
