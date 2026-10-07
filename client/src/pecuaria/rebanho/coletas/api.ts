import { comPropriedade } from "../../../propriedadeScope";
import type { AplicacaoInput } from "../sanidade/api";
export type AnimalFichaCampo = { animalId: string; brinco: string; nome: string | null; loteId: string; loteNome: string };
export type ItemCampo = { animalId: string; situacao: "PENDENTE" | "REALIZADO" | "NAO_REALIZADO"; peso: string; motivo: string; observacao: string; aplicacao?: AplicacaoInput };
export type RascunhoCampo = { tipoPesagem: "ROTINA" | "ENTRADA" | "DESMAMA" | "SAIDA"; origemPesagem: "MANUAL" | "BALANCA"; tipoExameId?: string; responsavel?: string; itens: ItemCampo[] };
export type ResumoColeta = { id: string; propriedadeId: number; data: string; tipo: "PESAGEM" | "EXAME" | "APLICACAO"; titulo: string; status: "PREPARADA" | "EM_PREENCHIMENTO" | "CONCLUIDA"; versao: number; propriedade?: { nome: string } };
export type ColetaCampoDTO = ResumoColeta & { snapshot: { propriedadeNome: string; animais: AnimalFichaCampo[] }; rascunho: RascunhoCampo; resultados: Array<{ animalId: string; id: string; tipo: string }> | null };
export class ColetaApiError extends Error { constructor(message: string, public campo?: string) { super(message); } }
async function req<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch(`/api/pecuaria/rebanho/coletas${path.replace(/^\/(?=\?|$)/, "")}`, { method, headers: comPropriedade(body ? { "content-type": "application/json" } : {}), ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ColetaApiError(data.error ?? "Não conseguimos atualizar a ficha. Tente novamente.", data.campo);
  return data as T;
}
export const listarColetas = (pagina: number, tipo?: ResumoColeta["tipo"]) => req<{ itens: ResumoColeta[]; total: number; pagina: number; limite: number }>(`/?pagina=${pagina}${tipo ? `&tipo=${tipo}` : ""}`);
export const autorizarImpressao = (id: string) => req<ColetaCampoDTO>(`/${encodeURIComponent(id)}/impressao`);
export const obterColeta = (id: string) => req<ColetaCampoDTO>(`/${encodeURIComponent(id)}`);
export const prepararColeta = (body: { id: string; propriedadeId: number; data: string; tipo: ResumoColeta["tipo"]; titulo: string; loteIds: string[] }) => req<ColetaCampoDTO>("/", "POST", body);
export const salvarRascunho = (coleta: ColetaCampoDTO, rascunho: RascunhoCampo) => req<ColetaCampoDTO>(`/${coleta.id}/rascunho`, "PUT", { propriedadeId: coleta.propriedadeId, versao: coleta.versao, rascunho });
export const concluirColeta = (coleta: ColetaCampoDTO) => req<ColetaCampoDTO>(`/${coleta.id}/confirmacao`, "POST", { propriedadeId: coleta.propriedadeId, versao: coleta.versao });
