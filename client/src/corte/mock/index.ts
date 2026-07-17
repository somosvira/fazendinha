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
// Banda de insight de IA ocultada até haver IA real — o texto era fabricado (mock).
// Reversível: restaurar o corpo `insights.find(...)` religa a banda.
export function insightDaFazenda(_dominio: Dominio): IaInsight | undefined {
  return undefined;
}
export function insightDoLote(loteId: string): IaInsight | undefined {
  return insights.find((i) => i.escopo === "lote" && i.loteId === loteId);
}
