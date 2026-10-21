import { useId, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, ReferenceLine, XAxis, YAxis, type LabelProps } from "recharts";
import { ChartContainer, ChartTooltip } from "../components/ui/chart";
import { fmtBRL, fmtMoneyExact } from "../components/charts";
import type { RelatorioGerencialDTO } from "../components/relatorio-gerencial/types";
import { ROTULO_MES } from "../components/relatorio-gerencial/export";
import type { TotalGrupoRelatorio } from "./novo-api";
import { serieCaixaMensal } from "./lib/relatorio-graficos";

const CORES = ["#007f79", "#48aeb2", "#436e97", "#ac782b", "#855b88", "#667644", "#bc6650", "#5e7e86"];
const SAIDAS = "#b57922";
const eixo = { tick: { fill: "var(--ink-3)", fontSize: 12 }, tickLine: false, axisLine: false } as const;
const margem = { top: 28, right: 48, bottom: 8, left: 0 };
function RotuloValor({ viewBox, value, mostrarZero = false }: LabelProps & { mostrarZero?: boolean }) {
  if (!viewBox || !("x" in viewBox) || !("y" in viewBox) || (!mostrarZero && Number(value) === 0)) return null;
  return <text x={Number(viewBox.x) + Number(viewBox.width ?? 0) / 2} y={Number(viewBox.y) - 10} textAnchor="middle" fill="var(--ink)" fontSize={12}>{fmtMoneyExact(Number(value))}</text>;
}

