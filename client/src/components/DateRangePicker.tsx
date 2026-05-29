/* Rio Novo — DateRangePicker (cream agro-premium) */

import { useEffect, useMemo, useRef, useState } from "react";

const PT_MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const PT_MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const PT_WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const sameDay = (a: Date | null | undefined, b: Date | null | undefined) =>
  !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const isBefore = (a: Date, b: Date) => startOfDay(a).getTime() < startOfDay(b).getTime();
const isAfter = (a: Date, b: Date) => startOfDay(a).getTime() > startOfDay(b).getTime();
const isBetween = (d: Date, a: Date, b: Date) => {
  const t = startOfDay(d).getTime();
  return t >= startOfDay(a).getTime() && t <= startOfDay(b).getTime();
};
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

const formatBR = (d: Date | null) => {
  if (!d) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${PT_MONTHS_SHORT[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
};

export type DateRange = { start: Date | null; end: Date | null };

export const formatRangeLabel = (range: DateRange | null | undefined): string => {
  if (!range || !range.start || !range.end) return "Personalizado";
  if (sameDay(range.start, range.end)) return formatBR(range.start);
  if (
    range.start.getFullYear() === range.end.getFullYear() &&
    range.start.getMonth() === range.end.getMonth()
  ) {
    return `${String(range.start.getDate()).padStart(2, "0")}–${String(range.end.getDate()).padStart(2, "0")} ${PT_MONTHS_SHORT[range.start.getMonth()]}/${String(range.start.getFullYear()).slice(-2)}`;
  }
  return `${formatBR(range.start)} – ${formatBR(range.end)}`;
};

function CalendarMonth({
  year,
  month,
  range,
  hoverEnd,
  onPickDay,
  onHoverDay,
  minDate,
  maxDate,
}: {
  year: number;
  month: number;
  range: DateRange;
  hoverEnd: Date | null;
  onPickDay: (d: Date) => void;
  onHoverDay: (d: Date) => void;
  minDate?: Date;
  maxDate?: Date;
}) {
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const start = new Date(year, month, 1 - startDow);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }

  const today = startOfDay(new Date(2026, 4, 28));

  const rangeStart = range.start;
  const rangeEnd = range.end || hoverEnd;
  const hasFullRange = rangeStart && rangeEnd;
  const lo = hasFullRange ? (isBefore(rangeStart, rangeEnd) ? rangeStart : rangeEnd) : null;
  const hi = hasFullRange ? (isBefore(rangeStart, rangeEnd) ? rangeEnd : rangeStart) : null;

  return (
    <div className="cal-month">
      <div className="cal-month-head">
        <span className="cal-month-name">
          {PT_MONTHS[month]} <span className="cal-year">{year}</span>
        </span>
      </div>
      <div className="cal-grid">
        {PT_WEEKDAYS.map((w, i) => (
          <div key={i} className="cal-wd">
            {w}
          </div>
        ))}
        {days.map((d, i) => {
          const inMonth = d.getMonth() === month;
          const isStart = !!rangeStart && sameDay(d, rangeStart);
          const isEnd = !!range.end && sameDay(d, range.end);
          const inRange = !!(lo && hi) && isBetween(d, lo, hi);
          const isToday = sameDay(d, today);
          const disabled = (minDate && isBefore(d, minDate)) || (maxDate && isAfter(d, maxDate));

          let cls = "cal-day";
          if (!inMonth) cls += " outside";
          if (disabled) cls += " disabled";
          if (isStart) cls += " start";
          if (isEnd) cls += " end";
          if (inRange && !isStart && !isEnd) cls += " in-range";
          if (isToday) cls += " today";

          return (
            <button
              key={i}
              type="button"
              className={cls}
              disabled={!!disabled}
              onClick={() => onPickDay(d)}
              onMouseEnter={() => onHoverDay(d)}
            >
              <span className="cal-day-n">{d.getDate()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function buildPresets(today: Date) {
  const t = startOfDay(today);
  const startOfThisMonth = startOfMonth(t);
  const startOfPrevMonth = startOfMonth(addMonths(t, -1));
  const endOfPrevMonth = endOfMonth(addMonths(t, -1));
  const startOfYear = new Date(t.getFullYear(), 0, 1);
  const start12m = addMonths(startOfMonth(t), -11);
  const start2025 = new Date(2025, 0, 1);
  const end2025 = new Date(2025, 11, 31);
  const startAll = new Date(2024, 6, 1);

  return [
    { id: "today", label: "Hoje", range: { start: t, end: t } },
    { id: "7d", label: "Últimos 7 dias", range: { start: new Date(t.getFullYear(), t.getMonth(), t.getDate() - 6), end: t } },
    { id: "30d", label: "Últimos 30 dias", range: { start: new Date(t.getFullYear(), t.getMonth(), t.getDate() - 29), end: t } },
    { id: "thisMonth", label: "Mês corrente", range: { start: startOfThisMonth, end: t } },
    { id: "lastMonth", label: "Mês passado", range: { start: startOfPrevMonth, end: endOfPrevMonth } },
    { id: "q1", label: "Q1 2026", range: { start: new Date(2026, 0, 1), end: new Date(2026, 2, 31) } },
    { id: "q2", label: "Q2 2026 (até hoje)", range: { start: new Date(2026, 3, 1), end: t } },
    { id: "ytd", label: "Ano corrente (YTD)", range: { start: startOfYear, end: t } },
    { id: "12m", label: "Últimos 12 meses", range: { start: start12m, end: t } },
    { id: "2025", label: "2025 inteiro", range: { start: start2025, end: end2025 } },
    { id: "all", label: "Tudo (desde jul/24)", range: { start: startAll, end: t } },
  ];
}

export function DateRangePicker({
  value,
  onChange,
  anchor = "left",
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  anchor?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>({ start: value?.start || null, end: value?.end || null });
  const [hoverEnd, setHoverEnd] = useState<Date | null>(null);
  const today = new Date(2026, 4, 28);
  const [leftView, setLeftView] = useState<Date>(
    value?.start ? startOfMonth(value.start) : addMonths(startOfMonth(today), -1),
  );
  const rightView = addMonths(leftView, 1);
  const popRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const presets = useMemo(() => buildPresets(today), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popRef.current && !popRef.current.contains(target) && btnRef.current && !btnRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pickDay = (d: Date) => {
    if (!draft.start || (draft.start && draft.end)) {
      setDraft({ start: d, end: null });
      setHoverEnd(null);
    } else {
      if (isBefore(d, draft.start)) {
        setDraft({ start: d, end: draft.start });
      } else {
        setDraft({ start: draft.start, end: d });
      }
      setHoverEnd(null);
    }
  };

  const applyPreset = (p: { range: { start: Date; end: Date } }) => {
    setDraft(p.range);
    setLeftView(startOfMonth(p.range.start));
    setHoverEnd(null);
  };

  const apply = () => {
    if (draft.start && draft.end) {
      onChange(draft);
      setOpen(false);
    }
  };

  const cancel = () => {
    setDraft({ start: value?.start || null, end: value?.end || null });
    setOpen(false);
  };

  const matchedPreset = useMemo(() => {
    if (!value?.start || !value?.end) return null;
    return presets.find((p) => sameDay(p.range.start, value.start) && sameDay(p.range.end, value.end))?.id || null;
  }, [value, presets]);

  return (
    <div className="drp-wrapper">
      <button
        ref={btnRef}
        type="button"
        className="drp-trigger"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg className="drp-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="5" width="18" height="16" rx="1"></rect>
          <line x1="3" y1="10" x2="21" y2="10"></line>
          <line x1="8" y1="3" x2="8" y2="7"></line>
          <line x1="16" y1="3" x2="16" y2="7"></line>
        </svg>
        <span className="drp-label">{formatRangeLabel(value)}</span>
        <span className="drp-chev">▾</span>
      </button>

      {open && (
        <div ref={popRef} className={"drp-pop " + (anchor === "right" ? "anchor-right" : "")}>
          <aside className="drp-presets">
            <div className="drp-presets-head">Presets</div>
            {presets.map((p) => (
              <button
                key={p.id}
                className={"drp-preset " + (matchedPreset === p.id ? "active" : "")}
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </button>
            ))}
          </aside>

          <div className="drp-cals">
            <div className="drp-cals-head">
              <button className="drp-nav" onClick={() => setLeftView(addMonths(leftView, -1))} aria-label="Mês anterior">
                ‹
              </button>
              <div style={{ flex: 1 }}></div>
              <button className="drp-nav" onClick={() => setLeftView(addMonths(leftView, 1))} aria-label="Próximo mês">
                ›
              </button>
            </div>
            <div className="drp-cals-grid">
              <CalendarMonth
                year={leftView.getFullYear()}
                month={leftView.getMonth()}
                range={draft}
                hoverEnd={hoverEnd}
                onPickDay={pickDay}
                onHoverDay={(d) => {
                  if (draft.start && !draft.end) setHoverEnd(d);
                }}
              />
              <CalendarMonth
                year={rightView.getFullYear()}
                month={rightView.getMonth()}
                range={draft}
                hoverEnd={hoverEnd}
                onPickDay={pickDay}
                onHoverDay={(d) => {
                  if (draft.start && !draft.end) setHoverEnd(d);
                }}
              />
            </div>

            <div className="drp-foot">
              <div className="drp-readout">
                <div className="drp-readout-cell">
                  <span className="l">Início</span>
                  <span className="v">{draft.start ? formatBR(draft.start) : "—"}</span>
                </div>
                <div className="drp-readout-sep">→</div>
                <div className="drp-readout-cell">
                  <span className="l">Fim</span>
                  <span className="v">{draft.end ? formatBR(draft.end) : "—"}</span>
                </div>
              </div>
              <div className="drp-actions">
                <button className="btn-ghost" onClick={cancel}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={apply} disabled={!(draft.start && draft.end)}>
                  Aplicar período
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
