import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Landmark, Plus, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import type { Tab } from "../components/Shell";
import { AnaliseCategorias } from "./AnaliseCategorias";
import { BaseFinanceiraResumo } from "./BaseFinanceiraResumo";
import { descartarRascunhoOperacao, obterRascunhoOperacao, type Compromisso } from "./novo-api";
import { useConfiguracoesFinanceiras, useDashboardFinanceiro } from "./queries";
import { brl, Button, dataBR, ehOfflineSemDados, Empty, ErrorBox, mesAtual, Metric, PageHeader, PaginaCarregando, PaginaFinanceira, Panel, Pill, SemConexaoAviso } from "./financeiro-ui";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { abrirRotaNovaOperacao, navegarPara } from "../router";
import { tituloCompromisso } from "./lib/compromissos";
import { CalendarioCompromissos } from "./CalendarioCompromissos";
import { ControleVisaoCompromissos, type VisaoCompromissos } from "./ControleVisaoCompromissos";
import { LiquidarCompromissoModal } from "./LiquidarCompromissoModal";
import { ChartTypeControl, EntradaSaidaChart, type ChartType } from "../components/charts";
import { PeriodoFinanceiroControl } from "./PeriodoFinanceiroControl";
import { periodoDoAnoAtual } from "./lib/periodo";

