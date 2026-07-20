/* Rio Novo — diálogo de entrada de texto (substitui window.prompt()).
 * Irmão do ConfirmDialog: mesmo shadcn Dialog (Radix) — trata Escape / clique-fora /
 * foco-trap. O input recebe autofocus; Enter confirma quando o valor não está vazio.
 * onConfirm recebe o texto já trimado. */

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PromptDialog({
  open,
  title,
  label,
  placeholder,
  initialValue = "",
  confirmLabel = "Salvar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  label?: React.ReactNode;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialValue);

  // Reseta o campo sempre que o diálogo reabre (evita vazar o texto anterior).
  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  const trimmed = value.trim();

  function confirmar() {
    if (!trimmed) return;
    onConfirm(trimmed);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
          inputRef.current?.select();
        }}
        className="gap-0"
      >
        <DialogHeader className="border-b border-[color:var(--rule-soft)] px-[22px] pb-3 pt-[18px]">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="px-[22px] py-4">
          {label && (
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              {label}
            </label>
          )}
          <Input
            ref={inputRef}
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmar();
              }
            }}
          />
        </div>
        <DialogFooter className="border-t border-[color:var(--rule-soft)] px-[22px] pb-[18px] pt-3.5">
          <Button
            variant="outline"
            className="h-auto px-3 py-1.5 text-xs tracking-[0.04em]"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="default"
            disabled={!trimmed}
            className="h-auto px-[22px] py-3 text-[13px] uppercase tracking-[0.08em]"
            onClick={confirmar}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
