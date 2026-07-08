/* Rio Novo — primitivas editoriais do Relatório/Dashboard (Fase 2 shadcn).
 *
 * Layout puro, sem estado. Duas categorias de estilo:
 *  - CSS monopolizado pelo Relatório (kpi-hero, section-head, answer/activity/
 *    unit/dual-stat/two-up) → reescrito em Tailwind + tokens do theme.css.
 *  - Classes ainda COMPARTILHADAS por outras telas (.legend*, .eyebrow, .caption,
 *    .footnote, .mono-nums) → reaproveitadas via className; só saem na fase que
 *    migrar o último consumidor (playbook §5).
 *
 * Cores editoriais viram tokens: text-ink-2/ink-3, text-lucro/prejuizo, bg-card.
 * --rule-soft/--bg-card-2/--ink não têm token → arbitrary value var(--…). */

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ── Section: <section> editorial com regra inferior (report-section) ── */
export function Section({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("border-b border-[color:var(--rule-soft)] pt-9 pb-1", className)}>
      {children}
    </section>
  );
}

/* ── SectionHead: § numeral · título serif · lede itálica · slot direito ── */
export function SectionHead({
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
    <div className="mb-[22px] grid grid-cols-[auto_1fr_auto] items-baseline gap-6">
      <span className="font-serif text-base font-medium tabular-nums text-ink-2">§ {num}</span>
      <div>
        <h2 className="font-serif text-[30px] font-medium leading-[1.15] tracking-[-0.01em] text-foreground">
          {title}
        </h2>
        {lede && (
          <p className="mt-2.5 max-w-[56ch] font-serif text-[19px] font-medium italic leading-[1.45] text-ink-2">
            {lede}
          </p>
        )}
      </div>
      <div>{right}</div>
    </div>
  );
}

/* ── KPI hero row: 4 células com regras superior/inferior ── */
export function KpiRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-4 border-y border-border">{children}</div>;
}

export function KpiTile({
  label,
  value,
  negative,
  delta,
  note,
}: {
  label: string;
  value: string;
  negative?: boolean;
  delta: { up: boolean; good: boolean; text: string; title?: string };
  note: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 border-r border-[color:var(--rule-soft)] px-6 pt-6 pb-[22px] last:border-r-0">
      <span className="eyebrow mb-1.5">{label}</span>
      <div
        className={cn(
          "font-serif text-[44px] font-medium leading-none tracking-[-0.02em] tabular-nums",
          negative ? "text-prejuizo" : "text-foreground",
        )}
      >
        {value}
      </div>
      <div
        className={cn(
          "flex items-center gap-2 text-[15px] font-semibold tabular-nums",
          delta.good ? "text-lucro" : "text-prejuizo",
        )}
        title={delta.title}
      >
        <span className="font-serif">{delta.up ? "▲" : "▼"}</span>
        <span>{delta.text}</span>
      </div>
      <div className="mt-1.5 text-[14px] font-medium text-ink-2">{note}</div>
    </div>
  );
}

/* ── ChartLegend: reaproveita .legend/.legend-dot/-line/-dash (compartilhadas) ── */
export function ChartLegend({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("legend", className)}>{children}</div>;
}

export function LegendItem({
  mark = "dot",
  color,
  opacity,
  dashedBorder,
  children,
}: {
  mark?: "dot" | "line" | "dash";
  color?: string;
  opacity?: number;
  dashedBorder?: boolean;
  children: ReactNode;
}) {
  const cls = mark === "line" ? "legend-line" : mark === "dash" ? "legend-dash" : "legend-dot";
  const style: CSSProperties = {};
  if (mark === "dash") style.color = color;
  else style.background = color;
  if (opacity != null) style.opacity = opacity;
  if (dashedBorder) style.border = `1px dashed ${color}`;
  return (
    <span>
      <span className={cls} style={style} /> {children}
    </span>
  );
}

/* ── SplitBar: barra horizontal segmentada (cat-bar/atv-bar/forn-mini-bar) ──
 * `width` = fração preenchida do trilho (0–100); cada segmento é uma fração
 * INTERNA dessa faixa. Trilho é sempre --rule-soft; altura via className. */
