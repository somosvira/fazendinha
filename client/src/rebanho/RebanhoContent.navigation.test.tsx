// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RebanhoContent } from "./RebanhoContent";

describe("RebanhoContent — navegação a partir do cockpit", () => {
  it("deixa a rota de Estoque vencer o animal aberto sem precisar atualizar a página", async () => {
    const consumiuDeepLink = vi.fn();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
      <QueryClientProvider client={queryClient}>
        <RebanhoContent aba="animal" abrirId="7" onAbriuEntidade={consumiuDeepLink} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(consumiuDeepLink).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /Rebanho/ })).toBeTruthy();

    view.rerender(
      <QueryClientProvider client={queryClient}>
        <RebanhoContent aba="estoque" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Rebanho/ })).toBeNull();
    });
    expect(screen.getByRole("heading", { name: "Saldos de estoque" })).toBeTruthy();
  });
});
