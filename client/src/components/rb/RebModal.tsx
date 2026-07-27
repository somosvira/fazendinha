/* Modal/drawer dos módulos operacionais — Fase 5/6 da migração shadcn.
 *
 * Preserva o card centralizado do legado, mas delega semântica, trap e
 * restauração de foco, scroll lock, backdrop e Escape ao Dialog Radix. Muitos
 * forms empilham modais (cadastrar produto a partir de registrar movimento) →
 * `stacked` sobe o card e seu backdrop para que só o diálogo superior interaja.
 *
 * O caller passa `title`, o corpo (children) e `actions` (rodapé à direita). */

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface RebModalProps {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  /** rodapé (botões) — alinhado à direita */
  actions?: React.ReactNode;
  /** modal aninhado (sobe z-index e escurece o backdrop) */
  stacked?: boolean;
  /** largura máxima custom (ex.: sucesso 440, confirmação 460) */
  className?: string;
  /** mostra o X no canto (senão, só fecha pelo backdrop/Esc/botões) */
  showClose?: boolean;
}

export function RebModal({ title, onClose, children, actions, stacked, className, showClose = true }: RebModalProps) {
  const gatilho = React.useRef<HTMLElement | null>(
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );

  function alterarAbertura(open: boolean) {
    if (open) return;
    const focoAnterior = gatilho.current;
    onClose();
    queueMicrotask(() => focoAnterior?.focus());
  }

  return (
    <Dialog open onOpenChange={alterarAbertura}>
      <DialogContent
        showCloseButton={showClose}
        overlayClassName={stacked ? "z-[60] bg-[rgba(14,19,17,.55)]" : "backdrop-blur-[2px]"}
        className={cn(
          "rb-modal-in max-h-[min(86vh,calc(100vh-48px))] w-[min(520px,calc(100vw-32px))] max-w-none gap-0 overflow-y-auto rounded-[12px] border-[color:var(--rule)] bg-[color:var(--bg)] p-7 pb-6 shadow-[0_24px_60px_rgba(0,0,0,.18)] max-[600px]:max-h-[calc(100vh-24px)] max-[600px]:w-[calc(100vw-24px)] max-[600px]:rounded-[10px] max-[600px]:p-5",
          stacked && "z-[61]",
          className,
        )}
      >
        <DialogHeader className="mb-[18px] pr-8">
          <DialogTitle className="m-0 font-serif text-[22px] font-medium">{title}</DialogTitle>
        </DialogHeader>

        {children}

        {actions && <DialogFooter className="mt-[18px] flex-row justify-end gap-2">{actions}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
