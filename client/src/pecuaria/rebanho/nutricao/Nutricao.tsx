import { useEffect, useState } from "react";
import { PageHeader, PaginaFinanceira } from "../../../financeiro/financeiro-ui";
import { navegarPara } from "../../../router";
import { ConsumosNutricionais } from "./ConsumosNutricionais";
import { ConsultaFechamento } from "./ConsultaFechamento";
import { DietasNutricionais } from "./DietasNutricionais";
import { AtribuicoesNutricionais } from "./AtribuicoesNutricionais";

type AbaNutricao = "dietas" | "atribuicoes" | "consumos";
function estadoDaUrl() {
  const params = new URLSearchParams(window.location.search);
  const valor = params.get("aba");
  const aba: AbaNutricao = valor === "fechamentos" || valor === "consumos" || params.has("fechamentoId") ? "consumos" : valor === "lotes" || valor === "atribuicoes" ? "atribuicoes" : "dietas";
  return { aba, loteId: params.get("loteId") ?? "", fechamentoId: params.get("fechamentoId") };
}
export function Nutricao({ podeLancar }: { podeLancar: boolean }) {
  const [estado, setEstado] = useState(estadoDaUrl);
  useEffect(() => {
    const restaurar = () => setEstado(estadoDaUrl());
    window.addEventListener("popstate", restaurar);
    return () => window.removeEventListener("popstate", restaurar);
  }, []);
  function navegar(aba: AbaNutricao) {
    const params = new URLSearchParams(window.location.search);
    params.set("aba", aba); params.delete("fechamentoId");
    navegarPara("/pecuaria/rebanho/nutricao?" + params);
  }
  return <PaginaFinanceira>
    <PageHeader eyebrow="Pecuária" titulo="Nutrição" descricao="Dietas, atribuições aos lotes e consumos conferidos." />
    {estado.fechamentoId ? <ConsultaFechamento id={estado.fechamentoId} onVoltar={() => navegar("consumos")} /> : <>
      <div role="tablist" aria-label="Nutrição" className="mt-5 flex flex-wrap gap-2">
        {([["dietas", "Dietas"], ["atribuicoes", "Atribuições"], ["consumos", "Consumos"]] as const).map(([aba, label]) => <button key={aba} type="button" role="tab" aria-selected={estado.aba === aba} className={`rounded-lg border border-border px-4 py-2 text-sm ${estado.aba === aba ? "bg-surface-2 font-semibold" : "bg-bg-card"}`} onClick={() => navegar(aba)}>{label}</button>)}
      </div>
      {estado.aba === "dietas" && <DietasNutricionais podeLancar={podeLancar} />}
      {estado.aba === "atribuicoes" && <AtribuicoesNutricionais podeLancar={podeLancar} />}
      {estado.aba === "consumos" && <ConsumosNutricionais key={estado.loteId} loteInicial={estado.loteId} podeLancar={podeLancar} />}
    </>}
  </PaginaFinanceira>;
}
