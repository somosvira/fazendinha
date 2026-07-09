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

// breadcrumb/rodapé: botão-link (Preflight OFF → zera bg/padding nativos)
const CRUMB_BTN =
  "cursor-pointer bg-transparent p-0 font-sans text-[14px] text-ink-3 underline underline-offset-[3px] hover:text-foreground";

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
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(20,25,26,0.35)]" onClick={onClose}>
      <div
        className="flex h-full w-[540px] flex-col overflow-auto bg-background shadow-[-10px_0_30px_rgba(20,25,26,0.12)] max-[900px]:w-[min(540px,100vw)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-mast px-7 py-[22px] text-mast-ink max-[900px]:px-[18px] max-[900px]:py-4">
          <div>
            <div className="eyebrow" style={{ color: "var(--mast-ink-2)" }}>{row.doc || "Lançamento"}</div>
            <div className="mt-1 font-serif text-[22px]">{row.fornecedor}</div>
          </div>
          <button
            className="cursor-pointer bg-transparent font-serif text-[22px] text-mast-ink print:hidden"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-7 p-7 max-[900px]:gap-5 max-[900px]:p-[18px]">
          <div>
            <div className="eyebrow">Valor</div>
            <div className="mono-nums font-serif text-[48px] leading-none tracking-[-0.02em] max-[900px]:text-[36px]">{fmtBRL(row.valor)}</div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-[18px] max-[900px]:gap-x-[18px] max-[900px]:gap-y-[14px]">
            <div className="flex flex-col gap-1"><span className="text-[14px] font-semibold uppercase tracking-[0.12em] text-ink-2">Data de liquidação</span><span className="text-[16px] font-medium text-foreground">{fmtData(row.data)}</span></div>
            <div className="flex flex-col gap-1"><span className="text-[14px] font-semibold uppercase tracking-[0.12em] text-ink-2">Documento</span><span className="text-[16px] font-medium text-foreground">{row.doc || "—"}</span></div>
            <div className="flex flex-col gap-1"><span className="text-[14px] font-semibold uppercase tracking-[0.12em] text-ink-2">Fornecedor</span><span className="text-[16px] font-medium text-foreground">{row.fornecedor}</span></div>
            <div className="flex flex-col gap-1"><span className="text-[14px] font-semibold uppercase tracking-[0.12em] text-ink-2">Categoria</span><span className="text-[16px] font-medium text-foreground">{cat.grupo} → {cat.nome}</span></div>
          </div>

          <div>
            <div className="eyebrow mb-2.5">Classificação</div>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border border-solid border-[color:var(--rule-soft)] bg-card px-3 py-2.5">
                <span className={"act-pill " + (cat.atividade === "leite" ? "leite" : cat.atividade === "cafe" ? "cafe" : "outros")}>
                  <span className="dot"></span>{cat.atividade === "leite" ? "Leite" : cat.atividade === "cafe" ? "Café" : "Outros"}
                </span>
                <span className="text-[14px]">{cat.grupo} → {cat.nome}</span>
              </div>
            </div>
            {cat.flag && (
              <div className="footnote mt-3">
                <span className="dagger">†</span>
                <span>Categoria marcada pela IA como possível investimento (hoje em custeio).</span>
              </div>
            )}
          </div>

          <div>
            <div className="eyebrow mb-2">Descrição</div>
            <div className="text-[15px] leading-[1.55] text-ink-2">
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

  const thBase = "border-b border-solid border-border px-4 py-3 font-sans text-[14px] font-semibold uppercase tracking-[0.14em] text-ink-3";
  const tdBase = "border-b border-solid border-[color:var(--rule-soft)] px-4 py-[11px]";

  return (
    <div className="mt-[18px] border border-solid border-foreground bg-card">
      <div className="flex items-start justify-between border-b border-solid border-border bg-[var(--bg-card-2)] px-5 py-[18px]">
        <div>
          <span className="eyebrow">Lançamentos individuais</span>
          <div className="my-1 font-serif text-[24px] font-medium tracking-[-0.01em]">{sub.nome}</div>
          <span className="caption">
            {rows == null
              ? "carregando…"
              : `${rows.length} lançamento${rows.length === 1 ? "" : "s"} · total ${fmtBRL(total)}`}
          </span>
        </div>
        <button className="cursor-pointer bg-transparent font-serif text-[22px] text-mast-ink print:hidden" onClick={onClose} aria-label="Fechar">×</button>
      </div>
      {erro ? (
        <div className="caption" style={{ padding: 14, color: "var(--prejuizo)" }}>Erro ao carregar: {erro}</div>
      ) : (
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={cn(thBase, "text-left")} style={{ width: 90 }}>Data</th>
            <th className={cn(thBase, "text-left")}>Descrição</th>
            <th className={cn(thBase, "text-left")}>Fornecedor</th>
            <th className={cn(thBase, "text-left")} style={{ width: 130 }}>Documento</th>
            <th className={cn(thBase, "text-right")} style={{ width: 130 }}>Valor</th>
          </tr>
        </thead>
        <tbody>
          {(rows ?? []).map((row, i) => (
            <tr key={i} onClick={() => setOpenRow(i)} className="cursor-pointer hover:bg-[var(--bg-card-2)] [&:last-child>td]:border-b-0">
              <td className={cn(tdBase, "mono-nums font-serif text-[15px] text-ink-2")}>{fmtData(row.data)}</td>
              <td className={cn(tdBase, "text-[15px] font-medium text-foreground")}>{row.descricao || "—"}</td>
              <td className={cn(tdBase, "text-[15px] text-ink-3")}>{row.fornecedor}</td>
              <td className={cn(tdBase, "mono-nums text-[15px] text-ink-2")}>{row.doc || "—"}</td>
              <td className={cn(tdBase, "mono-nums text-right font-serif text-[16px] font-medium text-foreground")}>{fmtBRL(row.valor)}</td>
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
      <div className="grid grid-cols-[300px_1fr] items-start gap-10 max-[1100px]:grid-cols-1">
        <div className="flex flex-col items-center gap-3 pt-1">
          <Donut segments={segments} total={total} onSliceClick={toggle} hovered={hovered} setHovered={setHovered} />
          <span className="caption text-center">{active.length} de {subs.length} tipos · clique na fatia pra filtrar</span>
        </div>

        <div className="border border-solid border-border bg-card">
          <div className="grid grid-cols-[1fr_80px_130px_64px_24px] gap-2.5 border-b border-solid border-border bg-[var(--bg-card-2)] px-4 py-3 text-[14px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            <span>Tipo de {cat.nome.toLowerCase()}</span>
            <span className="text-right">Lançam.</span>
            <span className="text-right">Valor</span>
            <span className="text-right">%</span>
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
                className={cn(
                  "grid grid-cols-[1fr_80px_130px_64px_24px] cursor-pointer items-center gap-2.5 border-b border-solid border-[color:var(--rule-soft)] py-3 transition-colors duration-[80ms] last:border-b-0",
                  isSel ? "border-l-[3px] border-l-foreground bg-[var(--bg-card-2)] pl-[13px] pr-4" : "px-4",
                  !isSel && hovered === s.id && "bg-[var(--bg-card-2)]",
                  isOff && "opacity-[0.42]",
                )}
                onMouseEnter={() => setHovered(s.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setSelected(isSel ? null : s.idx)}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <button
                    className="grid cursor-pointer place-items-center bg-transparent p-0"
                    onClick={(e) => { e.stopPropagation(); toggle(s.id); }}
                    title={isOff ? "Ativar na pizza" : "Desativar na pizza"}
                  >
                    <span className="grid h-4 w-4 flex-shrink-0 place-items-center border-[1.5px] border-solid" style={{ background: isOff ? "transparent" : s.color, borderColor: s.color }}>
                      {!isOff && <span className="text-[14px] leading-none" style={{ color: "var(--bg-card)" }}>✓</span>}
                    </span>
                  </button>
                  <span className="flex min-w-0 flex-col gap-px font-sans text-[16px] font-medium text-foreground">
                    {s.nome}
                    <small className="text-[14px] font-medium tracking-[0.01em] text-ink-3">{s.fornecedor}</small>
                  </span>
                </span>
                <span className="mono-nums text-right font-serif text-[15px] font-medium text-ink-3">{s.lanc || "—"}</span>
                <span className="mono-nums text-right font-serif text-[17px] font-medium">{fmtBRL(s.value)}</span>
                <span className="mono-nums text-right text-[14px] font-semibold text-ink-3">{isOff ? "—" : `${pct}%`}</span>
                <span className={cn("text-center font-serif text-[16px]", hovered === s.id ? "text-foreground" : "text-ink-2")}>{isSel ? "▾" : "›"}</span>
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
        <div className="flex items-center gap-1.5 pt-[18px] pb-3.5 text-[14px] text-ink-3">
          <button className={CRUMB_BTN} onClick={onBack}>Dashboard</button>
          <span className="text-ink-2">›</span>
          <span className="text-foreground">Categoria</span>
        </div>
        <LoadingShell>
          Categoria sem detalhe disponível neste período.
          <div style={{ marginTop: 14 }}>
            <button className={CRUMB_BTN} onClick={onBack}>← voltar ao Dashboard</button>
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
      <div className="flex items-center gap-1.5 pt-[18px] pb-3.5 text-[14px] text-ink-3">
        <button className={CRUMB_BTN} onClick={onBack}>Dashboard</button>
        <span className="text-ink-2">›</span>
        <button className={CRUMB_BTN} onClick={onBack}>Gasto por categoria</button>
        <span className="text-ink-2">›</span>
        <span className="text-foreground">{cat.nome}</span>
      </div>

      <div className="grid grid-cols-[auto_1fr_auto] items-end gap-6 border-b border-solid border-border pt-1 pb-[22px]">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">Categoria · {cat.grupo} → {cat.subgrupo}</span>
          <div className="font-serif text-[46px] font-medium leading-none tracking-[-0.02em]">{cat.nome}{cat.flag && <span className="ml-3.5 inline-block h-8 w-8 rounded-full border-[1.5px] border-solid border-prejuizo text-center align-middle text-[22px] leading-[28px] text-prejuizo">⚠</span>}</div>
        </div>
        <div></div>
        <div className="flex flex-col gap-1 text-right">
          <span className="eyebrow">Total 23 meses</span>
          <span className="mono-nums whitespace-nowrap font-serif text-[44px] leading-none tracking-[-0.02em]">{fmtBRL(cat.total23m)}</span>
          <span className="whitespace-nowrap text-[14px]" style={{ color: cat.delta > 0 ? "var(--prejuizo)" : "var(--lucro)" }}>{cat.delta > 0 ? "▲ +" : "▼ "}{Math.abs(cat.delta)}% vs 2025</span>
        </div>
      </div>

      <div className="grid grid-cols-4 border-b border-solid border-border">
        <div className="flex flex-col gap-1 border-r border-solid border-[color:var(--rule-soft)] py-4 pl-0 pr-5 last:border-r-0"><span className="text-[14px] font-semibold uppercase tracking-[0.10em] text-ink-3">2026 YTD</span><span className="mono-nums font-serif text-[26px] font-medium tracking-[-0.005em]">{fmtBRL(cat.ytd2026)}</span></div>
        <div className="flex flex-col gap-1 border-r border-solid border-[color:var(--rule-soft)] py-4 pl-0 pr-5 last:border-r-0"><span className="text-[14px] font-semibold uppercase tracking-[0.10em] text-ink-3">Média mensal</span><span className="mono-nums font-serif text-[26px] font-medium tracking-[-0.005em]">{fmtBRL(media)}</span></div>
        <div className="flex flex-col gap-1 border-r border-solid border-[color:var(--rule-soft)] py-4 pl-0 pr-5 last:border-r-0"><span className="text-[14px] font-semibold uppercase tracking-[0.10em] text-ink-3">Mês de pico</span><span className="mono-nums font-serif text-[26px] font-medium tracking-[-0.005em]">{R.MESES_23M[maxIdx].replace("*", "")}</span></div>
        <div className="flex flex-col gap-1 border-r border-solid border-[color:var(--rule-soft)] py-4 pl-0 pr-5 last:border-r-0"><span className="text-[14px] font-semibold uppercase tracking-[0.10em] text-ink-3">Tipos distintos</span><span className="mono-nums font-serif text-[26px] font-medium tracking-[-0.005em]">{nSubs || "—"}</span></div>
      </div>

      {hasSubs && (
        <section className="border-b border-solid border-border py-[30px]">
          <DashSectionHeader
            eyebrow="Composição detalhada"
            title={`Tipos de ${cat.nome.toLowerCase()}`}
            right={
              <div className="period-switch">
                <button aria-current={period === "23m"} onClick={() => setPeriod("23m")}>23 meses</button>
                <button aria-current={period === "ytd"} onClick={() => setPeriod("ytd")}>2026 YTD</button>
              </div>
            }
          />
          <p className="mb-5 mt-[-8px] max-w-[70ch] font-serif text-[17px] font-medium italic leading-[1.4] text-ink-2 [&_strong]:font-medium [&_strong]:not-italic [&_strong]:text-foreground">
            Tudo isso costuma entrar como uma linha só: <strong>"{cat.nome}"</strong>. Aqui está aberto no que realmente foi comprado.
          </p>
          <SubcatBreakdown R={R} cat={cat} period={period} />
        </section>
      )}

      <div className="border-b border-solid border-border py-[30px]">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="m-0 font-serif text-[18px] font-medium tracking-[-0.005em]">{cat.nome} — total mês a mês (jul/24 → mai/26)</h3>
        </div>
        <BarSeries data={monthly} labels={R.MESES_23M} color={corAtv} height={240} />
      </div>

      <div className="flex justify-between pt-[30px] pb-[60px]">
        <button className={CRUMB_BTN} onClick={onBack}>← voltar ao Dashboard</button>
        <button className={CRUMB_BTN} onClick={() => onNav("ia")}>perguntar à IA sobre {cat.nome.toLowerCase()} →</button>
      </div>
    </div>
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
      <KpiCockpit R={data} />
      <FolegoCaixa R={data} />
      <GastoPorCategoria R={data} onDrill={setDrillCat} />
      <ExplorarCategoria R={data} onDrill={setDrillCat} />
      <AtividadeSplit R={data} />
      <InconsistenciasSection R={data} onReclassificar={recarregar} />
      <div style={{ padding: "28px 0 60px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="caption" style={{ letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Agregado em runtime (via /api/dashboard)
        </span>
        <button className={CRUMB_BTN} onClick={() => onNav("relatorio")}>ver Relatório editorial →</button>
      </div>
    </div>
  );
}
