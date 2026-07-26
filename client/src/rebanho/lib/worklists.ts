import type { ResumoAnimal } from "../types";
import { diffDias } from "./derive";

// A inseminar: somente VAZIA. PEV é a janela voluntária em que o manejo ainda espera.
export function aInseminar(resumos: ResumoAnimal[]): ResumoAnimal[] {
  return resumos.filter((r) => r.statusReprodutivo === "VAZIA");
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

// ── A desmamar (parametrizado: DESMAME_MODO / DESMAME_DIAS / DESMAME_PESO_KG) ──
//
// Candidatas são as crias — BEZERRO/BEZERRA/CABRITO/CABRITA. Não existe evento
// ou status de desmame no schema, então a categoria é o proxy de "ainda não
// desmamado" (ao desmamar/recategorizar, o animal sai da lista).
//   modo DIAS → idade ≥ `dias` (sem dataNascimento fica de fora);
//   modo PESO → última pesagem ≥ `pesoKg` (sem pesagem fica de fora, mas é
//               contada em `semPeso` pra UI poder avisar).

export type ModoDesmame = "DIAS" | "PESO";
export interface CriterioDesmame { modo: ModoDesmame; dias: number; pesoKg: number }
export interface ResultadoDesmame { lista: ResumoAnimal[]; semPeso: number }

const CATEGORIAS_CRIA: ReadonlySet<string> = new Set(["BEZERRO", "BEZERRA", "CABRITO", "CABRITA"]);

export function aDesmamar(resumos: ResumoAnimal[], criterio: CriterioDesmame, hoje: string): ResultadoDesmame {
  const crias = resumos.filter((r) => r.categoria != null && CATEGORIAS_CRIA.has(r.categoria));
  if (criterio.modo === "PESO") {
    return {
      lista: crias.filter((r) => r.ultimoPesoKg != null && r.ultimoPesoKg >= criterio.pesoKg),
      semPeso: crias.filter((r) => r.ultimoPesoKg == null).length,
    };
  }
  return {
    lista: crias.filter((r) => r.dataNascimento != null && diffDias(r.dataNascimento, hoje) >= criterio.dias),
    semPeso: 0,
  };
}

// Extrai o critério de desmame da lista de parâmetros da API (/rebanho/parametros).
// Fallbacks são os defaults Embrapa (mesmos do PARAMETRO_DEFAULTS do server).
export function criterioDesmame(
  parametros?: { chave: string; valorNumero: number | null; modo: string | null }[] | null
): CriterioDesmame {
  const por = (chave: string) => parametros?.find((p) => p.chave === chave);
  return {
    modo: por("DESMAME_MODO")?.modo === "PESO" ? "PESO" : "DIAS",
    dias: por("DESMAME_DIAS")?.valorNumero ?? 120,
    pesoKg: por("DESMAME_PESO_KG")?.valorNumero ?? 180,
  };
}
