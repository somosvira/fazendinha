import { BarraConsulta } from "@/financeiro/BarraConsulta";
import { useEffect, useState } from "react";
import { Button as BotaoDetalhe } from "../../../components/ui/button";
import { DateRangePicker } from "../../../components/DateRangePicker";
import { Button, ErrorBox, Panel, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { formatBRDateISO } from "../../../lib/hoje";
import { navegarPara } from "../../../router";
import { reqV4 } from "./api";
import { type SnapshotRelatorioPartos } from "./RelatorioPartos";
import { Paginacao } from "../ui";
import { usePeriodoConsulta } from "./periodo-consulta";

export function PartosPosParto({ propriedadeId }: { propriedadeId: number }) {
  const periodo = usePeriodoConsulta("partos");
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
  const partos = [...(visivel?.partos ?? [])].sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));
  const paginas=Math.max(1,Math.ceil(partos.length/20)),atual=Math.min(pagina,paginas);
  return <div className="space-y-5">
    <BarraConsulta resumo={visivel ? <span>{visivel.totalPartos} partos no período</span> : undefined}>

      <DateRangePicker value={periodo.range} onChange={r=>{setPagina(1);periodo.alterar(r);}}/>
    </BarraConsulta>
    {periodo.aviso && <p role="status" className="text-sm text-muted-foreground">{periodo.aviso}</p>}
    <ErrorBox erro={erro}/>
    {erro && <Button secondary onClick={() => setRevisao(v => v + 1)}>Tentar novamente</Button>}
    {carregando && <p role="status">Carregando partos…</p>}
    {!carregando && !erro && visivel && <Panel>

      {!partos.length ? <div className="space-y-3 p-5"><p>Nenhum parto neste período.</p><p className="text-sm text-muted-foreground">Use o filtro de período para consultar outras datas.</p></div> : <TabelaFinanceira
        rotulo="Partos recentes" itens={partos.slice((atual-1)*20,atual*20)} chaveDe={p => p.id} colunas={[
          { chave: "data", titulo: "Data", larguraMinima: 110, celula: p => formatBRDateISO(p.data) },
          { chave: "matriz", titulo: "Matriz", principal: true, larguraFlexivel: true, larguraMinima: 260, celula: p => <button className="font-semibold underline" onClick={() => navegarPara(`/pecuaria/rebanho/animais/${p.matriz.id}#reproducao`)}>{p.matriz.brinco}{p.matriz.nome ? ` · ${p.matriz.nome}` : ""}</button> },
          { chave: "desfecho", titulo: "Desfecho", larguraMinima: 110, celula: p => p.desfecho === "ABORTO" ? "Aborto" : p.desfecho === "NASCIMENTO" ? "Nascimento" : "Não informado" },
          { chave: "crias", titulo: "Crias", larguraMinima: 100, celula: p => `${p.crias.length} · ${p.crias.filter(c => c.viva).length} vivas` },
          { chave: "rp", titulo: "Retenção de placenta", larguraMinima: 150, celula: p => p.retencaoPlacenta === null ? "Não informado" : p.retencaoPlacenta ? "Sim" : "Não" },
          { chave: "detalhe", titulo: "", acoes: true, larguraMinima: 140, celula: p => <BotaoDetalhe variant="outline" aria-label={`Ver pós-parto de ${p.matriz.brinco}`} onClick={() => navegarPara(`/pecuaria/reproducao/partos/${p.id}?sitio=${propriedadeId}&retorno=${encodeURIComponent(window.location.pathname+window.location.search)}`)}>Ver parto</BotaoDetalhe> },
        ]}/>}
      {partos.length>20&&<Paginacao paginaAtual={atual} totalPaginas={paginas} totalItens={partos.length} itensPorPagina={20} onPaginaChange={setPagina} rotulo="partos" idSelect="pagina-partos"/>}
    </Panel>}

  </div>;
}
