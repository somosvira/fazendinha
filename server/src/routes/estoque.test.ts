import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SEM_VINCULO } from "../lib/ids.js";
import { uid } from "../lib/uid.fixture.js";

const mocks = vi.hoisted(() => ({
  listarSaldos: vi.fn(),
  ajustarContagem: vi.fn(),
  listarMovimentos: vi.fn(),
  registrarMovimento: vi.fn(),
  escrita: vi.fn(),
  leitura: vi.fn(),
  listarProdutos: vi.fn(),
  criarProduto: vi.fn(),
  atualizarProduto: vi.fn(),
  listarCategorias: vi.fn(),
  listarCentrosCusto: vi.fn(),
  listarParceiros: vi.fn(),
  obterUltimoPreco: vi.fn(),
  obterCustoMedio: vi.fn(),
}));

vi.mock("../services/estoque/estoque.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../services/estoque/estoque.js")>();
  return {
    ...real,
    listarSaldos: mocks.listarSaldos,
    ajustarContagem: mocks.ajustarContagem,
    listarMovimentos: mocks.listarMovimentos,
    registrarMovimento: mocks.registrarMovimento,
    obterCustoMedio: mocks.obterCustoMedio,
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
    obterUltimoPreco: mocks.obterUltimoPreco,
  };
});
vi.mock("../services/estoque/referencias.js", () => ({
  listarCategorias: mocks.listarCategorias,
  listarCentrosCusto: mocks.listarCentrosCusto,
}));
vi.mock("../services/financeiro/parceiros.js", () => ({ listarParceiros: mocks.listarParceiros }));

import { estoqueRouter } from "./estoque.js";
import { exigeQualquerArea } from "../middleware/permissao.js";

const base = { id: 7, nome: "Peão", email: "p@x", papel: "OPERADOR", abas: [], areas: ["pecuaria"], status: "ATIVO", dono: false };
const semLancar = { ...base, areas: ["pecuaria", "financeiro"], flags: ["verValores"] };
const comLancar = { ...base, flags: ["lancar"] };
const soFinanceiro = { ...base, id: 9, areas: ["financeiro"], flags: ["verValores"] };

function appCom(usuario: unknown) {
  return new Hono().use("*", async (c, next) => { c.set("usuario" as never, usuario as never); await next(); }).use("/estoque/*", exigeQualquerArea(["pecuaria", "financeiro"])).route("/", estoqueRouter);
}

const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const json = { "content-type": "application/json" };
const escritas = [
  { nome: "POST /estoque/ajustes", req: () => ["/estoque/ajustes", { method: "POST", headers: json, body: JSON.stringify({ produtoId: uid(1), quantidadeContada: 5, saldoEsperado: 10, observacao: "Contagem física" }) }] as const, svc: mocks.ajustarContagem },
  { nome: "POST /estoque/movimentos", req: () => ["/estoque/movimentos", { method: "POST", headers: json, body: JSON.stringify({ produtoId: uid(1), tipo: "AJUSTE", data: ontem, quantidade: -2, observacao: "Ajuste conferido" }) }] as const, svc: mocks.registrarMovimento },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.leitura.mockResolvedValue(3);
  mocks.escrita.mockResolvedValue(3);
  mocks.listarSaldos.mockResolvedValue([]);
  mocks.listarMovimentos.mockResolvedValue({ itens: [], total: 0 });
  mocks.ajustarContagem.mockResolvedValue({ id: uid(1), operacaoId: uid(2) });
  mocks.registrarMovimento.mockResolvedValue({ id: uid(1), operacaoId: uid(2) });
  mocks.listarProdutos.mockResolvedValue([]);
  mocks.criarProduto.mockResolvedValue({ id: uid(1) });
  mocks.atualizarProduto.mockResolvedValue({ id: uid(1) });
  mocks.listarCategorias.mockResolvedValue([]);
  mocks.listarCentrosCusto.mockResolvedValue([]);
  mocks.listarParceiros.mockResolvedValue([]);
  mocks.obterCustoMedio.mockResolvedValue(null);
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
  });
});

