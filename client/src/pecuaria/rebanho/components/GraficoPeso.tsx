import { Scale } from "lucide-react";
// Gráfico de linha da evolução do peso do animal — só a curva de peso (decisão #3 do
// plano "telas finais da v1"); gráficos agregados do lote ficam para depois. Usa o
// wrapper compartilhado client/src/components/ui/chart.tsx (Recharts), como o financeiro.

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "../../../components/ui/chart";
import type { HistoricoPesagem } from "../types";
import { formatarDataBR } from "../lib/rotulos";
import { formatarKg, pesoCompativelIndicador, rotuloContextoPeso, rotuloOrigemPesagem, rotuloPrecisaoPeso } from "../lib/peso";

/** Rótulo PT-BR por tipo de pesagem — espelha o mapa usado na tabela de pesagens. */
export const ROTULO_TIPO_PESAGEM: Record<string, string> = {
  NASCIMENTO: "Nascimento", ENTRADA: "Entrada", DESMAMA: "Desmama", ROTINA: "Rotina", SAIDA: "Saída", PARTO: "Parto", SECAGEM: "Secagem",
};

const config = { peso: { label: "Peso", color: "var(--cafe)" } } satisfies ChartConfig;

const axisProps = { tick: { fill: "var(--ink-2)", fontSize: 12 }, tickLine: false, axisLine: false } as const;

/** Séries mantêm lacunas entre precisões diferentes. Estimados, informados
 * e externos aparecem só como pontos, sem uma curva de desempenho presumida. */
export function prepararPontosPeso(pesagens: HistoricoPesagem[]) {
  return [...pesagens].sort((a, b) => a.data.localeCompare(b.data)).map((p, indice) => {
    const compativel = pesoCompativelIndicador(p);
    return {
      chave: `${p.data}-${indice}`, rotuloData: formatarDataBR(p.data), tipo: p.tipo,
      origem: p.origem, precisao: p.precisao, contextoHistorico: p.contextoHistorico,
      pesoMedido: compativel && p.precisao === "MEDIDO" ? p.pesoKg : null,
      pesoSemPrecisao: compativel && p.precisao !== "MEDIDO" ? p.pesoKg : null,
      pesoHistorico: compativel ? null : p.pesoKg,
    };
  });
}

/** `desde`/`ate` ("aaaa-mm-dd", inclusivos) recortam a curva na janela do período do GMD escolhido
 *  na ficha; sem eles, a curva inteira. */
export function GraficoPeso({ historicoPesagens, desde = null, ate = null }: { historicoPesagens: HistoricoPesagem[]; desde?: string | null; ate?: string | null }) {
  // a ficha traz as pesagens mais recentes primeiro; o gráfico precisa da ordem cronológica
  const noPeriodo = historicoPesagens.filter((p) => (desde == null || p.data.slice(0, 10) >= desde) && (ate == null || p.data.slice(0, 10) <= ate));
  const pontos = prepararPontosPeso(noPeriodo);

  if (pontos.length < 2) {
    const recortado = noPeriodo.length < historicoPesagens.length && historicoPesagens.length >= 2;
    return <div className="peso-sem-dados" role="status"><Scale size={28} aria-hidden="true" className="shrink-0 text-mast"/><div>
      <h3>{historicoPesagens.length === 0 ? "Ainda não há pesagens deste animal" : recortado ? "Poucas pesagens no período selecionado" : "Uma pesagem ainda não forma uma curva"}</h3>
      <p>{recortado ? "Menos de duas pesagens neste período — escolha um período maior para ver a curva." : "É preciso pelo menos duas pesagens para o gráfico."}</p>
      {historicoPesagens.length === 0 && <p>Use Mais ações → Registrar pesagem para começar o acompanhamento, se tiver permissão de lançamento.</p>}
    </div></div>;
  }

  return <><ChartContainer config={config} className="h-[220px] w-full aspect-auto overflow-hidden" role="img" aria-label="Evolução do peso do animal ao longo do tempo">
    <LineChart data={pontos} margin={{ top: 18, right: 18, bottom: 16, left: 8 }} accessibilityLayer>
      <CartesianGrid vertical={false} stroke="var(--rule-soft)" />
      <XAxis tickMargin={12} height={44} padding={{ left: 28, right: 28 }} dataKey="rotuloData" minTickGap={18} interval="preserveStartEnd" {...axisProps} />
      <YAxis tickMargin={10} width={68} tickFormatter={(valor) => formatarKg(Number(valor))} domain={["auto", "auto"]} {...axisProps} />
      <ChartTooltip
        formatter={(valor, _nome, item) => [formatarKg(Number(valor)), `${ROTULO_TIPO_PESAGEM[String(item.payload.tipo)] ?? String(item.payload.tipo)} · ${rotuloPrecisaoPeso(item.payload.precisao)} · ${rotuloContextoPeso(item.payload.contextoHistorico)} · ${rotuloOrigemPesagem(String(item.payload.origem))}`]}
        labelFormatter={(rotulo) => rotulo}
      />
      <Line type="monotone" dataKey="pesoMedido" name="Medido" stroke="var(--color-peso)" strokeWidth={2.5} connectNulls={false} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
      <Line type="monotone" dataKey="pesoSemPrecisao" name="Precisão não informada" stroke="var(--color-peso)" strokeWidth={2} strokeDasharray="4 4" connectNulls={false} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
      <Line dataKey="pesoHistorico" name="Estimado, informado ou externo" stroke="none" connectNulls={false} dot={{ r: 4, fill: "var(--ink-2)", stroke: "var(--ink-2)" }} activeDot={{ r: 5 }} isAnimationActive={false} />
    </LineChart>
  </ChartContainer>
    <p aria-label="Legenda da precisão do peso" className="mt-2 text-sm text-ink-3">{[
      pontos.some(p => p.pesoMedido !== null) && "Medido: linha contínua",
      pontos.some(p => p.pesoSemPrecisao !== null) && "Precisão não informada: linha tracejada",
      pontos.some(p => p.pesoHistorico !== null) && "Estimado, informado ou externo: pontos sem linha",
    ].filter(Boolean).join(" · ")}</p>
  </>;
}
