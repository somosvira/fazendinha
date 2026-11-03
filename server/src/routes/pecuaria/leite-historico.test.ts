import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ ler: vi.fn(), historico: vi.fn(), coletivo: vi.fn() }));
vi.mock("../../db.js", () => ({ prisma: {} }));
vi.mock("../../services/propriedade.js", async original => ({ ...await original<typeof import("../../services/propriedade.js")>(), resolverEscopoLeitura: m.ler }));
vi.mock("../../services/pecuaria/leite/historico.js", () => ({ consultarHistoricoProdutivo: m.historico }));
vi.mock("../../services/pecuaria/leite/controle-historico.js", () => ({ consultarControlesColetivosLeite: m.coletivo }));
import { leiteHistoricoRouter } from "./leite-historico.js";
const id = "10000000-0000-4000-8000-000000000001";
function app(autenticado = true, pecuaria = true) { return new Hono().use("*", async (c, next) => { if (autenticado) c.set("usuario" as never, { id: 7, dono: false, areas: [pecuaria ? "pecuaria" : "financeiro"], flags: [], abas: [] } as never); await next(); }).route("/", leiteHistoricoRouter); }
beforeEach(() => { vi.clearAllMocks(); m.ler.mockResolvedValue(2); m.historico.mockResolvedValue({ itens: [] }); });
it("exige sessão/área, mas permite leitura sem lançamento ou acesso financeiro", async () => {
  expect((await app(false).request(`/animais/${id}`)).status).toBe(401);
  expect((await app(true, false).request(`/animais/${id}`)).status).toBe(403);
  expect((await app().request(`/animais/${id}?inicio=2026-10-01&fim=2026-10-19`)).status).toBe(200);
  expect(m.historico).toHaveBeenCalledWith(2, id, { inicio: "2026-10-01", fim: "2026-10-19", pagina: 1, tamanho: 20 });
});
it("não aceita leitura consolidada sem sítio nem intervalos impossíveis", async () => {
  m.ler.mockResolvedValue(null);
  expect((await app().request(`/animais/${id}`)).status).toBe(422);
  expect(m.historico).not.toHaveBeenCalled();
  expect((await app().request(`/animais/${id}?inicio=2026-02-30`)).status).toBe(422);
});
it("é somente leitura e valida identidade antes de buscar fatos", async () => {
  expect((await app().request(`/animais/${id}`, { method: "POST" })).status).toBe(404);
  expect((await app().request("/animais/invalido")).status).toBe(400);
  expect(m.historico).not.toHaveBeenCalled();
});

it("agregados coletivos exigem sessão, área e sítio resolvido no servidor", async () => {
  const caminho = "/controles-historicos/coletivos?inicio=2024-10-01&fim=2024-10-31&pagina=2&tamanho=5";
  m.coletivo.mockResolvedValue({ itens: [], total: 0 });
  expect((await app(false).request(caminho)).status).toBe(401);
  expect((await app(true, false).request(caminho)).status).toBe(403);
  expect((await app().request(caminho)).status).toBe(200);
  expect(m.coletivo).toHaveBeenCalledWith(2, { inicio: "2024-10-01", fim: "2024-10-31", pagina: 2, tamanho: 5 });
  m.ler.mockResolvedValue(null);
  expect((await app().request(caminho)).status).toBe(422);
});
it("consulta coletiva rejeita datas/paginação inválidas e escopo vindo da query", async () => {
  for (const query of ["", "inicio=2024-02-30&fim=2024-03-31", "inicio=2024-10-31&fim=2024-10-01", "inicio=2020-01-01&fim=2024-10-31", "inicio=2024-10-01&fim=2024-10-31&tamanho=101", "inicio=2024-10-01&fim=2024-10-31&propriedadeId=99"])
    expect((await app().request(`/controles-historicos/coletivos?${query}`)).status).toBe(422);
  expect(m.coletivo).not.toHaveBeenCalled();
  expect((await app().request("/controles-historicos/coletivos", { method: "POST" })).status).toBe(404);
});
