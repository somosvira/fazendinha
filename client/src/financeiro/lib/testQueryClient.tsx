// Helper de teste reutilizável para telas que leem via useQuery (ver
// docs/design/offline/README.md). Sem QueryClientProvider o hook nunca
// resolve ("No QueryClient set"). `render` tem a mesma assinatura do
// `render` de "@testing-library/react" — os testes trocam só o import,
// mantendo screen/fireEvent/waitFor/etc. vindos da lib de sempre.
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as renderRTL, type RenderOptions, type RenderResult } from "@testing-library/react";
import { ToastProvider } from "../../components/Toast";

export function criarQueryClientTeste(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}

export function renderComQuery(ui: ReactElement, opcoes?: { queryClient?: QueryClient }): RenderResult & { queryClient: QueryClient } {
  const queryClient = opcoes?.queryClient ?? criarQueryClientTeste();
  const resultado = renderRTL(ui, {
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}><ToastProvider>{children}</ToastProvider></QueryClientProvider>,
  });
  return { ...resultado, queryClient };
}

/** Drop-in do `render` padrão, já envolvido no QueryClientProvider. */
export function render(ui: ReactElement, options?: RenderOptions): RenderResult {
  return renderRTL(ui, {
    ...options,
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={criarQueryClientTeste()}><ToastProvider>{children}</ToastProvider></QueryClientProvider>,
  });
}
