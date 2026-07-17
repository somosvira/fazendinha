import { useEffect, useState, useCallback } from "react";
import type { Animal, ResumoAnimal, EventoTimeline, IaInsight } from "./types";

export interface RacaDTO { id: number; nome: string; codigo: string | null; especie: "BOVINO" | "CAPRINO" }
export interface GrupoDTO { id: number; nome: string }
export interface AnimalForm {
  numero: string; nome?: string; sexo: "F" | "M"; categoria: Animal["categoria"];
  racaId?: number; grauSangue?: string; dataNascimento?: string; dataEntrada: string;
  brincoEletronico?: string; sisbov?: string; maeId?: number; paiNome?: string; grupoId?: number; setor?: string;
}

// Sítio ativo (multi-propriedade) mora no módulo compartilhado propriedadeScope
// (mesma fonte usada pelo financeiro/dashboard). Reexporta set/get p/ compat com
// quem importava daqui (RebanhoContent, App).
import { comPropriedade, setPropriedadeAtiva, getPropriedadeAtiva } from "../propriedadeScope";
export { setPropriedadeAtiva, getPropriedadeAtiva };

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...((init?.headers as Record<string, string>) || {}) };
  if (init?.body) headers["content-type"] = "application/json";
  const res = await fetch(`/api${path}`, { ...init, headers: comPropriedade(headers) });
  if (!res.ok) {
    const b: any = await res.json().catch(() => null);
    let msg = `HTTP ${res.status}`;
    if (typeof b?.error === "string") msg = b.error;                                   // erro do service (ex.: número duplicado)
    else if (b?.error?.issues?.length) msg = b.error.issues.map((i: any) => i.message).join("; "); // ZodError do zValidator
    throw new Error(msg);
  }
  return res.json();
}

