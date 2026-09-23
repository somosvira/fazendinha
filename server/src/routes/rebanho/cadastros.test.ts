import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listarProdutos: vi.fn(),
  criarProduto: vi.fn(),
  atualizarProduto: vi.fn(),
  listarFornecedores: vi.fn(),
}));

vi.mock("../../services/estoque/produtos.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../services/estoque/produtos.js")>();
  return {
    ...real,
    listarProdutos: mocks.listarProdutos,
    criarProduto: mocks.criarProduto,
    atualizarProduto: mocks.atualizarProduto,
  };
});
vi.mock("../../services/rebanho/cadastros.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../services/rebanho/cadastros.js")>();
  return { ...real, listarFornecedores: mocks.listarFornecedores };
});

import { cadastrosRouter } from "./cadastros.js";

const base = { id: 7, nome: "Peão", email: "p@x", papel: "OPERADOR", abas: [], areas: ["pecuaria"], status: "ATIVO", dono: false, flags: ["verValores"] };

function appCom(usuario: unknown) {
  return new Hono().use("*", async (c, next) => { c.set("usuario" as never, usuario as never); await next(); }).route("/", cadastrosRouter);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listarProdutos.mockResolvedValue([]);
  mocks.listarFornecedores.mockResolvedValue([]);
});

describe("GET /rebanho/produtos — validação do filtro ?uso=", () => {
  it("uso válido passa e é encaminhado ao service", async () => {
    const res = await appCom(base).request("/rebanho/produtos?uso=sanitario");
    expect(res.status).toBe(200);
    expect(mocks.listarProdutos).toHaveBeenCalledWith(expect.objectContaining({ uso: "sanitario" }));
  });

  it("uso inválido → 400", async () => {
    const res = await appCom(base).request("/rebanho/produtos?uso=invalido");
    expect(res.status).toBe(400);
    expect(mocks.listarProdutos).not.toHaveBeenCalled();
  });

  it("sem uso não filtra e passa normalmente", async () => {
    const res = await appCom(base).request("/rebanho/produtos");
    expect(res.status).toBe(200);
    expect(mocks.listarProdutos).toHaveBeenCalledWith(expect.objectContaining({ uso: undefined }));
  });
});
