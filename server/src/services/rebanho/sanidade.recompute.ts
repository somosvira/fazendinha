export interface EvtSan { tipo: "OCORRENCIA" | "APLICACAO" | "EXAME" | "MASTITE" | "VACINA"; data: string; ccs?: number | null; }
export interface ResumoSan { ccs: number | null; ccsTendencia: "subindo" | "estavel" | "caindo" | null; }

export function recomputarResumoSanidade(eventos: EvtSan[]): ResumoSan {
  const exames = eventos.filter((e) => e.tipo === "EXAME" && e.ccs != null).slice().sort((a, b) => Date.parse(a.data) - Date.parse(b.data));
  if (!exames.length) return { ccs: null, ccsTendencia: null };
  const ccs = exames[exames.length - 1].ccs!;
  const ult = exames.slice(-3).map((e) => e.ccs!);
  let ccsTendencia: ResumoSan["ccsTendencia"] = "estavel";
  if (ult.length >= 2) {
    const cresc = ult.every((v, i) => i === 0 || v > ult[i - 1]);
    const decr = ult.every((v, i) => i === 0 || v < ult[i - 1]);
    ccsTendencia = cresc ? "subindo" : decr ? "caindo" : "estavel";
  }
  return { ccs, ccsTendencia };
}
