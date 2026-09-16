/* CampoSelect — lista fixa e curta com o visual dos campos do formulário.
 * Usa o Select do Radix (popup estilizável, teclado nativo) e aceita uma
 * explicação curta por opção, mostrada só na lista aberta, e uma prévia
 * lateral (`previa`) da opção destacada pelo mouse ou teclado. O Radix
 * reserva o valor "" para "mostrar placeholder", então uma opção vazia
 * explícita ("Não classificada") é traduzida por uma sentinela. */

import { type ReactNode, useState } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLASSE_GATILHO_CAMPO, CLASSE_ICONE_CAMPO } from "./campo";

export type OpcaoCampo = { value: string; label: string; descricao?: string; disabled?: boolean };

const VALOR_VAZIO = "__vazio__";
const paraRadix = (valor: string) => (valor === "" ? VALOR_VAZIO : valor);
const doRadix = (valor: string) => (valor === VALOR_VAZIO ? "" : valor);

export function CampoSelect({ value, onValueChange, options, placeholder = "Selecione", previa, disabled, id, className, required, name, "aria-label": ariaLabel, "aria-describedby": ariaDescribedBy, "aria-invalid": ariaInvalid }: {
  value: string;
  onValueChange: (valor: string) => void;
  options: readonly OpcaoCampo[];
  placeholder?: string;
  /** Painel ao lado da lista explicando a opção destacada. */
  previa?: (valorDestacado: string) => ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
  required?: boolean;
  name?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-label": string;
}) {
  const [destaque, setDestaque] = useState(value);
  const temOpcaoVazia = options.some((opcao) => opcao.value === "");
  return (
    <SelectPrimitive.Root
      value={temOpcaoVazia ? paraRadix(value) : value}
      onValueChange={(novo) => onValueChange(doRadix(novo))}
      onOpenChange={(aberto) => { if (aberto) setDestaque(value); }}
      disabled={disabled}
      required={required}
      name={name}
    >
      <SelectPrimitive.Trigger id={id} data-slot="campo-gatilho" aria-label={ariaLabel} aria-describedby={ariaDescribedBy} aria-invalid={ariaInvalid} className={cn(CLASSE_GATILHO_CAMPO, "[&>span]:min-w-0 [&>span]:truncate", className)}>
        <SelectPrimitive.Value placeholder={<span className="text-ink-3">{placeholder}</span>} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className={CLASSE_ICONE_CAMPO} aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          data-slot="select-content"
          className={cn(
            "relative z-[1300] flex max-h-[min(420px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-[0_12px_32px_rgba(20,25,26,0.18)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
            previa && "max-w-[min(760px,calc(100vw-24px))]",
          )}
        >
          {/* O Radix fixa flex-direction: column no Content; a linha interna põe a prévia ao lado. */}
          <div className="flex min-h-0 flex-1">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <SelectPrimitive.ScrollUpButton className="flex items-center justify-center py-1 text-ink-3"><ChevronUp className="size-4" /></SelectPrimitive.ScrollUpButton>
              <SelectPrimitive.Viewport className="p-1">
                {options.map((opcao) => (
                  <SelectPrimitive.Item
                    key={opcao.value || VALOR_VAZIO}
                    value={paraRadix(opcao.value)}
                    disabled={opcao.disabled}
                    onFocus={() => setDestaque(opcao.value)}
                    className="relative flex w-full cursor-pointer select-none flex-col rounded-md py-2 pl-3 pr-9 text-sm outline-none transition-colors focus:bg-[color:var(--leite-soft)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[state=checked]:font-semibold"
                  >
                    <SelectPrimitive.ItemText>{opcao.label}</SelectPrimitive.ItemText>
                    {opcao.descricao ? <span className="mt-0.5 max-w-[46ch] text-xs font-normal leading-4 text-ink-3">{opcao.descricao}</span> : null}
                    <SelectPrimitive.ItemIndicator className="absolute right-3 top-2.5">
                      <Check className="size-4 text-outros" aria-hidden="true" />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Viewport>
              <SelectPrimitive.ScrollDownButton className="flex items-center justify-center py-1 text-ink-3"><ChevronDown className="size-4" /></SelectPrimitive.ScrollDownButton>
            </div>
            {previa ? (
              <aside aria-live="polite" className="hidden w-[300px] shrink-0 overflow-y-auto border-l border-border bg-[color:var(--bg)] p-4 sm:block">
                {previa(destaque)}
              </aside>
            ) : null}
          </div>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
