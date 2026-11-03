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
        <DialogHeader className="border-b border-border px-5 pb-4 pt-5">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="px-5 py-4">
          {label && (
            <label className="mb-1.5 block text-sm font-medium text-foreground">
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
        <DialogFooter className="border-t border-border bg-card px-5 py-4">
          <Button
            variant="outline"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="default"
            disabled={!trimmed}
            onClick={confirmar}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
