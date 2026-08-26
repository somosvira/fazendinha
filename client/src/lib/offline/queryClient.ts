// QueryClient único do app (ver docs/design/offline/OFFLINE_STRATEGY.md).
// `networkMode` default ("online") pausa a query em vez de tentar e falhar
// quando offline. `gcTime` alto (24h) pra sobreviver ao gc padrão de 5min
// sem observers montados — o dado persistido em IndexedDB só é útil se
// aguentar um dia inteiro offline trocando de tela.
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24,
    },
  },
});
