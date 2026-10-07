import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";

export function ConfirmacaoCiencia({ id, checked, onChange, children, erro, disabled = false, obrigatorio = false, descricao, className = "" }: {
  id: string;
  checked: boolean;
  onChange: (confirmado: boolean) => void;
  children: ReactNode;
  erro?: string;
  disabled?: boolean;
  obrigatorio?: boolean;
  descricao?: string;
  className?: string;
}) {
  const descritoPor = [erro && `${id}-erro`, descricao && `${id}-descricao`].filter(Boolean).join(" ") || undefined;
  return <div className={`grid gap-1.5 text-sm ${className}`}>
    <label htmlFor={id} className={`flex items-start gap-3 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input id={id} type="checkbox" role="switch" checked={checked} required={obrigatorio} disabled={disabled}
          aria-invalid={!!erro} aria-describedby={descritoPor} onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 z-10 m-0 h-6 w-11 cursor-pointer opacity-0 disabled:cursor-not-allowed" />
        <span aria-hidden="true" className="h-6 w-11 rounded-full border border-border bg-surface-2 transition-colors peer-checked:bg-[var(--pos)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--pos)]" />
        <span aria-hidden="true" className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full border border-border bg-card transition-transform peer-checked:translate-x-5" />
      </span>
      <span>{children}{obrigatorio && <span aria-hidden="true"> *</span>}</span>
    </label>
    {descricao && <p id={`${id}-descricao`} className="text-xs text-ink-3">{descricao}</p>}
    {erro && <p id={`${id}-erro`} role="alert" className="flex items-start gap-1.5 text-xs text-red-700"><CircleAlert size={14} className="mt-px shrink-0" aria-hidden />{erro}</p>}
  </div>;
}
