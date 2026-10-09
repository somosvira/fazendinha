import { useTelaPequena } from "./useTelaPequena";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import "./dashboard-grid.css";
import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus, TrendingDown, TrendingUp } from "lucide-react";
import type { Tab } from "../components/Shell";
import { AnaliseCategorias } from "./AnaliseCategorias";
import { descartarRascunhoOperacao, obterConfiguracoesFinanceiras, obterDashboardFinanceiro, obterRascunhoOperacao, type Compromisso, type ConfiguracoesFinanceiras, type DashboardFinanceiro } from "./novo-api";
import { brl, Empty, ErrorBox, mesAtual, PaginaCarregando, PaginaFinanceira } from "./financeiro-ui";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { abrirRotaNovaOperacao, navegarPara } from "../router";
import { IndicadorFinanceiro, ContasDisponibilidade, resumoVencidos } from "./DashboardResumo";
import { DashboardListaModal, type TipoListaDashboard } from "./DashboardListaModal";
import { DashboardCalendario } from "./DashboardCalendario";
import { DashboardCompromissos } from "./DashboardCompromissos";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LiquidarCompromissoModal } from "./LiquidarCompromissoModal";
import { ChartTypeControl, EntradaSaidaChart, type ChartType } from "../components/charts";
import { PeriodoFinanceiroControl } from "./PeriodoFinanceiroControl";
import { periodoDoAnoAtual } from "./lib/periodo";

