import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { UsuarioContexto } from "../../services/auth/sessao.js";
import { exigeArea, exigePermissao } from "../../middleware/permissao.js";
const mock = vi.hoisted(() => ({
  listar: vi.fn(),
  resumo: vi.fn(),
  salvar: vi.fn(),
  leitura: vi.fn(),
  escrita: vi.fn(),
  env: { NUTRICAO_MENSAL_ENABLED: true, NUTRICAO_AUTOMACAO_ENABLED: false },
}));
vi.mock("../../env.js", () => ({ env: mock.env }));
vi.mock("../../db.js", () => ({ prisma: {} }));
vi.mock("../../services/pecuaria/nutricao/mensal.js", () => ({
  consultarMeses: mock.listar,
  resumoMes: mock.resumo,
  salvarConfiguracao: mock.salvar,
}));
vi.mock("../../services/propriedade.js", () => ({
  resolverEscopoLeitura: mock.leitura,
  resolverEscopoEscrita: mock.escrita,
}));
import { nutricaoMensalRouter } from "./nutricao-mensal.js";
function app(p: Partial<UsuarioContexto> = {}) {
  const u: UsuarioContexto = {
    id: 1,
    nome: "Operador",
    email: "op@example.test",
    papel: "operador",
    abas: [],
    areas: ["pecuaria"],
    flags: [],
    status: "ATIVO",
    dono: false,
    ...p,
  };
  return new Hono()
    .use("*", async (c, next) => {
      c.set("usuario" as never, u as never);
      return next();
    })
    .use("*", exigeArea("pecuaria"))
    .use("*", async (c, next) =>
      c.req.method === "GET" ? next() : exigePermissao("lancar")(c, next),
    )
    .route("/", nutricaoMensalRouter);
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.env.NUTRICAO_MENSAL_ENABLED = true;
  mock.leitura.mockResolvedValue(7);
  mock.escrita.mockResolvedValue(7);
  mock.listar.mockResolvedValue({ itens: [{ id: "mes" }], total: 1 });
  mock.resumo.mockReturnValue({ id: "mes" });
});
describe("contrato mensal", () => {
  it("filtra alertas e escopo no servidor e mascara valores do operador", async () => {
    expect((await app().request("/meses?pagina=2&alertas=true")).status).toBe(
      200,
    );
    expect(mock.listar).toHaveBeenCalledWith(7, undefined, undefined, 2, true);
    expect(mock.resumo).toHaveBeenCalledWith({ id: "mes" }, false);
  });
  it("não aceita a ponte de acesso como autoria", async () => {
    expect((await app({ id: 0, dono: true }).request("/meses")).status).toBe(
      403,
    );
    expect(mock.listar).not.toHaveBeenCalled();
  });
  it("consulta não pode alterar configuração", async () => {
    expect(
      (
        await app().request("/configuracoes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        })
      ).status,
    ).toBe(403);
    expect(mock.salvar).not.toHaveBeenCalled();
  });
  it("desabilitado não consulta tabelas novas", async () => {
    mock.env.NUTRICAO_MENSAL_ENABLED = false;
    expect((await app().request("/meses")).status).toBe(503);
    expect(mock.listar).not.toHaveBeenCalled();
  });
  it("valida dia e data de configuração antes do serviço", async () => {
    expect(
      (
        await app({ flags: ["lancar"] }).request("/configuracoes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            propriedadeId: 7,
            loteId: null,
            modelo: "AUTOMATICO",
            diaConferencia: 32,
            autorizaValidade: false,
            desde: "2026-02-30",
          }),
        })
      ).status,
    ).toBe(422);
    expect(mock.salvar).not.toHaveBeenCalled();
  });
});
