/* Rio Novo — DateRangePicker (cream agro-premium)
 *
 * Fase 3 slice 5: chrome em Tailwind + ui/Popover (Radix cuida de outside
 * click/posicionamento). O calendário pt-BR é próprio (11 presets, "Hoje"
 * pinado) — NÃO adotar react-day-picker; só as classes migraram. */

import { type ReactNode, useMemo, useState } from "react";
import { getHoje } from "../lib/hoje";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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

  const today = startOfDay(getHoje());

  const rangeStart = range.start;
  const rangeEnd = range.end || hoverEnd;
  const hasFullRange = rangeStart && rangeEnd;
  const lo = hasFullRange ? (isBefore(rangeStart, rangeEnd) ? rangeStart : rangeEnd) : null;
  const hi = hasFullRange ? (isBefore(rangeStart, rangeEnd) ? rangeEnd : rangeStart) : null;

  return (
    <div className="flex flex-col">
      <div className="pb-3.5 pt-1 text-center">
        <span className="font-serif text-[17px] tracking-[-0.005em] text-foreground">
          {PT_MONTHS[month]} <span className="tabular-nums text-ink-3">{year}</span>
        </span>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {PT_WEEKDAYS.map((w, i) => (
          <div key={i} className="pb-2 pt-1 text-center font-sans text-[10px] uppercase tracking-[0.18em] text-ink-3">
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
          const isPonta = isStart || isEnd;

          return (
            <button
              key={i}
              type="button"
              className={cn(
                "group/day relative grid h-9 cursor-pointer place-items-center border-0 bg-transparent p-0 font-serif text-[15px] tabular-nums text-foreground",
                (!inMonth || disabled) && "text-[color:var(--ink-mute)]",
                disabled && "cursor-not-allowed",
                // banda do range (pseudo-elemento); nas pontas cobre só meia célula
                (inRange || isPonta) && !(isStart && isEnd) &&
                  "before:absolute before:inset-x-0 before:inset-y-1 before:z-[1] before:bg-card before:content-['']",
                isStart && !isEnd && "before:left-1/2",
                isEnd && !isStart && "before:right-1/2",
              )}
              disabled={!!disabled}
              onClick={() => onPickDay(d)}
              onMouseEnter={() => onHoverDay(d)}
            >
              <span
                className={cn(
                  "relative z-[2] grid h-7 w-7 place-items-center",
                  isToday && "font-medium underline underline-offset-4",
                  isPonta && "bg-mast text-mast-ink",
                  !isPonta && inMonth && !disabled && "group-hover/day:[outline:1px_solid_var(--ink-3)]",
                )}
              >
                {d.getDate()}
              </span>
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
  triggerLabel,
  triggerClassName,
  triggerAriaLabel,
  showPresets = true,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  anchor?: "left" | "right";
  triggerLabel?: ReactNode;
  triggerClassName?: string;
  triggerAriaLabel?: string;
  showPresets?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>({ start: value?.start || null, end: value?.end || null });
  const [hoverEnd, setHoverEnd] = useState<Date | null>(null);
  const today = getHoje();
  const [leftView, setLeftView] = useState<Date>(
    value?.start ? startOfMonth(value.start) : addMonths(startOfMonth(today), -1),
  );
  const rightView = addMonths(leftView, 1);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const presets = useMemo(() => buildPresets(today), []);

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
  const changeOpen = (next: boolean) => {
    if (next) {
      setDraft({ start: value?.start || null, end: value?.end || null });
      setLeftView(value?.start ? startOfMonth(value.start) : addMonths(startOfMonth(today), -1));
      setHoverEnd(null);
    }
    setOpen(next);
  };

  const matchedPreset = useMemo(() => {
    if (!value?.start || !value?.end) return null;
    return presets.find((p) => sameDay(p.range.start, value.start) && sameDay(p.range.end, value.end))?.id || null;
  }, [value, presets]);

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={triggerAriaLabel}
          className={cn("group inline-flex cursor-pointer items-center gap-2.5 border border-border bg-card px-3.5 py-2 font-sans text-sm font-semibold tracking-[0.02em] text-foreground transition-colors hover:border-ink-3 aria-expanded:border-mast aria-expanded:bg-mast aria-expanded:text-mast-ink", triggerClassName)}
        >
          <svg className="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="5" width="18" height="16" rx="1"></rect>
            <line x1="3" y1="10" x2="21" y2="10"></line>
            <line x1="8" y1="3" x2="8" y2="7"></line>
            <line x1="16" y1="3" x2="16" y2="7"></line>
          </svg>
          <span className="font-sans tabular-nums">{triggerLabel ?? formatRangeLabel(value)}</span>
          <span className="text-[10px] text-ink-3 group-aria-expanded:text-[color:var(--mast-ink-2)]">▾</span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align={anchor === "right" ? "end" : "start"}
        sideOffset={6}
        className={cn(
          "w-[min(720px,calc(100vw-24px))] bg-background p-0 shadow-[0_18px_48px_rgba(20,25,26,0.18),0_4px_14px_rgba(20,25,26,0.06)]",
          showPresets ? "grid grid-cols-[180px_1fr]" : "w-[min(540px,calc(100vw-24px))]",
        )}
      >
        {showPresets ? <aside className="flex flex-col border-r border-border bg-card py-4">
          <div className="px-4 pb-3 font-sans text-[10px] uppercase tracking-[0.18em] text-ink-3">Presets</div>
          {presets.map((p) => (
            <button
              key={p.id}
              className={cn(
                "cursor-pointer border-l-2 border-transparent bg-transparent px-4 py-2 text-left font-sans text-sm font-medium tracking-[0.01em] text-ink-2 transition-colors hover:bg-accent hover:text-foreground",
                matchedPreset === p.id && "border-l-foreground bg-accent text-foreground",
              )}
              onClick={() => applyPreset(p)}
            >
              {p.label}
            </button>
          ))}
        </aside> : null}

        <div className="flex flex-col px-5 pt-4">
          <div className="mb-2.5 flex items-center">
            <button
              className="grid h-8 w-8 cursor-pointer place-items-center border border-border bg-card font-serif text-lg text-foreground transition-colors hover:border-mast hover:bg-mast hover:text-mast-ink"
              onClick={() => setLeftView(addMonths(leftView, -1))}
              aria-label="Mês anterior"
            >
              ‹
            </button>
            <div className="flex-1"></div>
            <button
              className="grid h-8 w-8 cursor-pointer place-items-center border border-border bg-card font-serif text-lg text-foreground transition-colors hover:border-mast hover:bg-mast hover:text-mast-ink"
              onClick={() => setLeftView(addMonths(leftView, 1))}
              aria-label="Próximo mês"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-1 gap-7 pb-3.5 sm:grid-cols-2">
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

          <div className="flex flex-col gap-4 border-t border-border py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-[0.18em] text-ink-3">Início</span>
                <span className="font-serif text-[19px] font-medium tabular-nums tracking-[-0.005em] text-foreground">
                  {draft.start ? formatBR(draft.start) : "—"}
                </span>
              </div>
              <div className="pt-3.5 font-serif text-lg text-[color:var(--ink-mute)]">→</div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-[0.18em] text-ink-3">Fim</span>
                <span className="font-serif text-[19px] font-medium tabular-nums tracking-[-0.005em] text-foreground">
                  {draft.end ? formatBR(draft.end) : "—"}
                </span>
              </div>
            </div>
            <div className="flex gap-2.5">
              <Button
                variant="outline"
                className="h-auto px-3.5 py-[9px] text-xs font-normal tracking-[0.04em] text-ink-2 hover:text-ink-2"
                onClick={cancel}
              >
                Cancelar
              </Button>
              <Button
                className="h-auto px-4 py-[9px] text-[13px] font-normal uppercase tracking-[0.08em] disabled:pointer-events-auto disabled:cursor-not-allowed disabled:bg-border disabled:text-[color:var(--ink-mute)] disabled:opacity-100"
                onClick={apply}
                disabled={!(draft.start && draft.end)}
              >
                Aplicar período
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
