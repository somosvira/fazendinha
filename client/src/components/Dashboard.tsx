/* Rio Novo — Dashboard v2 (data-driven, brutal honesty) */

import { useState } from "react";
import R from "../data/rionovo";
import { DateRangePicker, DateRange } from "./DateRangePicker";
import { MonthlyTrendChart } from "./charts";
import type { Tab } from "./Shell";

const DASH_TODAY = new Date(2026, 4, 4);
const DEFAULT_RANGE: DateRange = { start: new Date(2024, 6, 1), end: DASH_TODAY };

function fmtBRL(n: number, opts: { compact?: boolean; decimals?: number } = {}): string {
  const { compact = true, decimals } = opts;
  if (n === 0) return "R$ 0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (compact && abs >= 1_000_000) {
    const v = abs / 1_000_000;
    return `${sign}R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
  }
  if (compact && abs >= 10_000) {
    const v = abs / 1_000;
    return `${sign}R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} mil`;
  }
  return `${sign}R$ ${abs.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 0,
  })}`;
}

export { fmtBRL };

function TimelineChart({ startIdx = 0, endIdx = 22 }: { startIdx?: number; endIdx?: number }) {
  const W = 1180,
    H = 380;
  const padL = 64,
    padR = 24,
    padT = 28,
    padB = 60;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const slice = <T,>(a: T[]): T[] => a.slice(startIdx, endIdx + 1);
  const meses = slice<string>(R.MESES_23M);
  const recL = slice<number>(R.receitaLeite);
  const recC = slice<number>(R.receitaCafe);
  const cusP = slice<number>(R.custeioLeitePuro).map(
    (v: number, i: number) => v + slice<number>(R.custeioCafe)[i] + slice<number>(R.sedeOutros)[i],
  );
  const animAq = slice<number>(R.animalAquisicao);
  const invL = slice<number>(R.investLeite);
  const invC = slice<number>(R.investCafe);
  const inv = invL.map((v: number, i: number) => v + invC[i]);
  const tot = slice<number>(R.totalGeral);

  const maxRec = Math.max(...recL.map((v, i) => v + recC[i]));
  const maxNeg = Math.max(...cusP.map((v, i) => v + animAq[i] + inv[i]));
  const yMax = Math.ceil(maxRec / 100000) * 100000;
  const yMin = -Math.ceil(maxNeg / 100000) * 100000;
  const yRange = yMax - yMin;
  const yScale = (v: number) => padT + innerH - ((v - yMin) / yRange) * innerH;

  const xBand = innerW / meses.length;
  const barW = Math.min(28, xBand * 0.55);

  const yTicksStep = yMax >= 1_500_000 ? 500_000 : 200_000;
  const ticks: number[] = [];
  for (let v = Math.floor(yMin / yTicksStep) * yTicksStep; v <= yMax; v += yTicksStep) ticks.push(v);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      {ticks.map((v) => (
        <g key={v}>
          <line
            x1={padL}
            x2={W - padR}
            y1={yScale(v)}
            y2={yScale(v)}
            className={v === 0 ? "chart-axis" : "grid-line"}
          />
          <text
            x={padL - 10}
            y={yScale(v) + 4}
            textAnchor="end"
            className="chart-tick-text"
            style={{ fill: "var(--ink-3)" }}
          >
            {v === 0 ? "0" : (v > 0 ? "" : "−") + (Math.abs(v) / 1_000_000).toFixed(1) + "mi"}
          </text>
        </g>
      ))}

      {meses.map((m, i) => {
        if (m.startsWith("Jan")) {
          const x = padL + i * xBand;
          return (
            <g key={"sep-" + i}>
              <line
                x1={x}
                x2={x}
                y1={padT - 4}
                y2={H - padB + 6}
                stroke="var(--rule)"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
              <text
                x={x + 4}
                y={padT + 8}
                className="chart-tick-text"
                style={{ fill: "var(--ink-3)", fontSize: 10, letterSpacing: "0.18em" }}
              >
                {m.replace("Jan/", "")}
              </text>
            </g>
          );
        }
        return null;
      })}

      {meses.map((m, i) => {
        const x = padL + i * xBand + (xBand - barW) / 2;
        const recLeite = recL[i];
        const recCafe = recC[i];
        const yLeiteTop = yScale(recLeite);
        const yLeiteBot = yScale(0);
        const yCafeTop = yScale(recLeite + recCafe);
        const yCafeBot = yScale(recLeite);
        const yCusT = yScale(0);
        const yCusB = yScale(-cusP[i]);
        const yAqT = yScale(-cusP[i]);
        const yAqB = yScale(-cusP[i] - animAq[i]);
        const yInvT = yScale(-cusP[i] - animAq[i]);
        const yInvB = yScale(-cusP[i] - animAq[i] - inv[i]);

        return (
          <g key={i}>
            {recLeite > 0 && <rect x={x} y={yLeiteTop} width={barW} height={yLeiteBot - yLeiteTop} fill="var(--leite)" />}
            {recCafe > 0 && <rect x={x} y={yCafeTop} width={barW} height={yCafeBot - yCafeTop} fill="var(--cafe)" />}
            {cusP[i] > 0 && (
              <rect x={x} y={yCusT} width={barW} height={yCusB - yCusT} fill="var(--cafe)" opacity="0.85" />
            )}
            {animAq[i] > 0 && (
              <g>
                <rect x={x} y={yAqT} width={barW} height={yAqB - yAqT} fill="var(--neg)" opacity="0.6" />
                <rect x={x} y={yAqT} width={barW} height={yAqB - yAqT} fill="url(#stripes-neg)" opacity="1" />
              </g>
            )}
            {inv[i] > 0 && (
              <g>
                <rect x={x} y={yInvT} width={barW} height={yInvB - yInvT} fill="var(--outros)" opacity="0.22" />
                <rect
                  x={x}
                  y={yInvT}
                  width={barW}
                  height={yInvB - yInvT}
                  fill="none"
                  stroke="var(--outros)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              </g>
            )}
            {(i % 2 === 0 || i === meses.length - 1) && (
              <text x={x + barW / 2} y={H - padB + 20} textAnchor="middle" className="chart-tick-text">
                {m.replace(/\/\d{2}\*?$/, "")}
              </text>
            )}
          </g>
        );
      })}

      <polyline
        fill="none"
        stroke="var(--ink)"
        strokeWidth="1.4"
        points={meses
          .map((_, i) => {
            const x = padL + i * xBand + xBand / 2;
            const y = yScale(tot[i]);
            return `${x},${y}`;
          })
          .join(" ")}
      />
      {meses.map((_, i) => {
        const x = padL + i * xBand + xBand / 2;
        const y = yScale(tot[i]);
        return (
          <circle
            key={"pt-" + i}
            cx={x}
            cy={y}
            r="2.5"
            fill="var(--bg)"
            stroke="var(--ink)"
            strokeWidth="1.2"
          />
        );
      })}

      <defs>
        <pattern
          id="stripes-neg"
          patternUnits="userSpaceOnUse"
          width="4"
          height="4"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="4" stroke="var(--neg)" strokeWidth="0.7" />
        </pattern>
      </defs>
    </svg>
  );
}

function HeroBand({ range, setRange }: { range: DateRange; setRange: (r: DateRange) => void }) {
  return (
    <div className="hero-band">
      <div className="hero-band-l">
        <span className="eyebrow">Caixa hoje</span>
        <div className="hero-caixa mono-nums">{fmtBRL(R.caixaHoje.total, { compact: false })}</div>
        <div className="hero-contas">
          {R.caixaHoje.contas.map((c: { nome: string; saldo: number }, i: number) => (
            <div key={i} className="hero-conta">
              <span className="nm">{c.nome}</span>
              <span className="vl mono-nums">{fmtBRL(c.saldo, { compact: false })}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="hero-band-divider"></div>

      <div className="hero-band-r">
        <span className="eyebrow">Visão executiva — Relatório recebido em 04/mai/2026</span>
        <div className="hero-title">Fluxo líquido 23 meses</div>
        <div className="hero-flux mono-nums">{fmtBRL(R.totals23m.totalGeral, { compact: true })}</div>
        <div className="hero-flux-sub">
          de <strong>{fmtBRL(R.totals23m.receitaLeite + R.totals23m.receitaCafe)}</strong> em receita contra{" "}
          <strong>{fmtBRL(R.totals23m.custeioLeitePuro + R.totals23m.custeioCafe + R.totals23m.sedeOutros)}</strong> de
          custeio e{" "}
          <strong>{fmtBRL(R.totals23m.investLeite + R.totals23m.investCafe + R.totals23m.animalAquisicao)}</strong> de
          investimento.
        </div>
        <div className="hero-period">
          <DateRangePicker value={range} onChange={setRange} anchor="right" />
        </div>
      </div>
    </div>
  );
}

function TimelineSection() {
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(22);
  const slices = [
    { label: "Tudo (23m)", from: 0, to: 22 },
    { label: "2024 H2", from: 0, to: 5 },
    { label: "2025", from: 6, to: 17 },
    { label: "2026 YTD", from: 18, to: 22 },
  ];

  return (
    <section className="timeline-section">
      <div className="brutal-head">
        <span className="num-chip">I</span>
        <div>
          <h2 className="section-title">O fluxo, mês a mês</h2>
          <p className="section-lede">
            Jul/2024 → Mai/2026. Receita acima de zero; custeio operacional, compra de gado mal-classificada e
            investimento abaixo. A linha preta é o fluxo líquido.
          </p>
        </div>
        <div className="timeline-slices">
          {slices.map((s) => (
            <button
              key={s.label}
              className="t-slice"
              aria-pressed={from === s.from && to === s.to}
              onClick={() => {
                setFrom(s.from);
                setTo(s.to);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <TimelineChart startIdx={from} endIdx={to} />

      <div className="legend timeline-legend" style={{ paddingLeft: 64, marginTop: 6 }}>
        <span>
          <span className="legend-dot" style={{ background: "var(--leite)" }}></span>Receita Leite
        </span>
        <span>
          <span className="legend-dot" style={{ background: "var(--cafe)" }}></span>Receita Café
        </span>
        <span>
          <span className="legend-dot" style={{ background: "var(--cafe)", opacity: 0.85 }}></span>Custeio operacional
        </span>
        <span>
          <span className="legend-dot stripes-neg-dot"></span>Animal Aquisição (deveria ser invest.)
        </span>
        <span>
          <span
            className="legend-dot"
            style={{ background: "var(--outros)", opacity: 0.4, border: "1px dashed var(--outros)" }}
          ></span>
          Investimento
        </span>
        <span>
          <span className="legend-line" style={{ background: "var(--ink)" }}></span>Fluxo líquido
        </span>
      </div>
    </section>
  );
}

function DRERow({
  label,
  val2025,
  val2026,
  indent = 0,
  bold = false,
  sep = false,
  italic = false,
}: {
  label: string;
  val2025?: number | null;
  val2026?: number | null;
  indent?: number;
  bold?: boolean;
  sep?: boolean;
  italic?: boolean;
}) {
  return (
    <tr className={"dre-row " + (bold ? "bold " : "") + (sep ? "sep " : "") + (italic ? "italic " : "")}>
      <td className="dre-label" style={{ paddingLeft: indent * 20 + 14 }}>
        {label}
      </td>
      <td className="dre-num mono-nums">{val2025 == null ? "" : fmtBRL(val2025)}</td>
      <td className="dre-num mono-nums">{val2026 == null ? "" : fmtBRL(val2026)}</td>
    </tr>
  );
}

function DRESection() {
  const k25 = R.k2025;
  const k26 = R.k2026YTD;
  const sumAtRange = (a: number[], idx: number[]) => idx.reduce((s, i) => s + a[i], 0);
  const sede25 = sumAtRange(R.sedeOutros, R.idx2025);
  const sede26 = sumAtRange(R.sedeOutros, R.idx2026YTD);

  const op25 = k25.receitaLeite + k25.receitaCafe - k25.custeioLeitePuro - k25.custeioCafe - sede25;
  const op26 = k26.receitaLeite + k26.receitaCafe - k26.custeioLeitePuro - k26.custeioCafe - sede26;

  const inv25Total = k25.investLeite + k25.investCafe + k25.animalAquisicao;
  const inv26Total = k26.investLeite + k26.investCafe + k26.animalAquisicao;

  return (
    <section className="dre-section">
      <div className="brutal-head">
        <span className="num-chip">II</span>
        <div>
          <h2 className="section-title">DRE simplificado</h2>
          <p className="section-lede">
            Reclassificada: compra de matrizes e benfeitorias estão isoladas do custeio operacional. Leitura
            comparável entre 2025 e 2026 YTD (Jan-Mai, Mai parcial).
          </p>
        </div>
      </div>

      <table className="dre-table">
        <thead>
          <tr>
            <th></th>
            <th className="dre-num">2025</th>
            <th className="dre-num">
              2026 YTD <span className="dre-caption">(Jan-Mai*)</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <DRERow
            label="Receita bruta"
            bold={true}
            val2025={k25.receitaLeite + k25.receitaCafe}
            val2026={k26.receitaLeite + k26.receitaCafe}
          />
          <DRERow label="Leite (Embaré)" indent={1} val2025={k25.receitaLeite} val2026={k26.receitaLeite} />
          <DRERow label="Café (safra única em 03/26)" indent={1} val2025={0} val2026={k26.receitaCafe} />

          <DRERow
            label="(−) Custeio operacional"
            bold={true}
            sep={true}
            val2025={-(k25.custeioLeitePuro + k25.custeioCafe + sede25)}
            val2026={-(k26.custeioLeitePuro + k26.custeioCafe + sede26)}
          />
          <DRERow
            label="Custeio leite (puro, sem compra de gado)"
            indent={1}
            val2025={-k25.custeioLeitePuro}
            val2026={-k26.custeioLeitePuro}
          />
          <DRERow label="Custeio café" indent={1} val2025={-k25.custeioCafe} val2026={-k26.custeioCafe} />
          <DRERow label="Sede / não-alocado" indent={1} val2025={-sede25} val2026={-sede26} />

          <DRERow label="= Resultado operacional" bold={true} sep={true} val2025={op25} val2026={op26} />

          <DRERow label="(−) Investimento" bold={true} sep={true} val2025={-inv25Total} val2026={-inv26Total} />
          <DRERow
            label="Compra de matrizes (Investimento Criação Animal)"
            indent={1}
            val2025={-k25.investLeite}
            val2026={-k26.investLeite}
          />
          <DRERow
            label="Animal Aquisição (reclassificado pela IA)"
            indent={1}
            italic={true}
            val2025={-k25.animalAquisicao}
            val2026={-k26.animalAquisicao}
          />
          <DRERow label="Plantio café (expansão talhão)" indent={1} val2025={-k25.investCafe} val2026={-k26.investCafe} />

          <DRERow label="= Fluxo líquido" bold={true} sep={true} val2025={k25.totalGeral} val2026={k26.totalGeral} />
        </tbody>
      </table>

      <div className="footnote" style={{ marginTop: 14 }}>
        <span className="dagger">†</span>
        <span>
          “Animal Aquisição” aparece como Custeio na planilha do BPO — a IA reclassifica como Investimento. Sem essa
          reclassificação, o operacional aparente fica −R$ 1,96 mi em 2025 (vs −R$ 700k real).
        </span>
      </div>
    </section>
  );
}

function CategoriasReais({ onDrill }: { onDrill?: (id: string) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const top = R.categoriasReais.slice().sort((a: any, b: any) => b.total23m - a.total23m).slice(0, 12);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const max = Math.max(...top.map((c: any) => c.total23m));

  return (
    <section className="cats-real">
      <div className="brutal-head">
        <span className="num-chip">III</span>
        <div>
          <h2 className="section-title">Onde o dinheiro foi — 23 meses</h2>
          <p className="section-lede">
            12 maiores categorias na planilha. Itens marcados com triângulo são classificações que a IA aponta como
            duvidosas (compra de gado em custeio, caminhão/trator em Curral).
          </p>
        </div>
      </div>

      <div className="cats-real-list">
        {top.map((c: { id: string; nome: string; flag?: string; grupo: string; subgrupo: string; total23m: number; ytd2026: number; delta: number; atividade: string }, i: number) => {
          const w = (c.total23m / max) * 100;
          const colorVar =
            c.atividade === "leite" ? "var(--leite)" : c.atividade === "cafe" ? "var(--cafe)" : "var(--outros)";
          return (
            <button key={c.id} className="cat-real-row" onClick={() => onDrill && onDrill(c.id)}>
              <span className="rnk">{String(i + 1).padStart(2, "0")}</span>
              <div className="nm-cell">
                <span className="nm">
                  {c.nome}
                  {c.flag && (
                    <span className="flag-warn" title="Possível misclassificação detectada pela IA">
                      ⚠
                    </span>
                  )}
                </span>
                <span className="sub">
                  {c.grupo} · {c.subgrupo}
                </span>
              </div>
              <div className="bar-cell">
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${w}%`, background: colorVar }}></div>
                </div>
              </div>
              <span className="tot mono-nums">{fmtBRL(c.total23m)}</span>
              <span className="ytd mono-nums">
                <small>YTD 26</small>
                {fmtBRL(c.ytd2026)}
              </span>
              <span className={"dlt " + (c.delta > 0 ? "up" : "down")}>
                {c.delta > 0 ? "▲" : "▼"} {Math.abs(c.delta)}%
              </span>
              <span className="arr serif">›</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function InconsistenciasSection() {
  return (
    <section className="inc-section">
      <div className="brutal-head">
        <span className="num-chip">IV</span>
        <div>
          <h2 className="section-title">Inconsistências detectadas pela IA</h2>
          <p className="section-lede">
            Cruzando categorias, fornecedores e padrões dos lançamentos. Cada aplicação reorganiza a leitura sem
            apagar os dados originais — sempre dá pra reverter.
          </p>
        </div>
      </div>

      <div className="inc-grid">
        {R.inconsistencias.map(
          (it: {
            id: string;
            severidade: "alta" | "media" | "baixa";
            valor: number;
            titulo: string;
            detalhe: string;
            impacto: string;
            acao: string;
          }) => (
            <div key={it.id} className={"inc-card sev-" + it.severidade}>
              <div className="inc-head">
                <span className={"sev-chip sev-" + it.severidade}>
                  {it.severidade === "alta" ? "Crítica" : it.severidade === "media" ? "Média" : "Baixa"}
                </span>
                <span className="inc-valor mono-nums">{fmtBRL(it.valor)}</span>
              </div>
              <div className="inc-title">{it.titulo}</div>
              <p className="inc-detalhe">{it.detalhe}</p>
              <div className="inc-impacto">
                <span className="lbl">Impacto se aplicar:</span>
                <span className="txt">{it.impacto}</span>
              </div>
              <div className="inc-actions">
                <button className="btn-primary" style={{ padding: "8px 14px", fontSize: 12 }}>
                  {it.acao}
                </button>
                <button className="btn-ghost" style={{ padding: "8px 12px", fontSize: 12 }}>
                  Ignorar
                </button>
              </div>
            </div>
          ),
        )}
      </div>
    </section>
  );
}

