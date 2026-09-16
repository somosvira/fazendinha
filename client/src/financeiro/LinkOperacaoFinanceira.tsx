import type { MouseEvent } from "react";
import { navegarPara } from "../router";

export function LinkOperacaoFinanceira({ id }: { id: number }) {
  const navegar = (evento: MouseEvent<HTMLAnchorElement>) => {
    evento.stopPropagation();
    if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
    evento.preventDefault();
    navegarPara(`/financeiro/operacoes/${id}`);
  };
  return <a href={`/financeiro/operacoes/${id}`} onClick={navegar} className="whitespace-nowrap font-semibold text-green-800 underline underline-offset-4 hover:text-green-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
    OP-{String(id).padStart(4, "0")}
  </a>;
}
