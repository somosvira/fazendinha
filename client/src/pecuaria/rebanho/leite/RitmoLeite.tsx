import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatarLitros } from "./modelo";
export interface DiaRitmoLeite {
  data: string;
  litros: number | null;
  estado: "SEM_FOLHA" | "SEM_PARTICIPANTES" | "SEM_ANIMAIS_ELEGIVEIS" | "FINALIDADE_PENDENTE" | "PARCIAL" | "COMPLETA";
  esperadas: number | null;
  resolvidas: number | null;
  pendentes: number | null;
}
const rotulos = {
  SEM_FOLHA: "Sem folha",
  SEM_ANIMAIS_ELEGIVEIS: "Sem animais elegíveis na data",
  FINALIDADE_PENDENTE: "Finalidade histórica a conciliar",
  SEM_PARTICIPANTES: "Sem participação no recorte",
  PARCIAL: "Parcial",
  COMPLETA: "Completa",
};
export function RitmoLeite({ dias }: { dias: DiaRitmoLeite[] }) {
  if (!dias.length) return null;
  return (
    <section aria-label="Ritmo da produção">
      <h2>Litros conhecidos por dia</h2>
      <p>
        Dias parciais são destacados no gráfico. Lacunas significam volume não
        informado; zero aparece somente quando foi medido. Finalidade pendente
        mantém os litros registrados e exige conciliação do histórico.
      </p>
      <div style={{ height: 260, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dias} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="data"
              tickFormatter={(d) =>
                String(d).slice(5).split("-").reverse().join("/")
              }
              minTickGap={24}
            />
            <YAxis unit=" L" width={68} />
            <Tooltip
              formatter={(v) =>
                `${Number(v).toLocaleString("pt-BR")} L conhecidos`
              }
              labelFormatter={(d) => String(d).split("-").reverse().join("/")}
            />
            <Bar
              dataKey="litros"
              name="Volume conhecido"
              maxBarSize={48}
              isAnimationActive={false}
            >
              {dias.map((d) => (
                <Cell
                  key={d.data}
                  fill={(d.estado === "PARCIAL" || d.estado === "FINALIDADE_PENDENTE") ? "var(--warn)" : "var(--primary)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details>
        <summary>Conferir cobertura de cada dia</summary>
        <div className="leite-tabela-scroll">
          <table>
            <caption>Produção e cobertura diárias</caption>
            <thead>
              <tr>
                <th>Data</th>
                <th>Litros conhecidos</th>
                <th>Cobertura</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {dias.map((d) => (
                <tr key={d.data}>
                  <td>{d.data.split("-").reverse().join("/")}</td>
                  <td>{formatarLitros(d.litros)}</td>
                  <td>
                    {d.esperadas === null
                      ? "Não informada"
                      : `${d.resolvidas} de ${d.esperadas} resolvidas`}
                  </td>
                  <td>{rotulos[d.estado]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
