import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EntradaSaidaChart } from "../components/charts";
import type { MovimentoConta } from "./novo-api";
import { brl, dataBR, Empty, mesAtual, MonthControl, Panel, TabelaFinanceira } from "./financeiro-ui";
import { deslocarMes, nomeMes } from "./lib/calendario";
import { fluxoDiario } from "./lib/fluxo-contas";

export function FluxoContasFinanceiras({ movimentos, consolidado = false, carregando, erro, escopo }: {
  movimentos: MovimentoConta[];
  consolidado?: boolean;
  carregando: boolean;
  erro: string | null;
  escopo: string;
}) {
  const [mes, setMes] = useState(mesAtual());
  const dados = fluxoDiario(movimentos, mes, consolidado);
  const entradas = dados.reduce((soma, dia) => soma + Math.round(dia.entradas * 100), 0) / 100;
  const saidas = dados.reduce((soma, dia) => soma + Math.round(dia.saidas * 100), 0) / 100;
  return <Panel className="mt-6 overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">
      <div className="min-w-0"><h2 className="font-serif text-xl">Entradas e saídas</h2><p className="mt-1 text-xs text-ink-3">{escopo} · <span className="capitalize">{nomeMes(mes)}</span></p></div>
      <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 sm:w-auto sm:gap-2"><button type="button" aria-label="Mês anterior do gráfico" onClick={() => setMes(deslocarMes(mes, -1))} className="rounded-lg border border-border p-2 hover:bg-surface-2"><ChevronLeft size={18} /></button><div className="min-w-0 [&_input]:min-w-0 [&_input]:w-full [&_input]:text-xs sm:[&_input]:text-sm [&_label]:min-w-0 [&_label]:px-2 [&_svg]:hidden"><MonthControl mes={mes} onChange={valor => { if (valor) setMes(valor); }} /></div><button type="button" aria-label="Próximo mês do gráfico" onClick={() => setMes(deslocarMes(mes, 1))} className="rounded-lg border border-border p-2 hover:bg-surface-2"><ChevronRight size={18} /></button></div>
    </div>
    {carregando ? <p role="status" className="p-5">Carregando entradas e saídas…</p> : erro ? <p className="p-5 text-sm text-red-800">Não foi possível carregar os dados do gráfico.</p> : entradas === 0 && saidas === 0 ? <Empty>Sem movimentações neste mês para as contas exibidas.</Empty> : <>
      <div className="grid gap-4 p-5 sm:grid-cols-2"><div className="rounded-lg bg-green-50 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-green-900"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--pos)]" />Entradas no mês</div><strong className="mt-2 block break-words font-serif text-2xl text-green-900">{brl(entradas)}</strong></div><div className="rounded-lg bg-red-50 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-red-900"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--neg)]" />Saídas no mês</div><strong className="mt-2 block break-words font-serif text-2xl text-red-900">{brl(saidas)}</strong></div></div>
      <div role="region" aria-label="Gráfico diário de entradas e saídas" tabIndex={0} className="overflow-x-auto px-5"><div style={{ minWidth: 960 }}><EntradaSaidaChart data={dados} /></div></div>
      <p className="px-5 py-2 text-xs text-ink-3 md:hidden">Deslize o gráfico para ver os outros dias do mês.</p>
      <details className="m-5 rounded-lg border border-border"><summary className="cursor-pointer p-3 text-sm font-semibold text-green-800">Ver valores por dia</summary><TabelaFinanceira rotulo="Valores diários de entradas e saídas" itens={dados} chaveDe={dia => dia.data} colunas={[
        { chave: "data", titulo: "Dia", principal: true, celula: dia => dataBR(dia.data) },
        { chave: "entradas", titulo: "Entradas", alinhamento: "direita", celula: dia => brl(dia.entradas) },
        { chave: "saidas", titulo: "Saídas", alinhamento: "direita", celula: dia => brl(dia.saidas) },
      ]} /></details>
    </>}
    <p className="border-t border-border px-5 py-3 text-xs text-ink-3">{consolidado ? "Transferências entre contas próprias não compõem este gráfico." : "Inclui transferências de entrada e saída desta conta."} Estornos aparecem como movimentos na direção oposta, na data em que foram registrados.</p>
  </Panel>;
}
