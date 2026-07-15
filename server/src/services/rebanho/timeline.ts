import { prisma } from "../../db.js";
import { toTimeline as toRepro } from "./eventos.mappers.js";
import { toTimeline as toSan } from "./eventos-sanidade.mappers.js";
import { toTimelineControle, toTimelinePesagem, toTimelineLactacaoInicio, toTimelineLactacaoSecagem } from "./producao.mappers.js";
export async function montarTimeline(animalId: number) {
  const [r, s, p, w, l] = await Promise.all([
    prisma.eventoReprodutivo.findMany({ where: { animalId } }),
    prisma.eventoSanitario.findMany({ where: { animalId } }),
    prisma.controleLeiteiro.findMany({ where: { animalId } }),
    prisma.pesagem.findMany({ where: { animalId } }),
    prisma.lactacao.findMany({ where: { animalId } }),
  ]);
  const lactEventos = [
    ...l.map(toTimelineLactacaoInicio),
    ...l.map(toTimelineLactacaoSecagem).filter((e): e is NonNullable<typeof e> => e != null),
  ];
  return [...r.map(toRepro), ...s.map(toSan), ...p.map(toTimelineControle), ...w.map(toTimelinePesagem), ...lactEventos].sort(
    (a, b) => Date.parse(b.data) - Date.parse(a.data),
  );
}
