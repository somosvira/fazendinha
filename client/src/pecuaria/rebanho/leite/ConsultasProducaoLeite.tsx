import { Badge } from '@/components/ui/badge';
import { AjudaCampo } from '@/components/Dica';
import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "@/components/VisualizacaoConsulta";
import { RegistroVisualProducaoLeite } from "./RegistroVisualProducaoLeite";
import type { GrupoProducaoLeite } from "./resumo-producao";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraficoProducaoLeite } from "./GraficoProducaoLeite";
import { PeriodoFinanceiroControl } from "../../../financeiro/PeriodoFinanceiroControl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { TabelaFinanceira, Paginacao } from "../../../financeiro/financeiro-ui";
import { BarraConsulta } from "../../../financeiro/BarraConsulta";
import { CampoFiltro } from "../../../financeiro/PainelFiltros";
import { useRascunhoConsulta } from "../../../financeiro/useRascunhoConsulta";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { consultarLeite } from "./operacoes-api";
import { formatarLitros, hojeOperacional } from "./modelo";
import { CustosLeite } from "./CustosLeite";
import { HistoricoColetivoLeite } from "./HistoricoColetivoLeite";
import "./consultas-leite.css";
type Grupo = GrupoProducaoLeite;
interface Consulta { grupos: Grupo[]; ordenhas: { posicaoId: string; nome: string }[]; coberturaCompleta: boolean; mesEmAndamento: boolean }
const datasVisao = (data: string, visao: string) => ({ inicio: visao === "dia" ? data : `${data.slice(0, 7)}-01`, fim: visao === "dia" ? data : new Date(Date.UTC(Number(data.slice(0, 4)), Number(data.slice(5, 7)), 0)).toISOString().slice(0, 10) });
const iniciais = () => { const q = new URLSearchParams(location.search); const hoje = hojeOperacional(); const valor = q.get("producaoData") ?? hoje; const data = /^\d{4}-\d{2}-\d{2}$/.test(valor) && Number.isFinite(Date.parse(valor)) ? valor : hoje; const visao = q.get("producaoVisao") === "mes" ? "mes" : "dia"; const periodo = datasVisao(data, q.has("producaoVisao") ? visao : "mes"); return { visao, data, natureza: q.get("natureza") ?? "", inicio: q.get("inicio") || periodo.inicio, fim: q.get("fim") || periodo.fim }; };

