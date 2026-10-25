import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ ordenhas: vi.fn(), estoque: vi.fn(), vendas: vi.fn(), escopo: vi.fn() }));
vi.mock("../../services/pecuaria/leite/consultas-ordenhas.js", async original => ({
  ...(await original<typeof import("../../services/pecuaria/leite/consultas-ordenhas.js")>()), consultarOrdenhasPeriodo: mocks.ordenhas,
}));
vi.mock("../../services/pecuaria/leite/resumo-estoque.js", async original => ({
  ...(await original<typeof import("../../services/pecuaria/leite/resumo-estoque.js")>()), consultarResumoEstoqueLeite: mocks.estoque,
}));
vi.mock("../../services/pecuaria/leite/vendas-unificadas.js", async original => ({
  ...(await original<typeof import("../../services/pecuaria/leite/vendas-unificadas.js")>()), consultarVendasUnificadasLeite: mocks.vendas,
}));
vi.mock("../../services/propriedade.js", async original => ({
  ...(await original<typeof import("../../services/propriedade.js")>()), resolverEscopoLeitura: mocks.escopo,
}));
import { leiteConsultasV5Router } from "./leite-consultas-v5.js";
function app(flags: string[] = [], areas = ["pecuaria"]) {
  return new Hono().use("*", async (c, next) => { c.set("usuario" as never, { id: 7, dono: false, flags, areas, abas: [] } as never); await next(); }).route("/", leiteConsultasV5Router);
}
beforeEach(() => { vi.clearAllMocks(); mocks.escopo.mockResolvedValue(3); mocks.ordenhas.mockResolvedValue({ total: 0 }); mocks.estoque.mockResolvedValue({ total: 0 }); });
it("consulta ordenhas por período com escopo do servidor e paginação validada", async () => {
  expect((await app().request("/geral/consulta?inicio=2026-10-01&fim=2026-10-24&porPagina=10")).status).toBe(200);
  expect(mocks.ordenhas).toHaveBeenLastCalledWith(3, expect.objectContaining({ inicio: "2026-10-01", fim: "2026-10-24", pagina: 1, porPagina: 10 }));
  expect((await app().request("/geral/consulta?inicio=2026-02-30&fim=2026-10-24")).status).toBe(422);
  expect((await app([], ["financeiro"]).request("/geral/consulta?inicio=2026-10-01&fim=2026-10-24")).status).toBe(403);
});
it("estoque exige sítio e repassa a máscara financeira independentemente", async () => {
  expect((await app().request("/estoque/resumo")).status).toBe(200);
  expect(mocks.estoque).toHaveBeenLastCalledWith(3, expect.objectContaining({ pagina: 1, porPagina: 20 }), false);
  await app(["verValores"], ["pecuaria", "financeiro"]).request("/estoque/resumo");
  expect(mocks.estoque).toHaveBeenLastCalledWith(3, expect.anything(), true);
  mocks.escopo.mockResolvedValue(null);
  expect((await app().request("/estoque/resumo")).status).toBe(422);
});


it("vendas unificadas permitem metadados na Pecuária e mascaram valores no servidor", async () => {
  mocks.vendas.mockResolvedValue({ total: 0, resumo: { valorTotal: null } });
  expect((await app().request("/comercial/vendas-unificadas?modalidade=AVULSA&pagina=2")).status).toBe(200);
  expect(mocks.vendas).toHaveBeenLastCalledWith(3, expect.objectContaining({ modalidade: "AVULSA", pagina: 2, porPagina: 20 }), false);
  await app(["verValores"], ["pecuaria", "financeiro"]).request("/comercial/vendas-unificadas");
  expect(mocks.vendas).toHaveBeenLastCalledWith(3, expect.anything(), true);
  expect((await app([], ["financeiro"]).request("/comercial/vendas-unificadas")).status).toBe(403);
  expect((await app().request("/comercial/vendas-unificadas?porPagina=101")).status).toBe(422);
  mocks.escopo.mockResolvedValue(null);
  expect((await app().request("/comercial/vendas-unificadas")).status).toBe(422);
});
