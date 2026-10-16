import { expect, it, vi } from "vitest";
import { rotaDoAssistente } from "./featureFlags.js";
vi.mock("./middleware/auth.js", () => ({ authMiddleware: async (c: import("hono").Context, next: () => Promise<void>) => {
  c.set("usuario", { id: 9, dono: true, areas: ["financeiro"], flags: [] }); await next();
} }));
import { app } from "./app.js";
it("registra o assistente web no app principal", async () => {
  const r = await app.request("/api/bot/status"); expect(r.status).toBe(200);
  expect(await r.json()).toHaveProperty("configurado");
});
it("mantém WhatsApp suspenso antes de autenticação e do webhook", async () => {
  const r = await app.request("/api/whatsapp/webhook"); expect(r.status).toBe(503);
  expect(await r.json()).toMatchObject({ code: "FEATURE_DISABLED" });
});
it("não confunde inseminação artificial com o assistente", () => {
  expect(rotaDoAssistente("/api/pecuaria/rebanho/sanidade/protocolos")).toBe(false);
});
it.each(["/api/plantio/ia", "/api/plantio/talhoes", "/api/cultivo/safras", "/api/ponto/funcionarios"])("mantém a rota retirada %s inexistente", async pathname => {
  expect(rotaDoAssistente(pathname)).toBe(false);
  expect((await app.request(pathname)).status).toBe(404);
});
