/* Sítio ativo (multi-propriedade) — fonte ÚNICA de verdade, compartilhada por
 * todas as camadas de fetch do app (rebanho, financeiro/dashboard, gastos).
 *
 * Vai como header `X-Propriedade-Id` em toda request; `null` = consolidado (sem
 * filtro) / fazenda de 1 sítio (o backend resolve a principal invisivelmente).
 * O seletor do shell (App) grava aqui via setPropriedadeAtiva; cada `req`/`fetch`
 * lê no momento da chamada. Módulo-global proposital: o valor precisa atravessar
 * módulos que não compartilham árvore React. */

let _propriedadeAtiva: number | null = null;

export const setPropriedadeAtiva = (id: number | null) => {
  _propriedadeAtiva = id;
};
export const getPropriedadeAtiva = (): number | null => _propriedadeAtiva;

// Injeta o header de escopo num objeto de headers, sem mutar o original. Com
// escopo consolidado (null) devolve os headers como estão — fazenda de 1 sítio
// nunca envia o header, mantendo retrocompat total das rotas.
export function comPropriedade(
  headers: Record<string, string> = {},
): Record<string, string> {
  return _propriedadeAtiva != null
    ? { ...headers, "X-Propriedade-Id": String(_propriedadeAtiva) }
    : headers;
}
