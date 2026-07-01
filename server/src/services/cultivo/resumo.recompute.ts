export type LinhaCusto = { classe: "CUSTEIO" | "INVESTIMENTO"; valor: number; horasMaquina?: number | null; areaCultivoId?: number | null };
export type LinhaProducao = { tipo: "GRAO" | "SILAGEM"; quantidade: number; areaCultivoId?: number | null };
export type ResumoInput = { areaHaTotal: number; areas: { id: number; areaHa: number }[]; custos: LinhaCusto[]; producoes: LinhaProducao[] };
export type ResumoCalc = {
  custeioTotal: number; investimentoTotal: number; areaHa: number;
  producaoGraoSc: number; producaoSilagemTon: number;
  custoHa: number | null; custoSaca: number | null; custoTonelada: number | null;
  horasMaquinaTotal: number; nota: string | null;
};

const soma = (ns: number[]) => ns.reduce((a, b) => a + b, 0);
const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export function calcularResumoSafra(input: ResumoInput): ResumoCalc {
  const { areas, custos, producoes } = input;

  const custeioTotal = soma(custos.filter((c) => c.classe === "CUSTEIO").map((c) => c.valor));
  const investimentoTotal = soma(custos.filter((c) => c.classe === "INVESTIMENTO").map((c) => c.valor));
  const horasMaquinaTotal = soma(custos.map((c) => c.horasMaquina ?? 0));
  const areaHa = areas.length > 0 ? soma(areas.map((a) => a.areaHa)) : input.areaHaTotal;
  const producaoGraoSc = soma(producoes.filter((p) => p.tipo === "GRAO").map((p) => p.quantidade));
  const producaoSilagemTon = soma(producoes.filter((p) => p.tipo === "SILAGEM").map((p) => p.quantidade));

  const custoHa = div(custeioTotal, areaHa);

  let custoSaca: number | null = null;
  let custoTonelada: number | null = null;
  let nota: string | null = null;

  if (areas.length > 0) {
    // Áreas que produzem cada saída (uma área pode aparecer só num bucket).
    const areasGrao = new Set(producoes.filter((p) => p.tipo === "GRAO").map((p) => p.areaCultivoId));
    const areasSilagem = new Set(producoes.filter((p) => p.tipo === "SILAGEM").map((p) => p.areaCultivoId));
    const custeioAreas = (set: Set<number | null | undefined>) =>
      soma(custos.filter((c) => c.classe === "CUSTEIO" && set.has(c.areaCultivoId)).map((c) => c.valor));
    custoSaca = div(custeioAreas(areasGrao), producaoGraoSc);
    custoTonelada = div(custeioAreas(areasSilagem), producaoSilagemTon);
  } else {
    const temGrao = producaoGraoSc > 0;
    const temSilagem = producaoSilagemTon > 0;
    if (temGrao && temSilagem) {
      nota = "Safra mista (grão + silagem) sem áreas — cadastre áreas para custo por unidade.";
    } else if (temGrao) {
      custoSaca = div(custeioTotal, producaoGraoSc);
    } else if (temSilagem) {
      custoTonelada = div(custeioTotal, producaoSilagemTon);
    }
  }

  return { custeioTotal, investimentoTotal, areaHa, producaoGraoSc, producaoSilagemTon, custoHa, custoSaca, custoTonelada, horasMaquinaTotal, nota };
}
