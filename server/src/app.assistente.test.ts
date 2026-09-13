import { describe, expect, it } from "vitest";
import { rotaDoAssistente } from "./featureFlags.js";

// O bloqueio acontece antes de qualquer acesso a dados; a URL apenas satisfaz
// a validação de configuração durante o carregamento isolado do app.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
const { app } = await import("./app.js");

describe("assistente temporariamente inativo", () => {
  it.each([
    ["POST", "/api/bot/ask"],
    ["GET", "/api/whatsapp/webhook"],
    ["POST", "/api/rebanho/ia"],
    ["GET", "/api/rebanho/ia/insights"],
    ["POST", "/api/plantio/ia"],
    ["POST", "/api/corte/ia"],
  ])("bloqueia %s %s antes de executar o canal", async (method, pathname) => {
    const resposta = await app.request(`http://localhost${pathname}`, { method });
    expect(resposta.status).toBe(503);
    await expect(resposta.json()).resolves.toMatchObject({ code: "FEATURE_DISABLED" });
  });

  it("não confunde inseminação artificial com o assistente", () => {
    expect(rotaDoAssistente("/api/rebanho/iatf/protocolos")).toBe(false);
  });
});
