import { useEffect, useState } from "react";

export function useTelaPequena(larguraMaxima = 767) {
  const consulta = `(max-width: ${larguraMaxima}px)`;
  const [pequena, setPequena] = useState(() => typeof window !== "undefined" && (typeof window.matchMedia === "function" ? window.matchMedia(consulta).matches : window.innerWidth <= larguraMaxima));
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(consulta);
    const atualizar = () => setPequena(media.matches);
    atualizar();
    media.addEventListener("change", atualizar);
    return () => media.removeEventListener("change", atualizar);
  }, [consulta]);
  return pequena;
}
