import { comPropriedade } from '../propriedadeScope';
import { ApiError } from './api';
export type TipoCatalogo = 'fabricantes' | 'classificacoes-tecnicas' | 'principios-ativos' | 'nutrientes';
export type UnidadeNutriente = 'PERCENTUAL' | 'MG_KG' | 'MCAL_KG';
export type ItemCatalogo = { id: string; nome: string; ativo: boolean; revisao: number; nomeCompleto?: string | null; unidadeReferencia?: UnidadeNutriente; origens?: Array<{ sistema: string; catalogo: string; codigoOrigem: string }> };
export type PaginaCatalogo = { itens: ItemCatalogo[]; total: number; pagina: number; porPagina: number };
export type FiltroCatalogo = { busca?: string; ativo?: boolean; pagina?: number; porPagina?: number; selecionadoId?: string };
async function pedido<T>(caminho: string, dados?: object, metodo = 'POST'): Promise<T> {
  const resposta = await fetch(`/api/estoque/${caminho}`, { headers: comPropriedade(dados ? { 'content-type': 'application/json' } : {}), ...(dados ? { method: metodo, body: JSON.stringify(dados) } : {}) });
  if (!resposta.ok) { const erro = await resposta.json().catch(() => null); throw new ApiError(typeof erro?.error === 'string' ? erro.error : 'Não foi possível consultar ou salvar o cadastro.', resposta.status, erro?.code, erro?.campo); }
  return resposta.json();
}
export const listarCatalogo = (tipo: TipoCatalogo, filtro: FiltroCatalogo = {}) => {
  const params = new URLSearchParams(); Object.entries(filtro).forEach(([chave, valor]) => { if (valor != null && valor !== '') params.set(chave, String(valor)); });
  return pedido<PaginaCatalogo>(`${tipo}?${params}`);
};
export const salvarCatalogo = (tipo: TipoCatalogo, dados: { nome: string; chaveReenvio: string; ativo?: boolean; revisaoEsperada?: number; motivoAlteracao?: string; nomeCompleto?: string | null; unidadeReferencia?: UnidadeNutriente }, id?: string) => pedido<ItemCatalogo>(`${tipo}${id ? `/${id}` : ''}`, dados, id ? 'PATCH' : 'POST');
export const UNIDADES_CONCENTRACAO = { MG_ML: 'mg/mL', MG_G: 'mg/g', G_L: 'g/L', UI_ML: 'UI/mL', UI_G: 'UI/g', PERCENTUAL_MASSA_MASSA: '% m/m', PERCENTUAL_MASSA_VOLUME: '% m/v', PERCENTUAL_VOLUME_VOLUME: '% v/v' } as const;
export type UnidadeConcentracao = keyof typeof UNIDADES_CONCENTRACAO;
export type ItemComposicao = { principioAtivoId: string; nomePrincipioSnapshot?: string; concentracaoValor: string | null; concentracaoUnidade: UnidadeConcentracao | null };
export type ItemNutricional = { nutrienteId: string; nomeNutrienteSnapshot?: string; unidadeSnapshot?: UnidadeNutriente; valor: string | null; base: 'MATERIA_NATURAL' | 'MATERIA_SECA' | 'NAO_INFORMADA' };
export type VersaoProduto<T> = { id: string | null; numero: number | null; situacao: 'INFORMADA' | 'NAO_INFORMADA'; referencia: string | null; motivoAlteracao?: string | null; criadoEm?: string | null; criadoPorId?: number | null; criadoPor?: { nome: string } | null; itens: T[] };
export type ComposicaoInput = { versaoEsperada: string | null; situacao: 'INFORMADA' | 'NAO_INFORMADA'; referencia: string | null; motivoAlteracao?: string; itens: ItemComposicao[] };
export type NutricionalInput = { versaoEsperada: string | null; situacao: 'INFORMADA' | 'NAO_INFORMADA'; referencia: string | null; motivoAlteracao?: string; itens: ItemNutricional[] };
export const historicoProduto = <T>(id: string, tipo: 'composicoes' | 'informacoes-nutricionais', pagina = 1) => pedido<{ itens: VersaoProduto<T>[]; total: number; pagina: number; porPagina: number }>(`produtos/${id}/${tipo}?pagina=${pagina}&porPagina=10`);
