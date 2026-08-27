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
import { useQuery } from "@tanstack/react-query";
import type { Lote, ResumoLote, EventoTimeline, Piquete, Pesagem, Suplementacao, OperacaoComercial, IaInsight } from "./types";
import { req } from "../lib/offline/req";
import { useOfflineMutation, criarIdTemporario, type UseOfflineMutationConfig } from "../lib/offline/useOfflineMutation";

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

// Eventos de manejo (sanidade / nutrição / comercial). O backend tece o evento
// de timeline a partir destes — depois de salvar, recarregar a tab + cockpit.
export const registrarSuplementacao = (loteId: string, input: SuplementacaoInput) =>
  req<Suplementacao>(`/corte/lotes/${loteId}/suplementacao`, { method: "POST", body: JSON.stringify(input) });
// Operação comercial não é necessariamente do lote inteiro (venda parcial) — o
// loteId vai no corpo, não na rota.
export const registrarOperacaoComercial = (input: OperacaoComercialInput) =>
  req<OperacaoComercial>(`/corte/operacoes`, { method: "POST", body: JSON.stringify(input) });

// HOOKS -------------------------------------------------------------------

// Via useQuery (não useState+fetch direto) de propósito: é a leitura que
// alimenta os dropdowns de lote das telas de Pesagem/Sanidade, as únicas do
// módulo com suporte offline (TABS_OFFLINE em App.tsx) — precisa estar no
// queryClient pra ser persistida em IndexedDB (persister.ts) e sobreviver a
// um F5 offline (mesmo gap achado e corrigido em useFuncionarios/Ponto — ver
// OFFLINE_STRATEGY.md, "hooks de leitura em useQuery antes de qualquer
// escrita offline").

// Referências estáveis pro fallback de "sem dado ainda" — `query.data ?? []`
// direto criaria um array novo a cada render, o que travaria em loop
// infinito um consumidor que dependa disso num useEffect enquanto offline
// (a query fica pausada, nunca resolve) — mesmo achado do módulo Equipe.
const LOTES_VAZIO: Lote[] = [];
const EVENTOS_VAZIO: EventoTimeline[] = [];

// `as const` dá tupla literal — evita duas chamadas montarem "a mesma" key
// com formato diferente.
const corteKeys = {
  lotes: (f?: { estado?: string; categoria?: string; q?: string }) =>
    ["corte", "lotes", f?.estado ?? null, f?.categoria ?? null, f?.q ?? null] as const,
  // Prefixo curto, só pra invalidar TODAS as variações de useLotes(f) de uma
  // vez (invalidateQueries casa por prefixo) — a lista embute `.resumo` por
  // lote, que muda depois que a fila sincroniza uma pesagem/manejo.
  lotesTodos: () => ["corte", "lotes"] as const,
  lote: (id: string) => ["corte", "lote", id] as const,
  eventos: (loteId: string) => ["corte", "eventos", loteId] as const,
};

export function useLotes(f?: { estado?: string; categoria?: string; q?: string }) {
  const query = useQuery({
    queryKey: corteKeys.lotes(f),
    queryFn: () => listarLotes(f),
  });
  return {
    data: query.data ?? LOTES_VAZIO,
    loading: query.isPending,
    recarregar: query.refetch,
  };
}

export function useLote(id: string | null) {
  const query = useQuery({
    queryKey: corteKeys.lote(id ?? ""),
    queryFn: () => obterLote(id!),
    enabled: !!id,
  });
  const data = query.data ?? null;
  return {
    data,
    resumo: data?.resumo ?? null,
    loading: id ? query.isPending : false,
  };
}

export function useEventos(id: string | null) {
  const query = useQuery({
    queryKey: corteKeys.eventos(id ?? ""),
    queryFn: () => listarEventos(id!),
    enabled: !!id,
  });
  return {
    data: query.data ?? EVENTOS_VAZIO,
    loading: id ? query.isPending : false,
    recarregar: query.refetch,
  };
}

