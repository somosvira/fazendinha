import type { ResumoLote, Lote, CategoriaLote } from "./types";
import { CATEGORIA_LABEL } from "./types";
import { pesagemVencida, gmdBaixo, vacinaPendente, vermifugoPendente, prontosParaAbate, lotacaoExcedida, mortalidadeAlta, todos } from "./lib/worklists";
import { arrobasCarcaca, GMD_ESPERADO } from "./lib/derive";
import { HOJE } from "./HOJE";

export interface Kpi { lab: string; val: string; sufixo?: string; d?: string; tom?: "up" | "ok"; }
export interface Coluna { nome: string; render: (r: ResumoLote, l?: Lote) => React.ReactNode; }
export interface WorkList { id: string; label: string; alerta?: boolean; selecionar: (rs: ResumoLote[], ls: Lote[]) => ResumoLote[]; }

export interface DomainConfig {
  titulo: string;
  eyebrow: string;
  kpis: (rs: ResumoLote[], ls: Lote[]) => Kpi[];
  worklists: WorkList[];
  colunas: Coluna[];
}

const pill = (txt: string, tom?: "warn" | "bad") =>
  <span className={"rb-pill" + (tom ? " " + tom : "")}>{txt}</span>;

// LOTE (visão geral) -----------------------------------------------------
export const lote: DomainConfig = {
  titulo: "Lote",
  eyebrow: "Corte · Rio Novo",
  kpis: (rs, ls) => {
    const total = ls.reduce((a, l) => a + l.numCabecas, 0);
    const matrizes = ls.filter((l) => l.categoria === "VACA_MATRIZ").reduce((a, l) => a + l.numCabecas, 0);
    const recria = ls.filter((l) => l.fase === "RECRIA").reduce((a, l) => a + l.numCabecas, 0);
    const terminacao = ls.filter((l) => l.fase === "TERMINACAO").reduce((a, l) => a + l.numCabecas, 0);
    return [
      { lab: "Cabeças total", val: String(total) },
      { lab: "Matrizes", val: String(matrizes), d: "produção" },
      { lab: "Recria", val: String(recria) },
      { lab: "Terminação", val: String(terminacao), d: "engorda" },
      { lab: "Lotes ativos", val: String(ls.length) },
    ];
  },
  worklists: [{ id: "todos", label: "Todos os lotes", selecionar: todos }],
  colunas: [
    { nome: "Categoria", render: (_r, l) => l ? pill(CATEGORIA_LABEL[l.categoria]) : "—" },
    { nome: "Cabeças", render: (_r, l) => l?.numCabecas ?? "—" },
    { nome: "Peso médio", render: (r) => r.pesoMedio ? `${r.pesoMedio} kg` : "—" },
    { nome: "GMD", render: (r) => r.gmd != null ? `${r.gmd.toFixed(2)} kg/d` : "—" },
    { nome: "Piquete", render: (_r, l) => l?.piqueteAtual ?? "—" },
  ],
};