export function VisaoGeralFinanceira({ onNav, podeLancar = true }: { onNav: (tab: Tab) => void; podeLancar?: boolean }) {
  const [inicioPeriodo, setInicioPeriodo] = useState(() => periodoDoAnoAtual().inicio);
  const [fimPeriodo, setFimPeriodo] = useState(() => periodoDoAnoAtual().fim);
  const [dados, setDados] = useState<DashboardFinanceiro | null>(null);
  const [config, setConfig] = useState<ConfiguracoesFinanceiras | null>(null);
  const [listaAberta, setListaAberta] = useState<TipoListaDashboard | null>(null);
  const [liquidando, setLiquidando] = useState<Compromisso | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroConfig, setErroConfig] = useState<string | null>(null);
  const [mesCalendario, setMesCalendario] = useState(mesAtual());
  const [carregando, setCarregando] = useState(true);
  const [revisao, setRevisao] = useState(0);
  const [periodoDados, setPeriodoDados] = useState("");
  const [tipoGraficoFluxo, setTipoGraficoFluxo] = useState<ChartType>("line");
  const [substituirRascunho, setSubstituirRascunho] = useState(false);
  const [preparando, setPreparando] = useState(false);

  // Mesmo cuidado de Compromissos: um rascunho em andamento só é descartado
  // depois de confirmação, e "Ver rascunho atual" é a saída segura.
  const abrirFormulario = () => { abrirRotaNovaOperacao(); onNav("lancar"); };
  const iniciarNovaOperacao = async () => {
    setPreparando(true); setErro(null);
    try {
      if (await obterRascunhoOperacao()) setSubstituirRascunho(true);
      else abrirFormulario();
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { setPreparando(false); }
  };
  const descartarEIniciar = async () => {
    setPreparando(true); setErro(null);
    try { await descartarRascunhoOperacao(); setSubstituirRascunho(false); abrirFormulario(); }
    catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { setPreparando(false); }
  };
  const verRascunhoAtual = () => { setSubstituirRascunho(false); abrirFormulario(); };

  useEffect(() => {
    let vigente = true;
    setDados(null); setCarregando(true); setErro(null);
    obterDashboardFinanceiro(inicioPeriodo, fimPeriodo)
      .then(d => { if (vigente) { setDados(d); setPeriodoDados(`${inicioPeriodo}/${fimPeriodo}`); } })
      .catch(e => { if (vigente) setErro(e.message); })
      .finally(() => { if (vigente) setCarregando(false); });
    return () => { vigente = false; };
  }, [inicioPeriodo, fimPeriodo, revisao]);
  useEffect(() => {
    let vigente = true;
    // Falha aqui não deve poluir o erro/"Tentar novamente" do painel principal:
    // config só alimenta o filtro de categorias e a lista de contas do modal
    // de liquidação, ambos com um estado próprio para se degradar sem o dado.
    obterConfiguracoesFinanceiras().then(cfg => { if (vigente) setConfig(cfg); }).catch(e => { if (vigente) setErroConfig(e instanceof Error ? e.message : String(e)); });
    return () => { vigente = false; };
  }, []);
  const dadosAtuais = periodoDados === `${inicioPeriodo}/${fimPeriodo}` ? dados : null;
  const pendentes = (dadosAtuais?.proximosCompromissos ?? []).filter(c => ["PENDENTE", "PARCIAL"].includes(c.status))
    .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento) || a.seq - b.seq);
  const recarregar = async () => { setRevisao(value => value + 1); };
  // Preserva o período do topo ao abrir a lista completa — mesmo padrão de
  // navegação usado pelos links da Base financeira.
  const pequena = useTelaPequena();
  const hrefCompromissos = `/financeiro/compromissos?${new URLSearchParams({ inicio: inicioPeriodo, fim: fimPeriodo })}`;
  if (!periodoDados && carregando && !erro) return <PaginaCarregando label="Carregando financeiro" />;

  const painelAgenda = dadosAtuais && (<DashboardCompromissos integrado resumo={<div className="grid grid-cols-2 gap-2"><IndicadorFinanceiro label="A pagar" valor={dadosAtuais.compromissos.aPagar} detalhe={resumoVencidos(pendentes, "PAGAR")} alerta={pendentes.some(item => item.vencido && item.tipo === "PAGAR")} icon={ArrowUpRight} onClick={() => setListaAberta("pagar")} /><IndicadorFinanceiro label="A receber" valor={dadosAtuais.compromissos.aReceber} detalhe={resumoVencidos(pendentes, "RECEBER")} alerta={pendentes.some(item => item.vencido && item.tipo === "RECEBER")} icon={ArrowDownLeft} onClick={() => setListaAberta("receber")} /></div>} itens={pendentes} href={hrefCompromissos} onLiquidar={podeLancar ? setLiquidando : undefined} />);
  const painelCalendario = dadosAtuais && <DashboardCalendario integrado itens={pendentes} href={hrefCompromissos} mes={mesCalendario} onChangeMes={setMesCalendario} onLiquidar={podeLancar ? setLiquidando : undefined} />;
  const painelCompromissos = dadosAtuais && <Card className="fin-painel dashboard-compromissos min-w-0 gap-0 overflow-hidden rounded-lg py-0 shadow-none"><h2 className="px-4 pt-4">Compromissos</h2><div className="grid min-w-0 items-start lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">{painelAgenda}{painelCalendario}</div></Card>;
  const painelContas = dadosAtuais && (<ContasDisponibilidade contas={dadosAtuais.contas} onAbrir={() => onNav("caixinha")} />);
  const painelFluxo = dadosAtuais && (<Card data-fin-tom="info" className="fin-painel min-w-0 gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none">
          <div className="fin-cabecalho flex flex-wrap items-center justify-between gap-2 p-4 pb-2"><div><h2 className="font-serif text-xl">Recebimentos e pagamentos</h2><p className="mt-1 text-sm text-muted-foreground">{tipoGraficoFluxo === "line" ? "Acumulado no período" : "Realizado por dia ou mês"}</p></div><div className="flex flex-wrap items-center gap-3"><ChartTypeControl value={tipoGraficoFluxo} onChange={setTipoGraficoFluxo} label="Tipo do gráfico de receitas e despesas" />          <div className="dashboard-resultado flex flex-col items-end gap-0 border-l border-border pl-3"><span className="text-xs text-muted-foreground">Resultado de caixa</span><strong className={`font-serif text-2xl tabular-nums ${Number(dadosAtuais.realizado.resultado) < 0 ? "text-destructive" : "text-[var(--pos)]"}`}>{Number(dadosAtuais.realizado.resultado) > 0 ? "+" : ""}{brl(dadosAtuais.realizado.resultado)}</strong><p className="sr-only">Recebimentos − pagamentos · inclui aportes e retiradas</p></div></div></div>

          <div className="grid grid-cols-2 gap-2 px-4 pb-2"><IndicadorFinanceiro label="Recebimentos" valor={dadosAtuais.realizado.entradas} detalhe="Realizados no período" icon={TrendingUp} onClick={() => setListaAberta("recebimentos")} /><IndicadorFinanceiro label="Pagamentos" valor={dadosAtuais.realizado.saidas} detalhe="Realizados no período" icon={TrendingDown} onClick={() => setListaAberta("pagamentos")} /></div>
          {dadosAtuais.fluxo.some(ponto => Number(ponto.entradas) !== 0 || Number(ponto.saidas) !== 0)
            ? <div className="p-3"><EntradaSaidaChart compacto tipo={tipoGraficoFluxo} data={dadosAtuais.fluxo.map(ponto => ({ data: ponto.data, entradas: Number(ponto.entradas), saidas: Number(ponto.saidas) }))} /></div>
            : <Empty>Nenhum recebimento ou pagamento realizado no período.</Empty>}
        </Card>);
  const painelCategorias = dadosAtuais && (<AnaliseCategorias compacto inicio={inicioPeriodo} fim={fimPeriodo} despesas={dadosAtuais.despesasPorCategoria} categorias={config?.categorias ?? []} />);

  return <PaginaFinanceira colorida><div className="dashboard-financeiro">
    <header className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div><h1 className="h2">Visão geral financeira</h1><p className="mt-1 text-sm text-muted-foreground">Seu caixa, compromissos e movimentações em um só lugar.</p></div>
      <div className="flex flex-wrap items-center gap-2"><PeriodoFinanceiroControl inicio={inicioPeriodo} fim={fimPeriodo} onChange={periodo => { setInicioPeriodo(periodo.inicio); setFimPeriodo(periodo.fim); setMesCalendario(periodo.inicio.slice(0, 7)); }} />{podeLancar && <Button disabled={preparando} onClick={() => { void iniciarNovaOperacao(); }}><Plus />Nova operação</Button>}</div>
    </header>
    <ErrorBox erro={erro} />
    {(carregando || (!dadosAtuais && !erro)) && <p role="status" className="mt-6">Carregando financeiro do período…</p>}
    {erro && !dadosAtuais && <Button variant="outline" onClick={() => setRevisao(value => value + 1)}>Tentar novamente</Button>}
    {dadosAtuais && <>
      {pequena ? <Tabs defaultValue="agenda" className="mt-3 min-w-0">
        <TabsList aria-label="Seções da visão geral" className="fin-abas grid h-auto w-full grid-cols-3"><TabsTrigger value="agenda">Agenda</TabsTrigger><TabsTrigger value="analises">Análises</TabsTrigger><TabsTrigger value="contas">Contas</TabsTrigger></TabsList>
        <TabsContent value="agenda">{painelCompromissos}</TabsContent>
        <TabsContent value="analises">      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
        {painelFluxo}
        {painelCategorias}
      </div>
</TabsContent>
        <TabsContent value="contas">{painelContas}</TabsContent>
      </Tabs> : <>
      <div className="dashboard-principal mt-4 grid min-w-0 items-stretch gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        {painelFluxo}
        {painelContas}
      </div>
      <div className="dashboard-analises mt-4 grid min-w-0 gap-4">
        {painelCompromissos}
        {painelCategorias}
      </div>
</>}
      <ErrorBox erro={erroConfig} />

    </>}
    {listaAberta && <DashboardListaModal tipo={listaAberta} inicio={inicioPeriodo} fim={fimPeriodo} pendentes={pendentes} onClose={() => setListaAberta(null)} />}
    {podeLancar && liquidando && <LiquidarCompromissoModal key={liquidando.id} compromisso={liquidando} contas={config?.contas ?? []} onClose={() => setLiquidando(null)} onLiquidado={recarregar} onErro={setErro} />}
    <ConfirmDialog
      open={substituirRascunho}
      title="Criar uma nova operação?"
      message={<><p>Você já tem um rascunho de operação em andamento.</p><p className="mt-2">Para iniciar uma nova operação, o rascunho atual será descartado. Os dados preenchidos e documentos anexados serão excluídos permanentemente.</p></>}
      confirmLabel="Criar mesmo assim"
      cancelLabel="Ver rascunho atual"
      cancelTone="safe"
      tone="danger"
      processando={preparando}
      onCancel={verRascunhoAtual}
      onDismiss={() => setSubstituirRascunho(false)}
      onConfirm={() => { void descartarEIniciar(); }}
    />
  </div></PaginaFinanceira>;
}
