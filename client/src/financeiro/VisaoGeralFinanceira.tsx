import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Landmark, Plus, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import type { Tab } from "../components/Shell";
import { Loader } from "../components/Loading";
import { listarCompromissos, obterDashboardFinanceiro, type Compromisso, type DashboardFinanceiro } from "./novo-api";
import { brl, Button, dataBR, Empty, ErrorBox, limitesMes, mesAtual, Metric, MonthControl, PageHeader, Panel, Pill } from "./financeiro-ui";

export function VisaoGeralFinanceira({ onNav }: { onNav: (tab: Tab) => void }) {
  const [mes, setMes] = useState(mesAtual());
  const [dados, setDados] = useState<DashboardFinanceiro | null>(null);
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const { inicio, fim } = limitesMes(mes); setErro(null);
    Promise.all([obterDashboardFinanceiro(inicio, fim), listarCompromissos()])
      .then(([d, c]) => { setDados(d); setCompromissos(c); })
      .catch((e) => setErro(e.message));
  }, [mes]);

  if (!dados && !erro) return <Loader label="Carregando financeiro" />;
  const maior = Math.max(...(dados?.despesasPorCategoria.map((x) => Number(x.valor)) ?? [1]), 1);
  const proximos = compromissos.filter((c) => ["PENDENTE", "PARCIAL"].includes(c.status)).slice(0, 5);

  return <div className="shell-wide pb-10">
    <PageHeader titulo="Visão geral financeira" descricao="Disponibilidade atual, dinheiro realizado no período e compromissos futuros — sem misturar previsão com saldo." acao={<div className="flex flex-wrap gap-2"><MonthControl mes={mes} onChange={setMes} /><Button onClick={() => onNav("lancar")}><Plus size={16} /> Nova operação</Button></div>} />
    <ErrorBox erro={erro} />
    {dados && <>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric label="Saldo geral" valor={brl(dados.saldoGeral)} detalhe={`${dados.contas.filter((c) => c.incluirNoSaldoGeral).length} contas na disponibilidade`} icon={WalletCards} />
        <Metric label="Recebimentos" valor={brl(dados.realizado.entradas)} detalhe="Realizados no período" icon={TrendingUp} tone="green" />
        <Metric label="Pagamentos" valor={brl(dados.realizado.saidas)} detalhe="Realizados no período" icon={TrendingDown} tone="red" />
        <Metric label="A pagar" valor={brl(dados.compromissos.aPagar)} detalhe="Não reduz o saldo agora" icon={ArrowUpRight} />
        <Metric label="A receber" valor={brl(dados.compromissos.aReceber)} detalhe="Não aumenta o saldo agora" icon={ArrowDownLeft} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <Panel>
          <div className="flex items-center justify-between border-b border-border p-5"><div><h2 className="font-serif text-xl">Contas e disponibilidades</h2><p className="mt-1 text-xs text-ink-3">Posição atual calculada pelo extrato</p></div><button onClick={() => onNav("caixinha")} className="flex items-center gap-1 text-sm font-semibold text-green-800">Ver extratos <ChevronRight size={15} /></button></div>
          <div className="divide-y divide-border">{dados.contas.map((c) => <button key={c.id} onClick={() => onNav("caixinha")} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-surface-2"><div className="flex items-center gap-3"><div className="rounded-lg bg-[#eef1e9] p-2 text-mast">{c.tipo === "BANCO" ? <Landmark size={17} /> : <WalletCards size={17} />}</div><div><div className="font-semibold text-ink">{c.nome}</div><div className="mt-0.5 text-xs text-ink-3">{c.tipo}{c.instituicao ? ` · ${c.instituicao}` : ""}{!c.incluirNoSaldoGeral ? " · fora do saldo geral" : ""}</div></div></div><div className="text-right"><strong className="text-base">{brl(c.saldoAtual)}</strong><div className="mt-1 text-[11px] text-ink-3">saldo atual</div></div></button>)}</div>
        </Panel>
        <Panel>
          <div className="border-b border-border p-5"><h2 className="font-serif text-xl">Despesas realizadas</h2><p className="mt-1 text-xs text-ink-3">Por categoria no período selecionado</p></div>
          <div className="space-y-4 p-5">{dados.despesasPorCategoria.length ? dados.despesasPorCategoria.slice(0, 6).map((item) => <div key={item.categoria}><div className="mb-1.5 flex justify-between gap-4 text-sm"><span>{item.categoria}</span><strong>{brl(item.valor)}</strong></div><div className="h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-[#78946f]" style={{ width: `${Math.max(6, Number(item.valor) / maior * 100)}%` }} /></div></div>) : <Empty>Nenhum pagamento classificado no período.</Empty>}</div>
        </Panel>
      </div>

      <Panel className="mt-6">
        <div className="flex items-center justify-between border-b border-border p-5"><div><h2 className="font-serif text-xl">Próximos compromissos</h2><p className="mt-1 text-xs text-ink-3">Agenda financeira — não compõe o saldo atual</p></div><button onClick={() => onNav("gastos")} className="flex items-center gap-1 text-sm font-semibold text-green-800">Ver todos <ChevronRight size={15} /></button></div>
        {proximos.length ? <div className="divide-y divide-border">{proximos.map((c) => <div key={c.id} className="grid items-center gap-3 px-5 py-4 md:grid-cols-[1fr_auto_auto]"><div><div className="font-semibold">{c.operacao.descricao || c.operacao.tipo}</div><div className="mt-1 text-xs text-ink-3">{c.parceiro?.nome ?? "Sem parceiro"} · vence em {dataBR(c.dataVencimento)}</div></div><div>{c.vencido && <Pill tone="red">Vencido</Pill>}</div><strong className={c.tipo === "RECEBER" ? "text-green-800" : "text-ink"}>{brl(c.saldoPendente)}</strong></div>)}</div> : <Empty>Não há compromissos pendentes.</Empty>}
      </Panel>
    </>}
  </div>;
}
