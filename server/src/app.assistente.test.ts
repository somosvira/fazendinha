import { describe, expect, it, vi } from "vitest";
import type { MiddlewareHandler } from "hono";
import { rotaDoAssistente } from "./featureFlags.js";

vi.mock("./middleware/auth.js", () => ({ authMiddleware: vi.fn<MiddlewareHandler>(async (_c, next) => next()) }));

// O bloqueio acontece antes de qualquer acesso a dados; a URL apenas satisfaz
// a validação de configuração durante o carregamento isolado do app.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
const { app } = await import("./app.js");

describe("assistente temporariamente inativo", () => {
  it.each([
    ["POST", "/api/bot/ask"],
    ["GET", "/api/whatsapp/webhook"],
  ])("bloqueia %s %s antes de executar o canal", async (method, pathname) => {
    const resposta = await app.request(`http://localhost${pathname}`, { method });
    expect(resposta.status).toBe(503);
    await expect(resposta.json()).resolves.toMatchObject({ code: "FEATURE_DISABLED" });
  });

  it("não confunde inseminação artificial com o assistente", () => {
    expect(rotaDoAssistente("/api/pecuaria/rebanho/sanidade/protocolos")).toBe(false);
  });
});

// Os módulos retirados não devem voltar como canais bloqueados do assistente.
describe("rotas operacionais retiradas", () => {
  it.each(["/api/plantio/ia", "/api/plantio/talhoes", "/api/cultivo/safras", "/api/ponto/funcionarios"])("%s não existe", async (pathname) => {
    expect(rotaDoAssistente(pathname)).toBe(false);
    const resposta = await app.request(`http://localhost${pathname}`);
    expect(resposta.status).toBe(404);
  });
});
