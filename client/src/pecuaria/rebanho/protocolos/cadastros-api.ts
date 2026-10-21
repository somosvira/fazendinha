import { comPropriedade } from "../../../propriedadeScope";
export type PaginaCadastro<T> = { itens: T[]; total: number; pagina: number; porPagina: number; revisao?: string };
export type CadastroProtocoloMeta = {
  id: string; nome: string; descricao: string | null; tipo: "SANITARIO" | "REPRODUTIVO"; versao: number;
  ativo: boolean; publicado: boolean; publicadoEm: string | null; atualizadoEm: string;
  totalEtapas: number; utilizada: boolean; proximaVersao?: number;
  referenciaTecnica?: { fonte?: { titulo: string; url: string }; versaoReferencia?: string; protocoloOrigemId?: string } | null;
};
export async function reqCadastroProtocolo<T>(caminho: string): Promise<T> {
  const resposta = await fetch(`/api/pecuaria/rebanho/protocolos/cadastros${caminho}`, { headers: comPropriedade() });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.error ?? `Erro HTTP ${resposta.status}`);
  return dados as T;
}
export const listarCadastrosProtocolos = (tipo: CadastroProtocoloMeta["tipo"], pagina: number, busca = "", situacao = "TODAS") => reqCadastroProtocolo<PaginaCadastro<CadastroProtocoloMeta>>(`?${new URLSearchParams({ tipo, pagina: String(pagina), porPagina: "10", busca, situacao })}`);
export const obterCadastroProtocolo = (id: string) => reqCadastroProtocolo<CadastroProtocoloMeta>(`/${encodeURIComponent(id)}`);
export const obterAcoesCadastro = <T,>(origem: CadastroProtocoloMeta, pagina: number) => reqCadastroProtocolo<PaginaCadastro<T>>(`/${encodeURIComponent(origem.id)}/acoes?${new URLSearchParams({ pagina: String(pagina), porPagina: "10", revisao: origem.atualizadoEm })}`);
