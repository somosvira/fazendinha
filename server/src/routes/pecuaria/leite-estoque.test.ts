import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  confirmar: vi.fn(),
  confirmarSessao: vi.fn(),
  vender: vi.fn(),
  apurar: vi.fn(),
  anular: vi.fn(),
  classificar: vi.fn(),
  vendas: vi.fn(),
  corrigirVenda: vi.fn(),
  consultar: vi.fn(),
  leitura: vi.fn(),
  escrita: vi.fn(),
}));
vi.mock("../../services/propriedade.js", async (original) => ({
  ...(await original<typeof import("../../services/propriedade.js")>()),
  resolverEscopoLeitura: m.leitura,
  resolverEscopoEscrita: m.escrita,
}));
vi.mock("../../services/pecuaria/leite/estoque.js", async (original) => ({
  ...(await original<
    typeof import("../../services/pecuaria/leite/estoque.js")
  >()),
  confirmarProducaoLeite: m.confirmar,
  confirmarSessaoProducaoLeite: m.confirmarSessao,
  venderLeite: m.vender,
  apurarValorProducaoLeite: m.apurar,
  anularEntradaProducaoLeite: m.anular,
  classificarEntradaLeite: m.classificar,
  consultarVendasLeite: m.vendas,
  corrigirVendaLeite: m.corrigirVenda,
  consultarEstoqueLeite: m.consultar,
}));
import { leiteEstoqueRouter } from "./leite-estoque.js";
const id = "10000000-0000-4000-8000-000000000001";
function app(areas = ["pecuaria"], flags = ["lancar"], autenticado = true) {
  return new Hono()
    .use("*", async (c, next) => {
      if (autenticado)
        c.set(
          "usuario" as never,
          { id: 7, dono: false, areas, flags, abas: [] } as never,
        );
      await next();
    })
    .route("/", leiteEstoqueRouter);
}
const post = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
beforeEach(() => {
  vi.clearAllMocks();
  m.leitura.mockResolvedValue(2);
  m.escrita.mockResolvedValue(2);
  m.consultar.mockResolvedValue({ quantidadeLitros: "10", valorTotal: null });
});
it("protege a área e impede efeitos financeiros de perfil apenas operacional", async () => {
  expect((await app([], [], false).request(`/?produtoId=${id}`)).status).toBe(
    401,
  );
  expect((await app(["financeiro"]).request(`/?produtoId=${id}`)).status).toBe(
    403,
  );
  expect((await app().request("/vendas", post({}))).status).toBe(403);
  expect(
    (await app(["pecuaria", "financeiro"]).request("/apuracoes", post({})))
      .status,
  ).toBe(403);
  expect(
    (await app(["pecuaria"], []).request("/confirmacoes", post({}))).status,
  ).toBe(403);
  expect(m.confirmar).not.toHaveBeenCalled();
  expect(m.vender).not.toHaveBeenCalled();
  expect(m.apurar).not.toHaveBeenCalled();
});
it("consulta volumes com máscara monetária decidida pelo servidor e sítio resolvido", async () => {
  await app().request(`/?produtoId=${id}`);
  expect(m.consultar).toHaveBeenLastCalledWith(
    id,
    { propriedadeId: 2, usuarioId: 7 },
    false,
  );
  await app(["pecuaria", "financeiro"], ["verValores"]).request(
    `/?produtoId=${id}`,
  );
  expect(m.consultar).toHaveBeenLastCalledWith(
    id,
    { propriedadeId: 2, usuarioId: 7 },
    true,
  );
  m.leitura.mockResolvedValue(null);
  expect((await app().request(`/?produtoId=${id}`)).status).toBe(422);
});
it("confirma uma sessão sem devolver dados internos ou custos e recusa sítio no corpo", async () => {
  const input = { sessaoId: id, versaoEsperada: 1, produtoId: id, chave: id, medicaoIds: [id], natureza: "COMERCIAL", motivoNatureza: "Grupo comercial separado" };
  m.confirmar.mockResolvedValue({
    id,
    sessaoId: id,
    versaoSessao: 1,
    status: "CONFIRMADA",
    hash: "interno",
    snapshot: { valor: 99 },
    movimento: { quantidade: "10", valorTotal: 99 },
  });
  const r = await app().request("/confirmacoes", post(input));
  expect(r.status).toBe(201);
  expect(await r.json()).toEqual({
    id,
    sessaoId: id,
    versaoSessao: 1,
    status: "CONFIRMADA",
    quantidadeLitros: "10",
  });
  expect(m.confirmar).toHaveBeenCalledWith(input, {
    propriedadeId: 2,
    usuarioId: 7,
  });
  expect(
    (await app().request("/confirmacoes", post({ ...input, propriedadeId: 9 })))
      .status,
  ).toBe(422);
});
it("encaminha venda com preço conhecido somente com permissão financeira completa", async () => {
  const input = {
    chave: id,
    produtoId: id,
    quantidadeLitros: 10,
    data: "2026-10-19",
    descricao: "Retirada de leite",
    parceiroId: id,
    valorTotal: 25,
    financeiro: {
      condicao: "A_PRAZO",
      parcelas: [{ valor: 25, dataVencimento: "2026-10-30" }],
    },
  };
  m.vender.mockResolvedValue({ id });
  expect(
    (
      await app(["pecuaria", "financeiro"], ["lancar", "verValores"]).request(
        "/vendas",
        post(input),
      )
    ).status,
  ).toBe(201);
  expect(m.vender).toHaveBeenCalledWith(
    expect.objectContaining({ valorTotal: 25, quantidadeLitros: 10 }),
    { propriedadeId: 2, usuarioId: 7 },
  );
});
it("declara natureza operacional com versão e devolve somente o contrato público", async () => {
  const input = { entradaId: id, chave: id, versaoEsperada: 1, natureza: "COLOSTRO", motivo: "Origem segregada de colostro" };
  m.classificar.mockResolvedValue({ id, entradaId: id, versao: 2, natureza: "COLOSTRO", criadoPorId: 7, motivo: input.motivo });
  expect((await app(["pecuaria"], []).request("/classificacoes", post(input))).status).toBe(403);
  const r = await app().request("/classificacoes", post(input));
  expect(r.status).toBe(201);
  expect(await r.json()).toEqual({ id, entradaId: id, versao: 2, natureza: "COLOSTRO" });
  expect(m.classificar).toHaveBeenCalledWith(input, { propriedadeId: 2, usuarioId: 7 });
});
it("protege consulta/correção comercial e não aceita alterar os litros na correção", async () => {
  const perfil = app(["pecuaria", "financeiro"], ["lancar", "verValores"]);
  m.vendas.mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 20 });
  expect((await app().request(`/vendas?produtoId=${id}`)).status).toBe(403);
  expect((await perfil.request(`/vendas?produtoId=${id}`)).status).toBe(200);
  expect(m.vendas).toHaveBeenCalledWith({ produtoId: id, pagina: 1, porPagina: 20 }, { propriedadeId: 2, usuarioId: 7 });
  const input = { operacaoId: id, chave: id, versaoEsperada: 1, motivo: "Correção do preço acordado", parceiroId: id, valorTotal: 250,
    financeiro: { condicao: "A_PRAZO", parcelas: [{ valor: 250, dataVencimento: "2026-10-30" }] } };
  expect((await app(["pecuaria", "financeiro"], ["verValores"]).request("/vendas/correcoes", post(input))).status).toBe(403);
  expect((await perfil.request("/vendas/correcoes", post({ ...input, quantidadeLitros: 200 }))).status).toBe(422);
  m.corrigirVenda.mockResolvedValue({ operacaoId: id, versaoComercial: 2 });
  expect((await perfil.request("/vendas/correcoes", post(input))).status).toBe(201);
  expect(m.corrigirVenda).toHaveBeenCalledWith(expect.objectContaining({ valorTotal: 250, versaoEsperada: 1 }), { propriedadeId: 2, usuarioId: 7 });
});

it("confirma todos os grupos pelo sítio e autor resolvidos sem permitir escrita de consulta", async () => {
  const grupo = { produtoId: id, chave: "10000000-0000-4000-8000-000000000002", medicaoIds: [id], natureza: "COMERCIAL", motivoNatureza: "Separado pela equipe" };
  const dados = { sessaoId: id, versaoEsperada: 1, chave: id, grupos: [grupo] };
  m.confirmarSessao.mockResolvedValue({ sessaoId: id, grupos: [{ id, quantidadeLitros: "40", natureza: "COMERCIAL" }] });
  expect((await app(["pecuaria"], []).request("/confirmacoes-sessao", post(dados))).status).toBe(403);
  expect(m.confirmarSessao).not.toHaveBeenCalled();
  const r = await app().request("/confirmacoes-sessao", post(dados));
  expect(r.status).toBe(201);
  expect(m.confirmarSessao).toHaveBeenCalledWith(dados, { propriedadeId: 2, usuarioId: 7 });
  expect((await app().request("/confirmacoes-sessao", post({ ...dados, propriedadeId: 9 }))).status).toBe(422);
});
