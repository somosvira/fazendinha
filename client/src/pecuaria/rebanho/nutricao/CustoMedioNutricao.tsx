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
  // Lotes com dieta mas sem nenhum ingrediente com custo ficam fora da média; o cartão avisa quantos.
  const semCusto = lotes.filter(r => r.vigente && r.lote.animaisAtivos > 0 && cobertura.get(r.lote.id)?.custoDia == null).length;
  return animais ? { porAnimalDia: total / animais, totalDia: total, parcial: base.some(r => cobertura.get(r.lote.id)!.custoParcial), semCusto } : null;
}

/** Custo previsto e custo apurado nas baixas confirmadas do mês corrente. */
export function CustoMedioNutricao({ lotes, cobertura }: { lotes: ResumoNutricional[]; cobertura?: Map<string, CoberturaLote> | null }) {
  const consulta = useConsulta(useCallback(() => consultarCustoMedio("atual"), []));
  const previsto = cobertura ? custoPrevisto(lotes, cobertura) : null;
  const custoApurado = consulta.dados?.custoPorAnimalDia;
  const mes = MESES[Number(hoje().slice(5, 7)) - 1];
  return <div>
    <dt>Custo de {mes} <AjudaCampo rotulo="Como o custo é calculado" texto={<>
      <strong>Previsto</strong>: consumo diário das dietas vigentes com o efetivo de hoje, valorizado pelo custo médio de cada ingrediente no estoque, por animal e dia. Acompanha as baixas diárias e muda quando a dieta, o efetivo ou o custo do estoque mudam.{" "}
      <strong>Já baixado</strong>: o que já saiu do estoque em {mes} até ontem — baixas diárias efetivadas e fechamentos confirmados com custo apurado — dividido pelos animal-dias desses dias.
    </>} /></dt>
    {cobertura === undefined ? <dd><Skeleton className="h-7 w-28" /></dd> : <dd className="dietas-resumo-valor">{previsto ? <>{custoTexto(previsto.porAnimalDia.toFixed(2))}<span className="dietas-resumo-unidade"> /animal/dia previsto</span></> : "Sem custo previsto"}</dd>}
    {previsto && (previsto.parcial || previsto.semCusto > 0) && <dd><span className="dietas-resumo-etiqueta">
      Previsão parcial
      {previsto.semCusto > 0 && ` · ${previsto.semCusto} ${previsto.semCusto === 1 ? "lote sem custo" : "lotes sem custo"}`}
      {previsto.parcial && " · ingredientes sem custo"}
    </span></dd>}
    {previsto && <dd>{custoTexto(previsto.totalDia.toFixed(2))} por dia nos lotes</dd>}
    {consulta.erro && <dd>Custo baixado indisponível</dd>}
    {custoApurado != null && <dd>
      Já baixado no mês · <strong>{custoTexto(custoApurado)}</strong>/animal/dia
    </dd>}
  </div>;
}
