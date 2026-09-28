/* Sítio ativo (multi-propriedade) — fonte ÚNICA de verdade, compartilhada por
 * todas as camadas de fetch do app (rebanho, financeiro/dashboard, gastos).
 *
 * Vai como header `X-Propriedade-Id` em toda request; `null` = consolidado (sem
 * filtro) / fazenda de 1 sítio (o backend resolve a principal invisivelmente).
 * O seletor do shell (App) grava aqui via setPropriedadeAtiva; cada `req`/`fetch`
 * lê no momento da chamada. Módulo-global proposital: o valor precisa atravessar
 * módulos que não compartilham árvore React.
 *
 * `comPropriedade` também compõe o header `Authorization` do lib/auth (piloto):
 * um único helper cuida do envelope padrão de toda request pra API. */

import { comAuth } from "./lib/auth";

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
  return comPropriedadeExplicita(_propriedadeAtiva, headers);
}

// Igual a `comPropriedade`, mas com o sítio explícito em vez de ler o ativo no
// momento da chamada — usado pela fila de escrita offline, que grava o sítio
// no item ao enfileirar (ver fila.ts) para não reenviar no sítio errado se o
// usuário trocar de sítio antes da reconexão.
export function comPropriedadeExplicita(
  propriedadeId: number | null,
  headers: Record<string, string> = {},
): Record<string, string> {
  const base = comAuth(headers);
  return propriedadeId != null
    ? { ...base, "X-Propriedade-Id": String(propriedadeId) }
    : base;
}
