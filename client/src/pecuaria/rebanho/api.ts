// Fetch tipado de /api/pecuaria/rebanho/*, no padrão de client/src/financeiro/novo-api.ts.
// Contrato: server/src/routes/pecuaria/rebanho.ts + services/pecuaria/rebanho/{schemas,mappers}.ts.

import { comPropriedade } from "../../propriedadeScope";
import type {
  AnimalFicha,
  BaixaInput,
  CadastrarAnimalInput,
  CadastrarAnimalResultado,
  Catalogos,
  CategoriaRef,
  CriarCategoriaInput,
  ComposicaoSugerida,
  CriarGenitorInput,
  CriarLoteInput,
  CriarMaterialGeneticoInput,
  CriarMotivoBaixaInput,
  CriarRacaInput,
  DefinirCategoriaManualInput,
  DefinirFiliacaoResultado,
  EditarAnimalInput,
  EditarCategoriaInput,
  EditarGenitorInput,
  EditarLoteInput,
  EditarMaterialGeneticoInput,
  EditarMotivoBaixaInput,
  EditarPesagemInput,
  EditarRacaInput,
  EntidadeCadastro,
  EntradaAuditoria,
  EstornoBaixaInput,
  FiliacaoInput,
  FilhoResumo,
  FiltrosMovimentacoes,
  GenitorDTO,
  ItemComposicao,
  ListarCategoriasResultado,
  ListarFiltros,
  ListarGenitoresQuery,
  ListarMaterialGeneticoQuery,
  ListarMovimentacoesResultado,
  ListarResultado,
  Lote,
  MaterialGeneticoDTO,
  MotivoBaixa,
  MovimentacaoDetalhe,
  MovimentarInput,
  MudarDestinoInput,
  PainelGeral,
  PeriodoGmd,
  Pesagem,
  PesagemInput,
  Raca,
  RegraCategoriaProposta,
  RemoverCategoriaManualInput,
  ResumoLote,
  ResultadoSimulacaoCategorias,
  SubstituirComposicaoGenitorInput,
  SubstituirComposicaoInput,
} from "./types";

/** Erro da API do rebanho: `campo` indica o input ao qual a mensagem se refere
 *  (mesmo formato do `ApiError` de client/src/financeiro/novo-api.ts), para os
 *  formulários da Pecuária mapearem o erro por campo. */
export class RebanhoApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public campo?: string) {
    super(message);
    this.name = "RebanhoApiError";
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`/api/pecuaria/rebanho${path}`, {
    ...init,
    headers: comPropriedade({
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...((init?.headers as Record<string, string>) ?? {}),
    }),
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new RebanhoApiError(corpo.error ?? `Erro HTTP ${resposta.status}`, resposta.status, corpo.code, corpo.campo);
  return corpo as T;
}

function comIncluirInativos(path: string, incluirInativos?: boolean): string {
  return incluirInativos ? `${path}?incluirInativos=true` : path;
}

// ---------- animais ----------

export const listarAnimais = (filtros: ListarFiltros) => {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== "") params.set(chave, String(valor));
  }
  const query = params.toString();
  return req<ListarResultado>(`/animais${query ? `?${query}` : ""}`);
};

export const cadastrarAnimal = (input: CadastrarAnimalInput) =>
  req<CadastrarAnimalResultado>("/animais", { method: "POST", body: JSON.stringify(input) });

export const buscarFichaAnimal = (id: string, opts?: { periodoDias?: PeriodoGmd }) => {
  const params = new URLSearchParams();
  if (opts?.periodoDias !== undefined) {
    params.set("periodoDias", String(opts.periodoDias));
  }
  const query = params.toString();
  return req<AnimalFicha>(`/animais/${id}${query ? `?${query}` : ""}`);
};

