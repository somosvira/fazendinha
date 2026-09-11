// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RecuperarSenha } from "./RecuperarSenha";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RecuperarSenha", () => {
  it("envia o e-mail e mostra a confirmação neutra", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: "resposta neutra" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<RecuperarSenha />);

    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "CONTA.FIXTURE@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar link de recuperação" }));

    expect(await screen.findByText(/resposta neutra/)).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/forgot-password", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ email: "conta.fixture@example.test" }),
    }));
    expect(screen.getByRole("link", { name: "Voltar para entrar" }).getAttribute("href")).toBe("/signin");
  });
});
