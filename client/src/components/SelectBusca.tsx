/* SelectBusca — seleção única com busca, para listas que crescem (produtos,
 * parceiros, contas, categorias). Mesmo padrão Popover + Command do
 * MultiSelect; a busca ignora acentos e maiúsculas. */

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CLASSE_ICONE_CAMPO, classeGatilho, type VarianteCampo } from "./campo";

export type OpcaoBusca = { value: string; label: string; descricao?: string };

const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const filtrar = (valor: string, busca: string) => (normalizar(valor).includes(normalizar(busca.trim())) ? 1 : 0);
const VALOR_VAZIO = "__vazio__";

export function SelectBusca({ value, onValueChange, options, placeholder = "Selecione", opcaoVazia, buscaPlaceholder = "Buscar…", vazioTexto = "Nenhuma opção encontrada.", disabled, id, className, variante, required, name, "aria-label": ariaLabel, "aria-describedby": ariaDescribedBy, "aria-invalid": ariaInvalid }: {
  value: string;
  onValueChange: (valor: string) => void;
  options: readonly OpcaoBusca[];
  placeholder?: string;
  /** Rótulo de uma opção que devolve "" (ex.: "Sem categoria"). */
  opcaoVazia?: string;
  buscaPlaceholder?: string;
  vazioTexto?: string;
  disabled?: boolean;
  id?: string;
  /** "sublinhado" para formulários dos módulos operacionais (RebField). */
  variante?: VarianteCampo;
  className?: string;
  required?: boolean;
  name?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-label": string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const selecionada = options.find((opcao) => opcao.value === value);
  const rotulo = selecionada?.label ?? (value === "" && opcaoVazia ? opcaoVazia : null);

  const alternar = (proximo: boolean) => { setAberto(proximo); if (!proximo) setBusca(""); };
  const escolher = (novo: string) => { onValueChange(novo); alternar(false); };
  const itens: readonly OpcaoBusca[] = opcaoVazia ? [{ value: VALOR_VAZIO, label: opcaoVazia }, ...options] : options;

  return (
    <Popover open={aberto} onOpenChange={alternar}>
      {/* Input oculto mantém a validação `required` e o FormData do navegador. */}
      {(required || name) && (
        <input tabIndex={-1} aria-hidden="true" className="pointer-events-none absolute h-px w-px opacity-0" name={name} required={required} value={value} onChange={() => {}} onFocus={() => alternar(true)} />
      )}
      <PopoverTrigger asChild>
        <button type="button" role="combobox" data-slot="campo-gatilho" id={id} aria-label={ariaLabel} aria-describedby={ariaDescribedBy} aria-invalid={ariaInvalid} aria-expanded={aberto} disabled={disabled} className={cn(classeGatilho(variante), className)}>
          <span className={cn("min-w-0 truncate", !rotulo && "text-ink-3")}>{rotulo ?? placeholder}</span>
          <ChevronsUpDown className={CLASSE_ICONE_CAMPO} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="z-[1300] w-[var(--radix-popover-trigger-width)] min-w-[260px] overflow-hidden rounded-xl p-0">
        <Command filter={filtrar}>
          <CommandInput value={busca} onValueChange={setBusca} placeholder={buscaPlaceholder} />
          <CommandList className="max-h-72 p-1">
            <CommandEmpty>{vazioTexto}</CommandEmpty>
            <CommandGroup className="p-0">
              {itens.map((opcao) => {
                const valor = opcao.value === VALOR_VAZIO ? "" : opcao.value;
                const marcada = valor === value;
                return (
                  <CommandItem
                    key={opcao.value}
                    value={`${opcao.label} ${opcao.value}`}
                    aria-label={opcao.label}
                    aria-selected={marcada}
                    onSelect={() => escolher(valor)}
                    className={cn("cursor-pointer rounded-md py-2.5 pl-2.5 pr-8", opcao.value === VALOR_VAZIO && "text-ink-3")}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{opcao.label}</span>
                      {opcao.descricao ? <span className="mt-0.5 block text-xs leading-4 text-ink-3">{opcao.descricao}</span> : null}
                    </span>
                    {marcada ? <Check className="absolute right-2.5 size-4 text-outros" aria-hidden="true" /> : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