describe("GET /estoque/saldos", () => {
  it("oculta custos sem Financeiro ou sem verValores, mantendo o saldo físico", async () => {
    mocks.listarSaldos.mockResolvedValue([{ produtoId: uid(1), saldo: 40, custoMedio: 2, valor: 80 }]);
    for (const usuario of [{ ...base, flags: ["verValores"] }, { ...base, areas: ["financeiro"], flags: [] }]) {
      const res = await appCom(usuario).request("/estoque/saldos");
      expect(await res.json()).toEqual([{ produtoId: uid(1), saldo: 40, custoMedio: null, valor: null }]);
    }
  });
  it("lê sem flag lancar (gate de área fica no app)", async () => {
    const res = await appCom(semLancar).request(`/estoque/saldos?centroCustoId=${SEM_VINCULO}`);
    expect(res.status).toBe(200);
    expect(mocks.listarSaldos).toHaveBeenCalledWith(expect.objectContaining({ centroCustoId: SEM_VINCULO, propriedadeId: 3, materialGeneticoVisivel: true }));
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
  it("mantém partidas e quantidades, mas não expõe custos sem permissão financeira", async () => {
    const partidas = [{ partidaId: uid(2), quantidade: "10" }];
    mocks.listarMovimentos.mockResolvedValue({ itens: [{ quantidade: 10, custoUnitario: 2, valorTotal: 20, partidas }], total: 1 });
    const res = await appCom({ ...base, flags: [] }).request("/estoque/movimentos");
    expect(await res.json()).toEqual({ itens: [{ quantidade: 10, custoUnitario: null, valorTotal: null, partidas, operacaoId: null, operacaoNumero: null }], total: 1 });
  });
  it.each(["abc", "-1", "1.5"])("produtoId=%s → 400", async (v) => {
    const res = await appCom(semLancar).request(`/estoque/movimentos?produtoId=${v}`);
    expect(res.status).toBe(400);
    expect(mocks.listarSaldos).not.toHaveBeenCalled();
  });
  it("tipo inválido → 400", async () => {
    const res = await appCom(semLancar).request("/estoque/movimentos?tipo=INVALIDO");
    expect(res.status).toBe(400);
  });
  it.each(["pagina=0", "porPagina=101", "porPagina=0", "origem=X", "centroCustoId=-1", "de=10/09/2026", "q=" + "a".repeat(81)])("filtro inválido %s → 400", async (qs) => {
    const res = await appCom(semLancar).request(`/estoque/movimentos?${qs}`);
    expect(res.status).toBe(400);
  });
  it("repassa filtros e paginação (padrão 15) ao service", async () => {
    await appCom(semLancar).request(`/estoque/movimentos?q=OP-0011&origem=COMPRA&centroCustoId=${SEM_VINCULO}&de=2026-09-01&ate=2026-09-30&pagina=2`);
    expect(mocks.listarMovimentos).toHaveBeenLastCalledWith(expect.objectContaining({ q: "OP-0011", origem: "COMPRA", centroCustoId: SEM_VINCULO, de: "2026-09-01", ate: "2026-09-30", pagina: 2, porPagina: 15 }));
  });
  it("abre um movimento específico no sítio histórico sem usar o sítio ativo", async () => {
    const id = uid(98);
    await appCom(semLancar).request(`/estoque/movimentos?movimentoId=${id}&propriedadeId=7`);
    expect(mocks.listarMovimentos).toHaveBeenLastCalledWith(expect.objectContaining({ movimentoId: id, propriedadeId: 7 }));
  });
  it("repassa ao service quais vínculos o usuário pode ver, pelas áreas", async () => {
    await appCom({ ...base, areas: ["financeiro"], flags: [] }).request("/estoque/movimentos");
    expect(mocks.listarMovimentos).toHaveBeenLastCalledWith(expect.objectContaining({ propriedadeId: 3, vinculosVisiveis: { pecuaria: false } }));
    await appCom(soFinanceiro).request("/estoque/movimentos");
    expect(mocks.listarMovimentos).toHaveBeenLastCalledWith(expect.objectContaining({ vinculosVisiveis: { pecuaria: false } }));
    await appCom({ ...base, areas: [], dono: true, flags: [] }).request("/estoque/movimentos");
    expect(mocks.listarMovimentos).toHaveBeenLastCalledWith(expect.objectContaining({ vinculosVisiveis: { pecuaria: true } }));
  });
});

describe("rotas órfãs removidas", () => {
  it("DELETE /estoque/movimentos/:id não existe (movimento só é desfeito pelo domínio de origem)", async () => {
    const res = await appCom(comLancar).request("/estoque/movimentos/42", { method: "DELETE" });
    expect(res.status).toBe(404);
  });
  it("GET /estoque/custo-vaca-dia não existe (custo vaca/dia vem do custo de produção)", async () => {
    const res = await appCom(semLancar).request("/estoque/custo-vaca-dia?dias=30");
    expect(res.status).toBe(404);
  });
});

describe("GET /estoque/produtos ?uso=", () => {
  it.each(["genetico", "sanitario", "nutricional"])("uso %s → 200 e repassa ao service", async (uso) => {
    mocks.listarProdutos.mockResolvedValue([]);
    const res = await appCom(soFinanceiro).request(`/estoque/produtos?uso=${uso}`);
    expect(res.status).toBe(200);
    expect(mocks.listarProdutos).toHaveBeenCalledWith(expect.objectContaining({ uso }));
  });
  it.each(["invalido", "agricola"])("uso %s → 400", async (uso) => {
    const res = await appCom(soFinanceiro).request(`/estoque/produtos?uso=${uso}`);
    expect(res.status).toBe(400);
  });
});

describe("acesso de usuário só-financeiro aos cadastros do estoque", () => {
  it("GET /estoque/produtos → 200", async () => {
    const res = await appCom(soFinanceiro).request("/estoque/produtos");
    expect(res.status).toBe(200);
  });
  it("GET /estoque/categorias → 200", async () => {
    const res = await appCom(soFinanceiro).request("/estoque/categorias");
    expect(res.status).toBe(200);
  });
  it("GET /estoque/centros-custo → 200", async () => {
    const res = await appCom(soFinanceiro).request("/estoque/centros-custo");
    expect(res.status).toBe(200);
  });
  it("GET /estoque/fornecedores → 200", async () => {
    const res = await appCom(soFinanceiro).request("/estoque/fornecedores");
    expect(res.status).toBe(200);
  });
});

describe("GET /estoque/fornecedores", () => {
  it("devolve só parceiros com papel FORNECEDOR", async () => {
    mocks.listarParceiros.mockResolvedValue([
      { id: uid(1), nome: "Cooperativa", tipo: "FORNECEDOR", papeis: ["FORNECEDOR"], ativo: true },
      { id: uid(2), nome: "Laticínio Comprador", tipo: "CLIENTE", papeis: ["CLIENTE"], ativo: true },
      { id: uid(3), nome: "Agro Ambos", tipo: "AMBOS", papeis: ["CLIENTE", "FORNECEDOR"], ativo: false },
    ]);
    const res = await appCom(semLancar).request("/estoque/fornecedores");
    expect(res.status).toBe(200);
    expect(mocks.listarParceiros).toHaveBeenCalledWith(true);
    const corpo = await res.json();
    expect(corpo.map((p: { id: string }) => p.id)).toEqual([uid(1), uid(3)]);
  });
});

describe("POST /estoque/produtos", () => {
  it.each([-1, 101])("rejeita MS %s com mensagem e campo localizados", async (valor) => {
    const res = await appCom(comLancar).request("/estoque/produtos", { method: "POST", headers: json, body: JSON.stringify({ nome: "Ração", categoriaId: uid(3), usoNutricional: true, perfilNutricional: { materiaSecaPercentual: valor } }) });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: "Informe a matéria seca entre 0% e 100%.", campo: "perfilNutricional.materiaSecaPercentual" });
    expect(mocks.criarProduto).not.toHaveBeenCalled();
  });
  const body = { nome: "Ureia", unidade: "KG", categoriaId: uid(1) };
  it("sem lancar → 403", async () => {
    const res = await appCom(soFinanceiro).request("/estoque/produtos", { method: "POST", headers: json, body: JSON.stringify(body) });
    expect(res.status).toBe(403);
    expect(mocks.criarProduto).not.toHaveBeenCalled();
  });
  it("com lancar → chega ao service", async () => {
    const res = await appCom(comLancar).request("/estoque/produtos", { method: "POST", headers: json, body: JSON.stringify(body) });
    expect(res.status).toBe(201);
    expect(mocks.criarProduto).toHaveBeenCalledWith(expect.objectContaining({ nome: "Ureia" }), 7);
  });
});

