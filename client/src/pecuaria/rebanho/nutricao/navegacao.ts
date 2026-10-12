import { useEffect, useState } from "react";

/** Filtros ficam no endereço consultado; Back do detalhe restaura a mesma consulta. */
export function useFiltrosNutricionais() {
  const [params, setParams] = useState(() => new URLSearchParams(window.location.search));
  useEffect(() => {
    const restaurar = () => setParams(new URLSearchParams(window.location.search));
    window.addEventListener("popstate", restaurar);
    return () => window.removeEventListener("popstate", restaurar);
  }, []);
  function atualizar(valores: Record<string, string>) {
    const alvo = new URL(window.location.href);
    Object.entries(valores).forEach(([k, v]) => { if (v) alvo.searchParams.set(k, v); else alvo.searchParams.delete(k); });
    window.history.replaceState(null, "", alvo.pathname + alvo.search);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
  return { params, atualizar };
}

export function rotaFechamento(id: string, loteId?: string, acao?: "estorno") {
  const params = new URLSearchParams(window.location.search);
  params.set("aba", "fechamentos"); params.set("fechamentoId", id);
  if (loteId) params.set("loteId", loteId);
  if (acao) params.set("acao", acao); else params.delete("acao");
  return `/pecuaria/nutricao?${params}`;
}

export function rotaOperacaoNutricional(acao: "atribuir" | "corrigir" | "consumo", loteId?: string, vigenciaId?: string) {
  const params = new URLSearchParams(window.location.search);
  params.set("acao", acao); params.delete("fechamentoId"); params.delete("vigenciaId");
  if (loteId) params.set("loteId", loteId);
  if (vigenciaId) params.set("vigenciaId", vigenciaId);
  return `/pecuaria/nutricao?${params}`;
}
export function rotaRetornoNutricional() {
  const params = new URLSearchParams(window.location.search);
  ["acao", "fechamentoId", "vigenciaId"].forEach((k) => params.delete(k));
  return `/pecuaria/nutricao${params.size ? `?${params}` : ""}`;
}
