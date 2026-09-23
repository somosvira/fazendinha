import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  registrarSanidade: vi.fn(),
  editarSanidade: vi.fn(),
  excluirSanidade: vi.fn(),
  listarSanidade: vi.fn(),
  montarTimeline: vi.fn(),
  escrita: vi.fn(),
}));

vi.mock("../../services/rebanho/eventos-sanidade.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../services/rebanho/eventos-sanidade.js")>();
  return {
    ...real,
    registrarSanidade: mocks.registrarSanidade,
    editarSanidade: mocks.editarSanidade,
    excluirSanidade: mocks.excluirSanidade,
    listarSanidade: mocks.listarSanidade,
  };
});
vi.mock("../../services/rebanho/timeline.js", () => ({ montarTimeline: mocks.montarTimeline }));
vi.mock("../../services/propriedade.js", () => ({ resolverEscopoEscrita: mocks.escrita }));

import { sanidadeRouter } from "./sanidade.js";

const usuario = { id: 42, nome: "Dona da fazenda", email: "d@x", papel: "DONO", abas: [], areas: ["pecuaria"], status: "ATIVO", dono: true, flags: [] };

function appCom(usuarioCtx: unknown) {
  return new Hono().use("*", async (c, next) => { c.set("usuario" as never, usuarioCtx as never); await next(); }).route("/", sanidadeRouter);
}

const json = { "content-type": "application/json" };
const bodyAplicacao = JSON.stringify({ tipo: "APLICACAO", data: "2026-02-05", produto: "Vermífugo", produtoId: 3, quantidadeUsada: 2 });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.escrita.mockResolvedValue(5);
  mocks.registrarSanidade.mockResolvedValue({ id: "1" });
  mocks.editarSanidade.mockResolvedValue({ id: "1" });
  mocks.excluirSanidade.mockResolvedValue(undefined);
});

describe("rota de sanidade — usuário propagado para auditoria do estorno", () => {
  it("POST /rebanho/animais/:id/sanidade passa o id do usuário logado", async () => {
    const res = await appCom(usuario).request("/rebanho/animais/1/sanidade", { method: "POST", headers: json, body: bodyAplicacao });
    expect(res.status).toBe(201);
    expect(mocks.registrarSanidade).toHaveBeenCalledWith(1, expect.objectContaining({ tipo: "APLICACAO" }), 5, 42);
  });

  it("PUT /rebanho/sanidade/:id passa o id do usuário logado", async () => {
    const res = await appCom(usuario).request("/rebanho/sanidade/50", { method: "PUT", headers: json, body: bodyAplicacao });
    expect(res.status).toBe(200);
    expect(mocks.editarSanidade).toHaveBeenCalledWith(50, expect.objectContaining({ tipo: "APLICACAO" }), 5, 42);
  });

  it("DELETE /rebanho/sanidade/:id passa o id do usuário logado", async () => {
    const res = await appCom(usuario).request("/rebanho/sanidade/50", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(mocks.excluirSanidade).toHaveBeenCalledWith(50, 5, 42);
  });

  it("sem usuário no contexto, propaga null (não quebra)", async () => {
    const res = await appCom(null).request("/rebanho/sanidade/50", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(mocks.excluirSanidade).toHaveBeenCalledWith(50, 5, null);
  });
});
