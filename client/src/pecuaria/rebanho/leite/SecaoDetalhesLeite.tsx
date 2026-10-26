import type { ReactNode } from "react";
import { SecaoRecolhivel } from "../components/SecaoRecolhivel";

/** Mantém os rascunhos montados na mesma seção compartilhada pelo Rebanho. */
export function SecaoDetalhesLeite({ titulo, children, className = "", inicialmenteAberto = false }: {
  titulo: ReactNode;
  children: ReactNode;
  className?: string;
  inicialmenteAberto?: boolean;
}) {
  return <SecaoRecolhivel titulo={titulo} abertaInicial={inicialmenteAberto} className={className}>{children}</SecaoRecolhivel>;
}
