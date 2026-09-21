/* Seletor compartilhado: atalhos no dropdown, calendário somente para personalizar. */

import { type ReactNode, useRef, useState } from "react";
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
  onNavigate,
}: {
  year: number;
  month: number;
  range: DateRange;
  hoverEnd: Date | null;
  onPickDay: (d: Date) => void;
  onHoverDay: (d: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  onNavigate: (date: Date) => void;
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
          if (!inMonth) return <span key={i} aria-hidden="true" className="h-9" />;
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
              aria-label={d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
              aria-pressed={isStart || isEnd}
              data-date={isoDate(d)}
              onKeyDown={(event) => {
                const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -d.getDay(), End: 6 - d.getDay() }[event.key];
                if (event.key === "PageUp" || event.key === "PageDown") { event.preventDefault(); onNavigate(new Date(d.getFullYear(), d.getMonth() + (event.key === "PageUp" ? -1 : 1), 1)); return; }
                if (offset == null) return;
                event.preventDefault();
                const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
                if (minDate && isBefore(next, minDate)) return;
                const target = event.currentTarget.closest("[data-calendars]")?.querySelector<HTMLButtonElement>(`button[data-date="${isoDate(next)}"]:not(:disabled)`);
                if (target) target.focus(); else onNavigate(next);
              }}
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

export const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const dateFromIso = (iso: string) => iso ? new Date(`${iso}T00:00:00`) : null;

export function buildPresets(today: Date) {
  const t = startOfDay(today);
  const year = t.getFullYear();
  const rolling = (months: number) => ({ start: addMonths(t, 1 - months), end: endOfMonth(t) });
  return [
    { id: "today", label: "Hoje", range: { start: t, end: t } },
    { id: "7d", label: "Últimos 7 dias", range: { start: new Date(year, t.getMonth(), t.getDate() - 6), end: t } },
    { id: "30d", label: "Últimos 30 dias", range: { start: new Date(year, t.getMonth(), t.getDate() - 29), end: t } },
    { id: "1", label: "Mês atual", range: { start: startOfMonth(t), end: endOfMonth(t) } },
    { id: "lastMonth", label: "Mês anterior", range: { start: startOfMonth(addMonths(t, -1)), end: endOfMonth(addMonths(t, -1)) } },
    { id: "3", label: "Últimos 3 meses", range: rolling(3) },
    { id: "6", label: "Últimos 6 meses", range: rolling(6) },
    { id: "12m", label: "Últimos 12 meses", range: rolling(12) },
    { id: "24", label: "Últimos 2 anos", range: rolling(24) },
    { id: "ano-atual", label: "Ano atual", range: { start: new Date(year, 0, 1), end: new Date(year, 11, 31) } },
    { id: "ytd", label: "Ano até hoje", range: { start: new Date(year, 0, 1), end: t } },
    { id: "ano-anterior", label: "Ano anterior", range: { start: new Date(year - 1, 0, 1), end: new Date(year - 1, 11, 31) } },
  ];
}

export function DateRangePicker({ value, onChange, anchor = "left", triggerLabel, triggerClassName, triggerAriaLabel = "Período", showPresets = true, allowAll = false }: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  anchor?: "left" | "right";
  triggerLabel?: ReactNode;
  triggerClassName?: string;
  triggerAriaLabel?: string;
  showPresets?: boolean;
  allowAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [custom, setCustom] = useState(!showPresets);
  const [draft, setDraft] = useState<DateRange>(value);
  const [step, setStep] = useState<"start" | "end">("start");
  const [hoverEnd, setHoverEnd] = useState<Date | null>(null);
  const [leftView, setLeftView] = useState(() => startOfMonth(value.start ?? getHoje()));
  const presets = buildPresets(getHoje());
  const matched = presets.find(p => sameDay(p.range.start, value.start) && sameDay(p.range.end, value.end));
  const valid = !!draft.start && !!draft.end && !isAfter(draft.start, draft.end);
  const pickDay = (day: Date) => {
    if (step === "start") { setDraft({ start: day, end: null }); setStep("end"); }
    else if (draft.start && !isBefore(day, draft.start)) { setDraft({ start: draft.start, end: day }); }
    setHoverEnd(null);
  };
  const changeOpen = (next: boolean) => {
    if (next) { setCustom(!showPresets); setDraft(value); setStep("start"); setHoverEnd(null); setLeftView(startOfMonth(value.start ?? getHoje())); }
    setOpen(next);
  };
  const navigate = (date: Date) => {
    if (step === "end" && draft.start && isBefore(date, draft.start)) return;
    setLeftView(startOfMonth(date));
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-calendars] button[data-date="${isoDate(date)}"]:not(:disabled)`)?.focus());
  };
  // O nome do preset sozinho não diz qual intervalo está de fato aplicado —
  // mostra as datas junto (ocultas em telas muito estreitas, onde só o nome
  // já preenche o gatilho) para que o período efetivo fique visível sem abrir.
  const todoPeriodo = !value.start && !value.end && allowAll;
  const rotulo = triggerLabel ?? (todoPeriodo ? "Todo o período"
    : matched ? <>{matched.label}<span className="hidden text-ink-3 sm:inline"> · {formatRangeLabel(value)}</span></>
    : formatRangeLabel(value));
  // O aria-label substitui o texto visível: sem o intervalo aplicado ele deixaria
  // o leitor de tela anunciar só "Período" (WCAG 2.5.3 — Label in Name).
  const textoAplicado = todoPeriodo ? "Todo o período" : matched ? `${matched.label} · ${formatRangeLabel(value)}` : formatRangeLabel(value);
  const nomeAcessivel = triggerLabel ? triggerAriaLabel : `${triggerAriaLabel}: ${textoAplicado}`;
  return <Popover open={open} onOpenChange={changeOpen}>
    <PopoverTrigger asChild><button ref={triggerRef} type="button" aria-label={nomeAcessivel} className={cn("inline-flex min-h-10 max-w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-mast", triggerClassName)}>
      <span className="truncate">{rotulo}</span><span aria-hidden="true">▾</span>
    </button></PopoverTrigger>
    <PopoverContent onCloseAutoFocus={event => { event.preventDefault(); triggerRef.current?.focus(); }} align={anchor === "right" ? "end" : "start"} className={cn("max-h-[min(680px,85vh)] overflow-y-auto bg-background p-4", custom ? "w-[min(540px,calc(100vw-24px))]" : "w-[min(280px,calc(100vw-24px))]")}>
      {!custom ? <div className="flex flex-col gap-1" role="group" aria-label="Períodos predefinidos">
        {allowAll && <Button type="button" variant="ghost" className="justify-start" onClick={() => { onChange({ start: null, end: null }); setOpen(false); }}>Todo o período</Button>}
        {presets.map(p => <Button type="button" variant="ghost" key={p.id} aria-pressed={matched?.id === p.id} className="justify-start" onClick={() => { onChange(p.range); setOpen(false); }}>{p.label}</Button>)}
        <Button type="button" variant="outline" onClick={() => { setCustom(true); setDraft(value); setStep("start"); }}>Período personalizado</Button>
      </div> : <div className="space-y-4">
        <h3 className="font-serif text-xl">Período personalizado</h3>
        <p role="status" className="text-sm text-ink-2">{step === "start" ? "1. Escolha a data inicial." : "2. Escolha a data final, igual ou posterior ao início."}</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">1. Data inicial<input autoFocus type="date" aria-label="Data inicial" value={draft.start ? isoDate(draft.start) : ""} onFocus={() => setStep("start")} onChange={event => { const start = dateFromIso(event.target.value); setDraft({ start, end: draft.end }); if (start) { setStep("end"); setLeftView(startOfMonth(start)); } }} className="mt-1 block min-h-10 w-full rounded-lg border border-border bg-card px-2" /></label>
          <label className="text-sm">2. Data final<input type="date" aria-label="Data final" min={draft.start ? isoDate(draft.start) : undefined} value={draft.end ? isoDate(draft.end) : ""} onFocus={() => setStep("end")} onChange={event => setDraft({ ...draft, end: dateFromIso(event.target.value) })} className="mt-1 block min-h-10 w-full rounded-lg border border-border bg-card px-2" /></label>
        </div>
        <div className="flex justify-between"><Button type="button" variant="outline" aria-label="Mês anterior" onClick={() => setLeftView(addMonths(leftView, -1))}>‹</Button><Button type="button" variant="outline" aria-label="Próximo mês" onClick={() => setLeftView(addMonths(leftView, 1))}>›</Button></div>
        <div data-calendars className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {[leftView, addMonths(leftView, 1)].map(view => <CalendarMonth key={isoDate(view)} year={view.getFullYear()} month={view.getMonth()} range={draft} hoverEnd={hoverEnd} minDate={step === "end" ? draft.start ?? undefined : undefined} onNavigate={navigate} onPickDay={pickDay} onHoverDay={day => { if (step === "end" && draft.start && !isBefore(day, draft.start)) setHoverEnd(day); }} />)}
        </div>
        <p aria-live="polite" className="text-sm tabular-nums">{draft.start ? formatBR(draft.start) : "Início a escolher"} → {draft.end ? formatBR(draft.end) : "Fim a escolher"}</p>
        {draft.start && draft.end && !valid && <p role="alert" className="text-sm text-red-800">A data final deve ser igual ou posterior à data inicial.</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="button" disabled={!valid} onClick={() => { if (valid) { onChange(draft); setOpen(false); } }}>Aplicar período</Button></div>
      </div>}
    </PopoverContent>
  </Popover>;
}
