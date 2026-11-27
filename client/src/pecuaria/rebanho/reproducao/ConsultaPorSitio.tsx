import type { ReactNode } from "react";
import { ConsultaDoSitio } from "../../../components/EscolherSitioSidebar";

/** Consulta por sítio usando só o escopo da sidebar; o servidor continua autorizando cada request. */
type PropsConsultaSitio = { children: (sitioId: number) => ReactNode; cabecalho?: (controle: ReactNode) => ReactNode; cabecalhoAviso?: ReactNode; consolidado?: ReactNode };
export function ConsultaPorSitio({ children, cabecalho, cabecalhoAviso, consolidado }: PropsConsultaSitio) {
  return <ConsultaDoSitio cabecalho={cabecalho?.(null)} cabecalhoAviso={cabecalhoAviso} consolidado={consolidado}>{children}</ConsultaDoSitio>;
}