// PESAGEM ---------------------------------------------------------------
export const pesagem: DomainConfig = {
  titulo: "Pesagem & ganho",
  eyebrow: "Corte · Rio Novo",
  kpis: (rs, ls) => {
    const lotesComGmd = rs.filter((r) => (r.gmd ?? 0) > 0);
    const gmdMedio = lotesComGmd.length
      ? lotesComGmd.reduce((a, r) => a + (r.gmd ?? 0), 0) / lotesComGmd.length
      : 0;
    const arrobasTot = ls.reduce((a, l) => {
      const r = rs.find((x) => x.loteId === l.id);
      return a + arrobasCarcaca(r?.pesoMedio ?? 0) * l.numCabecas;
    }, 0);
    return [
      { lab: "GMD médio", val: gmdMedio.toFixed(2), sufixo: "kg/d", d: "lotes ativos" },
      { lab: "Pesagem vencida", val: String(rs.filter((r) => (r.diasSemPesar ?? 0) > 60).length), d: "> 60 dias", tom: "up" },
      { lab: "GMD < 0,35", val: String(rs.filter((r) => (r.gmd ?? 0) > 0 && (r.gmd ?? 0) < 0.35).length), tom: "up" },
      { lab: "Estoque @", val: arrobasTot.toFixed(0), sufixo: "@" },
    ];
  },
  worklists: [
    { id: "vencidas", label: "Pesagem vencida (> 60d)", alerta: true, selecionar: (rs) => pesagemVencida(rs, HOJE) },
    { id: "gmd-baixo", label: "GMD < 0,35 kg/d", alerta: true, selecionar: gmdBaixo },
    { id: "todos", label: "Todos", selecionar: todos },
  ],
  colunas: [
    { nome: "Peso médio", render: (r) => r.pesoMedio ? `${r.pesoMedio} kg` : "—" },
    { nome: "GMD", render: (r, l) => {
      const esperado = l ? GMD_ESPERADO[l.categoria] : 0;
      const baixo = esperado > 0 && (r.gmd ?? 0) < esperado * 0.9;
      return <span style={baixo ? { color: "var(--prejuizo)" } : undefined}>{r.gmd != null ? `${r.gmd.toFixed(2)}` : "—"}</span>;
    }},
    { nome: "GMD esperado", render: (_r, l) => l ? GMD_ESPERADO[l.categoria].toFixed(2) : "—" },
    { nome: "Última pesagem", render: (r) => r.ultimaPesagem ? `${r.ultimaPesagem} (${r.diasSemPesar}d)` : "—" },
    { nome: "@ carcaça/cab", render: (r) => r.pesoMedio ? arrobasCarcaca(r.pesoMedio).toFixed(1) : "—" },
  ],
};

// SANIDADE --------------------------------------------------------------
export const sanidade: DomainConfig = {
  titulo: "Sanidade",
  eyebrow: "Corte · Rio Novo",
  kpis: (rs, ls) => {
    const mortAlta = mortalidadeAlta(rs).length;
    const vacPend = vacinaPendente(rs, HOJE).length;
    const aftosaN = ls.length; // todos precisam de aftosa
    return [
      { lab: "Pendentes", val: String(vacPend), tom: vacPend > 0 ? "up" : undefined },
      { lab: "Aftosa Nov", val: String(aftosaN), d: "todos os lotes" },
      { lab: "Mortalidade ≥ 8%", val: String(mortAlta), tom: mortAlta > 0 ? "up" : undefined },
    ];
  },
  worklists: [
    { id: "pendente", label: "Vacina vencendo / janela aberta", alerta: true, selecionar: (rs) => vacinaPendente(rs, HOJE) },
    { id: "vermif", label: "Vermifugação programada", selecionar: vermifugoPendente },
    { id: "mortalidade", label: "Mortalidade alta", alerta: true, selecionar: mortalidadeAlta },
    { id: "todos", label: "Todos", selecionar: todos },
  ],
  colunas: [
    { nome: "Próxima vacina", render: (r) => r.proximaVacina ?? "—" },
    { nome: "Próximo vermífugo", render: (r) => r.proximoVermifugo ?? "—" },
    { nome: "Último manejo", render: (r) => r.ultimoManejo ?? "—" },
    { nome: "Mortalidade", render: (r) => r.mortalidadeAcumulada != null ? `${r.mortalidadeAcumulada.toFixed(1)}%` : "—" },
  ],
};

