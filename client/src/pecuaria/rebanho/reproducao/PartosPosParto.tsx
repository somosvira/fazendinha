import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "../../../components/VisualizacaoConsulta";
import { CartaoParto, IdentificacaoReproducao, LinkReproducao } from "./ConsultaReproducaoUI";
import { useFiltrosTabelaLocal } from "@/financeiro/useFiltrosTabelaLocal";
import { BuscaLista } from "@/components/BuscaLista";
import { BarraConsulta } from "@/financeiro/BarraConsulta";
import { useEffect, useState } from "react";
import { DateRangePicker } from "../../../components/DateRangePicker";
import { Button, ErrorBox, Panel, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { formatBRDateISO } from "../../../lib/hoje";
import { reqV4 } from "./api";
import { type SnapshotRelatorioPartos } from "./RelatorioPartos";
import { Paginacao } from "../ui";
import { usePeriodoConsulta } from "./periodo-consulta";

export function PartosPosParto({ propriedadeId }: { propriedadeId: number }) {
  const periodo = usePeriodoConsulta("partos");
  const visual = useVisualizacaoConsulta("visualPartos", "reproducao");
  const [snapshot, setSnapshot] = useState<SnapshotRelatorioPartos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [revisao, setRevisao] = useState(0);
  const [pagina,setPagina]=useState(()=>Math.max(1,Math.floor(Number(new URLSearchParams(window.location.search).get("partosPagina"))||1)));
  useEffect(()=>{const restaurar=()=>setPagina(Math.max(1,Math.floor(Number(new URLSearchParams(window.location.search).get("partosPagina"))||1)));window.addEventListener("popstate",restaurar);return()=>window.removeEventListener("popstate",restaurar);},[]);
  useEffect(()=>{const url=new URL(window.location.href);pagina>1?url.searchParams.set("partosPagina",String(pagina)):url.searchParams.delete("partosPagina");window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);},[pagina]);
  const assinatura = `${propriedadeId}:${periodo.inicio}:${periodo.fim}`;
  const [consultaCarregada, setConsultaCarregada] = useState("");
  useEffect(() => {
    let ativo = true;
    setErro(null); setCarregando(true);
    const filtros = new URLSearchParams({ propriedadeId: String(propriedadeId), inicio: periodo.inicio, fim: periodo.fim });
    void reqV4<SnapshotRelatorioPartos>(`/reproducao/relatorios/partos?${filtros}`, undefined, "GET", propriedadeId)
      .then(dados => { if (ativo) { setSnapshot(dados); setConsultaCarregada(assinatura); } })
      .catch(e => { if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível consultar os partos."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [propriedadeId, periodo.inicio, periodo.fim, assinatura, revisao]);
  const visivel = consultaCarregada === assinatura && snapshot?.propriedadeId === propriedadeId ? snapshot : null;
  const [busca,setBusca] = useState(() => new URLSearchParams(window.location.search).get("partosBusca") ?? "");
  useEffect(() => { const restaurar = () => setBusca(new URLSearchParams(window.location.search).get("partosBusca") ?? ""); window.addEventListener("popstate", restaurar); return () => window.removeEventListener("popstate", restaurar); }, []);
  function buscar(valor: string) { setBusca(valor); setPagina(1); const url = new URL(window.location.href); valor ? url.searchParams.set("partosBusca", valor) : url.searchParams.delete("partosBusca"); window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash); }
  const consulta = useFiltrosTabelaLocal<SnapshotRelatorioPartos["partos"][number]>([
    {chave:"matriz", naBarra: true,rotulo:"Matriz",tipo:"texto",obter:p=>`${p.matriz.brinco} ${p.matriz.nome??""}`},
    {chave:"desfecho",rotulo:"Desfecho",tipo:"opcoes",obter:p=>p.desfecho,opcoes:[{valor:"NASCIMENTO",texto:"Nascimento"},{valor:"ABORTO",texto:"Aborto"}]},
    {chave:"rp",rotulo:"Retenção de placenta",tipo:"opcoes",obter:p=>p.retencaoPlacenta===null?"NAO_INFORMADO":p.retencaoPlacenta?"SIM":"NAO",opcoes:[{valor:"SIM",texto:"Sim"},{valor:"NAO",texto:"Não"},{valor:"NAO_INFORMADO",texto:"Não informado"}]},
  ],()=>setPagina(1));
  const partos = consulta.filtrar(visivel?.partos ?? []).filter(p=>`${p.matriz.brinco} ${p.matriz.nome??""}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR"))).sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));
  const paginas=Math.max(1,Math.ceil(partos.length/20)),atual=Math.min(pagina,paginas);
  return <div className="space-y-5">
    <BarraConsulta campos={consulta.campos} edicaoFiltros={consulta.edicao} criterios={consulta.criterios} acao={<AlternarVisualizacaoConsulta {...visual} rotulo="Visualização de partos"/>} resumo={visivel ? <span>{partos.length} de {visivel.totalPartos} partos no período</span> : undefined}>

      <BuscaLista rotulo="Buscar matriz" placeholder="Brinco ou nome da matriz" valor={busca} onChange={buscar}/>
      <DateRangePicker value={periodo.range} onChange={r=>{setPagina(1);periodo.alterar(r);}}/>
    </BarraConsulta>
    {periodo.aviso && <p role="status" className="text-sm text-muted-foreground">{periodo.aviso}</p>}
    <ErrorBox erro={erro}/>
    {erro && <Button secondary onClick={() => setRevisao(v => v + 1)}>Tentar novamente</Button>}
    {carregando && <p role="status">Carregando partos…</p>}
    {!carregando && !erro && visivel && <Panel>

      {!partos.length ? <div className="space-y-3 p-5"><p>{visivel.partos.length ? "Nenhum parto corresponde à busca ou aos filtros." : "Nenhum parto neste período."}</p>{visivel.partos.length ? <><p className="text-sm text-muted-foreground">Existem {visivel.totalPartos} partos no período selecionado.</p><Button secondary onClick={() => { buscar(""); consulta.edicao.limpar(); consulta.limpar(); }}>Limpar busca e filtros</Button></> : <p className="text-sm text-muted-foreground">Use o filtro de período para consultar outras datas.</p>}</div> : visual.modo === "visual" ? <div className="reproducao-cartoes">{partos.slice((atual-1)*20,atual*20).map(p => <CartaoParto key={p.id} parto={p} sitio={propriedadeId}/>)}</div> : <TabelaFinanceira filtrosColunas={consulta.colunas}
        rotulo="Partos recentes" itens={partos.slice((atual-1)*20,atual*20)} chaveDe={p => p.id} colunas={[
          { chave: "data", titulo: "Data", larguraMinima: 110, celula: p => formatBRDateISO(p.data) },
          { chave: "matriz", titulo: "Matriz", principal: true, larguraFlexivel: true, larguraMinima: 160, celula: p => <IdentificacaoReproducao id={p.matriz.id} brinco={p.matriz.brinco} nome={p.matriz.nome} sitio={propriedadeId}/> },
          { chave: "desfecho", titulo: "Desfecho", larguraMinima: 110, celula: p => p.desfecho === "ABORTO" ? "Aborto" : p.desfecho === "NASCIMENTO" ? "Nascimento" : "Não informado" },
          { chave: "crias", titulo: "Crias", larguraMinima: 100, celula: p => `${p.crias.length} · ${p.crias.filter(c => c.viva).length} vivas` },
          { chave: "rp", titulo: "Retenção de placenta", larguraMinima: 150, celula: p => p.retencaoPlacenta === null ? "Não informado" : p.retencaoPlacenta ? "Sim" : "Não" },
          { chave: "detalhe", titulo: "", acoes: true, larguraMinima: 140, celula: p => <LinkReproducao botao sitio={propriedadeId} href={`/pecuaria/reproducao/partos/${p.id}?retorno=${encodeURIComponent(window.location.pathname+window.location.search)}`}>Ver parto</LinkReproducao> },
        ]}/>}
      {partos.length>20&&<Paginacao paginaAtual={atual} totalPaginas={paginas} totalItens={partos.length} itensPorPagina={20} onPaginaChange={setPagina} rotulo="partos" idSelect="pagina-partos"/>}
    </Panel>}

  </div>;
}
