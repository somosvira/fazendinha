import { TabelaFinanceira } from "@/financeiro/financeiro-ui";

export function ConsultaOperacional<T>(props: Parameters<typeof TabelaFinanceira<T>>[0]) {
  return <div className="consulta-operacional"><TabelaFinanceira {...props} /></div>;
}
