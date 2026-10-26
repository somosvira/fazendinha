import { AjudaCampo } from "@/components/Dica";
import { SecaoFinanceira } from "./SecaoFinanceira";
import { SkeletonGraficoFinanceiro } from "./CarregamentoFinanceiro";
import { useState } from "react";
import { ChartTypeControl, EntradaSaidaChart, type ChartType } from "../components/charts";
import type { MovimentoConta } from "./novo-api";
import { brl, dataBR, Empty, Panel, TabelaFinanceira } from "./financeiro-ui";
import { fluxoPeriodo } from "./lib/fluxo-contas";
import { periodoDoAnoAtual } from "./lib/periodo";

// O pai determina o período: ano atual no consolidado, período do extrato na conta.
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
  const intervaloInvalido = !!inicio && !!fim && inicio > fim;
  return <Panel tom="info" className="fin-painel mt-4 min-w-0 overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
      <div className="min-w-0"><h2 className="font-serif text-xl">Entradas e saídas<AjudaCampo rotulo="Ajuda: leitura do gráfico" texto={<>{tipoGrafico === "line" ? "Linhas: totais acumulados no período." : `Barras: valores de cada ${diario ? "dia" : "mês"}.`} {consolidado ? "Transferências entre contas próprias não compõem este gráfico." : "Inclui transferências de entrada e saída desta conta."} Estornos aparecem como movimentos na direção oposta, na data em que foram registrados; por isso, os cards mostram movimentações brutas, não valores líquidos de estornos.</>} /></h2><p className="mt-1 text-xs text-ink-3">{escopo} · <span className="capitalize">{rotuloPeriodo}</span></p></div>
      <ChartTypeControl value={tipoGrafico} onChange={setTipoGrafico} />
    </div>
    {intervaloInvalido ? <p role="alert" className="p-4 text-sm">A data final deve ser igual ou posterior à data inicial.</p> : carregando ? <SkeletonGraficoFinanceiro /> : erro ? <p className="p-5 text-sm text-destructive">Não foi possível carregar os dados do gráfico.</p> : entradas === 0 && saidas === 0 ? <Empty>Sem movimentações no período selecionado para este escopo.</Empty> : <>
      <div className="grid gap-4 p-4 sm:grid-cols-2"><div className="rounded-lg bg-[var(--fin-positive-bg)] p-4"><div className="flex items-center gap-2 text-xs font-semibold text-[var(--fin-entrada)]"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--fin-chart-entrada)]" />Entradas no período</div><strong className="mt-2 block tabular-nums font-serif text-2xl text-[var(--fin-entrada)]">{brl(entradas)}</strong></div><div className="rounded-lg bg-muted p-4"><div className="flex items-center gap-2 text-xs font-semibold text-[var(--fin-saida)]"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--fin-chart-saida)]" />Saídas no período</div><strong className="mt-2 block tabular-nums font-serif text-2xl text-[var(--fin-saida)]">{brl(saidas)}</strong></div></div>

      <div role="region" aria-label="Gráfico de entradas e saídas" tabIndex={0} className="px-2 sm:px-3"><EntradaSaidaChart vocabulario="entradas-saidas" compacto data={dados} tipo={tipoGrafico} /></div>
      <div className="m-4"><SecaoFinanceira titulo={`Ver valores por ${diario ? "dia" : "mês"}`}><TabelaFinanceira compacta rotulo={`Valores de entradas e saídas por ${diario ? "dia" : "mês"}`} itens={dados} chaveDe={dia => dia.data} colunas={[
        { chave: "data", titulo: diario ? "Dia" : "Mês", principal: true, celula: dia => dia.rotulo ?? dataBR(dia.data) },
        { chave: "entradas", titulo: "Entradas", alinhamento: "direita", celula: dia => brl(dia.entradas) },
        { chave: "saidas", titulo: "Saídas", alinhamento: "direita", celula: dia => brl(dia.saidas) },
      ]} /></SecaoFinanceira></div>
    </>}

  </Panel>;
}
