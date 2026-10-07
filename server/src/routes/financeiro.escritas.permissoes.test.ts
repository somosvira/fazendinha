import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uid } from "../lib/uid.fixture.js";

const mocks = vi.hoisted(() => ({ obter: vi.fn(), salvar: vi.fn(), descartar: vi.fn(), confirmar: vi.fn(), criar: vi.fn(), escrita: vi.fn() }));
vi.mock("../services/financeiro/rascunhos.js", () => ({ obterRascunho: mocks.obter, salvarRascunho: mocks.salvar, descartarRascunho: mocks.descartar, confirmarRascunho: mocks.confirmar }));
vi.mock("../services/financeiro/operacoes.js", () => ({ criarOperacao: mocks.criar }));
vi.mock("../services/propriedade.js", () => ({ resolverEscopoEscrita: mocks.escrita }));
import { financeiroRouter } from "./financeiro.js";

function app(flags: string[] | null) {
  return new Hono().use("*", async (c, next) => {
    if (flags) c.set("usuario" as never, { id: 7, dono: false, areas: ["financeiro"], flags, abas: [], status: "ATIVO" } as never);
    await next();
  }).route("/", financeiroRouter);
}
const headers = { "content-type": "application/json" };
const prefixo = "/financeiro/operacoes";
const escritas = [
  ["PUT", `${prefixo}/rascunho`],
  ["DELETE", `${prefixo}/rascunho`],
  ["POST", `${prefixo}/rascunho/confirmacao`],
  ["POST", `${prefixo}/rascunho/documentos/intencao`],
  ["POST", `${prefixo}/rascunho/documentos/confirmacao-upload`],
  ["DELETE", `${prefixo}/rascunho/documentos/${uid(1)}`],
  ["PATCH", `${prefixo}/rascunho/documentos/${uid(1)}`],
  ["POST", prefixo],
  ["POST", `${prefixo}/${uid(1)}/documentos/intencao`],
  ["POST", `${prefixo}/${uid(1)}/documentos/confirmacao-upload`],
  ["POST", `/financeiro/compromissos/${uid(1)}/liquidacoes`],
  ["POST", "/financeiro/transferencias"],
  ["POST", "/financeiro/transacoes"],
] as const;

beforeEach(() => {
  vi.clearAllMocks(); mocks.escrita.mockResolvedValue(3);
  mocks.obter.mockResolvedValue({ id: uid(1), dados: {} });
  mocks.salvar.mockResolvedValue({ id: uid(1), dados: {} });
  mocks.descartar.mockResolvedValue(undefined);
  mocks.confirmar.mockResolvedValue({ id: uid(2) }); mocks.criar.mockResolvedValue({ id: uid(2) });
});

describe("escritas financeiras exigem lancar antes de validar ou acessar dados", () => {
  it.each(escritas)("somente leitura não executa %s %s", async (method, path) => {
    const resposta = await app(["verValores"]).request(path, { method, headers, body: JSON.stringify({}) });
    expect(resposta.status).toBe(403);
    expect(await resposta.json()).toEqual({ error: "sem permissão" });
    for (const mock of Object.values(mocks)) expect(mock).not.toHaveBeenCalled();
  });
  it("sem autenticação não confirma operação", async () => {
    const resposta = await app(null).request(`${prefixo}/rascunho/confirmacao`, { method: "POST", headers, body: "{}" });
    expect(resposta.status).toBe(401); expect(mocks.confirmar).not.toHaveBeenCalled();
  });
  it("leitura do próprio rascunho continua disponível", async () => {
    const resposta = await app([]).request(`${prefixo}/rascunho`);
    expect(resposta.status).toBe(200); expect(mocks.obter).toHaveBeenCalledWith(3, 7);
  });
  it("operador salva, confirma e descarta o próprio rascunho", async () => {
    const operador = app(["lancar"]);
    expect((await operador.request(`${prefixo}/rascunho`, { method: "PUT", headers, body: JSON.stringify({ dados: { formulario: {} } }) })).status).toBe(200);
    expect(mocks.salvar).toHaveBeenCalledWith({ dados: { formulario: {} }, propriedadeId: 3, usuarioId: 7 });
    const chave = uid(9);
    expect((await operador.request(`${prefixo}/rascunho/confirmacao`, { method: "POST", headers, body: JSON.stringify({ chave, versao: 1 }) })).status).toBe(201);
    expect(mocks.confirmar).toHaveBeenCalledWith(3, 7, 1, chave);
    expect((await operador.request(`${prefixo}/rascunho`, { method: "DELETE" })).status).toBe(204);
    expect(mocks.descartar).toHaveBeenCalledWith(3, 7);
  });
  it("operador continua lançando pela rota direta", async () => {
    const resposta = await app(["lancar"]).request(prefixo, { method: "POST", headers, body: JSON.stringify({
      tipo: "COMPRA_ESTOQUE", data: "2026-09-10", descricao: "Compra de vacina", propriedadeId: 3, parceiroId: uid(2),
      itens: [{ descricao: "Vacina", produtoId: uid(1), quantidade: 50, unidade: "mL", valorTotal: 100, estocavel: true }],
      financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" },
    }) });
    expect(resposta.status).toBe(201); expect(mocks.criar).toHaveBeenCalledWith(expect.objectContaining({ propriedadeId: 3, usuarioId: 7 }));
  });
});
