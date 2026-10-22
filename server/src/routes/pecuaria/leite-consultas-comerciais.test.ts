import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ sitio: vi.fn(), coletas: vi.fn(), vendas: vi.fn() }));
vi.mock("../../db.js", () => ({ prisma: {} }));
vi.mock("../../services/propriedade.js", () => ({ resolverEscopoLeitura: m.sitio }));
vi.mock("../../services/pecuaria/leite/comercial.consultas-operacionais.js", () => ({ consultarColetasOperacoesLeite: m.coletas, consultarVendasOperacoesLeite: m.vendas }));
import { leiteConsultasComerciaisRouter } from "./leite-consultas-comerciais.js";
function app(areas = ["pecuaria"], flags: string[] = [], sessao = true) { return new Hono().use("*", async (c, next) => { if (sessao) c.set("usuario" as never, { id: 7, dono: false, areas, flags, abas: [] } as never); await next(); }).route("/", leiteConsultasComerciaisRouter); }
beforeEach(() => { vi.resetAllMocks(); m.sitio.mockResolvedValue(2); m.coletas.mockResolvedValue({ itens: [] }); m.vendas.mockResolvedValue({ itens: [] }); });
it("leitor sem Financeiro consulta coletas e volume da venda com máscara do servidor", async () => {
  expect((await app().request("/coletas?de=2026-10-01&ate=2026-10-31")).status).toBe(200);
  expect(m.coletas).toHaveBeenCalledWith(2, { de: "2026-10-01", ate: "2026-10-31", pagina: 1, porPagina: 20 });
  expect((await app().request("/vendas")).status).toBe(200);
  expect(m.vendas).toHaveBeenCalledWith(2, { pagina: 1, porPagina: 20 }, false);
  expect((await app(["pecuaria", "financeiro"], ["verValores"]).request("/vendas")).status).toBe(200);
  expect(m.vendas).toHaveBeenLastCalledWith(2, expect.anything(), true);
});
it("requer sessão/área/sítio e valida recorte antes de consultar", async () => {
  expect((await app([], [], false).request("/coletas")).status).toBe(401);
  expect((await app(["financeiro"]).request("/coletas")).status).toBe(403);
  expect((await app().request("/coletas?de=2026-11-01&ate=2026-10-01")).status).toBe(422);
  m.sitio.mockResolvedValue(null);
  expect((await app().request("/vendas")).status).toBe(422);
  expect(m.vendas).not.toHaveBeenCalled();
});
