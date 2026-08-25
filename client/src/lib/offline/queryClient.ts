/* Fundação offline (Fatia 1 do plano — ver OFFLINE_STRATEGY.md na raiz).
 *
 * QueryClient único do app. `networkMode` fica no default ("online") de
 * propósito: sem service worker/cache HTTP na frente da API, tentar a
 * mutação mesmo sabendo que está offline (modo "offlineFirst") só gastaria
 * um round-trip fadado a falhar. No modo default, o TanStack já pausa a
 * query/mutation direto (sem tentar) quando o onlineManager reporta offline
 * — é exatamente o que queremos.
 *
 * `gcTime` alto (24h) porque o dado persistido em IndexedDB só é útil se
 * sobreviver ao gc padrão de 5min sem observers montados (usuário troca de
 * aba/tela no meio de um dia offline).
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24,
    },
  },
});
