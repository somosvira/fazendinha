import type { ClasseReprodutivaAptidao } from "./criterios-aptidao.calc.js";

export type EvidenciaClasseReprodutiva = {
  id: string; data: Date; criadoEm: Date; status: string; classeReprodutiva?: string | null;
};
/** Contagem zero não é evidência de nuliparidade. Declarações conservam a identidade do fato inicial. */
export function resolverClasseReprodutiva(input: {
  referencia: Date; dataEntrada: Date; partosAntesDaEntrada: number;
  partos: readonly { id: string; data: Date; status: string }[];
  iniciais: readonly EvidenciaClasseReprodutiva[];
}): { classe: ClasseReprodutivaAptidao; conflito: boolean; evidenciaIds: string[] } {
  const partos = input.partos.filter(p => p.status === "VALIDO" && p.data <= input.referencia);
  const saldoPositivo = input.dataEntrada <= input.referencia && input.partosAntesDaEntrada > 0;
  const declaracoes = input.iniciais.filter(i => i.status === "VALIDO" && i.data <= input.referencia && ["VACA", "NOVILHA"].includes(i.classeReprodutiva ?? ""))
    .sort((a, b) => b.data.getTime() - a.data.getTime() || b.criadoEm.getTime() - a.criadoEm.getTime() || b.id.localeCompare(a.id));
  const declaracao = declaracoes[0];
  if (declaracao?.classeReprodutiva === "NOVILHA" && (
    saldoPositivo || partos.some(p => p.data <= declaracao.data)
    || declaracoes.some(i => i.classeReprodutiva === "VACA" && i.data <= declaracao.data)
  )) return { classe: "NAO_DETERMINADA", conflito: true, evidenciaIds: [declaracao.id] };
  if (partos.length || saldoPositivo || declaracao?.classeReprodutiva === "VACA")
    return { classe: "VACA", conflito: false, evidenciaIds: [...partos.map(p => p.id), ...(declaracao?.classeReprodutiva === "VACA" ? [declaracao.id] : [])] };
  return { classe: declaracao?.classeReprodutiva === "NOVILHA" ? "NOVILHA" : "NAO_DETERMINADA", conflito: false, evidenciaIds: declaracao ? [declaracao.id] : [] };
}
