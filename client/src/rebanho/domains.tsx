import type { ResumoAnimal } from "./types";
import { aInseminar, dgPendente, aSecar, partosPrevistos } from "./lib/worklists";
import { HOJE } from "./HOJE";

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

const pill = (txt: string, tom?: "warn" | "bad") => <span className={"rb-pill" + (tom ? " " + tom : "")}>{txt}</span>;

export const reproducao: DomainConfig = {
  titulo: "Reprodução",
  eyebrow: "Rebanho · 522 animais",
  kpis: (rs) => [
    { lab: "Aptas", val: String(rs.filter((r) => r.statusReprodutivo === "PEV").length), d: "no PEV" },
    { lab: "Servidas", val: String(rs.filter((r) => r.statusReprodutivo === "INSEMINADA").length), d: "aguardando DG" },
    { lab: "Gestantes", val: String(rs.filter((r) => r.statusReprodutivo === "PRENHE").length), d: "↗ +4", tom: "ok" },
    { lab: "Vazias", val: String(rs.filter((r) => r.statusReprodutivo === "VAZIA").length), d: "atrasadas", tom: "up" },
    { lab: "Taxa prenhez", val: "31", sufixo: "%", d: "↓ era 42%", tom: "up" },
    { lab: "IEP médio", val: "488", sufixo: "d", d: "meta 430", tom: "up" },
    { lab: "Partos previstos", val: "13", d: "próx. 30d" },
  ],
  worklists: [
    { id: "inseminar", label: "A inseminar", selecionar: aInseminar },
    { id: "dg", label: "DG pendente", selecionar: dgPendente },
    { id: "secar", label: "A secar (atrasadas)", alerta: true, selecionar: (rs) => aSecar(rs, HOJE) },
    { id: "partos", label: "Partos ≤ 30d", selecionar: partosPrevistos },
  ],
  colunas: [
    { nome: "DEL", render: (r) => r.del ?? "—" },
    { nome: "Status", render: (r) => r.statusReprodutivo === "PEV" ? pill("apta · PEV") : r.statusReprodutivo === "VAZIA" ? pill("vazia", "bad") : pill(r.statusReprodutivo.toLowerCase()) },
    { nome: "Última tentativa", render: (r) => r.ultimaInseminacao ?? (r.ultimoDgData ? `${r.ultimoDgData} · ${r.ultimoDgResultado}` : "—") },
    { nome: "Protocolo", render: (r) => r.protocoloAtual ?? "Reservar" },
  ],
};

export const animal: DomainConfig = {
  titulo: "Animal", eyebrow: "Rebanho · 522 animais",
  kpis: (rs) => [
    { lab: "Total", val: String(rs.length) },
    { lab: "Em lactação", val: String(rs.filter((r) => r.del !== undefined).length) },
    { lab: "Prenhes", val: String(rs.filter((r) => r.statusReprodutivo === "PRENHE").length) },
    { lab: "Vazias", val: String(rs.filter((r) => r.statusReprodutivo === "VAZIA").length), tom: "up" },
  ],
  worklists: [{ id: "todas", label: "Todas as fêmeas", selecionar: (rs) => rs }],
  colunas: [
    { nome: "Lactação", render: (r) => r.ordemLactacao ? `${r.ordemLactacao}ª` : "—" },
    { nome: "DEL", render: (r) => r.del ?? "—" },
    { nome: "Produção", render: (r) => r.producaoMediaDia ? `${r.producaoMediaDia} L/d` : "—" },
    { nome: "Status", render: (r) => pill(r.statusReprodutivo.toLowerCase()) },
  ],
};

export const sanidade: DomainConfig = {
  titulo: "Sanidade", eyebrow: "Rebanho · 522 animais",
  kpis: (rs) => [
    { lab: "CCS alto", val: String(rs.filter((r) => (r.ccs ?? 0) >= 400).length), d: "≥ 400 mil", tom: "up" },
    { lab: "CCS subindo", val: String(rs.filter((r) => r.ccsTendencia === "subindo").length), tom: "up" },
    { lab: "Em tratamento", val: "2" },
    { lab: "CCS médio", val: "248", sufixo: "mil" },
  ],
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
  titulo: "Nutrição", eyebrow: "Rebanho · 522 animais",
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
