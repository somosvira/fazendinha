/** DIA representa somente uma data; HORA conserva o instante do início efetivo. */
export function deslocarCalendario(inicio: Date, intervalo: number, unidade: "DIAS" | "HORAS", precisao: "DIA" | "HORA") {
  if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(intervalo) || intervalo < 0) throw new Error("Referência ou intervalo de calendário inválido");
  if (precisao === "DIA" && (unidade !== "DIAS" || !Number.isInteger(intervalo))) throw new Error("Calendário por data exige dias inteiros");
  return new Date(inicio.getTime() + intervalo * (unidade === "DIAS" ? 86_400_000 : 3_600_000));
}
