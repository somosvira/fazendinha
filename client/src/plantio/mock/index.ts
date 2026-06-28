import { talhoes, resumos } from "./talhoes";
import { eventos } from "./eventos";
import { insights } from "./insights";
import { lavouras, planosAdubacao } from "./lavouras";
import type { Talhao, ResumoTalhao, IaInsight, Dominio } from "../types";

export { talhoes, resumos, eventos, insights, lavouras, planosAdubacao };

export function getTalhao(id: string): Talhao | undefined {
  return talhoes.find((t) => t.id === id);
}
export function getResumo(id: string): ResumoTalhao | undefined {
  return resumos.find((r) => r.talhaoId === id);
}
export function insightDaLavoura(dominio: Dominio): IaInsight | undefined {
  return insights.find((i) => i.escopo === "lavoura" && i.dominio === dominio);
}
export function insightDoTalhao(talhaoId: string): IaInsight | undefined {
  return insights.find((i) => i.escopo === "talhao" && i.talhaoId === talhaoId);
}
