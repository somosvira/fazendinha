import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Landmark, Plus, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import type { Tab } from "../components/Shell";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { abrirRotaNovaOperacao } from "../router";
import { descartarRascunhoOperacao, listarCompromissos, obterConfiguracoesFinanceiras, obterDashboardFinanceiro, obterRascunhoOperacao, type Compromisso, type ConfiguracoesFinanceiras, type DashboardFinanceiro } from "./novo-api";
import { brl, Button, dataBR, Empty, ErrorBox, limitesMes, mesAtual, Metric, PageHeader, PaginaCarregando, PaginaFinanceira, Panel, Pill } from "./financeiro-ui";
import { tituloCompromisso } from "./lib/compromissos";
import { CalendarioCompromissos } from "./CalendarioCompromissos";
import { ControleVisaoCompromissos, type VisaoCompromissos } from "./ControleVisaoCompromissos";
import { LiquidarCompromissoModal } from "./LiquidarCompromissoModal";
import { CategoryValueChart, ChartTypeControl, EntradaSaidaChart, type ChartType } from "../components/charts";
import { PeriodoGraficoControl } from "./PeriodoGraficoControl";

export function VisaoGeralFinanceira({ onNav, podeLancar = true }: { onNav: (tab: Tab) => void; podeLancar?: boolean }) {
  const [inicioPeriodo, setInicioPeriodo] = useState(mesAtual());
  const [fimPeriodo, setFimPeriodo] = useState(mesAtual());
  const [dados, setDados] = useState<DashboardFinanceiro | null>(null);
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);
  const [config, setConfig] = useState<ConfiguracoesFinanceiras | null>(null);
  const [liquidando, setLiquidando] = useState<Compromisso | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [visao, setVisao] = useState<VisaoCompromissos>("lista");
  const [mesCalendario, setMesCalendario] = useState(mesAtual());
  const [tipoGraficoCategorias, setTipoGraficoCategorias] = useState<ChartType>("bar");
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
    const inicio = limitesMes(inicioPeriodo).inicio;
    const fim = limitesMes(fimPeriodo).fim;
    setErro(null);
    Promise.all([obterDashboardFinanceiro(inicio, fim), listarCompromissos(), podeLancar ? obterConfiguracoesFinanceiras() : Promise.resolve(null)])
      .then(([d, c, cfg]) => { if (vigente) { setDados(d); setCompromissos(c); setConfig(cfg); } })
      .catch((e) => { if (vigente) setErro(e.message); });
    return () => { vigente = false; };
  }, [inicioPeriodo, fimPeriodo, podeLancar]);

  if (!dados && !erro) return <PaginaCarregando label="Carregando financeiro" />;
  const pendentes = compromissos
    .filter((c) => ["PENDENTE", "PARCIAL"].includes(c.status))
    .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento) || a.id - b.id);
  const proximos = pendentes.slice(0, 5);
  const recarregar = async () => {
    const inicio = limitesMes(inicioPeriodo).inicio;
    const fim = limitesMes(fimPeriodo).fim;
    const [dashboard, novosCompromissos, configuracoes] = await Promise.all([obterDashboardFinanceiro(inicio, fim), listarCompromissos(), podeLancar ? obterConfiguracoesFinanceiras() : Promise.resolve(null)]);
    setDados(dashboard); setCompromissos(novosCompromissos); setConfig(configuracoes);
  };

  return <PaginaFinanceira>
    <PageHeader titulo="Visão geral financeira" descricao="Disponibilidade atual, dinheiro realizado no período e compromissos futuros — sem misturar previsão com saldo." acao={<div className="flex flex-wrap items-end gap-2"><PeriodoGraficoControl inicio={inicioPeriodo} fim={fimPeriodo} onChange={(periodo) => { setInicioPeriodo(periodo.inicio); setFimPeriodo(periodo.fim); }} />{podeLancar && <Button disabled={preparando} onClick={() => { void iniciarNovaOperacao(); }}><Plus size={16} /> Nova operação</Button>}</div>} />
    <ErrorBox erro={erro} />
    {dados && <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Saldo geral" valor={brl(dados.saldoGeral)} detalhe={`${dados.contas.filter((c) => c.incluirNoSaldoGeral).length} contas na disponibilidade`} icon={WalletCards} />
        <Metric label="Recebimentos" valor={brl(dados.realizado.entradas)} detalhe="Realizados no período" icon={TrendingUp} tone="green" />
        <Metric label="Pagamentos" valor={brl(dados.realizado.saidas)} detalhe="Realizados no período" icon={TrendingDown} tone="red" />
        <Metric label="A pagar" valor={brl(dados.compromissos.aPagar)} detalhe="Não reduz o saldo agora" icon={ArrowUpRight} />
        <Metric label="A receber" valor={brl(dados.compromissos.aReceber)} detalhe="Não aumenta o saldo agora" icon={ArrowDownLeft} />
      </div>

      <Panel className="mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div><h2 className="font-serif text-xl">Receitas e despesas</h2><p className="mt-1 text-xs text-ink-3">Realizado no período selecionado no topo</p></div><ChartTypeControl value={tipoGraficoFluxo} onChange={setTipoGraficoFluxo} label="Tipo do gráfico de receitas e despesas" /></div>
        {dados.fluxo.some((ponto) => Number(ponto.entradas) !== 0 || Number(ponto.saidas) !== 0)
          ? <div className="p-3 sm:p-5"><EntradaSaidaChart tipo={tipoGraficoFluxo} data={dados.fluxo.map((ponto) => ({ data: ponto.data, entradas: Number(ponto.entradas), saidas: Number(ponto.saidas) }))} /></div>
          : <Empty>Nenhuma receita ou despesa realizada no período.</Empty>}
      </Panel>

      <Panel className="mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div className="min-w-0"><h2 className="font-serif text-xl">Próximos compromissos</h2><p className="mt-1 text-xs text-ink-3">Agenda financeira — não compõe o saldo atual</p></div><div className="flex flex-wrap items-center gap-4"><ControleVisaoCompromissos visao={visao} onChange={setVisao} /><button onClick={() => onNav("gastos")} className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-green-800">Ver todos <ChevronRight size={15} /></button></div></div>
        {visao === "calendario" ? <CalendarioCompromissos itens={pendentes} mes={mesCalendario} onChangeMes={setMesCalendario} onLiquidar={podeLancar ? setLiquidando : undefined} /> : proximos.length ? <div className="divide-y divide-border">{proximos.map((c) => <div key={c.id} className={`grid items-center gap-3 px-5 py-4 ${podeLancar ? "md:grid-cols-[minmax(0,1fr)_auto_auto_auto]" : "md:grid-cols-[minmax(0,1fr)_auto_auto]"}`}><div className="min-w-0"><div className="break-words font-semibold">{tituloCompromisso(c)}</div><div className="mt-1 break-words text-xs text-ink-3">{c.parceiro?.nome ?? "Sem parceiro"} · vence em {dataBR(c.dataVencimento)}</div></div>{/* div sempre presente: um `display:none` aqui tiraria a trilha do grid e o valor escorregaria de coluna, desalinhando as linhas sem pill */}<div>{c.vencido && <Pill tone="red">Vencido</Pill>}</div><strong className={`whitespace-nowrap md:text-right ${c.tipo === "RECEBER" ? "text-green-800" : "text-ink"}`}>{brl(c.saldoPendente)}</strong>{podeLancar && <Button className="w-full md:w-auto" secondary onClick={() => setLiquidando(c)}>{c.tipo === "PAGAR" ? "Registrar pagamento" : "Registrar recebimento"}</Button>}</div>)}</div> : <Empty>Não há compromissos pendentes.</Empty>}
      </Panel>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div className="min-w-0"><h2 className="font-serif text-xl">Contas e disponibilidades</h2><p className="mt-1 text-xs text-ink-3">Posição atual calculada pelo extrato</p></div><button onClick={() => onNav("caixinha")} className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-green-800">Ver extratos <ChevronRight size={15} /></button></div>
          <div className="divide-y divide-border">{dados.contas.map((c) => <button key={c.id} onClick={() => onNav("caixinha")} className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4 text-left hover:bg-surface-2"><div className="flex min-w-0 flex-[1_1_180px] items-center gap-3"><div className="shrink-0 rounded-lg bg-[#eef1e9] p-2 text-mast">{c.tipo === "BANCO" ? <Landmark size={17} /> : <WalletCards size={17} />}</div><div className="min-w-0"><div className="break-words font-semibold text-ink">{c.nome}</div><div className="mt-0.5 break-words text-xs text-ink-3">{c.tipo}{c.instituicao ? ` · ${c.instituicao}` : ""}{!c.incluirNoSaldoGeral ? " · fora do saldo geral" : ""}</div></div></div><div className="shrink-0 text-right"><strong className="whitespace-nowrap text-base">{brl(c.saldoAtual)}</strong><div className="mt-1 text-[11px] text-ink-3">saldo atual</div></div></button>)}</div>
        </Panel>
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div><h2 className="font-serif text-xl">Despesas realizadas</h2><p className="mt-1 text-xs text-ink-3">Por categoria no período selecionado no topo</p></div><ChartTypeControl value={tipoGraficoCategorias} onChange={setTipoGraficoCategorias} label="Tipo do gráfico de despesas por categoria" /></div>
          <div className="p-3 sm:p-5">{dados.despesasPorCategoria.length ? <CategoryValueChart tipo={tipoGraficoCategorias} data={dados.despesasPorCategoria.slice(0, 6).map((item) => ({ categoria: item.categoria, valor: Number(item.valor) }))} /> : <Empty>Nenhum pagamento classificado no período.</Empty>}</div>
        </Panel>
      </div>


    </>}
    {podeLancar && liquidando && <LiquidarCompromissoModal key={liquidando.id} compromisso={liquidando} contas={config?.contas ?? []} onClose={() => setLiquidando(null)} onLiquidado={recarregar} onErro={setErro} />}
    <ConfirmDialog
      open={substituirRascunho}
      title="Criar uma nova operação?"
      message={<><p>Você já tem um rascunho de operação em andamento.</p><p className="mt-2">Para iniciar uma nova operação, o rascunho atual será descartado. Os dados preenchidos e documentos anexados serão excluídos permanentemente.</p></>}
      confirmLabel="Criar mesmo assim"
      cancelLabel="Ver rascunho atual"
      cancelTone="safe"
      tone="danger"
      dangerFilled
      processando={preparando}
      onCancel={verRascunhoAtual}
      onDismiss={() => setSubstituirRascunho(false)}
      onConfirm={() => { void descartarEIniciar(); }}
    />
  </PaginaFinanceira>;
}
