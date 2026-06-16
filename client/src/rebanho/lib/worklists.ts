import type { ResumoAnimal } from "../types";
import { diffDias } from "./derive";

// Aptas a inseminar: fora do período prenhe/inseminada (PEV ou VAZIA).
export function aInseminar(resumos: ResumoAnimal[]): ResumoAnimal[] {
  return resumos.filter((r) => r.statusReprodutivo === "PEV" || r.statusReprodutivo === "VAZIA");
}

// DG pendente: inseminadas aguardando diagnóstico.
export function dgPendente(resumos: ResumoAnimal[]): ResumoAnimal[] {
  return resumos.filter((r) => r.statusReprodutivo === "INSEMINADA");
}

// A secar: prenhes cuja previsão de secagem já passou (atrasada).
export function aSecar(resumos: ResumoAnimal[], hoje: string): ResumoAnimal[] {
  return resumos.filter((r) => r.statusReprodutivo === "PRENHE" && r.previsaoSecagem !== undefined && diffDias(r.previsaoSecagem, hoje) >= 0);
}

// Partos previstos: prenhes com gestação >= 250 dias (≈ últimos 30d antes do parto).
export function partosPrevistos(resumos: ResumoAnimal[]): ResumoAnimal[] {
  return resumos.filter((r) => r.statusReprodutivo === "PRENHE" && (r.diasGestacao ?? 0) >= 250);
}
