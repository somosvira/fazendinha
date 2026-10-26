import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  entregas: vi.fn(),
  vendas: vi.fn(),
  registrar: vi.fn(),
  conferir: vi.fn(),
  docs: vi.fn(),
  criarDoc: vi.fn(),
  anular: vi.fn(),
  leitura: vi.fn(),
  escrita: vi.fn(),
}));
vi.mock("../../services/propriedade.js", async (original) => ({
  ...(await original<typeof import("../../services/propriedade.js")>()),
  resolverEscopoLeitura: m.leitura,
  resolverEscopoEscrita: m.escrita,
}));
vi.mock("../../services/pecuaria/leite/comercial.js", () => ({
  consultarEntregasLeite: m.entregas,
  consultarVendasVinculaveisLeite: m.vendas,
  registrarEntregaLeite: m.registrar,
  conferirEntregaLeite: m.conferir,
  consultarDemonstrativosLeite: m.docs,
  registrarDemonstrativoLeite: m.criarDoc,
  anularDemonstrativoLeite: m.anular,
}));
import { leiteComercialRouter } from "./leite-comercial.js";
const id = "10000000-0000-4000-8000-000000000001";
const body = {
  chave: id,
  vinculo: { tipo: "VENDA_EXISTENTE", operacaoId: id },
  referencia: "Comprovante da coleta",
  volumeAceito: null,
  situacao: "PENDENTE",
  motivo: "Aceite do comprador aguardando informação",
};
const post = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
function app(areas = ["pecuaria"], flags = ["lancar"]) {
  return new Hono()
    .use("*", async (c, next) => {
      c.set(
        "usuario" as never,
        { id: 7, dono: false, areas, flags, abas: [] } as never,
      );
      await next();
    })
    .route("/", leiteComercialRouter);
}
beforeEach(() => {
  vi.clearAllMocks();
  m.leitura.mockResolvedValue(2);
  m.escrita.mockResolvedValue(2);
  m.entregas.mockResolvedValue({ itens: [], propriedadeId: 2 });
  m.vendas.mockResolvedValue({ itens: [], propriedadeId: 2 });
  m.registrar.mockResolvedValue({ id });
});
it("perfil operacional lê volumes com máscara e vincula somente uma venda comprovada", async () => {
  expect((await app().request("/entregas")).status).toBe(200);
  expect(m.entregas).toHaveBeenCalledWith(
    { pagina: 1, porPagina: 20 },
    { propriedadeId: 2, usuarioId: 7 },
    false,
  );
  expect((await app().request("/vendas-vinculaveis")).status).toBe(200);
  expect(m.vendas).toHaveBeenCalledWith(
    expect.anything(),
    { propriedadeId: 2, usuarioId: 7 },
    false,
  );
  expect((await app().request("/entregas", post(body))).status).toBe(201);
  expect(m.registrar).toHaveBeenCalledWith(
    expect.objectContaining({ volumeAceito: null }),
    { propriedadeId: 2, usuarioId: 7 },
  );
});
it("nova venda exige financeiro com valores, mesmo se o usuário já pode lançar entregas", async () => {
  const nova = {
    ...body,
    vinculo: {
      tipo: "NOVA_VENDA",
      venda: {
        produtoId: id,
        quantidadeLitros: 10,
        data: "2026-10-19",
        descricao: "Retirada de leite",
        parceiroId: id,
        valorTotal: 25,
        financeiro: { condicao: "SEM_FINANCEIRO" },
      },
    },
  };
  const prazo = {
    ...nova,
    vinculo: {
      tipo: "NOVA_VENDA",
      venda: {
        ...nova.vinculo.venda,
        financeiro: {
          condicao: "A_PRAZO",
          parcelas: [{ valor: 25, dataVencimento: "2026-10-30" }],
        },
      },
    },
  };
  expect((await app().request("/entregas", post(prazo))).status).toBe(403);
  expect(
    (
      await app(["pecuaria", "financeiro"], ["lancar", "verValores"]).request(
        "/entregas",
        post(prazo),
      )
    ).status,
  ).toBe(201);
});
it("protege demonstrativos e escritas por área e ação no servidor", async () => {
  expect((await app().request("/demonstrativos")).status).toBe(403);
  expect(
    (
      await app(["pecuaria", "financeiro"], ["verValores"]).request(
        "/demonstrativos",
        post({}),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await app(["pecuaria"], []).request(
        `/entregas/${id}/conferencias`,
        post({}),
      )
    ).status,
  ).toBe(403);
  expect(m.criarDoc).not.toHaveBeenCalled();
  expect(m.conferir).not.toHaveBeenCalled();
  m.leitura.mockResolvedValue(null);
  expect((await app().request("/entregas")).status).toBe(422);
});
