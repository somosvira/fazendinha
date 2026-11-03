import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ sitio: vi.fn(), consultar: vi.fn(), resumo: vi.fn() }));
vi.mock("../../db.js", () => ({ prisma: {} }));
vi.mock("../../services/propriedade.js", () => ({ resolverEscopoLeitura: m.sitio }));
vi.mock("../../services/pecuaria/leite/consultas-producao.js", async original => ({ ...await original<typeof import("../../services/pecuaria/leite/consultas-producao.js")>(), consultarProducaoLeite: m.consultar }));
vi.mock("../../services/pecuaria/leite/resumo-operacional-producao.js", async original => ({ ...await original<typeof import("../../services/pecuaria/leite/resumo-operacional-producao.js")>(), consultarResumoOperacionalProducaoLeite: m.resumo }));
import { leiteConsultasProducaoRouter } from "./leite-consultas-producao.js";
function app(flags: string[] = [], areas = ["pecuaria"], sessao = true) { return new Hono().use("*", async (c, next) => { if (sessao) c.set("usuario" as never, { id: 7, dono: false, areas, flags, abas: [] } as never); await next(); }).route("/", leiteConsultasProducaoRouter); }
const query = "?inicio=2026-10-01&fim=2026-10-31";
beforeEach(() => { vi.resetAllMocks(); m.sitio.mockResolvedValue(2); m.consultar.mockResolvedValue({ itens: [] }); });
it("leitor consulta sem Financeiro e exportação exige ação própria", async () => {
  expect((await app().request(`/${query}`)).status).toBe(200);
  expect(m.consultar).toHaveBeenCalledWith(2, { inicio: "2026-10-01", fim: "2026-10-31", pagina: 1, tamanho: 30 }, false);
  expect((await app().request(`/exportacao${query}`)).status).toBe(403);
  expect((await app(["exportar"]).request(`/exportacao${query}`)).status).toBe(200);
  expect(m.consultar).toHaveBeenLastCalledWith(2, expect.anything(), true);
});
it("valida datas, sessão e área e recusa consolidado antes da leitura", async () => {
  expect((await app([], [], false).request(`/${query}`)).status).toBe(401);
  expect((await app([], ["financeiro"]).request(`/${query}`)).status).toBe(403);
  expect((await app().request("/?inicio=2026-11-01&fim=2026-10-01")).status).toBe(422);
  m.sitio.mockResolvedValue(null);
  expect((await app().request(`/${query}`)).status).toBe(422);
  expect(m.consultar).not.toHaveBeenCalled();
});

it("resumo operacional exige sessão, Pecuária, sítio e período válido sem exigir valores", async () => {
  m.resumo.mockResolvedValue({ dias: [] });
  expect((await app().request(`/resumo-operacional${query}`)).status).toBe(200);
  expect(m.resumo).toHaveBeenCalledWith(2, { inicio: "2026-10-01", fim: "2026-10-31" });
  expect((await app([], [], false).request(`/resumo-operacional${query}`)).status).toBe(401);
  expect((await app([], ["financeiro"]).request(`/resumo-operacional${query}`)).status).toBe(403);
  expect((await app().request("/resumo-operacional?inicio=2026-02-30&fim=2026-03-01")).status).toBe(422);
  expect((await app().request("/resumo-operacional?inicio=2025-01-01&fim=2026-01-02")).status).toBe(422);
  m.sitio.mockResolvedValue(null);
  expect((await app().request(`/resumo-operacional${query}`)).status).toBe(422);
  expect(m.resumo).toHaveBeenCalledTimes(1);
});
