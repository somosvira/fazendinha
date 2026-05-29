/* Rio Novo — Dashboard v3 — cockpit interativo (números + gráficos)
 *
 * Porta do protótipo de design (handoff index.html) para o codebase real.
 * Estado: lê de GET /api/dashboard (server agrega o Neon real). Subcategorias,
 * fornecedores e volume de leite vêm como suplementos estáticos casados por nome
 * de categoria (ver api.ts + data/cockpitSupplements.ts) — o backend ainda não
 * modela esses níveis de drill.
 *
 * A narrativa ("o leite paga o leite?", prosa) vive só no Relatório, por decisão
 * do cliente; aqui é número, gráfico e drill.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchDashboard } from "../api";
import { DateRangePicker, type DateRange } from "./DateRangePicker";
import type { Tab } from "./Shell";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type R = any;

const DASH_TODAY = new Date(2026, 4, 4);
const DEFAULT_RANGE: DateRange = { start: new Date(2024, 6, 1), end: DASH_TODAY };

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

function TimelineChart({ R, startIdx = 0, endIdx = 22, height = 340 }: { R: R; startIdx?: number; endIdx?: number; height?: number }) {
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
        return (
          <g key={i}>
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
      <polyline fill="none" stroke="var(--ink)" strokeWidth="1.4"
        points={meses.map((_, i) => `${padL + i * xBand + xBand / 2},${yScale(tot[i])}`).join(" ")} />
      {meses.map((_, i) => <circle key={"p" + i} cx={padL + i * xBand + xBand / 2} cy={yScale(tot[i])} r="2.5" fill="var(--bg)" stroke="var(--ink)" strokeWidth="1.2" />)}
      <defs>
        <pattern id="stripes-neg" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
          <rect width="4" height="4" fill="var(--neg)" opacity="0.35" />
          <line x1="0" y1="0" x2="0" y2="4" stroke="var(--neg)" strokeWidth="0.8" />
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

function GastoPorCategoria({ R, onDrill }: { R: R; onDrill: (id: number) => void }) {
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
    <section className="cockpit-section">
      <div className="dash-sec-head">
        <div className="dash-sec-titles">
          <span className="eyebrow">Distribuição</span>
          <h2 className="dash-sec-title">Gasto por categoria</h2>
        </div>
        <div className="dash-sec-controls">
          <div className="act-filter">
            {([["tudo", "Tudo"], ["leite", "Leite"], ["cafe", "Café"], ["outros", "Outros"]] as const).map(([k, l]) => (
              <button key={k} aria-pressed={act === k} onClick={() => { setAct(k); setOff({}); }}>
                {k !== "tudo" && <span className="swatch" style={{ background: k === "leite" ? "var(--leite)" : k === "cafe" ? "var(--cafe)" : "var(--outros)" }}></span>}
                {l}
              </button>
            ))}
          </div>
          <div className="period-switch">
            <button aria-current={period === "23m"} onClick={() => setPeriod("23m")}>23 meses</button>
            <button aria-current={period === "ytd"} onClick={() => setPeriod("ytd")}>2026 YTD</button>
          </div>
        </div>
      </div>

      <div className="donut-layout">
        <div className="donut-wrap">
          <Donut segments={segments} total={total} onSliceClick={toggle} hovered={hovered} setHovered={setHovered} />
          <div className="donut-meta">
            <span className="caption">{active.length} de {items.length} categorias ativas</span>
            <button className="link-btn" onClick={allOn}>mostrar todas</button>
          </div>
        </div>

        <div className="donut-legend">
          <div className="donut-legend-head">
            <span>Categoria</span>
            <span style={{ textAlign: "right" }}>Valor</span>
            <span style={{ textAlign: "right" }}>%</span>
          </div>
          <div className="donut-legend-list">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {items.map((c: any) => {
              const sid = String(c.id);
              const isOff = !!off[sid];
              const pct = total > 0 && !isOff ? (c.value / total) * 100 : 0;
              return (
                <div
                  key={sid}
                  className={"legend-row " + (isOff ? "is-off " : "") + (hovered === sid ? "is-hover" : "")}
                  onMouseEnter={() => setHovered(sid)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <button className="legend-toggle" onClick={() => toggle(sid)} title={isOff ? "Ativar" : "Desativar"}>
                    <span className="legend-check" style={{ background: isOff ? "transparent" : c.color, borderColor: c.color }}>
                      {!isOff && <span className="tick">✓</span>}
                    </span>
                    <span className="legend-name">
                      {c.nome}
                      {c.flag && <span className="flag-warn-mini" title="Classificação marcada pela IA">⚠</span>}
                    </span>
                  </button>
                  <span className="legend-val mono-nums">{fmtBRL(c.value)}</span>
                  <span className="legend-pct mono-nums">{isOff ? "—" : pct.toFixed(1) + "%"}</span>
                  <button className="legend-only" onClick={() => onlyOne(sid)} title="Ver só esta">só</button>
                  <button className="legend-drill" onClick={() => onDrill(c.id)} title="Abrir detalhe">›</button>
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
function CategoryDropdown({ items, value, onChange }: { items: any[]; value: number; onChange: (id: number) => void }) {
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
    <div className="cat-dd" ref={ref}>
      <button className="cat-dd-trigger" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="cat-dd-sw" style={{ background: sel ? (sel.atividade === "leite" ? "var(--leite)" : sel.atividade === "cafe" ? "var(--cafe)" : "var(--outros)") : "var(--ink-3)" }}></span>
        <span className="cat-dd-label">{sel ? sel.nome : "Selecione…"}</span>
        <span className="cat-dd-chev">▾</span>
      </button>
      {open && (
        <div className="cat-dd-menu">
          {items.map((c) => (
            <button key={c.id} className={"cat-dd-opt " + (c.id === value ? "active" : "")} onClick={() => { onChange(c.id); setOpen(false); }}>
              <span className="cat-dd-sw" style={{ background: c.atividade === "leite" ? "var(--leite)" : c.atividade === "cafe" ? "var(--cafe)" : "var(--outros)" }}></span>
              <span className="cat-dd-opt-nm">{c.nome}</span>
              <span className="cat-dd-opt-val mono-nums">{fmtBRL(c.total23m)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ExplorarCategoria({ R, onDrill }: { R: R; onDrill: (id: number) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = R.categoriasReais.slice().sort((a: any, b: any) => b.total23m - a.total23m);
  const [catId, setCatId] = useState<number>(items[0].id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cat = items.find((c: any) => c.id === catId) ?? items[0];

  const monthly = useMemo(() => categoryMonthly(cat), [cat]);
  const total = cat.total23m;
  const media = Math.round(total / 23);
  const maxIdx = monthly.indexOf(Math.max(...monthly));
  const corAtv = cat.atividade === "leite" ? "var(--leite)" : cat.atividade === "cafe" ? "var(--cafe)" : "var(--outros)";

  // synthesized fornecedores split
  const forns = useMemo(() => {
    const parts = seededMonthly(cat.total23m, cat.id + "·forn", 4).sort((a, b) => b - a);
    const names: string[] = (R.fornecedores ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((f: any) => f.categoriaUsual.toLowerCase().includes(cat.nome.split(" ")[0].toLowerCase()))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((f: any) => f.nome);
    const pool = names.length ? names : ["Fornecedor principal", "Segundo fornecedor", "Terceiro", "Demais"];
    return parts.map((v, i) => ({ nome: pool[i] || ["Demais fornecedores", "Outros", "Diversos", "—"][i] || "Outros", value: v }));
  }, [R, cat]);

  return (
    <section className="cockpit-section">
      <div className="dash-sec-head">
        <div className="dash-sec-titles">
          <span className="eyebrow">Explorar</span>
          <h2 className="dash-sec-title">Detalhe por categoria</h2>
        </div>
        <div className="dash-sec-controls">
          <CategoryDropdown items={items} value={catId} onChange={setCatId} />
          <button className="btn-secondary" style={{ padding: "8px 16px" }} onClick={() => onDrill(catId)}>Abrir detalhe completo →</button>
        </div>
      </div>

      <div className="explorar-stats">
        <div className="ex-cell">
          <span className="l">Total 23 meses</span>
          <span className="v mono-nums">{fmtBRL(total)}</span>
        </div>
        <div className="ex-cell">
          <span className="l">2026 YTD</span>
          <span className="v mono-nums">{fmtBRL(cat.ytd2026)}</span>
        </div>
        <div className="ex-cell">
          <span className="l">Média mensal</span>
          <span className="v mono-nums">{fmtBRL(media)}</span>
        </div>
        <div className="ex-cell">
          <span className="l">Mês de pico</span>
          <span className="v mono-nums">{R.MESES_23M[maxIdx].replace("*", "")}</span>
        </div>
        <div className="ex-cell">
          <span className="l">vs 2025</span>
          <span className="v mono-nums" style={{ color: cat.delta > 0 ? "var(--neg)" : "var(--pos)" }}>{cat.delta > 0 ? "▲ +" : "▼ "}{Math.abs(cat.delta)}%</span>
        </div>
      </div>

      <div className="explorar-grid">
        <div className="explorar-chart">
          <div className="panel-title" style={{ marginBottom: 10 }}>
            <h3>{cat.nome} — mês a mês (jul/24 → mai/26)</h3>
            <span className="meta">{cat.grupo} · {cat.subgrupo}</span>
          </div>
          <BarSeries data={monthly} labels={R.MESES_23M} color={corAtv} height={220} />
        </div>
        <div className="explorar-side">
          <div className="panel-title"><h3 style={{ fontSize: 16 }}>Principais fornecedores</h3></div>
          <div className="forn-mini-list">
            {forns.map((f, i) => {
              const max = Math.max(...forns.map((x) => x.value), 1);
              return (
                <div key={i} className="forn-mini">
                  <div className="forn-mini-top">
                    <span className="nm">{f.nome}</span>
                    <span className="vl mono-nums">{fmtBRL(f.value)}</span>
                  </div>
                  <div className="forn-mini-bar"><div style={{ width: `${(f.value / max) * 100}%`, background: corAtv }}></div></div>
                </div>
              );
            })}
          </div>
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
    <section className="cockpit-section">
      <div className="dash-sec-head">
        <div className="dash-sec-titles">
          <span className="eyebrow">Comparativo · 23 meses</span>
          <h2 className="dash-sec-title">Leite × Café × Outros</h2>
        </div>
      </div>
      <div className="atv-split-grid">
        {cards.map((c) => {
          const margem = c.receita - c.custeio;
          return (
            <div className="atv-split-card" key={c.key}>
              <div className="atv-split-h">
                <span className="sw" style={{ background: c.cor }}></span>
                <span className="nm">{c.nome}</span>
              </div>
              <div className="atv-bars">
                <div className="atv-bar-row">
                  <span className="lbl">Receita</span>
                  <div className="atv-bar-track"><div className="atv-bar-fill" style={{ width: `${(c.receita / maxBar) * 100}%`, background: c.cor }}></div></div>
                  <span className="amt mono-nums">{fmtBRL(c.receita)}</span>
                </div>
                <div className="atv-bar-row">
                  <span className="lbl">Custeio</span>
                  <div className="atv-bar-track"><div className="atv-bar-fill" style={{ width: `${(c.custeio / maxBar) * 100}%`, background: "var(--cafe)", opacity: 0.7 }}></div></div>
                  <span className="amt mono-nums">−{fmtBRL(c.custeio)}</span>
                </div>
                <div className="atv-bar-row">
                  <span className="lbl">Investim.</span>
                  <div className="atv-bar-track"><div className="atv-bar-fill striped-out" style={{ width: `${(c.invest / maxBar) * 100}%` }}></div></div>
                  <span className="amt mono-nums">−{fmtBRL(c.invest)}</span>
                </div>
              </div>
              <div className="atv-margem">
                <span className="l">Margem operacional</span>
                <span className="v mono-nums" style={{ color: margem >= 0 ? "var(--pos)" : "var(--neg)" }}>
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

function KpiCockpit({ R, range, setRange }: { R: R; range: DateRange; setRange: (r: DateRange) => void }) {
  const t = R.totals23m;
  const receita23 = t.receitaLeite + t.receitaCafe;
  const custeio23 = t.custeioLeitePuro + t.custeioCafe + t.sedeOutros;
  const investOutros = (R.investimentoReais ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((i: any) => i.atividade === "outros")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .reduce((s: number, i: any) => s + i.total23m, 0);
  const invest23 = t.investLeite + t.investCafe + t.animalAquisicao + investOutros;
  const custoLitro = R.volumeLeite?.custoPorLitro2025 ?? 0;

  const kpis = [
    { lbl: "Caixa hoje", val: fmtBRL(R.caixaHoje.total, { compact: false }), sub: "3 contas", tone: "" },
    { lbl: "Receita 23m", val: fmtBRL(receita23), sub: "leite + café", tone: "" },
    { lbl: "Custeio 23m", val: fmtBRL(custeio23), sub: "operacional puro", tone: "" },
    { lbl: "Investimento 23m", val: fmtBRL(invest23), sub: "gado, máquina, café", tone: "" },
    { lbl: "Fluxo líquido 23m", val: fmtBRL(t.totalGeral), sub: "89% investimento", tone: "neg" },
    { lbl: "Custo / litro 2025", val: "R$ " + custoLitro.toFixed(2).replace(".", ","), sub: "vs R$ 3,20 venda", tone: "neg" },
  ];

  return (
    <div className="kpi-cockpit-band">
      <div className="kpi-cockpit-head">
        <div>
          <span className="eyebrow">Visão operacional — planilha BPO 04/mai/2026</span>
          <h1 className="kpi-cockpit-title">Dashboard</h1>
        </div>
        <DateRangePicker value={range} onChange={setRange} anchor="right" />
      </div>
      <div className="kpi-cockpit-grid">
        {kpis.map((k, i) => (
          <div className="kpi-cock" key={i}>
            <span className="lbl">{k.lbl}</span>
            <span className={"val mono-nums " + k.tone}>{k.val}</span>
            <span className="sub">{k.sub}</span>
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

function InconsistenciasSection({ R }: { R: R }) {
  return (
    <section className="cockpit-section" style={{ borderBottom: "none" }}>
      <div className="dash-sec-head">
        <div className="dash-sec-titles">
          <span className="eyebrow">Qualidade dos dados</span>
          <h2 className="dash-sec-title">Inconsistências detectadas pela IA</h2>
        </div>
      </div>
      <div className="inc-grid">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {R.inconsistencias.map((it: any) => (
          <div key={it.id} className={"inc-card sev-" + it.severidade}>
            <div className="inc-head">
              <span className={"sev-chip sev-" + it.severidade}>{it.severidade === "alta" ? "Crítica" : it.severidade === "media" ? "Média" : "Baixa"}</span>
              <span className="inc-valor mono-nums">{fmtBRL(it.valor)}</span>
            </div>
            <div className="inc-title">{it.titulo}</div>
            <div className="inc-impacto">
              <span className="lbl">Impacto:</span>
              <span className="txt">{it.impacto}</span>
            </div>
            <div className="inc-actions">
              <button className="btn-primary" style={{ padding: "7px 13px", fontSize: 12 }}>{it.acao}</button>
              <button className="btn-ghost" style={{ padding: "7px 11px", fontSize: 12 }}>Ignorar</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ========== TIMELINE (compact) ========== */

