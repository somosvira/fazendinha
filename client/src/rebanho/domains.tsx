import type { ResumoAnimal } from "./types";
import { aInseminar, dgPendente, aSecar, partosPrevistos, aDesmamar, type CriterioDesmame } from "./lib/worklists";
import { HOJE } from "./HOJE";
import { RebPill } from "@/components/rb/RebPrimitives";

const fmtData = (iso?: string | null) => iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("pt-BR") : "—";
const diasDesde = (iso?: string | null) => {
  if (!iso) return "—";
  const inicio = new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime();
  const hoje = new Date(`${HOJE}T00:00:00Z`).getTime();
  return Math.max(0, Math.floor((hoje - inicio) / 86_400_000));
};

export interface Kpi { lab: string; val: string; sufixo?: string; d?: string; tom?: "up" | "ok"; }
export interface Coluna { nome: string; render: (r: ResumoAnimal) => React.ReactNode; }
export interface WorkList { id: string; label: string; alerta?: boolean; selecionar: (rs: ResumoAnimal[]) => ResumoAnimal[]; }

export interface DomainConfig {
  titulo: string;
  eyebrow: string;
  kpis: (rs: ResumoAnimal[]) => Kpi[];
  worklists: WorkList[];
  colunas: Coluna[];
}

const pill = (txt: string, tom?: "warn" | "bad") => <RebPill tone={tom ?? "ok"}>{txt}</RebPill>;

export const reproducao: DomainConfig = {
  titulo: "Reprodução",
  eyebrow: "Pecuária · Sítio São Francisco",
  kpis: (rs) => {
    const prenhes = rs.filter((r) => r.statusReprodutivo === "PRENHE").length;
    const vazias = rs.filter((r) => r.statusReprodutivo === "VAZIA").length;
    const elegiveisPrenhez = prenhes + vazias;
    const servidas = rs.filter((r) => r.statusReprodutivo === "INSEMINADA").length;
    const aptas = rs.filter((r) => r.statusReprodutivo === "PEV").length;
    const ieps = rs.map((r) => r.iepProjetado).filter((x): x is number => typeof x === "number");
    const iepMedio = ieps.length ? Math.round(ieps.reduce((a, b) => a + b, 0) / ieps.length) : null;
    return [
      { lab: "Aptas", val: String(aptas), d: "no PEV" },
      { lab: "Servidas", val: String(servidas), d: "aguardando DG" },
      { lab: "Gestantes", val: String(prenhes), d: "prenhes" },
      { lab: "Vazias", val: String(vazias), tom: "up" },
      { lab: "Taxa prenhez", val: elegiveisPrenhez ? String(Math.round((prenhes / elegiveisPrenhez) * 100)) : "—", sufixo: elegiveisPrenhez ? "%" : undefined },
      { lab: "IEP médio", val: iepMedio ? String(iepMedio) : "—", sufixo: iepMedio ? "d" : undefined },
    ];
  },
  worklists: [
    { id: "inseminar", label: "A inseminar", selecionar: aInseminar },
    { id: "dg", label: "Inseminadas · aguardando DG", selecionar: dgPendente },
    { id: "secar", label: "A secar (atrasadas)", alerta: true, selecionar: (rs) => aSecar(rs, HOJE) },
    { id: "partos", label: "Partos ≤ 30d", selecionar: partosPrevistos },
    { id: "todas", label: "Todas", selecionar: (rs) => rs },
  ],
  colunas: [
    { nome: "Tipo", render: (r) => r.categoria ? r.categoria.toLowerCase() : "—" },
    { nome: "Grupo atual", render: (r) => r.grupoNome ?? "—" },
    { nome: "Lactação", render: (r) => r.ordemLactacao ? `${r.ordemLactacao}ª` : "—" },
    { nome: "DEL", render: (r) => r.del ?? "—" },
    { nome: "Dias pós-IA", render: (r) => diasDesde(r.ultimaInseminacao) },
    { nome: "Situação reprodutiva", render: (r) => r.statusReprodutivo === "PEV" ? pill("apta · PEV") : r.statusReprodutivo === "VAZIA" ? pill("vazia", "bad") : pill(r.statusReprodutivo.toLowerCase()) },
    { nome: "Data da IA", render: (r) => fmtData(r.ultimaInseminacao) },
    { nome: "Protocolo", render: (r) => r.protocoloAtual ?? "Reservar" },
  ],
};

