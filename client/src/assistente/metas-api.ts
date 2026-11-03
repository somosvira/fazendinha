import { comPropriedade } from "../propriedadeScope";
export interface IndicadorMeta {
  id: string;
  versao: number;
  nome: string;
  unidade: string;
  dominio: "pecuaria" | "financeiro";
  formula: string;
  fonte: "manual" | "automatica";
  motivoManual: string;
}
export interface DefinicaoMeta {
  etapas?: { id: string; titulo: string }[];
  titulo: string;
  indicadorId: string;
  indicadorVersao: 1;
  tipo: "minimo" | "maximo" | "faixa" | "marco";
  minimo: number | null;
  maximo: number | null;
  periodo: "diario" | "mensal" | "anual" | "ciclo";
  prazo: string | null;
  fonte: "manual" | "automatica";
  observacao: string;
}
export interface MedicaoMeta {
  etapasConcluidas?: string[];
  proveniencia?: { url: string; adaptador: string };
  data: string;
  valor: number | null;
  concluido: boolean | null;
  observacao: string;
  revisao: number;
  usuarioId: number;
  criadoEm: string;
}
export interface Meta {
  id: string;
  propriedadeId: number;
  revisao: number;
  definicao: DefinicaoMeta;
  medicoes: MedicaoMeta[];
  situacao: string;
  historico: {
    revisao: number;
    tipo: string;
    conteudo: unknown;
    usuarioId: number;
    criadoEm: string;
  }[];
}
export interface CatalogoMetas {
  indicadores: IndicadorMeta[];
  podeEditar: boolean;
}
export interface ListaMetas {
  metas: Meta[];
  podeEditar: boolean;
  limite: number;
}
async function requisicao<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`/api/metas${url}`, {
    ...init,
    headers: comPropriedade({ "Content-Type": "application/json" }),
  });
  const dados = await r.json();
  if (!r.ok)
    throw new Error(dados.error ?? "Não foi possível carregar as metas.");
  return dados;
}
export const obterCatalogoMetas = () => requisicao<CatalogoMetas>("/catalogo");
export const obterMetas = () => requisicao<ListaMetas>("");
export const salvarMeta = (
  id: string,
  operacaoId: string,
  versaoBase: number,
  definicao: DefinicaoMeta,
) =>
  requisicao<Meta>(`/${id}`, {
    method: "PUT",
    body: JSON.stringify({ operacaoId, versaoBase, definicao }),
  });
export const registrarMedicao = (
  meta: Meta,
  operacaoId: string,
  dados: Pick<
    MedicaoMeta,
    "data" | "valor" | "concluido" | "observacao" | "etapasConcluidas"
  >,
) =>
  requisicao<Meta>(`/${meta.id}/medicoes`, {
    method: "POST",
    body: JSON.stringify({ operacaoId, versaoBase: meta.revisao, ...dados }),
  });
