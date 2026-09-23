import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { UsuarioContexto } from "../../services/auth/sessao.js";

// Só o gate de permissão (achado 2) é exercitado aqui — os services reais ficam
// mockados para o teste não depender de banco.
const mocks = vi.hoisted(() => ({
  listar: vi.fn(),
  desfazerLocalizacao: vi.fn(),
  leitura: vi.fn(),
}));

vi.mock("../../services/propriedade.js", () => ({
  resolverEscopoLeitura: mocks.leitura,
  resolverEscopoEscrita: vi.fn(),
}));
vi.mock("../../services/pecuaria/rebanho/animais.js", () => ({
  listar: mocks.listar,
  desfazerLocalizacao: mocks.desfazerLocalizacao,
}));
vi.mock("../../services/pecuaria/rebanho/lotes.js", () => ({
  listarLotes: vi.fn(),
  criarLote: vi.fn(),
  editarLote: vi.fn(),
}));
vi.mock("../../services/pecuaria/rebanho/racas.js", () => ({
  listarRacas: vi.fn(),
  criarRaca: vi.fn(),
  editarRaca: vi.fn(),
}));
vi.mock("../../services/pecuaria/rebanho/motivos.js", () => ({
  listarMotivosSaida: vi.fn(),
  criarMotivoSaida: vi.fn(),
  editarMotivoSaida: vi.fn(),
}));
vi.mock("../../services/pecuaria/rebanho/painel.js", () => ({
  buscarPainelGeral: vi.fn(),
}));

import { rebanhoRouter } from "./rebanho.js";

const ID = "11111111-1111-1111-1111-111111111111";

const usuario = (p: Partial<UsuarioContexto>): UsuarioContexto => ({
  id: 1, nome: "x", email: "x@x", papel: "consulta", abas: [], areas: [], flags: [], status: "ATIVO", dono: false, ...p,
});

function app(u: UsuarioContexto | null) {
  return new Hono()
    .use("*", async (c, next) => { if (u) c.set("usuario" as never, u as never); await next(); })
    .route("/", rebanhoRouter);
}

const jsonBody = (body: unknown) => ({
  method: "POST" as const,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.leitura.mockResolvedValue(1);
  mocks.listar.mockResolvedValue({ itens: [], total: 0 });
  mocks.desfazerLocalizacao.mockResolvedValue({ ok: true });
});

describe("rebanhoRouter — gate de permissão `lancar` (achado 2)", () => {
  it("usuário sem `lancar`: leitura (GET) é permitida", async () => {
    const res = await app(usuario({ flags: [] })).request("/animais");
    expect(res.status).toBe(200);
    expect(mocks.listar).toHaveBeenCalledTimes(1);
  });

  it("usuário sem `lancar`: escrita é bloqueada com 403 e o service não é chamado", async () => {
    const res = await app(usuario({ flags: [] })).request(`/animais/${ID}/localizacao/desfazer`, { method: "POST" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "sem permissão" });
    expect(mocks.desfazerLocalizacao).not.toHaveBeenCalled();
  });

  it("usuário com `lancar`: escrita é permitida", async () => {
    const res = await app(usuario({ flags: ["lancar"] })).request(`/animais/${ID}/localizacao/desfazer`, { method: "POST" });
    expect(res.status).toBe(200);
    expect(mocks.desfazerLocalizacao).toHaveBeenCalledTimes(1);
  });

  it("dono: escrita é permitida mesmo sem a flag `lancar`", async () => {
    const res = await app(usuario({ dono: true, flags: [] })).request(`/animais/${ID}/localizacao/desfazer`, { method: "POST" });
    expect(res.status).toBe(200);
    expect(mocks.desfazerLocalizacao).toHaveBeenCalledTimes(1);
  });

  it("sem usuário autenticado: escrita responde 401 (antes do gate de permissão)", async () => {
    const res = await app(null).request(`/animais/${ID}/localizacao/desfazer`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it.each([
    ["lotes", () => app(usuario({ flags: [] })).request(`/lotes/${ID}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" })],
    ["raças", () => app(usuario({ flags: [] })).request("/racas", jsonBody({}))],
    ["motivos de saída", () => app(usuario({ flags: [] })).request("/motivos-saida", jsonBody({}))],
  ])("também bloqueia escrita em %s sem `lancar`", async (_nome, fazerRequisicao) => {
    const res = await fazerRequisicao();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "sem permissão" });
  });
});
