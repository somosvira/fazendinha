import { ehAborto } from "./parto.dict.js";

export interface EventoResumoMensalIn {
  tipo: string;
  resultado?: string | null;
  tipoParto?: string | null;
}

export interface EventosResumoMensal {
  partos: number;
  prenhezes: number;
  secagens: number;
}

const positivo = (resultado?: string | null) =>
  (resultado ?? "").trim().toLocaleLowerCase("pt-BR") === "positivo";

/**
 * Contagens factuais do mês. Aborto não é apresentado como parto e prenhez só
 * entra quando existe um diagnóstico positivo registrado no período.
 */
export function agregarEventosResumoMensal(
  eventos: readonly EventoResumoMensalIn[],
): EventosResumoMensal {
  return {
    partos: eventos.filter((e) => e.tipo === "PARTO" && !ehAborto(e.tipoParto)).length,
    prenhezes: eventos.filter((e) => e.tipo === "DIAGNOSTICO" && positivo(e.resultado)).length,
    secagens: eventos.filter((e) => e.tipo === "SECAGEM").length,
  };
}

