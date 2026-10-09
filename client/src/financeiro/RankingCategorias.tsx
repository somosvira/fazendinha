import { Cell, Pie, PieChart } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MultiSelect } from "../components/MultiSelect";
import type { MonetaryChartItem } from "../components/charts";
import type { Categoria, DashboardFinanceiro } from "./novo-api";
import { brl } from "./financeiro-ui";
import { DialogFinanceiro } from "./DialogFinanceiro";
import { DetalheCategoriaDespesa } from "./DetalheCategoriaDespesa";
import { SEM_VINCULO } from "../lib/ids";

type Props = { despesas: DashboardFinanceiro["despesasPorCategoria"]; categorias: Pick<Categoria, "id" | "nome">[]; inicio?: string; fim?: string };
function LinhasCategorias({ itens, positivos, onSelect }: { itens: MonetaryChartItem[]; positivos: number; onSelect?: (item: MonetaryChartItem) => void }) {
  return <ul aria-label="Ranking de despesas" className="divide-y divide-border">{itens.map(item => {
    const percentual = positivos ? Math.max(0, item.value) / positivos * 100 : 0;
    const conteudo = <><span className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1"><span className="min-w-0 break-words font-medium">{item.label}</span><span className="shrink-0 tabular-nums">{brl(item.value)} <span className="text-xs text-muted-foreground">· {item.value < 0 ? "Estorno" : `${percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}</span></span></span>{item.value > 0 && <span aria-hidden="true" className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-[var(--rural)] opacity-60" style={{ width: `${percentual}%` }} /></span>}</>;
    return <li key={JSON.stringify([item.id, item.label])}>{onSelect ? <Button variant="ghost" className="h-auto w-full flex-col items-start gap-0 whitespace-normal rounded-none px-0 py-2 text-left text-sm font-normal" aria-label={`Detalhar ${item.label}`} onClick={() => onSelect(item)}>{conteudo}</Button> : <div className="py-2 text-sm">{conteudo}</div>}</li>;
  })}</ul>;
}
function PizzaCategorias({ itens, onSelect, onOutras }: { itens: MonetaryChartItem[]; onSelect?: (item: MonetaryChartItem) => void; onOutras: () => void }) {
  const cores = ["var(--leite)", "var(--cafe)", "var(--outros)", "var(--cafe-2)", "var(--outros-2)", "var(--ink-3)"];
  const positivos = itens.filter(item => item.value > 0);
  const principais = positivos.slice(0, 5);
  const restantes = positivos.slice(5);
  const dados = [...principais, ...(restantes.length ? [{ label: "Outras categorias", value: restantes.reduce((soma, item) => soma + Math.round(item.value * 100), 0) / 100 }] : [])].map((item, indice) => ({ ...item, key: `categoria${indice}`, color: cores[indice] }));
  return <ChartContainer role="img" aria-label="Distribuição das despesas por categoria" config={Object.fromEntries(dados.map(item => [item.key, { label: item.label, color: item.color }]))} className="h-32 w-32 shrink-0 aspect-auto sm:h-36 sm:w-36">
    <PieChart accessibilityLayer><Pie data={dados} dataKey="value" nameKey="label" outerRadius="90%" stroke="var(--card)" isAnimationActive={false}>{dados.map((item, indice) => <Cell key={item.key} fill={`var(--color-${item.key})`} cursor="pointer" onClick={() => { if (indice < principais.length) onSelect?.(principais[indice]); else onOutras(); }} />)}</Pie><ChartTooltip formatter={valor => brl(Number(valor))} /></PieChart>
  </ChartContainer>;
}
export function RankingCategorias({ despesas, categorias, inicio, fim }: Props) {
  const [todas, setTodas] = useState(false);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [detalhe, setDetalhe] = useState<MonetaryChartItem[] | null>(null);
  const itens = despesas.map(item => ({ id: item.categoriaId ?? SEM_VINCULO, label: item.categoria, value: Number(item.valor) })).filter(item => item.value !== 0).sort((a, b) => b.value - a.value);
  const total = itens.reduce((soma, item) => soma + Math.round(item.value * 100), 0) / 100;
  const positivos = itens.reduce((soma, item) => soma + Math.max(0, Math.round(item.value * 100)), 0) / 100;
  const options = [...categorias.map(item => ({ value: item.id, label: item.nome })), { value: SEM_VINCULO, label: "Sem categoria" }];
  for (const item of itens) if (!options.some(option => option.value === item.id)) options.push({ value: item.id, label: item.label });
  const filtrados = itens.filter(item => !selecionadas.length || selecionadas.includes(item.id));
  const abrir = inicio && fim ? (item: MonetaryChartItem) => setDetalhe([item]) : undefined;
  return <>
    <Card className="fin-painel min-w-0 gap-0 rounded-lg py-0 shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3"><div><h2>Despesas por categoria</h2><p className="text-xs text-muted-foreground">Total líquido <strong className="text-sm text-foreground tabular-nums">{brl(total)}</strong></p></div><Button variant="link" size="sm" onClick={() => { setSelecionadas([]); setTodas(true); }}>Ver todas</Button></div>
      <div className="px-4 pb-3">{positivos > 0 ? <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center"><PizzaCategorias itens={itens} onSelect={abrir} onOutras={() => { setSelecionadas([]); setTodas(true); }} /><div className="min-w-0 w-full flex-1"><LinhasCategorias itens={itens.filter(item => item.value > 0).slice(0, 5)} positivos={positivos} onSelect={abrir} /></div></div> : <p role="status" className="py-3 text-sm text-muted-foreground">{itens.length ? "Somente estornos no período." : "Nenhuma despesa no período."}</p>}{itens.some(item => item.value < 0) && <p className="pt-2 text-xs text-muted-foreground">Estornos abatem o total. Consulte em Ver todas.</p>}</div>
    </Card>
    {todas && <DialogFinanceiro titulo="Despesas por categoria" eyebrow="Composição dos pagamentos, líquida de estornos" onClose={() => setTodas(false)} className="max-w-3xl"><div className="p-4"><MultiSelect label="Categorias" placeholder="Todas as categorias" options={options} value={selecionadas} onValueChange={setSelecionadas} contentClassName="z-[1300]" /><p className="mt-3 text-sm">Total do filtro: <strong>{brl(filtrados.reduce((soma, item) => soma + Math.round(item.value * 100), 0) / 100)}</strong></p><p className="mt-1 text-xs text-muted-foreground">Percentuais sobre as despesas positivas do período; estornos abatem o total.</p>{filtrados.length ? <LinhasCategorias itens={filtrados} positivos={positivos} onSelect={abrir} /> : <p role="status" className="py-4 text-sm">Nenhuma despesa nas categorias selecionadas.</p>}</div></DialogFinanceiro>}
    {detalhe && inicio && fim && <DetalheCategoriaDespesa categorias={detalhe} inicio={inicio} fim={fim} onClose={() => setDetalhe(null)} />}
  </>;
}
