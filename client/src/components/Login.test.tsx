// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const clerk = vi.hoisted(() => ({ authenticateWithRedirect: vi.fn(), loaded: true }));
vi.mock("@clerk/react/legacy", () => ({ useSignIn: () => ({ isLoaded: clerk.loaded, signIn: { authenticateWithRedirect: clerk.authenticateWithRedirect } }) }));

import { Login } from "./Login";
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("oferece somente entrada Google e inicia OAuth Google", async () => {
  render(<Login />);
  expect(screen.queryByLabelText("E-mail")).toBeNull();
  expect(screen.queryByLabelText("Senha")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /continuar com google/i }));
  expect(clerk.authenticateWithRedirect).toHaveBeenCalledWith(expect.objectContaining({ strategy: "oauth_google" }));
});

it("oferece contato com a gestão pelo WhatsApp", () => {
  render(<Login />);
  const link = screen.getByRole("link", { name: /entrar em contato com a gestão/i });
  expect((link as HTMLAnchorElement).href).toContain("5532984043943");
});
