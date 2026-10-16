import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ consultar: vi.fn(), transcrever: vi.fn(), escopo: vi.fn() }));
vi.mock("../services/bot/agent.js", () => ({ consultarAssistente: m.consultar }));
vi.mock("../services/bot/audio.js", () => ({ transcreverAudio: m.transcrever, LIMITE_AUDIO: 10 * 1024 * 1024 }));
vi.mock("../services/propriedade.js", () => ({ resolverEscopoLeitura: m.escopo }));
import { botRouter } from "./bot.js";
import { BotDesligadoError } from "../services/bot/openai.js";
const usuario = { id: 7, dono: false, areas: ["financeiro"], flags: ["verValores", "verInvestimento", "verSalarios"] };
const app = (u: typeof usuario | null = usuario) => new Hono<{ Variables: { usuario: typeof usuario | null } }>().use("*", async (c, next) => { c.set("usuario", u); await next(); }).route("/api", botRouter);
const perguntar = (u: typeof usuario | null = usuario, body: unknown = { pergunta: "Quanto saiu?" }) => app(u).request("/api/bot/ask", { method: "POST", headers: { "content-type": "application/json", "X-Propriedade-Id": "9" }, body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); m.escopo.mockResolvedValue(9); m.consultar.mockResolvedValue({ resposta: "Resposta", fontes: [], contexto: null }); m.transcrever.mockResolvedValue("Quanto saiu?"); });
it.each([null, { ...usuario, id: 0 }])("exige sessão pessoal: %j", async u => {
  expect((await perguntar(u)).status).toBe(401); expect(m.consultar).not.toHaveBeenCalled();
});
it.each([
  { ...usuario, areas: ["pecuaria"] },
  ...usuario.flags.map(flag => ({ ...usuario, flags: usuario.flags.filter(f => f !== flag) })),
])("nega acesso financeiro incompleto também na transcrição: %j", async u => {
  expect((await perguntar(u)).status).toBe(403);
  expect((await app(u).request("/api/bot/transcrever", { method: "POST" })).status).toBe(403);
  expect(m.consultar).not.toHaveBeenCalled(); expect(m.transcrever).not.toHaveBeenCalled();
});
it("envia o escopo resolvido pelo servidor e nenhum histórico legado", async () => {
  expect((await perguntar()).status).toBe(200);
  expect(m.consultar).toHaveBeenCalledWith("Quanto saiu?", null, 9);
});
it.each([{ pergunta: "" }, { pergunta: "x".repeat(2001) }, { pergunta: "Oi", propriedadeId: 3 }, { pergunta: "Oi", sessao: "outra-pessoa" }])("valida corpo estrito: %j", async body => {
  expect((await perguntar(usuario, body)).status).toBe(422); expect(m.consultar).not.toHaveBeenCalled();
});
it("informa falta de chave e não inventa resposta", async () => {
  m.consultar.mockRejectedValue(new BotDesligadoError());
  const r = await perguntar(); expect(r.status).toBe(503); expect(await r.json()).toMatchObject({ error: expect.stringContaining("configurado") });
});
it("transcreve multipart e não dispara consulta automaticamente", async () => {
  const body = new FormData(); body.set("audio", new File(["audio"], "pergunta.webm", { type: "audio/webm" }));
  const r = await app().request("/api/bot/transcrever", { method: "POST", body });
  expect(r.status).toBe(200); expect(await r.json()).toEqual({ texto: "Quanto saiu?" });
  expect(m.transcrever).toHaveBeenCalledOnce(); expect(m.consultar).not.toHaveBeenCalled();
});
it("recusa áudio ausente ou excessivo antes do provedor", async () => {
  const body = new FormData(); body.set("audio", "texto");
  expect((await app().request("/api/bot/transcrever", { method: "POST", body })).status).toBe(422);
  expect((await app().request("/api/bot/transcrever", { method: "POST", headers: { "content-length": String(11 * 1024 * 1024) }, body: "x" })).status).toBe(413);
  expect(m.transcrever).not.toHaveBeenCalled();
});
