/* ToolbarSelect — dropdown de filtro de toolbar (pareado com .rb-btn em altura
 * e raio) sobre o primitivo Radix ui/select: estado fechado com o mesmo visual
 * do legado .rb-select, popup estilizado com os tokens (papel/régua) em vez do
 * popup nativo da plataforma.
 *
 * Radix proíbe SelectItem com value="" — mas os call sites usam "" como
 * sentinela de "todos". O wrapper mapeia "" ↔ __vazio__ internamente para
 * preservar a API string dos consumidores. */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const VAZIO = "__vazio__";

export type ToolbarSelectOption = { value: string; label: ReactNode; disabled?: boolean };

export function ToolbarSelect({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder,
  className,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: ToolbarSelectOption[];
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const temVazio = options.some((o) => o.value === "");
  const radixValue = value === "" ? (temVazio ? VAZIO : "") : value;
  // Label renderizado como children do SelectValue: aparece já no SSR/primeiro
  // paint (o Radix só resolve o label do item na hidratação).
  const atual = options.find((o) => o.value === value);
  return (
    <Select value={radixValue} onValueChange={(v) => onChange(v === VAZIO ? "" : v)} disabled={disabled}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(
          "rounded-[8px] bg-transparent px-[13px] py-[7px] text-[14px] font-semibold text-ink-2 hover:border-[color:var(--ink-2)] hover:text-foreground",
          className,
        )}
      >
        <SelectValue placeholder={placeholder}>{atual?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value === "" ? VAZIO : o.value} value={o.value === "" ? VAZIO : o.value} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