describe("GET /estoque/produtos/:id/ultimo-preco", () => {
  it("repassa produto, fornecedor preferido e escopo do sítio ao service", async () => {
    mocks.obterUltimoPreco.mockResolvedValue({ valorUnitario: "7.5", data: "2026-09-01", parceiro: { id: uid(4), nome: "Cooperativa" } });
    const res = await appCom(semLancar).request(`/estoque/produtos/${uid(12)}/ultimo-preco?parceiroId=${uid(4)}`);
    expect(res.status).toBe(200);
    expect(mocks.obterUltimoPreco).toHaveBeenCalledWith(uid(12), { parceiroId: uid(4), propriedadeId: 3 });
    expect(await res.json()).toEqual({ valorUnitario: "7.5", data: "2026-09-01", parceiro: { id: uid(4), nome: "Cooperativa" } });
  });
  it("sem parceiro e sem histórico devolve null", async () => {
    mocks.obterUltimoPreco.mockResolvedValue(null);
    const res = await appCom(semLancar).request(`/estoque/produtos/${uid(12)}/ultimo-preco`);
    expect(res.status).toBe(200);
    expect(mocks.obterUltimoPreco).toHaveBeenCalledWith(uid(12), { parceiroId: undefined, propriedadeId: 3 });
    expect(await res.json()).toBeNull();
  });
  it("id que não é UUID simplesmente não encontra nada", async () => {
    mocks.obterUltimoPreco.mockResolvedValue(null);
    const res = await appCom(semLancar).request("/estoque/produtos/abc/ultimo-preco");
    expect(res.status).toBe(200);
    expect(mocks.obterUltimoPreco).toHaveBeenCalledWith("abc", { parceiroId: undefined, propriedadeId: 3 });
    expect(await res.json()).toBeNull();
  });
});

