/* Rio Novo — Relatório gerencial (visão editorial) */

import { ReactNode, useState } from "react";
import R from "../data/rionovo";
import { ReportHeader } from "./Shell";
import { fmtMoney, MonthlyFlowChart, WaterfallChart } from "./charts";
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
    <div className="kpi-row">
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
          <div className="kpi" key={c.k}>
            <span className="eyebrow">{c.label}</span>
            <div className={"kpi-value mono-nums " + (isNeg ? "neg" : "")}>{fmtMoney(c.value)}</div>
            <div
              className={"kpi-delta " + (good ? "up" : "down")}
              title={`Comparação contra o mesmo período do ano anterior (${c.prev > 0 ? fmtMoney(c.prev, { compact: true }) : "—"}).`}
            >
              <span className="arrow">{up ? "▲" : "▼"}</span>
              <span>
                {fmtMoney(Math.abs(delta), { compact: true })} ({Math.abs(deltaPct).toFixed(0)}%) vs mesmo período de 2025
              </span>
            </div>
            <div className="kpi-note">{note}{good ? " · acima do esperado" : " · abaixo do esperado"}</div>
          </div>
        );
      })}
    </div>
  );
}

function SectionHead({
  num,
  title,
  lede,
  right,
}: {
  num: string;
  title: string;
  lede?: string;
  right?: ReactNode;
}) {
  return (
    <div className="section-head">
      <span className="section-num">§ {num}</span>
      <div>
        <h2 className="section-title">{title}</h2>
        {lede && <p className="section-lede">{lede}</p>}
      </div>
      <div>{right}</div>
    </div>
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
    <div className="answer-block">
      <div className="answer-verdict">
        <div className="verdict-line">
          <strong>Não.</strong> Em 2025, o leite operacional consumiu{" "}
          <span className="accent-neg">R$ {(deficitAbs / 1000).toFixed(2).replace(".", ",")} mi</span> a mais do que
          entregou — uma margem operacional de <strong>−{((deficitAbs / receitaK) * 100).toFixed(0)}%</strong>.
        </div>
        <div className="verdict-detail">
          Considera apenas custeio direto da atividade leiteira (ração, curral, medicamento animal, salários de
          tratadores, energia da sala de ordenha) — <em>reclassificando</em> a compra de matrizes Girolando (R$ 1,26
          mi marcados como “Animal Aquisição” em custeio) como investimento. Sem essa reclassificação, o operacional
          aparente fica −R$ 1,96 mi e fica impossível ler o que é prejuízo e o que é crescimento.
        </div>
        <div className="dual-stat">
          <div>
            <div className="label">Receita leite 2025</div>
            <div className="value" style={{ color: "var(--leite)" }}>
              {fmtMoney(receitaK)}
            </div>
          </div>
          <div className="versus">contra</div>
          <div>
            <div className="label">Custeio puro 2025</div>
            <div className="value" style={{ color: "var(--cafe)" }}>
              {fmtMoney(custeioK)}
            </div>
          </div>
        </div>
      </div>
      <div>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Cobertura mês a mês — 2025
        </div>
        <Leite2025CoverageChart />
        <div className="legend" style={{ marginTop: 14 }}>
          <span>
            <span className="legend-dot" style={{ background: "var(--leite)" }}></span> Receita
          </span>
          <span>
            <span className="legend-dash" style={{ color: "var(--cafe)" }}></span> Custeio puro
          </span>
        </div>
        <div className="footnote" style={{ marginTop: 14 }}>
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
    <div className="two-up" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
      <div>
        <WaterfallChart data={R.waterfall} />
        <div className="legend" style={{ marginTop: 8, paddingLeft: 24 }}>
          <span>
            <span className="legend-dot" style={{ background: "var(--leite)" }}></span> Receita
          </span>
          <span>
            <span className="legend-dot" style={{ background: "var(--cafe)" }}></span> Custeio
          </span>
          <span>
            <span
              className="legend-dot"
              style={{ background: "var(--outros)", opacity: 0.5, border: "1px dashed var(--outros)" }}
            ></span>{" "}
            Investimento
          </span>
          <span>
            <span className="legend-dot" style={{ background: "var(--ink)" }}></span> Subtotal / Fluxo
          </span>
        </div>
      </div>
      <div>
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Investimento — onde foi
        </div>
        <div className="col" style={{ gap: 14 }}>
          {R.investimentoBreakdown.map(
            (it: { nome: string; value: number; atividade: string }, i: number) => {
              const colorVar =
                it.atividade === "leite" ? "var(--leite)" : it.atividade === "cafe" ? "var(--cafe)" : "var(--outros)";
              return (
                <div key={i} className="col" style={{ gap: 6 }}>
                  <div className="row-between">
                    <span style={{ fontSize: 14, color: "var(--ink-2)" }}>{it.nome}</span>
                    <span
                      className="mono-nums"
                      style={{ fontFamily: "var(--serif)", fontSize: 18 }}
                    >
                      {fmtMoney(it.value)}
                    </span>
                  </div>
                  <div style={{ height: 6, background: "var(--rule-soft)", position: "relative" }}>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: `${(it.value / 3564) * 100}%`,
                        background: colorVar,
                        opacity: 0.85,
                      }}
                    ></div>
                  </div>
                </div>
              );
            },
          )}
        </div>
        <div className="footnote" style={{ marginTop: 22 }}>
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