// monta a query string a partir de um objeto (ignora undefined/null/"") — ?a=1&b=2 ou ""
function qs(f?: Record<string, string | number | boolean | undefined | null>): string {
  if (!f) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v != null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const listarAnimais = (f?: { status?: string; grupoId?: number; q?: string; setor?: string }) =>
  req<Animal[]>(`/rebanho/animais${qs(f)}`);
export const obterAnimal = (id: string) => req<Animal>(`/rebanho/animais/${id}`);
export const criarAnimal = (input: AnimalForm) => req<Animal>(`/rebanho/animais`, { method: "POST", body: JSON.stringify(input) });
export const editarAnimal = (id: string, input: Partial<AnimalForm>) => req<Animal>(`/rebanho/animais/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const darBaixa = (id: string, input: { motivo: string; data?: string }) => req<Animal>(`/rebanho/animais/${id}/baixa`, { method: "POST", body: JSON.stringify(input) });
export const listarGrupos = () => req<GrupoDTO[]>(`/rebanho/grupos`);
export const listarRacas = () => req<RacaDTO[]>(`/rebanho/racas`);
export const listarSetores = () => req<string[]>(`/rebanho/setores`);

export function useSetores() {
  const [data, setData] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => { setLoading(true); setErro(null); listarSetores().then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export function useAnimais(f?: { status?: string; grupoId?: number; q?: string; setor?: string }) {
  const [data, setData] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const key = JSON.stringify(f ?? {});
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    listarAnimais(f).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export interface EventoPayload {
  tipo: "CIO" | "INSEMINACAO" | "DIAGNOSTICO" | "PARTO" | "SECAGEM" | "TRANSFERENCIA_EMBRIAO";
  data: string; observacao?: string;
  reprodutor?: string; protocolo?: string;
  resultado?: "positivo" | "negativo"; dtPartoPrevista?: string;
  numCrias?: number; sexoCria?: string; tipoParto?: string; motivoSecagem?: string;
  doadoraId?: number; // TE: animal doador da genética
}
export const listarEventos = (id: string) => req<EventoTimeline[]>(`/rebanho/animais/${id}/eventos`);
export const registrarEvento = (id: string, p: EventoPayload) => req<EventoTimeline>(`/rebanho/animais/${id}/eventos`, { method: "POST", body: JSON.stringify(p) });
export const excluirEvento = (eventoId: string) => req<{ ok: true }>(`/rebanho/eventos/${eventoId}`, { method: "DELETE" });

// ── Taxa de concepção por método (IA × TE) — KPI de reprodução (baseline ~35%) ──
export interface TaxaConcepcaoMetodo { metodo: "IA" | "TE"; coberturas: number; prenhes: number; taxa: number | null }
export const obterTaxaConcepcao = () => req<TaxaConcepcaoMetodo[]>(`/rebanho/reproducao/taxa-concepcao`);
export function useTaxaConcepcao() {
  const [data, setData] = useState<TaxaConcepcaoMetodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => { setLoading(true); setErro(null); obterTaxaConcepcao().then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export function useEventos(id: string | null) {
  const [data, setData] = useState<EventoTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    if (!id) { setData([]); setLoading(false); return; }
    setLoading(true); setErro(null);
    listarEventos(id).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export interface EventoSanidadePayload {
  tipo: "OCORRENCIA" | "APLICACAO" | "EXAME" | "MASTITE" | "VACINA";
  data: string; observacao?: string;
  doenca?: string; diasTratamento?: number;
  produto?: string; dose?: string; carencia?: number; loteProduto?: string;
  ccs?: number; gordura?: number; proteina?: number;
  quarto?: string; severidade?: string; resultadoCultivo?: string;
}
export const montarTimeline = (id: string) => req<EventoTimeline[]>(`/rebanho/animais/${id}/timeline`);
export const registrarEventoSanidade = (id: string, p: EventoSanidadePayload) => req<EventoTimeline>(`/rebanho/animais/${id}/sanidade`, { method: "POST", body: JSON.stringify(p) });

export function useTimeline(id: string | null) {
  const [data, setData] = useState<EventoTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    if (!id) { setData([]); setLoading(false); return; }
    setLoading(true); setErro(null);
    montarTimeline(id).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export interface LactacaoDTO {
  id: number;
  numero: number;
  dtInicio: string;
  dtFim: string | null;
  duracaoDias: number | null;
  motivoSecagem: string | null;
  producaoTotal: number | null; // medida (Ideagri) — só a última lactação
  producao305: number | null;
  producaoControles: number | null; // estimada dos controles (TIM) quando não há valor medido
  nControles: number;
  emCurso: boolean;
}
export interface ResumoLactacoesDTO {
  total: number;
  emCurso: boolean;
  delAtual: number | null;
  vidaProdutivaDias: number;
  producaoMediaCiclo: number | null;
}
export interface LactacoesResp { lactacoes: LactacaoDTO[]; resumo: ResumoLactacoesDTO; }

export const listarLactacoes = (id: string) => req<LactacoesResp>(`/rebanho/animais/${id}/lactacoes`);

export function useLactacoes(id: string | null) {
  const [data, setData] = useState<LactacoesResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    if (!id) { setData(null); setLoading(false); return; }
    setLoading(true); setErro(null);
    listarLactacoes(id).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export function useAnimal(id: string | null) {
  const [data, setData] = useState<Animal | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    if (!id) { setData(null); setLoading(false); return; }
    setLoading(true); setErro(null);
    obterAnimal(id).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

// ── Insights (painel executivo do animal) ─────────────────────────────────
export type ScoreClassificacao = "ELITE" | "MUITO_BOA" | "BOA" | "ATENCAO" | "DESCARTE";
export interface ScoreFatorDTO { nome: string; pontos: number; peso: number }
export interface ScoreDTO { valor: number; classificacao: ScoreClassificacao; estrelas: 1 | 2 | 3 | 4 | 5; fatores: ScoreFatorDTO[] }
export interface FinanceiroDTO {
  precoLeite: number; fontePreco: "config" | "fallback";
  receitaLactacao: number; custoVacaDia: number | null; custoVacaDiaTotalLactacao: number;
  custoSanidadeAnimal: number; custosTotal: number; lucro: number; margem: number;
  tom: "pos" | "warn" | "neg";
}
export interface TendenciaDTO { chave: string; label: string; direcao: "up" | "down" | "flat"; delta?: string; sentido: "pos" | "neg" | "neutro" }
export interface InsightDTO { tipo: "warn" | "ok"; titulo: string; detalhe?: string }
export interface PercentisDTO {
  producao: number | null; rentabilidade: number | null; fertilidade: number | null; ccs: number | null;
  ranking: { posicao: number; total: number } | null;
}
export interface ProducaoFinanceiraDTO {
  acumuladoLitros: number; valorRecebido: number; precoMedio: number;
  lucroPorLitro: number | null; receitaDiaria: number; receitaMensal: number;
}
export interface EficienciaDTO { meta: number | null; atual: number | null; percentual: number | null }
export interface ProjecoesDTO {
  producaoLactacao: number | null; receitaLactacao: number | null; lucroLactacao: number | null;
  dataSecagem: string | null; dataParto: string | null;
}
export interface GenealogiaDTO {
  mae: { id: string; nome: string | null; numero: string; producaoMediaDia: number | null } | null;
  pai: string | null;
  avoMaterna: { id: string; nome: string | null; numero: string } | null;
  avoMaterno: string | null;
}
export interface AnimalInsightsDTO {
  score: ScoreDTO; financeiro: FinanceiroDTO;
  tendencias: TendenciaDTO[]; insights: InsightDTO[];
  percentis: PercentisDTO; producaoFinanceira: ProducaoFinanceiraDTO;
  eficiencia: EficienciaDTO; projecoes: ProjecoesDTO;
  genealogia: GenealogiaDTO; timelineInterpretacao: Record<string, string>;
}
export const obterInsights = (id: string) => req<AnimalInsightsDTO>(`/rebanho/animais/${id}/insights`);

export function useAnimalInsights(id: string | null) {
  const [data, setData] = useState<AnimalInsightsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    if (!id) { setData(null); setLoading(false); return; }
    setLoading(true); setErro(null);
    obterInsights(id).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export interface DietaDTO { id: number; nome: string; descricao: string | null; pb: number | null; edMcal: number | null; ativo: boolean; }
export interface LoteDTO { id: number; nome: string; dietaId: number | null; dietaNome: string | null; numAnimais: number; producaoMedia: number | null; }
export interface DietaInput { nome: string; descricao?: string; pb?: number; edMcal?: number; }
export interface LoteInput { nome: string; dietaId?: number | null; animalIds: number[]; }
export interface AnimalLoteDTO { id: number; numero: string; nome: string | null; categoria: Animal["categoria"]; }
export interface LoteDetalheDTO { id: number; nome: string; dietaId: number | null; dietaNome: string | null; animais: AnimalLoteDTO[]; }
export interface AnimalDisponivelDTO { id: number; numero: string; nome: string | null; categoria: Animal["categoria"]; grupoId: number | null; grupoNome: string | null; }
export const listarDietas = () => req<DietaDTO[]>(`/rebanho/dietas`);
export const criarDieta = (p: DietaInput) => req<DietaDTO>(`/rebanho/dietas`, { method: "POST", body: JSON.stringify(p) });
export const editarDieta = (id: number, p: DietaInput) => req<DietaDTO>(`/rebanho/dietas/${id}`, { method: "PATCH", body: JSON.stringify(p) });
export const excluirDieta = (id: number) => req<{ ok: true }>(`/rebanho/dietas/${id}`, { method: "DELETE" });
export const listarLotes = () => req<LoteDTO[]>(`/rebanho/lotes`);
export const obterLote = (id: number) => req<LoteDetalheDTO>(`/rebanho/lotes/${id}`);
export const criarLote = (p: LoteInput) => req<LoteDetalheDTO>(`/rebanho/lotes`, { method: "POST", body: JSON.stringify(p) });
export const editarLote = (id: number, p: LoteInput) => req<LoteDetalheDTO>(`/rebanho/lotes/${id}`, { method: "PATCH", body: JSON.stringify(p) });
export const excluirLote = (id: number) => req<{ ok: true }>(`/rebanho/lotes/${id}`, { method: "DELETE" });
export const atribuirDieta = (grupoId: number, dietaId: number | null) => req<{ ok: true }>(`/rebanho/lotes/${grupoId}/dieta`, { method: "POST", body: JSON.stringify({ dietaId }) });
export const listarAnimaisDisponiveis = () => req<AnimalDisponivelDTO[]>(`/rebanho/animais-disponiveis`);
export function useLotes() {
  const [data, setData] = useState<LoteDTO[]>([]); const [loading, setLoading] = useState(true); const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => { setLoading(true); setErro(null); listarLotes().then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { recarregar(); }, [recarregar]); return { data, loading, erro, recarregar };
}
export function useDietas() {
  const [data, setData] = useState<DietaDTO[]>([]); const recarregar = useCallback(() => { listarDietas().then(setData).catch(() => {}); }, []);
  useEffect(() => { recarregar(); }, [recarregar]); return { data, recarregar };
}
export function useAnimaisDisponiveis() {
  const [data, setData] = useState<AnimalDisponivelDTO[]>([]); const [loading, setLoading] = useState(true);
  const recarregar = useCallback(() => { setLoading(true); listarAnimaisDisponiveis().then(setData).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => { recarregar(); }, [recarregar]); return { data, loading, recarregar };
}

// ── Composição da dieta (DietaItem): quanto de cada produto por cabeça/dia ───
export interface DietaItemDTO { id: number; produtoId: number; produtoNome: string | null; unidade: string; qtdPorCabecaDia: number; custoUnitario: number | null; setor: SetorEstoque | null; ordem: number; }
export interface DietaItemInput { produtoId: number; qtdPorCabecaDia: number; }
export const listarItensDieta = (dietaId: number) => req<DietaItemDTO[]>(`/rebanho/dietas/${dietaId}/itens`);
export const salvarItensDieta = (dietaId: number, itens: DietaItemInput[]) => req<DietaItemDTO[]>(`/rebanho/dietas/${dietaId}/itens`, { method: "PUT", body: JSON.stringify({ itens }) });

export function useItensDieta(dietaId: number | null) {
  const [data, setData] = useState<DietaItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    if (dietaId == null) { setData([]); setLoading(false); return; }
    setLoading(true); setErro(null);
    listarItensDieta(dietaId).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [dietaId]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

// ── Consumo de dieta → baixa de estoque (Fatia 2) ───────────────────────────
export interface PrevisaoLinhaDTO { produtoId: number; produtoNome: string; unidade: string; qtdPorCabecaDia: number; quantidade: number; custoUnitario: number; custoTotal: number; saldoAtual: number; saldoApos: number; insuficiente: boolean; }
export interface PrevisaoConsumoDTO { grupoId: number; grupoNome: string; dietaId: number; dietaNome: string; dataInicio: string; dataFim: string; dias: number; numCabecas: number; linhas: PrevisaoLinhaDTO[]; custoTotal: number; temInsuficiencia: boolean; }
export interface ConsumoPeriodoDTO { id: number; dataInicio: string; dataFim: string; numCabecas: number; diasBase: number; custoTotal: number; numMovimentos: number; mesFechado: boolean; }
export interface FecharConsumoResult { id: number; grupoId: number; dataInicio: string; dataFim: string; numCabecas: number; dias: number; custoTotal: number; movimentos: number; temInsuficiencia: boolean; }
export const previsaoConsumo = (grupoId: number, dataInicio: string, dataFim: string) => req<PrevisaoConsumoDTO>(`/rebanho/lotes/${grupoId}/consumo/previsao${qs({ dataInicio, dataFim })}`);
export const fecharConsumo = (grupoId: number, body: { dataInicio: string; dataFim: string; observacao?: string }) => req<FecharConsumoResult>(`/rebanho/lotes/${grupoId}/consumo/fechar`, { method: "POST", body: JSON.stringify(body) });
export const listarConsumos = (grupoId: number) => req<ConsumoPeriodoDTO[]>(`/rebanho/lotes/${grupoId}/consumo`);
export const estornarConsumo = (id: number) => req<{ ok: true }>(`/rebanho/consumo/${id}`, { method: "DELETE" });

export type PeriodoDashboard = "hoje" | "7d" | "30d";
export type AbaAlertaDashboard = "animal" | "reproducao" | "sanidade" | "nutricao" | "producao";
export type ChaveWorklistRebanho = "secagem-atrasada" | "vazia-pos-pev" | "ccs-alta" | "dg-pendente" | "parto-proximo";
export type AcaoWorklistRebanho =
  | { dominio: "reproducao"; tipoEvento: "DIAGNOSTICO" | "SECAGEM" | "PARTO" | "INSEMINACAO" }
  | { dominio: "sanidade"; tipoEvento: "EXAME" };
interface AcaoWorklistApi { tipo: "DIAGNOSTICO" | "SECAGEM" | "PARTO" | "INSEMINACAO" | "EXAME"; rotulo: string; }
export interface WorklistItemRebanho {
  animalId: string | number;
  numero: string;
  nome: string | null;
  categoria?: string | null;
  grupo?: string | null;
  setor?: string | null;
  motivo: string;
  valor?: number | null;
  unidade?: string | null;
  dataReferencia?: string | null;
  ccs?: number | null;
  ccsTendencia?: string | null;
  del?: number | null;
  diasGestacao?: number | null;
  previsaoSecagem?: string | null;
}
export interface WorklistRebanho {
  chave: ChaveWorklistRebanho;
  label: string;
  quantidade: number;
  detalhe: string;
  severidade: "critico" | "atencao" | "informativo";
  tab: "reproducao" | "sanidade";
  acao: AcaoWorklistRebanho;
  itens: WorklistItemRebanho[];
}
export interface PontoSerieDashboard { data: string; valor: number | null; }
export interface IndicadorHeroDashboard {
  valor: number | null; unidade: string; anterior: number | null;
  variacaoAbsoluta: number | null; variacaoPercentual: number | null;
  comparavel: boolean; serie: PontoSerieDashboard[]; motivoIndisponivel?: string | null;
}
export interface IndicadorDashboard {
  chave: string; label: string; valor: number | null; unidade: string | null;
  detalhe?: string | null; qualidade: "disponivel" | "parcial" | "indisponivel";
}
export interface DashboardData {
  periodo: { chave: PeriodoDashboard; inicio: string; fim: string; rotuloComparacao: string };
  atualizacao: { geradoEm: string; dadoMaisRecenteEm: string | null; animaisAtivos: number; diasComProducao: number; diasEsperados: number; producaoParcial: boolean; avisos: string[] };
  herois: { vacasEmLactacao: IndicadorHeroDashboard; producaoMediaVaca: IndicadorHeroDashboard; producaoTotalDia: IndicadorHeroDashboard; percentualVacasLactacao: IndicadorHeroDashboard };
  estadosReprodutivos: { totalElegiveis: number; segmentos: { chave: string; label: string; quantidade: number; percentual: number | null }[] };
  indicadores: { producao: IndicadorDashboard[]; reproducao: IndicadorDashboard[]; rebanho: IndicadorDashboard[] };
  alertas: WorklistRebanho[];
  grupos: { grupoId: number | null; nome: string; animaisAtivos: number; vacas: number | null; emLactacao: number | null; percentualDoRebanho: number | null }[];
}
interface DashboardApiDTO {
  meta: { periodo: PeriodoDashboard; inicio: string; fim: string; geradoEm: string; dadoMaisRecente: string | null; cobertura: { diasEsperados: number; diasComProducao: number; producaoParcial: boolean; motivo: string | null } };
  totais: { rebanhoAtivo: number; vacasAtivas: number };
  herois: { chave: "vacasLactacao" | "mediaVacaDia" | "producaoTotalDia" | "pctVacasLactacao"; valor: number | null; unidade: string; valorAnterior: number | null; variacaoPct: number | null; indisponivelMotivo: string | null; serie: PontoSerieDashboard[] }[];
  estadosReprodutivos: { estado: string; quantidade: number; percentual: number | null }[];
  indicadores: { grupo: "producao" | "reproducao" | "rebanho"; itens: { chave: string; titulo: string; valor: number | null; unidade: string; amostra: number; indisponivelMotivo: string | null }[] }[];
  alertas: { chave: string; titulo: string; quantidade: number; explicacao: string; severidade: "alta" | "media" | "baixa"; tab: AbaAlertaDashboard; acao?: AcaoWorklistApi; itens?: WorklistItemRebanho[] }[];
  grupos: { id: number | null; nome: string; quantidade: number; percentual: number | null }[];
  qualidadeDados: { quantidade: number; explicacao: string }[];
}
const rotulosEstado: Record<string, string> = { PEV: "Aptas / PEV", VAZIA: "Vazias", INSEMINADA: "Inseminadas", PRENHE: "Prenhes" };
const acaoPorWorklist: Record<ChaveWorklistRebanho, AcaoWorklistRebanho> = {
  "secagem-atrasada": { dominio: "reproducao", tipoEvento: "SECAGEM" },
  "vazia-pos-pev": { dominio: "reproducao", tipoEvento: "INSEMINACAO" },
  "dg-pendente": { dominio: "reproducao", tipoEvento: "DIAGNOSTICO" },
  "parto-proximo": { dominio: "reproducao", tipoEvento: "PARTO" },
  "ccs-alta": { dominio: "sanidade", tipoEvento: "EXAME" },
};
function ehChaveWorklist(chave: string): chave is ChaveWorklistRebanho { return chave in acaoPorWorklist; }
function adaptarDashboard(d: DashboardApiDTO): DashboardData {
  const heroi = (chave: DashboardApiDTO["herois"][number]["chave"]): IndicadorHeroDashboard => {
    const h = d.herois.find((x) => x.chave === chave)!;
    return { valor: h.valor, unidade: h.unidade, anterior: h.valorAnterior, variacaoAbsoluta: h.valor != null && h.valorAnterior != null ? h.valor - h.valorAnterior : null, variacaoPercentual: h.variacaoPct, comparavel: h.valorAnterior != null, serie: h.serie, motivoIndisponivel: h.indisponivelMotivo };
  };
  const itens = (grupo: DashboardApiDTO["indicadores"][number]["grupo"]): IndicadorDashboard[] => (d.indicadores.find((x) => x.grupo === grupo)?.itens ?? []).map((i) => ({ chave: i.chave, label: i.titulo, valor: i.valor, unidade: i.unidade || null, detalhe: i.indisponivelMotivo, qualidade: i.valor == null ? "indisponivel" : i.indisponivelMotivo ? "parcial" : "disponivel" }));
  return {
    periodo: { chave: d.meta.periodo, inicio: d.meta.inicio, fim: d.meta.fim, rotuloComparacao: "período anterior" },
    atualizacao: { geradoEm: d.meta.geradoEm, dadoMaisRecenteEm: d.meta.dadoMaisRecente, animaisAtivos: d.totais.rebanhoAtivo, diasComProducao: d.meta.cobertura.diasComProducao, diasEsperados: d.meta.cobertura.diasEsperados, producaoParcial: d.meta.cobertura.producaoParcial, avisos: [d.meta.cobertura.motivo, ...d.qualidadeDados.filter((q) => q.quantidade > 0).map((q) => `${q.quantidade}: ${q.explicacao}`)].filter((x): x is string => Boolean(x)) },
    herois: { vacasEmLactacao: heroi("vacasLactacao"), producaoMediaVaca: heroi("mediaVacaDia"), producaoTotalDia: heroi("producaoTotalDia"), percentualVacasLactacao: heroi("pctVacasLactacao") },
    estadosReprodutivos: { totalElegiveis: d.estadosReprodutivos.reduce((s, x) => s + x.quantidade, 0), segmentos: d.estadosReprodutivos.map((x) => ({ chave: x.estado, label: rotulosEstado[x.estado] ?? x.estado, quantidade: x.quantidade, percentual: x.percentual })) },
    indicadores: { producao: itens("producao"), reproducao: itens("reproducao"), rebanho: itens("rebanho") },
    alertas: d.alertas.flatMap((a): WorklistRebanho[] => {
      if (!ehChaveWorklist(a.chave) || (a.tab !== "reproducao" && a.tab !== "sanidade")) return [];
      return [{ chave: a.chave, label: a.titulo, quantidade: a.quantidade, severidade: a.severidade === "alta" ? "critico" : a.severidade === "media" ? "atencao" : "informativo", tab: a.tab, detalhe: a.explicacao, acao: acaoPorWorklist[a.chave], itens: a.itens ?? [] }];
    }),
    grupos: d.grupos.map((g) => ({ grupoId: g.id, nome: g.nome, animaisAtivos: g.quantidade, vacas: null, emLactacao: null, percentualDoRebanho: g.percentual })),
  };
}
export const obterDashboard = (periodo: PeriodoDashboard, signal?: AbortSignal) => req<DashboardApiDTO>(`/rebanho/dashboard?periodo=${periodo}`, { signal }).then(adaptarDashboard);
interface WorklistApiDTO { meta: { geradoEm: string; escopo: { propriedadeId: number | null; consolidado: boolean } }; worklist: DashboardApiDTO["alertas"][number] }
function adaptarWorklist(a: DashboardApiDTO["alertas"][number]): WorklistRebanho {
  if (!ehChaveWorklist(a.chave) || (a.tab !== "reproducao" && a.tab !== "sanidade")) throw new Error("worklist inválida");
  return { chave: a.chave, label: a.titulo, quantidade: a.quantidade, severidade: a.severidade === "alta" ? "critico" : a.severidade === "media" ? "atencao" : "informativo", tab: a.tab, detalhe: a.explicacao, acao: acaoPorWorklist[a.chave], itens: a.itens ?? [] };
}
export const obterWorklist = (chave: ChaveWorklistRebanho, signal?: AbortSignal) => req<WorklistApiDTO>(`/rebanho/worklists/${chave}`, { signal }).then((r) => adaptarWorklist(r.worklist));
export function useWorklist(chave?: ChaveWorklistRebanho, snapshotInicial?: WorklistRebanho) {
  const [data, setData] = useState<WorklistRebanho | null>(() => snapshotInicial?.chave === chave ? snapshotInicial : null);
  const [loading, setLoading] = useState(Boolean(chave && !data));
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const recarregar = useCallback(() => setTentativa((n) => n + 1), []);
  useEffect(() => {
    if (!chave) { setData(null); setLoading(false); return; }
    if (snapshotInicial?.chave === chave && tentativa === 0) { setData(snapshotInicial); setLoading(false); return; }
    const ctrl = new AbortController(); setLoading(true); setErro(null);
    obterWorklist(chave, ctrl.signal).then(setData).catch((e) => { if (e?.name !== "AbortError") setErro(e.message); }).finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [chave, snapshotInicial, tentativa]);
  return { data, loading, erro, recarregar };
}

export function useDashboard(periodo: PeriodoDashboard = "7d") {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const recarregar = useCallback(() => setTentativa((n) => n + 1), []);
  useEffect(() => {
    const ctrl = new AbortController();
    setErro(null);
    if (data) setAtualizando(true); else setLoading(true);
    obterDashboard(periodo, ctrl.signal)
      .then(setData)
      .catch((e) => { if (e?.name !== "AbortError") setErro(e instanceof Error ? e.message : "Falha ao carregar o painel."); })
      .finally(() => { if (!ctrl.signal.aborted) { setLoading(false); setAtualizando(false); } });
    return () => ctrl.abort();
    // Preserva o último resultado sem transformar `data` em gatilho de refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, tentativa]);
  return { data, loading, atualizando, erro, recarregar };
}

export interface IaResposta { resposta: string; lista?: string[]; rodape?: string; modo: "ia" | "demo"; }
export const perguntarIA = (pergunta: string) => req<IaResposta>(`/rebanho/ia`, { method: "POST", body: JSON.stringify({ pergunta }) });

// Insights proativos da IA ("insights da semana") — cards reais do rebanho.
export const listarInsights = () => req<IaInsight[]>(`/rebanho/ia/insights`);
export function useInsights() {
  const [data, setData] = useState<IaInsight[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let vivo = true;
    listarInsights().then((d) => vivo && setData(d)).catch(() => vivo && setData([])).finally(() => vivo && setLoading(false));
    return () => { vivo = false; };
  }, []);
  return { data, loading };
}

// ── Configuração + Produção (Fatia 7) ──────────────────────────────────────
export type ModoProducao = "ORDENHA" | "TOTAL_DIARIO" | "TANQUE_LOTE";
export interface ConfigDTO { producaoModo: ModoProducao; precoLeite: number | null }
export const obterConfig = () => req<ConfigDTO>(`/rebanho/config`);
export const salvarConfig = (input: { producaoModo?: ModoProducao; precoLeite?: number | null }) =>
  req<ConfigDTO>(`/rebanho/config`, { method: "PATCH", body: JSON.stringify(input) });

export function useConfig() {
  const [data, setData] = useState<ConfigDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => { setLoading(true); setErro(null); obterConfig().then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

// ── Parâmetros de manejo ──────────────────────────────────────────────────
export type CategoriaParametro = "MANEJO" | "PRODUCAO" | "REPRODUCAO" | "GESTAO" | "SANITARIO";
export type DirecaoMeta = "maior_melhor" | "menor_melhor";
export interface ParametroDTO {
  chave: string;
  categoria: CategoriaParametro;
  descricao: string;
  unidade: string | null;
  valorNumero: number | null;
  valorNumeroAceitavel: number | null;
  valorTexto: string | null;
  modo: string | null;
  direcao: DirecaoMeta | null;
  referenciaNumero: number | null;
  referenciaNumeroAceitavel: number | null;
  ordem: number;
  temOverride: boolean;
}
export interface ParametroPatch {
  chave: string;
  valorNumero?: number | null;
  valorNumeroAceitavel?: number | null;
  valorTexto?: string | null;
  modo?: string | null;
}
export const listarParametros = () => req<ParametroDTO[]>(`/rebanho/parametros`);
export const salvarParametrosApi = (parametros: ParametroPatch[]) =>
  req<ParametroDTO[]>(`/rebanho/parametros`, { method: "PATCH", body: JSON.stringify({ parametros }) });
export const resetarParametro = (chave: string) =>
  req<ParametroDTO>(`/rebanho/parametros/reset`, { method: "POST", body: JSON.stringify({ chave }) });

export function useParametros() {
  const [data, setData] = useState<ParametroDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    listarParametros().then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, []);
  // Atualiza uma única chave em memória a partir de uma resposta da API — usado
  // por restaurar/salvar para refletir a mudança sem refetch (evita flash de loading).
  const substituirUm = useCallback((dto: ParametroDTO) => {
    setData((atual) => atual?.map((p) => (p.chave === dto.chave ? dto : p)) ?? [dto]);
  }, []);
  const substituir = useCallback((dtos: ParametroDTO[]) => { setData(dtos); }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar, substituir, substituirUm };
}

export interface ControlePayload { data: string; peso1?: number; peso2?: number; peso3?: number; pesoTotal?: number }
export const registrarControle = (animalId: string, p: ControlePayload) => req<EventoTimeline>(`/rebanho/animais/${animalId}/producao`, { method: "POST", body: JSON.stringify(p) });
export const excluirControle = (id: string) => req<{ ok: true }>(`/rebanho/producao/${id}`, { method: "DELETE" });
export const registrarProducaoLote = (p: { grupoId?: number; data: string; litros: number }) => req<{ id: number }>(`/rebanho/producao-lote`, { method: "POST", body: JSON.stringify(p) });
export const excluirProducaoLote = (id: string) => req<{ ok: true }>(`/rebanho/producao-lote/${id}`, { method: "DELETE" });

export interface ProducaoAgg {
  modo: ModoProducao;
  totalDia: number;
  mediaVaca?: number | null;
  emLactacao: number;
  ranking?: { numero: string; nome: string | null; litros: number }[];
  lotes?: { grupo: string; litros: number | null; vacas: number; rateio: number | null }[];
}
export const obterProducao = () => req<ProducaoAgg>(`/rebanho/producao`);
export function useProducao() {
  const [data, setData] = useState<ProducaoAgg | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => { setLoading(true); setErro(null); obterProducao().then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

// ── Referências financeiras (Fatia 10): categorias + centros de custo ───────
export interface RefDTO { id: number; nome: string }
export const listarCategorias = () => req<RefDTO[]>(`/rebanho/categorias`);
export const listarCentrosCusto = () => req<(RefDTO & { ehInvestimento: boolean })[]>(`/rebanho/centros-custo`);

// ── Cadastros (Fatia 8): Produtos + Fornecedores ───────────────────────────
export type TipoProduto = "MEDICAMENTO" | "RACAO" | "INSUMO" | "MINERAL" | "OUTRO";
// Setor operacional do produto (dimensão separada da categoria contábil). GERAL = sem setor.
export type SetorEstoque = "LEITE" | "CAFE" | "CORTE" | "MILHO" | "GERAL";
export const SETORES_ESTOQUE: { id: SetorEstoque; label: string }[] = [
  { id: "LEITE", label: "Leite" },
  { id: "CAFE", label: "Café" },
  { id: "CORTE", label: "Corte" },
  { id: "MILHO", label: "Milho" },
  { id: "GERAL", label: "Geral" },
];
export const setorLabel = (s?: string | null): string => SETORES_ESTOQUE.find((x) => x.id === s)?.label ?? "Geral";
export interface ProdutoDTO { id: number; nome: string; tipo: TipoProduto; unidade: string; custoUnitario: number | null; carencia: number | null; percentualMS: number | null; estocavel: boolean; minimoEstoque: number | null; ativo: boolean; setor: SetorEstoque | null; categoriaId: number | null; centroCustoId: number | null; categoriaNome: string | null; centroCustoNome: string | null; }
export interface ProdutoInput { nome: string; tipo: TipoProduto; unidade: string; custoUnitario?: number; carencia?: number; percentualMS?: number; estocavel?: boolean; minimoEstoque?: number; ativo?: boolean; setor?: SetorEstoque | null; categoriaId?: number | null; centroCustoId?: number | null; }
export const listarProdutos = (f?: { tipo?: string; q?: string; ativo?: boolean }) => req<ProdutoDTO[]>(`/rebanho/produtos${qs(f)}`);
export const criarProduto = (p: ProdutoInput) => req<ProdutoDTO>(`/rebanho/produtos`, { method: "POST", body: JSON.stringify(p) });
export const editarProduto = (id: number, p: Partial<ProdutoInput>) => req<ProdutoDTO>(`/rebanho/produtos/${id}`, { method: "PATCH", body: JSON.stringify(p) });

export type TipoPessoa = "CLIENTE" | "FORNECEDOR" | "AMBOS";
export interface FornecedorDTO { id: number; nome: string; documento: string | null; tipo: TipoPessoa; telefone: string | null; email: string | null; ativo: boolean; }
export interface FornecedorInput { nome: string; documento?: string; tipo?: TipoPessoa; telefone?: string; email?: string; ativo?: boolean; }
export const listarFornecedores = (f?: { tipo?: string; q?: string }) => req<FornecedorDTO[]>(`/rebanho/fornecedores${qs(f)}`);
export const criarFornecedor = (p: FornecedorInput) => req<FornecedorDTO>(`/rebanho/fornecedores`, { method: "POST", body: JSON.stringify(p) });
export const editarFornecedor = (id: number, p: Partial<FornecedorInput>) => req<FornecedorDTO>(`/rebanho/fornecedores/${id}`, { method: "PATCH", body: JSON.stringify(p) });

export function useProdutos(f?: { tipo?: string; q?: string; ativo?: boolean }) {
  const [data, setData] = useState<ProdutoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const key = JSON.stringify(f ?? {});
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    listarProdutos(f).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export function useFornecedores(f?: { tipo?: string; q?: string }) {
  const [data, setData] = useState<FornecedorDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const key = JSON.stringify(f ?? {});
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    listarFornecedores(f).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

// ── Estoque (Fatia 9): saldos + movimentos + custo vaca/dia ────────────────
export interface SaldoDTO { produtoId: number; nome: string; tipo: string; unidade: string; setor: SetorEstoque; saldo: number; valor: number; minimoEstoque: number | null; abaixoMinimo: boolean; }
export type OrigemMovimento = "MANUAL" | "NUTRICAO" | "PERDA" | "AJUSTE_INVENTARIO";
export interface MovimentoDTO { id: number; produtoId: number; produto: string; setor: SetorEstoque; tipo: "ENTRADA" | "SAIDA" | "AJUSTE"; origem: OrigemMovimento; data: string; quantidade: number; custoUnitario: number; valorTotal: number; fornecedor: string | null; grupo: string | null; observacao: string | null; }
export interface MovimentoInput { produtoId: number; tipo: "ENTRADA" | "SAIDA" | "AJUSTE"; data: string; quantidade: number; custoUnitario?: number; grupoId?: number; fornecedorId?: number; observacao?: string; gerarLancamento?: boolean; categoriaId?: number; centroCustoId?: number; }
export interface MovimentoResult { id: number; lancamentoCriado: boolean; lancamentoId?: number; motivo?: string; }
export interface CustoVacaDia { periodoDias: number; custoVacaDia: number | null; vacasEmLactacao: number; totalConsumo: number; }

export const listarSaldos = (f?: { setor?: string }) => req<SaldoDTO[]>(`/rebanho/estoque/saldos${qs(f)}`);
export const listarMovimentos = (f?: { produtoId?: number; tipo?: string }) => req<MovimentoDTO[]>(`/rebanho/estoque/movimentos${qs(f)}`);
export const registrarMovimento = (p: MovimentoInput) => req<MovimentoResult>(`/rebanho/estoque/movimentos`, { method: "POST", body: JSON.stringify(p) });
export const excluirMovimento = (id: number) => req<{ ok: true }>(`/rebanho/estoque/movimentos/${id}`, { method: "DELETE" });
export const obterCustoVacaDia = (dias = 30) => req<CustoVacaDia>(`/rebanho/estoque/custo-vaca-dia?dias=${dias}`);

export function useSaldos(f?: { setor?: string }) {
  const [data, setData] = useState<SaldoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const key = JSON.stringify(f ?? {});
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    listarSaldos(f).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export function useCustoVacaDia(dias = 30) {
  const [data, setData] = useState<CustoVacaDia | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => { setLoading(true); setErro(null); obterCustoVacaDia(dias).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false)); }, [dias]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

// ── Custo de Sanidade (Fatia 18): gasto real de medicamento rateado por aplicações ──────────
export interface CustoSanidade {
  periodoMeses: number;
  totalMedicamento: number;
  totalAplicacoes: number;
  custoPorAplicacao: number;
  topAnimais: { numero: string; nome: string; n: number; custoEstimado: number; custoExato: number }[];
  produtos: { produto: string; n: number; custoUnitario: number | null; custoExato: number | null }[];
  custoExatoTotal: number;
  produtosPrecificados: number;
  produtosTotais: number;
  nota: string;
}
export const obterCustoSanidade = (meses = 12) => req<CustoSanidade>(`/rebanho/custo-sanidade?meses=${meses}`);

export function useCustoSanidade(meses = 12) {
  const [data, setData] = useState<CustoSanidade | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => { setLoading(true); setErro(null); obterCustoSanidade(meses).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false)); }, [meses]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

// ── Custo de Produção (Fatia 11): quebra real do custeio do leite ──────────
export interface CustoProducao {
  periodoMeses: number;
  custeioLeiteTotal: number;
  breakdown: { categoria: string; valor: number; pct: number }[];
  custoVacaDia: number | null;
  vacasEmLactacao: number;
  litrosPeriodoEstimado: number;
  litrosDia: number;
  custoLitro: number | null;
  nota: string;
}
export const obterCustoProducao = (meses = 12) => req<CustoProducao>(`/rebanho/custo-producao?meses=${meses}`);

export function useCustoProducao(meses = 12) {
  const [data, setData] = useState<CustoProducao | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => { setLoading(true); setErro(null); obterCustoProducao(meses).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false)); }, [meses]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

// ── Multi-propriedade (Fatia 1): sítios ────────────────────────────────────
export interface PropriedadeDTO { id: number; nome: string; apelido: string | null; cidade: string | null; uf: string | null; principal: boolean; ativo: boolean; ordem: number; }
export interface PropriedadeInput { nome: string; apelido?: string; cidade?: string; uf?: string; principal?: boolean; ativo?: boolean; ordem?: number; }
export const listarPropriedades = () => req<PropriedadeDTO[]>(`/propriedades`);
export const criarPropriedade = (p: PropriedadeInput) => req<PropriedadeDTO>(`/propriedades`, { method: "POST", body: JSON.stringify(p) });
export const editarPropriedade = (id: number, p: PropriedadeInput) => req<PropriedadeDTO>(`/propriedades/${id}`, { method: "PATCH", body: JSON.stringify(p) });
export function usePropriedades() {
  const [data, setData] = useState<PropriedadeDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const recarregar = useCallback(() => { setLoading(true); listarPropriedades().then(setData).catch(() => setData([])).finally(() => setLoading(false)); }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, recarregar };
}

export type { ResumoAnimal };
