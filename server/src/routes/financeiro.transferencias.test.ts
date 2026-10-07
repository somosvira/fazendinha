import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uid } from "../lib/uid.fixture.js";
const mocks = vi.hoisted(() => ({ obter: vi.fn(), listar: vi.fn(), estornar: vi.fn(), leitura: vi.fn(), escrita: vi.fn() }));
vi.mock("../services/financeiro/operacoes.js", () => ({ obterOperacao: mocks.obter, listarOperacoes: mocks.listar, estornarOperacao: mocks.estornar }));
vi.mock("../services/propriedade.js", () => ({ resolverEscopoLeitura: mocks.leitura, resolverEscopoEscrita: mocks.escrita }));
import { financeiroRouter } from "./financeiro.js";
const dados = {
  id: uid(4), tipo: "TRANSFERENCIA_ESTOQUE", valorTotal: "8", transferencias: [{ produtoId: uid(2), quantidade: "2", unidade: "mL", custoUnitario: "4", valorTotal: "8", origem: { id: uid(1), sitio: { id: 3, nome: "Rio Novo" } }, destino: { id: uid(3), sitio: { id: 4, nome: "Destino" } } }],
  movimentosEstoque: ["SAIDA", "ENTRADA"].map((tipo, i) => ({ id: uid(i + 1), tipo, origem: "TRANSFERENCIA", quantidade: "2", custoUnitario: "4", valorTotal: "8" })),
  resumoCancelamento: { estoque: [{ quantidade: "2" }, { quantidade: "2" }] },
};
function app(areas: string[], flags: string[]) { return new Hono().use("*", async (c, next) => { c.set("usuario" as never, { id: 7, dono: false, areas, flags, abas: [], status: "ATIVO" } as never); await next(); }).route("/", financeiroRouter); }
beforeEach(() => { vi.clearAllMocks(); mocks.obter.mockResolvedValue(dados); mocks.listar.mockResolvedValue([dados]); mocks.leitura.mockResolvedValue(3); mocks.escrita.mockResolvedValue(3); mocks.estornar.mockResolvedValue({ id: uid(4) }); });
describe("visibilidade do valor da transferência", () => {
  it.each([{ areas: ["financeiro"], flags: [] }, { areas: ["estoque"], flags: ["verValores"] }])("oculta custos sem combinação de área e permissão ($areas)", async ({ areas, flags }) => {
    const resposta = await app(areas, flags).request(`/financeiro/operacoes/${uid(4)}`);
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toMatchObject({ valorTotal: null, transferencias: [{ ...dados.transferencias[0], valorTotal: null, custoUnitario: null }], movimentosEstoque: [{ custoUnitario: null, valorTotal: null }, { custoUnitario: null, valorTotal: null }], resumoCancelamento: dados.resumoCancelamento });
    expect(mocks.obter).toHaveBeenCalledWith(uid(4), 3);
  });
  it("conserva o valor congelado com Financeiro/verValores", async () => {
    expect(await (await app(["financeiro"], ["verValores"]).request(`/financeiro/operacoes/${uid(4)}`)).json()).toEqual(dados);
  });
  it("lista mascara o valor pelas origens dos movimentos sem depender do DTO", async () => {
    const { transferencias, ...lista } = dados; mocks.listar.mockResolvedValue([lista]);
    expect(await (await app(["financeiro"], []).request("/financeiro/operacoes")).json()).toMatchObject([{ valorTotal: null, movimentosEstoque: [{ valorTotal: null }, { valorTotal: null }] }]);
  });
  it.each([false, true])("cancelamento conserva IDs físicos e aplica visibilidade também às reversões (verValores=%s)", async (verValores) => {
    mocks.obter.mockResolvedValue({ ...dados, status: "CANCELADA", movimentosEstoque: [...dados.movimentosEstoque, ...dados.movimentosEstoque.map((m, i) => ({ ...m, id: uid(i + 10), origem: "AJUSTE_INVENTARIO", reversaoDeId: m.id }))] });
    const resposta = await app(["financeiro"], ["lancar", ...(verValores ? ["verValores"] : [])]).request(`/financeiro/operacoes/${uid(4)}/estorno`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ motivo: "Sítio de destino incorreto" }) });
    expect(resposta.status).toBe(201);
    const resultado = await resposta.json();
    expect(resultado.valorTotal).toBe(verValores ? "8" : null);
    expect(resultado.transferencias[0].valorTotal).toBe(verValores ? "8" : null);
    expect(resultado.movimentosEstoque).toHaveLength(4);
    expect(resultado.movimentosEstoque.every((m: { valorTotal: string | null; custoUnitario: string | null }) => m.valorTotal === (verValores ? "8" : null) && m.custoUnitario === (verValores ? "4" : null))).toBe(true);
    expect(resultado.movimentosEstoque.slice(2).map((m: { reversaoDeId: string }) => m.reversaoDeId)).toEqual([uid(1), uid(2)]);
  });
});
