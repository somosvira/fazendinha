/* Reconecta a fila: o onlineManager do TanStack detecta online/offline
 * (evento nativo do browser), mas NÃO retoma mutation pausada sozinho —
 * isso é responsabilidade de quem integra (ver query-core/onlineManager).
 * `iniciarRetomadaAutomatica` assina o evento e chama resumePausedMutations()
 * toda vez que a conexão volta durante a sessão. O retorno após reabrir o
 * app (cache restaurado do IndexedDB) é coberto à parte pelo `onSuccess` do
 * PersistQueryClientProvider em main.tsx. Chamar uma única vez no boot. */
import { onlineManager, type QueryClient } from "@tanstack/react-query";

export function iniciarRetomadaAutomatica(queryClient: QueryClient): () => void {
  return onlineManager.subscribe((online) => {
    if (online) queryClient.resumePausedMutations();
  });
}

export { onlineManager };
