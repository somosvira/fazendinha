/* Camada de leitura do módulo Plantio.
 *
 * Em produção, cada `useXxx()` baterá em `/api/plantio/*` — exatamente como
 * o módulo Rebanho faz hoje. Durante o protótipo, a camada serve direto dos
 * mocks (`./mock/*`) usando Promise.resolve, preservando o pattern dos hooks
 * (estado loading/erro, recarregar). Para conectar ao backend basta trocar a
 * implementação de cada `listar*` por um fetch — os hooks não mudam.
 */

import { useEffect, useState, useCallback } from "react";
import type { Talhao, ResumoTalhao, EventoTimeline, Lavoura, PlanoAdubacao, FaseFenologica } from "./types";
import { talhoes as mockTalhoes, resumos as mockResumos, eventos as mockEventos, lavouras as mockLavouras, planosAdubacao as mockPlanos } from "./mock";
import { HOJE } from "./HOJE";

const DELAY = 80; // simula latência de rede pequena para evitar flicker

function fake<T>(v: T): Promise<T> {
  return new Promise((res) => setTimeout(() => res(v), DELAY));
}

// LISTAGENS ---------------------------------------------------------------

export const listarTalhoes = (f?: { estado?: string; lavoura?: string; q?: string }) => {
  let arr = mockTalhoes;
  if (f?.estado && f.estado !== "TODOS") arr = arr.filter((t) => t.estado === f.estado);
  if (f?.lavoura) arr = arr.filter((t) => t.lavoura === f.lavoura);
  if (f?.q) {
    const q = f.q.toLowerCase();
    arr = arr.filter((t) => t.codigo.toLowerCase().includes(q) || t.nome.toLowerCase().includes(q));
  }
  return fake(arr);
};

export const obterTalhao = (id: string) => fake(mockTalhoes.find((t) => t.id === id) ?? null);
export const obterResumo = (id: string) => fake(mockResumos.find((r) => r.talhaoId === id) ?? null);
export const listarEventos = (talhaoId: string) =>
  fake(mockEventos.filter((e) => e.talhaoId === talhaoId).sort((a, b) => b.data.localeCompare(a.data)));
export const listarLavouras = () => fake(mockLavouras);
export const listarPlanos = () => fake(mockPlanos);

// HOOKS -------------------------------------------------------------------

export function useTalhoes(f?: { estado?: string; lavoura?: string; q?: string }) {
  const [data, setData] = useState<Talhao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const key = JSON.stringify(f ?? {});
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    listarTalhoes(f).then(setData).catch((e) => setErro(String(e))).finally(() => setLoading(false));
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
    Promise.all([obterTalhao(id), obterResumo(id)]).then(([t, r]) => { setData(t); setResumo(r); }).finally(() => setLoading(false));
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

export function useLavouras() {
  const [data, setData] = useState<Lavoura[]>([]);
  const [loading, setLoading] = useState(true);
  const recarregar = useCallback(() => {
    setLoading(true);
    listarLavouras().then(setData).finally(() => setLoading(false));
  }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, recarregar };
}

export function usePlanosAdubacao() {
  const [data, setData] = useState<PlanoAdubacao[]>([]);
  const recarregar = useCallback(() => { listarPlanos().then(setData); }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, recarregar };
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
    Promise.all([listarTalhoes(), Promise.resolve(mockResumos)]).then(([ts, rs]) => {
      const ativos = ts.filter((t) => t.estado === "ATIVO");
      const areaTotal = ts.reduce((a, t) => a + t.areaHa, 0);
      const sacasEsperadas = ts.reduce((a, t) => {
        const r = rs.find((x) => x.talhaoId === t.id);
        return a + (r?.produtividadeEsperada ?? 0) * t.areaHa;
      }, 0);
      const jaColhidas = mockEventos
        .filter((e) => e.dominio === "colheita" && e.data >= "2026-05-01")
        .reduce((a, e) => a + estimarSacasEvento(e), 0);
      const emProducao = ativos.filter((t) => (rs.find((x) => x.talhaoId === t.id)?.produtividadeEsperada ?? 0) > 0);
      const prodMedia = emProducao.length
        ? emProducao.reduce((a, t) => a + (rs.find((x) => x.talhaoId === t.id)?.produtividadeEsperada ?? 0), 0) / emProducao.length
        : 0;
      const variedades = new Set(ts.map((t) => t.variedade)).size;
      const alertaFito = rs.filter((r) => (r.ferrugem ?? 0) >= 5 || (r.broca ?? 0) >= 3).length;
      const fases = rs.map((r) => r.fase);
      const fase = moda(fases) as FaseFenologica;

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
    }).finally(() => setLoading(false));
  }, []);
  return { data, loading };
}

// Tela Custo Produção -----------------------------------------------------

