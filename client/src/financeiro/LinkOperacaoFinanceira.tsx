import type { MouseEvent } from "react";
import { navegarPara } from "../router";
import { codigoOperacao } from "../estoque/navegacao";

export function LinkOperacaoFinanceira({ id, numero }: { id: string; numero: number }) {
  const navegar = (evento: MouseEvent<HTMLAnchorElement>) => {
    evento.stopPropagation();
    if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
    evento.preventDefault();
    navegarPara(`/financeiro/operacoes/${id}`);
  };
  return <a href={`/financeiro/operacoes/${id}`} onClick={navegar} className="whitespace-nowrap font-semibold text-ink-2 underline underline-offset-4 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
    {codigoOperacao(numero)}
  </a>;
}
