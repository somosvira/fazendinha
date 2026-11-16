import { comPropriedade } from '../propriedadeScope';
import { ApiError } from './api';
// Fabricantes, classificações técnicas e princípios ativos são do catálogo do sistema: só consulta.
export type TipoCatalogo = 'fabricantes' | 'classificacoes-tecnicas' | 'principios-ativos';
export type ItemCatalogo = { id: string; codigoOrigem?: string; nome: string; ativo: boolean };
export type PaginaCatalogo = { itens: ItemCatalogo[]; total: number; pagina: number; porPagina: number };
export type FiltroCatalogo = { busca?: string; ativo?: boolean; pagina?: number; porPagina?: number; selecionadoId?: string };
const consultar = async <T,>(caminho: string, filtro: Record<string, unknown>): Promise<T> => {
  const params = new URLSearchParams(); Object.entries(filtro).forEach(([chave, valor]) => { if (valor != null && valor !== '') params.set(chave, String(valor)); });
  const resposta = await fetch(`/api/estoque/${caminho}?${params}`, { headers: comPropriedade({}) });
  if (!resposta.ok) { const erro = await resposta.json().catch(() => null); throw new ApiError(typeof erro?.error === 'string' ? erro.error : 'Não foi possível consultar o catálogo.', resposta.status, erro?.code, erro?.campo); }
  return resposta.json();
};
export const listarCatalogo = (tipo: TipoCatalogo, filtro: FiltroCatalogo = {}) => consultar<PaginaCatalogo>(tipo, filtro);

/** Item da aba Catálogo: produto do catálogo do sistema e, se já adotado, o produto da fazenda (`produtoId`). */
export type ItemCatalogoProduto = {
  id: string; nomeCompleto: string; apresentacao: string | null;
  fabricante: { id: string; nome: string } | null; classificacaoTecnica: { id: string; nome: string } | null;
  usoSanitario: boolean; usoNutricional: boolean; usoGenetico: boolean; produtoId: string | null;
};
export type PaginaCatalogoProdutos = { itens: ItemCatalogoProduto[]; total: number; pagina: number; porPagina: number };
export const listarCatalogoProdutos = (filtro: { busca?: string; pagina?: number; porPagina?: number } = {}) => consultar<PaginaCatalogoProdutos>('catalogo', filtro);
