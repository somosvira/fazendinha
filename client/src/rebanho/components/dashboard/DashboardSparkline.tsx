import type { PontoSerieDashboard } from "../../api";
import { Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";

export function DashboardSparkline({ serie, label }: { serie: PontoSerieDashboard[]; label: string }) {
  return (
    <ChartContainer config={{ valor: { label, color: "var(--cafe)" } }} className="h-8 w-[92px] aspect-auto" role="img" aria-label={label}>
      <LineChart data={serie} margin={{ top: 3, right: 1, bottom: 3, left: 1 }} accessibilityLayer>
        <XAxis dataKey="data" hide />
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <ChartTooltip />
        <Line type="monotone" dataKey="valor" stroke="var(--color-valor)" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
      </LineChart>
    </ChartContainer>
  );
}
