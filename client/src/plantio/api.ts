/* Camada de leitura/escrita do módulo Plantio.
 *
 * Espelha o pattern do módulo Rebanho: cada `useXxx()` bate em `/api/plantio/*`
 * via o helper `req<T>`, que prefixa `/api`, injeta `content-type` quando há
 * corpo e extrai a mensagem de erro de `{error}` (service) ou `{error:{issues}}`
 * (ZodError do zValidator). Os hooks mantêm o contrato `{data, loading, erro,
 * recarregar}` — a forma dos DTOs (./types) não muda.
 *
 * Custo de produção e IA ainda são mock (viram reais em fatia posterior).
 */

import { useEffect, useState, useCallback } from "react";
import type { Talhao, ResumoTalhao, EventoTimeline, Lavoura, PlanoAdubacao, FaseFenologica, SafraDTO, TarefaPlanejada, Apontamento, IaInsight } from "./types";
import { HOJE } from "./HOJE";
import { comPropriedade } from "../propriedadeScope";
import type { UnidadeMedida } from "../lib/unidades";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = comPropriedade({
    ...((init?.headers as Record<string, string>) || {}),
    ...(init?.body ? { "content-type": "application/json" } : {}),
  });
  const res = await fetch(`/api${path}`, { ...init, headers });
  if (!res.ok) {
    const b: any = await res.json().catch(() => null);
    let msg = `HTTP ${res.status}`;
    if (typeof b?.error === "string") msg = b.error;                                   // erro do service (ex.: código duplicado)
    else if (b?.error?.issues?.length) msg = b.error.issues.map((i: any) => i.message).join("; "); // ZodError do zValidator
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
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

// DTOs de entrada/escrita -------------------------------------------------

export interface VariedadeDTO { id: number; nome: string; resistenteFerrugem: boolean }

// Passada de colheita real (PassadaColheita) — forma do DTO devolvido por
// GET /plantio/passadas. Decimals já vêm como number, datas como YYYY-MM-DD.
export interface PassadaDTO {
  id: number;
  talhaoId: string;
  talhaoCodigo: string;
  talhaoNome: string | null;
  data: string;             // YYYY-MM-DD
  numero: number;
  metodo: string;
  litrosCereja: number;
  rendimentoLPorSc: number;
  sacasBeneficiadas: number;
  pctCereja: number | null;
  responsavel: string | null;
}

// Payload de registro de operação cultural — espelha o body aceito pelo backend
// em POST /plantio/talhoes/:id/operacoes. Retorna o evento criado (timeline).
export interface OperacaoInput {
  partidas?: Array<{ partidaId: string; quantidade: number }>;
  dominio: "fenologia" | "fitossanidade" | "nutricao" | "colheita";
  tipo: string;                 // TipoOperacao (ex.: "APLICACAO_FUNGICIDA")
  data: string;                 // YYYY-MM-DD
  responsavel?: string;
  produto?: string;
  observacao?: string;
  doseValor?: number;
  doseUnidadeMedida?: UnidadeMedida;  // unidade da dose (novo) — combina com dosePorHectare
  dosePorHectare?: boolean;           // true → dose × área do talhão; false → dose já é o total
  doseUnidade?: string;         // legado (ex.: "mL/ha", "kg/ha", "t/ha") — aceito quando os campos novos não vêm
  pragaAlvo?: string;           // PragaDoenca (só fitossanidade)
  produtoId?: string | null;         // produto do estoque — gera baixa automática se tiver estoque no sítio
  quantidadeTotal?: number | null;   // sobrescreve a estimativa (dose × área) quando informado
  centroCustoId?: string | null;     // se vazio, o server usa o único centro do produto (se houver)
}

export interface TalhaoInput {
  codigo: string;
  nome?: string;
  variedadeId: number;
  lavouraId?: number;
  espacamento?: string;
  plantasHa: number;
  areaHa: number;
  anoPlantio: number;
  altitude?: number;
  exposicao?: string | null;
  declive?: number | null;
  irrigado?: boolean;
  estado?: string;
  dataPlantio: string;          // YYYY-MM-DD
  ultimaRecepa?: string | null;
  observacao?: string | null;
}

// LISTAGENS / CRUD --------------------------------------------------------

export const listarTalhoes = (f?: { estado?: string; lavoura?: string; q?: string }) =>
  // estado é repassado como veio (inclusive "TODOS"): o backend aceita "TODOS" no
  // listFiltrosSchema e o service trata `estado === "TODOS"` como "sem filtro de estado".
  req<Talhao[]>(`/plantio/talhoes${qs(f)}`);
export const obterTalhao = (id: string) => req<Talhao>(`/plantio/talhoes/${id}`);
// O detalhe do talhão já vem com `.resumo` embutido — derivamos o resumo dele.
export const obterResumo = (id: string) => obterTalhao(id).then((t) => t.resumo ?? null);
// Timeline real (P2): operações, inspeções MIP, amostras solo/foliar e passadas
// de colheita tecidas pelo backend e ordenadas desc.
export const listarEventos = (talhaoId: string) =>
  req<EventoTimeline[]>(`/plantio/talhoes/${talhaoId}/eventos`);
export const listarPassadas = (ano?: number) =>
  req<PassadaDTO[]>(`/plantio/passadas${qs({ ano })}`);
export const listarLavouras = () => req<Lavoura[]>(`/plantio/lavouras`);
export const listarPlanos = () => req<PlanoAdubacao[]>(`/plantio/planos-adubacao`);
export const listarVariedades = () => req<VariedadeDTO[]>(`/plantio/variedades`);

export const criarTalhao = (input: TalhaoInput) =>
  req<Talhao>(`/plantio/talhoes`, { method: "POST", body: JSON.stringify(input) });
export const editarTalhao = (id: string, input: Partial<TalhaoInput>) =>
  req<Talhao>(`/plantio/talhoes/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const darBaixa = (id: string, input: { motivo: string; data?: string }) =>
  req<Talhao>(`/plantio/talhoes/${id}/baixa`, { method: "POST", body: JSON.stringify(input) });
// `aviso`: o servidor salvou a aplicação mas não deu baixa de estoque (produto
// sem entrada nesta fazenda) — a tela mostra isso ao usuário.
export type EventoTimelineComAviso = EventoTimeline & { aviso?: string };
export const registrarOperacao = (talhaoId: string, input: OperacaoInput) =>
  req<EventoTimelineComAviso>(`/plantio/talhoes/${talhaoId}/operacoes`, { method: "POST", body: JSON.stringify(input) });
export const editarOperacao = (id: string, input: Partial<OperacaoInput>) =>
  req<EventoTimeline>(`/plantio/operacoes/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const excluirOperacao = (id: string) =>
  req<void>(`/plantio/operacoes/${id}`, { method: "DELETE" });

// HOOKS -------------------------------------------------------------------

export function useTalhoes(f?: { estado?: string; lavoura?: string; q?: string }) {
  const [data, setData] = useState<Talhao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const key = JSON.stringify(f ?? {});
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    listarTalhoes(f).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export function useTalhao(id: string | null) {
  const [data, setData] = useState<Talhao | null>(null);
  const [resumo, setResumo] = useState<ResumoTalhao | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!id) { setData(null); setResumo(null); return; }
    setLoading(true);
    obterTalhao(id)
      .then((t) => { setData(t); setResumo(t?.resumo ?? null); })
      .catch(() => { setData(null); setResumo(null); })
      .finally(() => setLoading(false));
  }, [id]);
  return { data, resumo, loading };
}

