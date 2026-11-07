import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";
import type { UsuarioContexto } from "../../services/auth/sessao.js";
const m = vi.hoisted(() => ({ listar: vi.fn(), escopo: vi.fn() }));
vi.mock(
  "../../services/pecuaria/protocolos/etapas-do-dia.js",
  async (original) => ({
    ...(await original<
      typeof import("../../services/pecuaria/protocolos/etapas-do-dia.js")
    >()),
    listarEtapasDoDia: m.listar,
  }),
);
vi.mock("../../services/propriedade.js", async (original) => ({
  ...(await original<typeof import("../../services/propriedade.js")>()),
  resolverEscopoLeitura: m.escopo,
}));
import { protocolosOperacaoRouter } from "./protocolos-operacao.js";
function app(sessao = true, area = true) {
  const usuario: UsuarioContexto = {
    id: 7,
    nome: "Leitura",
    email: "teste@example.com",
    papel: "LEITOR",
    abas: [],
    areas: area ? ["pecuaria"] : [],
    flags: [],
    dono: false,
    status: "ATIVO",
  };
  return new Hono<{ Variables: { usuario: UsuarioContexto } }>()
    .use("*", async (c, next) => {
      if (sessao) c.set("usuario", usuario);
      await next();
    })
    .route("/", protocolosOperacaoRouter);
}
beforeEach(() => {
  vi.resetAllMocks();
  m.escopo.mockResolvedValue(7);
  m.listar.mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 10 });
});
it("exige sessão e área, resolve sítio no servidor e permite leitura sem lançar", async () => {
  expect(
    (await app(false).request("/etapas-do-dia?data=2026-11-07")).status,
  ).toBe(403);
  expect(
    (await app(true, false).request("/etapas-do-dia?data=2026-11-07")).status,
  ).toBe(403);
  expect(m.listar).not.toHaveBeenCalled();
  expect(
    (
      await app().request(
        "/etapas-do-dia?propriedadeId=999&data=2026-11-07&pagina=2",
      )
    ).status,
  ).toBe(200);
  expect(m.listar).toHaveBeenCalledWith(7, {
    data: "2026-11-07",
    pagina: 2,
    porPagina: 10,
  });
  expect(m.escopo).toHaveBeenCalledTimes(1);
});
it("rejeita data inválida e teto maior que dez antes de consultar", async () => {
  expect(
    (await app().request("/etapas-do-dia?data=2026-11-07&porPagina=11")).status,
  ).toBe(422);
  expect((await app().request("/etapas-do-dia?data=inválida")).status).toBe(
    422,
  );
  expect(m.listar).not.toHaveBeenCalled();
});
