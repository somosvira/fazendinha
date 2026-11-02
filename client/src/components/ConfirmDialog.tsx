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
  camada = "padrao",
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  cancelTone = "neutral",
  tone = "neutral",
  processando = false,
  onConfirm,
  onCancel,
  onDismiss,
  dismissLabel,
}: {
  camada?: "padrao" | "sobreDetalhe";
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  cancelTone?: "neutral" | "safe";
  tone?: ConfirmTone;
  processando?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onDismiss?: () => void;
  dismissLabel?: string;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !processando) (onDismiss ?? onCancel)();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          confirmRef.current?.focus();
        }}
        overlayClassName={camada === "sobreDetalhe" ? "z-[1390]" : "z-[1200]"}
        className={camada === "sobreDetalhe" ? "z-[1400] gap-0" : "z-[1200] gap-0"}
      >
        <DialogHeader className="border-b border-border px-5 pb-4 pt-5">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="px-5 py-4 text-[15px] leading-relaxed text-muted-foreground">
          {message}
        </div>
        <DialogFooter className="border-t border-border bg-card px-5 py-4">
          {dismissLabel && onDismiss && <Button variant="ghost" disabled={processando} onClick={onDismiss}>{dismissLabel}</Button>}
          <Button
            variant="outline"
            className={cancelTone === "safe" ? "border-primary text-primary hover:bg-[color:var(--fin-positive-bg)]" : undefined}
            onClick={onCancel}
            disabled={processando}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={tone === "danger" ? "destructive" : "default"}
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
