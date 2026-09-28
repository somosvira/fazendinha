/** `true` só quando a query nunca resolveu E está pausada por falta de rede —
 *  não confundir com "carregando" (que resolve sozinho) nem com "erro". */
export function ehOfflineSemDados(query: { isPending: boolean; fetchStatus: string }): boolean {
  return query.isPending && query.fetchStatus === "paused";
}
