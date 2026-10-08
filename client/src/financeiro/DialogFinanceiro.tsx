import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function DialogFinanceiro({ titulo, eyebrow, onClose, children }: { titulo: string; eyebrow: string; onClose: () => void; children: ReactNode }) {
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="z-[1200] max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl grid-cols-1 overflow-y-auto" overlayClassName="z-[1190]">
      <DialogHeader className="border-b border-border p-4 pr-12"><DialogDescription>{eyebrow}</DialogDescription><DialogTitle>{titulo}</DialogTitle></DialogHeader>
      {children}
    </DialogContent>
  </Dialog>;
}
