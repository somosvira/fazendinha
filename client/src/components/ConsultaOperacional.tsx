import { TabelaFinanceira } from "@/financeiro/financeiro-ui";
import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "./VisualizacaoConsulta";

export function ConsultaOperacional<T>(props: Parameters<typeof TabelaFinanceira<T>>[0]) {
  const visual = useVisualizacaoConsulta("visualConsultaOperacional");
  return <div className="consulta-operacional">
    <AlternarVisualizacaoConsulta {...visual} rotulo={`Visualização de ${props.rotulo.toLocaleLowerCase("pt-BR")}`} />
    <TabelaFinanceira {...props} compacta={visual.modo === "visual" || props.compacta} cartaoComLinks
      visualizacao={visual.modo === "visual" ? "cartoes" : "tabela"} />
  </div>;
}