// Work-list "A desmamar" — o critério vem dos Parâmetros de manejo
// (DESMAME_MODO / DESMAME_DIAS / DESMAME_PESO_KG), então ela é montada pela
// tab via factory em vez de viver estática no DomainConfig. `semPeso` (modo
// PESO) mostra no rótulo quantas crias ficaram de fora por falta de pesagem.
export function worklistDesmame(criterio: CriterioDesmame, semPeso = 0): WorkList {
  const base = criterio.modo === "PESO" ? `A desmamar (≥ ${criterio.pesoKg} kg)` : `A desmamar (≥ ${criterio.dias} dias)`;
  const label = criterio.modo === "PESO" && semPeso > 0 ? `${base} · ${semPeso} sem pesagem` : base;
  return { id: "desmame", label, selecionar: (rs) => aDesmamar(rs, criterio, HOJE).lista };
}

export const animal: DomainConfig = {
  titulo: "Animais", eyebrow: "Pecuária · Sítio São Francisco",
  kpis: (rs) => [
    { lab: "Total", val: String(rs.length) },
    { lab: "Leite", val: String(rs.filter((r) => r.finalidade === "LEITE").length) },
    { lab: "Corte", val: String(rs.filter((r) => r.finalidade === "CORTE").length) },
    { lab: "Dupla aptidão", val: String(rs.filter((r) => r.finalidade === "DUPLA_APTIDAO").length) },
    { lab: "Não classificados", val: String(rs.filter((r) => !r.finalidade || r.finalidade === "NAO_INFORMADA").length), tom: "up" },
  ],
  worklists: [{ id: "todas", label: "Todos os animais", selecionar: (rs) => rs }],
  colunas: [
    { nome: "Finalidade", render: (r) => r.finalidade === "LEITE" ? "Leite" : r.finalidade === "CORTE" ? "Corte" : r.finalidade === "DUPLA_APTIDAO" ? "Dupla aptidão" : "Não informada" },
    { nome: "Categoria", render: (r) => r.categoria ? r.categoria.toLowerCase() : "—" },
    { nome: "Grupo", render: (r) => r.grupoNome ?? "—" },
    { nome: "Localização", render: (r) => r.setor ?? "—" },
    { nome: "Último peso", render: (r) => r.ultimoPesoKg != null ? `${r.ultimoPesoKg} kg` : "—" },
    { nome: "Situação reprodutiva", render: (r) => pill(r.statusReprodutivo.toLowerCase()) },
  ],
};

export const sanidade: DomainConfig = {
  titulo: "Sanidade", eyebrow: "Pecuária · Sítio São Francisco",
  kpis: (rs) => {
    const altos = rs.filter((r) => (r.ccs ?? 0) >= 400).length;
    const subindo = rs.filter((r) => r.ccsTendencia === "subindo").length;
    const comCcs = rs.filter((r) => typeof r.ccs === "number");
    const media = comCcs.length ? Math.round(comCcs.reduce((a, r) => a + (r.ccs ?? 0), 0) / comCcs.length) : 0;
    return [
      { lab: "CCS alto", val: String(altos), d: "≥ 400 mil", tom: "up" },
      { lab: "CCS subindo", val: String(subindo), tom: "up" },
      { lab: "CCS médio", val: String(media), sufixo: "mil" },
    ];
  },
  worklists: [
    { id: "ccs", label: "CCS alto / subindo", alerta: true, selecionar: (rs) => rs.filter((r) => (r.ccs ?? 0) >= 400 || r.ccsTendencia === "subindo") },
    { id: "todas", label: "Todas", selecionar: (rs) => rs },
  ],
  colunas: [
    { nome: "CCS", render: (r) => r.ccs ? `${r.ccs} mil` : "—" },
    { nome: "Tendência", render: (r) => r.ccsTendencia === "subindo" ? pill("subindo", "bad") : pill(r.ccsTendencia ?? "—") },
    { nome: "DEL", render: (r) => r.del ?? "—" },
  ],
};

export const nutricao: DomainConfig = {
  titulo: "Nutrição", eyebrow: "Pecuária · Sítio São Francisco",
  kpis: (rs) => [
    { lab: "Lotes ativos", val: "3" },
    { lab: "Alta Produção", val: String(rs.filter((r) => (r.producaoMediaDia ?? 0) >= 28).length) },
    { lab: "Produção média", val: "26,4", sufixo: "L" },
  ],
  worklists: [{ id: "lote", label: "Por lote", selecionar: (rs) => rs }],
  colunas: [
    { nome: "Produção", render: (r) => r.producaoMediaDia ? `${r.producaoMediaDia} L/d` : "—" },
    { nome: "Lote sugerido", render: (r) => (r.producaoMediaDia ?? 0) >= 28 ? pill("Alta Produção") : pill("Média Produção", "warn") },
    { nome: "DEL", render: (r) => r.del ?? "—" },
  ],
};

export const DOMAINS = { animal, reproducao, sanidade, nutricao } as const;
