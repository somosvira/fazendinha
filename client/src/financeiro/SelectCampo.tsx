import { ContextoFiltroColuna } from "@/components/ContextoFiltroColuna";
import { ListaOpcoesFiltro } from "@/components/ListaOpcoesFiltro";
import { useContext, Children, isValidElement, type ReactNode, type AriaAttributes } from "react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

type Opcao = { value?: string | number; children?: ReactNode; disabled?: boolean; label?: string };
function textoDe(children: ReactNode): string {
  return Children.toArray(children).map(child => isValidElement<Opcao>(child) ? textoDe(child.props.children) : String(child ?? "")).join("");
}
function valorDe(opcao: Opcao): string {
  return String(opcao.value ?? textoDe(opcao.children));
}
function opcoesDe(children: ReactNode, disabled = false): Opcao[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<Opcao>(child)) return [];
    return child.type === "option" ? [{ ...child.props, disabled: disabled || child.props.disabled }] : opcoesDe(child.props.children, disabled || child.props.disabled);
  });
}
const VAZIO = "__sem_valor__";
function renderOpcoes(children: ReactNode, disabled = false, selecionado = ""): ReactNode {
  return Children.toArray(children).map((child, indice) => {
    if (!isValidElement<Opcao>(child)) return null;
    const bloqueada = disabled || child.props.disabled;
    if (child.type === "option") {
      const valor = valorDe(child.props);
      return <SelectItem key={child.key ?? indice} data-value={valor} data-escolhida={valor === selecionado} value={valor || VAZIO} disabled={bloqueada}>{child.props.children}</SelectItem>;
    }
    const itens = renderOpcoes(child.props.children, bloqueada, selecionado);
    return child.type === "optgroup" ? <SelectGroup key={child.key ?? indice}>{child.props.label && <SelectLabel>{child.props.label}</SelectLabel>}{itens}</SelectGroup> : itens;
  });
}

/** Preserva as opções e os rótulos dos formulários ao compor o Select shadcn. */
export function SelectCampo({ children, value, onValueChange, className, id, name, disabled, required, ...aria }: AriaAttributes & {
  children: ReactNode; value?: string | number; onValueChange?: (valor: string) => void;
  className?: string; id?: string; name?: string; disabled?: boolean; required?: boolean;
}) {
  const naColuna = useContext(ContextoFiltroColuna);
  const opcoes = opcoesDe(children);
  const selecionada = opcoes.find(opcao => valorDe(opcao) === String(value ?? ""));
  if (naColuna) return <ListaOpcoesFiltro rotulo={aria["aria-label"] ?? name ?? "Opções"} opcoes={opcoes.map(o => ({ valor: valorDe(o), texto: textoDe(o.children), disabled: o.disabled }))} valores={[String(value ?? "")]} onChange={v => onValueChange?.(v)} disabled={disabled} />;
  return <Select value={String(value ?? "")} onValueChange={v => onValueChange?.(v === VAZIO ? "" : v)} name={name} disabled={disabled} required={required}>
    <SelectTrigger value={value} id={id} {...aria} className={cn(className, "flex")}><SelectValue placeholder={selecionada?.children}>{selecionada?.children}</SelectValue></SelectTrigger>
    <SelectContent className="z-[1300]">{renderOpcoes(children, false, String(value ?? ""))}</SelectContent>
  </Select>;
}
