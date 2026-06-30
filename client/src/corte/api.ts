/* Camada de leitura/escrita do módulo Corte.
 *
 * Espelha o pattern do módulo Plantio: o núcleo (lotes, piquetes, pesagens,
 * dashboard) bate em `/api/corte/*` via o helper `req<T>`, que prefixa `/api`,
 * injeta `content-type` quando há corpo e extrai a mensagem de erro de `{error}`
 * (service) ou `{error:{issues}}` (ZodError do zValidator). A forma dos DTOs
 * (./types) não muda — o backend retorna exatamente `Lote` (com `.resumo`
 * embutido), `Piquete`, `Pesagem` e `DashboardCorte`.
 *
 * Timeline (eventos) é Wave 2 — `listarEventos` bate em `/corte/lotes/:id/eventos`
 * (woven: pesagens + sanidade + nutrição + comercial, ordenado desc). Os
 * registradores de manejo/suplementação/operação comercial também são Wave 2.
 * Custo (`useCustoCorte`→`/corte/custo`) e IA (`perguntarIA`→`POST /corte/ia`)
 * são reais (Wave 3) — a economia do corte sai dos dados do próprio módulo.
 */

import { useEffect, useState, useCallback } from "react";
import type { Lote, ResumoLote, EventoTimeline, Piquete, Pesagem, ManejoSanitario, Suplementacao, OperacaoComercial } from "./types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init?.body ? { ...init, headers: { "content-type": "application/json", ...(init.headers || {}) } } : init);
  if (!res.ok) {
    const b: any = await res.json().catch(() => null);
    let msg = `HTTP ${res.status}`;
    if (typeof b?.error === "string") msg = b.error;                                   // erro do service (ex.: código duplicado)
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

// DTOs de entrada/escrita -------------------------------------------------

// Payload de criação/edição de lote — espelha o body aceito pelo backend.
// Campos opcionais vazios devem ser OMITIDOS (undefined), nunca enviados como
// null/"" — o Zod do backend rejeita strings vazias em enums e prefere ausência.
export interface LoteInput {
  codigo: string;
  nome: string;
  categoria: string;            // CategoriaLote (UPPERCASE)
  fase: string;                 // FaseCiclo (UPPERCASE)
  raca: string;                 // RacaCorte
  numCabecas: number;
  numCabecasEntrada: number;
  dataFormacao: string;         // YYYY-MM-DD
  origem?: string;
  piqueteAtual?: string;
  observacao?: string;
}

// Payload de baixa de lote — venda (VENDIDO) ou extinção (EXTINTO).
export interface BaixaInput {
  estado: "VENDIDO" | "EXTINTO";
  motivo?: string;
  data?: string;                // YYYY-MM-DD
}

// Payload de registro de pesagem — peso médio é o KPI central; o GMD é derivado.
export interface PesagemInput {
  data: string;                 // YYYY-MM-DD
  pesoMedio: number;            // kg/cabeça
  numCabecas: number;
  metodo: string;               // Pesagem["metodo"] (UPPERCASE)
  responsavel?: string;
  observacao?: string;
}

// Payload de manejo sanitário (vacina, vermífugo, controle de carrapato…).
// `tipo` é TipoSanitario (UPPERCASE). Opcionais vazios viram undefined.
export interface ManejoInput {
  data: string;                 // YYYY-MM-DD
  tipo: string;                 // TipoSanitario (UPPERCASE)
  numCabecas: number;
  produto?: string;
  doseMl?: number;
  responsavel?: string;
  carenciaDias?: number;        // próxima data permitida pra venda
  proximaDose?: string;         // YYYY-MM-DD da próxima aplicação
  observacao?: string;
}

// Payload de suplementação (mineral, proteico seca, ração confinamento…).
// `tipo` é TipoSuplemento (UPPERCASE). `produto`/`consumoCabecaDiaG` obrigatórios.
export interface SuplementacaoInput {
  dataInicio: string;           // YYYY-MM-DD
  tipo: string;                 // TipoSuplemento (UPPERCASE)
  produto: string;
  consumoCabecaDiaG: number;    // g/cab/dia
  dataFim?: string;             // YYYY-MM-DD
  custoKg?: number;
  observacao?: string;
}

// Payload de operação comercial (venda abate, compra, descarte…).
// `tipo` é TipoComercial (UPPERCASE). `loteId` opcional (pode ser parcial).
export interface OperacaoComercialInput {
  data: string;                 // YYYY-MM-DD
  tipo: string;                 // TipoComercial (UPPERCASE)
  numCabecas: number;
  pesoMedio: number;            // kg/cabeça
  loteId?: string;
  precoArroba?: number;
  comprador?: string;           // frigorífico, leiloeira
  observacao?: string;
}

// LISTAGENS / CRUD --------------------------------------------------------

export const listarLotes = (f?: { estado?: string; categoria?: string; q?: string }) =>
  // estado é repassado como veio (inclusive "TODOS"): o backend trata "TODOS"
  // como "sem filtro de estado". Cada lote já vem com `.resumo` embutido.
  req<Lote[]>(`/corte/lotes${qs(f)}`);
export const obterLote = (id: string) => req<Lote>(`/corte/lotes/${id}`);
// O detalhe do lote já vem com `.resumo` embutido — derivamos o resumo dele.
export const obterResumo = (id: string) => obterLote(id).then((l) => l.resumo ?? null);
export const listarPiquetes = () => req<Piquete[]>(`/corte/piquetes`);
// Timeline editorial — pesagens + sanidade + nutrição + comercial tecidos pelo
// backend e ordenados desc. O cockpit mostra empty-state quando vier vazio.
export const listarEventos = (loteId: string) =>
  req<EventoTimeline[]>(`/corte/lotes/${loteId}/eventos`);

export const criarLote = (input: LoteInput) =>
  req<Lote>(`/corte/lotes`, { method: "POST", body: JSON.stringify(input) });
export const editarLote = (id: string, input: Partial<LoteInput>) =>
  req<Lote>(`/corte/lotes/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const darBaixa = (id: string, input: BaixaInput) =>
  req<Lote>(`/corte/lotes/${id}/baixa`, { method: "POST", body: JSON.stringify(input) });

// Pesagens do lote
export const listarPesagens = (loteId: string) =>
  req<Pesagem[]>(`/corte/lotes/${loteId}/pesagens`);
export const criarPesagem = (loteId: string, input: PesagemInput) =>
  req<Pesagem>(`/corte/lotes/${loteId}/pesagens`, { method: "POST", body: JSON.stringify(input) });

// Eventos de manejo (sanidade / nutrição / comercial). O backend tece o evento
// de timeline a partir destes — depois de salvar, recarregar a tab + cockpit.
export const registrarManejoSanitario = (loteId: string, input: ManejoInput) =>
  req<ManejoSanitario>(`/corte/lotes/${loteId}/manejo-sanitario`, { method: "POST", body: JSON.stringify(input) });
export const registrarSuplementacao = (loteId: string, input: SuplementacaoInput) =>
  req<Suplementacao>(`/corte/lotes/${loteId}/suplementacao`, { method: "POST", body: JSON.stringify(input) });
// Operação comercial não é necessariamente do lote inteiro (venda parcial) — o
// loteId vai no corpo, não na rota.
export const registrarOperacaoComercial = (input: OperacaoComercialInput) =>
  req<OperacaoComercial>(`/corte/operacoes`, { method: "POST", body: JSON.stringify(input) });

// HOOKS -------------------------------------------------------------------

export function useLotes(f?: { estado?: string; categoria?: string; q?: string }) {
  const [data, setData] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(f ?? {});
  const recarregar = useCallback(() => {
    setLoading(true);
    listarLotes(f).then(setData).catch(() => setData([])).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, recarregar };
}

export function useLote(id: string | null) {
  const [data, setData] = useState<Lote | null>(null);
  const [resumo, setResumo] = useState<ResumoLote | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!id) { setData(null); setResumo(null); return; }
    setLoading(true);
    obterLote(id)
      .then((l) => { setData(l); setResumo(l?.resumo ?? null); })
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

export function usePiquetes() {
  const [data, setData] = useState<Piquete[]>([]);
  const recarregar = useCallback(() => { listarPiquetes().then(setData).catch(() => {}); }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, recarregar };
}

// DASHBOARD ---------------------------------------------------------------

export interface DashboardCorte {
  k: {
    totalCabecas: number;
    totalAtivos: number;
    uaTotal: number;
    arrobasEstoque: number;       // @ carcaça acumuladas no plantel
    arrobasProntas: number;        // @ disponíveis para venda imediata
    precoArrobaSpot: number;       // referência Cepea/Esalq MG
    precoArrobaSet: number;        // referência B3 setembro/2026
    valorEstoque: number;          // R$ estoque biológico estimado
    gmdMedio: number;              // kg/dia média dos lotes ativos com GMD > 0
  };
  dominios: { tab: string; titulo: string; linhas: string[] }[];
  alertas: { label: string; n: number; tom?: "up" | "bad"; tab: string }[];
}

export const obterDashboard = () => req<DashboardCorte>(`/corte/dashboard`);

export function useDashboard() {
  const [data, setData] = useState<DashboardCorte | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    obterDashboard().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);
  return { data, loading };
}

// CUSTO (P3 real — economia da própria Atividade Corte) -------------------

// A economia do corte vem dos dados do próprio módulo (não há um centro de
// custo financeiro dedicado: gado de corte é atividade nova). Por isso alguns
// campos monetários podem vir `null` quando ainda não há base suficiente —
// renderizamos "—" em vez de "R$ 0,00". A `nota` honesta vem do backend.
export interface CustoCorteData {
  custoArroba: number | null;
  custoHa: number | null;
  custeioTotal: number | null;
  arrobasProduzidas: number;
  periodoMeses: number;
  breakdown: { categoria: string; valor: number; pct: number }[];
  nota: string;
  // campos extras que o backend pode anexar — opcionais
  precoArrobaSpot?: number | null;
  margemArroba?: number | null;
}

export const obterCustoCorte = (meses = 12) =>
  req<CustoCorteData>(`/corte/custo${qs({ meses })}`);

export function useCustoCorte(meses = 12) {
  const [data, setData] = useState<CustoCorteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    setLoading(true); setErro(null);
    obterCustoCorte(meses)
      .then(setData)
      .catch((e) => { setErro(e.message); setData(null); })
      .finally(() => setLoading(false));
  }, [meses]);
  return { data, loading, erro };
}

// IA (P3 real — "Capão" lê o contexto dos lotes via backend) --------------

export interface RespostaIa { resposta: string; lista?: string[]; rodape?: string; modo?: "ia" | "demo"; }

// POST /corte/ia — sem ANTHROPIC_API_KEY o backend responde modo:"demo" sobre
// dados reais. O `<b>…</b>` é renderizado com segurança pelo parser `Enfase`.
export const perguntarIA = (pergunta: string) =>
  req<RespostaIa>(`/corte/ia`, { method: "POST", body: JSON.stringify({ pergunta }) });
