import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listarSaldos: vi.fn(),
  ajustarContagem: vi.fn(),
  registrarMovimento: vi.fn(),
  excluirMovimento: vi.fn(),
  escrita: vi.fn(),
  leitura: vi.fn(),
}));

vi.mock("../services/estoque/estoque.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../services/estoque/estoque.js")>();
  return {
    ...real,
    listarSaldos: mocks.listarSaldos,
    ajustarContagem: mocks.ajustarContagem,
    registrarMovimento: mocks.registrarMovimento,
    excluirMovimento: mocks.excluirMovimento,
  };
});
vi.mock("../services/propriedade.js", () => ({ resolverEscopoLeitura: mocks.leitura, resolverEscopoEscrita: mocks.escrita }));

import { estoqueRouter } from "./estoque.js";

const base = { id: 7, nome: "Peão", email: "p@x", papel: "OPERADOR", abas: [], areas: ["pecuaria"], status: "ATIVO", dono: false };
const semLancar = { ...base, flags: ["verValores"] };
const comLancar = { ...base, flags: ["lancar"] };

function appCom(usuario: unknown) {
  return new Hono().use("*", async (c, next) => { c.set("usuario" as never, usuario as never); await next(); }).route("/", estoqueRouter);
}

const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const json = { "content-type": "application/json" };
const escritas = [
  { nome: "POST /estoque/ajustes", req: () => ["/estoque/ajustes", { method: "POST", headers: json, body: JSON.stringify({ produtoId: 1, quantidadeContada: 5, saldoEsperado: 10, observacao: "Contagem física" }) }] as const, svc: mocks.ajustarContagem },
  { nome: "POST /estoque/movimentos", req: () => ["/estoque/movimentos", { method: "POST", headers: json, body: JSON.stringify({ produtoId: 1, tipo: "AJUSTE", data: ontem, quantidade: -2, observacao: "Ajuste conferido" }) }] as const, svc: mocks.registrarMovimento },
  { nome: "DELETE /estoque/movimentos/:id", req: () => ["/estoque/movimentos/42", { method: "DELETE" }] as const, svc: mocks.excluirMovimento },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.leitura.mockResolvedValue(3);
  mocks.escrita.mockResolvedValue(3);
  mocks.listarSaldos.mockResolvedValue([]);
  mocks.ajustarContagem.mockResolvedValue({ id: 1, operacaoId: 2 });
  mocks.registrarMovimento.mockResolvedValue({ id: 1, operacaoId: 2 });
  mocks.excluirMovimento.mockResolvedValue(undefined);
});

describe("escritas exigem a flag lancar", () => {
  it.each(escritas)("$nome → 403 sem lancar", async ({ req, svc }) => {
    const [path, init] = req();
    const res = await appCom(semLancar).request(path, init as RequestInit);
    expect(res.status).toBe(403);
    expect(svc).not.toHaveBeenCalled();
  });

  it.each(escritas)("$nome → chega ao service com lancar", async ({ req, svc }) => {
    const [path, init] = req();
    const res = await appCom(comLancar).request(path, init as RequestInit);
    expect(res.status).toBeLessThan(300);
    expect(svc).toHaveBeenCalledTimes(1);
  });

  it("propaga usuarioId e escopo de escrita ao service", async () => {
    const [path, init] = escritas[0].req();
    await appCom(comLancar).request(path, init as RequestInit);
    expect(mocks.escrita).toHaveBeenCalled();
    expect(mocks.ajustarContagem).toHaveBeenCalledWith(expect.objectContaining({ propriedadeId: 3, usuarioId: 7 }));
    const [, delInit] = escritas[2].req();
    await appCom(comLancar).request("/estoque/movimentos/42", delInit as RequestInit);
    expect(mocks.excluirMovimento).toHaveBeenCalledWith(42, 3, 7);
  });
});

describe("GET /estoque/saldos", () => {
  it("lê sem flag lancar (gate de área fica no app)", async () => {
    const res = await appCom(semLancar).request("/estoque/saldos?centroCustoId=0");
    expect(res.status).toBe(200);
    expect(mocks.listarSaldos).toHaveBeenCalledWith(expect.objectContaining({ centroCustoId: 0, propriedadeId: 3 }));
  });
  it("sem centroCustoId → sem filtro", async () => {
    await appCom(semLancar).request("/estoque/saldos");
    expect(mocks.listarSaldos).toHaveBeenCalledWith(expect.objectContaining({ centroCustoId: undefined }));
  });
  it.each(["abc", "-1", "1.5"])("centroCustoId=%s → 400", async (v) => {
    const res = await appCom(semLancar).request(`/estoque/saldos?centroCustoId=${v}`);
    expect(res.status).toBe(400);
    expect(mocks.listarSaldos).not.toHaveBeenCalled();
  });
});
