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
    window.history.replaceState(window.history.state, "", alvo.pathname + alvo.search + alvo.hash);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
  return { params, atualizar };
}

/** Retorno explícito só aceita fichas locais; nunca redireciona para outra origem. */
export function retornoFichaNutricional() {
  const retorno = new URLSearchParams(window.location.search).get("retorno");
  return retorno && /^\/pecuaria\/rebanho\/(animais|lotes)\/[^/?#]+(?:[?#].*)?$/.test(retorno) ? retorno : null;
}
function preservarOrigemFicha(params: URLSearchParams) {
  if (/^\/pecuaria\/rebanho\/(animais|lotes)\/[^/]+$/.test(window.location.pathname)) {
    params.set("retorno", window.location.pathname + window.location.search + window.location.hash);
  }
}

export function rotaFechamento(id: string, loteId?: string, acao?: "estorno") {
  const params = new URLSearchParams(window.location.search);
  preservarOrigemFicha(params);
  params.set("aba", "fechamentos"); params.set("fechamentoId", id);
  if (loteId) params.set("loteId", loteId);
  if (acao) params.set("acao", acao); else params.delete("acao");
  return `/pecuaria/nutricao?${params}`;
}

export function rotaOperacaoNutricional(acao: "atribuir" | "corrigir" | "consumo", loteId?: string, vigenciaId?: string) {
  const params = new URLSearchParams(window.location.search);
  preservarOrigemFicha(params);
  params.set("acao", acao); params.delete("fechamentoId"); params.delete("vigenciaId");
  if (loteId) params.set("loteId", loteId);
  if (vigenciaId) params.set("vigenciaId", vigenciaId);
  return `/pecuaria/nutricao?${params}`;
}
export function rotaRetornoNutricional() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("acao") === "estorno" && params.get("fechamentoId")) {
    params.delete("acao");
    return `/pecuaria/nutricao?${params}`;
  }
  const retorno = retornoFichaNutricional();
  if (retorno) return retorno;
  if (params.get("fechamentoId")) params.set("aba", "fechamentos");
  ["acao", "fechamentoId", "vigenciaId", "retorno"].forEach((k) => params.delete(k));
  return `/pecuaria/nutricao${params.size ? `?${params}` : ""}`;
}
