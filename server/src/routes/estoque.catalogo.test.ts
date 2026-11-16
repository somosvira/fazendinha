import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uid } from "../lib/uid.fixture.js";

const mocks = vi.hoisted(() => ({
  listarCatalogo: vi.fn(), detalheCatalogo: vi.fn(), buscarProdutos: vi.fn(), registrarMovimento: vi.fn(), escrita: vi.fn(),
}));

vi.mock("../services/estoque/produtos-catalogo.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../services/estoque/produtos-catalogo.js")>(),
  listarCatalogo: mocks.listarCatalogo, detalheCatalogo: mocks.detalheCatalogo, buscarProdutos: mocks.buscarProdutos,
}));
vi.mock("../services/estoque/estoque.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../services/estoque/estoque.js")>(), registrarMovimento: mocks.registrarMovimento,
}));
vi.mock("../services/propriedade.js", () => ({ resolverEscopoLeitura: vi.fn().mockResolvedValue(1), resolverEscopoEscrita: mocks.escrita }));

import { estoqueRouter } from "./estoque.js";
import { exigeQualquerArea } from "../middleware/permissao.js";
import { erroProdutoCatalogo } from "../services/estoque/produtos-catalogo.js";

const base = { id: 7, nome: "Peão", email: "p@x", papel: "OPERADOR", abas: [], areas: ["pecuaria"], status: "ATIVO", dono: false, flags: ["lancar"] };
const appCom = (usuario: unknown) => new Hono()
  .use("*", async (c, next) => { c.set("usuario" as never, usuario as never); await next(); })
  .use("/estoque/*", exigeQualquerArea(["pecuaria", "financeiro"])).route("/", estoqueRouter);
const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.escrita.mockImplementation(async (_c: unknown, id: number | null) => id ?? 1);
});

describe("GET /estoque/produtos/busca", () => {
  it("repassa q, uso e limite padrão 10 ao serviço", async () => {
    mocks.buscarProdutos.mockResolvedValue({ meus: [], catalogo: [] });
    const r = await appCom(base).request("/estoque/produtos/busca?q=ivermec&uso=sanitario");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ meus: [], catalogo: [] });
    expect(mocks.buscarProdutos).toHaveBeenCalledWith({ q: "ivermec", uso: "sanitario", limite: 10 });
  });
  it.each(["limite=51", "limite=0", "uso=agricola", "x=1"])("%s → 400", async (qs) => {
    expect((await appCom(base).request(`/estoque/produtos/busca?${qs}`)).status).toBe(400);
    expect(mocks.buscarProdutos).not.toHaveBeenCalled();
  });
  it("sem área de Estoque (Financeiro ou Pecuária) → 403", async () => {
    expect((await appCom({ ...base, areas: [] }).request("/estoque/produtos/busca")).status).toBe(403);
  });
});

describe("GET /estoque/catalogo", () => {
  it("consulta paginada com padrões", async () => {
    mocks.listarCatalogo.mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 20 });
    expect((await appCom(base).request("/estoque/catalogo?busca=zoetis")).status).toBe(200);
    expect(mocks.listarCatalogo).toHaveBeenCalledWith({ busca: "zoetis", pagina: 1, porPagina: 20 });
  });
  it("id inválido → 404 sem consultar; item ausente → 404", async () => {
    expect((await appCom(base).request("/estoque/catalogo/abc")).status).toBe(404);
    expect(mocks.detalheCatalogo).not.toHaveBeenCalled();
    mocks.detalheCatalogo.mockRejectedValue(erroProdutoCatalogo("NAO_ENCONTRADO", "Item do catálogo não encontrado"));
    expect((await appCom(base).request(`/estoque/catalogo/${uid(2)}`)).status).toBe(404);
  });
});

describe("POST /estoque/movimentos com item do catálogo", () => {
  const corpo = { tipo: "AJUSTE", data: ontem, quantidade: 2, custoUnitario: 3, referenciaValor: "NF 9", evidenciaValor: "Nota conferida", observacao: "Inventário inicial" };
  const post = (body: unknown) => appCom(base).request("/estoque/movimentos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  it("aceita produtoCatalogoId e devolve o produtoId efetivo", async () => {
    mocks.registrarMovimento.mockResolvedValue({ id: uid(8), operacaoId: uid(9), produtoId: uid(5) });
    const r = await post({ ...corpo, produtoCatalogoId: uid(2) });
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({ produtoId: uid(5) });
    expect(mocks.registrarMovimento).toHaveBeenCalledWith(expect.objectContaining({ produtoCatalogoId: uid(2) }));
  });
  it("produtoId e produtoCatalogoId juntos → 400", async () => {
    expect((await post({ ...corpo, produtoId: uid(1), produtoCatalogoId: uid(2) })).status).toBe(400);
    expect(mocks.registrarMovimento).not.toHaveBeenCalled();
  });
  it("conflito de nome na adoção → 409 identificando o produto existente", async () => {
    mocks.registrarMovimento.mockRejectedValue(erroProdutoCatalogo("CONFLITO", "Já existe um produto da fazenda chamado “X”", "produtoCatalogoId", { id: uid(6), nome: "X" }));
    const r = await post({ ...corpo, produtoCatalogoId: uid(2) });
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ code: "CONFLITO", produtoExistente: { id: uid(6), nome: "X" } });
  });
});
