import { useCallback, useEffect, useState } from "react";

/** Busca de consultas abertas por link, com restauração por avançar/voltar. */
export function useBuscaUrl(parametro?: string) {
  const ler = useCallback(() => parametro ? new URLSearchParams(window.location.search).get(parametro) ?? "" : "", [parametro]);
  const [busca, setBusca] = useState(ler);
  useEffect(() => {
    const restaurar = () => setBusca(ler());
    restaurar();
    if (!parametro) return;
    window.addEventListener("popstate", restaurar);
    return () => window.removeEventListener("popstate", restaurar);
  }, [ler, parametro]);
  const atualizar = useCallback((valor: string) => {
    setBusca(valor);
    if (!parametro) return;
    const url = new URL(window.location.href);
    if (valor) url.searchParams.set(parametro, valor); else url.searchParams.delete(parametro);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [parametro]);
  return [busca, atualizar] as const;
}
