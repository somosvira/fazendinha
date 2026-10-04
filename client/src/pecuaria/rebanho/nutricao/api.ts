import { comPropriedade } from "../../../propriedadeScope";

export type Ingrediente = { produtoId: string; quantidadeCabecaDia: string; unidade: string; materiaSecaPercentualSnapshot?: string | null; produto?: { nome: string } };
export type Dieta = { id: string; nome: string; versao: number; publicadaEm: string | null; itens: Ingrediente[] };
export type Vigencia = { id: string; desde: string; ate: string | null; dieta: { id: string; nome: string; versao: number } };
export type Pagina<T> = { itens: T[]; total: number; pagina: number; limite: number };
export type PaginaVigencias = Pagina<Vigencia> & { vigente: Vigencia | null; programada: Vigencia | null };
export type ParcelaConsumo = { produtoId: string; unidade: string; quantidadeAtribuida: string; quantidadePorDia: string; custoConhecido: string | null };
export type ParticipacaoConsumo = { animalId: string; dias: number; animal: { brinco: string }; custoConhecido: string | null; custoConhecidoPorDia: string | null; coberturaCustoCompleta: boolean; itens: ParcelaConsumo[] };
export type ProdutoNutricional = { id: string; nome: string; unidade: string; rastrearPartidas: boolean };
export type CentroNutricional = { id: string; nome: string; ativo: boolean };
export type PartidaNutricional = { id: string; codigo: string; nome?: string; validade: string | null; saldo: string; origemRastreio: string; aliases?: Array<{ id: string; codigo: string }> };
export type Previa = { loteId: string; vigenciaId: string; dieta: { nome: string; versao: number }; inicio: string; fim: string;
  verValores?: boolean;
  centroCustoId: string; animalDias: number; participantes: Array<{ animalId: string; dias: number; brinco: string }>;
  materiaSecaConhecidaKg: string; coberturaMateriaSecaCompleta: boolean;
  itens: Array<{ produtoId: string; nome: string; unidade: string; quantidadePrevista: string; rastrearPartidas: boolean; saldo: string; materiaSecaKg: string | null; custoPrevisto: string | null }> };
export type Fechamento = { id: string; inicio: string; fim: string; animalDias: number; status: "CONFIRMADO" | "ESTORNADO";
  propriedadeId: number; lote: { id: string; nome: string }; verValores: boolean; custoConhecido: string | null; coberturaCustoCompleta: boolean;
  centroCusto: { nome: string }; vigencia: { dieta: { nome: string; versao: number } }; participacoes: ParticipacaoConsumo[];
  itens: Array<{ produtoId: string; quantidadePrevista: string; quantidadeConfirmada: string; unidade: string; situacaoCusto: string; produto: { nome: string }; movimentoEstoque: { quantidade: string; valorTotal: string | null; custoUnitario: string | null; alocacaoPartidaEstoques: Array<{ quantidade: string; partida: { codigo: string; nome?: string | null; validade: string | null } }> } | null }> };

async function req<T>(path: string, init?: RequestInit, consolidado = false): Promise<T> {
  const headers = comPropriedade({ ...(init?.body ? { "content-type": "application/json" } : {}), ...((init?.headers as Record<string, string>) ?? {}) });
  if (consolidado) delete headers["X-Propriedade-Id"];
  const r = await fetch(`/api${path}`, { ...init, headers });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? `Erro HTTP ${r.status}`);
  return data as T;
}
const post = <T>(path: string, body: unknown) => req<T>(path, { method: "POST", body: JSON.stringify(body) });

export const listarProdutosNutricionais = () => req<ProdutoNutricional[]>("/estoque/produtos?uso=nutricional&ativo=true");
export const listarCentrosNutricionais = () => req<CentroNutricional[]>("/estoque/centros-custo");
export const listarPartidasNutricionais = (produtoId: string, propriedadeId?: number | null) => req<PartidaNutricional[]>(`/estoque/partidas?produtoId=${encodeURIComponent(produtoId)}${propriedadeId == null ? "" : `&propriedadeId=${propriedadeId}`}`, undefined, propriedadeId === null);
export const listarDietas = () => req<Dieta[]>("/pecuaria/rebanho/nutricao/dietas");
export const criarDieta = (body: { nome: string; itens: Array<{ produtoId: string; quantidadeCabecaDia: number }> }) =>
  post<Dieta>("/pecuaria/rebanho/nutricao/dietas", body);
