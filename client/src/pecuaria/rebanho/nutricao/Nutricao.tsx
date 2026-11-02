import { ClipboardCheck, Leaf } from "lucide-react";
import { AjudaCampo } from "@/components/Dica";
import { GestaoMensal } from "./GestaoMensal";
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

type Aba = "lotes" | "receitas" | "fechamentos" | "mensal" | "configuracao" | "alertas";
function estadoUrl() {
  const p = new URLSearchParams(window.location.search);
  return { aba: (["receitas", "fechamentos", "mensal", "configuracao", "alertas"].includes(p.get("aba") ?? "") ? p.get("aba") : "lotes") as Aba, loteId: p.get("loteId") || undefined, fechamentoId: p.get("fechamentoId") || undefined, acao: p.get("acao"), vigenciaId: p.get("vigenciaId") || undefined, dietaId: p.get("dietaId") || undefined, formReceita: p.get("formReceita") };
}
export function Nutricao({ podeLancar }: { podeLancar: boolean }) {
  const [url, setUrl] = useState(estadoUrl);
  const titulo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const restaurar = () => {
      const atual = estadoUrl();
      if (atual.aba === "configuracao") { navegarPara("/configuracoes/pecuaria/nutricao/fechamento"); return; }
      setUrl(atual);
    };
    if (estadoUrl().aba === "configuracao") restaurar();
    window.addEventListener("popstate", restaurar); return () => window.removeEventListener("popstate", restaurar);
  }, []);
  useEffect(() => { titulo.current?.focus({ preventScroll: true }); }, [url.aba, url.loteId, url.fechamentoId, url.acao, url.formReceita]);
  const operacao = url.acao === "atribuir" || url.acao === "corrigir" || url.acao === "consumo" ? url.acao : null;
  const voltar = () => navegarPara(rotaRetornoNutricional());
  const subpagina = !!operacao || !!url.fechamentoId || (url.aba === "lotes" && !!url.loteId);
  return <PaginaFinanceira><ConteudoEstavel contexto={url.aba}><div className="nutricao-pagina" ref={titulo} tabIndex={-1}>
    {!subpagina && !url.formReceita && <><PageHeader titulo={<span className="flex items-center gap-3"><Leaf size={28} aria-hidden />Nutrição <AjudaCampo rotulo="Sobre a nutrição" texto="Gerencie receitas, dietas por lote e o consumo confirmado nos fechamentos." /></span>} acao={url.aba === "lotes" ? <LinkNutricional className="nutricao-botao-secundario" href="/configuracoes/pecuaria/nutricao/fechamento">Configurar nutrição</LinkNutricional> : url.aba !== "receitas" && podeLancar ? <LinkNutricional className="nutricao-botao" href={rotaOperacaoNutricional("consumo")}><ClipboardCheck size={18} aria-hidden />Conferir consumo</LinkNutricional> : undefined} /><SubTabs variant="financeiro" ariaLabel="Nutrição" tabs={[{ id: "lotes", label: "Visão geral" }, { id: "receitas", label: "Receitas" }, { id: "fechamentos", label: "Fechamentos" }, { id: "alertas", label: "Alertas" }]} active={url.aba === "mensal" ? "fechamentos" : url.aba} onSelect={aba => navegarPara(rotaNutricao({ aba }))} /></>}
    {operacao ? <div className="nutricao-conteudo">{podeLancar ? <FormOperacaoNutricional key={`${operacao}:${url.loteId}:${url.vigenciaId}`} acao={operacao} loteId={url.loteId} vigenciaId={url.vigenciaId} dietaInicialId={url.dietaId} onVoltar={voltar} onSalvo={(loteId) => navegarPara(retornoFichaNutricional() ?? rotaNutricao({ loteId }))} /> : <p role="alert">Você não tem permissão para lançar alterações.</p>}</div> : url.fechamentoId ? <ConsultaFechamento key={url.fechamentoId} id={url.fechamentoId} podeLancar={podeLancar} estorno={url.acao === "estorno"} onVoltar={voltar} /> : url.aba === "receitas" ? <ReceitasDieta podeLancar={podeLancar} /> : url.aba === "alertas" ? <GestaoMensal podeLancar={podeLancar} vista="alertas" /> : (url.aba === "fechamentos" || url.aba === "mensal") ? <><GestaoMensal podeLancar={podeLancar} vista="mensal" />{!new URLSearchParams(window.location.search).has("mesId") && <section className="mt-8"><h2 className="mb-2 text-lg font-semibold">Fechamentos por período</h2><p className="mb-4 text-ink-3">Histórico e consumo dos lotes que ainda não adotaram o fechamento mensal.</p><FechamentosNutricao loteId={url.loteId} /></section>}</> : url.loteId ? <NutricaoLote key={url.loteId} loteId={url.loteId} podeLancar={podeLancar} vista="lotes" /> : <VisaoGeralNutricao podeLancar={podeLancar} />}
  </div></ConteudoEstavel></PaginaFinanceira>;
}
