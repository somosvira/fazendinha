import type { ReactNode } from "react";
import { CircleAlert, Info } from "lucide-react";

/** Prévia de formulário não é confirmação de um fato nem validação de um campo. */
export function LinhaPrevia({ children, pendente = false }: { children: ReactNode; pendente?: boolean; tone?: "green" | "amber" | "brown" | "neutral" }) {
  const Icone = pendente ? CircleAlert : Info;
  return <div className="flex items-start gap-2 text-sm leading-5"><Icone size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground" /><span>{children}</span></div>;
}
