import type { MesFluxo } from "../../components/relatorio-gerencial/types";

/** Acumula apenas o resultado mensal salvo, sem inferir saldo bancário ou abertura. */
export function serieCaixaMensal(meses: readonly MesFluxo[]) {
  let acumuladoCentavos = 0;
  return [...meses].sort((a, b) => a.mes.localeCompare(b.mes)).map(mes => {
    acumuladoCentavos += Math.round(mes.resultado * 100);
    return { ...mes, acumulado: acumuladoCentavos / 100 };
  });
}
