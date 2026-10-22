import { useRef } from "react";

/** Também cobre diálogos controlados que não usam o Trigger do Radix. */
export function useRetornoFocoDialogo(onOpenAutoFocus?: (evento: Event) => void, onCloseAutoFocus?: (evento: Event) => void) {
  const origem = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus(evento: Event) {
      const ativo = document.activeElement;
      origem.current = ativo instanceof HTMLElement && ativo !== document.body ? ativo : null;
      onOpenAutoFocus?.(evento);
    },
    onCloseAutoFocus(evento: Event) {
      onCloseAutoFocus?.(evento);
      const alvo = origem.current;
      if (!evento.defaultPrevented && alvo?.isConnected && !alvo.matches(":disabled") && !alvo.closest("[inert]")) {
        evento.preventDefault();
        alvo.focus({ preventScroll: true });
      }
    },
  };
}