function TimelineSection({ R }: { R: R }) {
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
          <span className="eyebrow">Linha do tempo</span>
          <h2 className="dash-sec-title">Fluxo mês a mês</h2>
        </div>
        <div className="timeline-slices">
          {slices.map((s) => (
            <button key={s.label} className="t-slice" aria-pressed={from === s.from && to === s.to} onClick={() => { setFrom(s.from); setTo(s.to); }}>{s.label}</button>
          ))}
        </div>
      </div>
      <TimelineChart R={R} startIdx={from} endIdx={to} height={320} />
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

const SUB_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function rngFrom(seedStr: string): () => number {
  let s = 7;
  for (const ch of seedStr) s = (s * 31 + ch.charCodeAt(0)) % 233280;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}
function brandsFor(nome: string): string[] | null {
  const n = nome.toLowerCase();
  if (n.includes("concentrada")) return ["Cargill Nutron Leite 21%", "Purina Gado de Leite TOP", "Socil Leiteiro 24", "Guabi Lactomax", "Presence Leite Forte"];
  if (n.includes("silagem") || n.includes("volumoso")) return ["Silagem de milho (própria)", "Silagem de sorgo", "Pré-secado de capim", "Feno de tifton"];
  if (n.includes("sal mineral")) return ["Tortuga Fosbovi 40", "Matsuda Supr Mil", "Fri-Ribe Leite +"];
  if (n.includes("bezerro")) return ["Purina Bezerro Ini", "Cargill Aleitamento", "Socil Bezerra Plus"];
  if (n.includes("núcleo") || n.includes("proteico")) return ["Nutrivet Núcleo 30", "Presence Proteico"];
  if (n.includes("cavalo")) return ["Guabi Equitage", "Presence Haras"];
  if (n.includes("cachorro")) return ["Pedigree 15 kg", "Golden Fórmula 15 kg", "Premier"];
  if (n.includes("antibiótico")) return ["Florfenicol 250 ml", "Oxitetraciclina LA 500 ml", "Tilosina"];
  if (n.includes("vermífugo") || n.includes("antiparasit")) return ["Ivermectina 500 ml", "Ricobendazol", "Closantel"];
  if (n.includes("vacina")) return ["Vacina Brucelose B19", "Raiva Bovina", "IBR/BVD"];
  if (n.includes("soro") || n.includes("hidrat")) return ["Soro fisiológico 500 ml", "Eletrólito oral"];
  if (n.includes("vitamínico")) return ["ADE injetável", "Complexo B injetável"];
  if (n.includes("diesel")) return ["Diesel S-10 (1.000 L)", "Diesel S-10 (500 L)", "Diesel S-10 (300 L)"];
  if (n.includes("gasolina")) return ["Gasolina comum", "Gasolina aditivada"];
  if (n.includes("lubrific")) return ["Óleo 15W40 (balde)", "Graxa de lítio", "Fluido hidráulico"];
  if (n.includes("ordenha")) return ["Conjunto teteira DeLaval", "Bomba de vácuo Siloking", "Revisão ordenhadeira"];
  if (n.includes("energia")) return ["Fatura Energisa — curral", "Fatura Energisa — galpão"];
  if (n.includes("madeira") || n.includes("cerca")) return ["Mourão tratado", "Arame liso 500 m", "Tábua de pinus"];
  if (n.includes("higiene")) return ["Detergente alcalino", "Iodo pós-dipping", "Pré-dipping"];
  if (n.includes("manejo")) return ["Luva descartável cx", "Soga / corda", "Brinco de identificação"];
  if (n.includes("imunóg")) return ["Vacina clostridiose", "Carrapaticida"];
  if (n.includes("matriz")) return ["Lote 4 matrizes Girolando", "Lote 6 matrizes Girolando"];
  if (n.includes("bezerra")) return ["Lote bezerras 8m", "Lote bezerras desmama"];
  if (n.includes("touro")) return ["Touro Girolando PO"];
  if (n.includes("máquina") || n.includes("trator") || n.includes("colheit")) return ["Peça hidráulica", "Pneu agrícola", "Revisão motor"];
  if (n.includes("benfeitor") || n.includes("telhado") || n.includes("reforma")) return ["Telha fibrocimento", "Cimento + areia", "Mão de obra pedreiro"];
  if (n.includes("veículo")) return ["Revisão picape", "Pneu utilitário", "Bateria"];
  if (n.includes("ordenhador") || n.includes("tratador") || n.includes("capataz") || n.includes("diarista") || n.includes("caseiro") || n.includes("13") || n.includes("férias") || n.includes("rescis")) return ["Folha mensal", "Adiantamento", "Encargos"];
  return null;
}
function unitFor(nome: string): { label: string; price: number } | null {
  const n = nome.toLowerCase();
  if (n.includes("concentrada") || n.includes("silagem") || n.includes("volumoso")) return { label: "ton", price: 2150 };
  if (n.includes("sal mineral") || n.includes("bezerro") || n.includes("núcleo") || n.includes("cavalo")) return { label: "sc 40kg", price: 145 };
  if (n.includes("cachorro")) return { label: "sc 15kg", price: 180 };
  if (n.includes("diesel") || n.includes("gasolina")) return { label: "L", price: 6.1 };
  return null;
}

type LancRow = { data: Date; dataLabel: string; marca: string; valor: number; qtd: string | null; nf: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function genLancamentos(cat: any, subNome: string, subIdx: number, totalValue: number, count: number): LancRow[] {
  const r = rngFrom(cat.id + "·" + subIdx + "·lanc");
  const n = Math.min(count, 16);
  const pool = brandsFor(subNome) || [subNome];
  const unit = unitFor(subNome);
  const parts = seededMonthly(totalValue, cat.id + subIdx + "·v", n);
  const rows: LancRow[] = [];
  for (let i = 0; i < n; i++) {
    const monthOff = Math.floor(r() * 23);
    const day = 1 + Math.floor(r() * 27);
    const d = new Date(2024, 6 + monthOff, day);
    const valor = parts[i];
    const marca = pool[Math.floor(r() * pool.length)];
    let qtd: string | null = null;
    if (unit) {
      const q = valor / unit.price;
      qtd = (unit.label === "L" ? Math.round(q) : q >= 10 ? q.toFixed(1) : q.toFixed(2)) + " " + unit.label;
    }
    rows.push({
      data: d,
      dataLabel: `${String(d.getDate()).padStart(2, "0")}/${SUB_MES[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`,
      marca, valor, qtd,
      nf: "NF " + (10000 + Math.floor(r() * 89999)),
    });
  }
  rows.sort((a, b) => b.data.getTime() - a.data.getTime());
  return rows;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NotaDrawer({ R, cat, sub, row, onClose }: { R: R; cat: any; sub: any; row: LancRow; onClose: () => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fornObj = (R.fornecedores ?? []).find((f: any) => f.nome === sub.fornecedor);
  const cnpj = fornObj ? fornObj.cnpj : "—";
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <div className="eyebrow">{row.nf}</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 22, marginTop: 4 }}>{sub.fornecedor}</div>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className="drawer-body">
          <div>
            <div className="eyebrow">Valor da nota</div>
            <div className="drawer-amount mono-nums">{fmtBRL(row.valor, { compact: false })}</div>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Nota fiscal anexa</div>
            <div className="nota-frame">
              <div className="nota-img">{row.nf} — {sub.fornecedor.toUpperCase()}<br />{row.marca} · {row.dataLabel}</div>
              <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink-3)" }}>
                <span>Capturada via WhatsApp · Sandra (admin)</span>
                <span>{row.dataLabel}</span>
              </div>
            </div>
          </div>

          <div className="drawer-meta-grid">
            <div className="mcell"><span className="ml">Data</span><span className="mv">{row.dataLabel}</span></div>
            <div className="mcell"><span className="ml">Documento</span><span className="mv">{row.nf}</span></div>
            <div className="mcell"><span className="ml">Fornecedor</span><span className="mv">{sub.fornecedor}</span></div>
            <div className="mcell"><span className="ml">CNPJ</span><span className="mv mono-nums">{cnpj}</span></div>
            <div className="mcell"><span className="ml">Produto / marca</span><span className="mv">{row.marca}</span></div>
            <div className="mcell"><span className="ml">Quantidade</span><span className="mv">{row.qtd || "—"}</span></div>
            <div className="mcell"><span className="ml">Conta bancária</span><span className="mv">Sicoob PJ ag. 9012</span></div>
            <div className="mcell"><span className="ml">Lançado por</span><span className="mv">Sandra (WhatsApp)</span></div>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Classificação</div>
            <div className="split-stack">
              <div className="split-row">
                <span className={"act-pill " + (cat.atividade === "leite" ? "leite" : cat.atividade === "cafe" ? "cafe" : "outros")}>
                  <span className="dot"></span>{cat.atividade === "leite" ? "Leite" : cat.atividade === "cafe" ? "Café" : "Outros"}
                </span>
                <span style={{ fontSize: 14 }}>{cat.grupo} → {cat.nome}</span>
                <span className="mono-nums" style={{ fontFamily: "var(--serif)", fontSize: 15 }}>{sub.nome}</span>
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
              {row.marca} — {sub.nome.toLowerCase()}. Compra de {row.dataLabel} junto a {sub.fornecedor}, paga via PIX. Categorizado automaticamente pela IA a partir da leitura da nota.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LancamentosPanel({ R, cat, sub, subIdx, onClose }: { R: R; cat: any; sub: any; subIdx: number; onClose: () => void }) {
  const rows = useMemo(() => genLancamentos(cat, sub.nome, subIdx, sub.value, sub.lanc), [cat, sub.nome, subIdx, sub.value, sub.lanc]);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const shown = rows.length;
  return (
    <div className="lanc-panel">
      <div className="lanc-panel-head">
        <div>
          <span className="eyebrow">Lançamentos individuais</span>
          <div className="lanc-panel-title">{sub.nome}</div>
          <span className="caption">{sub.fornecedor} · mostrando {shown} de {sub.lanc} lançamentos · total {fmtBRL(sub.value)}</span>
        </div>
        <button className="drawer-close" onClick={onClose} aria-label="Fechar">×</button>
      </div>
      <table className="lanc-table">
        <thead>
          <tr>
            <th style={{ width: 90 }}>Data</th>
            <th>Marca / descrição</th>
            <th>Fornecedor</th>
            <th className="r" style={{ width: 110 }}>Qtd</th>
            <th className="r" style={{ width: 130 }}>Valor</th>
            <th style={{ width: 110 }}>Nota</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} onClick={() => setOpenRow(i)} className="lanc-row-click">
              <td className="ld-date mono-nums">{row.dataLabel}</td>
              <td className="ld-marca">{row.marca}</td>
              <td className="ld-forn">{sub.fornecedor}</td>
              <td className="r mono-nums">{row.qtd || "—"}</td>
              <td className="r ld-val mono-nums">{fmtBRL(row.valor, { compact: false })}</td>
              <td className="ld-nf"><span className="nf-link">ver nota ›</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {openRow != null && (
        <NotaDrawer R={R} cat={cat} sub={sub} row={rows[openRow]} onClose={() => setOpenRow(null)} />
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
            const pct = total > 0 && !isOff ? (s.value / total) * 100 : 0;
            const isSel = selected === s.idx;
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
                <span className="sc-lanc mono-nums">{s.lanc}</span>
                <span className="sc-val mono-nums">{fmtBRL(s.value)}</span>
                <span className="sc-pct mono-nums">{isOff ? "—" : pct.toFixed(1) + "%"}</span>
                <span className="sc-open">{isSel ? "▾" : "›"}</span>
              </div>
            );
          })}
        </div>
      </div>

      {selectedSub && (
        <LancamentosPanel R={R} cat={cat} sub={selectedSub} subIdx={selectedSub.idx} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function CategoryDrill({ R, catId, onBack, onNav }: { R: R; catId: number; onBack: () => void; onNav: (t: Tab) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cat = R.categoriasReais.find((c: any) => c.id === catId);
  const [period, setPeriod] = useState<"23m" | "ytd">("23m");
  if (!cat) return null;
  const monthly = categoryMonthly(cat);
  const media = Math.round(cat.total23m / 23);
  const maxIdx = monthly.indexOf(Math.max(...monthly));
  const corAtv = cat.atividade === "leite" ? "var(--leite)" : cat.atividade === "cafe" ? "var(--cafe)" : "var(--outros)";
  const hasSubs = !!R.subcategorias[catId];
  const nSubs = hasSubs ? R.subcategorias[catId].length : 0;

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
          <span className="dlt" style={{ color: cat.delta > 0 ? "var(--neg)" : "var(--pos)" }}>{cat.delta > 0 ? "▲ +" : "▼ "}{Math.abs(cat.delta)}% vs 2025</span>
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
            Na planilha do BPO tudo isso entra como uma linha só: <strong>"{cat.nome}"</strong>. Aqui está aberto no que realmente foi comprado.
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

export function Dashboard({ onNav }: { onNav: (t: Tab) => void }) {
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [drillCat, setDrillCat] = useState<number | null>(null);
  const [data, setData] = useState<R | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchDashboard().then(setData).catch(setError);
  }, []);

  if (error) {
    return (
      <LoadingShell>
        Não foi possível carregar o dashboard.
        <div style={{ fontSize: 13, marginTop: 12, fontStyle: "normal", color: "var(--neg)" }}>
          {error.message}
        </div>
      </LoadingShell>
    );
  }
  if (!data) {
    return <LoadingShell>Carregando dados do Neon…</LoadingShell>;
  }

  if (drillCat !== null) {
    return <CategoryDrill R={data} catId={drillCat} onBack={() => setDrillCat(null)} onNav={onNav} />;
  }

  return (
    <div className="shell-wide">
      <KpiCockpit R={data} range={range} setRange={setRange} />
      <GastoPorCategoria R={data} onDrill={setDrillCat} />
      <ExplorarCategoria R={data} onDrill={setDrillCat} />
      <AtividadeSplit R={data} />
      <TimelineSection R={data} />
      <DRESection R={data} />
      <InconsistenciasSection R={data} />
      <div style={{ padding: "28px 0 60px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="caption" style={{ letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Fonte: Neon (via /api/dashboard) · agregado em runtime
        </span>
        <button className="crumb-btn" onClick={() => onNav("relatorio")}>ver Relatório editorial →</button>
      </div>
    </div>
  );
}
