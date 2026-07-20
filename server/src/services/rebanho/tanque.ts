import { prisma } from "../../db.js";
import { agregarTanque, type ResumoTanque, type AnaliseTanqueLeitura } from "./analise-tanque.calc.js";

export class TanqueError extends Error {
  constructor(public code: "NAO_ENCONTRADO", message: string) { super(message); }
}

const iso = (x: Date) => new Date(x).toISOString().slice(0, 10);
const dataDb = (isoDia: string) => new Date(`${isoDia}T00:00:00Z`);
const num = (v: unknown): number | null => (v == null ? null : Number(v));

export interface AnaliseTanqueDTO {
  id: number;
  data: string;
  ccs: number | null;
  cbt: number | null;
  gordura: number | null;
  proteina: number | null;
  temperatura: number | null;
  observacao: string | null;
}

export interface TanqueDTO {
  id: number;
  nome: string;
  capacidadeLitros: number | null;
  ativo: boolean;
  totalAnalises: number;
  resumo: ResumoTanque;
}

export interface CriarTanqueInput { nome: string; capacidadeLitros?: number | null; ativo?: boolean }
export interface RegistrarAnaliseInput {
  data: string; ccs?: number | null; cbt?: number | null;
  gordura?: number | null; proteina?: number | null; temperatura?: number | null; observacao?: string | null;
}

function analiseDTO(a: { id: number; data: Date; ccs: number | null; cbt: number | null; gordura: unknown; proteina: unknown; temperatura: unknown; observacao: string | null }): AnaliseTanqueDTO {
  return { id: a.id, data: iso(a.data), ccs: a.ccs, cbt: a.cbt, gordura: num(a.gordura), proteina: num(a.proteina), temperatura: num(a.temperatura), observacao: a.observacao };
}

// Lista os tanques do escopo, cada um com o resumo (via calc) das suas análises.
export async function listarTanques(propriedadeId: number | null): Promise<TanqueDTO[]> {
  const rows = await prisma.tanque.findMany({
    where: propriedadeId != null ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : {},
    include: { analises: true },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  });
  return rows.map((t) => {
    const leituras: AnaliseTanqueLeitura[] = t.analises.map((a) => ({ data: iso(a.data), ccs: a.ccs, cbt: a.cbt, gordura: num(a.gordura), proteina: num(a.proteina) }));
    return { id: t.id, nome: t.nome, capacidadeLitros: t.capacidadeLitros, ativo: t.ativo, totalAnalises: t.analises.length, resumo: agregarTanque(leituras) };
  });
}

export async function criarTanque(input: CriarTanqueInput, propriedadeId: number | null): Promise<TanqueDTO> {
  const t = await prisma.tanque.create({
    data: { nome: input.nome, capacidadeLitros: input.capacidadeLitros ?? null, ativo: input.ativo ?? true, propriedadeId },
  });
  return { id: t.id, nome: t.nome, capacidadeLitros: t.capacidadeLitros, ativo: t.ativo, totalAnalises: 0, resumo: agregarTanque([]) };
}

export async function excluirTanque(id: number): Promise<void> {
  if (!(await prisma.tanque.findUnique({ where: { id } }))) throw new TanqueError("NAO_ENCONTRADO", "tanque não encontrado");
  await prisma.tanque.delete({ where: { id } }); // análises caem por cascade
}

export async function listarAnalises(tanqueId: number): Promise<AnaliseTanqueDTO[]> {
  const rows = await prisma.analiseTanque.findMany({ where: { tanqueId }, orderBy: { data: "desc" } });
  return rows.map(analiseDTO);
}

export async function registrarAnalise(tanqueId: number, input: RegistrarAnaliseInput): Promise<AnaliseTanqueDTO> {
  if (!(await prisma.tanque.findUnique({ where: { id: tanqueId } }))) throw new TanqueError("NAO_ENCONTRADO", "tanque não encontrado");
  const a = await prisma.analiseTanque.create({
    data: {
      tanqueId, data: dataDb(input.data),
      ccs: input.ccs ?? null, cbt: input.cbt ?? null,
      gordura: input.gordura ?? null, proteina: input.proteina ?? null,
      temperatura: input.temperatura ?? null, observacao: input.observacao ?? null,
    },
  });
  return analiseDTO(a);
}
