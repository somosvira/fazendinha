import { prisma } from "../../db.js";
import { toTimeline as toRepro } from "./eventos.mappers.js";
import { toTimeline as toSan } from "./eventos-sanidade.mappers.js";
export async function montarTimeline(animalId: number) {
  const [r, s] = await Promise.all([
    prisma.eventoReprodutivo.findMany({ where: { animalId } }),
    prisma.eventoSanitario.findMany({ where: { animalId } }),
  ]);
  return [...r.map(toRepro), ...s.map(toSan)].sort((a, b) => Date.parse(b.data) - Date.parse(a.data));
}
