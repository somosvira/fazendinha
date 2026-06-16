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

// Placeholders mínimos — preenchidos na Task 18.
const vazio: DomainConfig = { titulo: "", eyebrow: "Rebanho · 522 animais", kpis: () => [], worklists: [], colunas: [] };
export const animal: DomainConfig = { ...vazio, titulo: "Animal" };
export const sanidade: DomainConfig = { ...vazio, titulo: "Sanidade" };
export const nutricao: DomainConfig = { ...vazio, titulo: "Nutrição" };

export const DOMAINS = { animal, reproducao, sanidade, nutricao } as const;
