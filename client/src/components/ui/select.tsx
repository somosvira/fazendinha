/* Select (Radix) — popup estilizado com os tokens editoriais, substituindo o
 * <select> nativo (popup de plataforma impossível de estilizar). Segue o padrão
 * dos demais primitivos: React 18 forwardRef (NÃO ref-as-prop), data-slot,
 * cantos retos (--radius: 0) e paleta papel/tinta. */

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp, Search } from "lucide-react";

import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

function textoSelect(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textoSelect).join(" ");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textoSelect(node.props.children);
  return "";
}
function normalizarBuscaSelect(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}
/** Filtra os itens renderizados, preservando grupos/fragmentos e valores do Root. */
export function filtrarItensSelect(children: React.ReactNode, busca: string): React.ReactNode {
  const termo = normalizarBuscaSelect(busca);
  // Normaliza as chaves também sem termo, evitando remontar a coleção e perder
  // o foco ao digitar a primeira letra ou ao limpar o campo.
  return React.Children.toArray(children).flatMap(child => {
    if (!React.isValidElement<{ children?: React.ReactNode; hidden?: boolean; style?: React.CSSProperties }>(child)) return [child];
    if (child.type === SelectItem) {
      const oculto = child.props.hidden || !normalizarBuscaSelect(textoSelect(child.props.children)).includes(termo);
      // Mantém o Item montado: Radix conserva o rótulo selecionado e a opção
      // nativa do formulário mesmo quando ela não corresponde à busca.
      return [React.cloneElement(child, { hidden: oculto, style: { ...child.props.style, ...(oculto ? { display: "none" } : {}) } })];
    }
    if (child.props.children) {
      const itens = filtrarItensSelect(child.props.children, busca);
      const oculto = child.type === SelectGroup && !temItensSelect(itens);
      return [React.cloneElement(child, { children: itens, ...(oculto ? { hidden: true, style: { ...child.props.style, display: "none" } } : {}) })];
    }
    return [child];
  });
}
function temItensSelect(children: React.ReactNode): boolean {
  return React.Children.toArray(children).some(child => React.isValidElement<{ children?: React.ReactNode; hidden?: boolean }>(child) && !child.props.hidden && (child.type === SelectItem || temItensSelect(child.props.children)));
}

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    data-slot="select-trigger"
    className={cn(
      "flex cursor-pointer items-center justify-between gap-2 border border-border bg-card px-2.5 py-[7px] font-sans text-[13px] font-medium text-foreground transition-colors hover:border-[color:var(--ink-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--leite)] data-[state=open]:border-mast data-[state=open]:ring-2 data-[state=open]:ring-[color:var(--leite)]/35 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center bg-popover py-1", className)}
    {...props}
  >
    <ChevronUp className="h-3.5 w-3.5" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center bg-popover py-1", className)}
    {...props}
  >
    <ChevronDown className="h-3.5 w-3.5" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", onCloseAutoFocus, onKeyDownCapture, ...props }, ref) => {
  const [busca, setBusca] = React.useState("");
  const contentRef = React.useRef<React.ElementRef<typeof SelectPrimitive.Content> | null>(null);
  const buscaRef = React.useRef<HTMLInputElement>(null);
  const itens = filtrarItensSelect(children, busca);
  return <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={elemento => {
        contentRef.current = elemento;
        if (typeof ref === "function") ref(elemento);
        else if (ref) ref.current = elemento;
      }}
      data-slot="select-content"
      position={position}
      className={cn(
        "relative z-50 max-h-[min(320px,var(--radix-select-content-available-height))] min-w-[8rem] overflow-hidden border border-border bg-popover text-popover-foreground shadow-[0_12px_32px_rgba(20,25,26,0.18)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
        className,
      )}
      {...props}
      onCloseAutoFocus={event => { setBusca(""); onCloseAutoFocus?.(event); }}
      onKeyDownCapture={event => {
        onKeyDownCapture?.(event);
        if (event.defaultPrevented || event.target === buscaRef.current) return;
        if (event.key === "Tab" || (event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey) || event.key === "Backspace") {
          event.preventDefault();
          event.stopPropagation();
          if (event.key === "Backspace") setBusca(texto => texto.slice(0, -1));
          else if (event.key !== "Tab") setBusca(texto => texto + event.key);
          buscaRef.current?.focus();
        }
      }}
    >
      <div className="flex items-center gap-2 border-b border-border bg-popover px-3 py-2">
        <Search size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        <input ref={buscaRef} type="search" aria-label="Buscar opções" placeholder="Buscar opção…" autoComplete="off" value={busca}
          onChange={event => setBusca(event.target.value)}
          onPointerDown={event => event.stopPropagation()}
          onKeyDown={event => {
            if (event.key === "Escape") return;
            event.stopPropagation();
            if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Tab") {
              event.preventDefault();
              const opcoes = contentRef.current?.querySelectorAll<HTMLElement>('[role="option"]:not([data-disabled]):not([hidden])');
              const indice = event.key === "ArrowUp" || event.shiftKey ? (opcoes?.length ?? 0) - 1 : 0;
              opcoes?.[indice]?.focus();
            }
          }}
          className="h-8 min-h-0 w-full min-w-0 rounded-md border-0 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
        )}
      >
        {itens}
        {!temItensSelect(itens) && <p role="status" className="px-3 py-5 text-center text-sm text-muted-foreground">Nenhuma opção encontrada.</p>}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>;
});
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3", className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    data-slot="select-item"
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center px-3 py-2 pr-9 font-sans text-[13px] tabular-nums outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[state=checked]:bg-accent data-[state=checked]:font-semibold data-[state=checked]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute right-3 flex h-4 w-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4 stroke-[2.5]" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
