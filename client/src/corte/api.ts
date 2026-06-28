/* Camada de leitura do módulo Corte.
 * Mesma estratégia do plantio: mocks via Promise.resolve com latência baixa,
 * trocáveis por fetch quando o backend for plugado.
 */

import { useEffect, useState, useCallback } from "react";
import type { Lote, ResumoLote, EventoTimeline, Piquete, IaInsight } from "./types";
import { lotes as mockLotes, resumos as mockResumos, piquetes as mockPiquetes, eventos as mockEventos } from "./mock";
import { HOJE } from "./HOJE";
import { toUA, arrobasCarcaca, mortalidadeAcumulada } from "./lib/derive";

const DELAY = 80;
function fake<T>(v: T): Promise<T> {
  return new Promise((res) => setTimeout(() => res(v), DELAY));
}

// LISTAGENS ---------------------------------------------------------------

export const listarLotes = (f?: { estado?: string; categoria?: string; q?: string }) => {
  let arr = mockLotes;
  if (f?.estado && f.estado !== "TODOS") arr = arr.filter((l) => l.estado === f.estado);
  if (f?.categoria) arr = arr.filter((l) => l.categoria === f.categoria);
  if (f?.q) {
    const q = f.q.toLowerCase();
    arr = arr.filter((l) => l.codigo.toLowerCase().includes(q) || l.nome.toLowerCase().includes(q));
  }
  // Anexa o resumo a cada lote — backend real deve fazer o mesmo.
  return fake(arr.map((l) => ({ ...l, resumo: mockResumos.find((r) => r.loteId === l.id) ?? null })));
};

export const obterLote = (id: string) => fake(mockLotes.find((l) => l.id === id) ?? null);
export const obterResumo = (id: string) => fake(mockResumos.find((r) => r.loteId === id) ?? null);
export const listarEventos = (loteId: string) =>
  fake(mockEventos.filter((e) => e.loteId === loteId).sort((a, b) => b.data.localeCompare(a.data)));
export const listarPiquetes = () => fake(mockPiquetes);

// HOOKS -------------------------------------------------------------------

