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

export const listarAnimais = (f?: { status?: string; grupoId?: number; q?: string; setor?: string; categoria?: string }) =>
  req<Animal[]>(`/rebanho/animais${qs(f)}`);
export const obterAnimal = (id: string) => req<Animal>(`/rebanho/animais/${id}`);
export const criarAnimal = (input: AnimalForm) => req<Animal>(`/rebanho/animais`, { method: "POST", body: JSON.stringify(input) });
export const editarAnimal = (id: string, input: Partial<AnimalForm>) => req<Animal>(`/rebanho/animais/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const darBaixa = (id: string, input: { motivo: string; data?: string }) => req<Animal>(`/rebanho/animais/${id}/baixa`, { method: "POST", body: JSON.stringify(input) });
// Alteração coletiva: aplica grupo e/ou setor a vários animais de uma vez (grava movimentações).
export const alterarAnimaisColetivo = (animalIds: number[], patch: { grupoId?: number | null; setor?: string | null }) =>
  req<{ atualizados: number; movimentacoes: number }>(`/rebanho/animais/bulk`, { method: "PATCH", body: JSON.stringify({ animalIds, ...patch }) });

// ── Filtros de animais salvos (nomeados) ─────────────────────────────────────
export interface FiltroCriterios { status: "ATIVO" | "BAIXADO" | "TODOS"; grupoId?: number; setor?: string; categoria?: string; q?: string }
export interface FiltroAnimalDTO {
  id: number; nome: string; status: string;
  grupoId: number | null; setor: string | null; categoria: string | null; busca: string | null;
  criterios: FiltroCriterios;
}
export interface FiltroAnimalInput {
  nome: string; status?: "ATIVO" | "BAIXADO" | "TODOS";
  grupoId?: number | null; setor?: string | null; categoria?: string | null; busca?: string | null;
}
export const listarFiltrosAnimais = () => req<FiltroAnimalDTO[]>(`/rebanho/filtros`);
export const criarFiltroAnimal = (body: FiltroAnimalInput) => req<FiltroAnimalDTO>(`/rebanho/filtros`, { method: "POST", body: JSON.stringify(body) });
export const excluirFiltroAnimal = (id: number) => req<{ ok: true }>(`/rebanho/filtros/${id}`, { method: "DELETE" });
export function useFiltrosAnimais() {
  const [data, setData] = useState<FiltroAnimalDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const recarregar = useCallback(() => {
    setLoading(true);
    listarFiltrosAnimais().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, recarregar };
}
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

export function useAnimais(f?: { status?: string; grupoId?: number; q?: string; setor?: string; categoria?: string }) {
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

export const ACHADOS_GINECOLOGICOS = ["CICLANDO", "CIO", "CORPO_LUTEO", "GESTANTE", "ANESTRO", "CISTO_FOLICULAR", "CISTO_LUTEO", "ENDOMETRITE", "INDEFINIDO"] as const;
export type AchadoGinecologico = (typeof ACHADOS_GINECOLOGICOS)[number];

export interface EventoPayload {
  tipo: "CIO" | "INSEMINACAO" | "DIAGNOSTICO" | "PARTO" | "SECAGEM" | "TRANSFERENCIA_EMBRIAO" | "EXAME_GINECOLOGICO" | "DESMAME";
  data: string; observacao?: string;
  reprodutor?: string; protocolo?: string;
  resultado?: "positivo" | "negativo" | AchadoGinecologico; dtPartoPrevista?: string;
  numCrias?: number; sexoCria?: string; tipoParto?: string; motivoSecagem?: string;
  doadoraId?: number; // TE: animal doador da genética
  metodo?: string; // exame ginecológico: palpação/US
  pesoKg?: number; // desmame: peso opcional ao desmame
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
  // Vínculo com o estoque: produtoId + quantidadeUsada geram baixa (SAIDA) automática no backend.
  produtoId?: number; quantidadeUsada?: number;
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
  induzida: boolean; // lactação induzida por protocolo (sem parto) — LACTACAO.INDUZIDA
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
  // Correção 305 oficial agregada (espelha ResumoLactacoes do server).
  media305: number | null;
  n305: number;
  melhor305: number | null;
  melhor305Numero: number | null;
}
export interface PontoCurvaDTO { data: string; del: number; pesoTotal: number }
export interface CurvaCicloDTO {
  numero: number | null;
  dtInicio: string | null;
  pontos: PontoCurvaDTO[];
  // Indicadores Embrapa do ciclo corrente (espelham CurvaCiclo do server).
  pico: number | null;         // maior produção diária na janela DEL 15-90 (L)
  persistencia: number | null; // avg(DEL 60-120) ÷ pico × 100; meta Embrapa ≥ 90%
}
export interface LactacoesResp { lactacoes: LactacaoDTO[]; resumo: ResumoLactacoesDTO; curva: CurvaCicloDTO; }

export const listarLactacoes = (id: string) => req<LactacoesResp>(`/rebanho/animais/${id}/lactacoes`);
export const marcarInducaoLactacao = (lactacaoId: number, induzida: boolean) =>
  req<{ id: number; induzida: boolean }>(`/rebanho/lactacoes/${lactacaoId}`, { method: "PATCH", body: JSON.stringify({ induzida }) });

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

// ── Movimentações de lote/setor (histórico "onde a vaca esteve") ──────────────
export interface MovimentacaoDTO {
  id: number; tipo: "GRUPO" | "SETOR"; data: string;
  origem: string | null; destino: string; motivo: string | null;
}
export const listarMovimentacoes = (id: string) => req<MovimentacaoDTO[]>(`/rebanho/animais/${id}/movimentacoes`);

export function useMovimentacoes(id: string | null) {
  const [data, setData] = useState<MovimentacaoDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const recarregar = useCallback(() => {
    if (!id) { setData(null); setLoading(false); return; }
    setLoading(true);
    listarMovimentacoes(id).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, recarregar };
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
export interface CarenciaAtivaDTO { fim: string; horasRestantes: number; diasRestantes: number }
export interface AnimalInsightsDTO {
  score: ScoreDTO; financeiro: FinanceiroDTO;
  tendencias: TendenciaDTO[]; insights: InsightDTO[];
  percentis: PercentisDTO; producaoFinanceira: ProducaoFinanceiraDTO;
  eficiencia: EficienciaDTO; projecoes: ProjecoesDTO;
  genealogia: GenealogiaDTO; carenciaAtiva: CarenciaAtivaDTO | null;
  timelineInterpretacao: Record<string, string>;
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
export type ChaveWorklistRebanho = "secagem-atrasada" | "vazia-pos-pev" | "ccs-alta" | "dg-pendente" | "parto-proximo" | "carencia" | "producao-caindo" | "vacina-pendente" | "precisa-de-exame";
export type AcaoWorklistRebanho =
  | { dominio: "reproducao"; tipoEvento: "DIAGNOSTICO" | "SECAGEM" | "PARTO" | "INSEMINACAO" | "EXAME_GINECOLOGICO" }
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
  tab: "reproducao" | "sanidade" | "producao";
  acao?: AcaoWorklistRebanho; // ausente em worklists de só visualização (ex.: carência, produção caindo)
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
// Só as worklists que têm ação de registrar evento. A carência é de visualização (sem ação).
const acaoPorWorklist: Partial<Record<ChaveWorklistRebanho, AcaoWorklistRebanho>> = {
  "secagem-atrasada": { dominio: "reproducao", tipoEvento: "SECAGEM" },
  "vazia-pos-pev": { dominio: "reproducao", tipoEvento: "INSEMINACAO" },
  "dg-pendente": { dominio: "reproducao", tipoEvento: "DIAGNOSTICO" },
  "parto-proximo": { dominio: "reproducao", tipoEvento: "PARTO" },
  "ccs-alta": { dominio: "sanidade", tipoEvento: "EXAME" },
  "precisa-de-exame": { dominio: "reproducao", tipoEvento: "EXAME_GINECOLOGICO" },
};
const CHAVES_WORKLIST: readonly ChaveWorklistRebanho[] = ["secagem-atrasada", "vazia-pos-pev", "ccs-alta", "dg-pendente", "parto-proximo", "carencia", "producao-caindo", "vacina-pendente", "precisa-de-exame"];
function ehChaveWorklist(chave: string): chave is ChaveWorklistRebanho { return (CHAVES_WORKLIST as readonly string[]).includes(chave); }
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
      if (!ehChaveWorklist(a.chave) || (a.tab !== "reproducao" && a.tab !== "sanidade" && a.tab !== "producao")) return [];
      return [{ chave: a.chave, label: a.titulo, quantidade: a.quantidade, severidade: a.severidade === "alta" ? "critico" : a.severidade === "media" ? "atencao" : "informativo", tab: a.tab, detalhe: a.explicacao, acao: acaoPorWorklist[a.chave], itens: a.itens ?? [] }];
    }),
    grupos: d.grupos.map((g) => ({ grupoId: g.id, nome: g.nome, animaisAtivos: g.quantidade, vacas: null, emLactacao: null, percentualDoRebanho: g.percentual })),
  };
}
export const obterDashboard = (periodo: PeriodoDashboard, signal?: AbortSignal) => req<DashboardApiDTO>(`/rebanho/dashboard?periodo=${periodo}`, { signal }).then(adaptarDashboard);
interface WorklistApiDTO { meta: { geradoEm: string; escopo: { propriedadeId: number | null; consolidado: boolean } }; worklist: DashboardApiDTO["alertas"][number] }
function adaptarWorklist(a: DashboardApiDTO["alertas"][number]): WorklistRebanho {
  if (!ehChaveWorklist(a.chave) || (a.tab !== "reproducao" && a.tab !== "sanidade" && a.tab !== "producao")) throw new Error("worklist inválida");
  return { chave: a.chave, label: a.titulo, quantidade: a.quantidade, severidade: a.severidade === "alta" ? "critico" : a.severidade === "media" ? "atencao" : "informativo", tab: a.tab, detalhe: a.explicacao, acao: acaoPorWorklist[a.chave], itens: a.itens ?? [] };
}
export const obterWorklist = (chave: ChaveWorklistRebanho, signal?: AbortSignal) => req<WorklistApiDTO>(`/rebanho/worklists/${chave}`, { signal }).then((r) => adaptarWorklist(r.worklist));
export function useWorklist(chave?: ChaveWorklistRebanho, snapshotInicial?: WorklistRebanho) {
  const [data, setData] = useState<WorklistRebanho | null>(() => snapshotInicial && snapshotInicial.chave === chave ? snapshotInicial : null);
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

// ── Cockpit do Dia (Painel "Hoje") ───────────────────────────────────────────
export interface CockpitContadorDTO {
  categoria: "repro" | "sanidade" | "vacina" | "carencia" | "estoque";
  quantidade: number;
  chave: ChaveWorklistRebanho | null; // deep-link p/ worklist; null p/ carência/estoque
  tab: string;
}
export interface CockpitDTO {
  contadores: CockpitContadorDTO[];
  pendenciasTotal: number; // soma dos 5 contadores
  diaFechado: boolean;     // true quando nada pendente (ROADMAP §4.1: "fechamento com 0 itens")
  saldoDia: number;
  saldoMes: number;
  // Quebra do saldo do mês por atividade (Σ == saldoMes). Espelha cockpit.calc do server.
  saldoLeite: number;
  saldoCafe: number;
  saldoOutros: number;
  // Sugestões do "Hoje" preditivo (V2 §5.1): top-3 por impacto R$/dia + total em aberto.
  sugestoesTop3?: SugestaoDTO[];
  impactoDiaSugestoes?: number;
}
export const obterCockpitHoje = (signal?: AbortSignal) => req<CockpitDTO>(`/rebanho/hoje`, { signal });
export function useCockpitHoje() {
  const [data, setData] = useState<CockpitDTO | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    obterCockpitHoje(ctrl.signal)
      .then(setData)
      .catch((e) => { if (e?.name !== "AbortError") setErro(e instanceof Error ? e.message : "Falha ao carregar o resumo do dia."); });
    return () => ctrl.abort();
  }, []);
  return { data, erro };
}

// ── Vacinas agendadas (lembrete por data) ────────────────────────────────────
export type StatusVacina = "aplicada" | "vencida" | "proxima" | "emdia";
export interface VacinaAgendadaDTO {
  id: number; animalId: number; vacina: string;
  dataPrevista: string; aplicadaEm: string | null; observacao: string | null; status: StatusVacina;
}
export const listarVacinas = (animalId: string) => req<VacinaAgendadaDTO[]>(`/rebanho/animais/${animalId}/vacinas`);
export const agendarVacina = (animalId: string, body: { vacina: string; dataPrevista: string; observacao?: string }) =>
  req<VacinaAgendadaDTO>(`/rebanho/animais/${animalId}/vacinas`, { method: "POST", body: JSON.stringify(body) });
export const marcarVacinaAplicada = (vacinaId: number, aplicadaEm?: string) =>
  req<VacinaAgendadaDTO>(`/rebanho/vacinas/${vacinaId}/aplicada`, { method: "PATCH", body: JSON.stringify(aplicadaEm ? { aplicadaEm } : {}) });
export const excluirVacina = (vacinaId: number) => req<{ ok: true }>(`/rebanho/vacinas/${vacinaId}`, { method: "DELETE" });
export function useVacinas(animalId: string | null) {
  const [data, setData] = useState<VacinaAgendadaDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const recarregar = () => {
    if (!animalId) { setData(null); setLoading(false); return; }
    setLoading(true);
    listarVacinas(animalId).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  };
  useEffect(recarregar, [animalId]);
  return { data, loading, recarregar };
}

// ── IATF: catálogo de protocolos configurável (D0/D7/D9/D11…) ────────────────
export interface EtapaProtocoloDTO { dia: number; acao: string; hormonio: string | null; ordem: number }
export interface EtapaAgendadaDTO extends EtapaProtocoloDTO { rotulo: string; data: string }
export interface ProtocoloIatfDTO {
  id: number; nome: string; descricao: string | null; hormonioBase: string | null; ativo: boolean;
  etapas: EtapaProtocoloDTO[];
}
export interface AplicacaoIatfDTO {
  id: number; animalId: number; protocoloId: number; protocoloNome: string;
  dataInicio: string; observacao: string | null; etapas: EtapaAgendadaDTO[];
}
export interface ProtocoloIatfInput {
  nome: string; descricao?: string | null; hormonioBase?: string | null; ativo?: boolean;
  etapas: { dia: number; acao: string; hormonio?: string | null; ordem?: number }[];
}

export const listarProtocolosIatf = (incluirInativos = false) =>
  req<ProtocoloIatfDTO[]>(`/rebanho/iatf/protocolos${incluirInativos ? "?inativos=1" : ""}`);
export const criarProtocoloIatf = (body: ProtocoloIatfInput) =>
  req<ProtocoloIatfDTO>(`/rebanho/iatf/protocolos`, { method: "POST", body: JSON.stringify(body) });
export const atualizarProtocoloIatf = (id: number, body: Partial<ProtocoloIatfInput>) =>
  req<ProtocoloIatfDTO>(`/rebanho/iatf/protocolos/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const excluirProtocoloIatf = (id: number) =>
  req<{ ok: true }>(`/rebanho/iatf/protocolos/${id}`, { method: "DELETE" });

export const listarAplicacoesIatf = (animalId: string) =>
  req<AplicacaoIatfDTO[]>(`/rebanho/animais/${animalId}/iatf`);
export const aplicarProtocoloIatf = (animalId: string, body: { protocoloId: number; dataInicio: string; observacao?: string }) =>
  req<AplicacaoIatfDTO>(`/rebanho/animais/${animalId}/iatf`, { method: "POST", body: JSON.stringify(body) });
export const excluirAplicacaoIatf = (id: number) =>
  req<{ ok: true }>(`/rebanho/iatf/aplicacoes/${id}`, { method: "DELETE" });

export function useProtocolosIatf(incluirInativos = false) {
  const [data, setData] = useState<ProtocoloIatfDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const recarregar = useCallback(() => {
    setLoading(true);
    listarProtocolosIatf(incluirInativos).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [incluirInativos]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, recarregar };
}

export function useAplicacoesIatf(animalId: string | null) {
  const [data, setData] = useState<AplicacaoIatfDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const recarregar = () => {
    if (!animalId) { setData(null); setLoading(false); return; }
    setLoading(true);
    listarAplicacoesIatf(animalId).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  };
  useEffect(recarregar, [animalId]);
  return { data, loading, recarregar };
}

// ── Protocolo sanitário: catálogo (D0/D+n) + aplicação por animal ─────────────
export interface EtapaSanitariaDTO { dia: number; acao: string; produto: string | null; ordem: number }
export interface EtapaSanitariaAgendadaDTO extends EtapaSanitariaDTO { rotulo: string; data: string }
export interface ProtocoloSanitarioDTO { id: number; nome: string; descricao: string | null; ativo: boolean; etapas: EtapaSanitariaDTO[] }
export interface AplicacaoSanitariaDTO { id: number; animalId: number; protocoloId: number; protocoloNome: string; dataInicio: string; observacao: string | null; etapas: EtapaSanitariaAgendadaDTO[] }
export interface ProtocoloSanitarioInput { nome: string; descricao?: string | null; ativo?: boolean; etapas: { dia: number; acao: string; produto?: string | null; ordem?: number }[] }

export const listarProtocolosSanitarios = (incluirInativos = false) =>
  req<ProtocoloSanitarioDTO[]>(`/rebanho/protocolos-sanitarios${incluirInativos ? "?inativos=1" : ""}`);
export const criarProtocoloSanitario = (body: ProtocoloSanitarioInput) => req<ProtocoloSanitarioDTO>(`/rebanho/protocolos-sanitarios`, { method: "POST", body: JSON.stringify(body) });
export const atualizarProtocoloSanitario = (id: number, body: Partial<ProtocoloSanitarioInput>) => req<ProtocoloSanitarioDTO>(`/rebanho/protocolos-sanitarios/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const excluirProtocoloSanitario = (id: number) => req<{ ok: true }>(`/rebanho/protocolos-sanitarios/${id}`, { method: "DELETE" });
export const listarAplicacoesSanitarias = (animalId: string) => req<AplicacaoSanitariaDTO[]>(`/rebanho/animais/${animalId}/protocolo-sanitario`);
export const aplicarProtocoloSanitario = (animalId: string, body: { protocoloId: number; dataInicio: string; observacao?: string }) => req<AplicacaoSanitariaDTO>(`/rebanho/animais/${animalId}/protocolo-sanitario`, { method: "POST", body: JSON.stringify(body) });
export const excluirAplicacaoSanitaria = (id: number) => req<{ ok: true }>(`/rebanho/protocolos-sanitarios/aplicacoes/${id}`, { method: "DELETE" });

export function useProtocolosSanitarios(incluirInativos = false) {
  const [data, setData] = useState<ProtocoloSanitarioDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const recarregar = useCallback(() => { setLoading(true); listarProtocolosSanitarios(incluirInativos).then(setData).catch(() => setData(null)).finally(() => setLoading(false)); }, [incluirInativos]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, recarregar };
}
export function useAplicacoesSanitarias(animalId: string | null) {
  const [data, setData] = useState<AplicacaoSanitariaDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const recarregar = () => {
    if (!animalId) { setData(null); setLoading(false); return; }
    setLoading(true);
    listarAplicacoesSanitarias(animalId).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  };
  useEffect(recarregar, [animalId]);
  return { data, loading, recarregar };
}

// ── IATF por lote: programação de um protocolo para um conjunto de animais num mesmo D0 ──
export interface ProgramacaoIatfLoteDTO {
  id: number; protocoloId: number; protocoloNome: string;
  grupoId: number | null; grupoNome: string | null; nome: string | null;
  dataInicio: string; observacao: string | null; totalAnimais: number;
  agenda: EtapaAgendadaDTO[]; totalEtapas: number; etapasConcluidas: number;
  proxima: EtapaAgendadaDTO | null; concluido: boolean;
}
export interface AnimalProgramacaoDTO { animalId: number; numero: string; nome: string | null }
export interface ProgramacaoIatfLoteDetalheDTO extends ProgramacaoIatfLoteDTO { animais: AnimalProgramacaoDTO[] }
export interface CriarProgramacaoIatfInput {
  protocoloId: number; dataInicio: string; grupoId?: number | null; nome?: string; observacao?: string; animalIds: number[];
}

export const listarProgramacoesIatf = () => req<ProgramacaoIatfLoteDTO[]>(`/rebanho/iatf/programacoes`);
export const detalheProgramacaoIatf = (id: number) => req<ProgramacaoIatfLoteDetalheDTO>(`/rebanho/iatf/programacoes/${id}`);
export const criarProgramacaoIatf = (body: CriarProgramacaoIatfInput) =>
  req<ProgramacaoIatfLoteDetalheDTO>(`/rebanho/iatf/programacoes`, { method: "POST", body: JSON.stringify(body) });
export const excluirProgramacaoIatf = (id: number) =>
  req<{ ok: true }>(`/rebanho/iatf/programacoes/${id}`, { method: "DELETE" });

export function useProgramacoesIatf() {
  const [data, setData] = useState<ProgramacaoIatfLoteDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const recarregar = useCallback(() => {
    setLoading(true);
    listarProgramacoesIatf().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, recarregar };
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
  ranking?: { numero: string; nome: string | null; litros: number; carencia?: CarenciaAtivaDTO | null }[];
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

// ── Análise de leite (qualidade): tendência de CCS + distribuição + piores animais ──
export type FaixaCCS = "EXCELENTE" | "ATENCAO" | "ALARME";
export interface PontoTendenciaCCS { mes: string; ccsMedio: number; leituras: number }
export interface PiorAnimalCCS { animalId: number; numero: string; nome: string | null; ccs: number; data: string; faixa: FaixaCCS }
export interface AnaliseLeiteDTO {
  totalLeituras: number; animaisComLeitura: number; ccsMedioAtual: number | null;
  gorduraMedia: number | null; proteinaMedia: number | null;
  tendenciaCCS: PontoTendenciaCCS[]; distribuicao: Record<FaixaCCS, number>;
  pioresAnimais: PiorAnimalCCS[];
}
export const obterAnaliseLeite = () => req<AnaliseLeiteDTO>(`/rebanho/producao/analise-leite`);
export function useAnaliseLeite() {
  const [data, setData] = useState<AnaliseLeiteDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const recarregar = useCallback(() => { setLoading(true); obterAnaliseLeite().then(setData).catch(() => setData(null)).finally(() => setLoading(false)); }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, recarregar };
}

// ── Tanque de resfriamento + análise de tanque (qualidade do leite bulk) ──────
export interface PontoTendenciaTanque { data: string; valor: number }
export interface ResumoTanqueDTO {
  total: number;
  ultima: { data: string; ccs: number | null; cbt: number | null; gordura: number | null; proteina: number | null } | null;
  tendenciaCCS: PontoTendenciaTanque[]; tendenciaCBT: PontoTendenciaTanque[];
  gorduraMedia: number | null; proteinaMedia: number | null;
}
export interface TanqueDTO { id: number; nome: string; capacidadeLitros: number | null; ativo: boolean; totalAnalises: number; resumo: ResumoTanqueDTO }
export interface AnaliseTanqueDTO { id: number; data: string; ccs: number | null; cbt: number | null; gordura: number | null; proteina: number | null; temperatura: number | null; observacao: string | null }
export interface RegistrarAnaliseTanqueInput { data: string; ccs?: number | null; cbt?: number | null; gordura?: number | null; proteina?: number | null; temperatura?: number | null; observacao?: string | null }

export const listarTanques = () => req<TanqueDTO[]>(`/rebanho/tanques`);
export const criarTanque = (body: { nome: string; capacidadeLitros?: number | null }) => req<TanqueDTO>(`/rebanho/tanques`, { method: "POST", body: JSON.stringify(body) });
export const excluirTanque = (id: number) => req<{ ok: true }>(`/rebanho/tanques/${id}`, { method: "DELETE" });
export const listarAnalisesTanque = (id: number) => req<AnaliseTanqueDTO[]>(`/rebanho/tanques/${id}/analises`);
export const registrarAnaliseTanque = (id: number, body: RegistrarAnaliseTanqueInput) => req<AnaliseTanqueDTO>(`/rebanho/tanques/${id}/analises`, { method: "POST", body: JSON.stringify(body) });
export function useTanques() {
  const [data, setData] = useState<TanqueDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const recarregar = useCallback(() => { setLoading(true); listarTanques().then(setData).catch(() => setData(null)).finally(() => setLoading(false)); }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, recarregar };
}

// ── Agenda unificada de manejos futuros (vacinas + IATF de lote) ──────────────
export type TipoManejo = "VACINA" | "IATF";
export interface AgendaItemDTO { tipo: TipoManejo; data: string; titulo: string; alvo: string; status: "atrasado" | "futuro"; diasParaData: number }
export const obterAgenda = (dias?: number) => req<AgendaItemDTO[]>(`/rebanho/agenda${dias ? `?dias=${dias}` : ""}`);
export function useAgenda(dias?: number) {
  const [data, setData] = useState<AgendaItemDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const recarregar = useCallback(() => { setLoading(true); obterAgenda(dias).then(setData).catch(() => setData(null)).finally(() => setLoading(false)); }, [dias]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, recarregar };
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

// ── Princípios ativos (composição de medicamento — base carência/antibiótico) ──
export interface PrincipioAtivoDTO {
  id: number; nome: string; ehAntibiotico: boolean;
  carenciaLeiteHoras: number | null; carenciaCarneDias: number | null;
  ativo: boolean; usoEmProdutos: number;
}
export interface PrincipioAtivoInput {
  nome: string; ehAntibiotico?: boolean;
  carenciaLeiteHoras?: number | null; carenciaCarneDias?: number | null; ativo?: boolean;
}
export interface ComposicaoProdutoDTO {
  produtoId: number; produtoNome: string;
  principios: { principioAtivoId: number; nome: string; concentracao: string | null; ehAntibiotico: boolean }[];
  ehAntibiotico: boolean; carenciaLeiteHorasSugerida: number | null; carenciaCarneDiasSugerida: number | null;
}

export const listarPrincipiosAtivos = (incluirInativos = false) =>
  req<PrincipioAtivoDTO[]>(`/rebanho/principios-ativos${incluirInativos ? "?inativos=1" : ""}`);
export const criarPrincipioAtivo = (body: PrincipioAtivoInput) =>
  req<PrincipioAtivoDTO>(`/rebanho/principios-ativos`, { method: "POST", body: JSON.stringify(body) });
export const atualizarPrincipioAtivo = (id: number, body: Partial<PrincipioAtivoInput>) =>
  req<PrincipioAtivoDTO>(`/rebanho/principios-ativos/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const excluirPrincipioAtivo = (id: number) =>
  req<{ ok: true }>(`/rebanho/principios-ativos/${id}`, { method: "DELETE" });
export const obterComposicaoProduto = (produtoId: number) =>
  req<ComposicaoProdutoDTO>(`/rebanho/produtos/${produtoId}/composicao`);
export const definirComposicaoProduto = (produtoId: number, principios: { principioAtivoId: number; concentracao?: string }[]) =>
  req<ComposicaoProdutoDTO>(`/rebanho/produtos/${produtoId}/composicao`, { method: "PUT", body: JSON.stringify({ principios }) });

// ── Composição de produto / ração formulada (receita = ingredientes × proporção %) ──
export interface ResumoComposicaoRacaoDTO { soma: number; somaOk: boolean; nIngredientes: number }
export interface ItemComposicaoRacaoDTO { ingredienteId: number; ingredienteNome: string; proporcao: number }
export interface ComposicaoRacaoDTO { produtoId: number; produtoNome: string; itens: ItemComposicaoRacaoDTO[]; resumo: ResumoComposicaoRacaoDTO }
export const obterComposicaoRacao = (produtoId: number) => req<ComposicaoRacaoDTO>(`/rebanho/produtos/${produtoId}/composicao-racao`);
export const definirComposicaoRacao = (produtoId: number, itens: { ingredienteId: number; proporcao: number }[]) =>
  req<ComposicaoRacaoDTO>(`/rebanho/produtos/${produtoId}/composicao-racao`, { method: "PUT", body: JSON.stringify({ itens }) });

// ── Lotes de produto (código + validade + local) + locais de armazenamento ────
export type StatusValidadeLote = "vencido" | "a-vencer" | "ok" | "sem-validade";
export interface LocalArmazenamentoDTO { id: number; nome: string; ativo: boolean; totalLotes: number }
export interface LoteProdutoDTO {
  id: number; produtoId: number; produtoNome: string; codigo: string;
  validade: string | null; localId: number | null; localNome: string | null;
  quantidade: number | null; status: StatusValidadeLote;
}
export interface ResumoLotesDTO { vencido: number; "a-vencer": number; ok: number; "sem-validade": number; total: number }
export interface LotesRespDTO { lotes: LoteProdutoDTO[]; resumo: ResumoLotesDTO }
export interface LoteProdutoInput { produtoId: number; codigo: string; validade?: string | null; localId?: number | null; quantidade?: number | null }

export const listarLocaisArmazenamento = () => req<LocalArmazenamentoDTO[]>(`/rebanho/locais-armazenamento`);
export const criarLocalArmazenamento = (body: { nome: string }) => req<LocalArmazenamentoDTO>(`/rebanho/locais-armazenamento`, { method: "POST", body: JSON.stringify(body) });
export const excluirLocalArmazenamento = (id: number) => req<{ ok: true }>(`/rebanho/locais-armazenamento/${id}`, { method: "DELETE" });
export const listarLotesProduto = () => req<LotesRespDTO>(`/rebanho/lotes-produto`);
export const criarLoteProduto = (body: LoteProdutoInput) => req<LoteProdutoDTO>(`/rebanho/lotes-produto`, { method: "POST", body: JSON.stringify(body) });
export const excluirLoteProduto = (id: number) => req<{ ok: true }>(`/rebanho/lotes-produto/${id}`, { method: "DELETE" });
export function useLotesProduto() {
  const [data, setData] = useState<LotesRespDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const recarregar = useCallback(() => { setLoading(true); listarLotesProduto().then(setData).catch(() => setData(null)).finally(() => setLoading(false)); }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, recarregar };
}

export function usePrincipiosAtivos(incluirInativos = false) {
  const [data, setData] = useState<PrincipioAtivoDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const recarregar = useCallback(() => {
    setLoading(true);
    listarPrincipiosAtivos(incluirInativos).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [incluirInativos]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, recarregar };
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

// ── Carteira do rebanho (Score como portfólio) — V2 §5.2 ────────────────────
export type ClassificacaoScore = "ELITE" | "MUITO_BOA" | "BOA" | "ATENCAO" | "DESCARTE";
export interface AnimalCarteiraDTO {
  animalId: number; numero: string; nome: string | null;
  score: number; classificacao: ClassificacaoScore;
  producaoDia: number | null; ccs: number | null; margemDiaEstimada: number | null;
}
export interface CarteiraDTO {
  totalAnimais: number;
  scoreMedio: number;
  distribuicao: { classificacao: ClassificacaoScore; cabecas: number; pctRebanho: number }[];
  margemDiaTotal: number;
  ranking: { melhores: AnimalCarteiraDTO[]; piores: AnimalCarteiraDTO[] };
  animais: AnimalCarteiraDTO[];
  precoLeite: number;
  fontePreco: "config" | "fallback";
  custoVacaDia: number | null;
}
export interface SimulacaoDescarteDTO {
  n: number; cabecas: number; litrosDiaSai: number;
  margemDiaAntes: number; margemDiaDepois: number; margemDiaDelta: number;
  ccsMedioAntes: number | null; ccsMedioDepois: number | null; scoreMedioDepois: number;
}
export const obterCarteira = () => req<CarteiraDTO>(`/rebanho/carteira`);
export const simularDescarte = (n: number) =>
  req<SimulacaoDescarteDTO>(`/rebanho/carteira/simular-descarte${qs({ n })}`);

export function useCarteira() {
  const [data, setData] = useState<CarteiraDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    obterCarteira().then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

// ── Composição do rebanho por grau de cruzamento (grau de sangue) ─────────────
export interface GrauDistribuicao { grau: string; quantidade: number; pct: number }
export interface ComposicaoRacialDTO { total: number; distribuicao: GrauDistribuicao[] }
export const obterComposicaoRacial = () => req<ComposicaoRacialDTO>(`/rebanho/composicao-racial`);
export function useComposicaoRacial() {
  const [data, setData] = useState<ComposicaoRacialDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const recarregar = useCallback(() => {
    setLoading(true);
    obterComposicaoRacial().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, recarregar };
}

// ── Rebanho quantitativo (efetivo por categoria × faixa etária) ───────────────
export type FaixaEtaria = "0-6" | "6-12" | "12-24" | "24-36" | "36+" | "sem-idade";
export const FAIXAS_ETARIAS: FaixaEtaria[] = ["0-6", "6-12", "12-24", "24-36", "36+", "sem-idade"];
export interface LinhaQuantDTO { categoria: string; faixas: Record<FaixaEtaria, number>; totalCategoria: number }
export interface QuantitativoDTO { linhas: LinhaQuantDTO[]; totalPorFaixa: Record<FaixaEtaria, number>; total: number }
export const obterQuantitativo = () => req<QuantitativoDTO>(`/rebanho/quantitativo`);
export function useQuantitativo() {
  const [data, setData] = useState<QuantitativoDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const recarregar = useCallback(() => { setLoading(true); obterQuantitativo().then(setData).catch(() => setData(null)).finally(() => setLoading(false)); }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, recarregar };
}

// ── Clima / registro de chuva (pluviômetro) ──────────────────────────────────
export interface RegistroChuvaDTO { id: number; data: string; mm: number; observacao: string | null }
export interface MesChuvaDTO { mes: string; total: number; dias: number }
export interface ResumoChuvaDTO { meses: MesChuvaDTO[]; total: number; diasComChuva: number }
export interface ChuvaRespDTO { registros: RegistroChuvaDTO[]; resumo: ResumoChuvaDTO }
export interface RegistrarChuvaInput { data: string; mm: number; observacao?: string | null }

export const obterChuva = () => req<ChuvaRespDTO>(`/rebanho/chuva`);
export const registrarChuva = (body: RegistrarChuvaInput) => req<RegistroChuvaDTO>(`/rebanho/chuva`, { method: "POST", body: JSON.stringify(body) });
export const excluirChuva = (id: number) => req<{ ok: true }>(`/rebanho/chuva/${id}`, { method: "DELETE" });

export function useChuva() {
  const [data, setData] = useState<ChuvaRespDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    obterChuva().then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

// ── Sugestões (Painel "Hoje" preditivo) — V2 §5.1 ───────────────────────────
export type TipoSugestao = "DESCARTE" | "REPRODUCAO" | "MASTITE" | "QUEDA_PRODUCAO";
export interface SugestaoDTO {
  tipo: TipoSugestao;
  animalId: number; numero: string; nome: string | null;
  titulo: string; motivo: string;
  impactoDiaEstimado: number; prazoDias: number | null;
  acao: { label: string; tab: string; worklistChave?: string };
}
export interface SugestoesDTO {
  sugestoes: SugestaoDTO[];
  totalPorTipo: Record<TipoSugestao, number>;
  impactoDiaTotal: number;
  precoLeite: number;
  custoVacaDia: number | null;
}
export const obterSugestoes = () => req<SugestoesDTO>(`/rebanho/sugestoes`);

export function useSugestoes() {
  const [data, setData] = useState<SugestoesDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    obterSugestoes().then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

// ── Saúde de úbere por quarto (mastite/CMT por teta) ─────────────────────────
export type Quarto = "AE" | "AD" | "PE" | "PD";
export type ScoreCmt = "NEGATIVO" | "TRACOS" | "UMA_CRUZ" | "DUAS_CRUZES" | "TRES_CRUZES";
export type EstadoQuarto = "SADIO" | "ATIVO" | "CRONICO" | "PERDIDO";

export interface QuartoInput {
  quarto: Quarto;
  scoreCmt?: ScoreCmt;
  ccs?: number;
  clinica?: boolean;
  severidade?: string;
  resultadoCultivo?: string;
  perdido?: boolean;
  escoreTeto?: number; // hiperqueratose da ponta do teto, 1–4
  observacao?: string;
}
export interface RegistrarExameQuartoInput { data: string; quartos: QuartoInput[] }

export interface ExameQuartoDTO {
  id: number; data: string; quarto: Quarto; scoreCmt: ScoreCmt | null; ccs: number | null;
  clinica: boolean; severidade: string | null; resultadoCultivo: string | null; perdido: boolean; escoreTeto: number | null; observacao: string | null;
}
export interface EstadoPorQuarto { estado: EstadoQuarto; positivos12m: number; clinicas12m: number; ultimoPositivo: string | null }
export interface SaudeUbereDTO {
  exames: ExameQuartoDTO[];
  porQuarto: Record<Quarto, EstadoPorQuarto>;
  quartosCronicos: number;
  quartosPerdidos: number;
}

export const obterSaudeUbere = (animalId: string) => req<SaudeUbereDTO>(`/rebanho/animais/${animalId}/exames-quarto`);
export const registrarExameQuarto = (animalId: string, input: RegistrarExameQuartoInput) =>
  req<SaudeUbereDTO>(`/rebanho/animais/${animalId}/exames-quarto`, { method: "POST", body: JSON.stringify(input) });

export function useSaudeUbere(animalId: string | null) {
  const [data, setData] = useState<SaudeUbereDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    if (!animalId) { setData(null); setLoading(false); return; }
    setLoading(true); setErro(null);
    obterSaudeUbere(animalId).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [animalId]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

// ── Biblioteca de reprodutores + centrais de sêmen + índices genéticos ────────
export interface CentralSemenDTO { id: number; nome: string; ativo: boolean; totalReprodutores: number }
export interface ReprodutorDTO {
  id: number; nome: string; codigo: string | null;
  racaId: number | null; racaNome: string | null;
  centralSemenId: number | null; centralNome: string | null;
  ptaLeite: number | null; ptaGordura: number | null; ptaProteina: number | null; tpi: number | null; ativo: boolean;
}
export interface ResumoReprodutoresDTO {
  total: number; mediaPtaLeite: number | null; mediaPtaGordura: number | null; mediaPtaProteina: number | null; mediaTpi: number | null;
  melhorLeiteId: number | null; melhorTpiId: number | null;
}
export interface BibliotecaReprodutoresDTO { reprodutores: ReprodutorDTO[]; resumo: ResumoReprodutoresDTO }
export interface ReprodutorInput {
  nome: string; codigo?: string | null; racaId?: number | null; centralSemenId?: number | null;
  ptaLeite?: number | null; ptaGordura?: number | null; ptaProteina?: number | null; tpi?: number | null; ativo?: boolean;
}

export const listarCentraisSemen = () => req<CentralSemenDTO[]>(`/rebanho/centrais-semen`);
export const criarCentralSemen = (body: { nome: string }) => req<CentralSemenDTO>(`/rebanho/centrais-semen`, { method: "POST", body: JSON.stringify(body) });
export const excluirCentralSemen = (id: number) => req<{ ok: true }>(`/rebanho/centrais-semen/${id}`, { method: "DELETE" });
export const listarReprodutores = (incluirInativos = false) => req<BibliotecaReprodutoresDTO>(`/rebanho/reprodutores${incluirInativos ? "?inativos=1" : ""}`);
export const criarReprodutor = (body: ReprodutorInput) => req<ReprodutorDTO>(`/rebanho/reprodutores`, { method: "POST", body: JSON.stringify(body) });
export const atualizarReprodutor = (id: number, body: Partial<ReprodutorInput>) => req<ReprodutorDTO>(`/rebanho/reprodutores/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const excluirReprodutor = (id: number) => req<{ ok: true }>(`/rebanho/reprodutores/${id}`, { method: "DELETE" });

export function useReprodutores(incluirInativos = false) {
  const [data, setData] = useState<BibliotecaReprodutoresDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const recarregar = useCallback(() => { setLoading(true); listarReprodutores(incluirInativos).then(setData).catch(() => setData(null)).finally(() => setLoading(false)); }, [incluirInativos]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, recarregar };
}

// ── Recomendação de acasalamento (ranking de touros para uma vaca) ────────────
export interface RecomendacaoDTO { id: number; nome: string; score: number; consanguineo: boolean; motivo: string }
export interface RecomendacaoAcasalamentoDTO { animalId: number; paiNome: string | null; recomendacoes: RecomendacaoDTO[] }
export const obterAcasalamento = (animalId: string) => req<RecomendacaoAcasalamentoDTO>(`/rebanho/animais/${animalId}/acasalamento`);
export function useAcasalamento(animalId: string | null) {
  const [data, setData] = useState<RecomendacaoAcasalamentoDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const recarregar = () => {
    if (!animalId) { setData(null); setLoading(false); return; }
    setLoading(true);
    obterAcasalamento(animalId).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  };
  useEffect(recarregar, [animalId]);
  return { data, loading, recarregar };
}

export type { ResumoAnimal };
