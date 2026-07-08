/* Rio Novo — Relatório gerencial (visão editorial).
 * Fase 2 shadcn: markup migrado para Tailwind + primitivas em ./report/primitives.
 * O CSS monopolizado (report-section, kpi-hero, answer/activity/unit/dual-stat/
 * two-up) saiu de base.css; classes compartilhadas (.legend*, .eyebrow, .caption,
 * .footnote, .cat-*, .chart-*) seguem vivas até suas próprias fases. */

import { useState } from "react";
import R from "../data/rionovo";
import { ReportHeader } from "./Shell";
import { fmtMoney, MonthlyFlowChart, WaterfallChart } from "./charts";
import { getHoje } from "../lib/hoje";
import { cn } from "@/lib/utils";
import {
  Section,
  SectionHead,
  KpiRow,
  KpiTile,
  ChartLegend,
  LegendItem,
  SplitBar,
  UnitCard,
  ActivityCard,
  AlertCard,
} from "./report/primitives";
import type { Tab } from "./Shell";
import type { DateRange } from "./DateRangePicker";

function KpiHero({
  kpis,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kpis: any;
}) {
  const cells = [
    { ...kpis.receita, k: "receita" },
    { ...kpis.custeio, k: "custeio" },
    { ...kpis.investimento, k: "investimento" },
    { ...kpis.fluxo, k: "fluxo" },
  ];
  /* derivado em vez de hardcoded: fração do fluxo absoluto que é investimento */
  const fluxoAbs = Math.abs(kpis.fluxo.value);
  const investAbs = Math.abs(kpis.investimento.value);
  const pctInvest = fluxoAbs > 0 ? Math.round((investAbs / fluxoAbs) * 100) : 0;
  return (
    <KpiRow>
      {cells.map((c) => {
        const isNeg = c.value < 0;
        const delta = c.value - c.prev;
        const deltaPct = c.prev !== 0 ? (delta / Math.abs(c.prev)) * 100 : 0;
        const up = delta > 0;
        let good: boolean;
        if (c.k === "receita") good = up;
        else if (c.k === "fluxo") good = up;
        else good = !up;

        const note =
          c.k === "fluxo"
            ? `${pctInvest}% é investimento (${fmtMoney(investAbs, { compact: true })})`
            : c.k === "investimento"
              ? "gado, plantio, maquinário"
              : c.k === "custeio"
                ? "operação corrente"
                : "leite + café + outros";

        return (
          <KpiTile
            key={c.k}
            label={c.label}
            value={fmtMoney(c.value)}
            negative={isNeg}
            delta={{
              up,
              good,
              text: `${fmtMoney(Math.abs(delta), { compact: true })} (${Math.abs(deltaPct).toFixed(0)}%) vs mesmo período de 2025`,
              title: `Comparação contra o mesmo período do ano anterior (${c.prev > 0 ? fmtMoney(c.prev, { compact: true }) : "—"}).`,
            }}
            note={`${note}${good ? " · acima do esperado" : " · abaixo do esperado"}`}
          />
        );
      })}
    </KpiRow>
  );
}

