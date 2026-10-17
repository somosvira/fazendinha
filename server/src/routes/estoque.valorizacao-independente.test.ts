import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uid } from "../lib/uid.fixture.js";

const mocks = vi.hoisted(() => ({ diagnosticar: vi.fn(), abrir: vi.fn(), leitura: vi.fn(), escrita: vi.fn(), obterOperacao: vi.fn(), listarOperacoes: vi.fn(), criarOperacao: vi.fn() }));
vi.mock("../services/estoque/valorizacao.js", async original => ({
  ...await original<typeof import("../services/estoque/valorizacao.js")>(), diagnosticarValorizacao: mocks.diagnosticar, abrirValorizacao: mocks.abrir,
}));
vi.mock("../services/propriedade.js", async original => ({
  ...await original<typeof import("../services/propriedade.js")>(), resolverEscopoLeitura: mocks.leitura, resolverEscopoEscrita: mocks.escrita,
}));
vi.mock("../services/financeiro/operacoes.js", async original => ({
  ...await original<typeof import("../services/financeiro/operacoes.js")>(), obterOperacao: mocks.obterOperacao, listarOperacoes: mocks.listarOperacoes, criarOperacao: mocks.criarOperacao,
}));
import { ValorizacaoError } from "../services/estoque/valorizacao.calc.js";
import { estoqueRouter } from "./estoque.js";
import { financeiroRouter } from "./financeiro.js";

const produtoId = uid(2);
const endereco = `/estoque/produtos/${produtoId}/valorizacao`;
const usuario = (areas = ["financeiro", "pecuaria"], flags = ["lancar", "verValores"]) => ({ id: 7, dono: false, areas, flags, abas: [], status: "ATIVO" });
function app(perfil = usuario()) {
  return new Hono().use("*", async (c, next) => { c.set("usuario" as never, perfil as never); await next(); })
    .route("/", estoqueRouter).route("/", financeiroRouter);
}
const abertura = () => ({ chave: uid(1), propriedadeId: 3, data: "2026-10-01", revisao: "a".repeat(64), motivo: "Contagem e valor comprovados", evidencia: "Documento de aquisição conferido", bases: [{ quantidade: "10", valor: "100.00", referencia: "Aquisição documentada" }] });
const requisicao = (corpo: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
const compra = () => ({
  id: uid(9), tipo: "COMPRA_ESTOQUE", valorTotal: "320.00", movimentosEstoque: [{ origem: "COMPRA", custoUnitario: "1.9334", valorTotal: "290.00" }],
  itens: [{ quantidade: "150", valorUnitario: "1.9334", valorTotal: "290.00" }],
  composicaoComercial: {
    versao: 1, itens: [{ ordem: 1, bruto: "300.00", desconto: "10.00", liquido: "290.00", elegivel: true }],
    logistica: { valor: "30.00", descricao: "Transporte", obrigacao: "MESMO_FORNECEDOR" }, descontoComercial: "10.00",
  },
});
function conferirComposicaoOculta(dados: ReturnType<typeof compra>) {
  expect(dados.valorTotal).toBeNull();
  expect(dados.itens[0]).toMatchObject({ quantidade: "150", valorUnitario: null, valorTotal: null });
  expect(dados.movimentosEstoque[0]).toMatchObject({ custoUnitario: null, valorTotal: null });
  if (dados.composicaoComercial !== null) {
    expect(dados.composicaoComercial.itens[0]).toMatchObject({ bruto: null, desconto: null, liquido: null });
    expect(dados.composicaoComercial.logistica.valor).toBeNull();
    expect(dados.composicaoComercial.descontoComercial).toBeNull();
  }
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.leitura.mockResolvedValue(4); mocks.escrita.mockResolvedValue(3);
  mocks.diagnosticar.mockResolvedValue({ produtoId, propriedadeId: 4, revisao: "a".repeat(64), grupos: [{ quantidade: "10", estadoValor: "CONHECIDO", valor: "100.00" }] });
  mocks.abrir.mockResolvedValue({ salvo: true, reenvio: false });
  mocks.obterOperacao.mockResolvedValue(compra()); mocks.listarOperacoes.mockResolvedValue([compra()]); mocks.criarOperacao.mockResolvedValue(compra());
});

