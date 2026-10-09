import { SecaoFinanceira } from "./SecaoFinanceira";
import { SkeletonGraficoFinanceiro } from "./CarregamentoFinanceiro";
import { useState } from "react";
import { ChartTypeControl, EntradaSaidaChart, type ChartType } from "../components/charts";
import type { MovimentoConta } from "./novo-api";
import { brl, dataBR, Empty, Panel, TabelaFinanceira } from "./financeiro-ui";
import { fluxoPeriodo } from "./lib/fluxo-contas";
import { periodoDoAnoAtual } from "./lib/periodo";

// O período é um único controle compartilhado com o extrato (ExtratoGeral ou
// o painel da conta), renderizado pelo componente pai — não duplicar aqui.
export function FluxoContasFinanceiras({ movimentos, consolidado = false, carregando, erro, escopo, periodo }: {
  movimentos: MovimentoConta[];
  consolidado?: boolean;
  carregando: boolean;
  erro: string | null;
  escopo: string;
  periodo: { inicio: string; fim: string };
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
  return <Panel tom="info" className="fin-painel mt-3 min-w-0 overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
      <div className="min-w-0"><h2 className="font-serif text-xl">Receitas e despesas</h2><p className="mt-1 text-xs text-ink-3">{escopo} · <span className="capitalize">{rotuloPeriodo}</span></p></div>
      <ChartTypeControl value={tipoGrafico} onChange={setTipoGrafico} />
    </div>
    {carregando ? <SkeletonGraficoFinanceiro /> : erro ? <p className="p-5 text-sm text-red-800">Não foi possível carregar os dados do gráfico.</p> : entradas === 0 && saidas === 0 ? <Empty>Sem movimentações no período selecionado para este escopo.</Empty> : <>
      <div className="grid gap-3 p-3 sm:grid-cols-2"><div className="rounded-lg bg-green-50 p-3"><div className="flex items-center gap-2 text-xs font-semibold text-green-900"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--pos)]" />Receitas no período</div><strong className="mt-2 block break-words font-serif text-xl text-green-900">{brl(entradas)}</strong></div><div className="rounded-lg bg-[color-mix(in_srgb,var(--fin-saida)_8%,white)] p-3"><div className="flex items-center gap-2 text-xs font-semibold text-[var(--fin-saida)]"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--fin-saida)]" />Despesas no período</div><strong className="mt-2 block break-words font-serif text-xl text-[var(--fin-saida)]">{brl(saidas)}</strong></div></div>
      <div role="region" aria-label="Gráfico de receitas e despesas" tabIndex={0} className="px-2 sm:px-3"><EntradaSaidaChart compacto data={dados} tipo={tipoGrafico} /></div>
      <div className="m-3"><SecaoFinanceira titulo={`Ver valores por ${diario ? "dia" : "mês"}`}><TabelaFinanceira compacta rotulo={`Valores de receitas e despesas por ${diario ? "dia" : "mês"}`} itens={dados} chaveDe={dia => dia.data} colunas={[
        { chave: "data", titulo: diario ? "Dia" : "Mês", principal: true, celula: dia => dia.rotulo ?? dataBR(dia.data) },
        { chave: "entradas", titulo: "Receitas", alinhamento: "direita", celula: dia => brl(dia.entradas) },
        { chave: "saidas", titulo: "Despesas", alinhamento: "direita", celula: dia => brl(dia.saidas) },
      ]} /></SecaoFinanceira></div>
    </>}
    <p className="border-t border-border px-3 py-2 text-xs text-ink-3">{consolidado ? "Transferências entre contas próprias não compõem este gráfico." : "Inclui transferências de entrada e saída desta conta."} Estornos aparecem como movimentos na direção oposta, na data em que foram registrados; por isso, os cards mostram movimentações brutas, não valores líquidos de estornos.</p>
  </Panel>;
}