const percentual = (valor: number) => `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

export function PizzaComprasRelatorio({ titulo, grupos, centro = false }: { titulo: string; grupos: TotalGrupoRelatorio[]; centro?: boolean }) {
  const legendaId = useId();
  const pontos = grupos.map(grupo => ({ ...grupo, valor: Number(grupo.total) }));
  const podeRepresentar = pontos.length > 0 && pontos.every(ponto => Number.isFinite(ponto.valor) && ponto.valor >= 0 && ponto.pct >= 0 && ponto.pct <= 100) && pontos.some(ponto => ponto.valor > 0);
  const cor = (indice: number) => CORES[(indice + (centro ? 1 : 0)) % CORES.length];
  return <section className="relatorio-distribuicao" aria-label={titulo}>
    <h2>{titulo}</h2>
    {grupos.length ? <div className="relatorio-pizza-com-legenda">
      {podeRepresentar && <ChartContainer config={{ valor: { label: "Compras e serviços" } }} className="relatorio-pizza aspect-auto" role="img" aria-label={`Gráfico de pizza: ${titulo.toLowerCase()}`} aria-describedby={legendaId}>
        <PieChart accessibilityLayer><Pie data={pontos} dataKey="valor" nameKey="nome" innerRadius={0} outerRadius="94%" stroke={pontos.length > 1 ? "var(--card)" : "none"} strokeWidth={2} isAnimationActive={false}>
          {pontos.map((ponto, indice) => <Cell key={ponto.nome} fill={cor(indice)} />)}
        </Pie><ChartTooltip formatter={(valor, nome) => [fmtMoneyExact(Number(valor)), String(nome)]} /></PieChart>
      </ChartContainer>}
      <ul id={legendaId} className="relatorio-pizza-legenda">{pontos.map((ponto, indice) => <li key={ponto.nome}>
        <span className="relatorio-legenda-nome">{podeRepresentar && <i style={{ background: cor(indice) }} aria-hidden="true" />}{ponto.nome}</span>
        <span className="relatorio-legenda-valores"><strong>{fmtMoneyExact(ponto.valor)}</strong><span>{percentual(ponto.pct)}</span></span>
      </li>)}</ul>
    </div> : <p>Nenhuma compra ou serviço no recorte.</p>}
  </section>;
}

export function GraficosCaixaRelatorio({ dto, informacao }: { dto: RelatorioGerencialDTO; informacao: (titulo: string, texto: string) => ReactNode }) {
  if (!dto.entradasSaidas) return null;
  const pontos = serieCaixaMensal(dto.entradasSaidas.meses);
  if (!pontos.length) return <p className="relatorio-vazio">Nenhum mês salvo nesta emissão.</p>;
  const minimo = Math.min(0, ...pontos.flatMap(ponto => [ponto.entradas, ponto.saidas, ponto.acumulado]));
  const maximo = Math.max(0, ...pontos.flatMap(ponto => [ponto.entradas, ponto.saidas, ponto.acumulado]));
  const dominio: [number, number] = [minimo, maximo === minimo ? maximo + 1 : maximo];
  return <div className="relatorio-graficos-caixa">
    <div className="sr-only"><table><caption>Dados da evolução mensal do caixa</caption><thead><tr><th scope="col">Mês</th><th scope="col">Entradas</th><th scope="col">Saídas</th><th scope="col">Resultado mensal</th><th scope="col">Resultado acumulado</th></tr></thead><tbody>{pontos.map(ponto => <tr key={ponto.mes}><th scope="row">{ROTULO_MES(ponto.mes)}</th><td>{fmtMoneyExact(ponto.entradas)}</td><td>{fmtMoneyExact(ponto.saidas)}</td><td>{fmtMoneyExact(ponto.resultado)}</td><td>{fmtMoneyExact(ponto.acumulado)}</td></tr>)}</tbody></table></div>
    <section aria-label="Entradas e saídas por mês">
      <div className="relatorio-secao-titulo"><h2>Entradas e saídas por mês{informacao("Entradas e saídas por mês", "Movimentações realizadas por mês, conforme o recorte salvo. As barras usam a mesma escala linear; o valor exato aparece no gráfico e ao passar o cursor. Os detalhes mensais permanecem em Análises.")}</h2></div>
      <ChartContainer className="relatorio-grafico-mensal aspect-auto" config={{ entradas: { label: "Entradas", color: CORES[0] }, saidas: { label: "Saídas", color: SAIDAS } }} role="img" aria-label="Gráfico de entradas e saídas mensais em reais">
        <BarChart data={pontos} margin={margem} accessibilityLayer barGap={6}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="mes" tickFormatter={ROTULO_MES} {...eixo} />
          <YAxis width={82} tickFormatter={valor => fmtBRL(Number(valor))} domain={dominio} {...eixo} />
          <ReferenceLine y={0} stroke="var(--border)" />
          <ChartTooltip labelFormatter={mes => ROTULO_MES(String(mes))} formatter={(valor, nome) => [fmtMoneyExact(Number(valor)), String(nome)]} />
          <Bar dataKey="entradas" name="Entradas" fill="var(--color-entradas)" maxBarSize={44} radius={[3, 3, 0, 0]} isAnimationActive={false}>{pontos.length <= 6 && <LabelList content={props => <RotuloValor {...props} />} />}</Bar>
          <Bar dataKey="saidas" name="Saídas" fill="var(--color-saidas)" maxBarSize={44} radius={[3, 3, 0, 0]} isAnimationActive={false}>{pontos.length <= 6 && <LabelList content={props => <RotuloValor {...props} />} />}</Bar>
        </BarChart>
      </ChartContainer>
      <div className="relatorio-legenda-grafico"><span><i style={{ background: CORES[0] }} aria-hidden="true" />Entradas</span><span><i style={{ background: SAIDAS }} aria-hidden="true" />Saídas</span></div>
    </section>
    <section aria-label="Resultado acumulado do caixa">
      <div className="relatorio-secao-titulo"><h2>Resultado acumulado do caixa{informacao("Resultado acumulado do caixa", "Soma dos resultados mensais deste recorte. Não inclui o saldo de abertura e não representa o saldo das contas nem lucro. Transferências e filtros podem produzir diferenças em relação ao saldo final das contas.")}</h2></div>
      <ChartContainer className="relatorio-grafico-mensal aspect-auto" config={{ acumulado: { label: "Resultado acumulado", color: CORES[0] } }} role="img" aria-label="Gráfico do resultado acumulado do caixa em reais">
        <LineChart data={pontos} margin={margem} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="mes" tickFormatter={ROTULO_MES} {...eixo} />
          <YAxis width={82} tickFormatter={valor => fmtBRL(Number(valor))} domain={dominio} {...eixo} />
          <ReferenceLine y={0} stroke="var(--border)" />
          <ChartTooltip labelFormatter={mes => ROTULO_MES(String(mes))} formatter={valor => [fmtMoneyExact(Number(valor)), "Resultado acumulado"]} />
          <Line dataKey="acumulado" name="Resultado acumulado" type="linear" stroke="var(--color-acumulado)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 5 }} isAnimationActive={false}>{pontos.length <= 6 && <LabelList content={props => <RotuloValor {...props} mostrarZero />} />}</Line>
        </LineChart>
      </ChartContainer>
      <p className="relatorio-acumulado-final">Acumulado no recorte <strong>{fmtMoneyExact(pontos[pontos.length - 1].acumulado)}</strong></p>
    </section>
  </div>;
}