function ActivityCard({
  atv,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  atv: any;
}) {
  const isNegMargem = atv.margemOp < 0;
  return (
    <div className="activity-card">
      <div className="activity-card-head">
        <span className="swatch" style={{ background: atv.cor }}></span>
        <span className="name">{atv.nome}</span>
        <span className="pct">{atv.pctReceita}% da receita</span>
      </div>

      <div className="activity-stat">
        <span className="stat-label">Receita</span>
        <span className="stat-val">{fmtMoney(atv.receita)}</span>
      </div>
      <div className="activity-stat">
        <span className="stat-label">Custeio</span>
        <span className="stat-val">{fmtMoney(-atv.custeio)}</span>
      </div>
      <div className="activity-stat">
        <span className="stat-label">Investimento</span>
        <span className="stat-val invest">{fmtMoney(-atv.investimento)}</span>
      </div>

      <div className="activity-foot">
        <span className="key">Margem op.</span>
        <span
          className={"val mono-nums "}
          style={{ color: isNegMargem ? "var(--prejuizo)" : "var(--lucro)" }}
        >
          {atv.margemOp >= 0 ? "+" : ""}
          {fmtMoney(atv.margemOp)}
        </span>
      </div>

      <div
        style={{
          paddingTop: 12,
          borderTop: "1px solid var(--rule-soft)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <span className="eyebrow">{atv.volume.label}</span>
        <span style={{ fontFamily: "var(--serif)", fontSize: 18, color: "var(--ink)" }}>{atv.volume.value}</span>
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{atv.volume.subtitle}</span>
      </div>
    </div>
  );
}

function ActivityComparison() {
  return (
    <div className="activity-grid">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {R.atividades.map((a: any) => (
        <ActivityCard key={a.key} atv={a} />
      ))}
    </div>
  );
}

function MonthlyFlow() {
  return (
    <div>
      <MonthlyFlowChart data={R.fluxoMensal} />
      <div className="legend" style={{ marginTop: 10, paddingLeft: 56 }}>
        <span>
          <span className="legend-dot" style={{ background: "var(--leite)" }}></span> Receita
        </span>
        <span>
          <span className="legend-dot" style={{ background: "var(--cafe)" }}></span> Custeio
        </span>
        <span>
          <span
            className="legend-dot"
            style={{ background: "var(--outros)", opacity: 0.5, border: "1px dashed var(--outros)" }}
          ></span>{" "}
          Investimento
        </span>
        <span>
          <span className="legend-line" style={{ background: "var(--ink)" }}></span> Fluxo líquido
        </span>
      </div>
    </div>
  );
}

function TopCategories() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cats: any[] = R.topCategorias;
  const max = Math.max(...cats.map((c) => c.total));
  return (
    <div className="cat-list">
      {cats.map((c) => {
        const w = (c.total / max) * 100;
        const lW = (c.leite / c.total) * w;
        const cW = (c.cafe / c.total) * w;
        const oW = (c.outros / c.total) * w;
        return (
          <div className="cat-row" key={c.rank}>
            <span className="cat-rank">{String(c.rank).padStart(2, "0")}</span>
            <div className="cat-name">
              {c.nome}
              <small>{c.sub}</small>
            </div>
            <div style={{ position: "relative" }}>
              <div className="cat-bar-track">
                <div className="cat-bar-split" style={{ width: `${w}%`, position: "absolute", inset: 0 }}>
                  <div style={{ width: `${(lW / w) * 100}%`, background: "var(--leite)" }}></div>
                  <div style={{ width: `${(cW / w) * 100}%`, background: "var(--cafe)" }}></div>
                  <div style={{ width: `${(oW / w) * 100}%`, background: "var(--outros)" }}></div>
                </div>
              </div>
            </div>
            <span className="cat-val mono-nums">{fmtMoney(c.total)}</span>
            <span className={"cat-delta mono-nums " + (c.delta > 0 ? "up" : "down")}>
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
    <div className="unit-grid">
      <div className="unit-card">
        <div className="stripe" style={{ background: "var(--leite)" }}></div>
        <div className="body-col">
          <span className="unit-eyebrow">Leite</span>
          <div className="unit-headline">A cada litro entregue, sobra R$ 0,41 antes de qualquer investimento.</div>
          <div className="unit-numbers">
            <div className="un-cell">
              <span className="un-label">Custo / L</span>
              <span className="un-val">R$ 3,10</span>
            </div>
            <div className="un-cell">
              <span className="un-label">Preço médio / L</span>
              <span className="un-val">R$ 3,51</span>
            </div>
            <div className="un-cell">
              <span className="un-label">Margem / L</span>
              <span className="un-val pos">+R$ 0,41</span>
            </div>
          </div>
          <div className="caption" style={{ marginTop: 10 }}>
            Base: 250.380 L entregues à Embaré entre Jan–Mai 2026.
          </div>
        </div>
      </div>
      <div className="unit-card">
        <div className="stripe" style={{ background: "var(--cafe)" }}></div>
        <div className="body-col">
          <span className="unit-eyebrow">Café</span>
          <div className="unit-headline">Margem por saca alta — mas safra única concentra o risco em uma janela.</div>
          <div className="unit-numbers">
            <div className="un-cell">
              <span className="un-label">Custo / saca</span>
              <span className="un-val">R$ 391</span>
            </div>
            <div className="un-cell">
              <span className="un-label">Preço médio</span>
              <span className="un-val">R$ 707</span>
            </div>
            <div className="un-cell">
              <span className="un-label">Margem</span>
              <span className="un-val pos">+R$ 316</span>
            </div>
          </div>
          <div className="caption" style={{ marginTop: 10 }}>
            Base: 430 sacas comercializadas na safra 01/2026 — tipo 6/7, bebida dura.
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertCard({
  tone = "warn",
  eyebrow,
  title,
  ctaText,
  onCta,
}: {
  tone?: "warn" | "neg" | "pos";
  eyebrow: string;
  title: string;
  ctaText: string;
  onCta?: () => void;
}) {
  return (
    <div className={"alert-card " + tone}>
      <div className="stripe"></div>
      <div className="body-col">
        <span className="eyebrow">{eyebrow}</span>
        <div className="alert-title">{title}</div>
      </div>
      <button className="alert-cta" onClick={onCta}>
        {ctaText} →
      </button>
    </div>
  );
}

function ContextualCards({ onNav }: { onNav: (t: Tab) => void }) {
  return (
    <div className="context-cards-row">
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
  const [range, setRange] = useState<DateRange>({ start: new Date(2026, 0, 1), end: new Date(2026, 4, 28) });

  return (
    <div className="shell-wide">
      <ReportHeader
        subtitle="Relatório Gerencial — Janeiro a Maio de 2026"
        range={range}
        onRangeChange={setRange}
        updatedAt={R.UPDATED_AT}
      />

      <section className="report-section" style={{ paddingTop: 24 }}>
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
      </section>

      <section className="report-section">
        <SectionHead
          num="I"
          title="O leite paga o leite?"
          lede="A pergunta que ancora a leitura da atividade principal: a operação leiteira gera caixa próprio, antes de qualquer investimento em rebanho?"
        />
        <QuestionLeite />
      </section>

      <section className="report-section">
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
                <div className="legend">
                  <span style={{ color: "var(--prejuizo)" }}>{pct}% investimento</span>
                </div>
              }
            />
          );
        })()}
        <CusteioVsInvestimento />
      </section>

      <section className="report-section">
        <SectionHead
          num="III"
          title="Leite, Café e Outros — lado a lado"
          lede="Cada atividade é uma operação distinta. Comparar receita, custeio e investimento na mesma régua revela onde está o motor e onde está o peso."
        />
        <ActivityComparison />
      </section>

      <section className="report-section">
        <SectionHead
          num="IV"
          title="Fluxo mês a mês"
          lede="A linha do fluxo líquido mês a mês mostra o ritmo do investimento — março e abril carregam a maior parte do negativo do ano."
        />
        <MonthlyFlow />
      </section>

      <section className="report-section">
        <SectionHead
          num="V"
          title="Onde o dinheiro foi"
          lede="As oito maiores categorias respondem por 82% do desembolso de custeio no ano. Ração e pessoal seguem dominando."
          right={
            <div className="legend">
              <span>
                <span className="legend-dot" style={{ background: "var(--leite)" }}></span>Leite
              </span>
              <span>
                <span className="legend-dot" style={{ background: "var(--cafe)" }}></span>Café
              </span>
              <span>
                <span className="legend-dot" style={{ background: "var(--outros)" }}></span>Outros
              </span>
            </div>
          }
        />
        <TopCategories />
        <ContextualCards onNav={onNav} />
      </section>

      <section className="report-section">
        <SectionHead
          num="VI"
          title="Custo por unidade produzida"
          lede="Reduzir leite e café a R$ por litro e R$ por saca — o KPI que importa para quem opera, indiferente ao tamanho do mês."
        />
        <UnitCost />
      </section>

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
