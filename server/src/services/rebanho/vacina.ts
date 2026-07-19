import { prisma } from "../../db.js";
import type { AgendarVacinaInput, MarcarAplicadaInput } from "./vacina.schemas.js";
import { statusVacina, type StatusVacina } from "./vacina.calc.js";

export class VacinaError extends Error { constructor(public code: "NAO_ENCONTRADO", message: string) { super(message); } }

const iso = (x: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : null);
// @db.Date é gravado a partir de uma Date UTC-meia-noite para não escorregar de dia por fuso.
const dataDb = (isoDia: string) => new Date(`${isoDia}T00:00:00Z`);

export interface VacinaAgendadaDTO {
  id: number;
  animalId: number;
  vacina: string;
  dataPrevista: string;
  aplicadaEm: string | null;
  observacao: string | null;
  status: StatusVacina;
}

function toDTO(v: { id: number; animalId: number; vacina: string; dataPrevista: Date; aplicadaEm: Date | null; observacao: string | null }, hoje: string): VacinaAgendadaDTO {
  const dataPrevista = iso(v.dataPrevista)!;
  const aplicadaEm = iso(v.aplicadaEm);
  return { id: v.id, animalId: v.animalId, vacina: v.vacina, dataPrevista, aplicadaEm, observacao: v.observacao, status: statusVacina(dataPrevista, aplicadaEm, hoje) };
}

export async function agendarVacina(animalId: number, input: AgendarVacinaInput, propriedadeId: number | null, hoje = new Date().toISOString().slice(0, 10)): Promise<VacinaAgendadaDTO> {
  if (!(await prisma.animal.findUnique({ where: { id: animalId } }))) throw new VacinaError("NAO_ENCONTRADO", "animal não encontrado");
  const v = await prisma.vacinaAgendada.create({
    data: { animalId, propriedadeId, vacina: input.vacina, dataPrevista: dataDb(input.dataPrevista), observacao: input.observacao ?? null },
  });
  return toDTO(v, hoje);
}

export async function listarVacinas(animalId: number, hoje = new Date().toISOString().slice(0, 10)): Promise<VacinaAgendadaDTO[]> {
  const rows = await prisma.vacinaAgendada.findMany({ where: { animalId }, orderBy: [{ aplicadaEm: "asc" }, { dataPrevista: "asc" }] });
  return rows.map((v) => toDTO(v, hoje));
}

export async function marcarAplicada(vacinaId: number, input: MarcarAplicadaInput, hoje = new Date().toISOString().slice(0, 10)): Promise<VacinaAgendadaDTO> {
  const existente = await prisma.vacinaAgendada.findUnique({ where: { id: vacinaId } });
  if (!existente) throw new VacinaError("NAO_ENCONTRADO", "vacina agendada não encontrada");
  const aplicadaEm = input.aplicadaEm ?? hoje;
  const v = await prisma.vacinaAgendada.update({ where: { id: vacinaId }, data: { aplicadaEm: dataDb(aplicadaEm) } });
  return toDTO(v, hoje);
}

export async function excluirVacina(vacinaId: number): Promise<void> {
  const existente = await prisma.vacinaAgendada.findUnique({ where: { id: vacinaId } });
  if (!existente) throw new VacinaError("NAO_ENCONTRADO", "vacina agendada não encontrada");
  await prisma.vacinaAgendada.delete({ where: { id: vacinaId } });
}
