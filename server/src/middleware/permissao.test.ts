import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { exigeAba, exigeQualquerArea } from "./permissao.js";
import type { UsuarioContexto } from "../services/auth/sessao.js";

const usuario = (p: Partial<UsuarioContexto>): UsuarioContexto => ({
  id: 1, nome: "x", email: "x@x", papel: "consulta", abas: [], areas: [], flags: [], status: "ATIVO", dono: false, ...p,
});

function app(u: UsuarioContexto | null) {
  return new Hono()
    .use("*", async (c, next) => { if (u) c.set("usuario" as never, u as never); await next(); })
    .get("/x", exigeAba("relatorio"), (c) => c.json({ ok: true }));
}

describe("exigeAba", () => {
  it("401 sem usuário", async () => {
    expect((await app(null).request("/x")).status).toBe(401);
  });
  it("403 quando a aba não está liberada", async () => {
    expect((await app(usuario({ abas: ["dashboard"] })).request("/x")).status).toBe(403);
  });
  it("libera pela aba ou por ser dono", async () => {
    expect((await app(usuario({ abas: ["relatorio"] })).request("/x")).status).toBe(200);
    expect((await app(usuario({ dono: true })).request("/x")).status).toBe(200);
  });
});

function appQualquerArea(u: UsuarioContexto | null) {
  return new Hono()
    .use("*", async (c, next) => { if (u) c.set("usuario" as never, u as never); await next(); })
    .get("/x", exigeQualquerArea(["pecuaria", "financeiro", "financeiro"]), (c) => c.json({ ok: true }));
}

describe("exigeQualquerArea", () => {
  it("401 sem usuário", async () => {
    expect((await appQualquerArea(null).request("/x")).status).toBe(401);
  });
  it("passa quando o usuário tem uma das áreas listadas", async () => {
    expect((await appQualquerArea(usuario({ areas: ["financeiro"] })).request("/x")).status).toBe(200);
  });
  it("403 quando não tem nenhuma das áreas listadas", async () => {
    expect((await appQualquerArea(usuario({ areas: ["equipe"] })).request("/x")).status).toBe(403);
  });
  it("dono sempre passa, mesmo sem áreas", async () => {
    expect((await appQualquerArea(usuario({ dono: true, areas: [] })).request("/x")).status).toBe(200);
  });
});