// ESCRITA OFFLINE (Pesagem / Sanidade) -------------------------------------
//
// Pesagem e manejo sanitário não têm lista própria renderizada em tela — só
// aparecem tecidos na Timeline (EventoTimeline, derivada no backend a partir
// das 4 tabelas de fato) e no ResumoLote agregado (pesoMedio/gmd/proximaVacina
// etc., recomputado no servidor). Por isso o design aqui é:
// - `queryKeys` (patch otimista de verdade) mira a própria Timeline do lote
//   (corteKeys.eventos) — o item otimista é um EventoTimeline "aproximado":
//   título/data/domínio certos, mas sem os campos que só o backend calcula
//   (GMD, impacto, alerta de carência) — mesma convenção de
//   "campos computados entram zerados, corrigem no refetch pós-sync" já usada
//   em useUpsertRegistro (equipe/api.ts).
// - `queryKeysRelacionadas` (só invalida) mira o ResumoLote — patch otimista
//   aí duplicaria a conta do servidor (não dá pra "adivinhar" o novo GMD).

// Títulos legíveis por tipo de manejo — espelha TITULO_SANITARIO em
// server/src/services/corte/timeline.ts, só pro item otimista ficar
// parecido com o que volta depois do sync (evita "flicker" de texto).
const TITULO_SANITARIO: Record<string, string> = {
  VACINA_AFTOSA: "Vacinação aftosa",
  VACINA_BRUCELOSE_B19: "Vacinação brucelose (B19)",
  VACINA_CLOSTRIDIOSE: "Vacinação clostridiose",
  VACINA_RAIVA: "Vacinação raiva",
  VACINA_CARBUNCULO: "Vacinação carbúnculo",
  VACINA_LEPTOSPIROSE: "Vacinação leptospirose",
  VACINA_IBR_BVD: "Vacinação IBR-BVD",
  VERMIFUGACAO_5811: "Vermifugação 5-8-11",
  VERMIFUGACAO_ESTRATEGICA: "Vermifugação estratégica",
  CONTROLE_CARRAPATO: "Controle de carrapato",
  CONTROLE_MOSCA: "Controle de mosca-dos-chifres",
  CONTROLE_BERNE: "Controle de berne",
  MARCACAO: "Marcação a ferro",
  DESCORNA: "Descorna",
  CASTRACAO: "Castração",
  BRINCO_ELETRONICO: "Identificação eletrônica (brinco)",
};

export interface PesagemOfflineInput extends PesagemInput {
  loteId: string;
}

const configRegistrarPesagem: UseOfflineMutationConfig<PesagemOfflineInput, EventoTimeline> = {
  mutationKey: "corte.registrar-pesagem",
  path: (input) => `/corte/lotes/${input.loteId}/pesagens`,
  method: "POST",
  body: ({ loteId, ...rest }) => rest,
  queryKeys: (input) => [corteKeys.eventos(input.loteId)],
  queryKeysRelacionadas: (input) => [corteKeys.lote(input.loteId), corteKeys.lotesTodos()],
  op: "create",
  match: () => false,
  criarOtimista: (input) => ({
    id: criarIdTemporario(),
    loteId: input.loteId,
    data: input.data,
    dominio: "pesagem",
    titulo: "Pesagem do lote",
    detalhe: `peso médio ${input.pesoMedio} kg`,
    responsavel: input.responsavel,
  }),
};

export function useRegistrarPesagem() {
  return useOfflineMutation(configRegistrarPesagem);
}

export interface ManejoOfflineInput extends ManejoInput {
  loteId: string;
}

const configRegistrarManejo: UseOfflineMutationConfig<ManejoOfflineInput, EventoTimeline> = {
  mutationKey: "corte.registrar-manejo",
  path: (input) => `/corte/lotes/${input.loteId}/manejo-sanitario`,
  method: "POST",
  body: ({ loteId, ...rest }) => rest,
  queryKeys: (input) => [corteKeys.eventos(input.loteId)],
  queryKeysRelacionadas: (input) => [corteKeys.lote(input.loteId), corteKeys.lotesTodos()],
  op: "create",
  match: () => false,
  criarOtimista: (input) => ({
    id: criarIdTemporario(),
    loteId: input.loteId,
    data: input.data,
    dominio: "sanidade",
    titulo: TITULO_SANITARIO[input.tipo] ?? "Manejo sanitário",
    detalhe: [`${input.numCabecas} cabeças`, input.produto].filter(Boolean).join(" · "),
    responsavel: input.responsavel,
  }),
};

export function useRegistrarManejo() {
  return useOfflineMutation(configRegistrarManejo);
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

// Insights proativos da IA ("insights da semana") — cards reais do corte.
export const listarInsights = () => req<IaInsight[]>(`/corte/ia/insights`);
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
