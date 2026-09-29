/** `true` quando a query não tem dado próprio e está pausada por falta de rede —
 *  não confundir com "carregando" (que resolve sozinho) nem com "erro".
 *  Dado emprestado por `keepPreviousData` (`isPlaceholderData`) não conta como dado. */
export function ehOfflineSemDados(query: { isPending: boolean; isPlaceholderData?: boolean; fetchStatus: string }): boolean {
  return (query.isPending || query.isPlaceholderData === true) && query.fetchStatus === "paused";
}
