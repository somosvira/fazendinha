/* Rio Novo — diálogo de confirmação para ações destrutivas/irreversíveis. */

import { useEffect, useRef } from "react";

export type ConfirmTone = "neutral" | "danger";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "neutral",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div className="confirm-overlay" onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-head" id="confirm-title">{title}</div>
        <div className="confirm-body">{message}</div>
        <div className="confirm-foot">
          <button className="btn-ghost" onClick={onCancel}>{cancelLabel}</button>
          <button
            ref={confirmRef}
            className={tone === "danger" ? "btn-ghost danger" : "btn-primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
