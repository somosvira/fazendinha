import { reqV4 } from "./api";
export type DemandaAcompanhamento = { id: string; tarefaId?: string | null; finalidade: "DIAGNOSTICO" | "RECONFIRMACAO" | "SEXAGEM"; ocorrencia: number; tentativaId: string | null; gestacaoId: string | null; previstaPara: string | null; estado: string; motivoEncerramento: string | null; regraSnapshot: { politicaVersao?: number; tipoExameId?: string | null; tipoExameVersao?: number | null }; exameResolucaoId: string | null; pendencias?: string[] };
export type ResumoAcompanhamentos = { total: number; pendentes: number; resolvidas: number; encerradas: number; semData: number };
export type PaginaAcompanhamentos = { itens: DemandaAcompanhamento[]; total: number; pagina: number; porPagina: number; resumo: ResumoAcompanhamentos };
export function listarDemandasAcompanhamento(propriedadeId: number, animalId: string, pagina = 1, estado = "", finalidade = "", porPagina = 10) {
  const q = new URLSearchParams({ animalId, pagina: String(pagina), porPagina: String(porPagina) });
  if (estado) q.set("estado", estado);
  if (finalidade) q.set("finalidade", finalidade);
  return reqV4<PaginaAcompanhamentos>(`/reproducao/acompanhamento?${q}`, undefined, "GET", propriedadeId);
}
