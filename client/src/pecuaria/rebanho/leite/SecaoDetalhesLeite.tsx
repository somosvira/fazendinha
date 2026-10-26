import type { ReactNode } from "react";
import { SecaoRecolhivel } from "../components/SecaoRecolhivel";

/** Mantém os rascunhos montados na mesma seção compartilhada pelo Rebanho. */
export function SecaoDetalhesLeite({ titulo, children, acoes, className = "", inicialmenteAberto = false }: {
  titulo: ReactNode;
  children: ReactNode;
  acoes?: ReactNode;
  className?: string;
  inicialmenteAberto?: boolean;
}) {
  return <SecaoRecolhivel titulo={titulo} acoes={acoes} abertaInicial={inicialmenteAberto} className={className}>{children}</SecaoRecolhivel>;
}