describe("autorização e contratos HTTP independentes da valorização", () => {
  it.each([
    { nome: "área financeira ausente", perfil: usuario(["pecuaria"], ["lancar", "verValores"]) },
    { nome: "permissão de valores ausente", perfil: usuario(["financeiro"], ["lancar"]) },
  ])("não consulta valores com $nome", async ({ perfil }) => {
    const resposta = await app(perfil).request(endereco);
    expect(resposta.status).toBe(403);
    expect(mocks.diagnosticar).not.toHaveBeenCalled();
    expect(JSON.stringify(await resposta.json())).not.toContain("100.00");
  });

  it.each([
    { nome: "sem lançamento", perfil: usuario(["financeiro"], ["verValores"]) },
    { nome: "sem valores", perfil: usuario(["financeiro"], ["lancar"]) },
    { nome: "sem área financeira", perfil: usuario(["pecuaria"], ["lancar", "verValores"]) },
  ])("não registra abertura $nome", async ({ perfil }) => {
    expect((await app(perfil).request(`${endereco}/abertura`, requisicao(abertura()))).status).toBe(403);
    expect(mocks.abrir).not.toHaveBeenCalled();
  });

  it("o resolvedor existente determina o sítio da leitura, inclusive na combinação header/query", async () => {
    mocks.leitura.mockResolvedValue(8);
    const resposta = await app().request(`${endereco}?propriedadeId=3&data=2026-10-01`, { headers: { "X-Propriedade-Id": "8" } });
    expect(resposta.status).toBe(200);
    expect(mocks.leitura).toHaveBeenCalled();
    expect(mocks.diagnosticar).toHaveBeenCalledWith(produtoId, 8, new Date("2026-10-01"));
  });

  it("abertura recebe sítio resolvido e autoria da sessão", async () => {
    mocks.escrita.mockResolvedValue(6);
    const resposta = await app().request(`${endereco}/abertura`, requisicao(abertura()));
    expect(resposta.status).toBe(201);
    expect(mocks.escrita).toHaveBeenCalledWith(expect.anything(), 3);
    expect(mocks.abrir).toHaveBeenCalledWith({ ...abertura(), propriedadeId: 6, produtoId }, 7);
  });

  it.each(["SEM_LASTRO", "CONFLITO", "SALDO_INSUFICIENTE"] as const)("erro de domínio %s é conflito legível, sem 500", async code => {
    mocks.abrir.mockRejectedValue(new ValorizacaoError(code, "Regularização necessária"));
    const resposta = await app().request(`${endereco}/abertura`, requisicao(abertura()));
    expect(resposta.status).toBe(409);
    expect(await resposta.json()).toMatchObject({ code, error: "Regularização necessária" });
  });

  it.each([
    { nome: "produto inválido", url: "/estoque/produtos/invalido/valorizacao" },
    { nome: "sítio fora do Int4", url: `${endereco}?propriedadeId=2147483648` },
    { nome: "sítio inválido", url: `${endereco}?propriedadeId=abc` },
  ])("rejeita $nome antes do serviço", async ({ url }) => {
    const resposta = await app().request(url);
    expect(resposta.status).toBeGreaterThanOrEqual(400);
    expect(resposta.status).toBeLessThan(500);
    expect(mocks.diagnosticar).not.toHaveBeenCalled();
  });

  it("abertura sem evidência não chega ao serviço", async () => {
    const resposta = await app().request(`${endereco}/abertura`, requisicao({ ...abertura(), evidencia: "" }));
    expect(resposta.status).toBeGreaterThanOrEqual(400);
    expect(resposta.status).toBeLessThan(500);
    expect(mocks.abrir).not.toHaveBeenCalled();
  });
});

describe("composição comercial protegida também nos DTOs de compra", () => {
  const semValores = () => app(usuario(["financeiro"], ["lancar"]));
  it("detalhe não revela bruto, desconto, líquido ou logística sem verValores", async () => {
    const resposta = await semValores().request(`/financeiro/operacoes/${uid(9)}`);
    expect(resposta.status).toBe(200);
    conferirComposicaoOculta(await resposta.json());
  });
  it("listagem aplica a mesma proteção à composição aninhada", async () => {
    const resposta = await semValores().request("/financeiro/operacoes");
    expect(resposta.status).toBe(200);
    const dados = await resposta.json() as ReturnType<typeof compra>[];
    conferirComposicaoOculta(dados[0]);
  });
  it("confirmação e reenvio não revelam a composição armazenada", async () => {
    const corpo = { chave: uid(1), tipo: "COMPRA_ESTOQUE", data: "2026-10-01", descricao: "Compra com logística e desconto", parceiroId: uid(3),
      itens: [{ produtoId, descricao: "Material", quantidade: 150, unidade: "DOSE", valorTotal: 300 }],
      descontoComercial: 10, logistica: { valor: 30, descricao: "Transporte", categoriaId: uid(4) }, financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" } };
    for (let envio = 0; envio < 2; envio++) {
      const resposta = await semValores().request("/financeiro/operacoes", requisicao(corpo));
      expect(resposta.status).toBe(201);
      conferirComposicaoOculta(await resposta.json());
    }
  });
  it("usuário autorizado conserva os valores comprovados da composição", async () => {
    const resposta = await app().request(`/financeiro/operacoes/${uid(9)}`);
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual(compra());
  });
});
