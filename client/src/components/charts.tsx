/* Gráficos compartilhados do Terrano, renderizados com Recharts. */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { useState } from "react";
import { ChartContainer, ChartLegend, ChartTooltip, type ChartConfig } from "./ui/chart";

export const fmt = (
  n: number,
  opts: { showSign?: boolean; decimals?: number; unit?: string } = {},
): string => {
  const { showSign = false, decimals = 0 } = opts;
  const absVal = Math.abs(n);
  const formatted = absVal.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const sign = n < 0 ? "−" : showSign ? "+" : "";
  return sign + formatted;
};

export const fmtBR = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

export const fmtMoney = (
  kThousands: number,
  opts: { compact?: boolean } = {},
): string => {
  const { compact = true } = opts;
  const abs = Math.abs(kThousands);
  const sign = kThousands < 0 ? "−" : "";
  if (compact && abs >= 1000) {
    return `${sign}R$ ${(abs / 1000).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} mi`;
  }
  return `${sign}R$ ${fmtBR(abs)} mil`;
};

export const fmtMoneyExact = (val: number): string => {
  const abs = Math.abs(val);
  const sign = val < 0 ? "−" : "";
  return `${sign}R$ ${abs.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/** Reais BRUTOS, compacto: exato < R$ 10 mil, "mil" ≥ 10 mil, "mi" ≥ 1 mi. */
export function fmtBRL(n: number, opts: { compact?: boolean; decimals?: number } = {}): string {
  const { compact = true, decimals } = opts;
  if (n === 0) return "R$ 0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (compact && abs >= 1_000_000) {
    return `${sign}R$ ${(abs / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
  }
  if (compact && abs >= 10_000) {
    return `${sign}R$ ${(abs / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} mil`;
  }
  return `${sign}R$ ${abs.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 0,
  })}`;
}

export type ChartType = "line" | "bar";

export function ChartTypeControl({ value, onChange, label = "Tipo do gráfico" }: {
  value: ChartType;
  onChange: (value: ChartType) => void;
  label?: string;
}) {
  return <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-lg border border-border bg-white p-0.5">
    {([['line', 'Linhas'], ['bar', 'Barras']] as const).map(([tipo, texto]) => <button
      key={tipo}
      type="button"
      aria-pressed={value === tipo}
      onClick={() => onChange(tipo)}
      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${value === tipo ? "bg-mast text-white" : "text-ink-2 hover:bg-surface-2"}`}
    >{texto}</button>)}
  </div>;
}

const tooltipMoney = (value: number | string | readonly (number | string)[] | undefined, name: string | number | undefined): [string, string] => [fmtMoneyExact(Number(value ?? 0)), String(name ?? "Valor")];
const chartMargin = { top: 18, right: 18, bottom: 8, left: 18 };
const axisProps = { tick: { fill: "var(--ink-2)", fontSize: 12 }, tickLine: false, axisLine: false } as const;
const fluxoConfig = {
  receitas: { label: "Receitas", color: "var(--pos)" },
  despesas: { label: "Despesas", color: "var(--neg)" },
} satisfies ChartConfig;
const waterfallConfig = {
  receita: { label: "Receita", color: "var(--pos)" },
  custeio: { label: "Custeio", color: "var(--cafe)" },
  saldo: { label: "Saldo", color: "var(--ink)" },
  investimento: { label: "Investimento", color: "var(--outros)" },
  fluxo: { label: "Fluxo", color: "var(--neg)" },
} satisfies ChartConfig;

type FluxoMensal = {
  mes: string;
  receitaLeite: number;
  receitaCafe: number;
  receitaOutros: number;
  custeio: number;
  investimento: number;
};

export function MonthlyFlowChart({ data, tipo = "line" }: { data: FluxoMensal[]; tipo?: ChartType }) {
  const pontos = data.map((item) => ({
    mes: item.mes,
    receitas: item.receitaLeite + item.receitaCafe + item.receitaOutros,
    despesas: item.custeio + item.investimento,
  }));
  return <ChartContainer config={fluxoConfig} className="h-[320px] w-full aspect-auto overflow-hidden" role="img" aria-label="Receitas e despesas mensais">
    <ComposedChart data={pontos} margin={chartMargin} accessibilityLayer>
      <CartesianGrid vertical={false} stroke="var(--rule-soft)" />
      <XAxis dataKey="mes" {...axisProps} />
      <YAxis width={82} tickFormatter={(value) => fmtBRL(Number(value))} {...axisProps} />
      <ChartTooltip formatter={tooltipMoney} />
      <ChartLegend />
      {tipo === "line" ? <>
        <Line type="monotone" dataKey="receitas" name="Receitas" stroke="var(--color-receitas)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
        <Line type="monotone" dataKey="despesas" name="Despesas" stroke="var(--color-despesas)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
      </> : <>
        <Bar dataKey="receitas" name="Receitas" fill="var(--color-receitas)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="despesas" name="Despesas" fill="var(--color-despesas)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </>}
    </ComposedChart>
  </ChartContainer>;
}

type WaterfallStep = {
  key: string;
  label: string;
  value: number;
  type: "receita" | "custeio" | "saldo" | "investimento" | "fluxo";
};

export function WaterfallChart({ data }: { data: WaterfallStep[] }) {
  let acumulado = 0;
  const pontos = data.map((item) => {
    const anterior = acumulado;
    if (!["saldo", "fluxo"].includes(item.type)) acumulado += item.value;
    const total = ["saldo", "fluxo"].includes(item.type) ? acumulado : undefined;
    return {
      ...item,
      faixa: total == null ? [Math.min(anterior, acumulado), Math.max(anterior, acumulado)] : [Math.min(0, total), Math.max(0, total)],
    };
  });
  return <ChartContainer config={waterfallConfig} className="h-[340px] w-full aspect-auto overflow-hidden" role="img" aria-label="Composição do fluxo financeiro">
    <BarChart data={pontos} margin={{ ...chartMargin, bottom: 24 }} accessibilityLayer>
      <CartesianGrid vertical={false} stroke="var(--rule-soft)" />
      <XAxis dataKey="label" interval={0} angle={-15} textAnchor="end" {...axisProps} />
      <YAxis width={82} tickFormatter={(value) => fmtBRL(Number(value))} {...axisProps} />
      <ReferenceLine y={0} stroke="var(--ink-mute)" />
      <ChartTooltip formatter={(_value, _name, item) => [fmtMoneyExact(Number(item.payload.value)), item.payload.label]} />
      <Bar dataKey="faixa" name="Valor" isAnimationActive={false}>{pontos.map((item) => <Cell key={item.key} fill={`var(--color-${item.type})`} />)}</Bar>
    </BarChart>
  </ChartContainer>;
}

export function MiniBarChart({
  data,
  color = "var(--ink)",
  tipo: tipoInicial = "bar",
}: {
  data: { x: string; y: number }[];
  color?: string;
  tipo?: ChartType;
}) {
  const [tipo, setTipo] = useState<ChartType>(tipoInicial);
  const Chart = tipo === "line" ? LineChart : BarChart;
  const config = { valor: { label: "Valor", color } } satisfies ChartConfig;
  return <div className="w-full max-w-[400px]">
    <div className="mb-1 flex justify-end"><ChartTypeControl value={tipo} onChange={setTipo} label="Tipo do gráfico da série" /></div>
    <ChartContainer config={config} className="h-[120px] w-full aspect-auto overflow-hidden" role="img" aria-label="Série de valores">
      <Chart data={data} margin={{ top: 18, right: 8, bottom: 0, left: 8 }} accessibilityLayer>
        <XAxis dataKey="x" interval="preserveStartEnd" {...axisProps} />
        <YAxis hide domain={[0, "auto"]} />
        <ChartTooltip formatter={(value) => [fmt(Number(value ?? 0)), "Valor"]} />
        {tipo === "line"
          ? <Line type="monotone" dataKey="y" stroke="var(--color-valor)" strokeWidth={2.25} dot={{ r: 2.5 }} isAnimationActive={false} />
          : <Bar dataKey="y" fill="var(--color-valor)" radius={[3, 3, 0, 0]} isAnimationActive={false} />}
      </Chart>
    </ChartContainer>
  </div>;
}

export function MonthlyTrendChart({
  current,
  prior,
  labels,
  color = "var(--cafe)",
  tipo = "line",
}: {
  current: number[];
  prior: number[];
  labels: string[];
  color?: string;
  tipo?: ChartType;
}) {
  const data = labels.map((label, indice) => ({ label, atual: current[indice] ?? 0, anterior: prior[indice] ?? 0 }));
  const config = {
    atual: { label: "Período atual", color },
    anterior: { label: "Período anterior", color: "var(--ink-mute)" },
  } satisfies ChartConfig;
  return <ChartContainer config={config} className="h-[220px] w-full aspect-auto overflow-hidden" role="img" aria-label="Comparação da tendência mensal">
    <ComposedChart data={data} margin={chartMargin} accessibilityLayer>
      <CartesianGrid vertical={false} stroke="var(--rule-soft)" />
      <XAxis dataKey="label" {...axisProps} />
      <YAxis {...axisProps} />
      <ChartTooltip />
      <ChartLegend />
      {tipo === "bar" ? <Bar dataKey="atual" name="Período atual" fill="var(--color-atual)" radius={[3, 3, 0, 0]} isAnimationActive={false} /> : <Line type="monotone" dataKey="atual" name="Período atual" stroke="var(--color-atual)" strokeWidth={2.5} isAnimationActive={false} />}
      <Line type="monotone" dataKey="anterior" name="Período anterior" stroke="var(--color-anterior)" strokeDasharray="4 4" isAnimationActive={false} />
    </ComposedChart>
  </ChartContainer>;
}

export function Donut({
  segments,
  size = 140,
  label,
}: {
  segments: { value: number; color: string }[];
  size?: number;
  label?: string;
}) {
  const data = segments.filter((segment) => segment.value > 0);
  const segmentos = data.length ? data : [{ value: 1, color: "var(--rule-soft)" }];
  const config: ChartConfig = Object.fromEntries(segmentos.map((segment, indice) => [`segmento-${indice}`, { color: segment.color }]));
  return <div style={{ width: size, height: size, position: "relative" }}>
    <ChartContainer config={config} className="h-full w-full aspect-auto" role="img" aria-label={label ? `${label} no total` : "Distribuição proporcional"}>
      <PieChart accessibilityLayer>
        <Pie data={segmentos} dataKey="value" innerRadius="68%" outerRadius="88%" paddingAngle={data.length > 1 ? 1 : 0} stroke="none" isAnimationActive={false}>
          {segmentos.map((_segment, indice) => <Cell key={indice} fill={`var(--color-segmento-${indice})`} />)}
        </Pie>
        <ChartTooltip formatter={(value) => [fmt(Number(value ?? 0)), "Quantidade"]} />
      </PieChart>
    </ChartContainer>
    {label && <span className="pointer-events-none absolute inset-0 grid place-items-center font-serif text-lg text-ink">{label}</span>}
  </div>;
}

export type EntradaSaidaPoint = { data: string; rotulo?: string; entradas: number; saidas: number };

/** Linhas mostram a evolução do total; barras preservam o movimento de cada período. */
export function serieEntradaSaida(data: EntradaSaidaPoint[], tipo: ChartType): EntradaSaidaPoint[] {
  if (tipo === "bar") return data;
  let entradas = 0;
  let saidas = 0;
  return data.map((ponto) => {
    entradas += ponto.entradas;
    saidas += ponto.saidas;
    return { ...ponto, entradas, saidas };
  });
}

/** A API devolve um ponto por mês (sempre no dia 1) quando o período cruza meses, e um por dia dentro de um mês. */
export function serieEhMensal(data: EntradaSaidaPoint[]) {
  return data.length > 1 && data.every((ponto) => ponto.data.endsWith("-01")) && new Set(data.map((ponto) => ponto.data.slice(0, 7))).size === data.length;
}

/** Rótulos únicos por ponto: o Recharts localiza o ponto ativo pelo rótulo do eixo, então repetidos travam o tooltip no primeiro. */
export function pontosEntradaSaida(data: EntradaSaidaPoint[], tipo: ChartType) {
  const mensal = data.length > 31 || serieEhMensal(data);
  const mes = (ponto: EntradaSaidaPoint) => new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${ponto.data.slice(0, 7)}-01T00:00:00Z`)).replace(" de ", "/");
  return serieEntradaSaida(data, tipo).map((ponto) => ({
    ...ponto,
    rotuloEixo: ponto.rotulo ?? (mensal ? mes(ponto) : String(Number(ponto.data.slice(8, 10)))),
    rotuloTooltip: ponto.rotulo ?? (mensal ? mes(ponto) : ponto.data.slice(0, 10).split("-").reverse().join("/")),
  }));
}

/** Receitas e despesas em reais, com valores exatos no tooltip. */
export function EntradaSaidaChart({ data, tipo = "line" }: { data: EntradaSaidaPoint[]; tipo?: ChartType }) {
  const pontos = pontosEntradaSaida(data, tipo);
  return <>
    <ChartContainer config={fluxoConfig} className="h-[300px] w-full aspect-auto overflow-hidden" role="img" aria-label={tipo === "line" ? "Totais acumulados de receitas e despesas por dia ou mês" : "Entradas e saídas por dia ou mês, apresentadas como receitas e despesas em reais"}>
      <ComposedChart data={pontos} margin={{ top: 18, right: 18, bottom: 8, left: 24 }} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="var(--rule-soft)" />
        <XAxis dataKey="rotuloEixo" minTickGap={18} interval="preserveStartEnd" {...axisProps} />
        <YAxis width={88} tickFormatter={(value) => fmtBRL(Number(value))} {...axisProps} />
        <ChartTooltip labelFormatter={(_label, payload) => payload?.[0]?.payload?.rotuloTooltip ?? ""} formatter={tooltipMoney} />
        <ChartLegend />
        {tipo === "line" ? <>
          <Line type="linear" dataKey="entradas" name="Receitas" stroke="var(--color-receitas)" strokeWidth={2.5} dot={pontos.length <= 31 ? { r: 2.5 } : false} activeDot={{ r: 5 }} isAnimationActive={false} />
          <Line type="linear" dataKey="saidas" name="Despesas" stroke="var(--color-despesas)" strokeWidth={2.5} dot={pontos.length <= 31 ? { r: 2.5 } : false} activeDot={{ r: 5 }} isAnimationActive={false} />
        </> : <>
          <Bar dataKey="entradas" name="Receitas" fill="var(--color-receitas)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="saidas" name="Despesas" fill="var(--color-despesas)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </>}
      </ComposedChart>
    </ChartContainer>
    <ul className="sr-only" aria-label={tipo === "line" ? "Totais acumulados do gráfico" : "Valores do gráfico"}>{pontos.map((ponto) => <li key={ponto.data}>{ponto.rotulo ?? ponto.data} — Receitas: {fmtMoneyExact(ponto.entradas)}; Despesas: {fmtMoneyExact(ponto.saidas)}</li>)}</ul>
  </>;
}

export function CategoryValueChart({ data, tipo = "bar" }: { data: { categoria: string; valor: number }[]; tipo?: ChartType }) {
  const config = { despesas: { label: "Despesas", color: "var(--neg)" } } satisfies ChartConfig;
  return <ChartContainer config={config} className="h-[300px] w-full aspect-auto overflow-hidden" role="img" aria-label="Despesas realizadas por categoria">
    <ComposedChart data={data} margin={{ top: 18, right: 14, bottom: 38, left: 18 }} accessibilityLayer>
      <CartesianGrid vertical={false} stroke="var(--rule-soft)" />
      <XAxis dataKey="categoria" interval={0} angle={-20} textAnchor="end" height={62} {...axisProps} />
      <YAxis width={82} tickFormatter={(value) => fmtBRL(Number(value))} {...axisProps} />
      <ChartTooltip formatter={(value) => [fmtMoneyExact(Number(value ?? 0)), "Despesas"]} />
      {tipo === "line"
        ? <Line type="monotone" dataKey="valor" name="Despesas" stroke="var(--color-despesas)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
        : <Bar dataKey="valor" name="Despesas" fill="var(--color-despesas)" radius={[3, 3, 0, 0]} isAnimationActive={false} />}
    </ComposedChart>
  </ChartContainer>;
}

/** Distribuição monetária com legenda textual acessível e sem fatias zeradas. */
export function MonetaryDonutChart({ data, label, emptyLabel }: {
  data: { label: string; value: number }[];
  label: string;
  emptyLabel: string;
}) {
  // Só tokens neutros (sem --pos/--neg, que significam ganho/perda) e sem repetir cor:
  // passando de 6 fatias, as menores viram "Outras (N)" para gráfico e legenda casarem.
  const colors = ["var(--leite)", "var(--cafe)", "var(--outros)", "var(--cafe-2)", "var(--outros-2)", "var(--ink-3)"];
  const positivos = data.filter(item => item.value > 0).sort((a, b) => b.value - a.value);
  const visiveis = positivos.length > colors.length ? positivos.slice(0, colors.length - 1) : positivos;
  const agrupados = positivos.slice(visiveis.length);
  const consolidados = agrupados.length ? [...visiveis, { label: `Outras (${agrupados.length})`, value: agrupados.reduce((sum, item) => sum + Math.round(item.value * 100), 0) / 100 }] : visiveis;
  const points = consolidados.map((item, index) => ({ ...item, key: `segmento${index}`, color: colors[index] }));
  const adjustments = data.filter(item => item.value < 0);
  const total = data.reduce((sum, point) => sum + Math.round(point.value * 100), 0) / 100;
  const positiveTotal = points.reduce((sum, point) => sum + Math.round(point.value * 100), 0) / 100;
  const config: ChartConfig = Object.fromEntries(points.map(point => [point.key, { label: point.label, color: point.color }]));
  return <div className="p-5">
    <p className="text-xs text-ink-3">Total do período</p><strong className="mt-1 block font-serif text-2xl">{fmtMoneyExact(total)}</strong>
    {points.length ? <div className="grid min-w-0 items-center gap-4 md:grid-cols-[minmax(200px,.8fr)_minmax(0,1fr)]">
      <ChartContainer config={config} className="h-[260px] w-full aspect-auto overflow-hidden" role="img" aria-label={label}>
        <PieChart accessibilityLayer><Pie data={points} dataKey="value" nameKey="label" innerRadius="58%" outerRadius="85%" stroke="none" paddingAngle={points.length > 1 ? 2 : 0} isAnimationActive={false}>
          {points.map(point => <Cell key={point.key} fill={`var(--color-${point.key})`} />)}
        </Pie><ChartTooltip formatter={tooltipMoney} /></PieChart>
      </ChartContainer>
      <ul aria-label={`Legenda: ${label}`} className="space-y-3 text-sm">{points.map(point => <li key={point.key} className="flex flex-wrap items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: point.color }} /><span className="break-words">{point.label}</span></span>
        <span className="tabular-nums">{fmtMoneyExact(point.value)} · {(point.value / positiveTotal * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>
      </li>)}</ul>
    </div> : <p role="status" className="py-6 text-sm text-ink-3">{emptyLabel}</p>}
    {adjustments.length > 0 && <div className="mt-3 space-y-2 text-sm text-ink-3"><p>Estornos de despesas de outros períodos abatem o total. O gráfico mostra a participação nos valores positivos.</p><ul aria-label="Estornos por categoria">{adjustments.map((item, index) => <li key={index}>{item.label}: {fmtMoneyExact(item.value)}</li>)}</ul></div>}
  </div>;
}
