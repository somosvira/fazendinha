import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "../../../components/ui/chart";
import { Panel } from "../../../financeiro/financeiro-ui";
import { navegarPara } from "../../../router";
import { CORES_REBANHO, percentualRebanho } from "./GraficosRebanho";
import type { ReactNode } from "react";

function SuperficieGrafico({ embutido, children }: { embutido: boolean; children: ReactNode }) {
  return embutido ? <section className="pec-distribuicao-embutida">{children}</section> : <Panel className="pec-distribuicao-painel">{children}</Panel>;
}

function rotuloQuantidade(qtd: number, unidade: string) {
  const singular = qtd === 1 ? ({ animais: "animal", tarefas: "tarefa", lotes: "lote" } as Record<string, string>)[unidade] : undefined;
  return `${qtd.toLocaleString("pt-BR", { maximumFractionDigits: 6 })} ${singular ?? unidade}`;
}

export type ItemDistribuicao = { id: string; nome: string; qtd: number; href?: string; detalhe?: string };

/** Gráficos só de contagens/quantidades. Dinheiro permanece nos formatadores exatos do domínio. */
export function DistribuicaoPecuaria({ titulo, descricao, itens, total, centro, rotuloCentro, unidade = "animais", embutido = false }: {
  titulo: string; descricao: string; itens: ItemDistribuicao[]; total: number; centro?: string; rotuloCentro: string; unidade?: string; embutido?: boolean;
}) {
  const dados = itens.filter(i => i.qtd > 0);
  return <SuperficieGrafico embutido={embutido}><header className="pec-grafico-cabecalho"><div>{embutido ? <h3 className="h3">{titulo}</h3> : <h2 className="h3">{titulo}</h2>}<p>{descricao}</p></div></header>
    {!dados.length || total <= 0 ? <p className="pec-grafico-vazio">Sem dados para esta composição.</p> : <div className="pec-distribuicao-corpo">
      <div className="pec-distribuicao-rosca" role="img" aria-label={`${titulo}. Quantidades e percentuais na lista ao lado.`}>
        <ChartContainer config={{ qtd: { label: unidade } }} className="pec-distribuicao-chart" aria-hidden="true"><PieChart><Pie data={dados} dataKey="qtd" nameKey="nome" innerRadius="72%" outerRadius="94%" paddingAngle={dados.length > 1 ? 3 : 0} stroke="none" isAnimationActive={false}>{dados.map((i, indice) => <Cell key={i.id} fill={CORES_REBANHO[indice % CORES_REBANHO.length]} />)}</Pie><ChartTooltip formatter={(qtd, nome) => [`${rotuloQuantidade(Number(qtd), unidade)} · ${percentualRebanho(Number(qtd), total)}`, nome]} /></PieChart></ChartContainer>
        <div className="pec-rosca-centro" aria-hidden="true"><strong>{centro ?? total.toLocaleString("pt-BR")}</strong><span>{rotuloCentro}</span></div>
      </div>
      <ul className="pec-distribuicao-legenda">{dados.map((i, indice) => {
        const conteudo = <><span aria-hidden="true" className="pec-legenda-ponto" style={{ backgroundColor: CORES_REBANHO[indice % CORES_REBANHO.length] }} /><span className="min-w-0 flex-1"><strong title={i.nome} style={{ whiteSpace: "normal", overflow: "visible", textOverflow: "clip", overflowWrap: "anywhere" }}>{i.nome}</strong><small>{i.detalhe ?? rotuloQuantidade(i.qtd, unidade)}</small></span><span className="pec-distribuicao-percentual">{percentualRebanho(i.qtd, total)}</span></>;
        return <li key={i.id}>{i.href ? <button type="button" onClick={() => navegarPara(i.href!)} className="pec-distribuicao-item pec-painel-link">{conteudo}</button> : <div className="pec-distribuicao-item">{conteudo}</div>}</li>;
      })}</ul>
    </div>}
  </SuperficieGrafico>;
}

export function ComparacaoPecuaria({ titulo, descricao, itens, unidade = "animais", inteiro = true, embutido = false }: { titulo: string; descricao: string; itens: ItemDistribuicao[]; unidade?: string; inteiro?: boolean; embutido?: boolean }) {
  return <SuperficieGrafico embutido={embutido}><header className="pec-grafico-cabecalho"><div>{embutido ? <h3 className="h3">{titulo}</h3> : <h2 className="h3">{titulo}</h2>}<p>{descricao}</p></div></header>
    {!itens.length ? <p className="pec-grafico-vazio">Sem dados para comparar.</p> : <div className="pec-comparacao-corpo">
      <ChartContainer config={{ qtd: { label: unidade } }} style={{ height: Math.max(150, itens.length * 30) }} className="pec-comparacao-chart" role="img" aria-label={`${titulo}. Quantidades na lista abaixo.`}>
        <BarChart data={itens} layout="vertical" margin={{ left: 0, right: 12, top: 8, bottom: 0 }} accessibilityLayer><CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 4" /><XAxis type="number" tickFormatter={(valor: number) => valor.toLocaleString("pt-BR", { maximumFractionDigits: 6 })} allowDecimals={!inteiro} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} /><YAxis type="category" dataKey="nome" width={95} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--foreground)" }} /><ChartTooltip formatter={qtd => [rotuloQuantidade(Number(qtd), unidade), "Quantidade"]} cursor={{ fill: "var(--muted)" }} /><Bar dataKey="qtd" radius={[0, 5, 5, 0]} maxBarSize={18} isAnimationActive={false}>{itens.map((i, indice) => <Cell key={i.id} fill={CORES_REBANHO[indice % CORES_REBANHO.length]} />)}</Bar></BarChart>
      </ChartContainer>
      <ul className="pec-comparacao-valores">{itens.map(i => <li key={i.id}>{i.href ? <button type="button" className="pec-painel-link" onClick={() => navegarPara(i.href!)}>{i.nome}: <strong>{rotuloQuantidade(i.qtd, unidade)}</strong></button> : <span>{i.nome}: <strong>{rotuloQuantidade(i.qtd, unidade)}</strong></span>}</li>)}</ul>
    </div>}
  </SuperficieGrafico>;
}
