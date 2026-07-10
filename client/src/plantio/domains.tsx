import type { ResumoTalhao } from "./types";
import {
  comFerrugemAlta, comBichoMineiroAlto, comBrocaAlta, comCercosporioseAlta, inspecaoVencida,
  pHBaixo, vBaixo, potassioBaixo, foliarVencida, soloVencida,
  prontosParaColher, emColheita, emFloradaOuPegamento, emGranacao,
  todos,
} from "./lib/worklists";
import { FASES_LABEL } from "./lib/fenologia";
import { HOJE } from "./HOJE";
import { RebPill } from "@/components/rb/RebPrimitives";

export interface Kpi { lab: string; val: string; sufixo?: string; d?: string; tom?: "up" | "ok"; }
export interface Coluna { nome: string; render: (r: ResumoTalhao) => React.ReactNode; }
export interface WorkList { id: string; label: string; alerta?: boolean; selecionar: (rs: ResumoTalhao[]) => ResumoTalhao[]; }

export interface DomainConfig {
  titulo: string;
  eyebrow: string;
  kpis: (rs: ResumoTalhao[]) => Kpi[];
  worklists: WorkList[];
  colunas: Coluna[];
}

const pill = (txt: string, tom?: "warn" | "bad") =>
  <RebPill tone={tom}>{txt}</RebPill>;

const pct = (n: number | undefined) => n != null ? `${n.toFixed(1)}%` : "—";
const pctInt = (n: number | undefined) => n != null ? `${Math.round(n)}%` : "—";

// FENOLOGIA ---------------------------------------------------------------
export const fenologia: DomainConfig = {
  titulo: "Fenologia",
  eyebrow: "Lavoura · Rio Novo",
  kpis: (rs) => {
    const counts = rs.reduce((acc, r) => { acc[r.fase] = (acc[r.fase] ?? 0) + 1; return acc; }, {} as Record<string, number>);
    const cereja = (counts["MATURACAO_CEREJA"] ?? 0);
    const colhendo = (counts["COLHEITA"] ?? 0);
    const formacao = (counts["REPOUSO"] ?? 0);
    const granacao = (counts["GRANACAO"] ?? 0) + (counts["EXPANSAO"] ?? 0);
    const cerejaPct = rs.length ? Math.round((cereja + colhendo) / rs.length * 100) : 0;
    return [
      { lab: "Em colheita", val: String(colhendo), d: "derriça ativa" },
      { lab: "Pronto a colher", val: String(cereja), d: "cereja ≥ 60%" },
      { lab: "Granação / expansão", val: String(granacao) },
      { lab: "Em repouso", val: String(formacao), d: "pós-colh / formação" },
      { lab: "Maturação", val: String(cerejaPct), sufixo: "%", d: "talhões maduros / colhendo" },
    ];
  },
  worklists: [
    { id: "colher", label: "Prontos pra colher (cereja ≥ 60%)", selecionar: prontosParaColher },
    { id: "colhendo", label: "Em colheita", selecionar: emColheita },
    { id: "granacao", label: "Em granação", selecionar: emGranacao },
    { id: "florada", label: "Florada / pegamento", selecionar: emFloradaOuPegamento },
    { id: "todos", label: "Todos", selecionar: todos },
  ],
  colunas: [
    { nome: "Fase", render: (r) => pill(FASES_LABEL[r.fase]) },
    { nome: "Cereja", render: (r) => pctInt(r.maturacaoCereja) },
    { nome: "Verde", render: (r) => pctInt(r.maturacaoVerde) },
    { nome: "Boia/passa", render: (r) => pctInt(r.maturacaoBoia) },
    { nome: "Próxima operação", render: (r) => r.proximaOperacao ?? "—" },
  ],
};

