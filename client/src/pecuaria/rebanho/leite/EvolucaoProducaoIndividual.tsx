import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { AjudaCampo } from "@/components/Dica";
import { dataSanitaria } from "../sanidade/rotulos";
import { formatarLitros } from "./modelo";
import type { AfericaoIndividual } from "./historico-types";
import { Empty } from "@/financeiro/financeiro-ui";
export function EvolucaoProducaoIndividual({ pontos }: { pontos: readonly AfericaoIndividual[] }) {
  return <section className="animal-curva" aria-label="Evolução das aferições individuais"><header><h3>Evolução da produção</h3><AjudaCampo rotulo="Como ler a evolução individual" texto="Cada ponto representa somente os litros individuais medidos naquela data. A linha conecta observações, sem estimar dias entre controles. Aferições parciais são identificadas; pendências e exclusões não viram zero."/></header>
    {pontos.length ? <ChartContainer className="animal-curva-area" config={{ litros: { label: "Aferição individual", color: "var(--primary)" } }}>
      <LineChart data={[...pontos]} margin={{ top: 16, right: 24, bottom: 20, left: 8 }} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="var(--border)"/><XAxis dataKey="data" tickMargin={12} tickFormatter={v => dataSanitaria(v).slice(0, 5)} fontSize={11} axisLine={false} tickLine={false}/>
        <YAxis domain={[0, "auto"]} tickFormatter={v => formatarLitros(Number(v))} fontSize={11} width={62} axisLine={false} tickLine={false}/>
        <ChartTooltip labelFormatter={v => dataSanitaria(String(v))} formatter={(v, _nome, item) => [formatarLitros(Number(v)), item.payload.completa ? "Aferição individual" : "Aferição individual parcial"]}/>
        <Line dataKey="litros" type="linear" stroke="var(--color-litros)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--card)", strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} connectNulls={false}/>
      </LineChart>
    </ChartContainer> : <Empty>Sem volume individual aferido para desenhar a evolução.</Empty>}
    {pontos.some(p => !p.completa) && <p className="producao-ficha-nota">Há aferições parciais: os pontos mostram somente o volume conhecido.</p>}
  </section>;
}
