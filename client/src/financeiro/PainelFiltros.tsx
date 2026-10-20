import { ContextoFiltroColuna } from "@/components/ContextoFiltroColuna";
import { useContext, useRef, type ReactNode } from "react";
import { Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import "./painel-filtros.css";
import { Button } from "@/components/ui/button";

/** Campos e intervalos seguem a mesma grade, inclusive nos popovers das colunas. */
export function CampoFiltro({ rotulo, children, inteiro = false }: { rotulo: string; children: ReactNode; inteiro?: boolean }) {
  const naColuna = useContext(ContextoFiltroColuna);
  if (naColuna) return <div className="filtros-campo" data-inteiro={inteiro || undefined}><span>{rotulo}</span>{children}</div>;
  return <label className="filtros-campo" data-inteiro={inteiro || undefined}>{rotulo}{children}</label>;
}
export function GrupoCamposFiltro({ children, titulo }: { children: ReactNode; titulo?: string }) {
  return <div className="filtros-grupo-campos" role={titulo ? "group" : undefined} aria-label={titulo}>
    {titulo && <span className="filtros-grupo-titulo">{titulo}</span>}{children}
  </div>;
}

/** O domínio mantém o rascunho e confirma a consulta por onAplicar quando fornecido. */
export function PainelFiltros({ aberto, onAbertoChange, children, onLimpar, temFiltros, onAplicar, amplo = false, erro }: {
  erro?: string | null;
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  children: ReactNode;
  onLimpar: () => void;
  temFiltros: boolean;
  onAplicar?: () => void;
  amplo?: boolean;
}) {
  const tituloRef = useRef<HTMLHeadingElement>(null);
  return <Dialog open={aberto} onOpenChange={onAbertoChange}>
    <DialogContent onOpenAutoFocus={evento => { evento.preventDefault(); tituloRef.current?.focus({ preventScroll: true }); }} aria-describedby={undefined} overlayClassName="z-[1090]" data-amplo={amplo || undefined} className="financeiro-colorido filtros-modal gap-0 p-0">
      <DialogHeader className="filtros-modal-cabecalho"><DialogTitle ref={tituloRef} tabIndex={-1} className="flex items-center gap-3 outline-none"><Settings2 size={22} className="text-primary" aria-hidden />Filtros</DialogTitle></DialogHeader>
      <div className="filtros-modal-corpo"><div className="filtros-modal-campos">{children}{erro && <p role="alert" className="col-span-full text-sm text-destructive">{erro}</p>}</div></div>
      <DialogFooter className="filtros-modal-rodape">
        <Button type="button" variant="ghost" disabled={!temFiltros} onClick={onLimpar} aria-label="Limpar filtros">Limpar</Button>
        <div className="flex gap-2">
          {onAplicar && <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>}
          {onAplicar ? <Button type="button" disabled={!!erro} onClick={onAplicar}>Aplicar filtros</Button> : <DialogClose asChild><Button type="button">Ver resultados</Button></DialogClose>}
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
