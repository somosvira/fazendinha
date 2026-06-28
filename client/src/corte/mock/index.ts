import { lotes, resumos } from "./lotes";
import { piquetes } from "./piquetes";
import { eventos } from "./eventos";
import { insights } from "./insights";
import type { Lote, ResumoLote, IaInsight, Dominio } from "../types";

export { lotes, resumos, piquetes, eventos, insights };

export function getLote(id: string): Lote | undefined {
  return lotes.find((l) => l.id === id);
}
export function getResumo(id: string): ResumoLote | undefined {
  return resumos.find((r) => r.loteId === id);
}
export function insightDaFazenda(dominio: Dominio): IaInsight | undefined {
  return insights.find((i) => i.escopo === "fazenda" && i.dominio === dominio);
}
export function insightDoLote(loteId: string): IaInsight | undefined {
  return insights.find((i) => i.escopo === "lote" && i.loteId === loteId);
}