export function ConsultasProducaoLeite({ podeExportar: _podeExportar = false }: { podeExportar?: boolean }) {
  const visualizacao = useVisualizacaoConsulta("producaoVisualizacao", "leite");
  const [filtros, setFiltros] = useState(iniciais);
  const [dados, setDados] = useState<Consulta | null>(null), [erro, setErro] = useState(""), [revisao, setRevisao] = useState(0);
  const [pagina, setPagina] = useState(1);
  const aplicar = (v: typeof filtros) => { setFiltros(v); setPagina(1); };
  const draft = useRascunhoConsulta(filtros, { visao: "dia", data: hojeOperacional(), natureza: "", ...datasVisao(hojeOperacional(), "mes") }, aplicar);
  const sitio = getPropriedadeAtiva();
  const { data, visao, natureza, inicio, fim } = filtros;
  const periodoInvalido = !inicio || !fim || inicio > fim || !Number.isFinite(Date.parse(inicio)) || !Number.isFinite(Date.parse(fim)) || (Date.parse(fim) - Date.parse(inicio)) / 86400000 >= 366;
  const grupos = dados?.grupos ?? [];
  const totalPaginas = Math.max(1, Math.ceil(grupos.length / 15));
  const paginaAtual = Math.min(pagina, totalPaginas);
  useEffect(() => { const atualizar = () => setFiltros(iniciais()); window.addEventListener("popstate", atualizar); return () => window.removeEventListener("popstate", atualizar); }, []);
  useEffect(() => {
    let ativa = true; setDados(null); setErro("");
    if (periodoInvalido) { setErro("Consulte até 366 dias, com início anterior ao fim."); return; }
    const url = new URL(location.href); url.searchParams.set("producaoVisao", visao); url.searchParams.set("producaoData", data); url.searchParams.set("inicio", inicio); url.searchParams.set("fim", fim); if (natureza) url.searchParams.set("natureza", natureza); else url.searchParams.delete("natureza"); history.replaceState(null, "", url);
    const query = new URLSearchParams({ inicio, fim, agrupamento: visao === "dia" ? "DIA" : "MES", ...(natureza ? { natureza } : {}) });
    void consultarLeite<Consulta>(`/consultas-producao?${query}`, sitio).then(r => { if (ativa) setDados(r); }).catch(e => { if (ativa) setErro(e instanceof Error ? e.message : "Não foi possível consultar a produção."); });
    return () => { ativa = false; };
  }, [inicio, fim, natureza, visao, data, sitio, revisao, periodoInvalido]);
  return <section className="leite-operacoes leite-consultas">
    <BarraConsulta edicaoFiltros={draft} adicionais={<>
      <CampoFiltro rotulo="Consultar produção por"><SelectCampo value={draft.rascunho.visao} onValueChange={v => draft.editar("visao", v)}><option value="dia">Dia</option><option value="mes">Mês</option></SelectCampo></CampoFiltro>
      <CampoFiltro rotulo="Data de produção"><input type="date" value={draft.rascunho.data} onChange={e => { if(e.target.value) { draft.editar("data", e.target.value); const periodo = datasVisao(e.target.value, draft.rascunho.visao); draft.editar("inicio", periodo.inicio); draft.editar("fim", periodo.fim); } }} /></CampoFiltro>
      <CampoFiltro rotulo="Natureza"><SelectCampo value={draft.rascunho.natureza === "A_CLASSIFICAR" ? "" : draft.rascunho.natureza} onValueChange={v => draft.editar("natureza", v)}><option value="">Todas</option><option value="COMERCIAL">Comercial</option><option value="NAO_COMERCIAL">Não comercial</option><option value="COLOSTRO">Colostro</option></SelectCampo></CampoFiltro>
      <CampoFiltro rotulo="Classificação"><span className="leite-checkbox"><input type="checkbox" checked={draft.rascunho.natureza === "A_CLASSIFICAR"} onChange={e => draft.editar("natureza", e.target.checked ? "A_CLASSIFICAR" : "")} />Sem classificação</span></CampoFiltro>
    </>}><PeriodoFinanceiroControl showIcon inicio={inicio} fim={fim} label="Período da produção" onChange={v => aplicar({ ...filtros, ...v, data: v.inicio || data })} /></BarraConsulta>
    {erro ? <p role="alert">{erro} <Button variant="outline" onClick={() => setRevisao(r => r + 1)}>Tentar novamente</Button></p> : !dados ? <p role="status">Consultando produção…</p> : <>
      <div className="leite-producao-controles"><div className="leite-producao-cobertura">{!dados.coberturaCompleta && <Badge variant="outline" role="status">Produção parcial<AjudaCampo rotulo="Sobre a cobertura da produção" texto="Há registros ausentes no período. Ausência não significa produção zero."/></Badge>}{dados.mesEmAndamento && <Badge variant="outline">Mês em andamento</Badge>}</div>
      <div className="leite-agrupamento-producao"><span>Agrupar volumes por</span><Tabs value={visao} onValueChange={v => aplicar({ ...filtros, visao: v })}><TabsList variant="default" aria-label="Agrupamento da produção"><TabsTrigger value="dia">Dia</TabsTrigger><TabsTrigger value="mes">Mês</TabsTrigger></TabsList></Tabs></div></div>
      <div className="leite-producao-painel"><div className="leite-producao-evolucao"><GraficoProducaoLeite grupos={grupos} /></div><section className="leite-producao-registro" aria-label="Consulta dos registros de produção">
      <div className="producao-registro-cabecalho"><h3>Registro da produção</h3><AlternarVisualizacaoConsulta {...visualizacao} rotulo="Visualização da produção" /></div>
      {visualizacao.modo === "visual" ? <RegistroVisualProducaoLeite sitio={sitio} inicio={inicio} fim={fim} grupos={grupos} ordenhas={dados.ordenhas ?? []} data={data} /> : <>
      <TabelaFinanceira visualizacao="tabela" barraRolagemSuperior rotulo="Volumes de produção" itens={grupos.slice((paginaAtual - 1) * 15, paginaAtual * 15)} chaveDe={g => g.periodo} colunas={[
        { chave: "periodo", titulo: visao === "dia" ? "Dia" : "Mês", principal: true, celula: g => g.periodo.split("-").reverse().join("/") },
        ...(dados.ordenhas ?? []).map(o => ({ chave: o.posicaoId, titulo: o.nome, alinhamento: "direita" as const, celula: (g: Grupo) => formatarLitros(g.turnos.find(t => t.posicaoId === o.posicaoId)?.litros ?? null) })),
        { chave: "total", titulo: "Total", alinhamento: "direita", celula: g => <strong>{formatarLitros(g.litros)}</strong> },
        { chave: "cobertura", titulo: "Situação", celula: g => g.completa ? "Completa" : "Parcial" },
      ]} />
      <Paginacao pagina={paginaAtual} totalPaginas={totalPaginas} total={grupos.length} porPagina={15} rotulo="Paginação da produção" substantivo="períodos" idSelect="pagina-producao-leite" onPagina={setPagina} />
      </>}
      </section></div>
    </>}
    {!periodoInvalido && <HistoricoColetivoLeite key={`${sitio}:${inicio}:${fim}`} propriedadeId={sitio} inicio={inicio} fim={fim} />}
    {!periodoInvalido && <CustosLeite periodo={{ inicio, fim, natureza }} />}
  </section>;
}
