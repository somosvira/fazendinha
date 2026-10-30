import { AcoesRotinaLeite } from "./CabecalhoRotinaLeite";
import { SelecionarSitioLeite } from "./SelecionarSitioLeite";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { ResumoDestinosLeite } from "./ResumoDestinosLeite";
import { AjudaCampo } from "@/components/Dica";
import { useEffect, useState } from "react";
import { Box, ChartNoAxesCombined, FlaskConical, Milk, Truck, Wallet, Droplets, Settings2, FileText, FileSearch } from "lucide-react";
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
import "./refino-operacional.css";
import "./rotina-leite.css";

const consultas = [
  { id: "ordenhas", nome: "Ordenhas", Icon: Milk },
  { id: "producao", nome: "Produção", Icon: ChartNoAxesCombined },
  { id: "estoque", nome: "Estoque", Icon: Box },
  { id: "coletas", nome: "Coletas", Icon: Truck },
  { id: "qualidade", nome: "Qualidade", Icon: FlaskConical },
  { id: "vendas", nome: "Vendas", Icon: Wallet },
  { id: "destinos", nome: "Alimentação e descarte", Icon: Droplets },
];
const lerSecao = () => {
  const atual = new URLSearchParams(location.search).get("leiteSecao") ?? "ordenhas";
  return atual === "operacoes" || atual === "comercial" ? "vendas" : atual === "custos" ? "producao" : atual;
};
const lerAbaDestinos = () => { const aba=new URLSearchParams(location.search).get("destinosAba");return aba&&["fornecimentos","retiradas","descarte"].includes(aba)?aba:"fornecimentos"; };
export function LeiteModulo({ podeLancar, podeFinanceiro, podeExportar = false, onSelecionarSitio }: {
  podeLancar: boolean; podeFinanceiro: boolean; podeExportar?: boolean; onSelecionarSitio?: (id: number) => void;
}) {
  const sitio = getPropriedadeAtiva();
  const [destinosAba,setDestinosAba] = useState(lerAbaDestinos);
  const [revisaoDestinos, setRevisaoDestinos] = useState(0);
  const [modo, setModo] = useState(() => new URLSearchParams(location.search).get("leiteModo") ?? "geral");
  const [secao, setSecao] = useState(lerSecao);
  const [acoesContainer, setAcoesContainer] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const atualizar = () => { setModo(new URLSearchParams(location.search).get("leiteModo") ?? "geral"); setSecao(lerSecao()); setDestinosAba(lerAbaDestinos); };
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
  const descricoes: Record<string, string> = {
    ordenhas: modo === "registro" ? "Registre o volume desta ordenha, confira as origens e depois confirme o estoque." : modo === "individual" ? "Registre a aferição por animal, uma ordenha de cada vez." : "Confira cada turno e continue os registros que faltam.",
    producao: "Compare os volumes registrados e consulte a cobertura dos custos.",
    estoque: "Consulte o saldo físico confirmado e a origem de cada quantidade.",
    coletas: "Acompanhe as retiradas físicas, mesmo quando o preço ainda não foi definido.",
    qualidade: "Acompanhe amostras e consulte os resultados e seus laudos.",
    vendas: "Reúna coletas, negociação e recebimentos por comprador e período.",
    destinos: "Consulte o destino físico do leite e os vínculos com a nutrição.",
    configuracoes: "Organize a rotina por vigência e mantenha as medições anteriores preservadas.",
    relatorios: "Consulte produção, custos e cobertura antes de exportar.",
    historico: "Confira a proveniência e as pendências da carga histórica.",
    programacao: "Organize as retiradas previstas e acompanhe seus registros.",
  };
  const rotina = consultas.find(c => c.id === secao);
  const IconeRotina = rotina?.Icon ?? Milk;
  return <div className="leite-modulo leite-rotina-reformulada">
    <PageHeader titulo={<><span className="leite-identidade-rotina"><IconeRotina aria-hidden /></span>{secao === "configuracoes" ? "Configurações de produção" : secao === "relatorios" ? "Relatórios do leite" : secao === "historico" ? "Conferir importação" : rotina?.nome ?? "Leite"} <AjudaCampo rotulo="Sobre esta rotina do leite" texto={descricoes[secao] ?? descricoes.ordenhas} /></>} acao={<div className="leite-cabecalho-acoes"><div ref={setAcoesContainer} className="leite-modulo-acoes" /><Button variant="outline" onClick={() => selecionar("configuracoes")} aria-label="Configurações de produção"><Settings2 size={16} aria-hidden />Configurações</Button></div>} />
    <nav aria-label="Produção de leite" className="leite-navegacao leite-sete-rotinas">
      <SubTabs variant="financeiro" ariaLabel="Rotinas do leite" tabs={consultas.map(({ id, nome, Icon }) => ({ id, label: nome, icon: Icon }))} active={secao} onSelect={id => selecionar(id)} />
    </nav>
    <AcoesRotinaLeite.Provider value={acoesContainer}><div className="leite-superficie" data-rotina={secao}>
      {sitio == null ? <SelecionarSitioLeite onSelecionar={onSelecionarSitio}/> : secao === "producao" ? <ConsultasProducaoLeite podeExportar={podeExportar} />
        : secao === "estoque" ? <EstoqueLeite podeLancar={podeLancar} podeFinanceiro={podeFinanceiro} />
        : secao === "coletas" ? <ConsultasComerciaisLeite tipo="coletas" podeLancar={podeLancar} />
        : secao === "vendas" ? <VendasLeite podeLancar={podeLancar} podeFinanceiro={podeFinanceiro} />
        : secao === "destinos" ? <><ResumoDestinosLeite revisao={revisaoDestinos}/><div className="leite-historicos-destinos"><SubTabs variant="financeiro" ariaLabel="Históricos dos destinos" tabs={[{id:"fornecimentos",label:"Fornecimentos"},{id:"retiradas",label:"Casa e Funcionários"},{id:"descarte",label:"Descarte físico"}]} active={destinosAba} onSelect={id=>{setDestinosAba(id);const url=new URL(location.href);url.searchParams.set("destinosAba",id);history.replaceState(history.state,"",url);}}/>
          <div hidden={destinosAba!=="fornecimentos"}><DestinosLeite podeLancar={podeLancar} aoMudou={()=>setRevisaoDestinos(v=>v+1)}/></div>
          <div hidden={destinosAba!=="retiradas"}><DescarteLeite modo="retirada" podeLancar={podeLancar} aoMudou={()=>setRevisaoDestinos(v=>v+1)}/></div>
          <div hidden={destinosAba!=="descarte"}><DescarteLeite podeLancar={podeLancar} aoMudou={()=>setRevisaoDestinos(v=>v+1)}/></div>
        </div></>
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
    </AcoesRotinaLeite.Provider>
    {operacional && <nav className="leite-ferramentas" aria-label="Ferramentas do leite"><Button variant="outline" onClick={() => selecionar("relatorios")}><FileText size={16} aria-hidden />Relatórios</Button><Button variant="outline" onClick={() => selecionar("historico")}><FileSearch size={16} aria-hidden />Conferir importação</Button></nav>}
  </div>;
}
