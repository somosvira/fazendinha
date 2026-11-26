import type { ReactNode } from "react";
import { ConsultaDoSitio } from "../../../components/EscolherSitioSidebar";

/** Consulta por sítio usando só o escopo da sidebar; o servidor continua autorizando cada request. */
type PropsConsultaSitio = { children: (sitioId: number) => ReactNode; cabecalho?: (controle: ReactNode) => ReactNode; cabecalhoAviso?: ReactNode };
export function ConsultaPorSitio({ children, cabecalho, cabecalhoAviso }: PropsConsultaSitio) {
  return <ConsultaDoSitio cabecalho={cabecalho?.(null)} cabecalhoAviso={cabecalhoAviso}>{children}</ConsultaDoSitio>;
}
