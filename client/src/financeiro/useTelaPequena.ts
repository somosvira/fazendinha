import { useEffect, useState } from "react";

export function useTelaPequena() {
  const [pequena, setPequena] = useState(() => typeof window !== "undefined" && (typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 767px)").matches : window.innerWidth < 768));
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 767px)");
    const atualizar = () => setPequena(media.matches);
    atualizar();
    media.addEventListener("change", atualizar);
    return () => media.removeEventListener("change", atualizar);
  }, []);
  return pequena;
}
