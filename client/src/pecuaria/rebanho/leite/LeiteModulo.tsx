import { PageHeader } from "../../../financeiro/financeiro-ui";
import { SubTabs } from "../../../components/SubTabs";
import { Button } from "../../../components/ui/button";
import { useEffect, useState } from "react";
import { PreviaHistoricaLeite } from "./PreviaHistoricaLeite";
import { OperacoesComerciaisLeite } from "./OperacoesComerciaisLeite";
import { ComercialLeite } from "./ComercialLeite";
import { OrdenhasGerais } from "./OrdenhasGerais";
import { Leite } from "./Leite";
import { ConsultasComerciaisLeite } from "./ConsultasComerciaisLeite";
import { ConsultasProducaoLeite } from "./ConsultasProducaoLeite";
import { EstoqueLeite } from "./EstoqueLeite";
import { RelatoriosLeite } from "./RelatoriosLeite";
import { QualidadeLeite } from "./QualidadeLeite";
import { CustosLeite } from "./CustosLeite";
import { ProgramacaoRetirada } from "./UIProgramacaoRetirada";
import { DescarteLeite } from "./DescarteLeite";
import { DestinosLeite } from "./UIDestinosLeite";
import { Box, ChartNoAxesCombined, ChevronDown, FlaskConical, Milk, Truck, Wallet } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import "./operacoes.css";

const consultas = [
  { id: "ordenhas", nome: "Ordenhas", Icon: Milk },
  { id: "producao", nome: "Produção", Icon: ChartNoAxesCombined },
  { id: "estoque", nome: "Estoque", Icon: Box },
  { id: "coletas", nome: "Coletas", Icon: Truck },
  { id: "qualidade", nome: "Qualidade", Icon: FlaskConical },
  { id: "vendas", nome: "Vendas", Icon: Wallet },
];
const rotinas = [
  ["operacoes", "Operações de venda"],
  ["comercial", "Entregas e demonstrativos"],
  ["destinos", "Alimentação e descarte"],
  ["programacao", "Programação de retirada"],
  ["custos", "Ritmo e custos"],
  ["relatorios", "Relatórios preservados"],
  ["historico", "Conferência histórica"],
];
export function LeiteModulo({
  podeLancar,
  podeFinanceiro,
  podeExportar = false,
}: {
  podeLancar: boolean;
  podeFinanceiro: boolean;
  podeExportar?: boolean;
}) {
  const [modo, setModo] = useState(() => new URLSearchParams(location.search).get("leiteModo") ?? "geral");
  const [acoesContainer, setAcoesContainer] = useState<HTMLDivElement | null>(null);
  const [secao, setSecao] = useState(
    () => new URLSearchParams(location.search).get("leiteSecao") ?? "ordenhas",
  );
  useEffect(() => {
    const atualizar = () => {
      setModo(new URLSearchParams(location.search).get("leiteModo") ?? "geral");
      setSecao(
        new URLSearchParams(location.search).get("leiteSecao") ?? "ordenhas",
      );
    };
    window.addEventListener("popstate", atualizar);
    return () => window.removeEventListener("popstate", atualizar);
  }, []);
  function selecionar(valor: string) {
    setSecao(valor);
    const url = new URL(location.href);
    url.searchParams.set("leiteSecao", valor);
    history.replaceState(null, "", url);
  }
  return (
    <div className="leite-modulo">
      <PageHeader titulo="Leite" descricao="Registre cada ordenha e acompanhe a produção da fazenda." acao={<div ref={setAcoesContainer} className="leite-modulo-acoes" />} />
      <nav aria-label="Produção de leite" className="leite-navegacao">
        <SubTabs variant="financeiro" ariaLabel="Consultas do leite" tabs={consultas.map(({ id, nome, Icon }) => ({ id, label: nome, icon: Icon }))} active={secao} onSelect={selecionar} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" type="button" className="leite-mais-rotinas" data-selecionada={rotinas.some(([id]) => id === secao)}>
              {rotinas.find(([id]) => id === secao)?.[1] ?? "Mais rotinas"}
              <ChevronDown size={18} aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="leite-menu-rotinas" aria-label="Mais rotinas do leite">
            {rotinas.map(([id, nome]) => (
              <DropdownMenuItem key={id} aria-current={secao === id ? "page" : undefined} onSelect={() => selecionar(id)}>{nome}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
      <div className="leite-superficie">
      {secao === "producao" ? (
        <ConsultasProducaoLeite podeExportar={podeExportar} />
      ) : secao === "estoque" ? (
        <EstoqueLeite podeLancar={podeLancar} podeFinanceiro={podeFinanceiro} />
      ) : secao === "coletas" || secao === "vendas" ? (
        <ConsultasComerciaisLeite key={secao} tipo={secao} />
      ) : secao === "operacoes" ? (
        <OperacoesComerciaisLeite podeLancar={podeLancar} podeFinanceiro={podeFinanceiro} />
      ) : secao === "comercial" ? (
        <ComercialLeite
          podeLancar={podeLancar}
          podeFinanceiro={podeFinanceiro}
        />
      ) : secao === "destinos" ? (
        <>
          <DestinosLeite podeLancar={podeLancar} />
          <DescarteLeite podeLancar={podeLancar} />
        </>
      ) : secao === "programacao" ? (
        <ProgramacaoRetirada podeLancar={podeLancar} />
      ) : secao === "qualidade" ? (
        <QualidadeLeite podeLancar={podeLancar} />
      ) : secao === "historico" ? (
        <PreviaHistoricaLeite podeLancar={podeLancar} />
      ) : secao === "relatorios" ? (
        <RelatoriosLeite
          podeExportar={podeExportar}
          podeFinanceiro={podeFinanceiro}
        />
      ) : secao === "custos" ? (
        <CustosLeite podeExportar={podeExportar} />
      ) : (
        <>
          <SubTabs variant="financeiro" aparencia="botoes" className="leite-modos" ariaLabel="Forma de aferição" tabs={[{ id: "geral", label: "Produção geral" }, { id: "individual", label: "Controle individual" }]} active={modo} onSelect={id => { setModo(id); const url = new URL(location.href); url.searchParams.set("leiteModo", id); history.replaceState(null, "", url); }} />
          {modo === "individual" ? <><p>Controle individual nas datas aferidas. Não representa a produção de todos os dias entre os controles.</p><Leite podeLancar={podeLancar} acoesContainer={acoesContainer} /></> : <OrdenhasGerais podeLancar={podeLancar} acoesContainer={acoesContainer} />}
        </>
      )}
      </div>
    </div>
  );
}
