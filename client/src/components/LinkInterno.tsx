import type { MouseEvent, ReactNode } from "react";
import { navegarPara } from "../router";
import { podeAcessarArea } from "../estoque/navegacao";
const SEM_ACESSO = "Sem acesso a esta área";
/* Link interno sem recarregar a página (mesmo padrão de LinkOperacaoFinanceira);
 * sem acesso à área de destino vira texto puro com o motivo no `title`. */
export function LinkInterno({ href, area, children }: { href: string; area: Parameters<typeof podeAcessarArea>[0] | "estoque"; children: ReactNode }) {
  const permitido = area === "estoque" ? podeAcessarArea("financeiro") || podeAcessarArea("pecuaria") : podeAcessarArea(area);
  if (!permitido) return <span title={SEM_ACESSO} className="text-ink-2">{children}</span>;
  const navegar = (evento: MouseEvent<HTMLAnchorElement>) => {
    evento.stopPropagation();
    if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
    evento.preventDefault();
    navegarPara(href);
  };
  return <a href={href} onClick={navegar} className="font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">{children}</a>;
}
