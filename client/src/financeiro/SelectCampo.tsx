import { Children, isValidElement, type ReactNode, type AriaAttributes } from "react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Opcao = { value?: string | number; children?: ReactNode; disabled?: boolean };
function opcoesDe(children: ReactNode): Opcao[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<Opcao>(child)) return [];
    return child.type === "option" ? [child.props] : opcoesDe(child.props.children);
  });
}

/** Preserva as opções e os rótulos dos formulários ao compor o Select shadcn. */
export function SelectCampo({ children, value, onValueChange, className, id, name, disabled, required, ...aria }: AriaAttributes & {
  children: ReactNode; value?: string | number; onValueChange?: (valor: string) => void;
  className?: string; id?: string; name?: string; disabled?: boolean; required?: boolean;
}) {
  const vazio = "__sem_valor__";
  return <Select value={String(value ?? "") || vazio} onValueChange={v => onValueChange?.(v === vazio ? "" : v)} name={name} disabled={disabled} required={required}>
    <SelectTrigger value={value} id={id} {...aria} className={cn(className, "flex")}><SelectValue /></SelectTrigger>
    <SelectContent className="z-[1300]">{opcoesDe(children).map(opcao => <SelectItem key={String(opcao.value ?? "")} data-value={String(opcao.value ?? "")} value={String(opcao.value ?? "") || vazio} disabled={opcao.disabled}>{opcao.children}</SelectItem>)}</SelectContent>
  </Select>;
}
