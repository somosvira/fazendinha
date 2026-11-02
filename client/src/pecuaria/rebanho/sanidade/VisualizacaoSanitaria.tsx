import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta, type ModoConsulta } from "@/components/VisualizacaoConsulta";
import "./sanidade-visual.css";
export type ModoSanitario = ModoConsulta;
export const useVisualizacaoSanitaria = (chave: string, padrao: ModoConsulta = "tabela") => useVisualizacaoConsulta(chave, "sanidade", padrao);
export function AlternarVisualizacaoSanitaria({semana = false, ...props}: {modo: ModoSanitario; mudar: (v: ModoSanitario) => void; semana?: boolean; rotulo: string}) {
  return <AlternarVisualizacaoConsulta {...props} visual={semana ? "Semana" : "Cartões"}/>;
}