// COMERCIAL -------------------------------------------------------------
export const comercial: DomainConfig = {
  titulo: "Comercial",
  eyebrow: "Corte · Rio Novo",
  kpis: (rs, ls) => {
    const prontos = ls.filter((l) => {
      const r = rs.find((x) => x.loteId === l.id);
      return (r?.pesoMedio ?? 0) >= 480;
    });
    const arrPron = prontos.reduce((a, l) => {
      const r = rs.find((x) => x.loteId === l.id);
      return a + arrobasCarcaca(r?.pesoMedio ?? 0) * l.numCabecas;
    }, 0);
    const PRECO_SPOT = 317;
    const PRECO_B3_SET = 347;
    return [
      { lab: "Prontos pra abate", val: String(prontos.length), d: "lotes", tom: prontos.length > 0 ? "ok" : undefined },
      { lab: "@ disponíveis", val: arrPron.toFixed(0), sufixo: "@" },
      { lab: "Spot MG", val: "R$ " + PRECO_SPOT, sufixo: "/@", d: "Cepea hoje" },
      { lab: "B3 set/2026", val: "R$ " + PRECO_B3_SET, sufixo: "/@", d: "contango +" + (PRECO_B3_SET - PRECO_SPOT) },
      { lab: "Receita potencial", val: "R$ " + (arrPron * PRECO_SPOT).toLocaleString("pt-BR", { maximumFractionDigits: 0 }), d: "vendendo hoje" },
    ];
  },
  worklists: [
    { id: "prontos", label: "Prontos pra abate", alerta: true, selecionar: prontosParaAbate },
    { id: "termin", label: "Em terminação", selecionar: (rs, ls) => {
      const ids = new Set(ls.filter((l) => l.fase === "TERMINACAO").map((l) => l.id));
      return rs.filter((r) => ids.has(r.loteId));
    } },
  ],
  colunas: [
    { nome: "Peso médio", render: (r) => r.pesoMedio ? `${r.pesoMedio} kg` : "—" },
    { nome: "@ carcaça/cab", render: (r) => r.pesoMedio ? arrobasCarcaca(r.pesoMedio).toFixed(1) : "—" },
    { nome: "@ total lote", render: (r, l) => l && r.pesoMedio ? (arrobasCarcaca(r.pesoMedio) * l.numCabecas).toFixed(0) : "—" },
    { nome: "Dias p/ alvo", render: (r) => r.diasParaAlvo != null ? `${r.diasParaAlvo}d` : "—" },
    { nome: "Próxima ação", render: (r) => r.proximaAcao ?? "—" },
  ],
};

// NUTRIÇÃO / PASTO -------------------------------------------------------
export const nutricao: DomainConfig = {
  titulo: "Nutrição & Pasto",
  eyebrow: "Corte · Rio Novo",
  kpis: (rs, ls) => {
    const uaTotal = ls.reduce((a, l) => {
      const r = rs.find((x) => x.loteId === l.id);
      return a + (((r?.pesoMedio ?? 0) * l.numCabecas) / 450);
    }, 0);
    const semaforos = lotacaoExcedida(rs, HOJE).length;
    return [
      { lab: "UA total", val: uaTotal.toFixed(1), d: "fazenda toda" },
      { lab: "Suplementação alerta", val: String(semaforos), tom: "up", d: "dias sem pesar + GMD baixo" },
    ];
  },
  worklists: [
    { id: "lotacao", label: "Pasto perdendo qualidade", alerta: true, selecionar: (rs) => lotacaoExcedida(rs, HOJE) },
    { id: "todos", label: "Todos", selecionar: todos },
  ],
  colunas: [
    { nome: "Piquete", render: (_r, l) => l?.piqueteAtual ?? "—" },
    { nome: "Peso médio", render: (r) => r.pesoMedio ? `${r.pesoMedio} kg` : "—" },
    { nome: "Cabeças", render: (_r, l) => l?.numCabecas ?? "—" },
    { nome: "UA", render: (r, l) => {
      const ua = ((r.pesoMedio ?? 0) * (l?.numCabecas ?? 0)) / 450;
      return ua ? ua.toFixed(1) : "—";
    }},
    { nome: "GMD atual", render: (r) => r.gmd != null ? `${r.gmd.toFixed(2)}` : "—" },
  ],
};

export const DOMAINS = { lote, pesagem, sanidade, comercial, nutricao } as const;

// Para a tela "Pasto" (que é mais dirigida a piquete que a lote), usamos
// uma view dedicada — não passa pelo DomainConfig.
export const CATEGORIAS_ORDEM: CategoriaLote[] = [
  "VACA_MATRIZ", "TOURO",
  "BEZERRO_MAMA", "BEZERRA_MAMA",
  "BEZERRO_DESMAMA", "BEZERRA_DESMAMA",
  "GAROTE", "NOVILHA", "NOVILHO",
  "BOI_GORDO", "VACA_DESCARTE",
];
