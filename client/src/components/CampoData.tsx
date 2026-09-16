/* CampoData — seletor de uma data (pt-BR) no lugar do <input type="date">,
 * cujo popup de plataforma não segue a identidade visual. O valor continua
 * sendo "YYYY-MM-DD" em fuso local, então quem consome não muda nada.
 * `min`/`max` bloqueiam dias fora do intervalo e `required`/`name` mantêm a
 * validação e o FormData do navegador por meio de um input oculto. */

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatBRDateISO, getHoje, getHojeISO } from "../lib/hoje";
import { CLASSE_ICONE_CAMPO, classeGatilho, type VarianteCampo } from "./campo";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

const pad = (n: number) => String(n).padStart(2, "0");
const paraISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const lerISO = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

export function CampoData({ value, onChange, className, disabled, id, variante, min, max, required, name, "aria-label": ariaLabel, "aria-describedby": ariaDescribedBy, "aria-invalid": ariaInvalid }: {
  value: string;
  onChange: (valor: string) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  /** "sublinhado" para formulários dos módulos operacionais (RebField). */
  variante?: VarianteCampo;
  /** "YYYY-MM-DD" inclusivo, como no input nativo. */
  min?: string;
  max?: string;
  required?: boolean;
  name?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-label": string;
}) {
  const selecionada = lerISO(value);
  const [aberto, setAberto] = useState(false);
  const [mesVisivel, setMesVisivel] = useState(() => selecionada ?? getHoje());

  const alternar = (proximo: boolean) => {
    if (proximo) setMesVisivel(selecionada ?? getHoje());
    setAberto(proximo);
  };
  const escolher = (iso: string) => { onChange(iso); setAberto(false); };
  const moverMes = (delta: number) => setMesVisivel((atual) => new Date(atual.getFullYear(), atual.getMonth() + delta, 1));

  const ano = mesVisivel.getFullYear();
  const mes = mesVisivel.getMonth();
  const primeiro = new Date(ano, mes, 1 - new Date(ano, mes, 1).getDay());
  const dias = Array.from({ length: 42 }, (_, i) => new Date(primeiro.getFullYear(), primeiro.getMonth(), primeiro.getDate() + i));
  const hojeISO = getHojeISO();
  // Comparação lexicográfica vale para "YYYY-MM-DD".
  const foraDoIntervalo = (iso: string) => (!!min && iso < min) || (!!max && iso > max);

  return (
    <Popover open={aberto} onOpenChange={alternar}>
      {(required || name) && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute h-px w-px opacity-0"
          name={name}
          required={required}
          value={value}
          onChange={() => {}}
          onFocus={() => alternar(true)}
        />
      )}
      <PopoverTrigger asChild>
        <button type="button" data-slot="campo-gatilho" id={id} aria-label={ariaLabel} aria-describedby={ariaDescribedBy} aria-invalid={ariaInvalid} disabled={disabled} className={cn(classeGatilho(variante), className)}>
          <span className={cn("truncate tabular-nums", !selecionada && "text-ink-3")}>{selecionada ? formatBRDateISO(value) : "dd/mm/aaaa"}</span>
          <CalendarDays className={CLASSE_ICONE_CAMPO} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="z-[1300] w-[292px] rounded-xl p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="pl-1 font-serif text-[17px] text-foreground">{MESES[mes]} de {ano}</span>
          <div className="flex gap-1">
            <button type="button" aria-label="Mês anterior" onClick={() => moverMes(-1)} className="grid size-8 place-items-center rounded-md text-ink-3 transition hover:bg-muted hover:text-ink">
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Próximo mês" onClick={() => moverMes(1)} className="grid size-8 place-items-center rounded-md text-ink-3 transition hover:bg-muted hover:text-ink">
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {DIAS_SEMANA.map((dia, i) => (
            <div key={i} className="pb-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{dia}</div>
          ))}
          {dias.map((dia) => {
            const iso = paraISO(dia);
            const marcado = iso === value;
            const doMes = dia.getMonth() === mes;
            const bloqueado = foraDoIntervalo(iso);
            return (
              <button
                key={iso}
                type="button"
                aria-label={`${dia.getDate()} de ${MESES[dia.getMonth()]} de ${dia.getFullYear()}`}
                aria-pressed={marcado}
                disabled={bloqueado}
                onClick={() => escolher(iso)}
                className={cn(
                  "grid h-9 place-items-center rounded-md text-sm tabular-nums transition disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent",
                  doMes ? "text-ink" : "text-ink-mute",
                  marcado ? "bg-mast font-semibold text-mast-ink" : "hover:bg-[color:var(--leite-soft)]",
                  !marcado && iso === hojeISO && "font-semibold ring-1 ring-inset ring-leite",
                )}
              >
                {dia.getDate()}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
          {!required && value ? (
            <button type="button" onClick={() => escolher("")} className="rounded-md px-2.5 py-1.5 text-sm font-medium text-ink-3 transition hover:bg-muted hover:text-ink">
              Limpar
            </button>
          ) : <span />}
          <button type="button" disabled={foraDoIntervalo(hojeISO)} onClick={() => escolher(hojeISO)} className="rounded-md px-2.5 py-1.5 text-sm font-semibold text-ink-2 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">
            Hoje
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
