import { calcularTaxaConcepcao, type EvtConcepcao, type TaxaConcepcaoMetodo } from "./reproducao.concepcao.js";

export interface RelatorioReproducao {
  periodo: { de: string | null; ate: string | null };
  coberturas: number;
  prenhes: number;
  partos: number;
  taxaConcepcao: number | null;
  porMetodo: TaxaConcepcaoMetodo[];
}

// Agrega o relatório reprodutivo de um conjunto de eventos, opcionalmente numa janela
// [de, ate] (ISO YYYY-MM-DD, inclusiva). Reusa calcularTaxaConcepcao para o corte por
// método (IA/MN/TE) e consolida os totais. taxa nunca é NaN (null quando 0 coberturas).
export function agregarRelatorioReproducao(
  eventos: readonly EvtConcepcao[],
  janela: { de?: string; ate?: string },
): RelatorioReproducao {
  const de = janela.de ?? null;
  const ate = janela.ate ?? null;
  const naJanela = eventos.filter((e) => (de == null || e.data >= de) && (ate == null || e.data <= ate));

  const porMetodo = calcularTaxaConcepcao(naJanela.slice());
  const coberturas = porMetodo.reduce((s, m) => s + m.coberturas, 0);
  const prenhes = porMetodo.reduce((s, m) => s + m.prenhes, 0);
  const partos = naJanela.filter((e) => e.tipo === "PARTO").length;

  return {
    periodo: { de, ate },
    coberturas,
    prenhes,
    partos,
    taxaConcepcao: coberturas > 0 ? prenhes / coberturas : null,
    porMetodo,
  };
}
