// Gráfico de linha da evolução do peso do animal — só a curva de peso (decisão #3 do
// plano "telas finais da v1"); gráficos agregados do lote ficam para depois. Usa o
// wrapper compartilhado client/src/components/ui/chart.tsx (Recharts), como o financeiro.

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "../../../components/ui/chart";
import type { HistoricoPesagem } from "../types";
import { formatarDataBR } from "../lib/rotulos";
import { formatarKg } from "../lib/peso";

/** Rótulo PT-BR por tipo de pesagem — espelha o mapa usado na tabela de pesagens. */
export const ROTULO_TIPO_PESAGEM: Record<string, string> = {
  NASCIMENTO: "Nascimento", ENTRADA: "Entrada", DESMAMA: "Desmama", ROTINA: "Rotina", SAIDA: "Saída",
};

const config = { peso: { label: "Peso", color: "var(--cafe)" } } satisfies ChartConfig;

const axisProps = { tick: { fill: "var(--ink-2)", fontSize: 12 }, tickLine: false, axisLine: false } as const;

export function GraficoPeso({ historicoPesagens }: { historicoPesagens: HistoricoPesagem[] }) {
  // a ficha traz as pesagens mais recentes primeiro; o gráfico precisa da ordem cronológica
  const pontos = [...historicoPesagens]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((p, indice) => ({ chave: `${p.data}-${indice}`, rotuloData: formatarDataBR(p.data), peso: p.pesoKg, tipo: p.tipo }));

  if (pontos.length < 2) return <p className="text-sm text-ink-3">É preciso pelo menos duas pesagens para o gráfico.</p>;

  return <ChartContainer config={config} className="h-[220px] w-full aspect-auto overflow-hidden" role="img" aria-label="Evolução do peso do animal ao longo do tempo">
    <LineChart data={pontos} margin={{ top: 18, right: 18, bottom: 8, left: 8 }} accessibilityLayer>
      <CartesianGrid vertical={false} stroke="var(--rule-soft)" />
      <XAxis dataKey="rotuloData" minTickGap={18} interval="preserveStartEnd" {...axisProps} />
      <YAxis width={60} tickFormatter={(valor) => formatarKg(Number(valor))} domain={["auto", "auto"]} {...axisProps} />
      <ChartTooltip
        formatter={(valor, _nome, item) => [formatarKg(Number(valor)), ROTULO_TIPO_PESAGEM[String(item.payload.tipo)] ?? String(item.payload.tipo)]}
        labelFormatter={(rotulo) => rotulo}
      />
      <Line type="monotone" dataKey="peso" name="Peso" stroke="var(--color-peso)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
    </LineChart>
  </ChartContainer>;
}
