import { useCallback } from "react";
import { Panel, Pill } from "@/financeiro/financeiro-ui";
import { consultarCustoMedio } from "./api";
import { useConsulta } from "./consulta";
import { custoTexto, EstadoConsulta } from "./componentes";
import { formatarDataBR } from "../lib/rotulos";
export function CustoMedioNutricao() {
  const consulta = useConsulta(useCallback(consultarCustoMedio, []));
  return <Panel className="dietas-custo-medio"><h2>Custo médio da nutrição</h2><EstadoConsulta erro={consulta.erro} carregando={consulta.carregando} recarregar={consulta.carregar} />{consulta.dados && <>
    <p>{formatarDataBR(consulta.dados.inicio)} a {formatarDataBR(consulta.dados.fim)}</p>
    <div className="dietas-custo-valor">{custoTexto(consulta.dados.custoPorAnimalDia)} <span>/ animal / dia</span></div>
    <Pill tone="amber">Base de consumo registrado</Pill>
    <p>{consulta.dados.lotesIncluidos} de {consulta.dados.lotesTotal} lotes com base integralmente valorizada.</p>
    {consulta.dados.animalDias > 0 && <p>{custoTexto(consulta.dados.custoConhecido)} ÷ {consulta.dados.animalDias.toLocaleString("pt-BR")} animal-dias.</p>}
    <small>Somente períodos inteiramente contidos no mês. Lotes sem registro ou com custo parcial/desconhecido ficam fora da média; não representa cobertura integral da alimentação.</small>
  </>}</Panel>;
}
