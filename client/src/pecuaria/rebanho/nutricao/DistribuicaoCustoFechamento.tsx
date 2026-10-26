import { Cell, Pie, PieChart } from "recharts";
import { ChartContainer, ChartTooltip } from "../../../components/ui/chart";
import { brl } from "../../../financeiro/financeiro-ui";
import type { Fechamento } from "./api";

const CORES = ["#007f78", "#459e98", "#92c9be", "#567d94", "#b69a61"];
/** Participação apenas dos valores conhecidos, sem converter quantidade em custo. */
export function DistribuicaoCustoFechamento({ fechamento: f }: { fechamento: Fechamento }) {
  if (!f.verValores) return null;
  const itens = f.itens.map(i => ({ id: i.produtoId, nome: i.produto.nome, valor: Number(i.quantidadeConfirmada) === 0 ? 0 : (i.leite ? i.leite.custoProducao : i.movimentoEstoque?.valorTotal) == null ? null : Number(i.leite ? i.leite.custoProducao : i.movimentoEstoque?.valorTotal) }));
  if (itens.some(i => i.valor != null && (!Number.isFinite(i.valor) || i.valor < 0))) return null;
  const conhecidos = itens.filter((i): i is typeof i & { valor: number } => i.valor != null && i.valor > 0).sort((a, b) => b.valor - a.valor);
  const total = conhecidos.reduce((s, i) => s + Math.round(i.valor * 100), 0) / 100;
  if (!total) return null;
  return <section className="nutricao-custo-distribuicao" aria-label="Participação no custo conhecido"><h3>Participação no custo conhecido</h3>
    <div className="nutricao-custo-grafico" aria-hidden="true"><ChartContainer config={{ valor: { label: "Custo conhecido", color: CORES[0] } }}><PieChart><Pie data={conhecidos} dataKey="valor" nameKey="nome" innerRadius="58%" outerRadius="85%" stroke="white" strokeWidth={2} isAnimationActive={false}>{conhecidos.map((i, n) => <Cell key={i.id} fill={CORES[n % CORES.length]} />)}</Pie><ChartTooltip formatter={(v, nome) => [brl(Number(v)), String(nome)]} /></PieChart></ChartContainer></div>
    <ul>{conhecidos.map((i, n) => <li key={i.id}><span className="nutricao-custo-legenda" style={{ background: CORES[n % CORES.length] }} aria-hidden="true" /><span>{i.nome}</span><strong>{brl(i.valor)}</strong><span>{(i.valor / total * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span></li>)}</ul>
    {!f.coberturaCustoCompleta && <p className="nutricao-nota">Base parcial: somente ingredientes com custo conhecido. Valores não apurados continuam na tabela.</p>}
  </section>;
}
