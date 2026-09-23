import { useId, useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type MultiSelectValue = string | number;
export type MultiSelectOption<T extends MultiSelectValue = MultiSelectValue> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export function MultiSelect<T extends MultiSelectValue>({
  label,
  helpText,
  error,
  contentClassName,
  placeholder = "Todas as opções",
  searchPlaceholder = "Buscar opção…",
  emptyText = "Nenhuma opção encontrada.",
  options,
  value,
  onValueChange,
  disabled = false,
}: {
  label: string;
  helpText?: string;
  /** Mensagem de erro do campo — anunciada com role="alert" logo abaixo do controle. */
  error?: string;
  /** Classes extras do PopoverContent (ex.: `z-[1200]` quando o campo vive dentro de um painel/modal). */
  contentClassName?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  options: readonly MultiSelectOption<T>[];
  value: readonly T[];
  onValueChange: (value: T[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const helpId = useId();
  const errorId = useId();
  const selected = useMemo(() => new Set(value), [value]);
  const optionByValue = useMemo(() => new Map(options.map((option) => [option.value, option])), [options]);
  const selectedOptions = value.flatMap((item) => {
    const option = optionByValue.get(item);
    return option ? [option] : [];
  });

  const toggle = (item: T) => {
    onValueChange(selected.has(item) ? value.filter((valueItem) => valueItem !== item) : [...value, item]);
  };
  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) setSearch("");
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[.12em] text-ink-3">{label}</div>
        {value.length > 0 ? (
          <button type="button" onClick={() => onValueChange([])} className="text-xs font-semibold text-green-800 hover:underline">
            Limpar ({value.length})
          </button>
        ) : null}
      </div>

      <Popover open={open} onOpenChange={changeOpen}>
        <div
          data-slot="multi-select-control"
          className={cn(
            "relative flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-lg border bg-white p-1.5 pl-2.5 pr-10 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring",
            error ? "border-red-700" : "border-border",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          {selectedOptions.map((option) => (
            <span key={String(option.value)} className="relative z-10 inline-flex max-w-full items-center gap-1 rounded-full border border-[#bcc8b7] bg-[#eef1e9] py-1 pl-2.5 pr-1 text-xs font-medium text-ink-2">
              <span className="max-w-52 truncate">{option.label}</span>
              <button
                type="button"
                aria-label={`Remover ${option.label}`}
                disabled={disabled}
                onClick={() => toggle(option.value)}
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-white hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          ))}
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={label}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : helpText ? helpId : undefined}
              aria-expanded={open}
              disabled={disabled}
              className="absolute inset-0 z-0 flex w-full items-center justify-between gap-3 rounded-md px-3 text-left outline-none disabled:cursor-not-allowed"
            >
              {value.length === 0 ? <span className="truncate text-ink-3">{placeholder}</span> : <span className="sr-only">{value.length} {value.length === 1 ? "selecionado" : "selecionados"}</span>}
              <ChevronsUpDown className="ml-auto size-4 shrink-0 text-ink-3" aria-hidden="true" />
            </button>
          </PopoverTrigger>
        </div>
        <PopoverContent align="start" className={cn("w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0", contentClassName)}>
          <Command>
            <CommandInput value={search} onValueChange={setSearch} placeholder={searchPlaceholder} />
            <CommandList className="max-h-64">
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const checked = selected.has(option.value);
                  return (
                    <CommandItem
                      key={String(option.value)}
                      value={`${option.label} ${String(option.value)}`}
                      disabled={option.disabled}
                      aria-label={option.label}
                      aria-selected={checked}
                      onSelect={() => toggle(option.value)}
                      className="cursor-pointer py-2.5"
                    >
                      <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-[3px] border", checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-white")}>
                        {checked ? <Check className="size-3" aria-hidden="true" /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {error ? <p id={errorId} role="alert" className="mt-1.5 text-xs text-red-700">{error}</p> : null}
      {helpText ? <p id={helpId} className="mt-1.5 text-xs leading-5 text-ink-3">{helpText}</p> : null}
    </div>
  );
}
