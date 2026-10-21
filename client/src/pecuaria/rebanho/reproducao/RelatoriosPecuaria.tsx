import { useEffect, useState } from "react";
import { PageHeader, PaginaFinanceira } from "../../../financeiro/financeiro-ui";
import { SubTabs } from "../../../components/SubTabs";
import { navegarPara } from "../../../router";
import { ConsultaPorSitio } from "./ConsultaPorSitio";
import { RelatorioPartos } from "./RelatorioPartos";
import { IndicadoresReprodutivos } from "./IndicadoresReprodutivos";
const TIPOS = [{ id: "partos", label: "Partos e pós-parto" }, { id: "indicadores", label: "Indicadores reprodutivos" }] as const;
const daUrl = () => new URLSearchParams(window.location.search).get("tipo") === "indicadores" ? "indicadores" : "partos";
export function RelatoriosPecuaria({ podeLancar }: { podeLancar: boolean }) {
  const [tipo, setTipo] = useState(daUrl);
  useEffect(() => { const sync = () => setTipo(daUrl()); window.addEventListener("popstate", sync); return () => window.removeEventListener("popstate", sync); }, []);
  return <PaginaFinanceira>
    <PageHeader titulo="Relatórios da Pecuária" descricao="Analise partos, pós-parto e indicadores reprodutivos por sítio e período." />
    <SubTabs variant="financeiro" ariaLabel="Tipos de relatório pecuário" tabs={[...TIPOS]} active={tipo} onSelect={valor => { const url = new URL(window.location.href); url.searchParams.set("tipo", valor); navegarPara(url.pathname + url.search + url.hash); }}/>
    <div className="abas-superficie"><ConsultaPorSitio>{id => tipo === "partos" ? <RelatorioPartos key={`partos:${id}`} propriedadeId={id} podeLancar={podeLancar}/> : <IndicadoresReprodutivos key={`indicadores:${id}`} propriedadeId={id} podeLancar={podeLancar} modo="relatorio"/>}</ConsultaPorSitio></div>
  </PaginaFinanceira>;
}