export const editarAnimal = (id: string, input: EditarAnimalInput) =>
  req<AnimalFicha>(`/animais/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const substituirComposicaoAnimal = (id: string, input: SubstituirComposicaoInput) =>
  req<ItemComposicao[]>(`/animais/${id}/composicao`, { method: "PUT", body: JSON.stringify(input) });

// ---------- genética v2: filiação e genitores externos ----------

export const definirFiliacaoAnimal = (id: string, input: FiliacaoInput) =>
  req<DefinirFiliacaoResultado>(`/animais/${id}/filiacao`, { method: "PUT", body: JSON.stringify(input) });

export const listarFilhosAnimal = (id: string) => req<FilhoResumo[]>(`/animais/${id}/filhos`);

export const buscarComposicaoSugerida = (id: string) => req<ComposicaoSugerida | null>(`/animais/${id}/composicao-sugerida`);

export const preverComposicaoAnimal = (input: FiliacaoInput & { dataNascimento: string }) =>
  req<ComposicaoSugerida | null>("/animais/composicao-prevista", { method: "POST", body: JSON.stringify(input) });

export const listarGenitores = (filtros: ListarGenitoresQuery = {}) => {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== "") params.set(chave, String(valor));
  }
  const query = params.toString();
  return req<GenitorDTO[]>(`/genitores${query ? `?${query}` : ""}`);
};

export const criarGenitor = (input: CriarGenitorInput) => req<GenitorDTO>("/genitores", { method: "POST", body: JSON.stringify(input) });

export const editarGenitor = (id: string, input: EditarGenitorInput) =>
  req<GenitorDTO>(`/genitores/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const substituirComposicaoGenitor = (id: string, input: SubstituirComposicaoGenitorInput) =>
  req<GenitorDTO>(`/genitores/${id}/composicao`, { method: "PUT", body: JSON.stringify(input) });

// ---------- genética v2: material genético (sêmen/embrião) ----------

export const listarMaterialGenetico = (filtros: ListarMaterialGeneticoQuery = {}) => {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null) params.set(chave, String(valor));
  }
  const query = params.toString();
  return req<MaterialGeneticoDTO[]>(`/material-genetico${query ? `?${query}` : ""}`);
};

export const criarMaterialGenetico = (input: CriarMaterialGeneticoInput) =>
  req<MaterialGeneticoDTO>("/material-genetico", { method: "POST", body: JSON.stringify(input) });