export function useLotes(f?: { estado?: string; categoria?: string; q?: string }) {
  const [data, setData] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(f ?? {});
  const recarregar = useCallback(() => {
    setLoading(true);
    listarLotes(f).then(setData).finally(() => setLoading(false));
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
    Promise.all([obterLote(id), obterResumo(id)]).then(([l, r]) => { setData(l); setResumo(r); }).finally(() => setLoading(false));
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
  const recarregar = useCallback(() => { listarPiquetes().then(setData); }, []);
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

export function useDashboard() {
  const [data, setData] = useState<DashboardCorte | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setTimeout(() => {
      const ativos = mockLotes.filter((l) => l.estado === "ATIVO");
      const totalCabecas = ativos.reduce((a, l) => a + l.numCabecas, 0);
      const uaTotal = ativos.reduce((a, l) => {
        const r = mockResumos.find((x) => x.loteId === l.id);
        return a + toUA(r?.pesoMedio ?? 0, l.numCabecas);
      }, 0);
      const arrobasEstoque = ativos.reduce((a, l) => {
        const r = mockResumos.find((x) => x.loteId === l.id);
        return a + arrobasCarcaca(r?.pesoMedio ?? 0) * l.numCabecas;
      }, 0);
      const arrobasProntas = ativos.filter((l) => {
        const r = mockResumos.find((x) => x.loteId === l.id);
        return (r?.pesoMedio ?? 0) >= 480;
      }).reduce((a, l) => {
        const r = mockResumos.find((x) => x.loteId === l.id);
        return a + arrobasCarcaca(r?.pesoMedio ?? 0) * l.numCabecas;
      }, 0);
      // Preços de referência (Cepea/B3 junho/2026 — Sul de MG arroba spot ≈ R$ 317, B3 set ≈ 347)
      const precoArrobaSpot = 317;
      const precoArrobaSet = 347;
      const valorEstoque = arrobasEstoque * precoArrobaSpot;
      const lotesComGmd = ativos.filter((l) => {
        const r = mockResumos.find((x) => x.loteId === l.id);
        return (r?.gmd ?? 0) > 0;
      });
      const gmdMedio = lotesComGmd.length
        ? lotesComGmd.reduce((a, l) => {
            const r = mockResumos.find((x) => x.loteId === l.id);
            return a + (r?.gmd ?? 0);
          }, 0) / lotesComGmd.length
        : 0;

      const gmdBaixoN = mockResumos.filter((r) => (r.gmd ?? 0) > 0 && (r.gmd ?? 0) < 0.35).length;
      const pesagemVencidaN = mockResumos.filter((r) => (r.diasSemPesar ?? 0) > 60).length;
      const mortAltaN = ativos.filter((l) => mortalidadeAcumulada(l) >= 8).length;
      const prontosN = ativos.filter((l) => {
        const r = mockResumos.find((x) => x.loteId === l.id);
        return (r?.pesoMedio ?? 0) >= 480;
      }).length;

      void HOJE;
      setData({
        k: {
          totalCabecas,
          totalAtivos: ativos.length,
          uaTotal: round1(uaTotal),
          arrobasEstoque: round1(arrobasEstoque),
          arrobasProntas: round1(arrobasProntas),
          precoArrobaSpot, precoArrobaSet,
          valorEstoque: Math.round(valorEstoque),
          gmdMedio: round2(gmdMedio),
        },
        dominios: [
          { tab: "cor-pesagem", titulo: "Pesagem & ganho", linhas: [
            `${ativos.length} lotes ativos · ${totalCabecas} cabeças`,
            `GMD médio ${round2(gmdMedio)} kg/dia`,
            `${gmdBaixoN} lotes com GMD < 0,35 kg/dia (atenção)`,
          ]},
          { tab: "cor-sanidade", titulo: "Sanidade", linhas: [
            `Próxima aftosa: nov/2026 (etapa 2)`,
            `${mockResumos.filter((r) => /vencendo|janela|antes/i.test(r.proximaVacina ?? "")).length} ações sanitárias vencendo`,
          ]},
          { tab: "cor-comercial", titulo: "Comercial", linhas: [
            `${prontosN} lotes prontos pra abate (${round1(arrobasProntas)} @)`,
            `@ spot R$ ${precoArrobaSpot} · B3 set R$ ${precoArrobaSet}`,
            `Janela contango favorece atrasar até setembro`,
          ]},
          { tab: "cor-pasto", titulo: "Pasto & piquetes", linhas: [
            `${mockPiquetes.filter((p) => p.estado === "OCUPADO").length} piquetes ocupados`,
            `${mockPiquetes.filter((p) => p.estado === "DESCANSO").length} em descanso`,
            `${round1(uaTotal)} UA / ${mockPiquetes.filter((p) => p.estado === "OCUPADO").reduce((a, p) => a + p.areaHa, 0)} ha em uso`,
          ]},
        ],
        alertas: [
          { label: "Lotes prontos pra abate", n: prontosN, tom: undefined, tab: "cor-comercial" },
          { label: "GMD abaixo do esperado", n: gmdBaixoN, tom: "up", tab: "cor-pesagem" },
          { label: "Pesagem vencida (> 60d)", n: pesagemVencidaN, tom: "bad", tab: "cor-pesagem" },
          { label: "Mortalidade ≥ 8%", n: mortAltaN, tom: "up", tab: "cor-sanidade" },
        ],
      });
      setLoading(false);
    }, DELAY);
  }, []);
  return { data, loading };
}

// CUSTO -------------------------------------------------------------------

export interface CustoCorteData {
  custoArroba: number;
  custoHa: number;
  custeioTotal: number;
  arrobasProduzidas: number;
  periodoMeses: number;
  breakdown: { categoria: string; valor: number; pct: number }[];
  nota: string;
}

export function useCustoCorte() {
  const [data, setData] = useState<CustoCorteData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setTimeout(() => {
      // Cenário Sul de Minas, 180 cabeças, sistema cria-recria-terminação extensivo
      // + 90 dias de confinamento alto-grão na terminação F1.
      const custeio = 420_000;     // 12 meses fazenda Corte
      const arrobas = 2_140;       // @ produzidas + abertura de estoque biológico
      const breakdown = [
        { categoria: "Suplementação mineral / proteinado", valor: 96_000 },
        { categoria: "Ração confinamento (alto-grão)",     valor: 84_000 },
        { categoria: "Reposição (compra de animais)",       valor:  0 },
        { categoria: "Mão de obra (vaqueiro + apartação)",  valor: 78_000 },
        { categoria: "Sanidade (vacinas + vermífugos)",     valor: 24_500 },
        { categoria: "Reforma de pasto + adubação",         valor: 56_000 },
        { categoria: "Combustível / mecanização",           valor: 28_400 },
        { categoria: "Manutenção (cercas, currais)",        valor: 26_700 },
        { categoria: "Energia + outros",                    valor: 26_400 },
      ].map((l) => ({ ...l, pct: (l.valor / custeio) * 100 }));
      setData({
        custoArroba: custeio / arrobas,
        custoHa: custeio / 90,
        custeioTotal: custeio,
        arrobasProduzidas: arrobas,
        periodoMeses: 12,
        breakdown,
        nota: "Estimativa sobre os lançamentos da Atividade Corte nos últimos 12 meses, com produção de @ projetada incluindo o estoque biológico em ganho. À medida que vendas reais entram, o cálculo migra para realizado.",
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
  if (p.includes("prontos") || p.includes("vender") || p.includes("abate")) {
    return fake({
      resposta: "Há <b>2 lotes prontos para venda</b>: TER-02 (14 bois, peso médio 502 kg) e o de descarte DES-01 (6 vacas, 458 kg).",
      lista: [
        "TER-02 — 14 cabeças · 17,4 @ · ≈ R$ 81.600 (spot) ou R$ 84.500 (B3 set)",
        "DES-01 — 6 vacas · 15,3 @ · vaca gorda · ≈ R$ 27.600",
        "TER-01 (F1 Angus×Nelore) — chega em ~45 dias",
      ],
      rodape: "B3 contango sugere atrasar TER-02 para setembro: ganho de R$ 2,9 mil sobre 14 cabeças.",
      modo: "demo",
    });
  }
  if (p.includes("gmd") || p.includes("ganho")) {
    return fake({
      resposta: "GMD médio dos lotes ativos hoje é <b>0,55 kg/dia</b>, puxado pelo confinamento (TER-01 a 1,42). Lotes em pasto puro estão entre 0,35-0,65 — abaixo da meta Embrapa em 2 deles.",
      lista: ["RDM-01 (recria machos) — 0,38 kg/d — antecipar proteico seca", "TER-02 (boi gordo) — 0,42 kg/d — normal (idade)"],
      modo: "demo",
    });
  }
  if (p.includes("vacin") || p.includes("aftosa") || p.includes("vermif")) {
    return fake({
      resposta: "Próxima ação obrigatória: <b>vacinação aftosa etapa 2 em novembro/2026</b>. Antes disso, em julho, fechar a janela B19 das bezerras (BMM-02).",
      modo: "demo",
    });
  }
  if (p.includes("pasto") || p.includes("piquete") || p.includes("lotação")) {
    return fake({
      resposta: "Lotação atual: <b>~1,4 UA/ha</b> nos piquetes ocupados — dentro da capacidade técnica. PQ-04 (Mata Grande) recebe matrizes + cria juntos: 0,73 UA/ha, ok. Em descanso há 1 piquete (PQ-09, 59 dias).",
      modo: "demo",
    });
  }
  return fake({
    resposta: "Posso responder sobre <b>pesagem/GMD, sanidade, pasto/piquetes, comercial (venda/preço), custo</b>. Tente uma das sugestões acima.",
    modo: "demo",
  });
}

// HELPERS -----------------------------------------------------------------
function round1(n: number) { return Math.round(n * 10) / 10; }
function round2(n: number) { return Math.round(n * 100) / 100; }
