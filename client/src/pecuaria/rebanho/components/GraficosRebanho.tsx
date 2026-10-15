import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "../../../components/ui/chart";

export const CORES_REBANHO = ["#24493b", "#62846b", "#b08c50", "#537e85", "#9b6655", "#879365", "#6a6989", "#7b8280"];

export type DadoDistribuicao = { nome: string; qtd: number; cor: string };
export function percentualRebanho(qtd: number, total: number): string {
  return `${(total > 0 ? qtd / total * 100 : 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

/** As listas adjacentes apresentam os mesmos valores e links sem depender do SVG ou de cores. */
export function GraficoCategorias({ dados, total }: { dados: DadoDistribuicao[]; total: number }) {
  return <div className="pec-rosca" role="img" aria-label={`Composição por categoria de ${total} animais ativos. Valores na lista ao lado.`}>
    <ChartContainer config={{ qtd: { label: "Animais" } }} className="pec-rosca-chart" aria-hidden="true">
      <PieChart>
        <Pie data={dados} dataKey="qtd" nameKey="nome" innerRadius="72%" outerRadius="95%" paddingAngle={dados.length > 1 ? 3 : 0} stroke="none" isAnimationActive={false}>
          {dados.map((item, indice) => <Cell key={indice} fill={item.cor} />)}
        </Pie>
        <ChartTooltip formatter={(valor, nome) => [`${valor} animais · ${percentualRebanho(Number(valor), total)}`, nome]} />
      </PieChart>
    </ChartContainer>
    <div className="pec-rosca-centro" aria-hidden="true"><strong>{total.toLocaleString("pt-BR")}</strong><span>animais ativos</span></div>
  </div>;
}

export function GraficoBaixas({ dados }: { dados: DadoDistribuicao[] }) {
  return <ChartContainer config={{ qtd: { label: "Baixas" } }} className="pec-baixas-chart" role="img" aria-label="Quantidade de baixas por tipo. Valores e filtros na lista ao lado ou abaixo.">
    <BarChart data={dados} margin={{ top: 12, right: 6, bottom: 0, left: -20 }} accessibilityLayer>
      <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
      <XAxis dataKey="nome" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval={0} />
      <YAxis domain={[0, "dataMax"]} allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
      <ChartTooltip cursor={{ fill: "var(--muted)" }} formatter={valor => [`${valor}`, "Baixas"]} />
      <Bar dataKey="qtd" radius={[5, 5, 0, 0]} maxBarSize={44} isAnimationActive={false}>
        {dados.map((item, indice) => <Cell key={indice} fill={item.cor} />)}
      </Bar>
    </BarChart>
  </ChartContainer>;
}
