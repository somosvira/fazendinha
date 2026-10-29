/** Ausência de uma lactação conhecida não comprova secagem. O tipo técnico permanece preservado. */
export function rotuloLactacao(situacao: string | null | undefined): string {
  return situacao === "LACTANTE" ? "Lactante" : situacao === "SECA" ? "Seca" : "Não informada";
}