export function SplitBar({
  segments,
  width = 100,
  className,
}: {
  segments: { pct: number; color: string; opacity?: number }[];
  width?: number;
  className?: string;
}) {
  return (
    <div className={cn("relative h-2.5 bg-[var(--rule-soft)]", className)}>
      <div className="absolute inset-0 flex" style={{ width: `${width}%` }}>
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${s.pct}%`, background: s.color, opacity: s.opacity }} />
        ))}
      </div>
    </div>
  );
}

/* ── UnitCard: cartão de custo por unidade (stripe + headline + trio de cells) ── */
export function UnitCard({
  accent,
  eyebrow,
  headline,
  cells,
  caption,
}: {
  accent: string;
  eyebrow: string;
  headline: string;
  cells: { label: string; value: string; pos?: boolean }[];
  caption: string;
}) {
  return (
    <div className="flex items-stretch gap-7 bg-card p-7">
      <div className="w-1 self-stretch" style={{ background: accent }} />
      <div className="flex flex-1 flex-col gap-3">
        <span className="eyebrow">{eyebrow}</span>
        <div className="font-serif text-[22px] font-medium tracking-[-0.005em] text-foreground">
          {headline}
        </div>
        <div className="mt-2 grid grid-cols-[repeat(3,auto)] gap-x-8 gap-y-1.5">
          {cells.map((c, i) => (
            <div key={i} className="flex flex-col gap-1">
              <span className="text-[14px] font-semibold uppercase tracking-[0.12em] text-ink-2">
                {c.label}
              </span>
              <span
                className={cn(
                  "font-serif text-[28px] font-medium tabular-nums tracking-[-0.01em]",
                  c.pos ? "text-lucro" : "text-foreground",
                )}
              >
                {c.value}
              </span>
            </div>
          ))}
        </div>
        <div className="caption mt-2.5">{caption}</div>
      </div>
    </div>
  );
}

/* ── ActivityCard: comparação Leite/Café/Outros lado a lado ── */
function ActivityStat({
  label,
  value,
  invest,
}: {
  label: string;
  value: string;
  invest?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-3">
      <span className="text-[15px] font-medium text-ink-2">{label}</span>
      <span
        className={cn(
          "font-serif text-[22px] font-medium tabular-nums tracking-[-0.005em]",
          invest ? "italic text-ink-2" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function ActivityCard({
  color,
  nome,
  pctReceita,
  receita,
  custeio,
  investimento,
  margemOp,
  volume,
  fmt,
}: {
  color: string;
  nome: string;
  pctReceita: number;
  receita: string;
  custeio: string;
  investimento: string;
  margemOp: number;
  volume: { label: string; value: string; subtitle: string };
  fmt: (n: number) => string;
}) {
  const isNeg = margemOp < 0;
  return (
    <div className="relative flex flex-col gap-3.5 bg-card px-6 pt-6 pb-[26px]">
      <div className="flex items-center gap-2.5 border-b border-[color:var(--rule-soft)] pb-3.5">
        <span className="inline-block h-[18px] w-[18px]" style={{ background: color }} />
        <span className="font-serif text-[22px] tracking-[-0.005em] text-foreground">{nome}</span>
        <span className="ml-auto text-[14px] font-semibold tabular-nums tracking-[0.04em] text-ink-2">
          {pctReceita}% da receita
        </span>
      </div>

      <ActivityStat label="Receita" value={receita} />
      <ActivityStat label="Custeio" value={custeio} />
      <ActivityStat label="Investimento" value={investimento} invest />

      <div className="mt-1.5 flex items-baseline justify-between border-t border-[color:var(--rule-soft)] pt-3.5">
        <span className="text-[14px] font-semibold uppercase tracking-[0.12em] text-ink-2">
          Margem op.
        </span>
        <span
          className="font-serif text-[20px] font-medium tabular-nums"
          style={{ color: isNeg ? "var(--prejuizo)" : "var(--lucro)" }}
        >
          {margemOp >= 0 ? "+" : ""}
          {fmt(margemOp)}
        </span>
      </div>

      <div className="flex flex-col gap-1 border-t border-[color:var(--rule-soft)] pt-3">
        <span className="eyebrow">{volume.label}</span>
        <span className="font-serif text-[18px] text-foreground">{volume.value}</span>
        <span className="text-[12px] text-ink-3">{volume.subtitle}</span>
      </div>
    </div>
  );
}

/* ── AlertCard: cartão de alerta (stripe colorido + CTA). NB: a classe legada
 * .alert-card segue viva em IA.tsx — aqui é Tailwind puro, não deletar o CSS. ── */
export function AlertCard({
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
  const stripe =
    tone === "neg" ? "var(--prejuizo)" : tone === "pos" ? "var(--lucro)" : "var(--atencao)";
  return (
    <div className="grid grid-cols-[4px_1fr_auto] items-start gap-4 border border-border bg-[var(--bg-card-2)] px-5 py-[18px]">
      <div className="self-stretch" style={{ background: stripe }} />
      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">{eyebrow}</span>
        <div className="font-serif text-[19px] font-medium leading-[1.3] text-foreground">
          {title}
        </div>
      </div>
      <button
        onClick={onCta}
        className="cursor-pointer self-end py-1.5 text-base font-semibold tracking-[0.02em] text-foreground underline underline-offset-4"
      >
        {ctaText} →
      </button>
    </div>
  );
}
