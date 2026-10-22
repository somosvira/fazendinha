import { RebanhoError } from "../rebanho/regras.js";

export interface FinalidadeContextoLeite { id: string; aptidao: string; desde: Date; ate: Date | null }
export interface BaixaFinalidadeContextoLeite { id?: string; data: Date; destinoFechadoId?: string | null }
export const REGRA_FINALIDADE_LEITE = "FINALIDADE_LEITE_V1" as const;
export function resolverFinalidadeLeite(finalidades: readonly FinalidadeContextoLeite[], data: Date, baixas: readonly BaixaFinalidadeContextoLeite[] = []) {
  const baixaNaExtremidade = (f: FinalidadeContextoLeite) => f.ate?.getTime() === data.getTime()
    ? baixas.find(b => b.id && b.destinoFechadoId === f.id && b.data.getTime() === data.getTime()) : undefined;
  // O intervalo segue [desde,ate). Só a baixa ativa comprovada preserva os fatos
  // do próprio dia, vinculando exatamente a finalidade que ela fechou.
  const vigentes = finalidades.filter(f => f.desde <= data && (f.ate === null || f.ate > data || baixaNaExtremidade(f)));
  if (vigentes.length !== 1) return { elegivel: false as const, codigo: vigentes.length ? "FINALIDADE_CONFLITANTE" : "FINALIDADE_AUSENTE",
    motivo: vigentes.length ? "Há finalidades sobrepostas na data; concilie o cadastro antes de medir" : "Finalidade não comprovada na data; concilie o cadastro antes de medir" };
  const finalidade = vigentes[0];
  if (finalidade.aptidao !== "LEITE") return { elegivel: false as const, codigo: `FINALIDADE_${finalidade.aptidao}`,
    motivo: `Animal com finalidade ${finalidade.aptidao === "REPRODUCAO" ? "Reprodução" : "Corte"} na data não participa da produção de leite` };
  return { elegivel: true as const, finalidade, baixaNaExtremidade: baixaNaExtremidade(finalidade), codigo: null, motivo: null };
}
export function exigirFinalidadeLeite(finalidades: readonly FinalidadeContextoLeite[], data: Date, baixas: readonly BaixaFinalidadeContextoLeite[] = []) {
  const resolvida = resolverFinalidadeLeite(finalidades, data, baixas);
  if (!resolvida.elegivel) throw new RebanhoError("CONFLITO", resolvida.motivo, "finalidade");
  return { finalidadeId: resolvida.finalidade.id, finalidadeSnapshot: { regra: REGRA_FINALIDADE_LEITE, aptidao: "LEITE" as const,
    finalidadeId: resolvida.finalidade.id, dataOperacional: data.toISOString().slice(0, 10),
    desde: resolvida.finalidade.desde.toISOString().slice(0, 10), ate: resolvida.finalidade.ate?.toISOString().slice(0, 10) ?? null,
    motivoExtremidade: resolvida.baixaNaExtremidade ? "BAIXA_NO_DIA" : null, baixaId: resolvida.baixaNaExtremidade?.id ?? null } };
}
export interface EvidenciaFinalidadeLeiteDTO {
  estado: "COMPROVADA" | "PENDENTE_CONCILIACAO"; finalidadeId: string | null; aptidao: "LEITE" | null;
  dataOperacional: string; regra: typeof REGRA_FINALIDADE_LEITE | null;
}
/** Não deduz evidência antiga da finalidade aberta hoje. */
export function evidenciaFinalidadeLeite(p: { finalidadeId?: string | null; finalidadeSnapshot?: unknown }, data: string): EvidenciaFinalidadeLeiteDTO {
  const s = p.finalidadeSnapshot && typeof p.finalidadeSnapshot === "object" && !Array.isArray(p.finalidadeSnapshot)
    ? p.finalidadeSnapshot as Record<string, unknown> : {};
  const comprovada = Boolean(p.finalidadeId && s.finalidadeId === p.finalidadeId && s.regra === REGRA_FINALIDADE_LEITE && s.aptidao === "LEITE" && s.dataOperacional === data &&
    typeof s.desde === "string" && s.desde <= data && (s.ate === null || typeof s.ate === "string" && (s.ate > data || s.ate === data && s.motivoExtremidade === "BAIXA_NO_DIA" && typeof s.baixaId === "string" && s.baixaId.length > 0)));
  return { estado: comprovada ? "COMPROVADA" : "PENDENTE_CONCILIACAO", finalidadeId: p.finalidadeId ?? null,
    aptidao: comprovada ? "LEITE" : null, dataOperacional: data, regra: comprovada ? REGRA_FINALIDADE_LEITE : null };
}
