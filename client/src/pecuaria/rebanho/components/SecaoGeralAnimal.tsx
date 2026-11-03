import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { SecaoRecolhivel } from "./SecaoRecolhivel";

/** Padrão dos pais da ficha: recolhe a apresentação e preserva filhos e rascunhos. */
export function SecaoGeralAnimal({ id, titulo, icon: Icon, acao, children, className = "", abertaInicial = true }: {
  id: string; titulo: string; icon: LucideIcon; acao?: ReactNode; children: ReactNode; className?: string; abertaInicial?: boolean;
}) {
  return <SecaoRecolhivel id={id} className={`ficha-geral-secao ${className}`} abertaInicial={abertaInicial} titulo={<><span className="pec-icone" aria-hidden="true"><Icon size={18}/></span>{titulo}</>} acoes={acao} setaAoFinal acoesSomenteAberta>
    {children}
  </SecaoRecolhivel>;
}
