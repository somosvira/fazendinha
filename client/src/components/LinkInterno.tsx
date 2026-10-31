import type { MouseEvent, ReactNode } from "react";
import { navegarPara } from "../router";
import { podeAcessarArea } from "../estoque/navegacao";
import { buttonVariants } from "./ui/button";
const SEM_ACESSO = "Sem acesso a esta área";
/* Link interno sem recarregar a página (mesmo padrão de LinkOperacaoFinanceira);
 * sem acesso à área de destino vira texto puro com o motivo no `title`. */
export function LinkInterno({ href, area, children, aparencia }: { href: string; area: Parameters<typeof podeAcessarArea>[0] | "estoque"; children: ReactNode; aparencia?: "botao-secundario" | "botao-primario" }) {
  const permitido = area === "estoque" ? podeAcessarArea("financeiro") || podeAcessarArea("pecuaria") : podeAcessarArea(area);
  const botao = aparencia !== undefined;
  const classeBotao = buttonVariants({ variant: aparencia === "botao-primario" ? "default" : "outline", size: "sm", className: "min-h-10 whitespace-normal text-center no-underline" });
  if (!permitido) return <span title={SEM_ACESSO} aria-disabled={botao || undefined} className={botao ? `${classeBotao} cursor-default opacity-50` : "text-ink-2"}>{children}</span>;
  const navegar = (evento: MouseEvent<HTMLAnchorElement>) => {
    evento.stopPropagation();
    if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
    evento.preventDefault();
    navegarPara(href);
  };
  return <a href={href} onClick={navegar} className={botao ? classeBotao : "font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"}>{children}</a>;
}
