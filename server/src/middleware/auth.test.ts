import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const mocks = vi.hoisted(() => ({ autenticarRequestClerk: vi.fn() }));
vi.mock("../services/auth/clerk.js", () => ({ autenticarRequestClerk: mocks.autenticarRequestClerk }));

import { authMiddleware } from "./auth.js";

function app() {
  return new Hono()
    .use("*", authMiddleware)
    .get("/x", (c) => c.json({ usuario: c.get("usuario" as never) }));
}

beforeEach(() => vi.clearAllMocks());

describe("authMiddleware — Clerk", () => {
  it("injeta o usuário interno ativo resolvido por uma sessão Clerk válida", async () => {
    mocks.autenticarRequestClerk.mockResolvedValue({ id: 1, nome: "Ana", email: "ana@example.com", papel: "gestor", abas: [], areas: [], flags: [], status: "ATIVO", dono: false });

    const res = await app().request("/x", { headers: { cookie: "__session=token-clerk" } });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ usuario: { id: 1, email: "ana@example.com" } });
    expect(mocks.autenticarRequestClerk).toHaveBeenCalledWith(expect.any(Request));
  });

  it.each([
    ["sem sessão", {}],
    ["bearer local legado", { authorization: "Bearer sessao-local-antiga" }],
    ["token compartilhado legado", { authorization: "Bearer 0123456789abcdef" }],
  ])("rejeita %s", async (_cenario, headers) => {
    mocks.autenticarRequestClerk.mockResolvedValue(null);

    const res = await app().request("/x", { headers });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "não autenticado" });
  });
});
