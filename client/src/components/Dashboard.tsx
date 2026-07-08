/* Rio Novo — Dashboard v3 — cockpit interativo (números + gráficos)
 *
 * Porta do protótipo de design (handoff index.html) para o codebase real.
 * Estado: lê de GET /api/dashboard (server agrega os lançamentos). Subcategorias,
 * fornecedores e volume de leite vêm como suplementos estáticos casados por nome
 * de categoria (ver api.ts + data/cockpitSupplements.ts) — o backend ainda não
 * modela esses níveis de drill.
 *
 * A narrativa ("o leite paga o leite?", prosa) vive só no Relatório, por decisão
 * do cliente; aqui é número, gráfico e drill.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchDashboard, reclassificarCategoria, fetchLancamentos, type LancamentoDrill } from "../api";
import { getHoje } from "../lib/hoje";
import { formatRangeLabel, type DateRange } from "./DateRangePicker";
import { MonthRangePicker } from "./MonthRangePicker";
import type { Tab } from "./Shell";
import type { User } from "../data/acessos";
import { PAPEIS } from "../data/acessos";
import { RupturaCaixa } from "./RupturaCaixa";
import { ContextStrip } from "./ContextStrip";
import { DashSectionHeader } from "./report/primitives";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type R = any;

/* id de categoria: o payload usa id numérico (Prisma) nas reais e slug string nas
 * sintetizadas; orçamento/anomalias referenciam slugs de design. Aceita ambos. */
type CatId = string | number;

// slugs de design → nome da categoria no payload (fallback do drill por orçado/anomalia)
const SLUG_TO_NOME: Record<string, string> = {
  racao: "Ração",
  curral: "Curral",
  pessoalSal: "Pessoal — Salário",
  medic: "Medicamento Animal",
  combust: "Combustível",
  manutencao: "Manutenção",
  energia: "Energia Elétrica",
  animalAq: "Animal Aquisição",
};

// Seções que dependem de dado ainda inexistente (rebanho, orçamento, ruptura
// diária, resumo da IA). false = escondidas; vira true quando o dado entrar.
const SECOES_SEM_DADO = false;

// Seções multi-período (Fluxo mês a mês, DRE anual) não cabem numa dashboard de
// mês único — vão para a futura dashboard de períodos longos.
const MOSTRAR_MULTI_PERIODO = false;

// Filtro mensal. Padrão = UM mês (o corrente) — dashboard focada em mês
// fechado, mais fácil de casar 100% com o chat. Períodos longos ficam p/ outra tela.
// FILTRO_MIN é a data em que começa a haver dados históricos (jul/2024) — fixa.
// FILTRO_MAX e DEFAULT_RANGE seguem o mês corrente (via getHoje() = lib/hoje.ts).
const FILTRO_MIN = new Date(2024, 6, 1);   // jul/2024 — início da série histórica
const _HOJE = getHoje();
const FILTRO_MAX = new Date(_HOJE.getFullYear(), _HOJE.getMonth(), 1);
const DEFAULT_RANGE: DateRange = {
  start: new Date(_HOJE.getFullYear(), _HOJE.getMonth(), 1),
  end: new Date(_HOJE.getFullYear(), _HOJE.getMonth() + 1, 0),
};

// Date → "YYYY-MM-DD" (data local, sem deslocar fuso) para o filtro do servidor.
const ymd = (d: Date | null): string | undefined =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : undefined;

/* ========== FORMAT ========== */

function fmtBRL(n: number, opts: { compact?: boolean; decimals?: number } = {}): string {
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

export { fmtBRL };

const CAT_PALETTE = [
  "#B89A5C", "#5C3A1E", "#6B7A5C", "#D4BC85", "#8A5A30", "#93A07F",
  "#A8543A", "#C9B98F", "#3D5A3D", "#8A6A20", "#6B7370", "#A8A089",
  "#7A3328", "#4A5240", "#C2A878", "#3A4341", "#9B6B43", "#7E8C6A",
  "#5F4B32", "#B0B7A0",
];

/* deterministic monthly distribution that respects pre/ytd split */
function seededMonthly(total: number, seedStr: string, n: number): number[] {
  let seed = 7;
  for (const ch of seedStr) seed = (seed * 31 + ch.charCodeAt(0)) % 233280;
  const raw: number[] = [];
  let x = 1;
  for (let i = 0; i < n; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    const r = seed / 233280;
    x = Math.max(0.25, x + (r - 0.5) * 0.7);
    raw.push(x);
  }
  const s = raw.reduce((a, b) => a + b, 0) || 1;
  return raw.map((v) => Math.round((v / s) * total));
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function categoryMonthly(cat: any): number[] {
  const pre = Math.max(0, cat.total23m - cat.ytd2026);
  const a = seededMonthly(pre, cat.id + "·pre", 18);
  const b = seededMonthly(cat.ytd2026, cat.id + "·ytd", 5);
  return [...a, ...b];
}

/* ========== TIMELINE CHART (kept, compact) ========== */

function TimelineChart({
  R,
  startIdx = 0,
  endIdx = 22,
  height = 340,
  onMonthClick,
}: {
  R: R;
  startIdx?: number;
  endIdx?: number;
  height?: number;
  onMonthClick?: (idx: number) => void;
}) {
  const W = 1180, H = height;
  const padL = 64, padR = 24, padT = 24, padB = 52;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const slice = <T,>(a: T[]): T[] => a.slice(startIdx, endIdx + 1);
  const meses = slice<string>(R.MESES_23M);
  const recL = slice<number>(R.receitaLeite);
  const recC = slice<number>(R.receitaCafe);
  const cusP = slice<number>(R.custeioLeitePuro).map(
    (v, i) => v + slice<number>(R.custeioCafe)[i] + slice<number>(R.sedeOutros)[i],
  );
  const animAq = slice<number>(R.animalAquisicao);
  const inv = slice<number>(R.investLeite).map((v, i) => v + slice<number>(R.investCafe)[i]);
  const tot = slice<number>(R.totalGeral);

  const maxRec = Math.max(...recL.map((v, i) => v + recC[i]), 1);
  const maxNeg = Math.max(...cusP.map((v, i) => v + animAq[i] + inv[i]), 1);
  const yMax = Math.ceil(maxRec / 100000) * 100000;
  const yMin = -Math.ceil(maxNeg / 100000) * 100000;
  const yRange = yMax - yMin;
  const yScale = (v: number) => padT + innerH - ((v - yMin) / yRange) * innerH;
  const xBand = innerW / meses.length;
  const barW = Math.min(28, xBand * 0.55);

  const step = yMax >= 1_500_000 ? 500_000 : 200_000;
  const ticks: number[] = [];
  for (let v = Math.floor(yMin / step) * step; v <= yMax; v += step) ticks.push(v);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={padL} x2={W - padR} y1={yScale(v)} y2={yScale(v)} className={v === 0 ? "chart-axis" : "grid-line"} />
          <text x={padL - 10} y={yScale(v) + 4} textAnchor="end" className="chart-tick-text">
            {v === 0 ? "0" : (v > 0 ? "" : "−") + (Math.abs(v) / 1_000_000).toFixed(1) + "mi"}
          </text>
        </g>
      ))}
      {meses.map((m, i) => {
        if (m.startsWith("Jan")) {
          const x = padL + i * xBand;
          return <line key={"sep" + i} x1={x} x2={x} y1={padT - 4} y2={H - padB + 6} stroke="var(--rule)" strokeDasharray="2 3" />;
        }
        return null;
      })}
      {meses.map((m, i) => {
        const x = padL + i * xBand + (xBand - barW) / 2;
        const recLeite = recL[i], recCafe = recC[i];
        const globalIdx = startIdx + i;
        return (
          <g
            key={i}
            className={onMonthClick ? "tl-month-g" : ""}
            style={onMonthClick ? { cursor: "pointer" } : undefined}
            onClick={onMonthClick ? () => onMonthClick(globalIdx) : undefined}
          >
            {onMonthClick && (
              <rect x={padL + i * xBand} y={padT - 4} width={xBand} height={innerH + 8} fill="var(--ink)" opacity="0" className="tl-hit" />
            )}
            {recLeite > 0 && <rect x={x} y={yScale(recLeite)} width={barW} height={yScale(0) - yScale(recLeite)} fill="var(--leite)" />}
            {recCafe > 0 && <rect x={x} y={yScale(recLeite + recCafe)} width={barW} height={yScale(recLeite) - yScale(recLeite + recCafe)} fill="var(--cafe)" />}
            {cusP[i] > 0 && <rect x={x} y={yScale(0)} width={barW} height={yScale(-cusP[i]) - yScale(0)} fill="var(--cafe)" opacity="0.85" />}
            {animAq[i] > 0 && <rect x={x} y={yScale(-cusP[i])} width={barW} height={yScale(-cusP[i] - animAq[i]) - yScale(-cusP[i])} fill="url(#stripes-neg)" />}
            {inv[i] > 0 && (
              <g>
                <rect x={x} y={yScale(-cusP[i] - animAq[i])} width={barW} height={yScale(-cusP[i] - animAq[i] - inv[i]) - yScale(-cusP[i] - animAq[i])} fill="var(--outros)" opacity="0.22" />
                <rect x={x} y={yScale(-cusP[i] - animAq[i])} width={barW} height={yScale(-cusP[i] - animAq[i] - inv[i]) - yScale(-cusP[i] - animAq[i])} fill="none" stroke="var(--outros)" strokeWidth="1" strokeDasharray="3 3" />
              </g>
            )}
            {(i % 2 === 0 || i === meses.length - 1) && (
              <text x={x + barW / 2} y={H - padB + 18} textAnchor="middle" className="chart-tick-text">{m.replace(/\/\d{2}\*?$/, "")}</text>
            )}
          </g>
        );
      })}
      <polyline fill="none" stroke="var(--ink)" strokeWidth="1.4" style={{ pointerEvents: "none" }}
        points={meses.map((_, i) => `${padL + i * xBand + xBand / 2},${yScale(tot[i])}`).join(" ")} />
      {meses.map((_, i) => <circle key={"p" + i} cx={padL + i * xBand + xBand / 2} cy={yScale(tot[i])} r="2.5" fill="var(--bg)" stroke="var(--ink)" strokeWidth="1.2" style={{ pointerEvents: "none" }} />)}
      <defs>
        <pattern id="stripes-neg" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
          <rect width="4" height="4" fill="var(--prejuizo)" opacity="0.35" />
          <line x1="0" y1="0" x2="0" y2="4" stroke="var(--prejuizo)" strokeWidth="0.8" />
        </pattern>
      </defs>
    </svg>
  );
}

/* ========== BAR SERIES (single category, 23m) ========== */