export interface CustoPlantioData {
  custoSaca: number;
  custoHa: number;
  custeioTotal: number;
  sacasPeriodo: number;
  periodoMeses: number;
  breakdown: { categoria: string; valor: number; pct: number }[];
  nota: string;
}

export function useCustoPlantio() {
  const [data, setData] = useState<CustoPlantioData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setTimeout(() => {
      // valores realistas para fazenda Sul de Minas — Conab/Cepea, safra 2025/26.
      // Custo total aproximado: R$ 22-26 mil/ha em produção média.
      const custeio = 1_640_000; // total 12 meses fazenda toda (≈ 60 ha)
      const sacas = 2_100;
      const areaProd = 56.3;
      const breakdown = [
        { categoria: "Mão de obra (colheita + tratos)", valor: 540_000 },
        { categoria: "Fertilizantes",                    valor: 410_000 },
        { categoria: "Defensivos (fungicida + insetic.)", valor: 165_000 },
        { categoria: "Combustível e mecanização",        valor: 132_000 },
        { categoria: "Calcário, gesso e corretivos",     valor:  72_000 },
        { categoria: "Pós-colheita (terreiro/benefício)", valor: 154_000 },
        { categoria: "Manutenção (equipamentos)",        valor:  86_000 },
        { categoria: "Energia e irrigação",              valor:  41_000 },
        { categoria: "Outros (frete, embalagem, ARTs)",  valor:  40_000 },
      ].map((l) => ({ ...l, pct: (l.valor / custeio) * 100 }));
      setData({
        custoSaca: custeio / sacas,
        custoHa: custeio / areaProd,
        custeioTotal: custeio,
        sacasPeriodo: sacas,
        periodoMeses: 12,
        breakdown,
        nota: "Estimativa baseada nos lançamentos da Atividade Café nos últimos 12 meses, com benefício projetado em 30 sc/ha sobre os talhões em produção. Quando a colheita 2026 fechar, esses valores são recalculados sobre o realizado.",
      });
      setLoading(false);
    }, DELAY);
  }, []);
  return { data, loading };
}

// IA ----------------------------------------------------------------------

export interface RespostaIa { resposta: string; lista?: string[]; rodape?: string; modo?: "ia" | "demo"; }

export function perguntarIA(pergunta: string): Promise<RespostaIa> {
  const p = pergunta.toLowerCase();
  if (p.includes("ferrugem")) {
    return fake({
      resposta: "Hoje há <b>4 talhões com ferrugem ≥ 5%</b> — todos de Catuaí. A tendência nos últimos 30 dias é de subida.",
      lista: ["Cafundó alto · setor 2 (CAF-02) — 11%, subindo", "Cafundó alto · setor 3 (CAF-03) — 13%, subindo", "Mata da Capela alto (CAP-01) — 14%, subindo", "Mata da Capela meio (CAP-02) — 16%, subindo"],
      rodape: "Os Acauã/Arara/Icatu seguem abaixo de 3% pela resistência genética.",
      modo: "demo",
    });
  }
  if (p.includes("colheita") || p.includes("colher")) {
    return fake({
      resposta: "Você tem <b>6 talhões prontos pra entrar</b> agora (cereja ≥ 60%) e 3 em derriça ativa.",
      lista: ["CAF-01 — 71% cereja · iniciar 02/jun", "CAF-02 — 68% cereja · iniciar 04/jun", "SEC-01 (Acauã) — 76% cereja · pronto", "CAP-01 (Bourbon) — 64% cereja"],
      rodape: "Sugestão: mecanizada no Tijuco primeiro, libera o pano pra Mata da Capela.",
      modo: "demo",
    });
  }
  if (p.includes("custo")) {
    return fake({
      resposta: "O custo médio acumulado nos últimos 12 meses está em ~<b>R$ 780/saca</b> — abaixo do break-even atual (~R$ 1.300/saca no Cepea).",
      rodape: "Maior peso: mão de obra (33%) e fertilizantes (25%).",
      modo: "demo",
    });
  }
  if (p.includes("adub")) {
    return fake({
      resposta: "Hoje há <b>5 talhões com análise foliar vencida</b> (>120 dias). 3 deles mostram K abaixo do ideal no histórico — recomendo nova coleta antes da próxima parcela.",
      modo: "demo",
    });
  }
  return fake({
    resposta: "Posso responder sobre <b>fenologia, fitossanidade, nutrição, colheita e custo da lavoura</b>. Tente uma das sugestões acima ou pergunte sobre um talhão específico.",
    modo: "demo",
  });
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
function estimarSacasEvento(e: EventoTimeline): number {
  // o impacto vem como "≈ 38 sc beneficiadas"
  const m = e.impacto?.match(/(\d+(?:[\.,]\d+)?)\s*sc/);
  return m ? Number(m[1].replace(",", ".")) : 0;
}
