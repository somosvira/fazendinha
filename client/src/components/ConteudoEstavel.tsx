import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Reserva a altura anterior apenas durante uma consulta. Não conserva dados antigos. */
export function ConteudoEstavel({ contexto, children }: { contexto: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const altura = useRef(0);
  useLayoutEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;
    const sincronizar = () => {
      if (elemento.querySelector('[aria-busy="true"]')) {
        if (altura.current > 0) elemento.style.minHeight = `${altura.current}px`;
      } else {
        elemento.style.removeProperty("min-height");
        altura.current = elemento.getBoundingClientRect().height;
      }
    };
    sincronizar();
    const mutacoes = new MutationObserver(sincronizar);
    mutacoes.observe(elemento, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-busy"] });
    const tamanho = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(sincronizar);
    tamanho?.observe(elemento);
    return () => { mutacoes.disconnect(); tamanho?.disconnect(); };
  }, [contexto]);
  return <div ref={ref} className="min-w-0">{children}</div>;
}
