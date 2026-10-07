import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uid } from "../lib/uid.fixture.js";
const mocks = vi.hoisted(() => ({ transferir: vi.fn(), escrita: vi.fn() }));
vi.mock("../services/estoque/transferencias.js", () => ({ transferirEstoque: mocks.transferir }));
vi.mock("../services/propriedade.js", () => ({ resolverEscopoEscrita: mocks.escrita }));
import { estoqueRouter } from "./estoque.js";
const usuario = { id: 7, dono: false, areas: ["pecuaria"], flags: ["lancar"], abas: [], status: "ATIVO" };
function app() { return new Hono().use("*", async (c, next) => { c.set("usuario" as never, usuario as never); await next(); }).route("/", estoqueRouter); }
const payload = { chave: uid(1), produtoId: uid(2), origemId: 3, quantidade: "2", data: "2026-10-04", motivo: "Embalagem danificada" };
function enviar(motivo: unknown) { return app().request("/estoque/perdas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, motivo }) }); }
beforeEach(() => { vi.clearAllMocks(); mocks.escrita.mockResolvedValue(3); mocks.transferir.mockResolvedValue({ operacaoId: uid(8) }); });
describe("POST perda", () => {
  it.each([undefined, null, "", "   ", "abcd", "x".repeat(201)])("responde erro do campo para %s sem escrita", async (motivo) => {
    const resposta = await enviar(motivo);
    expect(resposta.status).toBe(422);
    expect(await resposta.json()).toMatchObject({ campo: "motivo", code: "VALIDACAO" });
    expect(mocks.transferir).not.toHaveBeenCalled();
    expect(mocks.escrita).not.toHaveBeenCalled();
  });
  it("leva motivo normalizado, autor e sítio ao serviço", async () => {
    expect((await enviar("  Embalagem danificada  ")).status).toBe(201);
    expect(mocks.transferir).toHaveBeenCalledWith({ ...payload, destinoId: 3, modo: "PERDA" }, 7);
    expect(mocks.escrita).toHaveBeenCalledWith(expect.anything(), 3);
  });
});