describe("GET /estoque/produtos/:id/custo-medio", () => {
  it("repassa produto e escopo do sítio ao service, devolvendo número", async () => {
    mocks.obterCustoMedio.mockResolvedValue({ toNumber: () => 12.5 });
    const res = await appCom(semLancar).request(`/estoque/produtos/${uid(12)}/custo-medio`);
    expect(res.status).toBe(200);
    expect(mocks.obterCustoMedio).toHaveBeenCalledWith(expect.anything(), uid(12), 3);
    expect(await res.json()).toEqual({ custoMedio: 12.5 });
  });
  it("sem base valorizada devolve null", async () => {
    mocks.obterCustoMedio.mockResolvedValue(null);
    const res = await appCom(semLancar).request(`/estoque/produtos/${uid(12)}/custo-medio`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ custoMedio: null });
  });
  it("id que não é UUID simplesmente não encontra nada", async () => {
    mocks.obterCustoMedio.mockResolvedValue(null);
    const res = await appCom(semLancar).request("/estoque/produtos/abc/custo-medio");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ custoMedio: null });
  });
});

describe("POST /estoque/ajustes — erros do serviço", () => {
  it("CONFLITO devolve 409 com code, para o cliente pedir a recarga do saldo", async () => {
    const { EstoqueError } = await import("../services/estoque/estoque.js");
    mocks.ajustarContagem.mockRejectedValue(new EstoqueError("CONFLITO", "O estoque mudou desde a consulta."));
    const res = await appCom(comLancar).request("/estoque/ajustes", { method: "POST", headers: json, body: JSON.stringify({ produtoId: uid(1), quantidadeContada: 5, saldoEsperado: 10, observacao: "Contagem física" }) });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "O estoque mudou desde a consulta.", code: "CONFLITO" });
  });
});

