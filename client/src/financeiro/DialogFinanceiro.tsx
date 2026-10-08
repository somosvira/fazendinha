import { cn } from "@/lib/utils";
import type { TomFinanceiro } from "./financeiro-ui";
import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const origensDialogo = new WeakMap<HTMLElement, HTMLElement[]>();

export function registrarOrigemDialogo(elemento: HTMLElement | null, acionador: HTMLElement | null) {
  if (elemento && acionador) origensDialogo.set(elemento, [acionador]);
}

export function DialogFinanceiro({ titulo, eyebrow, onClose, children, className = "", tom = "info", rodape }: { titulo: string; eyebrow: string; onClose: () => void; children: ReactNode; className?: string; tom?: TomFinanceiro; rodape?: ReactNode }) {
  const [acionadores] = useState(() => {
    const atual = document.activeElement;
    if (!(atual instanceof HTMLElement)) return [];
    const pai = atual.closest<HTMLElement>('[role="dialog"]');
    return [atual, ...(pai ? origensDialogo.get(pai) ?? [] : [])];
  });
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent ref={elemento => { if (elemento) origensDialogo.set(elemento, acionadores); }} onCloseAutoFocus={event => {
      event.preventDefault();
      requestAnimationFrame(() => {
        // Uma liquidação pode abrir imediatamente depois do detalhe. Nesse caso,
        // o novo diálogo conserva o foco; ao fechar um filho, restauramos no pai.
        const acionador = acionadores.find(elemento => elemento.isConnected && elemento !== document.body);
        const atual = document.activeElement;
        if (atual instanceof HTMLElement && atual.closest('[role="dialog"]') && atual !== acionador) return;
        acionador?.focus();
      });
    }} data-fin-tom={tom} className={cn("financeiro-colorido z-[1200] max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl grid-cols-1 overflow-y-auto", rodape && "flex flex-col overflow-hidden", className)} overlayClassName="z-[1190]">
      <DialogHeader className="fin-cabecalho shrink-0 border-b border-border p-4 pr-12"><DialogDescription>{eyebrow}</DialogDescription><DialogTitle>{titulo}</DialogTitle></DialogHeader>
      {rodape ? <div className="min-h-0 overflow-y-auto">{children}</div> : children}
      {rodape && <div className="shrink-0 border-t border-border bg-card p-3">{rodape}</div>}
    </DialogContent>
  </Dialog>;
}
