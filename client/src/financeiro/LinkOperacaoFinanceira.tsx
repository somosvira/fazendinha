import type { MouseEvent } from "react";
import { navegarPara } from "../router";
import { codigoOperacaoFinanceira } from "./lib/codigo";

export function LinkOperacaoFinanceira({ id, numero }: { id: string; numero: number | null }) {
  const navegar = (evento: MouseEvent<HTMLAnchorElement>) => {
    evento.stopPropagation();
    if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
    evento.preventDefault();
    navegarPara(`/financeiro/operacoes/${id}`);
  };
  return <a href={`/financeiro/operacoes/${id}`} onClick={navegar} className="whitespace-nowrap font-semibold text-green-800 underline underline-offset-4 hover:text-green-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
    {codigoOperacaoFinanceira(numero)}
  </a>;
}
