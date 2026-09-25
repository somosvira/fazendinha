import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// "Porta aberta" (S4): sem SHARED_ACCESS_TOKEN e sem usuário no banco, o middleware libera um
// dono sintético em dev — mas nunca em produção, onde isso seria uma tabela vazia por bootstrap
// incompleto, não um convite a entrar sem login. `prisma`/`resolverSessao`/`env` mockados: o
// teste não depende de banco nem do parse real de `process.env`.
const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  resolverSessao: vi.fn(),
  env: { SHARED_ACCESS_TOKEN: undefined as string | undefined, NODE_ENV: "development" as string },
}));

vi.mock("../db.js", () => ({ prisma: { usuario: { count: mocks.count } } }));
vi.mock("../services/auth/sessao.js", () => ({ resolverSessao: mocks.resolverSessao }));
vi.mock("../env.js", () => ({ env: mocks.env }));

import { authMiddleware } from "./auth.js";

function app() {
  return new Hono()
    .use("*", authMiddleware)
    .get("/x", (c) => c.json({ usuario: c.get("usuario" as never) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.SHARED_ACCESS_TOKEN = undefined;
  mocks.env.NODE_ENV = "development";
  mocks.count.mockResolvedValue(0);
  mocks.resolverSessao.mockResolvedValue(null);
});

describe("authMiddleware — porta aberta só fora de produção (S4)", () => {
  it("dev, sem token e sem usuários cadastrados: libera acesso como dono sintético", async () => {
    const res = await app().request("/x");
    expect(res.status).toBe(200);
  });

  it("produção, sem token e sem usuários cadastrados: NÃO libera — responde com erro claro", async () => {
    mocks.env.NODE_ENV = "production";
    const res = await app().request("/x");
    expect(res.status).not.toBe(200);
    expect([401, 503]).toContain(res.status);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });

  it("produção, sem token e sem usuários: 503 (não confunde com credencial errada)", async () => {
    mocks.env.NODE_ENV = "production";
    const res = await app().request("/x");
    expect(res.status).toBe(503);
  });

  it("dev, com usuários já cadastrados: não libera porta aberta mesmo sem bearer", async () => {
    mocks.count.mockResolvedValue(3);
    const res = await app().request("/x");
    expect(res.status).toBe(401);
  });

  it("produção, com usuários cadastrados: 401 padrão (não 503) sem bearer", async () => {
    mocks.env.NODE_ENV = "production";
    mocks.count.mockResolvedValue(3);
    const res = await app().request("/x");
    expect(res.status).toBe(401);
  });

  it("bearer válido continua funcionando em produção mesmo sem SHARED_ACCESS_TOKEN", async () => {
    mocks.env.NODE_ENV = "production";
    mocks.resolverSessao.mockResolvedValue({ id: 1, nome: "x", email: "x@x", papel: "consulta", abas: [], areas: [], flags: [], status: "ATIVO", dono: false });
    const res = await app().request("/x", { headers: { authorization: "Bearer tok" } });
    expect(res.status).toBe(200);
  });

  it("SHARED_ACCESS_TOKEN configurado: bearer correto vale como dono, mesmo em produção", async () => {
    mocks.env.NODE_ENV = "production";
    mocks.env.SHARED_ACCESS_TOKEN = "0123456789abcdef";
    const res = await app().request("/x", { headers: { authorization: "Bearer 0123456789abcdef" } });
    expect(res.status).toBe(200);
  });
});
