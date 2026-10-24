import { Table, TableCaption, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { SecaoDetalhesLeite } from "./SecaoDetalhesLeite";
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
      <SecaoDetalhesLeite  titulo={<>Conferir cobertura de cada dia</>}>

        <div className="leite-tabela-scroll">
          <Table semContainer>
            <TableCaption>Produção e cobertura diárias</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Litros conhecidos</TableHead>
                <TableHead>Cobertura</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dias.map((d) => (
                <TableRow key={d.data}>
                  <TableCell>{d.data.split("-").reverse().join("/")}</TableCell>
                  <TableCell>{formatarLitros(d.litros)}</TableCell>
                  <TableCell>
                    {d.esperadas === null
                      ? "Não informada"
                      : `${d.resolvidas} de ${d.esperadas} resolvidas`}
                  </TableCell>
                  <TableCell>{rotulos[d.estado]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SecaoDetalhesLeite>
    </section>
  );
}
