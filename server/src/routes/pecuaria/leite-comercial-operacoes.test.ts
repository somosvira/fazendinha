import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  consultar: vi.fn(),
  abrir: vi.fn(),
  retirar: vi.fn(),
  fechar: vi.fn(),
  previa: vi.fn(),
  leitura: vi.fn(),
  escrita: vi.fn(),
}));
vi.mock("../../services/propriedade.js", async (o) => ({
  ...(await o<typeof import("../../services/propriedade.js")>()),
  resolverEscopoLeitura: m.leitura,
  resolverEscopoEscrita: m.escrita,
}));
vi.mock("../../services/pecuaria/leite/comercial.operacoes.js", () => ({
  consultarOperacoesLeite: m.consultar,
  consultarOperacaoLeite: m.consultar,
  abrirOperacaoLeite: m.abrir,
  retirarOperacaoLeite: m.retirar,
  fecharOperacaoLeite: m.fechar,
  previaFechamentoOperacaoLeite: m.previa,
}));
import { leiteComercialOperacoesRouter } from "./leite-comercial-operacoes.js";
const id = "00000000-0000-4000-8000-000000000001";
function app(areas = ["pecuaria"], flags = ["lancar"]) {
  return new Hono()
    .use("*", async (c, n) => {
      c.set(
        "usuario" as never,
        { id: 9, dono: false, areas, flags, abas: [] } as never,
      );
      await n();
    })
    .route("/", leiteComercialOperacoesRouter);
}
const post = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
beforeEach(() => {
  vi.clearAllMocks();
  m.leitura.mockResolvedValue(7);
  m.escrita.mockResolvedValue(7);
  m.consultar.mockResolvedValue({ itens: [] });
  m.abrir.mockResolvedValue({ id });
  m.retirar.mockResolvedValue({ id });
  m.fechar.mockResolvedValue({ id });
});
it("operacional consulta com máscara e abre sem preço; escrita usa sítio resolvido no servidor", async () => {
  expect((await app().request("/")).status).toBe(200);
  expect(m.consultar).toHaveBeenCalledWith(
    { pagina: 1, porPagina: 20 },
    { propriedadeId: 7, usuarioId: 9 },
    false,
  );
  expect(
    (
      await app().request(
        "/",
        post({
          chave: id,
          parceiroId: id,
          inicio: "2026-10-01",
          fim: "2026-10-19",
          referencia: "Coletas do mês",
        }),
      )
    ).status,
  ).toBe(201);
  expect(m.abrir).toHaveBeenCalledWith(expect.anything(), {
    propriedadeId: 7,
    usuarioId: 9,
  });
});
it("retirada não aceita preço ou sítio injetado e precisa lançar", async () => {
  const input = {
    chave: id,
    versaoEsperada: 1,
    produtoId: id,
    data: "2026-10-19",
    quantidadeLitros: 100,
    referencia: "Coleta física",
  };
  expect((await app().request(`/${id}/retiradas`, post(input))).status).toBe(
    201,
  );
  expect(
    (await app().request(`/${id}/retiradas`, post({ ...input, valorTotal: 0 })))
      .status,
  ).toBe(422);
  expect(
    (await app(["pecuaria"], []).request(`/${id}/retiradas`, post(input)))
      .status,
  ).toBe(403);
});
it("fechamento e prévia exigem Financeiro e verValores mesmo que a UI esconda a ação", async () => {
  const input = {
    chave: id,
    versaoEsperada: 2,
    data: "2026-10-19",
    precoUnitario: 2.5,
    ajuste: 0,
    motivo: "Acordo do período",
    centroCustoId: id,
    retiradas: [{ retiradaId: id, quantidadeReconhecida: 100 }],
    financeiro: {
      condicao: "A_PRAZO",
      parcelas: [{ valor: 250, dataVencimento: "2026-10-30" }],
    },
  };
  expect((await app().request(`/${id}/fechamentos`, post(input))).status).toBe(
    403,
  );
  expect(
    (
      await app(["pecuaria", "financeiro"], ["lancar"]).request(
        `/${id}/fechamentos`,
        post(input),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await app(["pecuaria", "financeiro"], ["lancar", "verValores"]).request(
        `/${id}/fechamentos`,
        post(input),
      )
    ).status,
  ).toBe(201);
  expect(m.fechar).toHaveBeenCalledTimes(1);
  expect(
    (await app().request(`/${id}/previa-fechamento`, post({}))).status,
  ).toBe(403);
  expect(m.previa).not.toHaveBeenCalled();
});
