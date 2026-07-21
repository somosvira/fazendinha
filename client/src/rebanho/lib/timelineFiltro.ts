import type { EventoTimeline } from "../types";

export type DominioTimeline = EventoTimeline["dominio"];
export type FiltroTimeline = "tudo" | DominioTimeline;

// Ordem canônica p/ desempate (mesma sequência lógica do módulo).
const ORDEM: DominioTimeline[] = ["reproducao", "sanidade", "nutricao", "producao"];

export interface ContagemDominio {
  dominio: DominioTimeline;
  n: number;
}

export function contarPorDominio(eventos: EventoTimeline[]): ContagemDominio[] {
  const mapa = new Map<DominioTimeline, number>();
  for (const e of eventos) mapa.set(e.dominio, (mapa.get(e.dominio) ?? 0) + 1);
  return [...mapa.entries()]
    .map(([dominio, n]) => ({ dominio, n }))
    .sort((a, b) => b.n - a.n || ORDEM.indexOf(a.dominio) - ORDEM.indexOf(b.dominio));
}

export function filtrarEventos(eventos: EventoTimeline[], filtro: FiltroTimeline): EventoTimeline[] {
  return filtro === "tudo" ? eventos : eventos.filter((e) => e.dominio === filtro);
}
