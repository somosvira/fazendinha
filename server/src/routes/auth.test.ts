import { beforeEach, describe, expect, it, vi } from "vitest";

const permissao = vi.hoisted(() => ({ getUsuario: vi.fn() }));
vi.mock("../middleware/permissao.js", () => ({ getUsuario: permissao.getUsuario }));

import { authPrivadoRouter, authPublicoRouter } from "./auth.js";

beforeEach(() => vi.clearAllMocks());

describe("GET /auth/me", () => {
  it("devolve apenas o contexto interno já autorizado pelo middleware", async () => {
    const usuario = { id: 8, nome: "Pessoa Fixture", email: "fixture@example.test", papel: "gestor", abas: [], areas: ["financeiro"], flags: [], status: "ATIVO", dono: false };
    permissao.getUsuario.mockReturnValue(usuario);

    const response = await authPrivadoRouter.request("/auth/me");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ usuario });
  });

  it("não fabrica contexto sem middleware autenticado", async () => {
    permissao.getUsuario.mockReturnValue(null);

    const response = await authPrivadoRouter.request("/auth/me");

    expect(response.status).toBe(401);
  });
});

describe("rotas públicas de senha aposentadas", () => {
  it.each(["/auth/login", "/auth/forgot-password", "/auth/convite/token", "/auth/reset-password/token"])('não expõe %s', async (path) => {
    const response = await authPublicoRouter.request(path, { method: "POST" });
    expect(response.status).toBe(404);
  });
});
