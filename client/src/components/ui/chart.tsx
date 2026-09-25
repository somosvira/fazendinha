import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

const THEMES = { light: "", dark: ".dark" } as const;
const INITIAL_DIMENSION = { width: 320, height: 200 } as const;

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
>;

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

export function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) throw new Error("useChart must be used within a <ChartContainer />");
  return context;
}

/**
 * Primitiva shadcn-style para Recharts. Além da responsividade, ela converte o
 * ChartConfig em variáveis `--color-*`, mantendo os tokens visuais fora dos SVGs.
 */
export function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;

  return <ChartContext.Provider value={{ config }}>
    <div
      data-slot="chart"
      data-chart={chartId}
      className={cn(
        "flex aspect-video justify-center text-xs [&_.recharts-layer]:outline-hidden [&_.recharts-surface]:outline-hidden",
        className,
      )}
      {...props}
    >
      <ChartStyle id={chartId} config={config} />
      <RechartsPrimitive.ResponsiveContainer initialDimension={INITIAL_DIMENSION}>
        {children}
      </RechartsPrimitive.ResponsiveContainer>
    </div>
  </ChartContext.Provider>;
}

export function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, item]) => item.theme ?? item.color);
  if (!colorConfig.length) return null;

  const css = Object.entries(THEMES).map(([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig.map(([key, item]) => {
    const color = item.theme?.[theme as keyof typeof item.theme] ?? item.color;
    return color ? `  --color-${key}: ${color};` : null;
  }).join("\n")}
}`).join("\n");

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

/**
 * Tooltip sem a transição de `transform` do Recharts. Com ela o balão desliza até a
 * posição nova e, no caminho, cruza a borda do gráfico: o contêiner ganhava barra de
 * rolagem por um instante, o layout mudava e a tela piscava. Sem animação a posição
 * já nasce limitada à área do gráfico.
 */
export function ChartTooltip(props: React.ComponentProps<typeof RechartsPrimitive.Tooltip>) {
  return <RechartsPrimitive.Tooltip isAnimationActive={false} {...props} />;
}
export const ChartLegend = RechartsPrimitive.Legend;
