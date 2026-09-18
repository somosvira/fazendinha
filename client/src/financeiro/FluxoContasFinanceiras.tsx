import { PeriodoFinanceiroControl } from "./PeriodoFinanceiroControl";
import { useState } from "react";
import { ChartTypeControl, EntradaSaidaChart, type ChartType } from "../components/charts";
import type { MovimentoConta } from "./novo-api";
import { brl, dataBR, Empty, Panel, TabelaFinanceira } from "./financeiro-ui";

import { fluxoPeriodo } from "./lib/fluxo-contas";
import { periodoDoAnoAtual } from "./PeriodoGraficoControl";

export function FluxoContasFinanceiras({ movimentos, consolidado = false, carregando, erro, escopo, periodo, onChangePeriodo }: {
  movimentos: MovimentoConta[];
  consolidado?: boolean;
  carregando: boolean;
  erro: string | null;
  escopo: string;
  periodo: { inicio: string; fim: string };
  onChangePeriodo: (periodo: { inicio: string; fim: string }) => void;
}) {
  const { inicio, fim } = periodo;
  const datas = movimentos.map(m => m.transacao.data.slice(0, 10)).sort();
  const inicioEfetivo = inicio || datas[0] || periodoDoAnoAtual().inicio;
  const fimEfetivo = fim || datas[datas.length - 1] || periodoDoAnoAtual().fim;
  const diario = inicioEfetivo.slice(0, 7) === fimEfetivo.slice(0, 7);
  const [tipoGrafico, setTipoGrafico] = useState<ChartType>("line");
  const dados = fluxoPeriodo(movimentos, inicioEfetivo, fimEfetivo, consolidado);
  const entradas = dados.reduce((soma, dia) => soma + Math.round(dia.entradas * 100), 0) / 100;
  const saidas = dados.reduce((soma, dia) => soma + Math.round(dia.saidas * 100), 0) / 100;
  const rotuloPeriodo = inicio && fim ? `${dataBR(inicio)} a ${dataBR(fim)}` : "Todo o período";
  return <Panel className="mt-6 overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">
      <div className="min-w-0"><h2 className="font-serif text-xl">Receitas e despesas</h2><p className="mt-1 text-xs text-ink-3">{escopo} · <span className="capitalize">{rotuloPeriodo}</span></p></div>
      <ChartTypeControl value={tipoGrafico} onChange={setTipoGrafico} />
    </div>
    <div className="flex flex-wrap items-end gap-2 border-b border-border bg-surface-2 px-5 py-4">
      <PeriodoFinanceiroControl allowAll inicio={inicio} fim={fim} onChange={onChangePeriodo} />
    </div>
    {carregando ? <p role="status" className="p-5">Carregando receitas e despesas…</p> : erro ? <p className="p-5 text-sm text-red-800">Não foi possível carregar os dados do gráfico.</p> : entradas === 0 && saidas === 0 ? <Empty>Sem movimentações no período selecionado para este escopo.</Empty> : <>
      <div className="grid gap-4 p-5 sm:grid-cols-2"><div className="rounded-lg bg-green-50 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-green-900"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--pos)]" />Receitas no período</div><strong className="mt-2 block break-words font-serif text-2xl text-green-900">{brl(entradas)}</strong></div><div className="rounded-lg bg-red-50 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-red-900"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--neg)]" />Despesas no período</div><strong className="mt-2 block break-words font-serif text-2xl text-red-900">{brl(saidas)}</strong></div></div>
      <div role="region" aria-label="Gráfico de receitas e despesas" tabIndex={0} className="px-2 sm:px-5"><EntradaSaidaChart data={dados} tipo={tipoGrafico} /></div>
      <details className="m-5 rounded-lg border border-border"><summary className="cursor-pointer p-3 text-sm font-semibold text-green-800">Ver valores por {diario ? "dia" : "mês"}</summary><TabelaFinanceira rotulo={`Valores de receitas e despesas por ${diario ? "dia" : "mês"}`} itens={dados} chaveDe={dia => dia.data} colunas={[
        { chave: "data", titulo: diario ? "Dia" : "Mês", principal: true, celula: dia => dia.rotulo ?? dataBR(dia.data) },
        { chave: "entradas", titulo: "Receitas", alinhamento: "direita", celula: dia => brl(dia.entradas) },
        { chave: "saidas", titulo: "Despesas", alinhamento: "direita", celula: dia => brl(dia.saidas) },
      ]} /></details>
    </>}
    <p className="border-t border-border px-5 py-3 text-xs text-ink-3">{consolidado ? "Transferências entre contas próprias não compõem este gráfico." : "Inclui transferências de entrada e saída desta conta."} Estornos aparecem como movimentos na direção oposta, na data em que foram registrados; por isso, os cards mostram movimentações brutas, não valores líquidos de estornos.</p>
  </Panel>;
}
