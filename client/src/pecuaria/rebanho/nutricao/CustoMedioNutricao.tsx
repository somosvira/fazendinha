import { useCallback } from "react";
import { AjudaCampo } from "@/components/Dica";
import { Skeleton } from "@/components/ui/skeleton";
import { hoje } from "@/financeiro/financeiro-ui";
import { consultarCustoMedio, type ResumoNutricional } from "./api";
import { useConsulta } from "./consulta";
import { custoTexto } from "./componentes";
import type { CoberturaLote } from "./coberturaEstoque";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Custo previsto por animal-dia com as dietas vigentes, o efetivo de hoje e o custo médio do estoque. */
export function custoPrevisto(lotes: ResumoNutricional[], cobertura: Map<string, CoberturaLote>) {
  const base = lotes.filter(r => cobertura.get(r.lote.id)?.custoDia != null && r.lote.animaisAtivos > 0);
  const animais = base.reduce((n, r) => n + r.lote.animaisAtivos, 0);
  const total = base.reduce((n, r) => n + cobertura.get(r.lote.id)!.custoDia!, 0);
  return animais ? { porAnimalDia: total / animais, totalDia: total, parcial: base.some(r => cobertura.get(r.lote.id)!.custoParcial) } : null;
}

/** Custo do mês corrente: o previsto pelas baixas diárias e o que já foi baixado e confirmado; o mês anterior como referência. */
export function CustoMedioNutricao({ lotes, cobertura }: { lotes: ResumoNutricional[]; cobertura?: Map<string, CoberturaLote> | null }) {
  const consulta = useConsulta(useCallback(async () => {
    const [atual, anterior] = await Promise.all([consultarCustoMedio("atual"), consultarCustoMedio("anterior")]);
    return { atual, anterior };
  }, []));
  const previsto = cobertura ? custoPrevisto(lotes, cobertura) : null;
  const atual = consulta.dados?.atual, anterior = consulta.dados?.anterior;
  const mes = MESES[Number(hoje().slice(5, 7)) - 1];
  return <div>
    <dt>Custo de {mes} <AjudaCampo rotulo="Como o custo é calculado" texto={<>
      <strong>Previsto</strong>: consumo diário das dietas vigentes com o efetivo de hoje, valorizado pelo custo médio de cada ingrediente no estoque, por animal e dia. Acompanha as baixas diárias e muda quando a dieta, o efetivo ou o custo do estoque mudam.{" "}
      <strong>Já baixado</strong>: fechamentos confirmados de {mes} até ontem, com custo totalmente apurado, divididos pelos animal-dias.
    </>} /></dt>
    {cobertura === undefined ? <dd><Skeleton className="h-7 w-28" /></dd> : <dd>{previsto ? <>{custoTexto(previsto.porAnimalDia.toFixed(2))}<span className="dietas-resumo-unidade"> /animal/dia previsto</span></> : "Sem custo previsto"}</dd>}
    {previsto && <small>{custoTexto(previsto.totalDia.toFixed(2))} por dia nos lotes{previsto.parcial ? " · há ingredientes sem custo" : ""}</small>}
    {consulta.carregando ? <small><Skeleton className="h-4 w-36" /></small> : consulta.erro ? <small>Baixado indisponível</small> : <>
      <small>Já baixado: {atual?.custoPorAnimalDia != null ? <strong>{custoTexto(atual.custoPorAnimalDia)}/animal/dia</strong> : "nenhum fechamento confirmado no mês"}</small>
      {anterior?.custoPorAnimalDia != null && <small>{MESES[Number(anterior.inicio.slice(5, 7)) - 1][0].toUpperCase() + MESES[Number(anterior.inicio.slice(5, 7)) - 1].slice(1)}: {custoTexto(anterior.custoPorAnimalDia)}/animal/dia</small>}
    </>}
  </div>;
}
