import { prisma } from "../../db.js";
import { toTimeline, type EventoTimelineDTO } from "./eventos-sanidade.mappers.js";
import type { CriarEventoSanitarioInput } from "./eventos-sanidade.schemas.js";
import { recomputarResumoSanidade, type EvtSan } from "./sanidade.recompute.js";

export class EventoSanError extends Error { constructor(public code: "NAO_ENCONTRADO", message: string) { super(message); } }
const iso = (x: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : null);

export async function recomputarSanidade(animalId: number): Promise<void> {
  const exs = await prisma.eventoSanitario.findMany({ where: { animalId } });
  const evs: EvtSan[] = exs.map((e) => ({ tipo: e.tipo, data: iso(e.data)!, ccs: e.ccs }));
  const r = recomputarResumoSanidade(evs);
  await prisma.resumoAnimal.upsert({
    where: { animalId },
    create: { animalId, ccs: r.ccs, ccsTendencia: r.ccsTendencia },
    update: { ccs: r.ccs, ccsTendencia: r.ccsTendencia },
  });
}
export async function listarSanidade(animalId: number): Promise<EventoTimelineDTO[]> {
  return (await prisma.eventoSanitario.findMany({ where: { animalId }, orderBy: { data: "desc" } })).map(toTimeline);
}
export async function registrarSanidade(animalId: number, input: CriarEventoSanitarioInput): Promise<EventoTimelineDTO> {
  if (!(await prisma.animal.findUnique({ where: { id: animalId } }))) throw new EventoSanError("NAO_ENCONTRADO", "animal não encontrado");
  const e = await prisma.eventoSanitario.create({ data: { animalId, ...(input as any), data: new Date(input.data), dtFim: (input as any).dtFim ? new Date((input as any).dtFim) : undefined } });
  await recomputarSanidade(animalId);
  return toTimeline(e);
}
export async function excluirSanidade(eventoId: number): Promise<void> {
  const e = await prisma.eventoSanitario.findUnique({ where: { id: eventoId } });
  if (!e) throw new EventoSanError("NAO_ENCONTRADO", "evento não encontrado");
  await prisma.eventoSanitario.delete({ where: { id: eventoId } });
  await recomputarSanidade(e.animalId);
}
