import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ obter: vi.fn(), listar: vi.fn(), criar: vi.fn(), transacao: vi.fn(), transferencia: vi.fn(), estornar: vi.fn(), configuracoes: vi.fn(), parceiros: vi.fn(), gerenciais: vi.fn(), produtos: vi.fn(), leitura: vi.fn(), escrita: vi.fn(), rascunho: vi.fn() }));
vi.mock("../services/financeiro/operacoes.js", () => ({ obterOperacao: mocks.obter, listarOperacoes: mocks.listar, criarOperacao: mocks.criar, criarTransacaoAvulsa: mocks.transacao, transferir: mocks.transferencia, estornarTransacao: mocks.estornar }));
vi.mock("../services/financeiro/contas.js", () => ({ listarContas: mocks.configuracoes }));
vi.mock("../services/financeiro/parceiros.js", () => ({ listarParceiros: mocks.parceiros }));
vi.mock("../services/financeiro/cadastros-gerenciais.js", () => ({ listarCadastrosGerenciais: mocks.gerenciais }));
vi.mock("../services/estoque/produtos.js", () => ({ listarProdutosCadastro: mocks.produtos }));
vi.mock("../services/financeiro/rascunhos.js", () => ({ obterRascunho: mocks.rascunho }));
vi.mock("../services/propriedade.js", () => ({ resolverEscopoLeitura: mocks.leitura, resolverEscopoEscrita: mocks.escrita }));
import { financeiroRouter } from "./financeiro.js";
import { uid } from "../lib/uid.fixture.js";
const op = { id: uid(1), tipo: "COMPRA_ESTOQUE", valorTotal: "987.65", itens: [{ quantidade: "2", valorUnitario: "987.65", valorTotal: "987.65" }], movimentosEstoque: [{ origem: "COMPRA", quantidade: "2", custoUnitario: "987.65", valorTotal: "987.65" }], compromissos: [], transacoes: [] };
function app(flags: string[] = [], dono = false, areas = ["financeiro"]) { return new Hono().use("*", async (c, next) => { c.set("usuario" as never, { id: 7, dono, areas, flags, abas: ["relatorio"], status: "ATIVO" } as never); await next(); }).route("/", financeiroRouter); }
beforeEach(() => { vi.clearAllMocks(); mocks.obter.mockResolvedValue(op); mocks.listar.mockResolvedValue([op]); mocks.leitura.mockResolvedValue(3); mocks.escrita.mockResolvedValue(3); mocks.configuracoes.mockResolvedValue([{ id: "conta", saldoAbertura: "987.65", saldoAtual: "987.65", temMovimentos: true }]); mocks.parceiros.mockResolvedValue([]); mocks.gerenciais.mockResolvedValue({}); mocks.produtos.mockResolvedValue([]); mocks.criar.mockResolvedValue(op); });
describe("perfis e escopo dos DTOs financeiros", () => {
  it.each([{ flags: [], dono: false, areas: ["financeiro"], visivel: false }, { flags: ["verValores"], dono: false, areas: ["pecuaria"], visivel: false }, { flags: ["verValores"], dono: false, areas: ["financeiro"], visivel: true }, { flags: [], dono: true, areas: [], visivel: true }])("lista/detalhe respeitam perfil $visivel e sítio", async ({ flags, dono, areas, visivel }) => {
    const api = app(flags, dono, areas);
    const detalhe = await (await api.request(`/financeiro/operacoes/${uid(1)}`)).json();
    expect(detalhe.valorTotal).toBe(visivel ? "987.65" : null);
    expect(detalhe.itens[0].quantidade).toBe("2");
    expect(detalhe.itens[0].valorUnitario).toBe(visivel ? "987.65" : null);
    expect(mocks.obter).toHaveBeenCalledWith(uid(1), 3);
    expect((await (await api.request("/financeiro/operacoes")).json())[0].valorTotal).toBe(visivel ? "987.65" : null);
    expect(mocks.listar).toHaveBeenCalledWith(3, undefined, undefined);
  });
  it("catálogo operacional conserva contas selecionáveis mas não saldos", async () => {
    const r = await (await app().request("/financeiro/configuracoes")).json();
    expect(r.contas).toEqual([{ id: "conta", saldoAbertura: null, saldoAtual: null, temMovimentos: true }]);
    expect(mocks.configuracoes).toHaveBeenCalledWith(3, true);
  });
  it.each(["dashboard", "analise-categorias", "contas", "extrato-geral", `contas/${uid(1)}/extrato`, "compromissos", `documentos/${uid(1)}/download`, "operacoes/rascunho"])("recusa leitura monetária %s antes de consultar dados", async path => {
    expect((await app(["lancar"]).request(`/financeiro/${path}`)).status).toBe(403);
    expect(mocks.rascunho).not.toHaveBeenCalled(); expect(mocks.leitura).not.toHaveBeenCalled();
  });
  it("grava operação com preços manuais, mas mascara também a resposta de escrita", async () => {
    const r = await app(["lancar"]).request("/financeiro/operacoes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tipo: "COMPRA_ESTOQUE", data: "2026-09-10", propriedadeId: 3, descricao: "Compra", parceiroId: uid(2), itens: [{ descricao: "Produto", produtoId: uid(3), quantidade: 2, unidade: "KG", valorTotal: 987.65, estocavel: true }], financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" } }) });
    expect(r.status).toBe(201); expect((await r.json()).valorTotal).toBeNull();
    expect(mocks.criar).toHaveBeenCalledWith(expect.objectContaining({ propriedadeId: 3, usuarioId: 7 }));
  });
  it.each([
    ["PUT", "/financeiro/operacoes/rascunho"], ["DELETE", "/financeiro/operacoes/rascunho"],
    ["POST", "/financeiro/operacoes/rascunho/confirmacao"], ["POST", "/financeiro/operacoes/rascunho/documentos/intencao"],
    ["POST", `/financeiro/operacoes/${uid(1)}/estorno`], ["POST", `/financeiro/transacoes/${uid(1)}/estorno`],
    ["POST", `/financeiro/compromissos/${uid(1)}/liquidacoes`], ["POST", "/financeiro/contas"], ["PATCH", `/financeiro/contas/${uid(1)}`],
  ])("sem valores recusa escrita que revisa fatos monetários %s %s antes de ler", async (method, path) => {
    expect((await app(["lancar"]).request(path, { method, headers: { "content-type": "application/json" }, body: "{}" })).status).toBe(403);
    expect(mocks.escrita).not.toHaveBeenCalled(); expect(mocks.rascunho).not.toHaveBeenCalled();
  });
  it("recusa correção de operação oculta mesmo com lancar", async () => {
    const r = await app(["lancar"]).request("/financeiro/operacoes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tipo: "COMPRA_ESTOQUE", corrigeOperacaoId: uid(8), data: "2026-09-10", propriedadeId: 3, descricao: "Correção", parceiroId: uid(2), itens: [{ descricao: "Produto", produtoId: uid(3), quantidade: 2, unidade: "KG", valorTotal: 987.65, estocavel: true }], financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" } }) });
    expect(r.status).toBe(403); expect(mocks.criar).not.toHaveBeenCalled(); expect(mocks.escrita).not.toHaveBeenCalled();
  });
  it.each([
    ["/financeiro/transacoes", { tipo: "PAGAMENTO", contaId: uid(2), valor: 987.65, data: "2026-09-10", descricao: "Pagamento manual" }, "transacao"],
    ["/financeiro/transferencias", { contaOrigemId: uid(2), contaDestinoId: uid(3), valor: 987.65, data: "2026-09-10" }, "transferencia"],
  ] as const)("resposta de %s não revela nem total nem movimentos ao operador", async (path, body, mock) => {
    mocks[mock].mockResolvedValue({ id: uid(4), valorTotal: "987.65", movimentos: [{ quantidade: 2, valor: "987.65", contaId: uid(2) }] });
    const r = await app(["lancar"]).request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({ id: uid(4), valorTotal: null, movimentos: [{ quantidade: 2, valor: null, contaId: uid(2) }] });
    expect(mocks[mock]).toHaveBeenCalledWith(expect.objectContaining({ propriedadeId: 3, usuarioId: 7 }));
  });
});
