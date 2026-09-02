import type { LucideIcon } from "lucide-react";
import { CalendarDays, Check, X } from "lucide-react";

export const brl = (valor: string | number | null | undefined) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor ?? 0));
export const dataBR = (valor: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(valor));
export const hoje = () => new Date().toISOString().slice(0, 10);
export const emDias = (dias: number) => { const d = new Date(); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); };
export const mesAtual = () => new Date().toISOString().slice(0, 7);
export const limitesMes = (mes: string) => { const [ano, numero] = mes.split("-").map(Number); return { inicio: `${mes}-01`, fim: new Date(Date.UTC(ano, numero, 0, 23, 59, 59)).toISOString() }; };

export const TIPO_OPERACAO: Record<string, string> = {
  COMPRA_ESTOQUE: "Compra para estoque", COMPRA_CONSUMO_DIRETO: "Compra para consumo direto",
  SERVICO: "Serviço", VENDA: "Venda", APORTE: "Aporte", RETIRADA: "Retirada",
  TRANSFERENCIA_FINANCEIRA: "Transferência", AJUSTE_ESTOQUE: "Ajuste de estoque",
  TRANSFERENCIA_ESTOQUE: "Transferência de estoque", INVENTARIO_INICIAL: "Inventário inicial",
  BONIFICACAO: "Bonificação", DEVOLUCAO: "Devolução", PRODUCAO: "Produção própria",
};

const STATUS: Record<string, string> = {
  RASCUNHO: "Rascunho", CONFIRMADA: "Confirmada", CANCELADA: "Cancelada",
  PENDENTE: "Pendente", PARCIAL: "Parcial", LIQUIDADO: "Liquidado", CANCELADO: "Cancelado",
  REVERTIDA: "Revertida",
};

export function PageHeader({ titulo, descricao, acao }: { titulo: string; descricao: string; acao?: React.ReactNode }) {
  return <header className="flex flex-wrap items-end justify-between gap-5 border-b border-border pb-6 pt-7">
    <div className="max-w-3xl"><div className="eyebrow">Financeiro</div><h1 className="h1 mt-2">{titulo}</h1><p className="mt-2 text-sm leading-6 text-ink-3">{descricao}</p></div>{acao}
  </header>;
}

export function Button({ children, onClick, type = "button", disabled, danger, secondary, className = "" }: { children: React.ReactNode; onClick?: () => void; type?: "button" | "submit"; disabled?: boolean; danger?: boolean; secondary?: boolean; className?: string }) {
  const cor = danger ? "bg-red-800 text-white hover:bg-red-900" : secondary ? "border border-border bg-white text-ink hover:bg-surface-2" : "bg-mast text-white hover:opacity-90";
  return <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${cor} ${className}`}>{children}</button>;
}

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-border bg-white shadow-[0_1px_2px_rgba(30,35,28,.04)] ${className}`}>{children}</section>;
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "green" | "amber" | "red" | "blue" | "brown" }) {
  const tons = { neutral: "bg-stone-100 text-stone-700", green: "bg-green-100 text-green-800", amber: "bg-amber-100 text-amber-900", red: "bg-red-100 text-red-800", blue: "bg-blue-100 text-blue-800", brown: "bg-[#eee7d8] text-[#63543c]" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tons[tone]}`}>{children}</span>;
}

export function StatusPill({ status }: { status: string }) {
  const tone = status === "CONFIRMADA" || status === "LIQUIDADO" ? "green" : status === "PENDENTE" ? "amber" : status === "PARCIAL" ? "blue" : status.includes("CANCEL") || status === "REVERTIDA" ? "red" : "neutral";
  return <Pill tone={tone}>{STATUS[status] ?? status}</Pill>;
}

export function Metric({ label, valor, detalhe, icon: Icon, tone = "default" }: { label: string; valor: string; detalhe: string; icon: LucideIcon; tone?: "default" | "green" | "red" }) {
  const iconTone = tone === "green" ? "bg-green-50 text-green-800" : tone === "red" ? "bg-red-50 text-red-800" : "bg-[#eef1e9] text-mast";
  return <Panel className="p-5"><div className="flex items-start justify-between gap-4"><div><div className="text-[11px] font-semibold uppercase tracking-[.12em] text-ink-3">{label}</div><div className="mt-3 font-serif text-[28px] leading-none tracking-tight text-ink">{valor}</div></div><div className={`rounded-lg p-2.5 ${iconTone}`}><Icon size={18} /></div></div><div className="mt-3 text-xs text-ink-3">{detalhe}</div></Panel>;
}

export function ErrorBox({ erro }: { erro: string | null }) {
  return erro ? <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{erro}</div> : null;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="p-10 text-center text-sm text-ink-3">{children}</div>;
}

export function MonthControl({ mes, onChange }: { mes: string; onChange: (mes: string) => void }) {
  return <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink-2"><CalendarDays size={16} className="text-ink-3" /><span className="sr-only">Período</span><input type="month" value={mes} onChange={(e) => onChange(e.target.value)} className="bg-transparent font-medium outline-none" /></label>;
}

export function Modal({ titulo, eyebrow, onClose, children, width = "max-w-xl" }: { titulo: string; eyebrow: string; onClose: () => void; children: React.ReactNode; width?: string }) {
  return <div className="fixed inset-0 z-[1100] grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label={titulo}><Panel className={`max-h-[92vh] w-full overflow-auto ${width}`}><div className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-[#f4f2e9] p-5"><div><div className="eyebrow">{eyebrow}</div><h2 className="mt-1 font-serif text-2xl">{titulo}</h2></div><button onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 hover:bg-white"><X size={18} /></button></div>{children}</Panel></div>;
}

export function ReviewLine({ children, tone = "green" }: { children: React.ReactNode; tone?: "green" | "amber" | "brown" | "neutral" }) {
  const cor = { green: "text-[#9fc28d]", amber: "text-[#e3c66f]", brown: "text-[#d3bd8c]", neutral: "text-[#aeb9aa]" }[tone];
  return <div className="flex gap-2"><Check size={16} className={`mt-0.5 shrink-0 ${cor}`} /><span>{children}</span></div>;
}