function BarSeries({ data, labels, color = "var(--cafe)", height = 200 }: { data: number[]; labels: string[]; color?: string; height?: number }) {
  const W = 760, H = height;
  const padL = 48, padR = 12, padT = 16, padB = 34;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(...data, 1) * 1.12;
  const yScale = (v: number) => padT + innerH - (v / max) * innerH;
  const xBand = innerW / data.length;
  const barW = Math.min(22, xBand * 0.6);

  const niceStep = (m: number) => {
    const raw = m / 3;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    return Math.ceil(raw / pow) * pow;
  };
  const step = niceStep(max);
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={padL} x2={W - padR} y1={yScale(v)} y2={yScale(v)} className={v === 0 ? "chart-axis" : "grid-line"} />
          <text x={padL - 8} y={yScale(v) + 4} textAnchor="end" className="chart-tick-text">
            {v === 0 ? "0" : (v / 1000).toFixed(0) + "k"}
          </text>
        </g>
      ))}
      {data.map((v, i) => {
        const x = padL + i * xBand + (xBand - barW) / 2;
        return (
          <g key={i}>
            <rect x={x} y={yScale(v)} width={barW} height={yScale(0) - yScale(v)} fill={color} />
            {(i % 2 === 0 || i === data.length - 1) && (
              <text x={x + barW / 2} y={H - padB + 16} textAnchor="middle" className="chart-tick-text">{labels[i].replace(/\/\d{2}\*?$/, "")}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ========== DONUT (annular sectors, clickable) ========== */

function polar(cx: number, cy: number, r: number, a: number): [number, number] {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function annular(cx: number, cy: number, rO: number, rI: number, a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = polar(cx, cy, rO, a0);
  const [x1, y1] = polar(cx, cy, rO, a1);
  const [x2, y2] = polar(cx, cy, rI, a1);
  const [x3, y3] = polar(cx, cy, rI, a0);
  return `M${x0},${y0} A${rO},${rO} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${rI},${rI} 0 ${large} 0 ${x3},${y3} Z`;
}

type Segment = { id: string; value: number; color: string };

function Donut({ segments, total, onSliceClick, hovered, setHovered }: {
  segments: Segment[];
  total: number;
  onSliceClick: (id: string) => void;
  hovered: string | null;
  setHovered: (id: string | null) => void;
}) {
  const size = 260, cx = size / 2, cy = size / 2, rO = 118, rI = 74;
  let acc = -Math.PI / 2;
  const gap = segments.length > 1 ? 0.012 : 0;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: "block" }}>
      {segments.length === 0 && (
        <circle cx={cx} cy={cy} r={(rO + rI) / 2} fill="none" stroke="var(--rule-soft)" strokeWidth={rO - rI} />
      )}
      {segments.length === 1 && (
        <circle cx={cx} cy={cy} r={(rO + rI) / 2} fill="none" stroke={segments[0].color} strokeWidth={rO - rI}
          style={{ cursor: "pointer" }} onClick={() => onSliceClick(segments[0].id)} />
      )}
      {segments.length > 1 && segments.map((seg) => {
        const frac = seg.value / total;
        const a0 = acc + gap / 2;
        const a1 = acc + frac * Math.PI * 2 - gap / 2;
        acc += frac * Math.PI * 2;
        const isHover = hovered === seg.id;
        return (
          <path
            key={seg.id}
            d={annular(cx, cy, isHover ? rO + 4 : rO, rI, a0, a1)}
            fill={seg.color}
            style={{ cursor: "pointer", transition: "d 120ms" }}
            onClick={() => onSliceClick(seg.id)}
            onMouseEnter={() => setHovered(seg.id)}
            onMouseLeave={() => setHovered(null)}
          />
        );
      })}
      <text x={cx} y={cy - 8} textAnchor="middle" style={{ fontFamily: "var(--sans)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", fill: "var(--ink-3)" }}>Total ativo</text>
      <text x={cx} y={cy + 18} textAnchor="middle" style={{ fontFamily: "var(--serif)", fontSize: 24, fill: "var(--ink)" }} className="mono-nums">
        {fmtBRL(total)}
      </text>
    </svg>
  );
}

/* ========== SECTION 1 — GASTO POR CATEGORIA (interactive donut) ========== */

function GastoPorCategoria({ R, onDrill }: { R: R; onDrill: (id: CatId) => void }) {
  const [period, setPeriod] = useState<"23m" | "ytd">("23m");
  const [act, setAct] = useState("tudo");
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [hovered, setHovered] = useState<string | null>(null);

  const valKey = period === "23m" ? "total23m" : "ytd2026";

  const items = useMemo(() => {
    return R.categoriasReais
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((c: any) => (act === "tudo" ? true : c.atividade === act))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((c: any) => c[valKey] > 0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => b[valKey] - a[valKey])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((c: any, i: number) => ({ ...c, value: c[valKey], color: CAT_PALETTE[i % CAT_PALETTE.length] }));
  }, [R, period, act, valKey]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const active = items.filter((c: any) => !off[c.id]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const total = active.reduce((s: number, c: any) => s + c.value, 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const segments: Segment[] = active.map((c: any) => ({ id: String(c.id), value: c.value, color: c.color }));

  const toggle = (id: string) => setOff((o) => ({ ...o, [id]: !o[id] }));
  const allOn = () => setOff({});
  const onlyOne = (id: string) => {
    const next: Record<string, boolean> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items.forEach((c: any) => { if (String(c.id) !== id) next[String(c.id)] = true; });
    setOff(next);
  };

  return (
    <section className="border-b border-border pt-[34px] pb-[30px]">
      <DashSectionHeader
        eyebrow="Distribuição"
        title="Gasto por categoria"
        right={
          <div className="flex items-center gap-3">
            <div className="inline-flex border border-border bg-card">
              {([["tudo", "Tudo"], ["leite", "Leite"], ["cafe", "Café"], ["outros", "Outros"]] as const).map(([k, l]) => (
                <button
                  key={k}
                  aria-pressed={act === k}
                  onClick={() => { setAct(k); setOff({}); }}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 border-r border-border px-3 py-[7px] text-[14px] tracking-[0.04em] last:border-r-0",
                    act === k ? "bg-mast text-mast-ink" : "bg-transparent text-ink-3",
                  )}
                >
                  {k !== "tudo" && <span className="inline-block h-2 w-2" style={{ background: k === "leite" ? "var(--leite)" : k === "cafe" ? "var(--cafe)" : "var(--outros)" }}></span>}
                  {l}
                </button>
              ))}
            </div>
            <div className="period-switch">
              <button aria-current={period === "23m"} onClick={() => setPeriod("23m")}>23 meses</button>
              <button aria-current={period === "ytd"} onClick={() => setPeriod("ytd")}>2026 YTD</button>
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-[300px_1fr] items-start gap-10">
        <div className="flex flex-col items-center gap-3.5 pt-1.5">
          <Donut segments={segments} total={total} onSliceClick={toggle} hovered={hovered} setHovered={setHovered} />
          <div className="flex flex-col items-center gap-1">
            <span className="caption">{active.length} de {items.length} categorias ativas</span>
            <button
              className="cursor-pointer bg-transparent p-0 text-[14px] text-foreground underline underline-offset-[3px] hover:text-cafe"
              onClick={allOn}
            >
              mostrar todas
            </button>
          </div>
        </div>

        <div className="border border-border bg-card">
          <div className="grid grid-cols-[1fr_120px_64px_40px_26px] gap-2 border-b border-border bg-[var(--bg-card-2)] px-4 py-[11px] text-[14px] font-semibold uppercase tracking-[0.10em] text-ink-3">
            <span>Categoria</span>
            <span className="text-right">Valor</span>
            <span className="text-right">%</span>
          </div>
          <div className="max-h-[340px] overflow-y-auto">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {items.map((c: any) => {
              const sid = String(c.id);
              const isOff = !!off[sid];
              const pct = total > 0 && !isOff ? (c.value / total) * 100 : 0;
              return (
                <div
                  key={sid}
                  className={cn(
                    "grid grid-cols-[1fr_120px_64px_40px_26px] items-center gap-2 border-b border-[color:var(--rule-soft)] pr-4 transition-colors duration-[80ms] last:border-b-0",
                    isOff && "opacity-[0.42]",
                    hovered === sid && "bg-[var(--bg-card-2)]",
                  )}
                  onMouseEnter={() => setHovered(sid)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <button
                    className="flex min-w-0 cursor-pointer items-center gap-2.5 bg-transparent py-[11px] pr-0 pl-4 text-left"
                    onClick={() => toggle(sid)}
                    title={isOff ? "Ativar" : "Desativar"}
                  >
                    <span className="grid h-4 w-4 flex-shrink-0 place-items-center border-[1.5px] border-solid" style={{ background: isOff ? "transparent" : c.color, borderColor: c.color }}>
                      {!isOff && <span className="text-[14px] leading-none" style={{ color: "var(--bg-card)" }}>✓</span>}
                    </span>
                    <span className="inline-flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-semibold text-foreground">
                      {c.nome}
                      {c.flag && <span className="h-[15px] w-[15px] flex-shrink-0 rounded-full border border-solid border-prejuizo text-center text-[14px] leading-[13px] text-prejuizo" title="Classificação marcada pela IA">⚠</span>}
                    </span>
                  </button>
                  <span className="mono-nums text-right font-serif text-[17px] font-medium">{fmtBRL(c.value)}</span>
                  <span className="mono-nums text-right text-[14px] font-semibold text-ink-3">{isOff ? "—" : pct.toFixed(1) + "%"}</span>
                  <button className="cursor-pointer border border-border bg-transparent px-[5px] py-[3px] text-[14px] font-semibold uppercase tracking-[0.08em] text-ink-3 hover:border-mast hover:bg-mast hover:text-mast-ink" onClick={() => onlyOne(sid)} title="Ver só esta">só</button>
                  <button className="cursor-pointer bg-transparent p-0 font-serif text-[17px] text-ink-2 hover:text-foreground" onClick={() => onDrill(c.id)} title="Abrir detalhe">›</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ========== SECTION 2 — EXPLORAR CATEGORIA (dropdown) ========== */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CategoryDropdown({ items, value, onChange }: { items: any[]; value: CatId; onChange: (id: CatId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const sel = items.find((c) => c.id === value);
  return (
    <div className="relative" ref={ref}>
      <button
        className={cn(
          "inline-flex min-w-[260px] cursor-pointer items-center gap-2.5 border border-solid bg-card px-3.5 py-[9px] text-left text-[16px] font-medium text-foreground",
          open ? "border-foreground" : "border-border hover:border-ink-3",
        )}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="h-2.5 w-2.5 flex-shrink-0" style={{ background: sel ? (sel.atividade === "leite" ? "var(--leite)" : sel.atividade === "cafe" ? "var(--cafe)" : "var(--outros)") : "var(--ink-3)" }}></span>
        <span className="flex-1 text-left">{sel ? sel.nome : "Selecione…"}</span>
        <span className="text-[14px] text-ink-3">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-[340px] overflow-y-auto border border-solid border-ink-3 bg-card shadow-[0_12px_32px_rgba(20,25,26,0.14)]">
          {items.map((c) => (
            <button
              key={c.id}
              className={cn(
                "grid w-full cursor-pointer grid-cols-[12px_1fr_auto] items-center gap-2.5 border-b border-solid border-[color:var(--rule-soft)] px-3.5 py-2.5 text-left last:border-b-0 hover:bg-[var(--bg-card-2)]",
                c.id === value ? "bg-[var(--bg-card-2)]" : "bg-transparent",
              )}
              onClick={() => { onChange(c.id); setOpen(false); }}
            >
              <span className="h-2.5 w-2.5 flex-shrink-0" style={{ background: c.atividade === "leite" ? "var(--leite)" : c.atividade === "cafe" ? "var(--cafe)" : "var(--outros)" }}></span>
              <span className="text-[16px] font-medium text-foreground">{c.nome}</span>
              <span className="mono-nums font-serif text-[16px] font-medium text-ink-3">{fmtBRL(c.total23m)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ExplorarCategoria({ R, onDrill }: { R: R; onDrill: (id: CatId) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (R.categoriasReais ?? []).slice().sort((a: any, b: any) => b.total23m - a.total23m);
  const [catId, setCatId] = useState<CatId>(items[0]?.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cat = items.find((c: any) => c.id === catId) ?? items[0];

  if (!cat) {
    return (
      <section className="border-b border-border pt-[34px] pb-[30px]">
        <DashSectionHeader eyebrow="Explorar" title="Detalhe por categoria" />
        <div className="flex flex-col gap-1 py-6">
          <span className="text-[14px] font-semibold uppercase tracking-[0.10em] text-ink-3">Sem categorias no período selecionado.</span>
        </div>
      </section>
    );
  }

  const total = cat.total23m; // já é o total DO PERÍODO (servidor manda categorias do filtro)
  const corAtv = cat.atividade === "leite" ? "var(--leite)" : cat.atividade === "cafe" ? "var(--cafe)" : "var(--outros)";

  // top fornecedores reais da categoria (vêm do servidor: GET /api/dashboard)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const forns: { nome: string; value: number }[] = ((cat as any).fornecedores ?? [])
    .slice(0, 4)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((f: any) => ({ nome: f.nome, value: f.valor }));

  return (
    <section className="border-b border-border pt-[34px] pb-[30px]">
      <DashSectionHeader
        eyebrow="Explorar"
        title="Detalhe por categoria"
        right={
          <div className="flex items-center gap-3">
            <CategoryDropdown items={items} value={catId} onChange={setCatId} />
            <button className="btn-secondary" style={{ padding: "8px 16px" }} onClick={() => onDrill(catId)}>Abrir detalhe completo →</button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-5 border border-border bg-card">
        <div className="flex flex-col gap-1 border-r border-[color:var(--rule-soft)] px-5 py-4 last:border-r-0">
          <span className="text-[14px] font-semibold uppercase tracking-[0.10em] text-ink-3">Total no período</span>
          <span className="mono-nums font-serif text-[28px] font-medium tracking-[-0.015em]">{fmtBRL(total)}</span>
        </div>
        <div className="flex flex-col gap-1 border-r border-[color:var(--rule-soft)] px-5 py-4 last:border-r-0">
          <span className="text-[14px] font-semibold uppercase tracking-[0.10em] text-ink-3">Grupo</span>
          <span className="font-serif text-[16px] tracking-[-0.015em] text-foreground">{cat.grupo}</span>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h3 className="m-0 font-serif text-[16px] font-medium tracking-[-0.005em]">Principais fornecedores</h3>
        </div>
        <div className="flex flex-col gap-3.5">
          {forns.map((f, i) => {
            const max = Math.max(...forns.map((x) => x.value), 1);
            return (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[15px] font-medium text-ink-2">{f.nome}</span>
                  <span className="mono-nums font-serif text-[17px] font-medium">{fmtBRL(f.value)}</span>
                </div>
                <div className="relative h-[7px] bg-[var(--rule-soft)]"><div className="absolute inset-y-0 left-0 h-full" style={{ width: `${(f.value / max) * 100}%`, background: corAtv }}></div></div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ========== SECTION 3 — ATIVIDADE SPLIT ========== */

function AtividadeSplit({ R }: { R: R }) {
  const t = R.totals23m;
  const investOutros = (R.investimentoReais ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((i: any) => i.atividade === "outros")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .reduce((s: number, i: any) => s + i.total23m, 0);

  const cards = [
    { key: "leite", nome: "Leite", cor: "var(--leite)", receita: t.receitaLeite, custeio: t.custeioLeitePuro, invest: t.investLeite + t.animalAquisicao },
    { key: "cafe", nome: "Café", cor: "var(--cafe)", receita: t.receitaCafe, custeio: t.custeioCafe, invest: t.investCafe },
    { key: "outros", nome: "Outros / Sede", cor: "var(--outros)", receita: 0, custeio: t.sedeOutros, invest: investOutros },
  ];
  const maxBar = Math.max(...cards.flatMap((c) => [c.receita, c.custeio, c.invest]), 1);

  return (
    <section className="border-b border-border pt-[34px] pb-[30px]">
      <DashSectionHeader eyebrow="Comparativo · período" title="Leite × Café × Outros" />
      <div className="grid grid-cols-3 gap-px border border-border bg-border">
        {cards.map((c) => {
          const margem = c.receita - c.custeio;
          return (
            <div className="flex flex-col gap-4 bg-card px-[22px] py-5" key={c.key}>
              <div className="flex items-center gap-2.5">
                <span className="h-3.5 w-3.5" style={{ background: c.cor }}></span>
                <span className="font-serif text-[24px] font-medium tracking-[-0.005em]">{c.nome}</span>
              </div>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-[64px_1fr_auto] items-center gap-3">
                  <span className="text-[14px] font-semibold uppercase tracking-[0.08em] text-ink-3">Receita</span>
                  <div className="relative h-3 bg-[var(--rule-soft)]"><div className="absolute inset-y-0 left-0 h-full" style={{ width: `${(c.receita / maxBar) * 100}%`, background: c.cor }}></div></div>
                  <span className="mono-nums min-w-[86px] text-right font-serif text-[16px] font-medium">{fmtBRL(c.receita)}</span>
                </div>
                <div className="grid grid-cols-[64px_1fr_auto] items-center gap-3">
                  <span className="text-[14px] font-semibold uppercase tracking-[0.08em] text-ink-3">Custeio</span>
                  <div className="relative h-3 bg-[var(--rule-soft)]"><div className="absolute inset-y-0 left-0 h-full" style={{ width: `${(c.custeio / maxBar) * 100}%`, background: "var(--cafe)", opacity: 0.7 }}></div></div>
                  <span className="mono-nums min-w-[86px] text-right font-serif text-[16px] font-medium">−{fmtBRL(c.custeio)}</span>
                </div>
                <div className="grid grid-cols-[64px_1fr_auto] items-center gap-3">
                  <span className="text-[14px] font-semibold uppercase tracking-[0.08em] text-ink-3">Investim.</span>
                  <div className="relative h-3 bg-[var(--rule-soft)]"><div className="absolute inset-y-0 left-0 h-full" style={{ width: `${(c.invest / maxBar) * 100}%`, background: "repeating-linear-gradient(45deg, var(--outros) 0 2px, transparent 2px 5px), rgba(107,122,92,0.18)", border: "1px dashed var(--outros)" }}></div></div>
                  <span className="mono-nums min-w-[86px] text-right font-serif text-[16px] font-medium">−{fmtBRL(c.invest)}</span>
                </div>
              </div>
              <div className="flex items-baseline justify-between border-t border-[color:var(--rule-soft)] pt-3.5">
                <span className="text-[14px] font-semibold uppercase tracking-[0.10em] text-ink-3">Margem operacional</span>
                <span className="mono-nums whitespace-nowrap font-serif text-[26px] font-medium tracking-[-0.01em]" style={{ color: margem >= 0 ? "var(--lucro)" : "var(--prejuizo)" }}>
                  {margem >= 0 ? "+" : "−"}{fmtBRL(Math.abs(margem))}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ========== KPI COCKPIT ========== */

function KpiCockpit({ R }: { R: R }) {
  const t = R.totals23m;
  const receita23 = t.receitaLeite + t.receitaCafe;
  const custeio23 = t.custeioLeitePuro + t.custeioCafe + t.sedeOutros;
  const investOutros = (R.investimentoReais ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((i: any) => i.atividade === "outros")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .reduce((s: number, i: any) => s + i.total23m, 0);
  const invest23 = t.investLeite + t.investCafe + t.animalAquisicao + investOutros;
  // Período selecionado (filtro de data). Sem filtro, cai nos totais 23m.
  const p = R.periodo;
  const receita = p ? p.receita : receita23;
  const custeio = p ? p.custeio : custeio23;
  const invest = p ? p.investimento : invest23;
  const fluxo = p ? p.fluxo : t.totalGeral;

  const kpis: { lbl: string; val: string; sub: string; tone: string; int?: string; imp?: string }[] = [
    {
      lbl: "Caixa",
      val: fmtBRL(R.caixaHoje.total, { compact: false }),
      sub: `${R.caixaHoje.contas?.length ?? 0} contas · saldo inicial + fluxo`,
      tone: R.caixaHoje.total < 0 ? "neg" : "",
      int: R.caixaHoje.total < 0 ? "Saldo negativo" : "Saldo positivo",
    },
    {
      lbl: "Receita",
      val: fmtBRL(receita),
      sub: "leite + café",
      tone: "",
      int: "Entrada do ciclo de caixa",
    },
    {
      lbl: "Custeio",
      val: fmtBRL(custeio),
      sub: "operacional puro",
      tone: "",
      int: "Saída sem investimento",
    },
    {
      lbl: "Investimento",
      val: fmtBRL(invest),
      sub: "gado, máquina, café",
      tone: "",
      int: "Não entra na conta operacional",
    },
    {
      lbl: "Fluxo líquido",
      val: fmtBRL(fluxo),
      sub: "receita − saídas",
      tone: fluxo < 0 ? "neg" : "",
      int: fluxo < 0 ? "No vermelho (puxado por investimento)" : "Positivo no período",
    },
    // Custo/litro escondido: depende de litros produzidos (dado de rebanho inexistente).
  ];

  return (
    <div className="border-b border-border pt-[26px]">
      <div className="mb-[22px]">
        <span className="eyebrow">Visão operacional</span>
        <h1 className="mt-1.5 mb-0 font-serif text-[42px] font-medium leading-none tracking-[-0.02em] text-foreground">
          Dashboard
        </h1>
      </div>
      <div className="grid grid-cols-6 border-t border-border">
        {kpis.map((k, i) => (
          <div
            className="flex flex-col gap-[5px] border-r border-[color:var(--rule-soft)] pt-[18px] pr-5 pb-5 last:border-r-0 last:pr-0"
            key={i}
          >
            <span className="text-[14px] font-semibold uppercase tracking-[0.10em] text-ink-3">{k.lbl}</span>
            <span
              className={cn(
                "mono-nums font-serif text-[36px] font-medium leading-none tracking-[-0.02em]",
                k.tone === "neg" ? "text-prejuizo" : "text-foreground",
              )}
            >
              {k.val}
            </span>
            <span className="text-[15px] font-medium text-ink-2">{k.sub}</span>
            {k.int ? (
              <span className="mt-1.5 font-serif text-[15px] font-medium italic leading-[1.35] text-ink-2">{k.int}</span>
            ) : null}
            {k.imp ? <span className={"kpi-cock-imp mono-nums" + (k.tone === "neg" ? " is-neg" : "")}>{k.imp}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========== DRE (kept, trimmed) ========== */

function DRERow({ label, val2025, val2026, indent = 0, bold = false, sep = false, italic = false }: {
  label: string;
  val2025: number | null;
  val2026: number | null;
  indent?: number;
  bold?: boolean;
  sep?: boolean;
  italic?: boolean;
}) {
  return (
    <tr className={"dre-row " + (bold ? "bold " : "") + (sep ? "sep " : "") + (italic ? "italic " : "")}>
      <td className="dre-label" style={{ paddingLeft: indent * 20 + 14 }}>{label}</td>
      <td className="dre-num mono-nums">{val2025 == null ? "" : fmtBRL(val2025)}</td>
      <td className="dre-num mono-nums">{val2026 == null ? "" : fmtBRL(val2026)}</td>
    </tr>
  );
}

function DRESection({ R }: { R: R }) {
  const k25 = R.k2025, k26 = R.k2026YTD;
  const sumAtRange = (a: number[], idx: number[]) => idx.reduce((s, i) => s + a[i], 0);
  const sede25 = sumAtRange(R.sedeOutros, R.idx2025);
  const sede26 = sumAtRange(R.sedeOutros, R.idx2026YTD);
  const op25 = k25.receitaLeite + k25.receitaCafe - k25.custeioLeitePuro - k25.custeioCafe - sede25;
  const op26 = k26.receitaLeite + k26.receitaCafe - k26.custeioLeitePuro - k26.custeioCafe - sede26;
  const inv25 = k25.investLeite + k25.investCafe + k25.animalAquisicao;
  const inv26 = k26.investLeite + k26.investCafe + k26.animalAquisicao;

  return (
    <section className="cockpit-section">
      <div className="dash-sec-head">
        <div className="dash-sec-titles">
          <span className="eyebrow">Comparativo anual</span>
          <h2 className="dash-sec-title">DRE simplificado</h2>
        </div>
        <span className="caption" style={{ fontStyle: "italic" }}>investimento isolado do custeio · reclassificado pela IA</span>
      </div>
      <table className="dre-table">
        <thead>
          <tr><th></th><th className="dre-num">2025</th><th className="dre-num">2026 YTD <span className="dre-caption">(Jan-Mai*)</span></th></tr>
        </thead>
        <tbody>
          <DRERow label="Receita bruta" bold val2025={k25.receitaLeite + k25.receitaCafe} val2026={k26.receitaLeite + k26.receitaCafe} />
          <DRERow label="Leite (Embaré)" indent={1} val2025={k25.receitaLeite} val2026={k26.receitaLeite} />
          <DRERow label="Café (safra 03/26)" indent={1} val2025={0} val2026={k26.receitaCafe} />
          <DRERow label="(−) Custeio operacional" bold sep val2025={-(k25.custeioLeitePuro + k25.custeioCafe + sede25)} val2026={-(k26.custeioLeitePuro + k26.custeioCafe + sede26)} />
          <DRERow label="Custeio leite (puro)" indent={1} val2025={-k25.custeioLeitePuro} val2026={-k26.custeioLeitePuro} />
          <DRERow label="Custeio café" indent={1} val2025={-k25.custeioCafe} val2026={-k26.custeioCafe} />
          <DRERow label="Sede / não-alocado" indent={1} val2025={-sede25} val2026={-sede26} />
          <DRERow label="= Resultado operacional" bold sep val2025={op25} val2026={op26} />
          <DRERow label="(−) Investimento" bold sep val2025={-inv25} val2026={-inv26} />
          <DRERow label="Compra de matrizes" indent={1} val2025={-k25.investLeite} val2026={-k26.investLeite} />
          <DRERow label="Animal Aquisição (reclass. IA)" indent={1} italic val2025={-k25.animalAquisicao} val2026={-k26.animalAquisicao} />
          <DRERow label="Plantio café" indent={1} val2025={-k25.investCafe} val2026={-k26.investCafe} />
          <DRERow label="= Fluxo líquido" bold sep val2025={k25.totalGeral} val2026={k26.totalGeral} />
        </tbody>
      </table>
    </section>
  );
}

/* ========== INCONSISTÊNCIAS (kept, compact strip) ========== */

function InconsistenciasSection({ R, onReclassificar }: { R: R; onReclassificar: () => void }) {
  if (!R.inconsistencias?.length) return null; // sem inconsistência no período → some
  const sevBorderL: Record<string, string> = {
    alta: "border-l-prejuizo",
    media: "border-l-atencao",
    baixa: "border-l-ink-3",
  };
  const sevText: Record<string, string> = {
    alta: "text-prejuizo",
    media: "text-atencao",
    baixa: "text-ink-3",
  };
  return (
    <section className="pt-[34px] pb-[30px]">
      <DashSectionHeader eyebrow="Qualidade dos dados" title="Inconsistências detectadas pela IA" />
      <div className="grid grid-cols-4 gap-[18px]">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {R.inconsistencias.map((it: any) => (
          <div key={it.id} className={cn("flex flex-col gap-3 border border-l-4 border-solid border-border bg-card px-5 py-[18px]", sevBorderL[it.severidade])}>
            <div className="flex items-baseline justify-between gap-3">
              <span className={cn("border border-solid border-current px-2 py-[3px] text-[14px] uppercase tracking-[0.16em]", sevText[it.severidade])}>{it.severidade === "alta" ? "Crítica" : it.severidade === "media" ? "Média" : "Baixa"}</span>
              <span className="mono-nums flex-shrink-0 whitespace-nowrap font-serif text-[24px] font-medium tracking-[-0.01em]">{fmtBRL(it.valor)}</span>
            </div>
            <div className="font-serif text-[19px] font-medium leading-[1.3] tracking-[-0.005em]">{it.titulo}</div>
            <div className="mt-auto flex flex-col gap-0.5 border-l-2 border-solid border-lucro bg-[var(--bg-card-2)] px-3 py-2.5">
              <span className="text-[14px] font-semibold uppercase tracking-[0.10em] text-ink-3">Impacto:</span>
              <span className="font-serif text-[15px] italic leading-[1.4] text-foreground">{it.impacto}</span>
            </div>
            <div className="flex gap-2">
              {it.categoriaId ? (
                <>
                  <button className="btn-primary" style={{ padding: "7px 13px", fontSize: 12 }}
                    onClick={() => reclassificarCategoria(it.categoriaId, "INVESTIMENTO").then(onReclassificar)}>{it.acao}</button>
                  <button className="btn-ghost" style={{ padding: "7px 11px", fontSize: 12 }}
                    onClick={() => reclassificarCategoria(it.categoriaId, "CUSTEIO").then(onReclassificar)}>Reverter para custeio</button>
                </>
              ) : (
                <>
                  <button className="btn-primary" style={{ padding: "7px 13px", fontSize: 12 }}>{it.acao}</button>
                  <button className="btn-ghost" style={{ padding: "7px 11px", fontSize: 12 }}>Ignorar</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ========== TIMELINE (compact) ========== */

function TimelineSection({ R, onMonthClick }: { R: R; onMonthClick?: (idx: number) => void }) {
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(22);
  const slices = [
    { label: "23m", from: 0, to: 22 },
    { label: "2024 H2", from: 0, to: 5 },
    { label: "2025", from: 6, to: 17 },
    { label: "2026", from: 18, to: 22 },
  ];
  return (
    <section className="cockpit-section">
      <div className="dash-sec-head">
        <div className="dash-sec-titles">
          <span className="eyebrow">Linha do tempo · clique num mês para abrir</span>
          <h2 className="dash-sec-title">Fluxo mês a mês</h2>
        </div>
        <div className="timeline-slices">
          {slices.map((s) => (
            <button key={s.label} className="t-slice" aria-pressed={from === s.from && to === s.to} onClick={() => { setFrom(s.from); setTo(s.to); }}>{s.label}</button>
          ))}
        </div>
      </div>
      <TimelineChart R={R} startIdx={from} endIdx={to} height={320} onMonthClick={onMonthClick} />
      <div className="legend timeline-legend" style={{ paddingLeft: 64, marginTop: 6 }}>
        <span><span className="legend-dot" style={{ background: "var(--leite)" }}></span>Receita Leite</span>
        <span><span className="legend-dot" style={{ background: "var(--cafe)" }}></span>Receita Café</span>
        <span><span className="legend-dot" style={{ background: "var(--cafe)", opacity: 0.85 }}></span>Custeio</span>
        <span><span className="legend-dot stripes-neg-dot"></span>Animal Aquisição</span>
        <span><span className="legend-dot" style={{ background: "var(--outros)", opacity: 0.4, border: "1px dashed var(--outros)" }}></span>Investimento</span>
        <span><span className="legend-line" style={{ background: "var(--ink)" }}></span>Fluxo líquido</span>
      </div>
    </section>
  );
}

/* ========== CATEGORY DRILL (com subcategorias + pizza + lançamentos) ========== */


// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Data "YYYY-MM-DD" → "DD/MM/AA"
function fmtData(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NotaDrawer({ cat, row, onClose }: { cat: any; row: LancamentoDrill; onClose: () => void }) {
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <div className="eyebrow">{row.doc || "Lançamento"}</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 22, marginTop: 4 }}>{row.fornecedor}</div>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className="drawer-body">
          <div>
            <div className="eyebrow">Valor</div>
            <div className="drawer-amount mono-nums">{fmtBRL(row.valor)}</div>
          </div>

          <div className="drawer-meta-grid">
            <div className="mcell"><span className="ml">Data de liquidação</span><span className="mv">{fmtData(row.data)}</span></div>
            <div className="mcell"><span className="ml">Documento</span><span className="mv">{row.doc || "—"}</span></div>
            <div className="mcell"><span className="ml">Fornecedor</span><span className="mv">{row.fornecedor}</span></div>
            <div className="mcell"><span className="ml">Categoria</span><span className="mv">{cat.grupo} → {cat.nome}</span></div>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Classificação</div>
            <div className="split-stack">
              <div className="split-row">
                <span className={"act-pill " + (cat.atividade === "leite" ? "leite" : cat.atividade === "cafe" ? "cafe" : "outros")}>
                  <span className="dot"></span>{cat.atividade === "leite" ? "Leite" : cat.atividade === "cafe" ? "Café" : "Outros"}
                </span>
                <span style={{ fontSize: 14 }}>{cat.grupo} → {cat.nome}</span>
              </div>
            </div>
            {cat.flag && (
              <div className="footnote" style={{ marginTop: 12 }}>
                <span className="dagger">†</span>
                <span>Categoria marcada pela IA como possível investimento (hoje em custeio).</span>
              </div>
            )}
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Descrição</div>
            <div style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.55 }}>
              {row.descricao || "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LancamentosPanel({ cat, sub, from, to, onClose }: { cat: any; sub: any; from?: string; to?: string; onClose: () => void }) {
  const [rows, setRows] = useState<LancamentoDrill[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<number | null>(null);

  useEffect(() => {
    setRows(null);
    setErro(null);
    // "Outros fornecedores" é balde agregado → sem fornecedor específico (lista toda a categoria).
    const forn = sub.nome && sub.nome !== "Outros fornecedores" ? sub.nome : undefined;
    fetchLancamentos(cat.id, forn, from, to)
      .then(setRows)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch((e: any) => setErro(e?.message || "erro ao carregar"));
  }, [cat.id, sub.nome, from, to]);

  const total = (rows ?? []).reduce((s, r) => s + r.valor, 0);

  return (
    <div className="lanc-panel">
      <div className="lanc-panel-head">
        <div>
          <span className="eyebrow">Lançamentos individuais</span>
          <div className="lanc-panel-title">{sub.nome}</div>
          <span className="caption">
            {rows == null
              ? "carregando…"
              : `${rows.length} lançamento${rows.length === 1 ? "" : "s"} · total ${fmtBRL(total)}`}
          </span>
        </div>
        <button className="drawer-close" onClick={onClose} aria-label="Fechar">×</button>
      </div>
      {erro ? (
        <div className="caption" style={{ padding: 14, color: "var(--prejuizo)" }}>Erro ao carregar: {erro}</div>
      ) : (
      <table className="lanc-table">
        <thead>
          <tr>
            <th style={{ width: 90 }}>Data</th>
            <th>Descrição</th>
            <th>Fornecedor</th>
            <th style={{ width: 130 }}>Documento</th>
            <th className="r" style={{ width: 130 }}>Valor</th>
          </tr>
        </thead>
        <tbody>
          {(rows ?? []).map((row, i) => (
            <tr key={i} onClick={() => setOpenRow(i)} className="lanc-row-click">
              <td className="ld-date mono-nums">{fmtData(row.data)}</td>
              <td className="ld-marca">{row.descricao || "—"}</td>
              <td className="ld-forn">{row.fornecedor}</td>
              <td className="mono-nums">{row.doc || "—"}</td>
              <td className="r ld-val mono-nums">{fmtBRL(row.valor)}</td>
            </tr>
          ))}
          {rows != null && rows.length === 0 && (
            <tr><td colSpan={5} className="caption" style={{ padding: 12 }}>Nenhum lançamento no período.</td></tr>
          )}
        </tbody>
      </table>
      )}
      {openRow != null && rows && rows[openRow] && (
        <NotaDrawer cat={cat} row={rows[openRow]} onClose={() => setOpenRow(null)} />
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SubcatBreakdown({ R, cat, period }: { R: R; cat: any; period: "23m" | "ytd" }) {
  const subsRaw = R.subcategorias[cat.id];
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  if (!subsRaw) return null;

  const parentVal = period === "23m" ? cat.total23m : cat.ytd2026;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subs = subsRaw.map((s: any, i: number) => ({
    id: cat.id + "-" + i,
    idx: i,
    nome: s.nome,
    lanc: s.lanc,
    fornecedor: s.fornecedor,
    value: Math.round(parentVal * s.share),
    color: CAT_PALETTE[i % CAT_PALETTE.length],
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const active = subs.filter((s: any) => !off[s.id]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const total = active.reduce((sum: number, s: any) => sum + s.value, 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const segments: Segment[] = active.map((s: any) => ({ id: s.id, value: s.value, color: s.color }));
  const toggle = (id: string) => setOff((o) => ({ ...o, [id]: !o[id] }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedSub = selected != null ? subs.find((s: any) => s.idx === selected) : null;

  return (
    <div>
      <div className="subcat-block">
        <div className="subcat-donut">
          <Donut segments={segments} total={total} onSliceClick={toggle} hovered={hovered} setHovered={setHovered} />
          <span className="caption" style={{ textAlign: "center" }}>{active.length} de {subs.length} tipos · clique na fatia pra filtrar</span>
        </div>

        <div className="subcat-table">
          <div className="subcat-th">
            <span>Tipo de {cat.nome.toLowerCase()}</span>
            <span style={{ textAlign: "right" }}>Lançam.</span>
            <span style={{ textAlign: "right" }}>Valor</span>
            <span style={{ textAlign: "right" }}>%</span>
            <span></span>
          </div>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {subs.map((s: any) => {
            const isOff = !!off[s.id];
            const isSel = selected === s.idx;
            const pct = total > 0 && !isOff ? Math.round((s.value / total) * 100) : 0;
            return (
              <div
                key={s.id}
                className={"subcat-tr " + (isOff ? "is-off " : "") + (hovered === s.id ? "is-hover " : "") + (isSel ? "is-sel" : "")}
                onMouseEnter={() => setHovered(s.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setSelected(isSel ? null : s.idx)}
              >
                <span className="sc-name">
                  <button
                    className="sc-check-btn"
                    onClick={(e) => { e.stopPropagation(); toggle(s.id); }}
                    title={isOff ? "Ativar na pizza" : "Desativar na pizza"}
                  >
                    <span className="sc-check" style={{ background: isOff ? "transparent" : s.color, borderColor: s.color }}>
                      {!isOff && <span className="tick">✓</span>}
                    </span>
                  </button>
                  <span className="sc-nm-txt">
                    {s.nome}
                    <small>{s.fornecedor}</small>
                  </span>
                </span>
                <span className="sc-lanc mono-nums">{s.lanc || "—"}</span>
                <span className="sc-val mono-nums">{fmtBRL(s.value)}</span>
                <span className="sc-pct mono-nums">{isOff ? "—" : `${pct}%`}</span>
                <span className="sc-open">{isSel ? "▾" : "›"}</span>
              </div>
            );
          })}
        </div>
      </div>

      {selectedSub && (
        <LancamentosPanel cat={cat} sub={selectedSub} from={R.periodo?.from} to={R.periodo?.to} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function CategoryDrill({ R, catId, onBack, onNav }: { R: R; catId: CatId; onBack: () => void; onNav: (t: Tab) => void }) {
  // resolve por id do payload; se vier um slug de design (orçado/anomalia), casa por nome
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cat =
    R.categoriasReais.find((c: any) => c.id === catId) ||
    (typeof catId === "string" && SLUG_TO_NOME[catId]
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        R.categoriasReais.find((c: any) => c.nome === SLUG_TO_NOME[catId])
      : undefined);
  const [period, setPeriod] = useState<"23m" | "ytd">("23m");
  if (!cat) {
    return (
      <div className="shell-wide">
        <div className="breadcrumb">
          <button className="crumb-btn" onClick={onBack}>Dashboard</button>
          <span className="sep">›</span>
          <span className="now">Categoria</span>
        </div>
        <LoadingShell>
          Categoria sem detalhe disponível neste período.
          <div style={{ marginTop: 14 }}>
            <button className="crumb-btn" onClick={onBack}>← voltar ao Dashboard</button>
          </div>
        </LoadingShell>
      </div>
    );
  }
  const drillKey = cat.id;
  const monthly = categoryMonthly(cat);
  const media = Math.round(cat.total23m / 23);
  const maxIdx = monthly.indexOf(Math.max(...monthly));
  const corAtv = cat.atividade === "leite" ? "var(--leite)" : cat.atividade === "cafe" ? "var(--cafe)" : "var(--outros)";
  const hasSubs = !!R.subcategorias[drillKey];
  const nSubs = hasSubs ? R.subcategorias[drillKey].length : 0;

  return (
    <div className="shell-wide">
      <div className="breadcrumb">
        <button className="crumb-btn" onClick={onBack}>Dashboard</button>
        <span className="sep">›</span>
        <button className="crumb-btn" onClick={onBack}>Gasto por categoria</button>
        <span className="sep">›</span>
        <span className="now">{cat.nome}</span>
      </div>

      <div className="drill-head">
        <div className="title-block">
          <span className="eyebrow">Categoria · {cat.grupo} → {cat.subgrupo}</span>
          <div className="cat-name">{cat.nome}{cat.flag && <span className="flag-warn-big">⚠</span>}</div>
        </div>
        <div></div>
        <div className="total-block">
          <span className="eyebrow">Total 23 meses</span>
          <span className="v mono-nums">{fmtBRL(cat.total23m)}</span>
          <span className="dlt" style={{ color: cat.delta > 0 ? "var(--prejuizo)" : "var(--lucro)" }}>{cat.delta > 0 ? "▲ +" : "▼ "}{Math.abs(cat.delta)}% vs 2025</span>
        </div>
      </div>

      <div className="drill-stats">
        <div className="cell"><span className="l">2026 YTD</span><span className="v mono-nums">{fmtBRL(cat.ytd2026)}</span></div>
        <div className="cell"><span className="l">Média mensal</span><span className="v mono-nums">{fmtBRL(media)}</span></div>
        <div className="cell"><span className="l">Mês de pico</span><span className="v mono-nums">{R.MESES_23M[maxIdx].replace("*", "")}</span></div>
        <div className="cell"><span className="l">Tipos distintos</span><span className="v mono-nums">{nSubs || "—"}</span></div>
      </div>

      {hasSubs && (
        <section className="cockpit-section" style={{ borderBottom: "1px solid var(--rule)", paddingTop: 30 }}>
          <div className="dash-sec-head">
            <div className="dash-sec-titles">
              <span className="eyebrow">Composição detalhada</span>
              <h2 className="dash-sec-title">Tipos de {cat.nome.toLowerCase()}</h2>
            </div>
            <div className="period-switch">
              <button aria-current={period === "23m"} onClick={() => setPeriod("23m")}>23 meses</button>
              <button aria-current={period === "ytd"} onClick={() => setPeriod("ytd")}>2026 YTD</button>
            </div>
          </div>
          <p className="drill-subhint">
            Tudo isso costuma entrar como uma linha só: <strong>"{cat.nome}"</strong>. Aqui está aberto no que realmente foi comprado.
          </p>
          <SubcatBreakdown R={R} cat={cat} period={period} />
        </section>
      )}

      <div style={{ padding: "30px 0", borderBottom: "1px solid var(--rule)" }}>
        <div className="panel-title" style={{ marginBottom: 12 }}>
          <h3>{cat.nome} — total mês a mês (jul/24 → mai/26)</h3>
        </div>
        <BarSeries data={monthly} labels={R.MESES_23M} color={corAtv} height={240} />
      </div>

      <div style={{ padding: "30px 0 60px", display: "flex", justifyContent: "space-between" }}>
        <button className="crumb-btn" onClick={onBack}>← voltar ao Dashboard</button>
        <button className="crumb-btn" onClick={() => onNav("ia")}>perguntar à IA sobre {cat.nome.toLowerCase()} →</button>
      </div>
    </div>
  );
}

/* ========== ROOT ========== */

/* ========== RESUMO EXECUTIVO DA IA ========== */

function ResumoExecutivo({ R, onNav }: { R: R; onNav: (t: Tab) => void }) {
  const [open, setOpen] = useState(true);

  const itens: { tipo: string; label: string; icon: string; texto: JSX.Element; cta: { label: string; act: (() => void) | null } }[] = [
    {
      tipo: "mudou",
      label: "O que mudou",
      icon: "→",
      texto: (
        <>
          Entrou o relatório de <strong>04/mai</strong>. O <strong>Curral</strong> disparou — R$ XXX no ano,{" "}
          <strong className="rx-neg">+XXX</strong> sobre 2025, puxado por Energisa, Siloking e madeira (parece reforma). Café fechou a
          safra única em <strong>R$ XXX</strong>.
        </>
      ),
      cta: { label: "ver Curral", act: () => onNav("gastos") },
    },
    {
      tipo: "preocupa",
      label: "O que preocupa",
      icon: "!",
      texto: (
        <>
          Caixa operacional de <strong>{fmtBRL(R.caixaHoje.total, { compact: false })}</strong> cobre só ~<strong>XXX dias</strong> da
          queima de ~<strong className="rx-neg">XXX</strong>/mês — o negócio roda por{" "}
          <strong>aporte do proprietário</strong>. O leite ainda não se paga: déficit operacional de{" "}
          <strong className="rx-neg">R$ XXX</strong> em 2025.
        </>
      ),
      cta: { label: "ver caixa & aporte", act: null },
    },
    {
      tipo: "decidir",
      label: "O que decidir",
      icon: "?",
      texto: (
        <>
          R$ <strong>XXX</strong> de "Animal Aquisição" seguem em custeio — <strong>reclassificar como investimento</strong> limpa a
          leitura. E vale decidir o ritmo de compra de gado: pausar corta o aporte mensal quase pela metade, de{" "}
          <strong className="rx-neg">~R$ XXX</strong> para <strong className="rx-pos">~R$ XXX</strong>/mês.
        </>
      ),
      cta: { label: "simular cenários", act: () => onNav("ia") },
    },
  ];

  return (
    <section className={"resumo-exec " + (open ? "" : "collapsed")}>
      <div className="rx-head">
        <div className="rx-head-l">
          <span className="rx-badge">
            <span className="dot"></span>IA · Resumo executivo
          </span>
          <span className="rx-sub">Resumo gerado automaticamente</span>
        </div>
        <button className="rx-toggle" onClick={() => setOpen((o) => !o)}>
          {open ? "ocultar" : "mostrar"}
        </button>
      </div>

      {open && (
        <>
          <div className="rx-lede">
            Marco, leitura de 30 segundos: <strong>a fazenda não está quebrando — está financiando crescimento</strong>, mas o caixa
            pede atenção e o leite ainda consome mais do que entrega.
          </div>
          <div className="rx-grid">
            {itens.map((it, i) => (
              <div key={i} className={"rx-card rx-" + it.tipo}>
                <div className="rx-card-head">
                  <span className="rx-icon">{it.icon}</span>
                  <span className="rx-label">{it.label}</span>
                </div>
                <div className="rx-text">{it.texto}</div>
                {it.cta && it.cta.act && (
                  <button className="rx-cta" onClick={it.cta.act}>
                    {it.cta.label} →
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* ========== FÔLEGO DE CAIXA (aporte do proprietário) ========== */

function FolegoCaixa({ R }: { R: R }) {
  const f = R.folego;
  const pf = R.projecaoFluxo;

  const burnTotal = Math.abs(f.queimaMensal);
  const burnOp = Math.abs(f.queimaCusteioMensal);
  const pctOp = (burnOp / burnTotal) * 100;
  const pctInv = 100 - pctOp;

  const fluxo = pf.fluxoProj as { mes: string; caixaFim: number }[];
  const W = 360, H = 96, padL = 6, padR = 6, padT = 10, padB = 18;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const caixas = [f.caixa, ...fluxo.map((x) => x.caixaFim)];
  const maxC = Math.max(...caixas, 0);
  const minC = Math.min(...caixas, 0);
  const range = maxC - minC || 1;
  const yC = (v: number) => padT + innerH - ((v - minC) / range) * innerH;
  const xC = (i: number) => padL + (i / (caixas.length - 1)) * innerW;
  const linePts = caixas.map((v, i) => `${xC(i)},${yC(v)}`).join(" ");
  const burnInv = burnTotal - burnOp;
  const dias = f.folegoDias ?? Math.round((f.caixa / (burnTotal || 1)) * 30);
  const capitalConsumido = burnTotal * (fluxo.length || 6);
  const caixaFimPeriodo = fluxo.length ? fluxo[fluxo.length - 1].caixaFim : f.caixa;
  const baseMeses = f.baseMeses ?? 6;

  return (
    <section className="border-b border-border pt-[34px] pb-[30px]">
      <DashSectionHeader
        eyebrow="Saúde financeira"
        title="Caixa & aporte do proprietário"
        right={<span className="border border-solid border-current px-3 py-[5px] text-[14px] uppercase tracking-[0.10em] text-atencao">Sustentado por aporte</span>}
      />

      <div className="grid grid-cols-[1.15fr_1fr_1.2fr] gap-px border border-border bg-border max-[1100px]:grid-cols-1">
        <div className="flex flex-col gap-2.5 bg-card px-6 py-[22px] shadow-[inset_4px_0_0_var(--atencao)]">
          <span className="text-[14px] uppercase tracking-[0.14em] text-ink-3">Aporte mensal para manter o ritmo atual</span>
          <div className="mono-nums font-serif text-[56px] leading-none tracking-[-0.025em] text-prejuizo">
            {fmtBRL(burnTotal)}
            <span className="text-[22px] tracking-normal text-ink-3"> /mês</span>
          </div>
          <div className="text-[14px] leading-[1.5] text-ink-2 [&_strong]:text-foreground">
            O caixa de <strong className="mono-nums">{fmtBRL(f.caixa)}</strong> cobre só{" "}
            <strong>~{dias} dias</strong> da queima. O negócio roda por <strong>aporte do proprietário</strong>, não por
            geração própria.
          </div>
          <div className="mt-1.5">
            <div className="flex" style={{ height: 12, border: "1px solid var(--rule)" }}>
              <div className="h-full" style={{ width: `${pctOp}%`, background: "var(--cafe)" }} title="Operacional"></div>
              <div className="h-full" style={{ width: `${pctInv}%`, background: "var(--outros)" }} title="Investimento"></div>
            </div>
            <div className="mt-2 flex gap-4 text-[14px] text-ink-3">
              <span>
                <span className="legend-dot" style={{ background: "var(--cafe)" }}></span>Déficit operacional {fmtBRL(burnOp)}
              </span>
              <span>
                <span className="legend-dot" style={{ background: "var(--outros)" }}></span>Investimento {fmtBRL(burnInv)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 bg-card px-6 py-[22px]">
          <span className="text-[14px] uppercase tracking-[0.14em] text-ink-3">Se pausar o investimento em rebanho</span>
          <div className="mono-nums font-serif text-[44px] leading-none tracking-[-0.02em] text-lucro">
            {fmtBRL(burnOp)}
            <span className="text-[18px] tracking-normal text-ink-3"> /mês</span>
          </div>
          <div className="text-[14px] leading-[1.5] text-ink-2 [&_strong]:text-foreground">
            O aporte cai <strong className="mono-nums">~{fmtBRL(burnInv)}</strong> — de {fmtBRL(burnTotal)} para {fmtBRL(burnOp)}/mês.
            Mas o <strong>déficit operacional não some</strong>: o leite ainda consome mais do que entrega. Pausar investir ajuda, não
            resolve sozinho.
          </div>
          <div className="mt-auto">
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[78px_1fr_auto] items-center gap-2.5">
                <span className="text-[14px] tracking-[0.04em] text-ink-3">Hoje</span>
                <div className="h-2.5 bg-[var(--rule-soft)]">
                  <div className="h-full" style={{ width: "100%", background: "var(--prejuizo)" }}></div>
                </div>
                <span className="mono-nums font-serif text-[14px]">{fmtBRL(burnTotal)}</span>
              </div>
              <div className="grid grid-cols-[78px_1fr_auto] items-center gap-2.5">
                <span className="text-[14px] tracking-[0.04em] text-ink-3">Sem invest.</span>
                <div className="h-2.5 bg-[var(--rule-soft)]">
                  <div className="h-full" style={{ width: `${pctOp}%`, background: "var(--cafe)" }}></div>
                </div>
                <span className="mono-nums font-serif text-[14px]">{fmtBRL(burnOp)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 bg-card px-6 py-[22px]">
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] uppercase tracking-[0.14em] text-ink-3">Capital consumido · {fluxo.length} meses</span>
            <span className="text-[14px] tracking-[0.04em] text-prejuizo">~{fmtBRL(capitalConsumido)} de aporte</span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
            <line x1={padL} x2={W - padR} y1={yC(0)} y2={yC(0)} stroke="var(--prejuizo)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={W - padR} y={yC(0) - 3} textAnchor="end" style={{ fontSize: 9, fill: "var(--prejuizo)", fontFamily: "var(--sans)" }}>
              R$ 0
            </text>
            <polyline points={linePts} fill="none" stroke="var(--ink)" strokeWidth="1.6" />
            {caixas.map((v, i) => (
              <circle key={i} cx={xC(i)} cy={yC(v)} r="2.5" fill={v < 0 ? "var(--prejuizo)" : "var(--bg)"} stroke={v < 0 ? "var(--prejuizo)" : "var(--ink)"} strokeWidth="1.2" />
            ))}
            {["hoje", ...fluxo.map((x) => x.mes.replace(/\/\d{2}/, ""))].map(
              (m, i) =>
                (i % 2 === 0 || i === caixas.length - 1) && (
                  <text key={i} x={xC(i)} y={H - 4} textAnchor="middle" style={{ fontSize: 9, fill: "var(--ink-3)", fontFamily: "var(--sans)" }}>
                    {m}
                  </text>
                ),
            )}
          </svg>
          <div className="mt-auto text-[14px] leading-[1.5] text-ink-3 [&_strong]:text-foreground">
            Sem aporte, o caixa fecha o período em <strong className="mono-nums">{fmtBRL(caixaFimPeriodo)}</strong> — ou
            seja, é o capital que o proprietário precisa injetar conforme o investimento desacelera.
          </div>
        </div>
      </div>

      <div className="footnote" style={{ marginTop: 16 }}>
        <span className="dagger">†</span>
        <span>
          Queima média dos últimos {baseMeses} meses: {fmtBRL(burnTotal)}/mês, sendo {fmtBRL(burnOp)} déficit operacional e{" "}
          {fmtBRL(burnInv)} investimento. Para o caixa parar de cair sem aporte, seria preciso zerar o déficit do leite <em>e</em> a
          compra de gado — ou injetar ~{fmtBRL(burnTotal)}/mês.
        </span>
      </div>
    </section>
  );
}

/* ========== PROJEÇÃO / BREAK-EVEN DO LEITE ========== */

function BreakEvenLeite({ R, onNav }: { R: R; onNav: (t: Tab) => void }) {
  const pl = R.projecaoLeite;
  const proj = pl.proj as { mes: string; custoLitro: number; preco: number }[];
  const beIdx = pl.breakEvenIdx;

  const W = 1180, H = 320;
  const padL = 56, padR = 130, padT = 24, padB = 46;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const allY = [...proj.map((p) => p.custoLitro), ...proj.map((p) => p.preco), pl.custoLitroHoje];
  const yMax = Math.ceil(Math.max(...allY) * 1.1);
  const yMin = 0;
  const yS = (v: number) => padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const n = proj.length;
  const xS = (i: number) => padL + (i / (n - 1)) * innerW;

  const custoPts = proj.map((p, i) => `${xS(i)},${yS(p.custoLitro)}`).join(" ");
  const precoPts = proj.map((p, i) => `${xS(i)},${yS(p.preco)}`).join(" ");

  const ticks: number[] = [];
  for (let v = 0; v <= yMax; v += yMax > 10 ? 4 : 2) ticks.push(v);

  const beX = beIdx >= 0 ? xS(beIdx) : null;

  return (
    <section className="be-section">
      <div className="dash-sec-head">
        <div className="dash-sec-titles">
          <span className="eyebrow">Projeção · próximos 12 meses</span>
          <h2 className="dash-sec-title">Quando o leite passa a pagar o leite?</h2>
        </div>
        <span className="caption" style={{ fontStyle: "italic" }}>
          premissas: matrizes entram em produção, custeio +1,5%/mês
        </span>
      </div>

      <div className="be-kpis">
        <div className="be-kpi">
          <span className="l">Custo / litro hoje</span>
          <span className="v mono-nums neg">R$ XXX</span>
          <span className="s">contra R$ XXX de venda</span>
        </div>
        <div className="be-kpi">
          <span className="l">Volume hoje</span>
          <span className="v mono-nums">
            XXX mil L<span style={{ fontSize: 14 }}>/mês</span>
          </span>
          <span className="s">~XXX L/dia</span>
        </div>
        <div className="be-kpi hl">
          <span className="l">Break-even projetado</span>
          <span className="v mono-nums">XXX</span>
          <span className="s">{beIdx >= 0 ? "em XXX meses" : "fora do horizonte de 12m"}</span>
        </div>
        <div className="be-kpi">
          <span className="l">Custo / litro no break-even</span>
          <span className="v mono-nums pos">{beIdx >= 0 ? "R$ XXX" : "—"}</span>
          <span className="s">cai com diluição do volume</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", marginTop: 8 }}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={yS(v)} y2={yS(v)} className={v === 0 ? "chart-axis" : "grid-line"} />
            <text x={padL - 8} y={yS(v) + 4} textAnchor="end" className="chart-tick-text">
              R$ {v}
            </text>
          </g>
        ))}

        {beIdx >= 0 && beX !== null && <rect x={padL} y={padT} width={beX - padL} height={innerH} fill="var(--prejuizo)" opacity="0.05" />}
        {beIdx >= 0 && beX !== null && <line x1={beX} x2={beX} y1={padT} y2={padT + innerH} stroke="var(--lucro)" strokeWidth="1.2" strokeDasharray="4 3" />}

        <polyline points={precoPts} fill="none" stroke="var(--leite)" strokeWidth="2" />
        <polyline points={custoPts} fill="none" stroke="var(--prejuizo)" strokeWidth="2" />

        {proj.map((p, i) => (
          <g key={i}>
            <circle cx={xS(i)} cy={yS(p.custoLitro)} r="2.5" fill="var(--bg)" stroke="var(--prejuizo)" strokeWidth="1.2" />
            <circle cx={xS(i)} cy={yS(p.preco)} r="2.5" fill="var(--bg)" stroke="var(--leite)" strokeWidth="1.2" />
            {(i % 2 === 0 || i === n - 1) && (
              <text x={xS(i)} y={H - padB + 18} textAnchor="middle" className="chart-tick-text">
                {p.mes.replace(/\/\d{2}/, "")}
              </text>
            )}
          </g>
        ))}

        <text x={xS(n - 1) + 8} y={yS(proj[n - 1].preco) + 4} className="be-line-label" style={{ fill: "var(--leite)" }}>
          preço/L
        </text>
        <text x={xS(n - 1) + 8} y={yS(proj[n - 1].custoLitro) + 4} className="be-line-label" style={{ fill: "var(--prejuizo)" }}>
          custo/L
        </text>
        {beIdx >= 0 && beX !== null && (
          <text x={beX} y={padT - 6} textAnchor="middle" style={{ fontFamily: "var(--serif)", fontSize: 13, fill: "var(--lucro)" }}>
            break-even
          </text>
        )}
      </svg>

      <div className="be-foot">
        <div className="be-foot-txt">
          <strong>Leitura:</strong> o custo por litro hoje está em <span className="neg-txt">R$ XXX</span>{" "}
          porque o volume caiu enquanto o rebanho passa por reposição. Conforme as matrizes compradas (R$ XXX) entram em produção, o
          volume diluí o custo fixo e a curva cruza o preço de venda
          {beIdx >= 0 ? (
            <>
              {" "}
              por volta de <strong>XXX</strong>.
            </>
          ) : (
            <> — mas ainda não dentro de 12 meses no cenário base.</>
          )}
        </div>
        <button className="btn-secondary" onClick={() => onNav && onNav("ia")}>
          Simular cenários com a IA →
        </button>
      </div>
    </section>
  );
}

/* ========== ORÇADO × REALIZADO ========== */

function OrcadoRealizado({ R, onDrill }: { R: R; onDrill: (id: string) => void }) {
  const orc = R.orcamento;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itens = orc.itens.map((it: any) => ({ ...it, delta: it.realizado - it.orcado, pct: (it.realizado / it.orcado) * 100 }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalOrc = itens.reduce((s: number, i: any) => s + i.orcado, 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalReal = itens.reduce((s: number, i: any) => s + i.realizado, 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maxVal = Math.max(...itens.map((i: any) => Math.max(i.orcado, i.realizado)));
  return (
    <section className="cockpit-section">
      <div className="dash-sec-head">
        <div className="dash-sec-titles">
          <span className="eyebrow">Controle · {orc.periodo}</span>
          <h2 className="dash-sec-title">Orçado × Realizado</h2>
        </div>
        <span className={"orc-flag " + (totalReal > totalOrc ? "over" : "ok")}>
          {totalReal > totalOrc ? "XXX categorias acima do teto" : "dentro do orçamento"}
        </span>
      </div>
      <div className="orc-summary">
        <div className="orc-sum-cell">
          <span className="l">Orçado total</span>
          <span className="v mono-nums">XXX</span>
        </div>
        <div className="orc-sum-cell">
          <span className="l">Realizado</span>
          <span className="v mono-nums" style={{ color: totalReal > totalOrc ? "var(--prejuizo)" : "var(--lucro)" }}>
            XXX
          </span>
        </div>
        <div className="orc-sum-cell">
          <span className="l">Desvio</span>
          <span className="v mono-nums" style={{ color: totalReal > totalOrc ? "var(--prejuizo)" : "var(--lucro)" }}>
            {totalReal > totalOrc ? "▲ +" : "▼ "}
            XXX
          </span>
        </div>
      </div>
      <div className="orc-list">
        <div className="orc-head-row">
          <span>Categoria</span>
          <span className="orc-bars-head">Orçado vs realizado</span>
          <span style={{ textAlign: "right" }}>Realizado</span>
          <span style={{ textAlign: "right" }}>Desvio</span>
          <span style={{ textAlign: "right" }}>%</span>
        </div>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {itens.map((it: any) => {
          const over = it.realizado > it.orcado;
          const wOrc = (it.orcado / maxVal) * 100;
          const wReal = (it.realizado / maxVal) * 100;
          return (
            <button key={it.catId} className="orc-row" onClick={() => onDrill && onDrill(it.catId)}>
              <span className="orc-nome">{it.nome}</span>
              <span className="orc-bars">
                <span className="orc-bar-track">
                  <span className="orc-bar-orc" style={{ width: `${wOrc}%` }}></span>
                  <span className={"orc-bar-real " + (over ? "over" : "under")} style={{ width: `${wReal}%` }}></span>
                </span>
              </span>
              <span className="orc-real mono-nums">XXX</span>
              <span className={"orc-delta mono-nums " + (over ? "over" : "under")}>
                {over ? "+" : "−"}
                XXX
              </span>
              <span className={"orc-pct mono-nums " + (over ? "over" : "under")}>XXX</span>
            </button>
          );
        })}
      </div>
      <div className="orc-legend">
        <span>
          <span className="orc-swatch orc-line"></span>Teto orçado
        </span>
        <span>
          <span className="orc-swatch over"></span>Acima do teto
        </span>
        <span>
          <span className="orc-swatch under"></span>Dentro do teto
        </span>
        <span className="caption" style={{ marginLeft: "auto", fontStyle: "italic" }}>
          Curral é quem mais estoura — puxado pela reforma do galpão.
        </span>
      </div>
    </section>
  );
}

/* ========== PRODUTIVIDADE DO REBANHO ========== */

function ProdutividadeRebanho({ R }: { R: R }) {
  const p = R.produtividade;
  const atual = p.litrosVacaAtual;
  const meta = p.metaLitrosVaca;
  const pctMeta = (atual / meta) * 100;
  const W = 760, H = 220, padL = 44, padR = 70, padT = 18, padB = 34;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const vals = p.litrosVaca as number[];
  const yMax = Math.max(...vals, meta) * 1.1;
  const yMin = Math.min(...vals) * 0.85;
  const yS = (v: number) => padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const xS = (i: number) => padL + (i / (vals.length - 1)) * innerW;
  const linePts = vals.map((v, i) => `${xS(i)},${yS(v)}`).join(" ");
  const vacas = p.vacasLactacao[p.vacasLactacao.length - 1];
  return (
    <section className="cockpit-section">
      <div className="dash-sec-head">
        <div className="dash-sec-titles">
          <span className="eyebrow">Operação · a alavanca do break-even</span>
          <h2 className="dash-sec-title">Produtividade do rebanho</h2>
        </div>
        <span className="caption" style={{ fontStyle: "italic" }}>
          litros por vaca em lactação, por dia
        </span>
      </div>
      <div className="prod-grid">
        <div className="prod-kpis">
          <div className="prod-kpi big">
            <span className="l">Hoje</span>
            <span className="v mono-nums">
              XXX
              <small> L/vaca/dia</small>
            </span>
            <div className="prod-meta-bar">
              <div className="pmb-track">
                <div className="pmb-fill" style={{ width: `${Math.min(100, pctMeta)}%` }}></div>
              </div>
              <span className="pmb-cap">
                XXX da meta de XXX L
              </span>
            </div>
          </div>
          <div className="prod-kpi">
            <span className="l">Média 12m</span>
            <span className="v mono-nums">XXX L</span>
          </div>
          <div className="prod-kpi">
            <span className="l">Vacas em lactação</span>
            <span className="v mono-nums">
              XXX
              <small> de XXX</small>
            </span>
          </div>
          <div className="prod-rebanho">
            <span className="pr-head">Composição do rebanho</span>
            <div className="pr-bar">
              <div style={{ width: `${(vacas / p.totalRebanho) * 100}%`, background: "var(--leite)" }}></div>
              <div style={{ width: `${(p.vacasSecas / p.totalRebanho) * 100}%`, background: "var(--cafe-2)" }}></div>
              <div style={{ width: `${(p.novilhas / p.totalRebanho) * 100}%`, background: "var(--outros)" }}></div>
              <div style={{ width: `${(p.bezerros / p.totalRebanho) * 100}%`, background: "var(--outros-2)" }}></div>
            </div>
            <div className="pr-legend">
              <span>
                <span className="legend-dot" style={{ background: "var(--leite)" }}></span>Lactação XXX
              </span>
              <span>
                <span className="legend-dot" style={{ background: "var(--cafe-2)" }}></span>Secas XXX
              </span>
              <span>
                <span className="legend-dot" style={{ background: "var(--outros)" }}></span>Novilhas XXX
              </span>
              <span>
                <span className="legend-dot" style={{ background: "var(--outros-2)" }}></span>Bezerros XXX
              </span>
            </div>
          </div>
        </div>
        <div className="prod-chart-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
            {[yMin, (yMin + yMax) / 2, yMax].map((v, i) => (
              <g key={i}>
                <line x1={padL} x2={W - padR} y1={yS(v)} y2={yS(v)} className="grid-line" />
                <text x={padL - 8} y={yS(v) + 4} textAnchor="end" className="chart-tick-text">
                  {v.toFixed(0)}L
                </text>
              </g>
            ))}
            <line x1={padL} x2={W - padR} y1={yS(meta)} y2={yS(meta)} stroke="var(--lucro)" strokeWidth="1.2" strokeDasharray="4 3" />
            <text x={W - padR + 6} y={yS(meta) + 4} className="be-line-label" style={{ fill: "var(--lucro)" }}>
              meta XXX
            </text>
            <polyline points={linePts} fill="none" stroke="var(--leite)" strokeWidth="2" />
            {vals.map((v, i) => (
              <g key={i}>
                <circle cx={xS(i)} cy={yS(v)} r="2.5" fill="var(--bg-card)" stroke="var(--leite)" strokeWidth="1.2" />
                {(i % 2 === 0 || i === vals.length - 1) && (
                  <text x={xS(i)} y={H - padB + 18} textAnchor="middle" className="chart-tick-text">
                    {p.meses[i].replace(/\/\d{2}/, "")}
                  </text>
                )}
              </g>
            ))}
          </svg>
          <div className="prod-insight">
            <span className="pi-tag">Análise da IA</span>
            Cada vaca entrega <strong>XXX L/dia</strong> contra a meta de <strong>XXX L</strong>. Fechar esse gap de{" "}
            XXX L significaria <strong className="pos-txt"> +XXX L/dia</strong> — cerca
            de <strong className="pos-txt">XXX/mês</strong> a mais de receita, com o mesmo rebanho. É a alavanca
            que mais aproxima o break-even, antes de comprar mais matrizes.
          </div>
        </div>
      </div>
    </section>
  );
}

/* ========== DETALHE DO MÊS (timeline clicável) ========== */

function MonthPilhaBar({ label, value, total, color, dashed, flag }: { label: string; value: number; total: number; color: string; dashed?: boolean; flag?: boolean }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="pilha-row">
      <div className="pilha-top">
        <span className="pilha-nm">
          <span
            className="sw"
            style={{
              background: flag ? "transparent" : color,
              backgroundImage: flag ? "repeating-linear-gradient(45deg, var(--prejuizo) 0 2px, transparent 2px 4px)" : "none",
              border: flag ? "1px solid var(--prejuizo)" : dashed ? "1px dashed var(--outros)" : "none",
              opacity: dashed ? 0.6 : 1,
            }}
          ></span>
          {label}
        </span>
        <span className="pilha-vl mono-nums">{fmtBRL(value)}</span>
      </div>
      <div className="pilha-track">
        <div className="pilha-fill" style={{ width: `${pct}%`, background: color, opacity: dashed ? 0.4 : 1 }}></div>
      </div>
    </div>
  );
}

function MonthDetail({
  R,
  monthIdx,
  onBack,
  onNav,
  onDrill,
  onMonthChange,
}: {
  R: R;
  monthIdx: number;
  onBack: () => void;
  onNav: (t: Tab) => void;
  onDrill: (id: string) => void;
  onMonthChange: (idx: number) => void;
}) {
  const mes = R.MESES_23M[monthIdx];
  const parcial = mes.includes("*");
  const mesLabel = mes.replace("*", "");

  const recLeite = R.receitaLeite[monthIdx];
  const recCafe = R.receitaCafe[monthIdx];
  const receita = recLeite + recCafe;
  const custeio = R.custeioLeitePuro[monthIdx] + R.custeioCafe[monthIdx] + R.sedeOutros[monthIdx];
  const animAq = R.animalAquisicao[monthIdx];
  const invest = R.investLeite[monthIdx] + R.investCafe[monthIdx] + animAq;
  const fluxo = R.totalGeral[monthIdx];
  const opLeite = recLeite - R.custeioLeitePuro[monthIdx];

  const cats = R.categoriasReais
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((c: any) => ({ ...c, mesVal: (categoryMonthly(c)[monthIdx] || 0) }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((c: any) => c.mesVal > 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .sort((a: any, b: any) => b.mesVal - a.mesVal);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maxCat = Math.max(...cats.map((c: any) => c.mesVal), 1);

  const prevIdx = monthIdx > 0 ? monthIdx - 1 : null;
  const nextIdx = monthIdx < R.MESES_23M.length - 1 ? monthIdx + 1 : null;

  const KPIS = [
    { l: "Receita", v: receita, tone: "" },
    { l: "Custeio", v: -custeio, tone: "" },
    { l: "Investimento", v: -invest, tone: "" },
    { l: "Fluxo do mês", v: fluxo, tone: fluxo < 0 ? "neg" : "pos" },
  ];

  return (
    <div className="shell-wide">
      <div className="breadcrumb">
        <button className="crumb-btn" onClick={onBack}>
          Dashboard
        </button>
        <span className="sep">›</span>
        <button className="crumb-btn" onClick={onBack}>
          Fluxo mês a mês
        </button>
        <span className="sep">›</span>
        <span className="now">{mesLabel}</span>
      </div>

      <div className="drill-head">
        <div className="title-block">
          <span className="eyebrow">Fluxo completo do mês{parcial ? " · mês parcial" : ""}</span>
          <div className="cat-name">{mesLabel}</div>
        </div>
        <div className="month-nav">
          {prevIdx != null && (
            <button className="crumb-btn" onClick={() => onMonthChange(prevIdx)}>
              ‹ {R.MESES_23M[prevIdx].replace("*", "")}
            </button>
          )}
          {nextIdx != null && (
            <button className="crumb-btn" onClick={() => onMonthChange(nextIdx)}>
              {R.MESES_23M[nextIdx].replace("*", "")} ›
            </button>
          )}
        </div>
        <div className="total-block">
          <span className="eyebrow">Fluxo líquido</span>
          <span className="v mono-nums" style={{ color: fluxo < 0 ? "var(--prejuizo)" : "var(--lucro)" }}>
            {fmtBRL(fluxo)}
          </span>
        </div>
      </div>

      <div className="drill-stats">
        {KPIS.map((k, i) => (
          <div className="cell" key={i}>
            <span className="l">{k.l}</span>
            <span className="v mono-nums" style={{ color: k.tone === "neg" ? "var(--prejuizo)" : k.tone === "pos" ? "var(--lucro)" : "var(--ink)" }}>
              {fmtBRL(k.v)}
            </span>
          </div>
        ))}
      </div>

      <div className="month-grid">
        <div className="month-panel">
          <div className="panel-title">
            <h3>Receita do mês</h3>
          </div>
          <div className="month-rec">
            <div className="month-rec-row">
              <span className="sw" style={{ background: "var(--leite)" }}></span>
              <span className="nm">Leite (Embaré)</span>
              <span className="vl mono-nums">{fmtBRL(recLeite)}</span>
            </div>
            {recCafe > 0 && (
              <div className="month-rec-row">
                <span className="sw" style={{ background: "var(--cafe)" }}></span>
                <span className="nm">Café (safra)</span>
                <span className="vl mono-nums">{fmtBRL(recCafe)}</span>
              </div>
            )}
          </div>
          <div className="month-op">
            <div className="op-line">
              <span>O leite pagou o leite?</span>
              <span className="op-verdict" style={{ color: opLeite >= 0 ? "var(--lucro)" : "var(--prejuizo)" }}>
                {opLeite >= 0 ? "Sim" : "Não"} · {opLeite >= 0 ? "+" : "−"}
                {fmtBRL(Math.abs(opLeite))}
              </span>
            </div>
            <div className="caption">Receita leite − custeio puro do leite no mês.</div>
          </div>
        </div>

        <div className="month-panel">
          <div className="panel-title">
            <h3>Para onde foi o dinheiro</h3>
          </div>
          <div className="month-pilhas">
            <MonthPilhaBar label="Custeio operacional" value={custeio} total={custeio + invest} color="var(--cafe)" />
            {animAq > 0 && <MonthPilhaBar label="Animal Aquisição (invest. em custeio)" value={animAq} total={custeio + invest} color="var(--prejuizo)" flag />}
            <MonthPilhaBar label="Investimento" value={invest - animAq} total={custeio + invest} color="var(--outros)" dashed />
          </div>
        </div>
      </div>

      <section className="cockpit-section" style={{ borderBottom: "none", paddingTop: 30 }}>
        <div className="dash-sec-head">
          <div className="dash-sec-titles">
            <span className="eyebrow">Detalhe · {mesLabel}</span>
            <h2 className="dash-sec-title">Gastos do mês por categoria</h2>
          </div>
          <span className="caption" style={{ fontStyle: "italic" }}>
            {cats.length} categorias com lançamento · clique para abrir
          </span>
        </div>
        <div className="cats-real-list">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {cats.map((c: any, i: number) => {
            const w = (c.mesVal / maxCat) * 100;
            const cor = c.atividade === "leite" ? "var(--leite)" : c.atividade === "cafe" ? "var(--cafe)" : "var(--outros)";
            return (
              <button key={c.id} className="cat-real-row" onClick={() => onDrill(c.id)}>
                <span className="rnk">{String(i + 1).padStart(2, "0")}</span>
                <div className="nm-cell">
                  <span className="nm">
                    {c.nome}
                    {c.flag && (
                      <span className="flag-warn" title="Classificação marcada pela IA">
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
                    <div className="bar-fill" style={{ width: `${w}%`, background: cor }}></div>
                  </div>
                </div>
                <span className="tot mono-nums">{fmtBRL(c.mesVal)}</span>
                <span className="ytd mono-nums">
                  <small>do mês</small>
                  {((c.mesVal / (custeio + invest)) * 100).toFixed(0)}%
                </span>
                <span className="dlt"></span>
                <span className="arr serif">›</span>
              </button>
            );
          })}
        </div>
      </section>

      <div style={{ padding: "30px 0 60px", display: "flex", justifyContent: "space-between" }}>
        <button className="crumb-btn" onClick={onBack}>
          ← voltar ao Dashboard
        </button>
        <button className="crumb-btn" onClick={() => onNav("ia")}>
          perguntar à IA sobre {mesLabel} →
        </button>
      </div>
    </div>
  );
}

/* ========== MÁSCARA DE VALORES (permissão) ========== */

function ValueMaskNotice({ user }: { user: User }) {
  return (
    <div className="mask-notice">
      <span className="mask-eye">🔒</span>
      <span>
        Valores em R$ ocultos para o perfil{" "}
        <strong>{user.papel === "personalizado" ? "Personalizado" : PAPEIS[user.papel]?.nome}</strong>. A estrutura — categorias,
        proporções e tendências — segue visível. O proprietário libera valores em Acessos.
      </span>
    </div>
  );
}

function LoadingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell-wide">
      <div
        style={{
          padding: "120px 0",
          textAlign: "center",
          color: "var(--ink-3)",
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 18,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function Dashboard({ onNav, user }: { onNav: (t: Tab) => void; user?: User }) {
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [drillCat, setDrillCat] = useState<CatId | null>(null);
  const [monthIdx, setMonthIdx] = useState<number | null>(null);
  const [data, setData] = useState<R | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Refaz a busca sempre que o range muda → o servidor devolve o bloco `periodo`
  // (KPIs do intervalo). Mantém `data` anterior durante o fetch (sem flash).
  const recarregar = useCallback(() => {
    fetchDashboard({ from: ymd(range.start), to: ymd(range.end) }).then(setData).catch(setError);
  }, [range]);
  useEffect(() => { recarregar(); }, [recarregar]);

  if (error) {
    return (
      <LoadingShell>
        Não foi possível carregar o dashboard.
        <div style={{ fontSize: 13, marginTop: 12, fontStyle: "normal", color: "var(--prejuizo)" }}>
          {error.message}
        </div>
      </LoadingShell>
    );
  }
  if (!data) {
    return <LoadingShell>Carregando dados…</LoadingShell>;
  }

  const maskVals = !!user && !user.flags.includes("verValores");

  if (drillCat !== null) {
    return (
      <div className={maskVals ? "mask-values" : ""}>
        {maskVals && user && <ValueMaskNotice user={user} />}
        <CategoryDrill R={data} catId={drillCat} onBack={() => setDrillCat(null)} onNav={onNav} />
      </div>
    );
  }

  if (monthIdx != null) {
    return (
      <div className={maskVals ? "mask-values" : ""}>
        {maskVals && user && <ValueMaskNotice user={user} />}
        <MonthDetail
          R={data}
          monthIdx={monthIdx}
          onBack={() => setMonthIdx(null)}
          onNav={onNav}
          onMonthChange={setMonthIdx}
          onDrill={(id) => {
            setMonthIdx(null);
            setDrillCat(id);
          }}
        />
      </div>
    );
  }

  return (
    <div className={"shell-wide " + (maskVals ? "mask-values" : "")}>
      {maskVals && user && <ValueMaskNotice user={user} />}
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">Período</span>
        <MonthRangePicker value={range} onChange={setRange} min={FILTRO_MIN} max={FILTRO_MAX} />
        <span className="text-[12px] italic text-ink-3">mensal · filtra os KPIs por data de liquidação</span>
      </div>
      <ContextStrip
        items={[
          { label: "Período", value: formatRangeLabel(range) },
          { label: "Atividade", value: "Todas (leite, café, outros)" },
          { label: "Categoria", value: "Todas" },
          { label: "Fonte", value: "—" },
        ]}
      />
      {/* Seções escondidas até existir o dado-fonte (não estão no schema/DB).
          Reative trocando SECOES_SEM_DADO para true (ou por seção) quando entrar:
          - ResumoExecutivo: narrativa da IA (virá pelo Plano IA, por mês fechado)
          - RupturaCaixa: projeção diária + compromissos a vencer
          - BreakEvenLeite / ProdutividadeRebanho: litros e plantel (rebanho vazio)
          - OrcadoRealizado: não existe tabela de orçamento */}
      {SECOES_SEM_DADO && (
        <>
          <ResumoExecutivo R={data} onNav={onNav} />
          <RupturaCaixa R={data} onNav={onNav} />
          <BreakEvenLeite R={data} onNav={onNav} />
          <OrcadoRealizado R={data} onDrill={setDrillCat} />
          <ProdutividadeRebanho R={data} />
        </>
      )}
      <KpiCockpit R={data} />
      <FolegoCaixa R={data} />
      <GastoPorCategoria R={data} onDrill={setDrillCat} />
      <ExplorarCategoria R={data} onDrill={setDrillCat} />
      <AtividadeSplit R={data} />
      {MOSTRAR_MULTI_PERIODO && (
        <>
          <TimelineSection R={data} onMonthClick={setMonthIdx} />
          <DRESection R={data} />
        </>
      )}
      <InconsistenciasSection R={data} onReclassificar={recarregar} />
      <div style={{ padding: "28px 0 60px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="caption" style={{ letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Agregado em runtime (via /api/dashboard)
        </span>
        <button className="crumb-btn" onClick={() => onNav("relatorio")}>ver Relatório editorial →</button>
      </div>
    </div>
  );
}
