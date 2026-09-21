export type FrequenciaParcelas = "SEMANAL" | "MENSAL";

const inteiro = (valor: unknown): valor is string => typeof valor === "string" && /^\d+(?:[.,]\d{0,2})?$/.test(valor.trim());

export function paraCentavos(valor: unknown): number | null {
  if (!inteiro(valor)) return null;
  const [inteiroParte, decimal = ""] = valor.trim().replace(",", ".").split(".");
  const centavos = Number(inteiroParte) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(centavos) ? centavos : null;
}

export function deCentavos(centavos: number) {
  return (centavos / 100).toFixed(2);
}

export function somarParcelas(parcelas: readonly { valor: string }[]) {
  return parcelas.reduce((soma, parcela) => soma + (paraCentavos(parcela.valor) ?? 0), 0);
}
