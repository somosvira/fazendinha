import { reqCadastroProtocolo, type CadastroProtocoloMeta, type PaginaCadastro } from "./cadastros-api";
export type ProcedimentoCadastro = {
  id: string; nome: string; procedimento: string; intervalo: number; unidadeIntervalo: string;
  referencia: string | null; definirMaterialNoAtendimento: boolean;
  quantidade: string | null; unidadeQuantidade: string | null; via: string | null; orientacaoUso: string | null;
};
export type EtapaEstruturaCadastro = {
  id: string; nome: string; agrupada: boolean; instrucoesGerais: string | null; modoAtendimento: string | null;
  procedimentos: PaginaCadastro<ProcedimentoCadastro>;
};
const consulta = (origem: CadastroProtocoloMeta, pagina: number) => new URLSearchParams({ pagina: String(pagina), porPagina: "10", revisao: origem.atualizadoEm });
export const obterEstruturaCadastro = (origem: CadastroProtocoloMeta, pagina: number) => reqCadastroProtocolo<PaginaCadastro<EtapaEstruturaCadastro>>(`/${encodeURIComponent(origem.id)}/estrutura?${consulta(origem,pagina)}`);
export const obterProcedimentosEtapaCadastro = (origem: CadastroProtocoloMeta, etapaId: string, pagina: number) => reqCadastroProtocolo<PaginaCadastro<ProcedimentoCadastro>>(`/${encodeURIComponent(origem.id)}/estrutura/${encodeURIComponent(etapaId)}/procedimentos?${consulta(origem,pagina)}`);
