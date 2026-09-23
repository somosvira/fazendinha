// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RebanhoContent } from "./RebanhoContent";

describe("RebanhoContent — navegação a partir do cockpit", () => {
  it("deixa a rota de Estoque vencer o animal aberto sem precisar atualizar a página", async () => {
    const consumiuDeepLink = vi.fn();
    const view = render(
      <RebanhoContent aba="animal" abrirId="7" onAbriuEntidade={consumiuDeepLink} />,
    );

    await waitFor(() => expect(consumiuDeepLink).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /Rebanho/ })).toBeTruthy();

    view.rerender(<RebanhoContent aba="estoque" />);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Rebanho/ })).toBeNull();
    });
    // A aba Estoque só monta o EstoqueContent depois de resolver o centro de
    // atividade (evita a corrida descrita em EstoqueContent.test.tsx); até lá
    // mostra o Loader.
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Saldos de estoque" })).toBeTruthy();
    });
  });
});
