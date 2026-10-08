import { useEffect, useRef, useState } from "react";
import { PageHeader, PaginaFinanceira } from "../../../financeiro/financeiro-ui";
import { navegarPara } from "../../../router";
import { NutricaoLote } from "./NutricaoLote";
import { ReceitasDieta } from "./ReceitasDieta";
import { ConsultaFechamento } from "./ConsultaFechamento";
import { VisaoGeralNutricao } from "./VisaoGeralNutricao";
import { FechamentosNutricao } from "./FechamentosNutricao";
import { FormOperacaoNutricional } from "./FormOperacaoNutricional";
import { rotaOperacaoNutricional, rotaRetornoNutricional } from "./navegacao";
import { LinkNutricional, rotaNutricao } from "./componentes";
import "./nutricao.css";

type Aba = "lotes" | "receitas" | "fechamentos";
function estadoUrl() {
  const p = new URLSearchParams(window.location.search);
  return { aba: (p.get("aba") === "receitas" || p.get("aba") === "fechamentos" ? p.get("aba") : "lotes") as Aba, loteId: p.get("loteId") || undefined, fechamentoId: p.get("fechamentoId") || undefined, acao: p.get("acao"), vigenciaId: p.get("vigenciaId") || undefined, formReceita: p.get("formReceita") };
}
export function Nutricao({ podeLancar }: { podeLancar: boolean }) {
  const [url, setUrl] = useState(estadoUrl);
  const titulo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const restaurar = () => setUrl(estadoUrl());
    window.addEventListener("popstate", restaurar); return () => window.removeEventListener("popstate", restaurar);
  }, []);
  useEffect(() => { titulo.current?.focus(); }, [url.aba, url.loteId, url.fechamentoId, url.acao, url.formReceita]);
  const operacao = url.acao === "atribuir" || url.acao === "corrigir" || url.acao === "consumo" ? url.acao : null;
  const voltar = () => navegarPara(rotaRetornoNutricional());
  const subpagina = !!operacao || !!url.fechamentoId || (url.aba === "lotes" && !!url.loteId);
  return <PaginaFinanceira><div className="nutricao-pagina" ref={titulo} tabIndex={-1}>
    {!(url.aba === "lotes" && url.loteId && !operacao && !url.fechamentoId) && <PageHeader eyebrow="Pecuária" titulo="Nutrição" descricao="Dietas, consumo e custos dos lotes em um só contexto." acao={!subpagina && url.aba !== "receitas" && podeLancar ? <LinkNutricional className="nutricao-botao" href={rotaOperacaoNutricional("consumo")}>Conferir consumo</LinkNutricional> : undefined} />}
    {!subpagina && !url.formReceita && <div role="tablist" aria-label="Nutrição" className="nutricao-abas">{(["lotes", "receitas", "fechamentos"] as const).map((aba) => <button type="button" key={aba} role="tab" aria-selected={url.aba === aba} onClick={() => navegarPara(rotaNutricao({ aba }))}>{aba === "lotes" ? "Visão geral" : aba === "receitas" ? "Receitas" : "Fechamentos"}</button>)}</div>}
    {operacao ? <div className="nutricao-conteudo"><LinkNutricional href={rotaRetornoNutricional()}>← Voltar {url.loteId ? "ao lote" : "à nutrição"}</LinkNutricional>{podeLancar ? <FormOperacaoNutricional key={`${operacao}:${url.loteId}:${url.vigenciaId}`} acao={operacao} loteId={url.loteId} vigenciaId={url.vigenciaId} onVoltar={voltar} onSalvo={(loteId) => navegarPara(rotaNutricao({ loteId }))} /> : <p role="alert">Você não tem permissão para lançar alterações.</p>}</div> : url.fechamentoId ? <ConsultaFechamento key={url.fechamentoId} id={url.fechamentoId} podeLancar={podeLancar} estorno={url.acao === "estorno"} onVoltar={voltar} /> : url.aba === "receitas" ? <ReceitasDieta podeLancar={podeLancar} /> : url.aba === "fechamentos" ? <FechamentosNutricao loteId={url.loteId} /> : url.loteId ? <NutricaoLote key={url.loteId} loteId={url.loteId} podeLancar={podeLancar} vista="lotes" /> : <VisaoGeralNutricao />}
  </div></PaginaFinanceira>;
}
