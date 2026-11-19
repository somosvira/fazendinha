import { useEffect } from "react";
const chave = (usuarioId: number) => `terrano:tablet:sitio:${usuarioId}`;
export function lerSitioTablet(usuarioId?: number): number | null {
  if (!usuarioId) return null;
  try {
    const valor = Number(localStorage.getItem(chave(usuarioId)));
    return Number.isInteger(valor) && valor > 0 && valor <= 2147483647 ? valor : null;
  } catch { return null; }
}
export function MemorizarSitioTablet({ usuarioId, sitio }: { usuarioId: number; sitio: number }) {
  useEffect(() => {
    try { localStorage.setItem(chave(usuarioId), String(sitio)); } catch { /* A operação continua se o navegador bloquear armazenamento. */ }
  }, [usuarioId, sitio]);
  return null;
}
