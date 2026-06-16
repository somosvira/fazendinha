import { animais, resumos } from "./animais";
import { eventos } from "./eventos";
import { insights } from "./insights";
import type { Animal, ResumoAnimal, IaInsight } from "../types";

export { animais, resumos, eventos, insights };

export function getAnimal(id: string): Animal | undefined {
  return animais.find((a) => a.id === id);
}
export function getResumo(id: string): ResumoAnimal | undefined {
  return resumos.find((r) => r.animalId === id);
}
export function insightDoRebanho(dominio: string): IaInsight | undefined {
  return insights.find((i) => i.escopo === "rebanho" && i.dominio === dominio);
}
export function insightDoAnimal(animalId: string): IaInsight | undefined {
  return insights.find((i) => i.escopo === "animal" && i.animalId === animalId);
}