function CategoryDrill({
  catId,
  onBack,
  onNav,
}: {
  catId: string;
  onBack: () => void;
  onNav: (t: Tab) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cat = R.categoriasReais.find((c: any) => c.id === catId);
  if (!cat)
    return (
      <div className="shell-wide">
        <div style={{ padding: 60 }}>
          <button className="crumb-btn" onClick={onBack}>
            ← voltar ao Dashboard
          </button>
          <div style={{ marginTop: 30, fontFamily: "var(--serif)", fontSize: 24 }}>Categoria não encontrada</div>
        </div>
      </div>
    );

  const monthlyKey = (
    {
      racao: "racao",
      curral: "curral",
      pessoalSal: "pessoal",
      medic: "medicamento",
      insumosCafe: "insumosCafe",
      combust: "combustivel",
      manutencao: "manutencao",
      energia: "energia",
    } as Record<string, string>
  )[catId];
  const detalhe = monthlyKey ? R.categoriasDetalhe?.[monthlyKey] : null;

  return (
    <div className="shell-wide">
      <div className="breadcrumb">
        <button className="crumb-btn" onClick={onBack}>
          Dashboard
        </button>
        <span className="sep">›</span>
        <span className="now">{cat.nome}</span>
      </div>

      <div className="drill-head">
        <div className="title-block">
          <span className="eyebrow">
            Categoria · {cat.grupo} → {cat.subgrupo}
          </span>
          <div className="cat-name">
            {cat.nome}
            {cat.flag && <span className="flag-warn-big">⚠</span>}
          </div>
        </div>
        <div></div>
        <div className="total-block">
          <span className="eyebrow">Total 23 meses</span>
          <span className="v mono-nums">{fmtBRL(cat.total23m)}</span>
          <span className="dlt" style={{ color: cat.delta > 0 ? "var(--neg)" : "var(--pos)" }}>
            {cat.delta > 0 ? "▲" : "▼"} {Math.abs(cat.delta)}% vs 2025 (mesmo período)
          </span>
        </div>
      </div>

      <div className="drill-stats">
        <div className="cell">
          <span className="l">YTD 2026 (Jan-Mai*)</span>
          <span className="v mono-nums">{fmtBRL(cat.ytd2026)}</span>
        </div>
        <div className="cell">
          <span className="l">% do custeio total 23m</span>
          <span className="v mono-nums">{((cat.total23m / 7104256) * 100).toFixed(1)}%</span>
        </div>
        <div className="cell">
          <span className="l">Atividade</span>
          <span className="v">
            {cat.atividade === "leite" ? "Leite" : cat.atividade === "cafe" ? "Café" : "Outros / Estrutural"}
          </span>
        </div>
        <div className="cell">
          <span className="l">Status classificação</span>
          <span className="v" style={{ color: cat.flag ? "var(--neg)" : "var(--pos)" }}>
            {cat.flag ? "Marcada pela IA" : "OK"}
          </span>
        </div>
      </div>

      {detalhe && (
        <div style={{ padding: "28px 0", borderBottom: "1px solid var(--rule)" }}>
          <div className="panel-title" style={{ marginBottom: 16 }}>
            <h3>Tendência mensal · últimos 12 meses</h3>
            <span className="meta">linha pontilhada = mesmo período 2024–25</span>
          </div>
          <MonthlyTrendChart
            current={detalhe.monthly12m}
            prior={detalhe.monthlyPriorYear}
            labels={R.MESES_12M}
            color="var(--cafe)"
          />
          <div className="drill-insight" style={{ marginTop: 20 }}>
            <span className="tag">Análise da IA</span>
            {detalhe.insight}
          </div>
        </div>
      )}

      {!detalhe && (
        <div style={{ padding: 60, textAlign: "center" }}>
          <div className="caption" style={{ fontStyle: "italic" }}>
            Quebra mensal e por fornecedor desta categoria será mostrada quando os dados detalhados estiverem
            indexados.
          </div>
        </div>
      )}

      <div style={{ padding: "30px 0 60px", display: "flex", justifyContent: "space-between" }}>
        <button className="crumb-btn" onClick={onBack}>
          ← voltar ao Dashboard
        </button>
        <button className="crumb-btn" onClick={() => onNav("ia")}>
          perguntar à IA sobre {cat.nome.toLowerCase()} →
        </button>
      </div>
    </div>
  );
}

export function Dashboard({ onNav }: { onNav: (t: Tab) => void }) {
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [drillCat, setDrillCat] = useState<string | null>(null);

  if (drillCat) {
    return <CategoryDrill catId={drillCat} onBack={() => setDrillCat(null)} onNav={onNav} />;
  }

  return (
    <div className="shell-wide">
      <HeroBand range={range} setRange={setRange} />
      <TimelineSection />
      <DRESection />
      <CategoriasReais onDrill={setDrillCat} />
      <InconsistenciasSection />

      <div
        style={{
          padding: "32px 0 60px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span className="caption" style={{ letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Fonte: planilha BPO 04/05/2026 · próxima entrega 04/jun/2026
        </span>
        <button className="crumb-btn" onClick={() => onNav("relatorio")}>
          ver Relatório editorial →
        </button>
      </div>
    </div>
  );
}
