import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { SecaoRecolhivel } from "./SecaoRecolhivel";

/** Somente os pais de Geral recolhem; os filhos e rascunhos permanecem montados. */
export function SecaoGeralAnimal({ id, titulo, icon: Icon, acao, children }: {
  id: string; titulo: string; icon: LucideIcon; acao?: ReactNode; children: ReactNode;
}) {
  return <SecaoRecolhivel id={id} className="ficha-geral-secao" titulo={<><span className="pec-icone" aria-hidden="true"><Icon size={18}/></span>{titulo}</>} acoes={acao} setaAoFinal acoesSomenteAberta>
    {children}
  </SecaoRecolhivel>;
}
