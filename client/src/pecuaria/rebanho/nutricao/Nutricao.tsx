import { AjudaCampo } from "@/components/Dica";
import { SubTabs } from "../../../components/SubTabs";
import { ConteudoEstavel } from "../../../components/ConteudoEstavel";
import { useEffect, useRef, useState } from "react";
import { PageHeader, PaginaFinanceira } from "../../../financeiro/financeiro-ui";
import { navegarPara } from "../../../router";
import { NutricaoLote } from "./NutricaoLote";
import { ReceitasDieta } from "./ReceitasDieta";
import { ConsultaFechamento } from "./ConsultaFechamento";
import { VisaoGeralNutricao } from "./VisaoGeralNutricao";
import { FechamentosNutricao } from "./FechamentosNutricao";
import { FormOperacaoNutricional } from "./FormOperacaoNutricional";
import { retornoFichaNutricional, rotaOperacaoNutricional, rotaRetornoNutricional } from "./navegacao";
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
  useEffect(() => { titulo.current?.focus({ preventScroll: true }); }, [url.aba, url.loteId, url.fechamentoId, url.acao, url.formReceita]);
  const operacao = url.acao === "atribuir" || url.acao === "corrigir" || url.acao === "consumo" ? url.acao : null;
  const voltar = () => navegarPara(rotaRetornoNutricional());
  const subpagina = !!operacao || !!url.fechamentoId || (url.aba === "lotes" && !!url.loteId);
  return <PaginaFinanceira><ConteudoEstavel contexto={url.aba}><div className="nutricao-pagina" ref={titulo} tabIndex={-1}>
    {!subpagina && !url.formReceita && <><PageHeader titulo={<>Nutrição <AjudaCampo rotulo="Sobre a nutrição" texto="Gerencie receitas, dietas por lote e o consumo confirmado nos fechamentos." /></>} acao={url.aba !== "receitas" && podeLancar ? <LinkNutricional className="nutricao-botao" href={rotaOperacaoNutricional("consumo")}>Conferir consumo</LinkNutricional> : undefined} /><SubTabs variant="financeiro" ariaLabel="Nutrição" tabs={[{ id: "lotes", label: "Visão geral" }, { id: "receitas", label: "Receitas" }, { id: "fechamentos", label: "Fechamentos" }]} active={url.aba} onSelect={aba => navegarPara(rotaNutricao({ aba }))} /></>}
    {operacao ? <div className="nutricao-conteudo">{podeLancar ? <FormOperacaoNutricional key={`${operacao}:${url.loteId}:${url.vigenciaId}`} acao={operacao} loteId={url.loteId} vigenciaId={url.vigenciaId} onVoltar={voltar} onSalvo={(loteId) => navegarPara(retornoFichaNutricional() ?? rotaNutricao({ loteId }))} /> : <p role="alert">Você não tem permissão para lançar alterações.</p>}</div> : url.fechamentoId ? <ConsultaFechamento key={url.fechamentoId} id={url.fechamentoId} podeLancar={podeLancar} estorno={url.acao === "estorno"} onVoltar={voltar} /> : url.aba === "receitas" ? <ReceitasDieta podeLancar={podeLancar} /> : url.aba === "fechamentos" ? <FechamentosNutricao loteId={url.loteId} /> : url.loteId ? <NutricaoLote key={url.loteId} loteId={url.loteId} podeLancar={podeLancar} vista="lotes" /> : <VisaoGeralNutricao />}
  </div></ConteudoEstavel></PaginaFinanceira>;
}