function Leite2025CoverageChart() {
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const recL = R.idx2025.map((i: number) => Math.round(R.receitaLeite[i] / 1000));
  const cusL = R.idx2025.map((i: number) => Math.round(R.custeioLeitePuro[i] / 1000));

  const W = 460,
    H = 180;
  const padL = 36,
    padR = 8,
    padT = 14,
    padB = 32;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(...recL, ...cusL) * 1.05;
  const yScale = (v: number) => padT + innerH - (v / max) * innerH;
  const xBand = innerW / months.length;
  const barW = xBand * 0.32;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", maxHeight: 200 }}>
      <line x1={padL} x2={W - padR} y1={yScale(0)} y2={yScale(0)} className="chart-axis" />
      <line x1={padL} x2={W - padR} y1={yScale(200)} y2={yScale(200)} className="grid-line" />
      <line x1={padL} x2={W - padR} y1={yScale(400)} y2={yScale(400)} className="grid-line" />
      <text x={padL - 6} y={yScale(200) + 4} textAnchor="end" className="chart-tick-text">
        200k
      </text>
      <text x={padL - 6} y={yScale(400) + 4} textAnchor="end" className="chart-tick-text">
        400k
      </text>

      {months.map((m, i) => {
        const x = padL + i * xBand + (xBand - barW * 2 - 3) / 2;
        return (
          <g key={i}>
            <rect x={x} y={yScale(recL[i])} width={barW} height={yScale(0) - yScale(recL[i])} fill="var(--leite)" />
            <rect
              x={x + barW + 3}
              y={yScale(cusL[i])}
              width={barW}
              height={yScale(0) - yScale(cusL[i])}
              fill="none"
              stroke="var(--cafe)"
              strokeWidth="1.4"
              strokeDasharray="3 2"
            />
            <text x={x + barW + 1} y={H - padB + 16} textAnchor="middle" className="chart-tick-text">
              {m}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function QuestionLeite() {
  const receitaK = Math.round(R.k2025.receitaLeite / 1000);
  const custeioK = Math.round(R.k2025.custeioLeitePuro / 1000);
  const deficitK = receitaK - custeioK;
  const deficitAbs = Math.abs(deficitK);
  return (
    <div className="grid grid-cols-[1.2fr_1fr] items-start gap-10 pt-2 pb-3">
      <div className="flex flex-col gap-3.5">
        <div className="font-serif text-[22px] leading-[1.35] tracking-[-0.005em] text-foreground">
          <strong className="font-semibold">Não.</strong> Em 2025, o leite operacional consumiu{" "}
          <span className="font-semibold text-prejuizo">
            R$ {(deficitAbs / 1000).toFixed(2).replace(".", ",")} mi
          </span>{" "}
          a mais do que entregou — uma margem operacional de{" "}
          <strong className="font-semibold">−{((deficitAbs / receitaK) * 100).toFixed(0)}%</strong>.
        </div>
        <div className="max-w-[50ch] text-[15px] font-medium leading-[1.55] text-ink-2">
          Considera apenas custeio direto da atividade leiteira (ração, curral, medicamento animal, salários de
          tratadores, energia da sala de ordenha) — <em>reclassificando</em> a compra de matrizes Girolando (R$ 1,26
          mi marcados como “Animal Aquisição” em custeio) como investimento. Sem essa reclassificação, o operacional
          aparente fica −R$ 1,96 mi e fica impossível ler o que é prejuízo e o que é crescimento.
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-6 py-4">
          <div>
            <div className="mb-2 text-[14px] font-semibold uppercase tracking-[0.12em] text-ink-2">
              Receita leite 2025
            </div>
            <div
              className="font-serif text-[40px] font-medium leading-none tabular-nums tracking-[-0.015em]"
              style={{ color: "var(--leite)" }}
            >
              {fmtMoney(receitaK)}
            </div>
          </div>
          <div className="pb-2 font-serif text-[18px] italic text-ink-2">contra</div>
          <div>
            <div className="mb-2 text-[14px] font-semibold uppercase tracking-[0.12em] text-ink-2">
              Custeio puro 2025
            </div>
            <div
              className="font-serif text-[40px] font-medium leading-none tabular-nums tracking-[-0.015em]"
              style={{ color: "var(--cafe)" }}
            >
              {fmtMoney(custeioK)}
            </div>
          </div>
        </div>
      </div>
      <div>
        <div className="eyebrow mb-3">Cobertura mês a mês — 2025</div>
        <Leite2025CoverageChart />
        <ChartLegend className="mt-3.5">
          <LegendItem mark="dot" color="var(--leite)">
            Receita
          </LegendItem>
          <LegendItem mark="dash" color="var(--cafe)">
            Custeio puro
          </LegendItem>
        </ChartLegend>
        <div className="footnote mt-3.5">
          <span className="dagger">†</span>
          <span>
            Em <em>nenhum</em> mês de 2025 a receita do leite cobriu o custeio puro da atividade. O rebanho expandiu
            nesse período (R$ 1,3 mi em matrizes) e a produção por animal não acompanhou.
          </span>
        </div>
      </div>
    </div>
  );
}

function CusteioVsInvestimento() {
  return (
    <div className="grid grid-cols-[1.6fr_1fr] items-start gap-8">
      <div>
        <WaterfallChart data={R.waterfall} />
        <ChartLegend className="mt-2 pl-6">
          <LegendItem mark="dot" color="var(--leite)">
            Receita
          </LegendItem>
          <LegendItem mark="dot" color="var(--cafe)">
            Custeio
          </LegendItem>
          <LegendItem mark="dot" color="var(--outros)" opacity={0.5} dashedBorder>
            Investimento
          </LegendItem>
          <LegendItem mark="dot" color="var(--ink)">
            Subtotal / Fluxo
          </LegendItem>
        </ChartLegend>
      </div>
      <div>
        <div className="eyebrow mb-3.5">Investimento — onde foi</div>
        <div className="flex flex-col gap-3.5">
          {R.investimentoBreakdown.map(
            (it: { nome: string; value: number; atividade: string }, i: number) => {
              const colorVar =
                it.atividade === "leite" ? "var(--leite)" : it.atividade === "cafe" ? "var(--cafe)" : "var(--outros)";
              return (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[14px] text-ink-2">{it.nome}</span>
                    <span className="font-serif text-[18px] tabular-nums text-foreground">
                      {fmtMoney(it.value)}
                    </span>
                  </div>
                  <SplitBar
                    className="h-1.5"
                    width={(it.value / 3564) * 100}
                    segments={[{ pct: 100, color: colorVar, opacity: 0.85 }]}
                  />
                </div>
              );
            },
          )}
        </div>
        <div className="footnote mt-[22px]">
          <span className="dagger">†</span>
          <span>
            Compra de matrizes Girolando é o maior item — entram em produção em ~6 meses, elevando a entrega de leite
            estimada em ~12% no segundo semestre.
          </span>
        </div>
      </div>
    </div>
  );
}

function ActivityComparison() {
  return (
    <div className="grid grid-cols-3 gap-px border border-border bg-[var(--rule-soft)]">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {R.atividades.map((a: any) => (
        <ActivityCard
          key={a.key}
          color={a.cor}
          nome={a.nome}
          pctReceita={a.pctReceita}
          receita={fmtMoney(a.receita)}
          custeio={fmtMoney(-a.custeio)}
          investimento={fmtMoney(-a.investimento)}
          margemOp={a.margemOp}
          volume={a.volume}
          fmt={(n) => fmtMoney(n)}
        />
      ))}
    </div>
  );
}

function MonthlyFlow() {
  return (
    <div>
      <MonthlyFlowChart data={R.fluxoMensal} />
      <ChartLegend className="mt-2.5 pl-14">
        <LegendItem mark="dot" color="var(--leite)">
          Receita
        </LegendItem>
        <LegendItem mark="dot" color="var(--cafe)">
          Custeio
        </LegendItem>
        <LegendItem mark="dot" color="var(--outros)" opacity={0.5} dashedBorder>
          Investimento
        </LegendItem>
        <LegendItem mark="line" color="var(--ink)">
          Fluxo líquido
        </LegendItem>
      </ChartLegend>
    </div>
  );
}

function TopCategories() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cats: any[] = R.topCategorias;
  const max = Math.max(...cats.map((c) => c.total));
  return (
    <div className="flex flex-col">
      {cats.map((c) => {
        const w = (c.total / max) * 100;
        return (
          <div
            className="grid grid-cols-[28px_1.8fr_3fr_1fr_90px] items-center gap-4 border-b border-[color:var(--rule-soft)] py-3.5 text-[15px] last:border-b-0"
            key={c.rank}
          >
            <span className="font-serif text-[15px] font-medium tabular-nums text-ink-2">
              {String(c.rank).padStart(2, "0")}
            </span>
            <div className="text-[16px] font-semibold text-foreground">
              {c.nome}
              <small className="mt-0.5 block text-[14px] font-medium text-ink-2">{c.sub}</small>
            </div>
            <SplitBar
              width={w}
              segments={[
                { pct: (c.leite / c.total) * 100, color: "var(--leite)" },
                { pct: (c.cafe / c.total) * 100, color: "var(--cafe)" },
                { pct: (c.outros / c.total) * 100, color: "var(--outros)" },
              ]}
            />
            <span className="text-right font-serif text-[19px] font-medium tabular-nums text-foreground">
              {fmtMoney(c.total)}
            </span>
            <span
              className={cn(
                "text-right text-[14px] font-semibold tabular-nums",
                c.delta > 0 ? "text-prejuizo" : "text-lucro",
              )}
            >
              {c.delta > 0 ? "▲" : "▼"} {Math.abs(c.delta)}% vs 2025
            </span>
          </div>
        );
      })}
    </div>
  );
}

function UnitCost() {
  return (
    <div className="grid grid-cols-2 gap-px border border-border bg-[var(--rule-soft)]">
      <UnitCard
        accent="var(--leite)"
        eyebrow="Leite"
        headline="A cada litro entregue, sobra R$ 0,41 antes de qualquer investimento."
        cells={[
          { label: "Custo / L", value: "R$ 3,10" },
          { label: "Preço médio / L", value: "R$ 3,51" },
          { label: "Margem / L", value: "+R$ 0,41", pos: true },
        ]}
        caption="Base: 250.380 L entregues à Embaré entre Jan–Mai 2026."
      />
      <UnitCard
        accent="var(--cafe)"
        eyebrow="Café"
        headline="Margem por saca alta — mas safra única concentra o risco em uma janela."
        cells={[
          { label: "Custo / saca", value: "R$ 391" },
          { label: "Preço médio", value: "R$ 707" },
          { label: "Margem", value: "+R$ 316", pos: true },
        ]}
        caption="Base: 430 sacas comercializadas na safra 01/2026 — tipo 6/7, bebida dura."
      />
    </div>
  );
}

function ContextualCards({ onNav }: { onNav: (t: Tab) => void }) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-[18px]">
      <AlertCard
        tone="neg"
        eyebrow="Alerta — categoria"
        title="Gasto com medicamento animal subiu 40% este mês."
        ctaText="Ver lançamentos"
        onCta={() => onNav("gastos")}
      />
      <AlertCard
        tone="warn"
        eyebrow="Possível ruptura"
        title="Compra de ração caiu 22% em maio — estoque pode estar baixo."
        ctaText="Ver lançamentos"
        onCta={() => onNav("gastos")}
      />
      <AlertCard
        tone="pos"
        eyebrow="Insight da IA"
        title="Bezerro doente registrado em 14/mai. Ver protocolos veterinários comuns."
        ctaText="Perguntar à IA"
        onCta={() => onNav("ia")}
      />
    </div>
  );
}

export function Relatorio({ onNav }: { onNav: (t: Tab) => void }) {
  const hoje = getHoje();
  const [range, setRange] = useState<DateRange>({
    start: new Date(hoje.getFullYear(), 0, 1),
    end: hoje,
  });

  return (
    <div className="shell-wide">
      <ReportHeader
        subtitle="Relatório Gerencial — Janeiro a Maio de 2026"
        range={range}
        onRangeChange={setRange}
        updatedAt={R.UPDATED_AT}
      />

      <Section className="pt-6">
        <KpiHero kpis={R.kpisYTD} />
        <div className="footnote">
          <span className="dagger">†</span>
          <span>
            Receita = leite (Embaré) + café (safra 01/2026) + venda de bezerros e descarte. Custeio é gasto
            recorrente da operação; Investimento é compra de gado, máquina e plantio. Inclui R$ 84 mil em
            lançamentos sem alocação confiável de atividade, redistribuídos pelo maior valor —
            <a href="#"> ver detalhes</a>.
          </span>
        </div>
      </Section>

      <Section>
        <SectionHead
          num="I"
          title="O leite paga o leite?"
          lede="A pergunta que ancora a leitura da atividade principal: a operação leiteira gera caixa próprio, antes de qualquer investimento em rebanho?"
        />
        <QuestionLeite />
      </Section>

      <Section>
        {(() => {
          const fluxoAbs = Math.abs(R.kpisYTD.fluxo.value);
          const investAbs = Math.abs(R.kpisYTD.investimento.value);
          const pct = fluxoAbs > 0 ? Math.round((investAbs / fluxoAbs) * 100) : 0;
          const ledeFluxo = (fluxoAbs / 1000).toFixed(2).replace(".", ",");
          return (
            <SectionHead
              num="II"
              title="Quanto do negativo é prejuízo, quanto é investimento?"
              lede={`Dos R$ ${ledeFluxo} mi negativos no ano, ${pct}% é compra de gado, máquinas e plantio — capital novo entrando, não dinheiro perdido.`}
              right={
                <ChartLegend>
                  <span className="text-prejuizo">{pct}% investimento</span>
                </ChartLegend>
              }
            />
          );
        })()}
        <CusteioVsInvestimento />
      </Section>

      <Section>
        <SectionHead
          num="III"
          title="Leite, Café e Outros — lado a lado"
          lede="Cada atividade é uma operação distinta. Comparar receita, custeio e investimento na mesma régua revela onde está o motor e onde está o peso."
        />
        <ActivityComparison />
      </Section>

      <Section>
        <SectionHead
          num="IV"
          title="Fluxo mês a mês"
          lede="A linha do fluxo líquido mês a mês mostra o ritmo do investimento — março e abril carregam a maior parte do negativo do ano."
        />
        <MonthlyFlow />
      </Section>

      <Section>
        <SectionHead
          num="V"
          title="Onde o dinheiro foi"
          lede="As oito maiores categorias respondem por 82% do desembolso de custeio no ano. Ração e pessoal seguem dominando."
          right={
            <ChartLegend>
              <LegendItem mark="dot" color="var(--leite)">
                Leite
              </LegendItem>
              <LegendItem mark="dot" color="var(--cafe)">
                Café
              </LegendItem>
              <LegendItem mark="dot" color="var(--outros)">
                Outros
              </LegendItem>
            </ChartLegend>
          }
        />
        <TopCategories />
        <ContextualCards onNav={onNav} />
      </Section>

      <Section>
        <SectionHead
          num="VI"
          title="Custo por unidade produzida"
          lede="Reduzir leite e café a R$ por litro e R$ por saca — o KPI que importa para quem opera, indiferente ao tamanho do mês."
        />
        <UnitCost />
      </Section>

      <div style={{ padding: "40px 0 60px", textAlign: "center", display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
        <button
          className="btn-ghost"
          onClick={() => window.print()}
          style={{ alignSelf: "center" }}
          title="Imprime ou salva como PDF — a versão impressa esconde menu e botões."
        >
          ⎙ Imprimir / salvar PDF
        </button>
        <div className="caption" style={{ letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Fim do relatório · Próxima atualização 04/jun/2026
        </div>
      </div>
    </div>
  );
}
