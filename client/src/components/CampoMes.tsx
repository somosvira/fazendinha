/* CampoMes — seletor de mês (pt-BR) no lugar do <input type="month">.
 * O valor continua "YYYY-MM"; `min`/`max` inclusivos como no input nativo. */

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getHoje } from "../lib/hoje";
import { CLASSE_ICONE_CAMPO, classeGatilho, type VarianteCampo } from "./campo";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const lerMes = (valor: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(valor);
  return m ? { ano: Number(m[1]), mes: Number(m[2]) - 1 } : null;
};
const paraValor = (ano: number, mes: number) => `${ano}-${String(mes + 1).padStart(2, "0")}`;

export function CampoMes({ value, onChange, className, disabled, id, variante, min, max, "aria-label": ariaLabel, "aria-describedby": ariaDescribedBy, "aria-invalid": ariaInvalid }: {
  value: string;
  onChange: (valor: string) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  variante?: VarianteCampo;
  min?: string;
  max?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-label": string;
}) {
  const selecionado = lerMes(value);
  const [aberto, setAberto] = useState(false);
  const [ano, setAno] = useState(() => selecionado?.ano ?? getHoje().getFullYear());

  const alternar = (proximo: boolean) => {
    if (proximo) setAno(selecionado?.ano ?? getHoje().getFullYear());
    setAberto(proximo);
  };
  const escolher = (valor: string) => { onChange(valor); setAberto(false); };

  return (
    <Popover open={aberto} onOpenChange={alternar}>
      <PopoverTrigger asChild>
        <button type="button" data-slot="campo-gatilho" id={id} aria-label={ariaLabel} aria-describedby={ariaDescribedBy} aria-invalid={ariaInvalid} disabled={disabled} className={cn(classeGatilho(variante), className)}>
          <span className={cn("truncate tabular-nums", !selecionado && "text-ink-3")}>
            {selecionado ? `${MESES_CURTOS[selecionado.mes]}/${selecionado.ano}` : "mm/aaaa"}
          </span>
          <CalendarDays className={CLASSE_ICONE_CAMPO} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="z-[1300] w-[272px] rounded-xl p-3">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" aria-label="Ano anterior" onClick={() => setAno((a) => a - 1)} className="grid size-8 place-items-center rounded-md text-ink-3 transition hover:bg-muted hover:text-ink">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <span className="font-serif text-[17px] tabular-nums text-foreground">{ano}</span>
          <button type="button" aria-label="Próximo ano" onClick={() => setAno((a) => a + 1)} className="grid size-8 place-items-center rounded-md text-ink-3 transition hover:bg-muted hover:text-ink">
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MESES_CURTOS.map((curto, mes) => {
            const valor = paraValor(ano, mes);
            const marcado = valor === value;
            const bloqueado = (!!min && valor < min) || (!!max && valor > max);
            return (
              <button
                key={valor}
                type="button"
                aria-label={`${MESES[mes]} de ${ano}`}
                aria-pressed={marcado}
                disabled={bloqueado}
                onClick={() => escolher(valor)}
                className={cn(
                  "h-10 rounded-md text-sm capitalize transition disabled:cursor-not-allowed disabled:opacity-35",
                  marcado ? "bg-mast font-semibold text-mast-ink" : "text-ink hover:bg-[color:var(--leite-soft)] disabled:hover:bg-transparent",
                )}
              >
                {curto}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
