import { comPropriedade } from "../../../propriedadeScope";

type EstadoCarencia = { estado: "NENHUMA" | "NAO_APLICAVEL" | "NAO_INFORMADO" } | { estado: "CONHECIDO"; ate: string; precisaoAproximada: boolean };
export type CarenciaAnimal = { leite: EstadoCarencia; carne: EstadoCarencia };
export type AplicacaoSanitaria = {
  id: string; animalId: string; propriedadeId?: number | null; data: string; aplicadaEm: string | null; finalidade: "TRATAMENTO" | "VACINA" | "VERMIFUGO" | null;
  nomeProdutoAplicado: string; dose: string; unidadeDose: string | null; origemInsumo: string;
  operacaoServicoId: string | null; status: "VALIDO" | "ANULADO";
  partidaCodigoSnapshot: string | null; partidaValidadeSnapshot: string | null; justificativaSemOrigem: string | null;
  tipoAplicacaoNomeSnapshot: string | null; responsavel: string | null;
  estadoCarenciaLeite: EstadoPrazo; estadoCarenciaCarne: EstadoPrazo;
  carenciaLeiteHoras: number | null; carenciaCarneHoras: number | null; justificativaCarenciaCarne: string | null;
};
export type ServicoSanitario = { id: string; numero: number; data: string; descricao: string | null; valorTotal?: string; parceiro: { nome: string } | null };

export async function reqSanidade<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`/api/pecuaria/rebanho/sanidade${caminho}`, {
    ...init, headers: comPropriedade({ ...(init?.body ? { "content-type": "application/json" } : {}), ...((init?.headers as Record<string, string>) ?? {}) }),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.error ?? `Erro HTTP ${resposta.status}`);
  return dados as T;
}
const req = reqSanidade;

export const listarAplicacoes = (animalId: string) => req<AplicacaoSanitaria[]>(`/aplicacoes?animalId=${encodeURIComponent(animalId)}`);
export const consultarCarencia = (animalId: string) => req<CarenciaAnimal>(`/animais/${encodeURIComponent(animalId)}/carencia`);
export const listarServicos = (propriedadeId: number) => req<ServicoSanitario[]>(`/servicos?propriedadeId=${propriedadeId}`);
export type TipoAplicacao = { id: string; nome: string; ativo: boolean };
export type CompraDireta = { id: string; produtoId: string; disponivel: string; unidade: string; produto: { nome: string }; operacao: { numero: number; data: string } };
export const listarTiposAplicacao = () => req<TipoAplicacao[]>("/tipos-aplicacao");
export const salvarTipoAplicacao = (body: { nome?: string; ativo?: boolean }, id?: string) => req<TipoAplicacao>(`/tipos-aplicacao${id ? `/${id}` : ""}`, { method: id ? "PATCH" : "POST", body: JSON.stringify(body) });
export const listarComprasDiretas = (propriedadeId: number) => req<CompraDireta[]>(`/compras-diretas?propriedadeId=${propriedadeId}`);
export type EstadoPrazo = "INFORMADO" | "NAO_INFORMADO" | "NAO_APLICAVEL";
export type AplicacaoInput = {
  animalId: string; propriedadeId: number; data: string; aplicadaEm: string; tipoAplicacaoId: string;
  tarefaId?: string;
  ocorrenciaId?: string;
  origemInsumo: "BAIXA_ESTOQUE" | "INCLUSO_SERVICO" | "COMPRA_CONSUMO_DIRETO" | "SEM_ORIGEM_JUSTIFICADA";
  nomeProdutoAplicado: string; produtoId?: string; dose: string; unidadeDose: string; responsavel?: string; via?: string; referenciaCarencia?: string;
  operacaoServicoId?: string; itemCompraDiretaId?: string; partidaId?: string; partidaCodigo?: string; partidaValidade?: string;
  justificativaSemOrigem?: string; estadoCarenciaLeite: EstadoPrazo; estadoCarenciaCarne: EstadoPrazo;
  documentacaoExcepcional?: boolean; motivoDocumentacaoExcepcional?: string;
  carenciaLeiteHoras: number | null; carenciaCarneHoras: number | null; justificativaCarenciaCarne?: string;
};
export const registrarAplicacao = (body: AplicacaoInput) => req<AplicacaoSanitaria>("/aplicacoes", { method: "POST", body: JSON.stringify(body) });
export const registrarAplicacaoServico = (input: {
  animalId: string; propriedadeId: number; data: string; aplicadaEm: string; finalidade: AplicacaoSanitaria["finalidade"];
  nomeProdutoAplicado: string; dose: string; unidadeDose: string; operacaoServicoId: string;
  carenciaLeiteHoras: number | null; carenciaCarneHoras: number | null; partidaCodigo?: string;
}) => req<AplicacaoSanitaria>("/aplicacoes", { method: "POST", body: JSON.stringify({ ...input, origemInsumo: "INCLUSO_SERVICO" }) });
