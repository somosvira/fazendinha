import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uid } from "../lib/uid.fixture.js";
const mocks = vi.hoisted(() => ({ obter: vi.fn(), listar: vi.fn(), estornar: vi.fn(), leitura: vi.fn(), escrita: vi.fn() }));
vi.mock("../services/financeiro/operacoes.js", () => ({ obterOperacao: mocks.obter, listarOperacoes: mocks.listar, estornarOperacao: mocks.estornar }));
vi.mock("../services/propriedade.js", () => ({ resolverEscopoLeitura: mocks.leitura, resolverEscopoEscrita: mocks.escrita }));
import { financeiroRouter } from "./financeiro.js";
const perda = { movimentoId: uid(1), produtoId: uid(2), produtoNome: "Vacina", quantidade: "2", unidade: "mL", sitio: { id: 3, nome: "Rio Novo" }, motivo: "Embalagem danificada", custoUnitario: "4", valorTotal: "8", lotes: [{ id: uid(9), nome: "Lote outubro", validade: "2026-12-31", quantidade: "2" }] };
const dados = { id: uid(4), valorTotal: "8", perdas: [perda], movimentosEstoque: [{ id: uid(1), origem: "PERDA", quantidade: "2", custoUnitario: "4", valorTotal: "8" }], resumoCancelamento: { estoque: [{ quantidade: "2" }] } };
function app(areas: string[], flags: string[]) { return new Hono().use("*", async (c, next) => { c.set("usuario" as never, { id: 7, dono: false, areas, flags, abas: [], status: "ATIVO" } as never); await next(); }).route("/", financeiroRouter); }
beforeEach(() => { vi.clearAllMocks(); mocks.obter.mockResolvedValue(dados); mocks.listar.mockResolvedValue([dados]); mocks.leitura.mockResolvedValue(3); mocks.escrita.mockResolvedValue(3); mocks.estornar.mockResolvedValue({ id: uid(4), status: "CANCELADA", valorTotal: "8" }); });
describe("custos no detalhe da perda", () => {
  it("mascara atribuições e valores do Serviço também nos objetos relacionados", async () => {
    mocks.obter.mockResolvedValue({ ...dados, tipo: "SERVICO", perdas: [], movimentosEstoque: [], procedimentosServico: [{ id: uid(2), animal: { brinco: "GV3-S2" }, valor: "200" }], procedimentosSanitarios: { exames: [{ valorServicoAtribuido: "200" }] }, compromissos: [{ descricao: "Atendimento", valorOriginal: "1000", valorLiquidado: "200", saldoPendente: "800", saldoExigivel: "800" }], resumoCancelamento: { compromissos: [{ valorOriginal: "1000", saldoExigivel: "800" }], impactosPorConta: [{ conta: { nome: "Conta teste" }, entrada: "200", saida: "0" }] }, itens: [{ descricao: "Visita", valorTotal: "1000" }] });
    const res = await app(["financeiro"], []).request(`/financeiro/operacoes/${uid(4)}`);
    expect(await res.json()).toMatchObject({ valorTotal: null, procedimentosServico: [{ animal: { brinco: "GV3-S2" }, valor: null }], procedimentosSanitarios: { exames: [{ valorServicoAtribuido: null }] }, compromissos: [{ descricao: "Atendimento", valorOriginal: null, valorLiquidado: null, saldoPendente: null, saldoExigivel: null }], resumoCancelamento: { compromissos: [{ valorOriginal: null, saldoExigivel: null }], impactosPorConta: [{ conta: { nome: "Conta teste" }, entrada: null, saida: null }] }, itens: [{ descricao: "Visita", valorTotal: null }] });
    const visivel = await app(["financeiro"], ["verValores"]).request(`/financeiro/operacoes/${uid(4)}`);
    expect(await visivel.json()).toMatchObject({ valorTotal: "8", procedimentosServico: [{ valor: "200" }], compromissos: [{ valorOriginal: "1000", saldoPendente: "800", saldoExigivel: "800" }] });
  });
  it.each([{ areas: ["financeiro"] }, { areas: ["pecuaria"] }])("sem combinação Financeiro/verValores conserva físico e oculta valores ($areas)", async ({ areas }) => {
    const resposta = await app(areas, areas[0] === "financeiro" ? [] : ["verValores"]).request(`/financeiro/operacoes/${uid(4)}`);
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toMatchObject({ valorTotal: null, perdas: [{ ...perda, valorTotal: null, custoUnitario: null }], movimentosEstoque: [{ valorTotal: null, custoUnitario: null }], resumoCancelamento: dados.resumoCancelamento });
    expect(mocks.obter).toHaveBeenCalledWith(uid(4), 3);
  });
  it("Financeiro e verValores recebem o custo congelado", async () => {
    const resposta = await app(["financeiro"], ["verValores"]).request(`/financeiro/operacoes/${uid(4)}`);
    expect(await resposta.json()).toEqual(dados);
  });
  it("lista operações mascara perdas pelo movimento sem depender do DTO de detalhe", async () => {
    const { perdas, ...listagem } = dados;
    mocks.listar.mockResolvedValue([listagem]);
    const resposta = await app(["financeiro"], []).request("/financeiro/operacoes");
    expect(await resposta.json()).toMatchObject([{ valorTotal: null, movimentosEstoque: [{ origem: "PERDA", quantidade: "2", valorTotal: null, custoUnitario: null }] }]);
    expect(mocks.listar).toHaveBeenCalledWith(3, undefined, undefined);
  });
  it("lista operações conserva custo da perda quando ambas permissões estão presentes", async () => {
    const resposta = await app(["financeiro"], ["verValores"]).request("/financeiro/operacoes");
    expect(await resposta.json()).toEqual([dados]);
  });
  it.each([{ flags: ["lancar"], valorTotal: null }, { flags: ["lancar", "verValores"], valorTotal: "8" }])("estorno respeita visibilidade de custos ($flags)", async ({ flags, valorTotal }) => {
    mocks.obter.mockResolvedValue({ ...dados, status: "CANCELADA", movimentosEstoque: [...dados.movimentosEstoque, { id: uid(9), origem: "AJUSTE_INVENTARIO", quantidade: "2", custoUnitario: "4", valorTotal: "8", reversaoDeId: uid(1) }] });
    const resposta = await app(["financeiro"], flags).request(`/financeiro/operacoes/${uid(4)}/estorno`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ motivo: "Perda lançada incorretamente" }) });
    expect(resposta.status).toBe(201);
    expect(await resposta.json()).toMatchObject({ status: "CANCELADA", valorTotal, perdas: [{ produtoNome: "Vacina", quantidade: "2", valorTotal, custoUnitario: valorTotal == null ? null : "4" }], movimentosEstoque: [{ valorTotal }, { valorTotal }] });
    expect(mocks.estornar).toHaveBeenCalledWith(uid(4), "Perda lançada incorretamente", { propriedadeId: 3, usuarioId: 7 });
    expect(mocks.obter).toHaveBeenCalledWith(uid(4), 3);
  });
  it("não cancela nem relê a operação sem lancar", async () => {
    const resposta = await app(["financeiro"], ["verValores"]).request(`/financeiro/operacoes/${uid(4)}/estorno`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ motivo: "Perda lançada incorretamente" }) });
    expect(resposta.status).toBe(403);
    expect(mocks.estornar).not.toHaveBeenCalled(); expect(mocks.obter).not.toHaveBeenCalled();
  });
});
