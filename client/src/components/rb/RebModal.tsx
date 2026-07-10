/* Modal/drawer dos módulos operacionais — Fase 5/6 da migração shadcn.
 *
 * Reproduz .rb-drawer-bg + .rb-drawer + .rb-drawer-actions (rebanho.css) em
 * Tailwind, SEM Radix Dialog: o padrão legado é um card centralizado com
 * backdrop (blur) e animações próprias (rb-fade-in / rb-modal-in — mantidas no
 * CSS, são keyframes). Muitos forms empilham modais (cadastrar produto a partir
 * de registrar movimento) → prop `stacked` sobe o z-index e escurece o backdrop.
 *
 * Valores 1:1: backdrop rgba(14,19,17,.45) blur(2px) z-10; card 520px, radius
 * 12, padding 28/28/24, max-h 86vh, shadow. Fecha no clique do backdrop e no Esc.
 * O caller passa `title`, o corpo (children) e `actions` (rodapé à direita). */

import * as React from "react";
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
  // Fecha no Esc (paridade com o comportamento esperado de modal).
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div
        className={cn(
          "rb-fade-in fixed inset-0 backdrop-blur-[2px]",
          stacked ? "z-20 bg-[rgba(14,19,17,.55)]" : "z-10 bg-[rgba(14,19,17,.45)]",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "rb-modal-in fixed left-1/2 top-1/2 z-[11] max-h-[min(86vh,calc(100vh-48px))] w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[12px] border border-[color:var(--rule)] bg-[color:var(--bg)] p-7 pb-6 shadow-[0_24px_60px_rgba(0,0,0,.18)] max-[600px]:max-h-[calc(100vh-24px)] max-[600px]:w-[calc(100vw-24px)] max-[600px]:rounded-[10px] max-[600px]:p-5",
          stacked && "z-[21]",
          className,
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-[18px] flex items-start justify-between gap-3">
          <h3 className="m-0 flex-1 font-serif text-[22px] font-medium">{title}</h3>
          {showClose && (
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className="-mr-1.5 -mt-1.5 flex h-8 w-8 flex-none items-center justify-center rounded-md border-0 bg-transparent font-sans text-2xl leading-none text-ink-3 transition-colors hover:bg-[color:var(--bg-card-2)] hover:text-[color:var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cafe"
            >
              ×
            </button>
          )}
        </div>

        {children}

        {actions && <div className="mt-[18px] flex justify-end gap-2">{actions}</div>}
      </aside>
    </>
  );
}
