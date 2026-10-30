import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ leitura: vi.fn(), sitio: vi.fn(), responder: vi.fn(), executar: vi.fn(), transcrever: vi.fn(), falar: vi.fn(), env: { ASSISTENTE_CONSULTA_ENABLED: true, OPENAI_API_KEY: "" } }));
vi.mock("../services/assistente/voz.js", () => ({ sintetizarResposta: mocks.falar }));
vi.mock("../env.js", () => ({ env: mocks.env }));
vi.mock("../db.js", () => ({ prisma: { propriedade: { findFirst: mocks.sitio } } }));
vi.mock("../services/propriedade.js", async importar => ({ ...await importar<typeof import("../services/propriedade.js")>(), resolverEscopoLeitura: mocks.leitura }));
vi.mock("../services/assistente/agente.js", async importar => ({ ...await importar<typeof import("../services/assistente/agente.js")>(), responderPergunta: mocks.responder }));
vi.mock("../services/assistente/registro.js", () => ({ executarFerramenta: mocks.executar }));
vi.mock("../services/assistente/midia.js", async importar => ({ ...await importar<typeof import("../services/assistente/midia.js")>(), transcreverAudio: mocks.transcrever }));
import { assistenteRouter } from "./assistente.js";
import type { UsuarioContexto } from "../services/auth/sessao.js";
let usuario: UsuarioContexto | null;
let sequencia = 1;
const app = new Hono<{ Variables: { usuario: UsuarioContexto } }>().use("*", async (c, next) => { if (usuario) c.set("usuario", usuario); return next(); }).route("/", assistenteRouter);
const request = (entrada: unknown) => app.request("/assistente/consultar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(entrada) });
beforeEach(() => {
  vi.clearAllMocks(); mocks.env.ASSISTENTE_CONSULTA_ENABLED = true;
  usuario = { id: sequencia++, dono: true, status: "ATIVO", nome: "Fixture", email: "fixture@example.test", papel: "proprietario", flags: [], areas: [], abas: [] };
  mocks.leitura.mockResolvedValue(7); mocks.sitio.mockResolvedValue({ nome: "Destino" });
  mocks.executar.mockResolvedValue({ modo: "ajuda", resposta: "Resposta real", fontes: [] });
});
it("não aceita acesso público ou dono sintético", async () => {
  usuario = null; expect((await request({ artigoId: "assistente" })).status).toBe(401);
  usuario = { id: 0 } as UsuarioContexto; expect((await request({ artigoId: "assistente" })).status).toBe(401);
  expect(mocks.leitura).not.toHaveBeenCalled(); expect(mocks.responder).not.toHaveBeenCalled();
});
it("desliga só o canal novo antes de consultar", async () => {
  mocks.env.ASSISTENTE_CONSULTA_ENABLED = false;
  expect((await request({ artigoId: "assistente" })).status).toBe(503);
  expect(mocks.leitura).not.toHaveBeenCalled();
});
it("consulta ajuda sem OpenAI e devolve sítio, fonte e horário resolvidos no servidor", async () => {
  const r = await request({ artigoId: "assistente" });
  expect(r.status).toBe(200);
  expect(r.headers.get("Cache-Control")).toBe("no-store");
  expect(await r.json()).toMatchObject({ resposta: "Resposta real", escopo: { propriedadeId: 7, nome: "Destino" }, consultadoEm: expect.any(String) });
  expect(mocks.responder).not.toHaveBeenCalled();
  expect(mocks.executar).toHaveBeenCalledWith("consultar_ajuda", { artigoId: "assistente" }, expect.objectContaining({ propriedadeId: 7, usuario }));
});
it("configuração omite ferramentas restritas e não expõe credenciais", async () => {
  usuario = { ...usuario!, dono: false, areas: ["pecuaria"], flags: [], abas: [] };
  const r = await app.request("/assistente/configuracao");
  expect(r.status).toBe(200);
  const body = await r.json();
  expect(body).toMatchObject({ consultas: [], conversaDisponivel: false });
  expect(JSON.stringify(body)).not.toContain("API_KEY");
});
it.each([{ pergunta: "oi", usuarioId: 9 }, { consulta: { visao: "saldo", inicio: null, fim: null, propriedadeId: 99 } }, { artigoId: "assistente", pergunta: "oi" }, { pergunta: "x".repeat(2001) }])("rejeita entrada fora do contrato", async entrada => {
  expect((await request(entrada)).status).toBe(422);
  expect(mocks.leitura).not.toHaveBeenCalled(); expect(mocks.executar).not.toHaveBeenCalled();
});
it("rejeita sítio inexistente/inativo e não chama ferramentas", async () => {
  mocks.sitio.mockResolvedValue(null);
  expect((await request({ artigoId: "assistente" })).status).toBe(422);
  expect(mocks.executar).not.toHaveBeenCalled();
});
it("falha de dados não retorna detalhes internos nem falso resultado", async () => {
  mocks.executar.mockRejectedValue(new Error("DATABASE-URL-PRIVADA"));
  const r = await request({ consulta: { visao: "resumo", inicio: null, fim: null } });
  expect(r.status).toBe(503); expect(JSON.stringify(await r.json())).not.toContain("DATABASE-URL-PRIVADA");
});
it("limita chamadas por usuário com Retry-After", async () => {
  for (let i = 0; i < 12; i++) expect((await request({ artigoId: "assistente" })).status).toBe(200);
  const r = await request({ artigoId: "assistente" });
  expect(r.status).toBe(429); expect(r.headers.get("Retry-After")).toBe("60");
});
it("transcrição exige sessão e só aceita o arquivo esperado, sem identidades no form", async () => {
  const form = () => { const f = new FormData(); f.append("audio", new Blob([new Uint8Array(100)], { type: "audio/wav" }), "pergunta.wav"); return f; };
  const dono = usuario;
  usuario = null;
  expect((await app.request("/assistente/transcrever", { method: "POST", body: form() })).status).toBe(401);
  expect(mocks.transcrever).not.toHaveBeenCalled();
  usuario = dono;
  const invalido = form(); invalido.append("usuarioId", "999");
  expect((await app.request("/assistente/transcrever", { method: "POST", body: invalido })).status).toBe(422);
  expect(mocks.transcrever).not.toHaveBeenCalled();
  mocks.transcrever.mockResolvedValue("Pergunta transcrita");
  const r = await app.request("/assistente/transcrever", { method: "POST", body: form() });
  expect(r.status).toBe(200); expect(await r.json()).toEqual({ texto: "Pergunta transcrita" });
  expect(mocks.transcrever).toHaveBeenCalledTimes(1);
});
const conversar = (entrada: unknown = { pergunta: "Saldo atual?" }) => app.request("/assistente/conversar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(entrada) });
it("voz exige identidade real, valida escopo e rejeita texto de resposta do navegador", async () => {
  const real = usuario; usuario = null;
  expect((await conversar()).status).toBe(401); usuario = real;
  expect((await conversar({ pergunta: "oi", resposta: "valor inventado" })).status).toBe(422);
  mocks.sitio.mockResolvedValue(null);
  expect((await conversar()).status).toBe(422);
  expect(mocks.falar).not.toHaveBeenCalled(); expect(mocks.responder).not.toHaveBeenCalled();
});
it("sintetiza somente o resultado autorizado do servidor e preserva fonte/escopo", async () => {
  mocks.responder.mockResolvedValue({ modo: "dados", resposta: "Saldo autorizado", fontes: [{ titulo: "Contas", url: "/financeiro" }] });
  mocks.falar.mockResolvedValue("data:audio/mpeg;base64,YQ==");
  const r = await conversar();
  expect(r.status).toBe(200); expect(r.headers.get("Cache-Control")).toBe("no-store");
  expect(await r.json()).toMatchObject({ resposta: "Saldo autorizado", audio: "data:audio/mpeg;base64,YQ==", escopo: { propriedadeId: 7 }, fontes: [{ titulo: "Contas" }] });
  expect(mocks.falar).toHaveBeenCalledWith("Saldo autorizado");
});
it("falha de síntese conserva a resposta escrita sem detalhes privados", async () => {
  mocks.responder.mockResolvedValue({ modo: "ajuda", resposta: "Ajuda revisada", fontes: [] });
  mocks.falar.mockRejectedValue(new Error("SECRET-PROVIDER"));
  const r = await conversar(); const body = await r.json();
  expect(r.status).toBe(200); expect(body).toMatchObject({ resposta: "Ajuda revisada", audio: null, avisoVoz: expect.any(String) });
  expect(JSON.stringify(body)).not.toContain("SECRET-PROVIDER");
});
it("não sintetiza resposta negada e aplica o mesmo limite por usuário à conversa", async () => {
  mocks.responder.mockResolvedValue({ modo: "acesso_negado", resposta: "Sem acesso", fontes: [] });
  for (let i = 0; i < 12; i++) expect((await conversar()).status).toBe(200);
  const bloqueada = await conversar(); expect(bloqueada.status).toBe(429);
  expect(bloqueada.headers.get("Retry-After")).toBe("60");
  expect(mocks.falar).not.toHaveBeenCalled();
});
