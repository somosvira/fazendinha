import { dataOuHorario } from "./schemas.js";
export type PrecisaoIatf = "DIA" | "HORA";
export function diaIatf(valor: Date, precisao: PrecisaoIatf = "HORA"): string {
  return precisao === "DIA" ? valor.toISOString().slice(0, 10) : new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(valor);
}
export function lerDataIatf(valor: string) {
  const entrada = dataOuHorario.parse(valor);
  const precisao: PrecisaoIatf = entrada.length === 10 ? "DIA" : "HORA";
  const instante = new Date(entrada);
  return { instante, precisao, data: diaIatf(instante, precisao) };
}
export function serializarDataIatf(valor: Date, precisao: PrecisaoIatf = "HORA") {
  return precisao === "DIA" ? diaIatf(valor, precisao) : valor.toISOString();
}
/** Uma ordem intradiária só pode ser conferida quando as duas horas são conhecidas. */
export function anteriorIatf(a: Date, precisaoA: PrecisaoIatf, b: Date, precisaoB: PrecisaoIatf) {
  return precisaoA === "HORA" && precisaoB === "HORA" ? a < b : diaIatf(a, precisaoA) < diaIatf(b, precisaoB);
}
