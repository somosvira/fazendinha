/* Rio Novo — SVG charts e formatadores (sem chart lib externa) */

export const fmt = (
  n: number,
  opts: { showSign?: boolean; decimals?: number; unit?: string } = {},
): string => {
  const { showSign = false, decimals = 0 } = opts;
  const absVal = Math.abs(n);
  const formatted = absVal.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const sign = n < 0 ? "−" : showSign ? "+" : "";
  return sign + formatted;
};

export const fmtBR = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

export const fmtMoney = (
  kThousands: number,
  opts: { compact?: boolean } = {},
): string => {
  const { compact = true } = opts;
  const abs = Math.abs(kThousands);
  const sign = kThousands < 0 ? "−" : "";
  if (compact && abs >= 1000) {
    return `${sign}R$ ${(abs / 1000).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} mi`;
  }
  return `${sign}R$ ${fmtBR(abs)} mil`;
};

export const fmtMoneyExact = (val: number): string => {
  const abs = Math.abs(val);
  const sign = val < 0 ? "−" : "";
  return `${sign}R$ ${abs.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/** Reais BRUTOS, compacto: exato < R$ 10 mil, "mil" ≥ 10 mil, "mi" ≥ 1 mi.
 *  Formatador canônico do Dashboard e do Relatório — passe sempre o valor em
 *  reais (não em milhares) para a MESMA cifra aparecer igual nas duas telas. */
export function fmtBRL(n: number, opts: { compact?: boolean; decimals?: number } = {}): string {
  const { compact = true, decimals } = opts;
  if (n === 0) return "R$ 0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (compact && abs >= 1_000_000) {
    return `${sign}R$ ${(abs / 1_000_000).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} mi`;
  }
  if (compact && abs >= 10_000) {
    return `${sign}R$ ${(abs / 1_000).toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })} mil`;
  }
  return `${sign}R$ ${abs.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 0,
  })}`;
}

type FluxoMensal = {
  mes: string;
  receitaLeite: number;
  receitaCafe: number;
  receitaOutros: number;
  custeio: number;
  investimento: number;
};

export function MonthlyFlowChart({ data }: { data: FluxoMensal[] }) {
  const W = 760,
    H = 320;
  const padL = 56,
    padR = 24,
    padT = 24,
    padB = 48;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const receitas = data.map((d) => d.receitaLeite + d.receitaCafe + d.receitaOutros);
  const custeios = data.map((d) => d.custeio);
  const invests = data.map((d) => d.investimento);
  const fluxos = data.map((_, i) => receitas[i] - custeios[i] - invests[i]);

  const maxPos = Math.max(...receitas, ...custeios, ...invests, 500);
  const minNeg = Math.min(...fluxos, -200);
  const yMax = Math.ceil(maxPos / 200) * 200;
  const yMin = Math.floor(minNeg / 200) * 200;
  const yRange = yMax - yMin;

  const yScale = (v: number) => padT + innerH - ((v - yMin) / yRange) * innerH;
  const xBand = innerW / data.length;
  const groupW = xBand * 0.7;
  const barW = groupW / 3 - 4;

  const tickStep = 500;
  const ticks: number[] = [];
  for (let v = Math.ceil(yMin / tickStep) * tickStep; v <= yMax; v += tickStep) ticks.push(v);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", maxHeight: 360 }}>
      {ticks.map((v) => (
        <g key={v}>
          <line
            x1={padL}
            x2={W - padR}
            y1={yScale(v)}
            y2={yScale(v)}
            className={v === 0 ? "chart-axis" : "grid-line"}
          />
          <text x={padL - 10} y={yScale(v) + 4} textAnchor="end" className="chart-tick-text">
            {v === 0 ? "0" : fmt(v / 1000, { decimals: 1 }) + " mi"}
          </text>
        </g>
      ))}
      <line x1={padL} x2={W - padR} y1={yScale(0)} y2={yScale(0)} className="chart-axis" />
      {data.map((d, i) => {
        const xStart = padL + i * xBand + (xBand - groupW) / 2;
        const r = receitas[i];
        const c = custeios[i];
        const inv = invests[i];
        return (
          <g key={i}>
            <rect x={xStart} y={yScale(r)} width={barW} height={yScale(0) - yScale(r)} fill="var(--leite)" />
            <rect
              x={xStart + barW + 6}
              y={yScale(0)}
              width={barW}
              height={yScale(0) - yScale(-c)}
              fill="var(--cafe)"
              opacity="0.85"
            />
            <rect
              x={xStart + (barW + 6) * 2}
              y={yScale(0)}
              width={barW}
              height={yScale(0) - yScale(-inv)}
              fill="none"
              stroke="var(--outros)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <rect
              x={xStart + (barW + 6) * 2}
              y={yScale(0)}
              width={barW}
              height={yScale(0) - yScale(-inv)}
              fill="var(--outros)"
              opacity="0.18"
            />
            <text x={xStart + groupW / 2} y={H - padB + 22} textAnchor="middle" className="chart-tick-text">
              {d.mes}
            </text>
          </g>
        );
      })}
      <polyline
        fill="none"
        stroke="var(--ink)"
        strokeWidth="1.5"
        points={data
          .map((_, i) => {
            const x = padL + i * xBand + xBand / 2;
            const y = yScale(fluxos[i]);
            return `${x},${y}`;
          })
          .join(" ")}
      />
      {data.map((_, i) => {
        const x = padL + i * xBand + xBand / 2;
        const y = yScale(fluxos[i]);
        return (
          <g key={`pt-${i}`}>
            <circle cx={x} cy={y} r="4" fill="var(--bg)" stroke="var(--ink)" strokeWidth="1.5" />
            <text x={x} y={y - 10} textAnchor="middle" className="chart-value-text">
              {fmt(fluxos[i])}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

type WaterfallStep = {
  key: string;
  label: string;
  value: number;
  type: "receita" | "custeio" | "saldo" | "investimento" | "fluxo";
};

export function WaterfallChart({ data }: { data: WaterfallStep[] }) {
  const W = 760,
    H = 340;
  const padL = 24,
    padR = 24,
    padT = 32,
    padB = 56;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const yMax = 1300;
  const yMin = -4400;
  const yRange = yMax - yMin;
  const yScale = (v: number) => padT + innerH - ((v - yMin) / yRange) * innerH;

  const N = data.length;
  const xBand = innerW / N;
  const barW = xBand * 0.45;

  let running = 0;
  const ticks = [-4000, -3000, -2000, -1000, 0, 1000];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", maxHeight: 380 }}>
      {ticks.map((v) => (
        <g key={v}>
          <line
            x1={padL}
            x2={W - padR}
            y1={yScale(v)}
            y2={yScale(v)}
            className={v === 0 ? "chart-axis" : "grid-line"}
          />
          <text x={W - padR} y={yScale(v) - 4} textAnchor="end" className="chart-tick-text">
            {v === 0 ? "0" : (v > 0 ? "+" : "−") + Math.abs(v / 1000).toFixed(1) + " mi"}
          </text>
        </g>
      ))}
      {data.map((step, i) => {
        const x = padL + i * xBand + (xBand - barW) / 2;
        let yTop = 0,
          yBot = 0,
          fill = "var(--ink)",
          dashed = false;
        const prev = running;

        if (step.type === "receita") {
          running += step.value;
          yTop = yScale(running);
          yBot = yScale(0);
          fill = "var(--leite)";
        } else if (step.type === "custeio") {
          running += step.value;
          yTop = yScale(prev);
          yBot = yScale(running);
          fill = "var(--cafe)";
        } else if (step.type === "saldo") {
          yTop = yScale(Math.max(0, running));
          yBot = yScale(Math.min(0, running));
          fill = "var(--ink)";
        } else if (step.type === "investimento") {
          running += step.value;
          yTop = yScale(prev);
          yBot = yScale(running);
          fill = "var(--outros)";
          dashed = true;
        } else if (step.type === "fluxo") {
          yTop = yScale(Math.max(0, running));
          yBot = yScale(Math.min(0, running));
          fill = "var(--neg)";
        }

        const isSubtotal = step.type === "saldo" || step.type === "fluxo";

        return (
          <g key={step.key}>
            {dashed ? (
              <>
                <rect
                  x={x}
                  y={Math.min(yTop, yBot)}
                  width={barW}
                  height={Math.abs(yBot - yTop)}
                  fill="var(--outros)"
                  opacity="0.2"
                />
                <rect
                  x={x}
                  y={Math.min(yTop, yBot)}
                  width={barW}
                  height={Math.abs(yBot - yTop)}
                  fill="none"
                  stroke="var(--outros)"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
              </>
            ) : (
              <rect
                x={x}
                y={Math.min(yTop, yBot)}
                width={barW}
                height={Math.abs(yBot - yTop)}
                fill={fill}
              />
            )}
            {i < N - 1 && step.type !== "saldo" && step.type !== "fluxo" && (
              <line
                x1={x + barW}
                x2={padL + (i + 1) * xBand + (xBand - barW) / 2}
                y1={yScale(running)}
                y2={yScale(running)}
                stroke="var(--ink-mute)"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
            )}
            <text
              x={x + barW / 2}
              y={H - padB + 22}
              textAnchor="middle"
              className="chart-tick-text"
              style={{ fontSize: 12, fill: "var(--ink-2)" }}
            >
              {step.label}
            </text>
            <text
              x={x + barW / 2}
              y={Math.min(yTop, yBot) - 8}
              textAnchor="middle"
              className="chart-value-text"
              style={{
                fontSize: 14,
                fill: isSubtotal ? "var(--ink)" : "var(--ink-2)",
                fontWeight: isSubtotal ? 500 : 400,
              }}
            >
              {step.value === 0
                ? "0"
                : (step.value > 0 ? "+" : "−") +
                  "R$ " +
                  (Math.abs(step.value) / 1000).toFixed(2) +
                  " mi"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function MiniBarChart({
  data,
  color = "var(--ink)",
}: {
  data: { x: string; y: number }[];
  color?: string;
}) {
  const W = 360,
    H = 120;
  const padL = 28,
    padR = 8,
    padT = 16,
    padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const max = Math.max(...data.map((d) => d.y), 0) * 1.1 || 1;
  const yScale = (v: number) => padT + innerH - (Math.max(0, v) / max) * innerH;
  const xBand = innerW / data.length;
  const barW = xBand * 0.55;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", maxWidth: 400 }}>
      <line x1={padL} x2={W - padR} y1={yScale(0)} y2={yScale(0)} className="chart-axis" />
      {data.map((d, i) => {
        const x = padL + i * xBand + (xBand - barW) / 2;
        const h = Math.max(0, yScale(0) - yScale(d.y));
        return (
          <g key={i}>
            <rect x={x} y={yScale(d.y)} width={barW} height={h} fill={color} />
            <text x={x + barW / 2} y={yScale(d.y) - 6} textAnchor="middle" className="chart-value-text">
              {d.y}
            </text>
            <text x={x + barW / 2} y={H - padB + 18} textAnchor="middle" className="chart-tick-text">
              {d.x}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function MonthlyTrendChart({
  current,
  prior,
  labels,
  color = "var(--cafe)",
}: {
  current: number[];
  prior: number[];
  labels: string[];
  color?: string;
}) {
  const W = 720,
    H = 220;
  const padL = 40,
    padR = 16,
    padT = 16,
    padB = 32;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(...current, ...prior, 0) * 1.1 || 1;
  const yScale = (v: number) => padT + innerH - (Math.max(0, v) / max) * innerH;
  const xBand = innerW / labels.length;
  const barW = xBand * 0.5;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", maxHeight: 240 }}>
      <line x1={padL} x2={W - padR} y1={yScale(0)} y2={yScale(0)} className="chart-axis" />
      {labels.map((lbl, i) => {
        const x = padL + i * xBand + (xBand - barW) / 2;
        const cur = current[i] ?? 0;
        const h = Math.max(0, yScale(0) - yScale(cur));
        return (
          <g key={i}>
            <rect
              x={x}
              y={yScale(cur)}
              width={barW}
              height={h}
              fill={color}
            />
            <text x={x + barW / 2} y={H - padB + 16} textAnchor="middle" className="chart-tick-text">
              {lbl}
            </text>
          </g>
        );
      })}
      <polyline
        fill="none"
        stroke="var(--ink-mute)"
        strokeWidth="1.2"
        strokeDasharray="4 4"
        points={prior
          .map((v, i) => {
            const x = padL + i * xBand + xBand / 2;
            const y = yScale(v);
            return `${x},${y}`;
          })
          .join(" ")}
      />
    </svg>
  );
}

export function Donut({
  segments,
  size = 140,
  label,
}: {
  segments: { value: number; color: string }[];
  size?: number;
  label?: string;
}) {
  const r = size / 2 - 14;
  const cx = size / 2,
    cy = size / 2;
  const total = segments.reduce((s, x) => s + x.value, 0);
  let acc = 0;
  const stroke = 18;
  const C = 2 * Math.PI * r;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--rule-soft)" strokeWidth={stroke} />
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dash = pct * C;
        const offset = -acc * C;
        acc += pct;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${C - dash}`}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
      })}
      {label && (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontFamily: "var(--serif)", fontSize: 18, fill: "var(--ink)" }}
        >
          {label}
        </text>
      )}
    </svg>
  );
}
