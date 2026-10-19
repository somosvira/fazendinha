import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

/** O domínio mantém o rascunho e confirma a consulta por onAplicar quando fornecido. */
export function PainelFiltros({ aberto, onAbertoChange, children, onLimpar, temFiltros, onAplicar }: {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  children: ReactNode;
  onLimpar: () => void;
  temFiltros: boolean;
  onAplicar?: () => void;
}) {
  return <Sheet open={aberto} onOpenChange={onAbertoChange}>
    <SheetContent aria-describedby={undefined} side="right" overlayClassName="z-[1090]" className="financeiro-colorido z-[1100] flex w-full flex-col gap-0 p-0 sm:max-w-xl">
      <SheetHeader className="border-b border-border p-5 pr-12"><SheetTitle>Filtros</SheetTitle></SheetHeader>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 [&>label]:grid [&>label]:gap-1 [&>label>button]:mt-0">{children}</div>
      <SheetFooter className="shrink-0 flex-row flex-wrap gap-2 justify-between border-t border-border p-5">
        <Button type="button" variant="ghost" disabled={!temFiltros} onClick={onLimpar}>Limpar filtros</Button>
        <div className="flex gap-2">
          {onAplicar && <SheetClose asChild><Button type="button" variant="outline">Cancelar</Button></SheetClose>}
          {onAplicar ? <Button type="button" onClick={onAplicar}>Aplicar filtros</Button> : <SheetClose asChild><Button type="button">Ver resultados</Button></SheetClose>}
        </div>
      </SheetFooter>
    </SheetContent>
  </Sheet>;
}
