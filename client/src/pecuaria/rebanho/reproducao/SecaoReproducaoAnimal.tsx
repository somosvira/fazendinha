import { useId, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Agrupamento interno da ficha; a seção principal conserva o recolhimento. */
export function SecaoReproducaoAnimal({ titulo, icon: Icon, acao, children, id }: {
  titulo: string; icon: LucideIcon; acao?: ReactNode; children: ReactNode; id?: string;
}) {
  const gerado = useId();
  const tituloId = `${id ?? gerado}-titulo`;
  return <section id={id} className="repro-subsecao" aria-labelledby={tituloId}>
    <header><h3 id={tituloId}><span className="pec-icone" aria-hidden="true"><Icon size={18}/></span>{titulo}</h3>{acao && <div className="repro-subsecao-acoes">{acao}</div>}</header>
    <div className="repro-subsecao-conteudo">{children}</div>
  </section>;
}
