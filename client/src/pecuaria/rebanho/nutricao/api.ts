import type { Lote } from "../types";
import { buscarLote, listarLotes } from "../api";
import { getUsuario } from "../../../lib/auth";
import { temAcessoArea } from "../../../lib/areas";
import { comPropriedade } from "../../../propriedadeScope";

export type Ingrediente = { produtoId: string; quantidadeCabecaDia: string; unidade: string; materiaSecaPercentualSnapshot?: string | null; produto?: { nome: string } };
export type Dieta = { id: string; nome: string; versao: number; publicadaEm: string | null; itens: Ingrediente[]; lotesEmUso?: Array<{ id: string; nome: string; propriedade: { id: number; nome: string } }> };
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
  propriedadeId: number; propriedade: { id: number; nome: string }; lote: { id: string; nome: string }; verValores: boolean; custoConhecido: string | null; coberturaCustoCompleta: boolean;
  centroCusto: { nome: string }; vigencia: { dieta: { nome: string; versao: number } }; participacoes: ParticipacaoConsumo[];
  motivoEstorno?: string | null; estornadoEm?: string | null;
  itens: Array<{ produtoId: string; quantidadePrevista: string; quantidadeConfirmada: string; unidade: string; situacaoCusto: string; produto: { nome: string }; movimentoEstoque: { quantidade: string; valorTotal: string | null; custoUnitario: string | null; alocacaoPartidaEstoques: Array<{ quantidade: string; partida: { codigo: string; nome?: string | null; validade: string | null } }> } | null }> };

async function req<T>(path: string, init?: RequestInit, consolidado = false, propriedadeId?: number): Promise<T> {
  const headers = comPropriedade({ ...(init?.body ? { "content-type": "application/json" } : {}), ...((init?.headers as Record<string, string>) ?? {}) });
  if (consolidado) delete headers["X-Propriedade-Id"];
  else if (propriedadeId) headers["X-Propriedade-Id"] = String(propriedadeId);
  const r = await fetch(`/api${path}`, { ...init, headers });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? `Erro HTTP ${r.status}`);
  return data as T;
}
const post = <T>(path: string, body: unknown) => req<T>(path, { method: "POST", body: JSON.stringify(body) });

export const listarProdutosNutricionais = () => req<ProdutoNutricional[]>("/estoque/produtos?uso=nutricional&ativo=true");
export const listarCentrosNutricionais = () => req<CentroNutricional[]>("/estoque/centros-custo");
export const listarPartidasNutricionais = (produtoId: string, propriedadeId?: number | null) => req<PartidaNutricional[]>(`/estoque/partidas?produtoId=${encodeURIComponent(produtoId)}${propriedadeId == null ? "" : `&propriedadeId=${propriedadeId}`}`, undefined, propriedadeId === null, propriedadeId ?? undefined);
export const listarDietas = async (): Promise<Dieta[]> => {
  const [dietas, lotes] = await Promise.all([req<Dieta[]>("/pecuaria/rebanho/nutricao/dietas"), listarLotes()]);
  const vigencias = await mapearLotes(lotes, async (lote) => ({ lote, ...(await listarVigencias(lote.id)) }));
  return dietas.map((dieta) => ({ ...dieta, lotesEmUso: vigencias.filter((r) => r.vigente?.dieta.id === dieta.id).map((r) => ({ id: r.lote.id, nome: r.lote.nome, propriedade: r.lote.propriedade })) }));
};
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
const paginaFechamentos = async (loteId?: string, pagina = 1): Promise<Pagina<Fechamento>> => {
  const [resultado, lotes] = await Promise.all([
    req<Pagina<Fechamento>>(`/pecuaria/rebanho/nutricao/consumo/fechamentos?${loteId ? `loteId=${encodeURIComponent(loteId)}&` : ""}pagina=${pagina}`),
    listarLotes({ incluirInativos: true }),
  ]);
  return { ...resultado, itens: resultado.itens.map((f) => ({ ...f, propriedade: f.propriedade ?? lotes.find((l) => l.id === f.lote.id)?.propriedade ?? { id: f.propriedadeId, nome: "Sítio do registro" } })) };
};
export const listarFechamentos = async (loteId?: string, pagina = 1, status?: Fechamento["status"]): Promise<Pagina<Fechamento>> => {
  if (!status) return paginaFechamentos(loteId, pagina);
  // Esta API V3 ainda não filtra por status; filtrar antes da paginação evita contagens falsas.
  const { itens, limite } = await todosFechamentos(loteId);
  const filtrados = itens.filter((f) => f.status === status);
  return { itens: filtrados.slice((pagina - 1) * limite, pagina * limite), total: filtrados.length, pagina, limite };
};
export const obterFechamento = async (id: string): Promise<Fechamento> => {
  const fechamento = await req<Fechamento>(`/pecuaria/rebanho/nutricao/consumo/fechamentos/${encodeURIComponent(id)}`);
  if (fechamento.propriedade) return fechamento;
  const lote = await buscarLote(fechamento.lote.id);
  return { ...fechamento, propriedade: lote.propriedade };
};
export type ConsumoAnimal = Omit<ParticipacaoConsumo, "itens"> & { id: string; inicio: string; fim: string; status: Fechamento["status"]; lote: Fechamento["lote"]; dieta: Fechamento["vigencia"]["dieta"]; propriedadeId: number; itens: Array<ParcelaConsumo & { nome: string }> };
export const consultarConsumoAnimal = (animalId: string, pagina = 1) => req<Pagina<ConsumoAnimal> & { verValores: boolean }>(`/pecuaria/rebanho/nutricao/consumo/animais/${encodeURIComponent(animalId)}?pagina=${pagina}`);
export const previaPeriodos = (body: Parameters<typeof previaConsumo>[0]) => post<{ revisao: string; periodos: Previa[]; lacunas: Array<{ inicio: string; fim: string }> }>("/pecuaria/rebanho/nutricao/consumo/periodos/previa", body);
export const confirmarPeriodos = (body: { chave: string; revisao: string; loteId: string; propriedadeId: number; inicio: string; fim: string; centroCustoId?: string | null; periodos: Array<{ inicio: string; fim: string; itens: Parameters<typeof confirmarConsumo>[0]["itens"] }> }) => post("/pecuaria/rebanho/nutricao/consumo/periodos/confirmacao", body);

