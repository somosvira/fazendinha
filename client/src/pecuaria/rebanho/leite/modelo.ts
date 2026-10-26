import type { AnimalFolhaLeite, MedicaoInput, ResumoLeite } from "./types";
export const formatarLitros = (n: number | null) =>
  n === null
    ? "Não informado"
    : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} L`;
export function lerLitros(valor: string): number | null {
  if (!valor.trim()) return null;
  if (!/^\d+(?:[.,]\d{1,3})?$/.test(valor.trim()))
    throw new Error(
      "Informe litros positivos ou zero, com até três casas decimais.",
    );
  const litros = Number(valor.replace(",", "."));
  if (!Number.isFinite(litros) || litros > 9999999.999)
    throw new Error("Quantidade de litros fora do limite permitido.");
  return litros;
}
export function resumirCelulas(celulas: MedicaoInput[]): ResumoLeite {
  const medidas = celulas.filter((m) => m.estado === "MEDIDO");
  const naoOrdenhadas = celulas.filter(
    (m) => m.estado === "NAO_ORDENHADO",
  ).length;
  return {
    litros: medidas.length
      ? Math.round(medidas.reduce((s, m) => s + (m.litros ?? 0), 0) * 1000) /
        1000
      : null,
    esperadas: celulas.length,
    medidas: medidas.length,
    naoOrdenhadas,
    resolvidas: medidas.length + naoOrdenhadas,
    pendentes: celulas.length - medidas.length - naoOrdenhadas,
    completa:
      celulas.length > 0 && medidas.length + naoOrdenhadas === celulas.length,
  };
}
export function celulasFolha(animais: AnimalFolhaLeite[]): MedicaoInput[] {
  return animais.flatMap((a) =>
    a.medicoes.map((m) => ({
      animalId: a.animalId,
      posicaoId: m.posicaoId,
      estado: m.estado,
      litros: m.litros,
      motivo: m.motivo,
    })),
  );
}
export function hojeOperacional() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function dataValida(valor: string | null): valor is string {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = new Date(`${valor}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}
