import type { ConsultaBuscavel, ResultadoBuscavel } from "../../../components/SelectBuscavel";
import { consultaProtocolo, reqProtocolo } from "./api";

export type OpcaoCatalogoProtocolo = "PRODUTO" | "MATERIAL" | "TIPO_EXAME" | "TIPO_APLICACAO";
export type EscolhaCatalogoProtocolo = { id: string; nome: string; unidade?: string; tipo?: string; ativo?: boolean; perfilSanitario?: { viaPadrao?: string | null; orientacaoUso?: string | null; tipoAplicacaoId?: string | null } | null };
type PaginaOpcoes = ResultadoBuscavel<EscolhaCatalogoProtocolo> & { pagina: number; porPagina: number };

/** Consulta das opções de um cadastro de protocolo (produto, material, exame ou tipo de aplicação) para o `SelectBuscavel`. */
export const opcoesProtocolo = (f: { opcao: OpcaoCatalogoProtocolo; origem: "SANITARIO" | "REPRODUTIVO"; tipoTentativa?: "IA" | "TE"; propriedadeId?: number }) =>
  ({ busca, selecionadoId }: ConsultaBuscavel) =>
    reqProtocolo<PaginaOpcoes>(`/cadastros/opcoes${consultaProtocolo({ opcao: f.opcao, origem: f.origem, tipoTentativa: f.tipoTentativa, pagina: 1, busca, selecionadoId })}`, f.propriedadeId);

/** Via e orientação de uso do produto escolhido, mostradas abaixo do campo de produto. */
export const detalheProdutoSanitario = (produto: EscolhaCatalogoProtocolo) => {
  const perfil = produto.perfilSanitario;
  if (!perfil?.viaPadrao && !perfil?.orientacaoUso) return null;
  return <div className="grid gap-0.5">{perfil.viaPadrao && <p className="text-sm">Via: {perfil.viaPadrao}</p>}{perfil.orientacaoUso && <p className="text-sm">Orientação de uso: {perfil.orientacaoUso}</p>}</div>;
};