export type ResumoCusto = { fechamentos: number; animalDias: number; custoConhecido: string | null; custoPorAnimalDia: string | null; coberturaCustoCompleta: boolean };
export type ResumoNutricional = { lote: Lote; vigente: Vigencia | null; programada: Vigencia | null; verValores: boolean; custos: ResumoCusto };
export type VisaoNutricional = { lotes: ResumoNutricional[]; verValores: boolean };
// Adaptadores de leitura para a API da branch atual. Não criam endpoints nem alteram o domínio.
async function mapearLotes<T>(lotes: Lote[], consultar: (lote: Lote) => Promise<T>): Promise<T[]> {
  const resultado: T[] = new Array(lotes.length);
  let proximo = 0;
  await Promise.all(Array.from({ length: Math.min(4, lotes.length) }, async () => {
    while (proximo < lotes.length) { const indice = proximo++; resultado[indice] = await consultar(lotes[indice]); }
  }));
  return resultado;
}
async function todosFechamentos(loteId?: string) {
  const primeira = await paginaFechamentos(loteId);
  const itens = [...primeira.itens];
  for (let pagina = 2; itens.length < primeira.total; pagina++) {
    const proxima = await paginaFechamentos(loteId, pagina);
    if (!proxima.itens.length) throw new Error("O histórico mudou durante a consulta. Recarregue para conferir os custos.");
    itens.push(...proxima.itens);
  }
  return { ...primeira, itens };
}
function podeVerCustos(fechamentos: Fechamento[]) {
  if (fechamentos.length) return fechamentos.every((f) => f.verValores);
  const u = getUsuario();
  return !!u && temAcessoArea(u.areas, "pecuaria", u.dono);
}
function centavosDe(valor: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(valor);
  if (!match) throw new Error("Custo inválido na consulta nutricional.");
  const fracao = (match[3] ?? "").padEnd(3, "0");
  const absoluto = BigInt(match[2]) * 100n + BigInt(fracao.slice(0, 2)) + (fracao[2] >= "5" ? 1n : 0n);
  return match[1] ? -absoluto : absoluto;
}
function textoCentavos(valor: bigint): string {
  const absoluto = valor < 0n ? -valor : valor;
  return `${valor < 0n ? "-" : ""}${absoluto / 100n}.${String(absoluto % 100n).padStart(2, "0")}`;
}
function resumirCustos(fechamentos: Fechamento[], verValores: boolean): ResumoCusto {
  const confirmados = fechamentos.filter((f) => f.status === "CONFIRMADO");
  const animalDias = confirmados.reduce((s, f) => s + f.animalDias, 0);
  const conhecidos = confirmados.filter((f) => f.custoConhecido != null);
  const centavos = conhecidos.reduce((s, f) => s + centavosDe(f.custoConhecido!), 0n);
  const custo = verValores && (!confirmados.length || conhecidos.length) ? textoCentavos(centavos) : null;
  return { fechamentos: confirmados.length, animalDias, custoConhecido: custo, custoPorAnimalDia: custo == null || !animalDias ? null : textoCentavos((centavos + BigInt(animalDias) / 2n) / BigInt(animalDias)), coberturaCustoCompleta: confirmados.every((f) => f.coberturaCustoCompleta) };
}
export async function consultarVisaoNutricional(): Promise<VisaoNutricional> {
  const [lotes, historico] = await Promise.all([listarLotes(), todosFechamentos()]);
  const verValores = podeVerCustos(historico.itens);
  const resumos = await mapearLotes(lotes.filter((l) => l.ativo), async (lote) => {
    const { vigente, programada } = await listarVigencias(lote.id);
    return { lote, vigente, programada, verValores, custos: resumirCustos(historico.itens.filter((f) => f.lote.id === lote.id), verValores) };
  });
  return { lotes: resumos, verValores };
}
export async function consultarResumoNutricional(loteId: string): Promise<ResumoNutricional> {
  const [lote, vigencias, historico] = await Promise.all([buscarLote(loteId), listarVigencias(loteId), todosFechamentos(loteId)]);
  const verValores = podeVerCustos(historico.itens);
  return { lote, vigente: vigencias.vigente, programada: vigencias.programada, verValores, custos: resumirCustos(historico.itens, verValores) };
}
export async function obterVigencia(id: string, loteId: string): Promise<Vigencia & { loteId: string }> {
  let pagina = 1;
  while (true) {
    const resultado = await listarVigencias(loteId, pagina);
    const vigencia = resultado.itens.find((v) => v.id === id);
    if (vigencia) return { ...vigencia, loteId };
    if (!resultado.itens.length || pagina * resultado.limite >= resultado.total) throw new Error("Vigência não encontrada neste lote.");
    pagina++;
  }
}
