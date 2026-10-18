import { ChevronDown, type LucideIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";

export interface AcaoFicha {
  id: string;
  rotulo: string;
  onSelect: () => void;
  icon?: LucideIcon;
  perigo?: boolean;
  disabled?: boolean;
}

/** Menu por teclado, com foco e fechamento geridos pela primitiva Radix existente. */
export function MenuAcoesFicha({ rotulo = "Mais ações", itens }: { rotulo?: string; itens: AcaoFicha[] }) {
  if (itens.length === 0) return null;
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><button type="button" className="menu-acoes-ficha-gatilho">{rotulo}<ChevronDown size={16} aria-hidden="true" /></button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="menu-acoes-ficha-lista">
      {itens.map(({ id, rotulo: texto, icon: Icon, perigo, disabled, onSelect }) => <DropdownMenuItem key={id} disabled={disabled} onSelect={onSelect} className={perigo ? "text-red-800 focus:text-red-800" : undefined}>{Icon && <Icon size={16} aria-hidden="true" />}{texto}</DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>;
}
