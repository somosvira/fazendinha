// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
vi.mock("@clerk/react/legacy", () => ({
  useSignIn: () => ({ isLoaded: true, signIn: { authenticateWithRedirect: vi.fn() } }),
}));

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

    expect(screen.getByRole("heading", { name: "Entre com sua conta Google" })).not.toBeNull();
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

  it("redireciona links legados de senha para a entrada Google", async () => {
    history.replaceState(null, "", "/senha/token-fixture");
    render(<App />);

    await waitFor(() => expect(location.pathname).toBe("/signin"));
    expect(screen.getByRole("heading", { name: "Entre com sua conta Google" })).not.toBeNull();
  });

});
