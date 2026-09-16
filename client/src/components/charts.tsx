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
  return <ChartContainer config={fluxoConfig} className="h-[320px] w-full aspect-auto overflow-x-auto" role="img" aria-label="Receitas e despesas mensais">
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
  return <ChartContainer config={waterfallConfig} className="h-[340px] w-full aspect-auto overflow-x-auto" role="img" aria-label="Composição do fluxo financeiro">
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
    <ChartContainer config={config} className="h-[120px] w-full aspect-auto overflow-x-auto" role="img" aria-label="Série de valores">
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
  return <ChartContainer config={config} className="h-[220px] w-full aspect-auto overflow-x-auto" role="img" aria-label="Comparação da tendência mensal">
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

/** Receitas e despesas em reais, com valores exatos no tooltip. */
export function EntradaSaidaChart({ data, tipo = "line" }: { data: EntradaSaidaPoint[]; tipo?: ChartType }) {
  const formatarRotulo = (ponto: EntradaSaidaPoint) => ponto.rotulo ?? (data.length > 31
    ? new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${ponto.data.slice(0, 7)}-01T00:00:00Z`)).replace(" de ", "/")
    : String(Number(ponto.data.slice(8, 10))));
  const pontos = serieEntradaSaida(data, tipo).map((ponto) => ({ ...ponto, rotuloEixo: formatarRotulo(ponto) }));
  return <>
    <ChartContainer config={fluxoConfig} className="h-[300px] w-full aspect-auto overflow-x-auto" role="img" aria-label={tipo === "line" ? "Totais acumulados de receitas e despesas por dia ou mês" : "Entradas e saídas por dia ou mês, apresentadas como receitas e despesas em reais"}>
      <ComposedChart data={pontos} margin={{ top: 18, right: 18, bottom: 8, left: 24 }} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="var(--rule-soft)" />
        <XAxis dataKey="rotuloEixo" minTickGap={18} interval="preserveStartEnd" {...axisProps} />
        <YAxis width={88} tickFormatter={(value) => fmtBRL(Number(value))} {...axisProps} />
        <ChartTooltip labelFormatter={(_label, payload) => payload?.[0]?.payload?.rotulo ?? payload?.[0]?.payload?.data ?? ""} formatter={tooltipMoney} />
        <ChartLegend />
        {tipo === "line" ? <>
          <Line type="monotone" dataKey="entradas" name="Receitas" stroke="var(--color-receitas)" strokeWidth={2.5} dot={pontos.length <= 31 ? { r: 2.5 } : false} activeDot={{ r: 5 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="saidas" name="Despesas" stroke="var(--color-despesas)" strokeWidth={2.5} dot={pontos.length <= 31 ? { r: 2.5 } : false} activeDot={{ r: 5 }} isAnimationActive={false} />
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
  return <ChartContainer config={config} className="h-[300px] w-full aspect-auto overflow-x-auto" role="img" aria-label="Despesas realizadas por categoria">
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
