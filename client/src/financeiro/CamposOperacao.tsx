// Peças de campo compartilhadas pelo formulário de operação (FormOperacao.tsx) e pelas seções que ele
// delega (AnimaisCompra.tsx): classes dos controles e a mensagem de erro de campo.
import { CircleAlert } from "lucide-react";

export const CAMPO = "mt-1.5 w-full rounded-lg border border-input bg-card px-3 py-2.5 font-normal text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
export const SELECT = `${CAMPO} cursor-pointer`;

/** Mensagem de erro de campo, sempre com o mesmo destaque: ícone + texto em vermelho. */
export function CampoErro({ id, className = "mt-1.5", children }: { id?: string; className?: string; children: React.ReactNode }) {
  return <span id={id} role="alert" className={`flex items-start gap-1.5 text-xs font-semibold text-destructive ${className}`}><CircleAlert size={14} className="mt-px shrink-0" aria-hidden /><span>{children}</span></span>;
}
