import { useEffect, useState } from "react";
import { Button as BotaoDetalhe } from "../../../components/ui/button";
import { DateRangePicker } from "../../../components/DateRangePicker";
import { Button, CabecalhoTabela, ErrorBox, Panel, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { formatBRDateISO } from "../../../lib/hoje";
import { navegarPara } from "../../../router";
import { reqV4 } from "./api";
import { FolhaRelatorioPartos, type SnapshotRelatorioPartos } from "./RelatorioPartos";
import { usePeriodoConsulta } from "./periodo-consulta";

export function PartosPosParto({ propriedadeId }: { propriedadeId: number }) {
  const periodo = usePeriodoConsulta("partos");
  const [snapshot, setSnapshot] = useState<SnapshotRelatorioPartos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [revisao, setRevisao] = useState(0);
  const [aberto, setAberto] = useState<string | null>(null);
  const assinatura = `${propriedadeId}:${periodo.inicio}:${periodo.fim}`;
  const [consultaCarregada, setConsultaCarregada] = useState("");
  useEffect(() => {
    let ativo = true;
    setErro(null); setCarregando(true); setAberto(null);
    const filtros = new URLSearchParams({ propriedadeId: String(propriedadeId), inicio: periodo.inicio, fim: periodo.fim });
    void reqV4<SnapshotRelatorioPartos>(`/reproducao/relatorios/partos?${filtros}`, undefined, "GET", propriedadeId)
      .then(dados => { if (ativo) { setSnapshot(dados); setConsultaCarregada(assinatura); } })
      .catch(e => { if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível consultar os partos."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [propriedadeId, periodo.inicio, periodo.fim, assinatura, revisao]);
  const visivel = consultaCarregada === assinatura && snapshot?.propriedadeId === propriedadeId ? snapshot : null;
  const partos = [...(visivel?.partos ?? [])].sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));
  const detalhe = visivel?.partos.find(p => p.id === aberto);
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">Partos e pós-parto</h2>
      <DateRangePicker value={periodo.range} onChange={periodo.alterar}/>
    </div>
    {periodo.aviso && <p role="status" className="text-sm text-muted-foreground">{periodo.aviso}</p>}
    <ErrorBox erro={erro}/>
    {erro && <Button secondary onClick={() => setRevisao(v => v + 1)}>Tentar novamente</Button>}
    {carregando && <p role="status">Carregando partos…</p>}
    {!carregando && !erro && visivel && <Panel>
      <CabecalhoTabela titulo={`${visivel.totalPartos} partos no período`} descricao="Mais recentes primeiro. O sítio considerado é o local do parto."/>
      {!partos.length ? <div className="space-y-3 p-5"><p>Nenhum parto neste período.</p><p className="text-sm text-muted-foreground">Use o filtro de período para consultar outras datas.</p></div> : <TabelaFinanceira
        rotulo="Partos recentes" itens={partos} chaveDe={p => p.id} colunas={[
          { chave: "data", titulo: "Data", larguraMinima: 110, celula: p => formatBRDateISO(p.data) },
          { chave: "matriz", titulo: "Matriz", principal: true, larguraFlexivel: true, larguraMinima: 260, celula: p => <button className="font-semibold underline" onClick={() => navegarPara(`/pecuaria/rebanho/animais/${p.matriz.id}#reproducao`)}>{p.matriz.brinco}{p.matriz.nome ? ` · ${p.matriz.nome}` : ""}</button> },
          { chave: "desfecho", titulo: "Desfecho", larguraMinima: 110, celula: p => p.desfecho === "ABORTO" ? "Aborto" : p.desfecho === "NASCIMENTO" ? "Nascimento" : "Não informado" },
          { chave: "crias", titulo: "Crias", larguraMinima: 100, celula: p => `${p.crias.length} · ${p.crias.filter(c => c.viva).length} vivas` },
          { chave: "rp", titulo: "Retenção de placenta", larguraMinima: 150, celula: p => p.retencaoPlacenta === null ? "Não informado" : p.retencaoPlacenta ? "Sim" : "Não" },
          { chave: "detalhe", titulo: "", acoes: true, larguraMinima: 140, celula: p => <BotaoDetalhe variant="outline" aria-label={`Ver pós-parto de ${p.matriz.brinco}`} aria-expanded={aberto === p.id} onClick={() => setAberto(aberto === p.id ? null : p.id)}>Ver pós-parto</BotaoDetalhe> },
        ]}/>}
    </Panel>}
    {visivel && detalhe && <Panel><div className="p-5"><FolhaRelatorioPartos snapshot={{ ...visivel, totalPartos: 1, partos: [detalhe] }} operacional/></div></Panel>}
  </div>;
}
