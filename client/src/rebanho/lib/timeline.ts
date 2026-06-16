import type { EventoTimeline } from "../types";

export function buildTimeline(eventos: EventoTimeline[], animalId: string): EventoTimeline[] {
  return eventos
    .filter((e) => e.animalId === animalId)
    .slice()
    .sort((a, b) => Date.parse(b.data) - Date.parse(a.data));
}
