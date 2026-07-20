import { prisma } from "../../db.js";
import { resumoIndices, type ResumoReprodutores, type ReprodutorIndices } from "./reprodutor.calc.js";
import type { CriarCentralInput, CriarReprodutorInput, AtualizarReprodutorInput } from "./reprodutores.schemas.js";

export class ReprodutorError extends Error {
  constructor(public code: "NAO_ENCONTRADO", message: string) { super(message); }
}

const num = (v: unknown): number | null => (v == null ? null : Number(v));

export interface CentralSemenDTO { id: number; nome: string; ativo: boolean; totalReprodutores: number }
export interface ReprodutorDTO {
  id: number; nome: string; codigo: string | null;
  racaId: number | null; racaNome: string | null;
  centralSemenId: number | null; centralNome: string | null;
  ptaLeite: number | null; ptaGordura: number | null; ptaProteina: number | null; tpi: number | null;
  ativo: boolean;
}
export interface BibliotecaReprodutoresDTO { reprodutores: ReprodutorDTO[]; resumo: ResumoReprodutores }

// ── Central de sêmen ──────────────────────────────────────────────────────────

export async function listarCentrais(propriedadeId: number | null): Promise<CentralSemenDTO[]> {
  const rows = await prisma.centralSemen.findMany({
    where: propriedadeId != null ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : {},
    include: { _count: { select: { reprodutores: true } } },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  });
  return rows.map((c) => ({ id: c.id, nome: c.nome, ativo: c.ativo, totalReprodutores: c._count.reprodutores }));
}

export async function criarCentral(input: CriarCentralInput, propriedadeId: number | null): Promise<CentralSemenDTO> {
  const c = await prisma.centralSemen.create({ data: { nome: input.nome, ativo: input.ativo ?? true, propriedadeId } });
  return { id: c.id, nome: c.nome, ativo: c.ativo, totalReprodutores: 0 };
}

export async function excluirCentral(id: number): Promise<void> {
  if (!(await prisma.centralSemen.findUnique({ where: { id } }))) throw new ReprodutorError("NAO_ENCONTRADO", "central não encontrada");
  const emUso = await prisma.reprodutor.count({ where: { centralSemenId: id } });
  if (emUso > 0) { await prisma.centralSemen.update({ where: { id }, data: { ativo: false } }); return; }
  await prisma.centralSemen.delete({ where: { id } });
}

// ── Reprodutores ──────────────────────────────────────────────────────────────

type ReprodutorRow = {
  id: number; nome: string; codigo: string | null; racaId: number | null; centralSemenId: number | null;
  ptaLeite: unknown; ptaGordura: unknown; ptaProteina: unknown; tpi: number | null; ativo: boolean;
  raca: { nome: string } | null; centralSemen: { nome: string } | null;
};

function reprodutorDTO(r: ReprodutorRow): ReprodutorDTO {
  return {
    id: r.id, nome: r.nome, codigo: r.codigo,
    racaId: r.racaId, racaNome: r.raca?.nome ?? null,
    centralSemenId: r.centralSemenId, centralNome: r.centralSemen?.nome ?? null,
    ptaLeite: num(r.ptaLeite), ptaGordura: num(r.ptaGordura), ptaProteina: num(r.ptaProteina), tpi: r.tpi, ativo: r.ativo,
  };
}

export async function listarReprodutores(propriedadeId: number | null, incluirInativos = false): Promise<BibliotecaReprodutoresDTO> {
  const rows = await prisma.reprodutor.findMany({
    where: { ...(incluirInativos ? {} : { ativo: true }), ...(propriedadeId != null ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : {}) },
    include: { raca: { select: { nome: true } }, centralSemen: { select: { nome: true } } },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  });
  const reprodutores = rows.map((r) => reprodutorDTO(r as ReprodutorRow));
  const indices: ReprodutorIndices[] = reprodutores.map((r) => ({ id: r.id, ptaLeite: r.ptaLeite, ptaGordura: r.ptaGordura, ptaProteina: r.ptaProteina, tpi: r.tpi }));
  return { reprodutores, resumo: resumoIndices(indices) };
}

const dataReprodutor = (input: CriarReprodutorInput | AtualizarReprodutorInput) => ({
  ...(input.nome !== undefined ? { nome: input.nome } : {}),
  ...(input.codigo !== undefined ? { codigo: input.codigo } : {}),
  ...(input.racaId !== undefined ? { racaId: input.racaId } : {}),
  ...(input.centralSemenId !== undefined ? { centralSemenId: input.centralSemenId } : {}),
  ...(input.ptaLeite !== undefined ? { ptaLeite: input.ptaLeite } : {}),
  ...(input.ptaGordura !== undefined ? { ptaGordura: input.ptaGordura } : {}),
  ...(input.ptaProteina !== undefined ? { ptaProteina: input.ptaProteina } : {}),
  ...(input.tpi !== undefined ? { tpi: input.tpi } : {}),
  ...(input.ativo !== undefined ? { ativo: input.ativo } : {}),
});

const INCLUDE_REP = { raca: { select: { nome: true } }, centralSemen: { select: { nome: true } } } as const;

export async function criarReprodutor(input: CriarReprodutorInput, propriedadeId: number | null): Promise<ReprodutorDTO> {
  const r = await prisma.reprodutor.create({ data: { ...dataReprodutor(input), nome: input.nome, propriedadeId }, include: INCLUDE_REP });
  return reprodutorDTO(r as ReprodutorRow);
}

export async function atualizarReprodutor(id: number, input: AtualizarReprodutorInput): Promise<ReprodutorDTO> {
  if (!(await prisma.reprodutor.findUnique({ where: { id } }))) throw new ReprodutorError("NAO_ENCONTRADO", "reprodutor não encontrado");
  const r = await prisma.reprodutor.update({ where: { id }, data: dataReprodutor(input), include: INCLUDE_REP });
  return reprodutorDTO(r as ReprodutorRow);
}

export async function excluirReprodutor(id: number): Promise<void> {
  if (!(await prisma.reprodutor.findUnique({ where: { id } }))) throw new ReprodutorError("NAO_ENCONTRADO", "reprodutor não encontrado");
  await prisma.reprodutor.delete({ where: { id } });
}
