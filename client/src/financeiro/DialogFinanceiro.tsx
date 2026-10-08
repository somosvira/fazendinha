import type { TomFinanceiro } from "./financeiro-ui";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function DialogFinanceiro({ titulo, eyebrow, onClose, children, className = "", tom = "info" }: { titulo: string; eyebrow: string; onClose: () => void; children: ReactNode; className?: string; tom?: TomFinanceiro }) {
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent data-fin-tom={tom} className={`financeiro-colorido z-[1200] max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl grid-cols-1 overflow-y-auto ${className}`} overlayClassName="z-[1190]">
      <DialogHeader className="fin-cabecalho border-b border-border p-4 pr-12"><DialogDescription>{eyebrow}</DialogDescription><DialogTitle>{titulo}</DialogTitle></DialogHeader>
      {children}
    </DialogContent>
  </Dialog>;
}
