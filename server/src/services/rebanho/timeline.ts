import { prisma } from "../../db.js";
import { toTimeline as toRepro } from "./eventos.mappers.js";
import { toTimeline as toSan } from "./eventos-sanidade.mappers.js";
import { toTimelineControle, toTimelinePesagem } from "./producao.mappers.js";
export async function montarTimeline(animalId: number) {
  const [r, s, p, w] = await Promise.all([
    prisma.eventoReprodutivo.findMany({ where: { animalId } }),
    prisma.eventoSanitario.findMany({ where: { animalId } }),
    prisma.controleLeiteiro.findMany({ where: { animalId } }),
    prisma.pesagem.findMany({ where: { animalId } }),
  ]);
  return [...r.map(toRepro), ...s.map(toSan), ...p.map(toTimelineControle), ...w.map(toTimelinePesagem)].sort((a, b) => Date.parse(b.data) - Date.parse(a.data));
}
