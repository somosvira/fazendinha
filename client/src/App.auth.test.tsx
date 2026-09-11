// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { App } from "./App";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App — gate de autenticação", () => {
  it("redireciona uma rota privada anônima para /signin preservando returnTo", async () => {
    history.replaceState(null, "", "/financeiro/operacoes?status=aberta");
    render(<App />);

    expect(screen.getByRole("heading", { name: "Bem-vindo de volta" })).not.toBeNull();
    await waitFor(() => {
      expect(location.pathname).toBe("/signin");
      expect(new URLSearchParams(location.search).get("returnTo")).toBe("/financeiro/operacoes?status=aberta");
    });
  });

  // O app monta sob StrictMode (ver main.tsx), que executa cada efeito duas
  // vezes. O redirecionamento anônimo lê e escreve a mesma URL, então a segunda
  // execução precisa reconhecer que já está numa rota pública e não sobrescrever
  // o returnTo que a primeira gravou.
  it("preserva o returnTo quando o efeito de redirecionamento repete", async () => {
    history.replaceState(null, "", "/financeiro/operacoes?status=aberta");
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    await waitFor(() => expect(location.pathname).toBe("/signin"));
    expect(new URLSearchParams(location.search).get("returnTo")).toBe("/financeiro/operacoes?status=aberta");
  });

  it("não normaliza rota pública e converte o alias antigo para a URL canônica", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ valido: true }) });
    vi.stubGlobal("fetch", fetchMock);
    history.replaceState(null, "", "/senha/token-fixture");
    render(<App />);

    expect(screen.getByText("Redefinir senha")).not.toBeNull();
    await waitFor(() => expect(location.pathname).toBe("/reset-password/token-fixture"));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/reset-password/token-fixture");
  });
});
