import { useCallback } from "react";
import { AjudaCampo } from "@/components/Dica";
import { Skeleton } from "@/components/ui/skeleton";
import { consultarCustoMedio } from "./api";
import { useConsulta } from "./consulta";
import { custoTexto } from "./componentes";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Custo médio por animal-dia do último mês fechado, como um número da faixa de resumo. */
export function CustoMedioNutricao() {
  const consulta = useConsulta(useCallback(consultarCustoMedio, []));
  const d = consulta.dados;
  return <div>
    <dt>Custo médio{d ? ` de ${MESES[Number(d.inicio.slice(5, 7)) - 1]}` : ""} <AjudaCampo rotulo="Como o custo médio é calculado" texto={d ? `${custoTexto(d.custoConhecido)} divididos por ${d.animalDias.toLocaleString("pt-BR")} animal-dias. Entram só os fechamentos inteiramente dentro do mês e com custo totalmente apurado; lotes sem fechamento ou com custo parcial ficam fora.` : "Custo dos fechamentos do mês dividido pelos animal-dias."} /></dt>
    {consulta.carregando ? <dd><Skeleton className="h-7 w-28" /></dd> : consulta.erro ? <dd className="text-sm">Indisponível</dd> : <>
      <dd>{d ? <>{custoTexto(d.custoPorAnimalDia)}<span className="dietas-resumo-unidade"> /animal/dia</span></> : "Sem fechamentos"}</dd>
      {d && <small>{d.lotesIncluidos} de {d.lotesTotal} lotes no cálculo</small>}
    </>}
  </div>;
}
