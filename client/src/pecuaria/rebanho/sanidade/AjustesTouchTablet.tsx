import { useEffect } from "react";

/** Mantém portais e listas dentro da área visível quando o teclado móvel abre. */
export function AjustesTouchTablet() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const raiz = document.documentElement;
    let quadro = 0;
    const atualizar = () => {
      raiz.style.setProperty("--tablet-area-altura", `${viewport.height}px`);
      raiz.style.setProperty("--tablet-area-centro", `${viewport.offsetTop + viewport.height / 2}px`);
    };
    const redimensionar = () => {
      atualizar();
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const campo = document.activeElement;
        if (campo instanceof HTMLElement && campo.matches("input:not([readonly]),textarea") && campo.closest(".tablet-aplicacao,.tablet-dialogo,.tablet-medicamentos-dropdown,.tablet-horario-popup,.tablet-calendario"))
          campo.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
    };
    atualizar();
    viewport.addEventListener("resize", redimensionar);
    viewport.addEventListener("scroll", atualizar);
    return () => {
      cancelAnimationFrame(quadro);
      viewport.removeEventListener("resize", redimensionar);
      viewport.removeEventListener("scroll", atualizar);
      raiz.style.removeProperty("--tablet-area-altura");
      raiz.style.removeProperty("--tablet-area-centro");
    };
  }, []);
  return null;
}
