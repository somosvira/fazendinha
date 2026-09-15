import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, CircleDollarSign, Landmark, Package, Plus, ShieldCheck, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import type { Tab } from "../components/Shell";
import { AnaliseCategorias } from "./AnaliseCategorias";
import { listarCompromissos, listarOperacoes, obterDashboardFinanceiro, type Compromisso, type DashboardFinanceiro, type Operacao } from "./novo-api";
import { brl, Button, dataBR, Empty, ErrorBox, limitesMes, mesAtual, Metric, MonthControl, PageHeader, PaginaCarregando, PaginaFinanceira, Panel, Pill, TIPO_OPERACAO } from "./financeiro-ui";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { abrirRotaNovaOperacao } from "../router";
import { descartarRascunhoOperacao, obterRascunhoOperacao } from "./novo-api";
import { tituloCompromisso } from "./lib/compromissos";

export function VisaoGeralFinanceira({ onNav }: { onNav: (tab: Tab) => void }) {
  const [mes, setMes] = useState(mesAtual());
  const [dados, setDados] = useState<DashboardFinanceiro | null>(null);
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);
  const [ops, setOps] = useState<Operacao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
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
    const { inicio, fim } = limitesMes(mes); setErro(null);
    Promise.all([obterDashboardFinanceiro(inicio, fim), listarCompromissos()])
      .then(([d, c]) => { setDados(d); setCompromissos(c); })
      .catch((e) => setErro(e.message));
  }, [mes]);
  // A base financeira não depende do mês: carrega uma vez e, se falhar, não derruba o painel.
  const [erroBase, setErroBase] = useState<string | null>(null);
  useEffect(() => { listarOperacoes().then(setOps).catch((e) => setErroBase(e.message)); }, []);

  if (!dados && !erro) return <PaginaCarregando label="Carregando financeiro" />;
  const maior = Math.max(...(dados?.despesasPorCategoria.map((x) => Number(x.valor)) ?? [1]), 1);
  const proximos = compromissos
    .filter((c) => ["PENDENTE", "PARCIAL"].includes(c.status))
    .slice(0, 5)
    .map((c) => ({ ...c, operacao: { ...c.operacao, descricao: tituloCompromisso(c) } }));
  // Indicadores da base (antes em Relatórios): todas as operações, sem recorte de mês.
  const confirmadas = ops.filter((o) => o.status === "CONFIRMADA"); const total = confirmadas.reduce((s, o) => s + Number(o.valorTotal), 0); const porTipo = Object.entries(confirmadas.reduce<Record<string, number>>((acc, o) => { acc[o.tipo] = (acc[o.tipo] ?? 0) + Number(o.valorTotal); return acc; }, {})).sort((a, b) => b[1] - a[1]);

  return <PaginaFinanceira>
    <PageHeader titulo="Visão geral financeira" descricao="Disponibilidade atual, dinheiro realizado no período e compromissos futuros — sem misturar previsão com saldo." acao={<div className="flex flex-wrap gap-2"><MonthControl mes={mes} onChange={setMes} /><Button disabled={preparando} onClick={() => { void iniciarNovaOperacao(); }}><Plus size={16} /> Nova operação</Button></div>} />
    <ErrorBox erro={erro} />
    {dados && <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Saldo geral" valor={brl(dados.saldoGeral)} detalhe={`${dados.contas.filter((c) => c.incluirNoSaldoGeral).length} contas na disponibilidade`} icon={WalletCards} />
        <Metric label="Recebimentos" valor={brl(dados.realizado.entradas)} detalhe="Realizados no período" icon={TrendingUp} tone="green" />
        <Metric label="Pagamentos" valor={brl(dados.realizado.saidas)} detalhe="Realizados no período" icon={TrendingDown} tone="red" />
        <Metric label="A pagar" valor={brl(dados.compromissos.aPagar)} detalhe="Não reduz o saldo agora" icon={ArrowUpRight} />
        <Metric label="A receber" valor={brl(dados.compromissos.aReceber)} detalhe="Não aumenta o saldo agora" icon={ArrowDownLeft} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div className="min-w-0"><h2 className="font-serif text-xl">Contas e disponibilidades</h2><p className="mt-1 text-xs text-ink-3">Posição atual calculada pelo extrato</p></div><button onClick={() => onNav("caixinha")} className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-green-800">Ver extratos <ChevronRight size={15} /></button></div>
          <div className="divide-y divide-border">{dados.contas.map((c) => <button key={c.id} onClick={() => onNav("caixinha")} className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4 text-left hover:bg-surface-2"><div className="flex min-w-0 flex-[1_1_180px] items-center gap-3"><div className="shrink-0 rounded-lg bg-[#eef1e9] p-2 text-mast">{c.tipo === "BANCO" ? <Landmark size={17} /> : <WalletCards size={17} />}</div><div className="min-w-0"><div className="break-words font-semibold text-ink">{c.nome}</div><div className="mt-0.5 break-words text-xs text-ink-3">{c.tipo}{c.instituicao ? ` · ${c.instituicao}` : ""}{!c.incluirNoSaldoGeral ? " · fora do saldo geral" : ""}</div></div></div><div className="shrink-0 text-right"><strong className="whitespace-nowrap text-base">{brl(c.saldoAtual)}</strong><div className="mt-1 text-[11px] text-ink-3">saldo atual</div></div></button>)}</div>
        </Panel>
        <Panel>
          <div className="border-b border-border p-5"><h2 className="font-serif text-xl">Despesas realizadas</h2><p className="mt-1 text-xs text-ink-3">Por categoria no período selecionado</p></div>
          <div className="space-y-4 p-5">{dados.despesasPorCategoria.length ? dados.despesasPorCategoria.slice(0, 6).map((item) => <div key={item.categoria}><div className="mb-1.5 flex justify-between gap-4 text-sm"><span className="min-w-0 break-words">{item.categoria}</span><strong className="shrink-0 whitespace-nowrap">{brl(item.valor)}</strong></div><div className="h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-[#78946f]" style={{ width: `${Math.max(6, Number(item.valor) / maior * 100)}%` }} /></div></div>) : <Empty>Nenhum pagamento classificado no período.</Empty>}</div>
        </Panel>
      </div>

      <Panel className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div className="min-w-0"><h2 className="font-serif text-xl">Próximos compromissos</h2><p className="mt-1 text-xs text-ink-3">Agenda financeira — não compõe o saldo atual</p></div><button onClick={() => onNav("gastos")} className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-green-800">Ver todos <ChevronRight size={15} /></button></div>
        {proximos.length ? <div className="divide-y divide-border">{proximos.map((c) => <div key={c.id} className="grid items-center gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto_auto]"><div className="min-w-0"><div className="break-words font-semibold">{c.operacao.descricao || c.operacao.tipo}</div><div className="mt-1 break-words text-xs text-ink-3">{c.parceiro?.nome ?? "Sem parceiro"} · vence em {dataBR(c.dataVencimento)}</div></div>{/* div sempre presente: um `display:none` aqui tiraria a trilha do grid e o valor escorregaria de coluna, desalinhando as linhas sem pill */}<div>{c.vencido && <Pill tone="red">Vencido</Pill>}</div><strong className={`whitespace-nowrap md:text-right ${c.tipo === "RECEBER" ? "text-green-800" : "text-ink"}`}>{brl(c.saldoPendente)}</strong></div>)}</div> : <Empty>Não há compromissos pendentes.</Empty>}
      </Panel>

      <section className="mt-8" aria-labelledby="base-financeira-titulo">
        <h2 id="base-financeira-titulo" className="font-serif text-2xl">Base financeira</h2>
        <p className="mt-2 text-sm text-ink-3">Todas as operações registradas na propriedade, sem o recorte do mês.</p>
        <ErrorBox erro={erroBase} />
        <div className="mt-4 grid gap-4 md:grid-cols-3"><Metric label="Operações confirmadas" valor={String(confirmadas.length)} detalhe="Registros ativos" icon={ShieldCheck} /><Metric label="Volume econômico" valor={brl(total)} detalhe="Soma das operações confirmadas" icon={CircleDollarSign} /><Metric label="Com efeito de estoque" valor={String(ops.filter((o) => o.movimentosEstoque?.length).length)} detalhe="Operações rastreadas fisicamente" icon={Package} /></div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2"><Panel><div className="border-b border-border p-5"><h3 className="font-serif text-xl">Volume por tipo de operação</h3><p className="mt-1 text-xs text-ink-3">Base econômica confirmada</p></div><div className="divide-y divide-border">{porTipo.length ? porTipo.map(([tipo, valor]) => <div key={tipo} className="flex justify-between gap-4 p-4 text-sm"><span className="min-w-0 break-words">{TIPO_OPERACAO[tipo] ?? tipo}</span><strong className="shrink-0 whitespace-nowrap">{brl(valor)}</strong></div>) : <Empty>Nenhuma operação confirmada.</Empty>}</div></Panel><Panel><div className="border-b border-border p-5"><h3 className="font-serif text-xl">Rastreabilidade</h3><p className="mt-1 text-xs text-ink-3">Qualidade da base financeira</p></div><div className="space-y-4 p-5 text-sm"><div className="flex justify-between gap-4"><span className="min-w-0 break-words">Compromissos registrados</span><strong className="shrink-0">{compromissos.length}</strong></div><div className="flex justify-between gap-4"><span className="min-w-0 break-words">Operações canceladas com histórico</span><strong className="shrink-0">{ops.filter((o) => o.status === "CANCELADA").length}</strong></div><div className="flex justify-between gap-4"><span className="min-w-0 break-words">Operações com parceiro identificado</span><strong className="shrink-0">{ops.filter((o) => o.parceiro).length}</strong></div><div className="rounded-lg bg-[#f4f2e9] p-4 text-xs leading-5 text-ink-3">Conciliação bancária ainda não é exibida porque não possui implementação real na API.</div></div></Panel></div>
      </section>

      <AnaliseCategorias />
    </>}
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
