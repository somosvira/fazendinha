import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { UsuarioContexto } from "../services/auth/sessao.js";

// Só o gate de permissão é exercitado aqui — o service fica mockado para o teste
// não depender de banco.
const mocks = vi.hoisted(() => ({
  listar: vi.fn(),
  criar: vi.fn(),
  editar: vi.fn(),
}));

vi.mock("../services/propriedade.js", async () => {
  const { z } = await import("zod");
  class PropriedadeError extends Error {
    constructor(public code: "NAO_ENCONTRADO" | "NOME_DUPLICADO", message: string) { super(message); }
  }
  return {
    PropriedadeError,
    propriedadeSchema: z.object({ nome: z.string().min(1) }).passthrough(),
    listarPropriedades: mocks.listar,
    criarPropriedade: mocks.criar,
    editarPropriedade: mocks.editar,
  };
});

import { propriedadeRouter } from "./propriedade.js";

const usuario = (p: Partial<UsuarioContexto>): UsuarioContexto => ({
  id: 1, nome: "x", email: "x@x", papel: "consulta", abas: [], areas: [], flags: [], status: "ATIVO", dono: false, ...p,
});

function app(u: UsuarioContexto | null) {
  return new Hono()
    .use("*", async (c, next) => { if (u) c.set("usuario" as never, u as never); await next(); })
    .route("/", propriedadeRouter);
}

const corpo = (method: "POST" | "PATCH", body: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listar.mockResolvedValue([]);
  mocks.criar.mockResolvedValue({ id: 5, nome: "Novo" });
  mocks.editar.mockResolvedValue({ id: 5, nome: "Novo" });
});

describe("rotas de propriedades — permissão", () => {
  it("qualquer usuário logado lista os sítios", async () => {
    const res = await app(usuario({})).request("/propriedades");
    expect(res.status).toBe(200);
    expect(mocks.listar).toHaveBeenCalledWith(false);
  });

  it("criar e editar sítio exigem gerenciarAcessos", async () => {
    const semPermissao = app(usuario({ flags: ["lancar"] }));
    expect((await semPermissao.request("/propriedades", corpo("POST", { nome: "Novo" }))).status).toBe(403);
    expect((await semPermissao.request("/propriedades/5", corpo("PATCH", { nome: "Novo" }))).status).toBe(403);
    expect(mocks.criar).not.toHaveBeenCalled();
    expect(mocks.editar).not.toHaveBeenCalled();
  });

  it("quem gerencia acessos e o dono podem criar e editar", async () => {
    const admin = app(usuario({ flags: ["gerenciarAcessos"] }));
    expect((await admin.request("/propriedades", corpo("POST", { nome: "Novo" }))).status).toBe(201);
    const dono = app(usuario({ dono: true }));
    expect((await dono.request("/propriedades/5", corpo("PATCH", { nome: "Novo" }))).status).toBe(200);
    expect(mocks.criar).toHaveBeenCalledTimes(1);
    expect(mocks.editar).toHaveBeenCalledWith(5, { nome: "Novo" });
  });

  it("sem sessão, escrever devolve 401", async () => {
    expect((await app(null).request("/propriedades", corpo("POST", { nome: "Novo" }))).status).toBe(401);
  });
});
