/* Rio Novo — diálogo de confirmação para ações destrutivas/irreversíveis.
 * shadcn Dialog (Radix) trata Escape / clique-fora / foco-trap; Enter confirma
 * via botão de confirmação autofocado. API pública inalterada. */

import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ConfirmTone = "neutral" | "danger";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "neutral",
  processando = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  processando?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !processando) onCancel();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          confirmRef.current?.focus();
        }}
        overlayClassName="z-[1200]"
        className="z-[1200] gap-0"
      >
        <DialogHeader className="border-b border-[color:var(--rule-soft)] px-[22px] pb-3 pt-[18px]">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="px-[22px] py-4 text-[15px] leading-relaxed text-muted-foreground">
          {message}
        </div>
        <DialogFooter className="border-t border-[color:var(--rule-soft)] px-[22px] pb-[18px] pt-3.5">
          <Button
            variant="outline"
            className="h-auto px-3 py-1.5 text-xs tracking-[0.04em]"
            onClick={onCancel}
            disabled={processando}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={tone === "danger" ? "outline" : "default"}
            className={
              tone === "danger"
                ? "h-auto px-3 py-1.5 text-xs tracking-[0.04em] hover:border-destructive hover:text-destructive"
                : "h-auto px-[22px] py-3 text-[13px] uppercase tracking-[0.08em]"
            }
            onClick={onConfirm}
            disabled={processando}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
