/* Seletor de data única no visual do DateRangePicker: campo digitável (dd/mm/aaaa, com as
 * barras inseridas sozinhas) + botão que abre o mesmo calendário, com selects de mês e ano
 * para saltar longe (data de nascimento de anos atrás). Substitui o <input type="date">
 * nativo, que muda de cara a cada navegador. Valor sempre "aaaa-mm-dd" (ou "" vazio). */

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { getHoje } from "../lib/hoje";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarMonth, dateFromIso, isoDate, PT_MONTHS } from "./DateRangePicker";

/** "2026-05-01" → "01/05/2026"; "" → "". */
export function formatarDataDigitada(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : "";
}

/** Texto digitado → "aaaa-mm-dd", ou null se ainda não é uma data completa e válida.
 *  Aceita "dd/mm/aaaa" e também "aaaa-mm-dd" (colar de outro lugar). */
export function interpretarDataDigitada(texto: string): string | null {
  const t = texto.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  const partes = iso ? { a: iso[1], m: iso[2], d: iso[3] } : br ? { a: br[3], m: br[2], d: br[1] } : null;
  if (!partes) return null;
  const data = new Date(Number(partes.a), Number(partes.m) - 1, Number(partes.d));
  if (data.getFullYear() !== Number(partes.a) || data.getMonth() !== Number(partes.m) - 1 || data.getDate() !== Number(partes.d)) return null;
  return `${partes.a}-${partes.m}-${partes.d}`;
}

/** Máscara progressiva: só dígitos, barras depois do dia e do mês ("0105" → "01/05"). */
function mascarar(texto: string): string {
  if (/^\d{4}-/.test(texto)) return texto.slice(0, 10); // ISO colado: deixa como está
  const d = texto.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export function DatePicker({ id, value, onChange, min, max, disabled = false, required, className, ...aria }: {
  id?: string;
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const [texto, setTexto] = useState(() => formatarDataDigitada(value));
  const [aberto, setAberto] = useState(false);
  const selecionada = dateFromIso(value);
  const [vista, setVista] = useState(() => selecionada ?? getHoje());
  const inputRef = useRef<HTMLInputElement>(null);
  const minDate = min ? dateFromIso(min) ?? undefined : undefined;
  const maxDate = max ? dateFromIso(max) ?? undefined : undefined;

  // valor mudou por fora (ex.: entrada = nascimento): reflete no campo, sem atropelar o que
  // está sendo digitado e já corresponde ao mesmo valor
  useEffect(() => {
    if (interpretarDataDigitada(texto) !== (value || null)) setTexto(formatarDataDigitada(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const digitar = (bruto: string) => {
    const mascarado = mascarar(bruto);
    const iso = interpretarDataDigitada(mascarado);
    setTexto(iso && /^\d{4}-/.test(mascarado) ? formatarDataDigitada(iso) : mascarado);
    if (iso) onChange(iso);
    else if (!mascarado) onChange("");
  };

  const escolher = (dia: Date) => {
    const iso = isoDate(dia);
    setTexto(formatarDataDigitada(iso));
    onChange(iso);
    setAberto(false);
    inputRef.current?.focus();
  };

  const abrir = (proximo: boolean) => {
    if (proximo) setVista(dateFromIso(value) ?? (maxDate && maxDate < getHoje() ? maxDate : getHoje()));
    setAberto(proximo);
  };

  const anoAtual = getHoje().getFullYear();
  const anoFinal = maxDate ? maxDate.getFullYear() : anoAtual + 5;
  const anoInicial = minDate ? minDate.getFullYear() : anoAtual - 40;
  const anos: number[] = [];
  for (let a = anoFinal; a >= anoInicial; a--) anos.push(a);
  if (!anos.includes(vista.getFullYear())) anos.push(vista.getFullYear());
  const mudarVista = (ano: number, mes: number) => setVista(new Date(ano, mes, 1));
  const hoje = getHoje();
  const hojePermitido = !(minDate && isoDate(hoje) < isoDate(minDate)) && !(maxDate && isoDate(hoje) > isoDate(maxDate));

  return <div className={cn("relative", className)}>
    <input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="dd/mm/aaaa"
      required={required}
      disabled={disabled}
      value={texto}
      onChange={(e) => digitar(e.target.value)}
      onBlur={() => { if (!interpretarDataDigitada(texto)) setTexto(formatarDataDigitada(value)); }}
      className="block w-full rounded-lg border border-border bg-white p-2.5 pr-11 font-normal tabular-nums disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3 aria-[invalid=true]:border-red-700"
      {...aria}
    />
    <Popover open={aberto} onOpenChange={abrir}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} aria-label="Abrir calendário" className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50">
          <CalendarDays size={17} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(300px,calc(100vw-24px))] bg-background p-4">
        <div className="mb-3 flex items-center gap-1.5">
          <Button type="button" variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => mudarVista(vista.getFullYear(), vista.getMonth() - 1)}><ChevronLeft size={16} /></Button>
          <select aria-label="Mês" value={vista.getMonth()} onChange={(e) => mudarVista(vista.getFullYear(), Number(e.target.value))} className="min-w-0 flex-1 rounded-md border border-border bg-card px-1.5 py-1 font-serif text-[15px]">
            {PT_MONTHS.map((nome, i) => <option key={nome} value={i}>{nome}</option>)}
          </select>
          <select aria-label="Ano" value={vista.getFullYear()} onChange={(e) => mudarVista(Number(e.target.value), vista.getMonth())} className="rounded-md border border-border bg-card px-1.5 py-1 font-serif text-[15px] tabular-nums">
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <Button type="button" variant="ghost" size="icon" aria-label="Próximo mês" onClick={() => mudarVista(vista.getFullYear(), vista.getMonth() + 1)}><ChevronRight size={16} /></Button>
        </div>
        <div data-calendars>
          <CalendarMonth
            hideTitle
            year={vista.getFullYear()}
            month={vista.getMonth()}
            range={{ start: selecionada, end: selecionada }}
            hoverEnd={null}
            minDate={minDate}
            maxDate={maxDate}
            onPickDay={escolher}
            onHoverDay={() => undefined}
            onNavigate={(data) => setVista(new Date(data.getFullYear(), data.getMonth(), 1))}
          />
        </div>
        <div className="mt-3 flex justify-between gap-2 border-t border-border pt-3">
          <Button type="button" variant="ghost" disabled={!value || required} onClick={() => { setTexto(""); onChange(""); setAberto(false); }}>Limpar</Button>
          <Button type="button" variant="outline" disabled={!hojePermitido} onClick={() => escolher(hoje)}>Hoje</Button>
        </div>
      </PopoverContent>
    </Popover>
  </div>;
}