export function VisaoGeralFinanceira({ onNav, podeLancar = true }: { onNav: (tab: Tab) => void; podeLancar?: boolean }) {
  const [inicioPeriodo, setInicioPeriodo] = useState(() => periodoDoAnoAtual().inicio);
  const [fimPeriodo, setFimPeriodo] = useState(() => periodoDoAnoAtual().fim);
  const dashboardQuery = useDashboardFinanceiro(inicioPeriodo, fimPeriodo);
  const configQuery = useConfiguracoesFinanceiras();
  const [liquidando, setLiquidando] = useState<Compromisso | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [visao, setVisao] = useState<VisaoCompromissos>("lista");
  const [mesCalendario, setMesCalendario] = useState(mesAtual());
  const [tipoGraficoFluxo, setTipoGraficoFluxo] = useState<ChartType>("line");
  const [substituirRascunho, setSubstituirRascunho] = useState(false);
  const [preparando, setPreparando] = useState(false);
  // Só o cold start (nenhum período já carregado nesta sessão) usa o loader
  // de página cheia — trocar de período depois disso mantém o cabeçalho (com
  // o próprio controle de período) sempre visível, só a área de dados esconde.
  const [carregouAlgumaVez, setCarregouAlgumaVez] = useState(false);
  useEffect(() => { if (dashboardQuery.data) setCarregouAlgumaVez(true); }, [dashboardQuery.data]);

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

  const dadosAtuais = dashboardQuery.data ?? null;
  const pendentes = (dadosAtuais?.proximosCompromissos ?? []).filter(c => ["PENDENTE", "PARCIAL"].includes(c.status))
    .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento) || (a.seq ?? 0) - (b.seq ?? 0));
  const proximos = pendentes.slice(0, 5);
  // `refetch()` de um observer nunca rejeita sozinho — checar `isError` e
  // relançar é o que propaga a falha pro modal de liquidação (ele fecha
  // mesmo assim, e mostra o erro à parte — ver useSalvarOffline).
  const recarregar = async () => {
    const resultado = await dashboardQuery.refetch();
    if (resultado.isError) throw resultado.error;
  };
  // Preserva o período do topo ao abrir a lista completa — mesmo padrão de
  // navegação usado pelos links da Base financeira.
  const hrefCompromissos = `/financeiro/compromissos?${new URLSearchParams({ inicio: inicioPeriodo, fim: fimPeriodo })}`;
  const erroDashboard = dashboardQuery.isError ? (dashboardQuery.error instanceof Error ? dashboardQuery.error.message : String(dashboardQuery.error)) : null;
  if (!dadosAtuais && !carregouAlgumaVez) {
    if (ehOfflineSemDados(dashboardQuery)) return <PaginaFinanceira><PageHeader titulo="Visão geral financeira" descricao="Disponibilidade atual, dinheiro realizado no período e compromissos com vencimento no período selecionado." /><SemConexaoAviso /></PaginaFinanceira>;
    if (dashboardQuery.isPending) return <PaginaCarregando label="Carregando financeiro" />;
  }

  return <PaginaFinanceira>
    <PageHeader titulo="Visão geral financeira" descricao="Disponibilidade atual, dinheiro realizado no período e compromissos com vencimento no período selecionado." acao={<div className="flex flex-wrap items-end gap-2"><PeriodoFinanceiroControl inicio={inicioPeriodo} fim={fimPeriodo} onChange={(periodo) => { setInicioPeriodo(periodo.inicio); setFimPeriodo(periodo.fim); setMesCalendario(periodo.inicio.slice(0, 7)); }} />{podeLancar && <Button disabled={preparando} onClick={() => { void iniciarNovaOperacao(); }}><Plus size={16} /> Nova operação</Button>}</div>} />
    <ErrorBox erro={erro} />
    {erroDashboard && !dadosAtuais && <ErrorBox erro={erroDashboard} />}
    {ehOfflineSemDados(dashboardQuery) && <SemConexaoAviso mensagem="Sem conexão e sem dados salvos para este período." />}
    {!dadosAtuais && !erroDashboard && !ehOfflineSemDados(dashboardQuery) && <p role="status" className="mt-6">Carregando financeiro do período…</p>}
    {dashboardQuery.isFetching && dadosAtuais && <p role="status" className="mt-6">Atualizando financeiro do período…</p>}
    {erroDashboard && !dadosAtuais && <Button secondary onClick={() => dashboardQuery.refetch()}>Tentar novamente</Button>}
    {dadosAtuais && <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Saldo geral" valor={brl(dadosAtuais.saldoGeral)} detalhe="Fotografia atual das contas ativas" icon={WalletCards} />
        <Metric label="Recebimentos" valor={brl(dadosAtuais.realizado.entradas)} detalhe="Realizados no período" icon={TrendingUp} tone="green" />
        <Metric label="Pagamentos" valor={brl(dadosAtuais.realizado.saidas)} detalhe="Realizados no período" icon={TrendingDown} tone="red" />
        <Metric label="A pagar" valor={brl(dadosAtuais.compromissos.aPagar)} detalhe="Saldo pendente por vencimento no período" icon={ArrowUpRight} />
        <Metric label="A receber" valor={brl(dadosAtuais.compromissos.aReceber)} detalhe="Saldo pendente por vencimento no período" icon={ArrowDownLeft} />
      </div>

      <Panel className="mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div className="min-w-0"><h2 className="font-serif text-xl">Próximos compromissos</h2><p className="mt-1 text-xs text-ink-3">Vencimentos no período selecionado no topo; não compõem o saldo atual</p></div><div className="flex flex-wrap items-center gap-4"><ControleVisaoCompromissos visao={visao} onChange={setVisao} /><a href={hrefCompromissos} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navegarPara(hrefCompromissos); } }} className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-green-800">Ver todos <ChevronRight size={15} /></a></div></div>
        {visao === "calendario" ? <CalendarioCompromissos itens={pendentes} mes={mesCalendario} onChangeMes={setMesCalendario} onLiquidar={podeLancar ? setLiquidando : undefined} /> : proximos.length ? <div className="divide-y divide-border">{proximos.map((c) => <div key={c.id} className={`grid items-center gap-3 px-5 py-4 ${podeLancar ? "md:grid-cols-[minmax(0,1fr)_auto_auto_auto]" : "md:grid-cols-[minmax(0,1fr)_auto_auto]"}`}><div className="min-w-0"><div className="break-words font-semibold">{tituloCompromisso(c)}</div><div className="mt-1 break-words text-xs text-ink-3">{c.parceiro?.nome ?? "Sem parceiro"} · vence em {dataBR(c.dataVencimento)}</div></div>{/* div sempre presente: um `display:none` aqui tiraria a trilha do grid e o valor escorregaria de coluna, desalinhando as linhas sem pill */}<div>{c.vencido && <Pill tone="red">Vencido</Pill>}</div><strong className={`whitespace-nowrap md:text-right ${c.tipo === "RECEBER" ? "text-green-800" : "text-ink"}`}>{brl(c.saldoPendente)}</strong>{podeLancar && <Button className="w-full md:w-auto" secondary onClick={() => setLiquidando(c)}>{c.tipo === "PAGAR" ? "Registrar pagamento" : "Registrar recebimento"}</Button>}</div>)}</div> : <Empty>Não há compromissos pendentes com vencimento no período.</Empty>}
      </Panel>

      <BaseFinanceiraResumo base={dadosAtuais.base} realizado={dadosAtuais.realizado} compromissos={dadosAtuais.compromissos} inicio={inicioPeriodo} fim={fimPeriodo} />

      <Panel className="mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div><h2 className="font-serif text-xl">Receitas e despesas</h2><p className="mt-1 text-xs text-ink-3">Realizado no período selecionado no topo</p></div><ChartTypeControl value={tipoGraficoFluxo} onChange={setTipoGraficoFluxo} label="Tipo do gráfico de receitas e despesas" /></div>
        {dadosAtuais.fluxo.some((ponto) => Number(ponto.entradas) !== 0 || Number(ponto.saidas) !== 0)
          ? <div className="p-3 sm:p-5"><EntradaSaidaChart tipo={tipoGraficoFluxo} data={dadosAtuais.fluxo.map((ponto) => ({ data: ponto.data, entradas: Number(ponto.entradas), saidas: Number(ponto.saidas) }))} /></div>
          : <Empty>Nenhuma receita ou despesa realizada no período.</Empty>}
      </Panel>

        <Panel className="mt-6 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div className="min-w-0"><h2 className="font-serif text-xl">Contas e disponibilidade</h2><p className="mt-1 text-xs text-ink-3">Fotografia dos saldos atuais calculados pelo extrato; não é uma soma no período</p></div><button onClick={() => onNav("caixinha")} className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-green-800">Ver extratos <ChevronRight size={15} /></button></div>
          <div className="divide-y divide-border">{dadosAtuais.contas.map((c) => <button key={c.id} onClick={() => onNav("caixinha")} className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4 text-left hover:bg-surface-2"><div className="flex min-w-0 flex-[1_1_180px] items-center gap-3"><div className="shrink-0 rounded-lg bg-[#eef1e9] p-2 text-mast">{c.tipo === "BANCO" ? <Landmark size={17} /> : <WalletCards size={17} />}</div><div className="min-w-0"><div className="break-words font-semibold text-ink">{c.nome}</div><div className="mt-0.5 break-words text-xs text-ink-3">{c.tipo}{c.instituicao ? ` · ${c.instituicao}` : ""}{!c.incluirNoSaldoGeral ? " · fora do saldo geral" : ""}</div></div></div><div className="shrink-0 text-right"><strong className="whitespace-nowrap text-base">{brl(c.saldoAtual)}</strong><div className="mt-1 text-[11px] text-ink-3">saldo atual</div></div></button>)}</div>
        </Panel>
      {configQuery.isError && <ErrorBox erro={configQuery.error instanceof Error ? configQuery.error.message : String(configQuery.error)} />}
      <AnaliseCategorias despesas={dadosAtuais.despesasPorCategoria} categorias={configQuery.data?.categorias ?? []} />
    </>}
    {podeLancar && liquidando && <LiquidarCompromissoModal key={liquidando.id} compromisso={liquidando} contas={configQuery.data?.contas ?? []} onClose={() => setLiquidando(null)} onLiquidado={recarregar} onErro={setErro} />}
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
  </PaginaFinanceira>;
}