export function useEventos(id: string | null) {
  const [data, setData] = useState<EventoTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const recarregar = useCallback(() => {
    if (!id) { setData([]); setLoading(false); return; }
    setLoading(true);
    listarEventos(id).then(setData).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, recarregar };
}

export function usePassadas(ano?: number) {
  const [data, setData] = useState<PassadaDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    listarPassadas(ano).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [ano]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export function useLavouras() {
  const [data, setData] = useState<Lavoura[]>([]);
  const [loading, setLoading] = useState(true);
  const recarregar = useCallback(() => {
    setLoading(true);
    listarLavouras().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, recarregar };
}

export function usePlanosAdubacao() {
  const [data, setData] = useState<PlanoAdubacao[]>([]);
  const recarregar = useCallback(() => { listarPlanos().then(setData).catch(() => {}); }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, recarregar };
}

// PLANEJAMENTO DA SAFRA (Fatia P3 — camada operacional Ideagri) -----------

// Payloads de escrita — espelham o body aceito pelos endpoints /plantio/{safras,tarefas,apontamentos}.
export interface SafraInput {
  nome: string;
  dataInicio: string;       // YYYY-MM-DD
  dataFim: string;          // YYYY-MM-DD
  centroCustoId?: string | null;
}

export interface TarefaInput {
  safraId: number;
  descricao: string;
  tipo: string;             // TipoOperacao
  talhaoId?: number | null;
  lavouraId?: number | null;
  responsavel?: string | null;
  produto?: string | null;
  unidade?: string | null;
  qtdHaPrev?: number | null;
  qtdTotalPrev?: number | null;
  dataPrevista?: string | null;
  custoPrev?: number | null;
  // Campos de realizado — só no fluxo "Realizar" (PATCH).
  qtdHaReal?: number | null;
  qtdTotalReal?: number | null;
  dataRealizada?: string | null;
  custoReal?: number | null;
  status?: string;          // PLANEJADA | EM_ANDAMENTO | CONCLUIDA | CANCELADA
}

export interface ApontamentoInput {
  safraId?: number | null;
  talhaoId?: number | null;
  data: string;             // YYYY-MM-DD
  tipo: "MAQUINA" | "HOMEM";
  recurso: string;
  operador?: string | null;
  implemento?: string | null;
  horas: number;
  valorHora?: number | null;
  observacao?: string | null;
}

// Safras
export const listarSafras = () => req<SafraDTO[]>(`/plantio/safras`);
export const criarSafra = (input: SafraInput) =>
  req<SafraDTO>(`/plantio/safras`, { method: "POST", body: JSON.stringify(input) });
export const editarSafra = (id: number, input: Partial<SafraInput> & { fechada?: boolean }) =>
  req<SafraDTO>(`/plantio/safras/${id}`, { method: "PATCH", body: JSON.stringify(input) });

// Tarefas (planejado × realizado)
export const listarTarefas = (safraId: number) =>
  req<TarefaPlanejada[]>(`/plantio/tarefas${qs({ safraId })}`);
export const criarTarefa = (input: TarefaInput) =>
  req<TarefaPlanejada>(`/plantio/tarefas`, { method: "POST", body: JSON.stringify(input) });
export const editarTarefa = (id: number, input: Partial<TarefaInput>) =>
  req<TarefaPlanejada>(`/plantio/tarefas/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const excluirTarefa = (id: number) =>
  req<{ ok: true }>(`/plantio/tarefas/${id}`, { method: "DELETE" });

// Apontamentos (hora-máquina / hora-homem)
export const listarApontamentos = (safraId: number) =>
  req<Apontamento[]>(`/plantio/apontamentos${qs({ safraId })}`);
export const criarApontamento = (input: ApontamentoInput) =>
  req<Apontamento>(`/plantio/apontamentos`, { method: "POST", body: JSON.stringify(input) });
export const excluirApontamento = (id: number) =>
  req<{ ok: true }>(`/plantio/apontamentos/${id}`, { method: "DELETE" });

export function useSafras() {
  const [data, setData] = useState<SafraDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    listarSafras().then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export function useTarefas(safraId: number | null) {
  const [data, setData] = useState<TarefaPlanejada[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    if (safraId == null) { setData([]); setLoading(false); return; }
    setLoading(true); setErro(null);
    listarTarefas(safraId).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [safraId]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export function useApontamentos(safraId: number | null) {
  const [data, setData] = useState<Apontamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    if (safraId == null) { setData([]); setLoading(false); return; }
    setLoading(true); setErro(null);
    listarApontamentos(safraId).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [safraId]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

// DASHBOARD ---------------------------------------------------------------

export interface DashboardPlantio {
  k: {
    areaTotal: number;          // ha
    talhoesAtivos: number;
    sacasEsperadas: number;     // total estimado safra
    sacasJaColhidas: number;
    produtividadeMedia: number; // sc/ha (média dos talhões em produção)
    variedades: number;
    alertaFito: number;         // talhões em alerta fitossanitário
    fase: FaseFenologica;       // fase predominante hoje
  };
  dominios: { tab: string; titulo: string; linhas: string[] }[];
  alertas: { label: string; n: number; tom?: "up" | "bad"; tab: string }[];
}

export function useDashboard() {
  const [data, setData] = useState<DashboardPlantio | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    listarTalhoes().then((ts) => {
      // O backend entrega cada talhão com `.resumo` embutido — derivamos o
      // painel a partir desses read-models reais.
      const rs = ts.map((t) => t.resumo).filter(Boolean) as ResumoTalhao[];
      const ativos = ts.filter((t) => t.estado === "ATIVO");
      const areaTotal = ts.reduce((a, t) => a + t.areaHa, 0);
      const sacasEsperadas = ts.reduce((a, t) => {
        const r = t.resumo;
        return a + (r?.produtividadeEsperada ?? 0) * t.areaHa;
      }, 0);
      const jaColhidas = 0; // colheita/eventos são a próxima fatia
      const emProducao = ativos.filter((t) => (t.resumo?.produtividadeEsperada ?? 0) > 0);
      const prodMedia = emProducao.length
        ? emProducao.reduce((a, t) => a + (t.resumo?.produtividadeEsperada ?? 0), 0) / emProducao.length
        : 0;
      const variedades = new Set(ts.map((t) => t.variedade)).size;
      const alertaFito = rs.filter((r) => (r.ferrugem ?? 0) >= 5 || (r.broca ?? 0) >= 3).length;
      const fases = rs.map((r) => r.fase);
      const fase = (fases.length ? moda(fases) : "REPOUSO") as FaseFenologica;

      const fitAlerta = rs.filter((r) => (r.ferrugem ?? 0) >= 5).length;
      const colherJa = rs.filter((r) => (r.maturacaoCereja ?? 0) >= 60 && r.fase !== "COLHEITA").length;
      const semFoliar = rs.filter((r) => {
        if (!r.ultimaAnaliseFoliar) return true;
        const dias = (new Date(HOJE).getTime() - new Date(r.ultimaAnaliseFoliar).getTime()) / 86_400_000;
        return dias > 120;
      }).length;
      const semSolo = rs.filter((r) => {
        if (!r.ultimaAnaliseSolo) return true;
        const dias = (new Date(HOJE).getTime() - new Date(r.ultimaAnaliseSolo).getTime()) / 86_400_000;
        return dias > 365;
      }).length;

      setData({
        k: {
          areaTotal: round1(areaTotal),
          talhoesAtivos: ativos.length,
          sacasEsperadas: Math.round(sacasEsperadas),
          sacasJaColhidas: Math.round(jaColhidas),
          produtividadeMedia: round1(prodMedia),
          variedades,
          alertaFito,
          fase,
        },
        dominios: [
          { tab: "pla-fenologia", titulo: "Fenologia da safra", linhas: [
            `${rs.filter((r) => r.fase === "MATURACAO_CEREJA").length} talhões em maturação cereja`,
            `${rs.filter((r) => r.fase === "COLHEITA").length} talhões em colheita ativa`,
            `${rs.filter((r) => r.fase === "REPOUSO").length} talhões em repouso / formação`,
          ]},
          { tab: "pla-fitossanidade", titulo: "Fitossanidade", linhas: [
            `${fitAlerta} talhões com ferrugem ≥ 5%`,
            `${rs.filter((r) => (r.broca ?? 0) >= 3).length} talhões com broca ≥ 3%`,
            `Última inspeção há ${diasDesde(maxData(rs.map((r) => r.ultimaInspecaoData)))} dias`,
          ]},
          { tab: "pla-nutricao", titulo: "Nutrição / solo", linhas: [
            `${semFoliar} talhões com foliar vencida`,
            `${semSolo} talhões com solo vencido (> 1 ano)`,
            `${rs.filter((r) => (r.potassio ?? 999) < 80).length} talhões com K abaixo do ideal`,
          ]},
          { tab: "pla-colheita", titulo: "Colheita 2026", linhas: [
            `${colherJa} talhões prontos pra entrar (cereja ≥ 60%)`,
            `${rs.filter((r) => r.fase === "COLHEITA").length} já em derriça`,
            `${Math.round(jaColhidas)} sc beneficiadas até hoje`,
          ]},
        ],
        alertas: [
          { label: "Ferrugem ≥ 5%", n: fitAlerta, tom: fitAlerta > 0 ? "up" : undefined, tab: "pla-fitossanidade" },
          { label: "Broca ≥ 3%", n: rs.filter((r) => (r.broca ?? 0) >= 3).length, tom: "up", tab: "pla-fitossanidade" },
          { label: "Foliar vencida", n: semFoliar, tom: "bad", tab: "pla-nutricao" },
          { label: "Análise solo vencida", n: semSolo, tom: "bad", tab: "pla-nutricao" },
        ],
      });
    }).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);
  return { data, loading };
}

// Tela Custo Produção (P2 real — ponte financeira da Atividade Café) --------

// Toggle Custeio/Investimento/Tudo (contrato §6.4) — `classe` só seleciona o
// headline `custoTotal`; custoSaca/custoHa são SEMPRE sobre custeio.
export type ClasseCusto = "custeio" | "investimento" | "tudo";

export interface CustoPlantioData {
  classe: ClasseCusto;
  custoTotal: number;         // headline conforme a `classe` pedida
  custoSaca: number | null;   // null em fase de formação (sem benefício no período)
  custoHa: number | null;     // null se não há área de produção computável
  custeioTotal: number;
  investimentoTotal: number;
  sacasPeriodo: number;
  periodoMeses: number;
  breakdown: { categoria: string; valor: number; pct: number }[];
  nota: string;
  areaProducao?: number;
}

export const obterCustoPlantio = (meses = 12, classe: ClasseCusto = "custeio") =>
  req<CustoPlantioData>(`/plantio/custo${qs({ meses, classe })}`);

export function useCustoPlantio(meses = 12, classe: ClasseCusto = "custeio") {
  const [data, setData] = useState<CustoPlantioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    setLoading(true); setErro(null);
    obterCustoPlantio(meses, classe)
      .then(setData)
      .catch((e) => { setErro(e.message); setData(null); })
      .finally(() => setLoading(false));
  }, [meses, classe]);
  return { data, loading, erro };
}

// Custo OPERACIONAL do café (aditivo ao financeiro acima) — derivado das
// operações reais da safra (Σ TarefaAgricola.custoReal + Σ ApontamentoMaquina.
// valorTotal). Espelha o DTO de services/plantio/custo-operacional.ts.
export interface CustoOperacionalCafe {
  safraId: number;
  custeioTotal: number;
  custoSaca: number | null;   // null sem sacas na janela da safra (nunca NaN)
  custoHa: number | null;     // null sem talhão ATIVO
  sacas: number;
  areaHa: number;
  nota: string;
}

export const obterCustoOperacionalCafe = (safraId: number) =>
  req<CustoOperacionalCafe>(`/plantio/safras/${safraId}/custo-operacional`);

export function useCustoOperacionalCafe(safraId: number | null) {
  const [data, setData] = useState<CustoOperacionalCafe | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (safraId == null) { setData(null); setErro(null); return; }
    setLoading(true); setErro(null);
    obterCustoOperacionalCafe(safraId)
      .then(setData)
      .catch((e) => { setErro(e.message); setData(null); })
      .finally(() => setLoading(false));
  }, [safraId]);
  return { data, loading, erro };
}

// ESTOQUE: unificado em client/src/estoque/ (tela "Estoque", rota /api/estoque/*).

// IA (real — POST /plantio/ia; modo demo sem ANTHROPIC_API_KEY, modo IA com ela)

export interface RespostaIa { resposta: string; lista?: string[]; rodape?: string; modo?: "ia" | "demo"; }

export function perguntarIA(pergunta: string): Promise<RespostaIa> {
  return req<RespostaIa>(`/plantio/ia`, { method: "POST", body: JSON.stringify({ pergunta }) });
}

// Insights proativos da IA ("insights da semana") — cards reais da lavoura.
export const listarInsights = () => req<IaInsight[]>(`/plantio/ia/insights`);
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

// HELPERS -----------------------------------------------------------------

function round1(n: number) { return Math.round(n * 10) / 10; }
function moda<T>(arr: T[]): T {
  const c = new Map<T, number>();
  for (const x of arr) c.set(x, (c.get(x) ?? 0) + 1);
  let best: T = arr[0]; let max = 0;
  for (const [k, v] of c) if (v > max) { max = v; best = k; }
  return best;
}
function diasDesde(iso?: string | null) {
  if (!iso) return "—";
  return Math.floor((new Date(HOJE).getTime() - new Date(iso).getTime()) / 86_400_000);
}
function maxData(arr: (string | undefined)[]): string | undefined {
  return arr.filter(Boolean).sort().pop() as string | undefined;
}
