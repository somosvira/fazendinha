import { Plus, Settings2 } from "lucide-react";
import { ProximosFechamentos } from "./ProximosFechamentos";
import { AlertasNutricao } from "./AlertasNutricao";
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
  const subpagina = !!url.fechamentoId || (url.aba === "lotes" && !!url.loteId);
  return <PaginaFinanceira><ConteudoEstavel contexto={url.aba}><div className="nutricao-pagina" ref={titulo} tabIndex={-1}>
    {!subpagina && !url.formReceita && <><PageHeader titulo={<span className="flex items-center gap-3">Nutrição </span>} acao={<div className="nutricao-cabecalho-acoes"><LinkNutricional className="nutricao-botao-secundario" href="/configuracoes/pecuaria/nutricao"><Settings2 size={18} aria-hidden />Configurações</LinkNutricional>{url.aba !== "receitas" && podeLancar && <LinkNutricional className="nutricao-botao" href={rotaOperacaoNutricional("consumo")}><Plus size={18} aria-hidden />Novo fechamento</LinkNutricional>}</div>} /><SubTabs variant="financeiro" ariaLabel="Nutrição" tabs={[{ id: "lotes", label: "Visão geral" }, { id: "receitas", label: "Receitas" }, { id: "fechamentos", label: "Fechamentos" }, { id: "alertas", label: "Alertas" }]} active={url.aba === "mensal" ? "fechamentos" : url.aba} onSelect={aba => navegarPara(rotaNutricao({ aba }))} /></>}
    {/* A operação abre em painel sobre a consulta de origem, que continua visível ao fundo. */}
    {operacao && (podeLancar ? <FormOperacaoNutricional key={`${operacao}:${url.loteId}:${url.vigenciaId}`} acao={operacao} loteId={url.loteId} vigenciaId={url.vigenciaId} dietaInicialId={url.dietaId} onVoltar={voltar} onSalvo={(loteId) => navegarPara(retornoFichaNutricional() ?? rotaNutricao({ loteId }))} /> : <p role="alert" className="nutricao-aviso">Você não tem permissão para lançar alterações.</p>)}
    {url.fechamentoId ? <ConsultaFechamento key={url.fechamentoId} id={url.fechamentoId} podeLancar={podeLancar} estorno={url.acao === "estorno"} onVoltar={voltar} /> : url.aba === "receitas" ? <ReceitasDieta podeLancar={podeLancar} /> : url.aba === "alertas" ? <><AlertasNutricao podeLancar={podeLancar} /><GestaoMensal podeLancar={podeLancar} vista="alertas" /></> : (url.aba === "fechamentos" || url.aba === "mensal") ? (new URLSearchParams(window.location.search).has("mesId") ? <GestaoMensal podeLancar={podeLancar} vista="mensal" /> : <><ProximosFechamentos podeLancar={podeLancar} loteId={url.loteId} /><GestaoMensal podeLancar={podeLancar} vista="mensal"><section className="nutricao-ultimos"><h2>Últimos fechamentos</h2><FechamentosNutricao loteId={url.loteId} /></section></GestaoMensal></>) : url.loteId ? <NutricaoLote key={url.loteId} loteId={url.loteId} podeLancar={podeLancar} vista="lotes" /> : <VisaoGeralNutricao podeLancar={podeLancar} />}
  </div></ConteudoEstavel></PaginaFinanceira>;
}