describe("movimentos do Produto — visibilidade das origens financeiras", () => {
  it("leitor só de Pecuária consulta saldo físico e vínculo clínico sem links ou valores financeiros", async () => {
    mocks.leitura.mockResolvedValue(2);
    mocks.listarMovimentos.mockResolvedValue({ total: 1, itens: [{ id: uid(8), quantidade: 10, tipo: "SAIDA", custoUnitario: 2, valorTotal: 20, valorTotalMovimento: 100,
      operacaoId: uid(9), operacaoNumero: 17, vinculo: { tipo: "APLICACAO_SANITARIA", id: uid(10), animalId: uid(11) } }] });
    for (const caminho of ["/estoque/movimentos", `/estoque/produtos/${uid(1)}/movimentos`]) {
      const resposta = await appCom({ ...base, flags: [] }).request(caminho);
      expect(resposta.status).toBe(200);
      expect(await resposta.json()).toMatchObject({ total: 1, itens: [{ quantidade: 10, operacaoId: null, operacaoNumero: null, custoUnitario: null, valorTotal: null, valorTotalMovimento: null,
        vinculo: { tipo: "APLICACAO_SANITARIA", id: uid(10) } }] });
    }
  });
  it("acesso Financeiro conserva os vínculos da operação", async () => {
    mocks.leitura.mockResolvedValue(2);
    mocks.listarMovimentos.mockResolvedValue({ total: 1, itens: [{ id: uid(8), quantidade: 10, custoUnitario: 2, valorTotal: 20, operacaoId: uid(9), operacaoNumero: 17 }] });
    const resposta = await appCom(semLancar).request(`/estoque/produtos/${uid(1)}/movimentos`);
    expect(await resposta.json()).toMatchObject({ itens: [{ operacaoId: uid(9), operacaoNumero: 17, custoUnitario: 2, valorTotal: 20 }] });
  });
});

describe("validações de lote em português", () => {
  it("nome ausente ou vazio aponta o campo sem chamar a escrita", async () => {
    for (const body of [{}, { nome: "" }]) {
      const resposta = await appCom(comLancar).request(`/estoque/partidas/${uid(1)}`, { method: "PATCH", headers: json, body: JSON.stringify(body) });
      expect(resposta.status).toBe(422);
      expect(await resposta.json()).toEqual({ error: "Informe o nome do lote", code: "VALIDACAO", campo: "nome" });
    }
  });
  it("prévia exige data ou validade não informada com mensagem em português", async () => {
    const resposta = await appCom(semLancar).request(`/estoque/produtos/${uid(1)}/lotes/previa?validade=amanha`);
    expect(resposta.status).toBe(422);
    expect(await resposta.json()).toEqual({ error: "Informe uma validade válida ou escolha Validade não informada", code: "VALIDACAO", campo: "validade" });
  });
});


describe("estoque compartilhado após retirada de áreas", () => {
  it.each(["agricultura", "equipe"])("área %s não concede acesso ao estoque", async (area) => {
    const res = await appCom({ ...base, areas: [area], flags: ["lancar", "verValores"] }).request("/estoque/produtos");
    expect(res.status).toBe(403);
    expect(mocks.listarProdutos).not.toHaveBeenCalled();
  });
});
