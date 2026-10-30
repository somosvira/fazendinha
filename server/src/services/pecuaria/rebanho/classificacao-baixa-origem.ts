import type { TipoBaixa } from "@prisma/client";
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function tipoRepetidoPeloNome(motivoNome: string | null): TipoBaixa | null {
  const n = semAcento(motivoNome ?? "").trim();
  if (n === "venda") return "VENDA";
  if (n === "abate") return "ABATE";
  if (n === "doacao") return "DOACAO";
  if (n === "morte") return "MORTE";
  if (n === "extravio") return "EXTRAVIO";
  if (n === "cadastro indevido") return "CADASTRO_INDEVIDO";
  return null;
}
/** Classes 1/2 comprovam descarte, mas não comprovam venda/abate/doação.
 * Nome genérico de causa também não comprova morte sem a classe 3.
 * Ambiguidade e contradição exigem reconciliação, nunca um tipo presumido. */
export function mapBaixaIdeagri(motivoNome: string | null, tipoIdeagri: number | null): { tipo: TipoBaixa; usarMotivo: boolean } {
  const repetido = tipoRepetidoPeloNome(motivoNome);
  if (repetido && (tipoIdeagri === 3 && repetido !== "MORTE" ||
      (tipoIdeagri === 1 || tipoIdeagri === 2) && repetido === "MORTE"))
    throw new Error("Conflito entre tipo e descrição da baixa; exige revisão da origem.");
  if (repetido) return { tipo: repetido, usarMotivo: false };
  if (tipoIdeagri === 3) return { tipo: "MORTE", usarMotivo: true };
  throw new Error("Tipo da baixa não comprovado; exige regularização histórica documentada, sem presumir venda ou morte.");
}