export const publicarDieta = (id: string) => post<Dieta>(`/pecuaria/rebanho/nutricao/dietas/${id}/publicacao`, {});
export const editarDieta = (id: string, body: { nome: string; itens: Array<{ produtoId: string; quantidadeCabecaDia: number }> }) => req<Dieta>(`/pecuaria/rebanho/nutricao/dietas/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const estornarConsumo = (id: string, body: { propriedadeId: number; motivo: string }) => post(`/pecuaria/rebanho/nutricao/consumo/fechamentos/${id}/estorno`, body);
export const listarVigencias = (loteId: string, pagina = 1) => req<PaginaVigencias>(`/pecuaria/rebanho/nutricao/vigencias?loteId=${encodeURIComponent(loteId)}&pagina=${pagina}`);
export const atribuirDieta = (body: { loteId: string; propriedadeId: number; dietaId: string; desde: string }) =>
  post<Vigencia>("/pecuaria/rebanho/nutricao/vigencias", body);
export const corrigirVigencia = (id: string, body: { propriedadeId: number; desde: string; motivo: string }) => post<Vigencia>(`/pecuaria/rebanho/nutricao/vigencias/${id}/correcao`, body);
export const previaConsumo = (body: { loteId: string; propriedadeId: number; inicio: string; fim: string; centroCustoId?: string | null }) =>
  post<Previa>("/pecuaria/rebanho/nutricao/consumo/previa", body);
export const confirmarConsumo = (body: { loteId: string; propriedadeId: number; inicio: string; fim: string; centroCustoId?: string | null;
  itens: Array<{ produtoId: string; quantidadeConfirmada: number; motivoAjuste?: string; modoEstoque: "BAIXA_ESTOQUE" | "SEM_BAIXA_JUSTIFICADA"; justificativaSemBaixa?: string;
    partidas?: Array<{ partidaId: string; quantidade: number; cienciaValidadeDesconhecida?: boolean }> }> }) =>
  post<Pick<Fechamento, "id" | "inicio" | "fim" | "animalDias" | "status">>("/pecuaria/rebanho/nutricao/consumo/confirmacao", body);
export const listarFechamentos = (loteId: string, pagina = 1) => req<Pagina<Fechamento>>(`/pecuaria/rebanho/nutricao/consumo/fechamentos?loteId=${encodeURIComponent(loteId)}&pagina=${pagina}`);
export const obterFechamento = (id: string) => req<Fechamento>(`/pecuaria/rebanho/nutricao/consumo/fechamentos/${encodeURIComponent(id)}`);
export type ConsumoAnimal = Omit<ParticipacaoConsumo, "itens"> & { id: string; inicio: string; fim: string; status: Fechamento["status"]; lote: Fechamento["lote"]; dieta: Fechamento["vigencia"]["dieta"]; propriedadeId: number; itens: Array<ParcelaConsumo & { nome: string }> };
export const consultarConsumoAnimal = (animalId: string, pagina = 1) => req<Pagina<ConsumoAnimal> & { verValores: boolean }>(`/pecuaria/rebanho/nutricao/consumo/animais/${encodeURIComponent(animalId)}?pagina=${pagina}`);
export const previaPeriodos = (body: Parameters<typeof previaConsumo>[0]) => post<{ revisao: string; periodos: Previa[]; lacunas: Array<{ inicio: string; fim: string }> }>("/pecuaria/rebanho/nutricao/consumo/periodos/previa", body);
export const confirmarPeriodos = (body: { chave: string; revisao: string; loteId: string; propriedadeId: number; inicio: string; fim: string; centroCustoId?: string | null; periodos: Array<{ inicio: string; fim: string; itens: Parameters<typeof confirmarConsumo>[0]["itens"] }> }) => post("/pecuaria/rebanho/nutricao/consumo/periodos/confirmacao", body);
