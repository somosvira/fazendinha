import { prisma } from "../../db.js";
import { agruparChuva, type ResumoChuva } from "./chuva.calc.js";

export class ChuvaError extends Error {
  constructor(public code: "NAO_ENCONTRADO", message: string) { super(message); }
}

const iso = (x: Date) => new Date(x).toISOString().slice(0, 10);
const dataDb = (isoDia: string) => new Date(`${isoDia}T00:00:00Z`);
const num = (v: unknown): number => Number(v);

export interface RegistroChuvaDTO {
  id: number;
  data: string; // YYYY-MM-DD
  mm: number;
  observacao: string | null;
}
export interface ChuvaResp { registros: RegistroChuvaDTO[]; resumo: ResumoChuva }

export interface RegistrarChuvaInput { data: string; mm: number; observacao?: string | null }

export async function listarChuva(propriedadeId: number | null): Promise<ChuvaResp> {
  const rows = await prisma.registroChuva.findMany({
    where: propriedadeId != null ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : {},
    orderBy: [{ data: "desc" }, { id: "desc" }],
  });
  const registros: RegistroChuvaDTO[] = rows.map((r) => ({
    id: r.id,
    data: iso(r.data),
    mm: num(r.mm),
    observacao: r.observacao,
  }));
  // Resumo agrega em ordem crescente de mês (independente da ordem de listagem).
  const resumo = agruparChuva(registros.map((r) => ({ data: r.data, mm: r.mm })));
  return { registros, resumo };
}

export async function registrarChuva(input: RegistrarChuvaInput, propriedadeId: number | null): Promise<RegistroChuvaDTO> {
  const r = await prisma.registroChuva.create({
    data: {
      data: dataDb(input.data),
      mm: input.mm,
      observacao: input.observacao?.trim() || null,
      propriedadeId,
    },
  });
  return { id: r.id, data: iso(r.data), mm: num(r.mm), observacao: r.observacao };
}

export async function excluirChuva(id: number): Promise<void> {
  if (!(await prisma.registroChuva.findUnique({ where: { id } }))) {
    throw new ChuvaError("NAO_ENCONTRADO", "registro de chuva não encontrado");
  }
  await prisma.registroChuva.delete({ where: { id } });
}