// FITOSSANIDADE ----------------------------------------------------------
export const fitossanidade: DomainConfig = {
  titulo: "Fitossanidade",
  eyebrow: "Lavoura · Rio Novo",
  kpis: (rs) => {
    const ferr = rs.filter((r) => (r.ferrugem ?? 0) >= 5).length;
    const ferrSub = rs.filter((r) => r.tendFerrugem === "subindo").length;
    const broca = rs.filter((r) => (r.broca ?? 0) >= 3).length;
    const mineiro = rs.filter((r) => (r.bichoMineiro ?? 0) >= 20).length;
    const ferrMedia = rs.length ? Math.round(rs.reduce((a, r) => a + (r.ferrugem ?? 0), 0) / rs.length) : 0;
    return [
      { lab: "Ferrugem ≥ 5%", val: String(ferr), tom: ferr > 0 ? "up" : undefined, d: "limiar MIP" },
      { lab: "Ferrugem subindo", val: String(ferrSub), tom: ferrSub > 0 ? "up" : undefined },
      { lab: "Bicho-mineiro alto", val: String(mineiro), d: "≥ 20% folhas" },
      { lab: "Broca ≥ 3%", val: String(broca), tom: broca > 0 ? "up" : undefined },
      { lab: "Ferrugem média", val: String(ferrMedia), sufixo: "%" },
    ];
  },
  worklists: [
    { id: "ferrugem", label: "Ferrugem ≥ 5%", alerta: true, selecionar: comFerrugemAlta },
    { id: "broca", label: "Broca ≥ 3%", alerta: true, selecionar: comBrocaAlta },
    { id: "mineiro", label: "Bicho-mineiro ≥ 20%", selecionar: comBichoMineiroAlto },
    { id: "cerco", label: "Cercosporiose ≥ 5%", selecionar: comCercosporioseAlta },
    { id: "vencidas", label: "Inspeção > 30d", selecionar: (rs) => inspecaoVencida(rs, HOJE) },
  ],
  colunas: [
    { nome: "Ferrugem", render: (r) => <span style={{ color: (r.ferrugem ?? 0) >= 5 ? "var(--prejuizo)" : undefined }}>{pct(r.ferrugem)}</span> },
    { nome: "Bicho-min.", render: (r) => pct(r.bichoMineiro) },
    { nome: "Broca", render: (r) => <span style={{ color: (r.broca ?? 0) >= 3 ? "var(--prejuizo)" : undefined }}>{pct(r.broca)}</span> },
    { nome: "Cerco.", render: (r) => pct(r.cercosporiose) },
    { nome: "Última inspeção", render: (r) => r.ultimaInspecaoData ?? "—" },
  ],
};

// NUTRIÇÃO ---------------------------------------------------------------
export const nutricao: DomainConfig = {
  titulo: "Nutrição & Solo",
  eyebrow: "Lavoura · Rio Novo",
  kpis: (rs) => {
    const phBaixo = rs.filter((r) => (r.pH ?? 7) < 5.2).length;
    const vBx = rs.filter((r) => (r.v ?? 100) < 50).length;
    const kBaixo = rs.filter((r) => (r.potassio ?? 999) < 80).length;
    const soloOk = rs.filter((r) => r.ultimaAnaliseSolo).length;
    return [
      { lab: "pH < 5,2", val: String(phBaixo), tom: phBaixo > 0 ? "up" : undefined, d: "necessita calagem" },
      { lab: "V% < 50", val: String(vBx), tom: vBx > 0 ? "up" : undefined },
      { lab: "K baixo", val: String(kBaixo), d: "< 80 mg/dm³" },
      { lab: "Com solo recente", val: `${soloOk}/${rs.length}` },
    ];
  },
  worklists: [
    { id: "ph", label: "pH baixo (< 5,2)", alerta: true, selecionar: pHBaixo },
    { id: "v", label: "V% baixo (< 50%)", alerta: true, selecionar: vBaixo },
    { id: "k", label: "K baixo", selecionar: potassioBaixo },
    { id: "foliar", label: "Foliar vencida (> 120d)", selecionar: (rs) => foliarVencida(rs, HOJE) },
    { id: "solo", label: "Solo vencido (> 1 ano)", selecionar: (rs) => soloVencida(rs, HOJE) },
  ],
  colunas: [
    { nome: "pH", render: (r) => r.pH != null ? r.pH.toFixed(1) : "—" },
    { nome: "V%", render: (r) => r.v ?? "—" },
    { nome: "P (mg/dm³)", render: (r) => r.fosforo ?? "—" },
    { nome: "K (mg/dm³)", render: (r) => r.potassio ?? "—" },
    { nome: "Último foliar", render: (r) => r.ultimaAnaliseFoliar ?? "—" },
  ],
};

// TALHÃO (visão geral, espelho do "animal") ------------------------------
export const talhao: DomainConfig = {
  titulo: "Talhão",
  eyebrow: "Lavoura · Rio Novo",
  kpis: (rs) => {
    const totalSc = rs.reduce((a, r) => a + (r.produtividadeEsperada ?? 0), 0);
    return [
      { lab: "Talhões", val: String(rs.length) },
      { lab: "Em produção", val: String(rs.filter((r) => (r.produtividadeEsperada ?? 0) > 0).length) },
      { lab: "Em formação/recepa", val: String(rs.filter((r) => (r.produtividadeEsperada ?? 0) === 0).length) },
      { lab: "Sc/ha médio", val: String(Math.round(totalSc / Math.max(1, rs.filter((r) => (r.produtividadeEsperada ?? 0) > 0).length))) },
    ];
  },
  worklists: [{ id: "todos", label: "Todos os talhões", selecionar: todos }],
  colunas: [
    { nome: "Fase", render: (r) => pill(FASES_LABEL[r.fase]) },
    { nome: "Produtividade", render: (r) => r.produtividadeEsperada ? `${r.produtividadeEsperada} sc/ha` : "—" },
    { nome: "Cereja", render: (r) => pctInt(r.maturacaoCereja) },
    { nome: "Ferrugem", render: (r) => pct(r.ferrugem) },
  ],
};

export const DOMAINS = { talhao, fenologia, fitossanidade, nutricao } as const;
