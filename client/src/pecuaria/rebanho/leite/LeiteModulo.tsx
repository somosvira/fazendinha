import { useEffect, useState } from "react";
import { Box, ChartNoAxesCombined, FlaskConical, Milk, Truck, Wallet, Baby, Settings2, FileText, FileSearch } from "lucide-react";
import { PageHeader } from "../../../financeiro/financeiro-ui";
import { SubTabs } from "../../../components/SubTabs";
import { Button } from "../../../components/ui/button";
import { navegarPara } from "../../../router";
import { executarComGuardaNavegacao } from "../../../navegacaoGuardada";
import { PreviaHistoricaLeite } from "./PreviaHistoricaLeite";
import { OrdenhasGerais } from "./OrdenhasGerais";
import { ConfiguracoesProducaoLeite } from "./ConfiguracoesProducaoLeite";
import { Leite } from "./Leite";
import { ConsultasComerciaisLeite } from "./ConsultasComerciaisLeite";
import { ConsultasProducaoLeite } from "./ConsultasProducaoLeite";
import { EstoqueLeite } from "./EstoqueLeite";
import { RelatoriosLeite } from "./RelatoriosLeite";
import { QualidadeLeite } from "./QualidadeLeite";
import { VendasLeite } from "./VendasLeite";
import { ProgramacaoRetirada } from "./UIProgramacaoRetirada";
import { DescarteLeite } from "./DescarteLeite";
import { DestinosLeite } from "./UIDestinosLeite";
import "./operacoes.css";

const consultas = [
  { id: "ordenhas", nome: "Ordenhas", Icon: Milk },
  { id: "producao", nome: "Produção", Icon: ChartNoAxesCombined },
  { id: "estoque", nome: "Estoque", Icon: Box },
  { id: "coletas", nome: "Coletas", Icon: Truck },
  { id: "qualidade", nome: "Qualidade", Icon: FlaskConical },
  { id: "vendas", nome: "Vendas", Icon: Wallet },
  { id: "destinos", nome: "Alimentação e descarte", Icon: Baby },
];
const lerSecao = () => {
  const atual = new URLSearchParams(location.search).get("leiteSecao") ?? "ordenhas";
  return atual === "operacoes" || atual === "comercial" ? "vendas" : atual === "custos" ? "producao" : atual;
};
export function LeiteModulo({ podeLancar, podeFinanceiro, podeExportar = false }: {
  podeLancar: boolean; podeFinanceiro: boolean; podeExportar?: boolean;
}) {
  const [modo, setModo] = useState(() => new URLSearchParams(location.search).get("leiteModo") ?? "geral");
  const [secao, setSecao] = useState(lerSecao);
  const [acoesContainer, setAcoesContainer] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const atualizar = () => { setModo(new URLSearchParams(location.search).get("leiteModo") ?? "geral"); setSecao(lerSecao()); };
    window.addEventListener("popstate", atualizar);
    return () => window.removeEventListener("popstate", atualizar);
  }, []);
  function selecionar(valor: string, forma?: string) {
    const url = new URL(location.href);
    url.searchParams.set("leiteSecao", valor);
    if (forma) url.searchParams.set("leiteModo", forma);
    void executarComGuardaNavegacao(() => navegarPara(url.pathname + url.search + url.hash));
  }
  const operacional = consultas.some(c => c.id === secao);
  return <div className="leite-modulo">
    <PageHeader titulo={secao === "configuracoes" ? "Configurações de produção" : secao === "relatorios" ? "Relatórios do leite" : secao === "historico" ? "Conferir importação" : "Leite"} acao={<div className="leite-cabecalho-acoes"><div ref={setAcoesContainer} className="leite-modulo-acoes" /><Button variant="outline" onClick={() => selecionar("configuracoes")} aria-label="Configurações de produção"><Settings2 size={16} aria-hidden />Configurações</Button></div>} />
    <nav aria-label="Produção de leite" className="leite-navegacao leite-sete-rotinas">
      <SubTabs variant="financeiro" ariaLabel="Rotinas do leite" tabs={consultas.map(({ id, nome, Icon }) => ({ id, label: nome, icon: Icon }))} active={secao} onSelect={id => selecionar(id)} />
    </nav>
    <div className="leite-superficie">
      {secao === "producao" ? <ConsultasProducaoLeite podeExportar={podeExportar} />
        : secao === "estoque" ? <EstoqueLeite podeLancar={podeLancar} podeFinanceiro={podeFinanceiro} />
        : secao === "coletas" ? <ConsultasComerciaisLeite tipo="coletas" podeLancar={podeLancar} />
        : secao === "vendas" ? <VendasLeite podeLancar={podeLancar} podeFinanceiro={podeFinanceiro} />
        : secao === "destinos" ? <><DestinosLeite podeLancar={podeLancar} /><DescarteLeite podeLancar={podeLancar} /></>
        : secao === "qualidade" ? <QualidadeLeite podeLancar={podeLancar} />
        : secao === "historico" ? <PreviaHistoricaLeite podeLancar={podeLancar} />
        : secao === "relatorios" ? <RelatoriosLeite podeExportar={podeExportar} podeFinanceiro={podeFinanceiro} />
        : secao === "programacao" ? <ProgramacaoRetirada podeLancar={podeLancar} />
        : secao === "configuracoes" ? <><ConfiguracoesProducaoLeite podeLancar={podeLancar} /><ProgramacaoRetirada podeLancar={podeLancar} /></>
        : <>
          {modo !== "registro" && <SubTabs variant="financeiro" aparencia="botoes" className="leite-modos" ariaLabel="Forma de aferição" tabs={[{ id: "geral", label: "Ordenhas registradas" }, { id: "individual", label: "Controle individual" }]} active={modo} onSelect={id => selecionar("ordenhas", id)} />}
          {modo === "individual" ? <Leite podeLancar={podeLancar} acoesContainer={acoesContainer} /> : <OrdenhasGerais podeLancar={podeLancar} acoesContainer={acoesContainer} />}
        </>}
    </div>
    {operacional && <nav className="leite-ferramentas" aria-label="Ferramentas do leite"><Button variant="outline" onClick={() => selecionar("relatorios")}><FileText size={16} aria-hidden />Relatórios</Button><Button variant="outline" onClick={() => selecionar("historico")}><FileSearch size={16} aria-hidden />Conferir importação</Button></nav>}
  </div>;
}
