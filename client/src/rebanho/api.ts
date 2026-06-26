import { useEffect, useState, useCallback } from "react";
import type { Animal, ResumoAnimal, EventoTimeline } from "./types";

export interface RacaDTO { id: number; nome: string; codigo: string | null; especie: "BOVINO" | "CAPRINO" }
export interface GrupoDTO { id: number; nome: string }
export interface AnimalForm {
  numero: string; nome?: string; sexo: "F" | "M"; categoria: Animal["categoria"];
  racaId?: number; grauSangue?: string; dataNascimento?: string; dataEntrada: string;
  brincoEletronico?: string; sisbov?: string; maeId?: number; paiNome?: string; grupoId?: number; setor?: string;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init?.body ? { ...init, headers: { "content-type": "application/json", ...(init.headers || {}) } } : init);
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
  tipo: "CIO" | "INSEMINACAO" | "DIAGNOSTICO" | "PARTO" | "SECAGEM";
  data: string; observacao?: string;
  reprodutor?: string; protocolo?: string;
  resultado?: "positivo" | "negativo"; dtPartoPrevista?: string;
  numCrias?: number; sexoCria?: string; tipoParto?: string; motivoSecagem?: string;
}
export const listarEventos = (id: string) => req<EventoTimeline[]>(`/rebanho/animais/${id}/eventos`);
export const registrarEvento = (id: string, p: EventoPayload) => req<EventoTimeline>(`/rebanho/animais/${id}/eventos`, { method: "POST", body: JSON.stringify(p) });
export const excluirEvento = (eventoId: string) => req<{ ok: true }>(`/rebanho/eventos/${eventoId}`, { method: "DELETE" });

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

export interface DietaDTO { id: number; nome: string; descricao: string | null; pb: number | null; edMcal: number | null; ativo: boolean; }
export interface LoteDTO { id: number; nome: string; dietaId: number | null; dietaNome: string | null; numAnimais: number; producaoMedia: number | null; }
export interface DietaInput { nome: string; descricao?: string; pb?: number; edMcal?: number; }
export const listarDietas = () => req<DietaDTO[]>(`/rebanho/dietas`);
export const criarDieta = (p: DietaInput) => req<DietaDTO>(`/rebanho/dietas`, { method: "POST", body: JSON.stringify(p) });
export const editarDieta = (id: number, p: DietaInput) => req<DietaDTO>(`/rebanho/dietas/${id}`, { method: "PATCH", body: JSON.stringify(p) });
export const listarLotes = () => req<LoteDTO[]>(`/rebanho/lotes`);
export const atribuirDieta = (grupoId: number, dietaId: number | null) => req<{ ok: true }>(`/rebanho/lotes/${grupoId}/dieta`, { method: "POST", body: JSON.stringify({ dietaId }) });
export function useLotes() {
  const [data, setData] = useState<LoteDTO[]>([]); const [loading, setLoading] = useState(true); const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => { setLoading(true); setErro(null); listarLotes().then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { recarregar(); }, [recarregar]); return { data, loading, erro, recarregar };
}
export function useDietas() {
  const [data, setData] = useState<DietaDTO[]>([]); const recarregar = useCallback(() => { listarDietas().then(setData).catch(() => {}); }, []);
  useEffect(() => { recarregar(); }, [recarregar]); return { data, recarregar };
}

export interface DashboardData { kpis: { rebanhoAtivo: number; emLactacao: number; secas: number; producaoMedia: number | null; gestantes: number; prenhez: number }; dominios: { tab: string; titulo: string; linhas: string[] }[]; alertas: { label: string; n: number; tab: string; tom: "bad" | "ok" }[]; }
export const obterDashboard = () => req<DashboardData>(`/rebanho/dashboard`);
export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null); const [loading, setLoading] = useState(true); const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => { setLoading(true); setErro(null); obterDashboard().then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { recarregar(); }, [recarregar]); return { data, loading, erro };
}

export interface IaResposta { resposta: string; lista?: string[]; rodape?: string; modo: "ia" | "demo"; }
export const perguntarIA = (pergunta: string) => req<IaResposta>(`/rebanho/ia`, { method: "POST", body: JSON.stringify({ pergunta }) });

// ── Configuração + Produção (Fatia 7) ──────────────────────────────────────
export type ModoProducao = "ORDENHA" | "TOTAL_DIARIO" | "TANQUE_LOTE";
export const obterConfig = () => req<{ producaoModo: ModoProducao }>(`/rebanho/config`);
export const salvarConfig = (producaoModo: ModoProducao) => req<{ producaoModo: ModoProducao }>(`/rebanho/config`, { method: "PATCH", body: JSON.stringify({ producaoModo }) });

export function useConfig() {
  const [data, setData] = useState<{ producaoModo: ModoProducao } | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => { setLoading(true); setErro(null); obterConfig().then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
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
export interface ProdutoDTO { id: number; nome: string; tipo: TipoProduto; unidade: string; custoUnitario: number | null; carencia: number | null; percentualMS: number | null; estocavel: boolean; minimoEstoque: number | null; ativo: boolean; categoriaId: number | null; centroCustoId: number | null; categoriaNome: string | null; centroCustoNome: string | null; }
export interface ProdutoInput { nome: string; tipo: TipoProduto; unidade: string; custoUnitario?: number; carencia?: number; percentualMS?: number; estocavel?: boolean; minimoEstoque?: number; ativo?: boolean; categoriaId?: number | null; centroCustoId?: number | null; }
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
export interface SaldoDTO { produtoId: number; nome: string; tipo: string; unidade: string; saldo: number; valor: number; minimoEstoque: number | null; abaixoMinimo: boolean; }
export interface MovimentoDTO { id: number; produtoId: number; produto: string; tipo: "ENTRADA" | "SAIDA" | "AJUSTE"; data: string; quantidade: number; custoUnitario: number; valorTotal: number; fornecedor: string | null; grupo: string | null; observacao: string | null; }
export interface MovimentoInput { produtoId: number; tipo: "ENTRADA" | "SAIDA" | "AJUSTE"; data: string; quantidade: number; custoUnitario?: number; grupoId?: number; fornecedorId?: number; observacao?: string; gerarLancamento?: boolean; categoriaId?: number; centroCustoId?: number; }
export interface MovimentoResult { id: number; lancamentoCriado: boolean; lancamentoId?: number; motivo?: string; }
export interface CustoVacaDia { periodoDias: number; custoVacaDia: number | null; vacasEmLactacao: number; totalConsumo: number; }

export const listarSaldos = () => req<SaldoDTO[]>(`/rebanho/estoque/saldos`);
export const listarMovimentos = (f?: { produtoId?: number; tipo?: string }) => req<MovimentoDTO[]>(`/rebanho/estoque/movimentos${qs(f)}`);
export const registrarMovimento = (p: MovimentoInput) => req<MovimentoResult>(`/rebanho/estoque/movimentos`, { method: "POST", body: JSON.stringify(p) });
export const excluirMovimento = (id: number) => req<{ ok: true }>(`/rebanho/estoque/movimentos/${id}`, { method: "DELETE" });
export const obterCustoVacaDia = (dias = 30) => req<CustoVacaDia>(`/rebanho/estoque/custo-vaca-dia?dias=${dias}`);

export function useSaldos() {
  const [data, setData] = useState<SaldoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => { setLoading(true); setErro(null); listarSaldos().then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false)); }, []);
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

export type { ResumoAnimal };
