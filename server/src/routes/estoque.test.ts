import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listarSaldos: vi.fn(),
  ajustarContagem: vi.fn(),
  registrarMovimento: vi.fn(),
  excluirMovimento: vi.fn(),
  escrita: vi.fn(),
  leitura: vi.fn(),
  listarProdutos: vi.fn(),
  criarProduto: vi.fn(),
  atualizarProduto: vi.fn(),
  listarCategorias: vi.fn(),
  listarCentrosCusto: vi.fn(),
  listarParceiros: vi.fn(),
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
vi.mock("../services/estoque/produtos.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../services/estoque/produtos.js")>();
  return {
    ...real,
    listarProdutos: mocks.listarProdutos,
    criarProduto: mocks.criarProduto,
    atualizarProduto: mocks.atualizarProduto,
  };
});
vi.mock("../services/rebanho/financeiro-ref.js", () => ({
  listarCategorias: mocks.listarCategorias,
  listarCentrosCusto: mocks.listarCentrosCusto,
}));
vi.mock("../services/financeiro/parceiros.js", () => ({ listarParceiros: mocks.listarParceiros }));

import { estoqueRouter } from "./estoque.js";

const base = { id: 7, nome: "Peão", email: "p@x", papel: "OPERADOR", abas: [], areas: ["pecuaria"], status: "ATIVO", dono: false };
const semLancar = { ...base, flags: ["verValores"] };
const comLancar = { ...base, flags: ["lancar"] };
const soAgricultura = { ...base, id: 9, areas: ["agricultura"], flags: ["verValores"] };

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
  mocks.listarProdutos.mockResolvedValue([]);
  mocks.criarProduto.mockResolvedValue({ id: 1 });
  mocks.atualizarProduto.mockResolvedValue({ id: 1 });
  mocks.listarCategorias.mockResolvedValue([]);
  mocks.listarCentrosCusto.mockResolvedValue([]);
  mocks.listarParceiros.mockResolvedValue([]);
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

describe("GET /estoque/movimentos", () => {
  it.each(["abc", "-1", "1.5"])("produtoId=%s → 400", async (v) => {
    const res = await appCom(semLancar).request(`/estoque/movimentos?produtoId=${v}`);
    expect(res.status).toBe(400);
    expect(mocks.listarSaldos).not.toHaveBeenCalled();
  });
  it("tipo inválido → 400", async () => {
    const res = await appCom(semLancar).request("/estoque/movimentos?tipo=INVALIDO");
    expect(res.status).toBe(400);
  });
});

describe("GET /estoque/custo-vaca-dia", () => {
  it.each(["0", "366", "abc", "-1"])("dias=%s → 400", async (v) => {
    const res = await appCom(semLancar).request(`/estoque/custo-vaca-dia?dias=${v}`);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /estoque/movimentos/:id", () => {
  it.each(["abc", "-1", "1.5"])("id=%s → 400", async (v) => {
    const res = await appCom(comLancar).request(`/estoque/movimentos/${v}`, { method: "DELETE" });
    expect(res.status).toBe(400);
    expect(mocks.excluirMovimento).not.toHaveBeenCalled();
  });
});

describe("acesso de usuário só-agricultura aos cadastros do estoque", () => {
  it("GET /estoque/produtos → 200", async () => {
    const res = await appCom(soAgricultura).request("/estoque/produtos");
    expect(res.status).toBe(200);
  });
  it("GET /estoque/categorias → 200", async () => {
    const res = await appCom(soAgricultura).request("/estoque/categorias");
    expect(res.status).toBe(200);
  });
  it("GET /estoque/centros-custo → 200", async () => {
    const res = await appCom(soAgricultura).request("/estoque/centros-custo");
    expect(res.status).toBe(200);
  });
  it("GET /estoque/fornecedores → 200", async () => {
    const res = await appCom(soAgricultura).request("/estoque/fornecedores");
    expect(res.status).toBe(200);
  });
});

describe("GET /estoque/fornecedores", () => {
  it("devolve só parceiros com papel FORNECEDOR", async () => {
    mocks.listarParceiros.mockResolvedValue([
      { id: 1, nome: "Cooperativa", tipo: "FORNECEDOR", papeis: [{ papel: "FORNECEDOR" }], ativo: true },
      { id: 2, nome: "Laticínio Comprador", tipo: "CLIENTE", papeis: [{ papel: "CLIENTE" }], ativo: true },
      { id: 3, nome: "Agro Ambos", tipo: "AMBOS", papeis: [{ papel: "CLIENTE" }, { papel: "FORNECEDOR" }], ativo: false },
    ]);
    const res = await appCom(semLancar).request("/estoque/fornecedores");
    expect(res.status).toBe(200);
    expect(mocks.listarParceiros).toHaveBeenCalledWith(true);
    const corpo = await res.json();
    expect(corpo.map((p: { id: number }) => p.id)).toEqual([1, 3]);
  });
});

describe("POST /estoque/produtos", () => {
  const body = { nome: "Ureia", tipo: "INSUMO", unidade: "kg", estocavel: true, categoriaId: 1 };
  it("sem lancar → 403", async () => {
    const res = await appCom(soAgricultura).request("/estoque/produtos", { method: "POST", headers: json, body: JSON.stringify(body) });
    expect(res.status).toBe(403);
    expect(mocks.criarProduto).not.toHaveBeenCalled();
  });
  it("com lancar → chega ao service", async () => {
    const res = await appCom(comLancar).request("/estoque/produtos", { method: "POST", headers: json, body: JSON.stringify(body) });
    expect(res.status).toBe(201);
    expect(mocks.criarProduto).toHaveBeenCalledWith(expect.objectContaining({ nome: "Ureia" }), 7);
  });
});