export const editarMaterialGenetico = (id: string, input: EditarMaterialGeneticoInput) =>
  req<MaterialGeneticoDTO>(`/material-genetico/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const buscarAuditoriaAnimal = (id: string, opts?: { page?: number; pageSize?: number }) => {
  const params = new URLSearchParams();
  if (opts?.page !== undefined) params.set("page", String(opts.page));
  if (opts?.pageSize !== undefined) params.set("pageSize", String(opts.pageSize));
  const query = params.toString();
  return req<{ itens: EntradaAuditoria[]; total: number }>(`/animais/${id}/auditoria${query ? `?${query}` : ""}`);
};

export const movimentarAnimais = (input: MovimentarInput) =>
  req<{ movimentacaoId: string; movidos: number }>("/animais/movimentar", { method: "POST", body: JSON.stringify(input) });

export const mudarDestinoAnimal = (id: string, input: MudarDestinoInput) =>
  req<AnimalFicha>(`/animais/${id}/destino`, { method: "POST", body: JSON.stringify(input) });

/** "Desfazer última movimentação": fecha a linha aberta e reabre a anterior. */
export const desfazerLocalizacaoAnimal = (id: string) =>
  req<AnimalFicha>(`/animais/${id}/localizacao/desfazer`, { method: "POST" });

/** "Desfazer última mudança de destino": idem, para aptidão/papel reprodutivo. */
export const desfazerDestinoAnimal = (id: string) =>
  req<AnimalFicha>(`/animais/${id}/destino/desfazer`, { method: "POST" });

export const darBaixaAnimal = (id: string, input: BaixaInput) =>
  req<AnimalFicha>(`/animais/${id}/baixa`, { method: "POST", body: JSON.stringify(input) });

export const estornarBaixaAnimal = (id: string, input: EstornoBaixaInput) =>
  req<AnimalFicha>(`/animais/${id}/baixa/estorno`, { method: "POST", body: JSON.stringify(input) });

// ---------- categoria manual do animal (vale sobre o cálculo até ser removida) ----------

export const definirCategoriaManual = (animalId: string, input: DefinirCategoriaManualInput) =>
  req<AnimalFicha>(`/animais/${animalId}/categoria`, { method: "POST", body: JSON.stringify(input) });

export const removerCategoriaManual = (animalId: string, input: RemoverCategoriaManualInput) =>
  req<AnimalFicha>(`/animais/${animalId}/categoria/remover`, { method: "POST", body: JSON.stringify(input) });

export const registrarPesagemAnimal = (id: string, input: PesagemInput) =>
  req<Pesagem>(`/animais/${id}/pesagens`, { method: "POST", body: JSON.stringify(input) });

export const editarPesagem = (id: string, input: EditarPesagemInput) =>
  req<Pesagem>(`/pesagens/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const excluirPesagem = (id: string) => req<{ ok: boolean }>(`/pesagens/${id}`, { method: "DELETE" });

// ---------- lotes ----------

export const listarLotes = (opts?: { incluirInativos?: boolean }) =>
  req<Lote[]>(comIncluirInativos("/lotes", opts?.incluirInativos));

export const buscarLote = (id: string) => req<Lote>(`/lotes/${id}`);

export const buscarResumoLote = (id: string, opts?: { periodoDias?: PeriodoGmd }) => {
  const params = new URLSearchParams();
  if (opts?.periodoDias !== undefined) {
    params.set("periodoDias", String(opts.periodoDias));
  }
  const query = params.toString();
  return req<ResumoLote>(`/lotes/${id}/resumo${query ? `?${query}` : ""}`);
};

export const criarLote = (input: CriarLoteInput) => req<Lote>("/lotes", { method: "POST", body: JSON.stringify(input) });

export const editarLote = (id: string, input: EditarLoteInput) =>
  req<Lote>(`/lotes/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const listarMovimentacoesDoLote = (id: string, page = 1) =>
  req<ListarMovimentacoesResultado>(`/lotes/${id}/movimentacoes?page=${page}`);

/** "Desfazer movimentação": desfaz a movimentação inteira (todos os animais movidos por ela), reabrindo a localização anterior de cada um. */
export const desfazerMovimentacao = (id: string, motivo: string) =>
  req<{ desfeitos: number }>(`/movimentacoes/${id}/desfazer`, { method: "POST", body: JSON.stringify({ motivo }) });

/** Histórico geral (aba Lotes · Histórico) — sem `loteId`, cobre todos os lotes/sítios visíveis. */
export const listarMovimentacoes = (filtros: FiltrosMovimentacoes = {}) => {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== "") params.set(chave, String(valor));
  }
  const query = params.toString();
  return req<ListarMovimentacoesResultado>(`/movimentacoes${query ? `?${query}` : ""}`);
};

export const buscarMovimentacao = (id: string) => req<MovimentacaoDetalhe>(`/movimentacoes/${id}`);

export const listarAuditoriaCadastro = (entidade: EntidadeCadastro, opts?: { entidadeId?: string; page?: number; pageSize?: number }) => {
  const params = new URLSearchParams();
  params.set("entidade", entidade);
  if (opts?.entidadeId !== undefined) params.set("entidadeId", opts.entidadeId);
  if (opts?.page !== undefined) params.set("page", String(opts.page));
  if (opts?.pageSize !== undefined) params.set("pageSize", String(opts.pageSize));
  const query = params.toString();
  return req<{ itens: EntradaAuditoria[]; total: number }>(`/auditoria${query ? `?${query}` : ""}`);
};

// ---------- raças ----------

export const listarRacas = (opts?: { incluirInativos?: boolean }) =>
  req<Raca[]>(comIncluirInativos("/racas", opts?.incluirInativos));

export const criarRaca = (input: CriarRacaInput) => req<Raca>("/racas", { method: "POST", body: JSON.stringify(input) });

export const editarRaca = (id: string, input: EditarRacaInput) =>
  req<Raca>(`/racas/${id}`, { method: "PATCH", body: JSON.stringify(input) });

// ---------- motivos de baixa ----------

export const listarMotivosBaixa = (opts?: { incluirInativos?: boolean }) =>
  req<MotivoBaixa[]>(comIncluirInativos("/motivos-baixa", opts?.incluirInativos));

export const criarMotivoBaixa = (input: CriarMotivoBaixaInput) =>
  req<MotivoBaixa>("/motivos-baixa", { method: "POST", body: JSON.stringify(input) });

export const editarMotivoBaixa = (id: string, input: EditarMotivoBaixaInput) =>
  req<MotivoBaixa>(`/motivos-baixa/${id}`, { method: "PATCH", body: JSON.stringify(input) });

// ---------- categorias configuráveis (Cadastros > Categorias) ----------

export const listarCategorias = (opts?: { incluirInativos?: boolean }) =>
  req<ListarCategoriasResultado>(comIncluirInativos("/categorias", opts?.incluirInativos));

export const criarCategoria = (input: CriarCategoriaInput) =>
  req<CategoriaRef>("/categorias", { method: "POST", body: JSON.stringify(input) });

export const editarCategoria = (id: string, input: EditarCategoriaInput) =>
  req<CategoriaRef>(`/categorias/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const reordenarCategorias = (ids: string[]) =>
  req<{ ok: boolean }>("/categorias/ordem", { method: "POST", body: JSON.stringify({ ids }) });

export const simularCategorias = (regras: RegraCategoriaProposta[]) =>
  req<ResultadoSimulacaoCategorias>("/categorias/simular", { method: "POST", body: JSON.stringify({ regras }) });

export const restaurarPadroesCategorias = (opts?: { simular?: boolean }) =>
  req<ResultadoSimulacaoCategorias>("/categorias/restaurar-padroes", { method: "POST", body: JSON.stringify({ simular: opts?.simular ?? false }) });

// ---------- visão geral e catálogos ----------

export const obterPainelRebanho = (opts?: { periodoDias?: number }) => {
  const params = new URLSearchParams();
  if (opts?.periodoDias !== undefined) params.set("periodoDias", String(opts.periodoDias));
  const query = params.toString();
  return req<PainelGeral>(`/painel${query ? `?${query}` : ""}`);
};

export const obterCatalogos = () => req<Catalogos>("/catalogos");
