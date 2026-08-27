// QueryClient único do app (ver docs/design/offline/OFFLINE_STRATEGY.md).
// `networkMode` default ("online") pausa a query em vez de tentar e falhar
// quando offline. `gcTime` alto (72h) pra sobreviver ao gc padrão de 5min
// sem observers montados — o dado persistido em IndexedDB só é útil se
// aguentar dias offline trocando de tela (fazenda longe de sinal). Exportado
// como GC_TIME_MS porque main.tsx usa o mesmo valor no `maxAge` do
// persistQueryClient — os dois têm que andar juntos.
import { QueryClient } from "@tanstack/react-query";

export const GC_TIME_MS = 1000 * 60 * 60 * 72;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: GC_TIME_MS,
    },
  },
});
