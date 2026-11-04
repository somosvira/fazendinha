import { useId } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatarLitros } from "./modelo";
import { BarChart3 } from "lucide-react";
import { Empty } from "@/financeiro/financeiro-ui";

export interface GrupoProducaoGrafico { periodo: string; litros: number | null; completa: boolean }
/** Null permanece ausente; zero é uma aferição conhecida, sem barra de volume. */
export function GraficoProducaoLeite({ grupos }: { grupos: GrupoProducaoGrafico[] }) {
  const padraoParcial = `leite-parcial-${useId().replace(/:/g, "")}`;
  const titulo = <h2>Produção registrada </h2>;
  if (!grupos.some(g => g.litros != null)) return <figure className="leite-grafico-producao" aria-label="Evolução da produção em litros"><figcaption>{titulo}</figcaption><Empty icone={BarChart3}>Nenhum volume aferido neste período. Ausência de aferição não significa produção zero.</Empty></figure>;
  return <figure className="leite-grafico-producao" aria-label="Evolução da produção em litros">
    <figcaption>{titulo}<span><i />Cobertura completa <i className="parcial" />Cobertura parcial</span></figcaption>
    <div className="leite-grafico-area" aria-hidden="true"><ResponsiveContainer width="100%" height={240} minWidth={0}>
      <BarChart data={grupos} margin={{ top: 12, right: 12, left: 8, bottom: 4 }} accessibilityLayer={false}>
        <defs><pattern id={padraoParcial} width={8} height={8} patternUnits="userSpaceOnUse"><rect width={8} height={8} fill="var(--primary)" /><path d="M-2 2L2-2M0 8L8 0M6 10L10 6" stroke="var(--card)" strokeWidth={2} /></pattern></defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="periodo" tickFormatter={v => String(v).split("-").reverse().join("/")} tickLine={false} axisLine={false} fontSize={12} minTickGap={30} />
        <YAxis tickFormatter={v => `${Number(v).toLocaleString("pt-BR")} L`} tickLine={false} axisLine={false} width={78} fontSize={12} domain={[0, "auto"]} />
        <Tooltip labelFormatter={v => String(v).split("-").reverse().join("/")} formatter={v => [formatarLitros(v == null ? null : Number(v)), "Volume conhecido"]} />
        <Bar dataKey="litros" maxBarSize={64} radius={[3, 3, 0, 0]} isAnimationActive={false}>{grupos.map(g => <Cell key={g.periodo} fill={g.completa ? "var(--primary)" : `url(#${padraoParcial})`} stroke={g.completa ? undefined : "var(--primary)"} />)}</Bar>
      </BarChart>
    </ResponsiveContainer></div>

    <ul className="sr-only" aria-label="Valores do gráfico">{grupos.map(g => <li key={g.periodo}>{g.periodo}: {g.litros === null ? "Não aferido" : formatarLitros(g.litros)}; cobertura {g.completa ? "completa" : "parcial"}.</li>)}</ul>
  </figure>;
}
