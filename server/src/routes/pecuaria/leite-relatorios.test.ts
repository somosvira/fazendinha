import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ emitir: vi.fn(), obter: vi.fn(), listar: vi.fn(), csv: vi.fn(), leitura: vi.fn(), escrita: vi.fn() }));
vi.mock("../../services/pecuaria/leite/relatoriosleite.js", () => ({ emitirRelatorioLeite: m.emitir, obterRelatorioLeite: m.obter, listarRelatoriosLeite: m.listar, exportarRelatorioLeiteCsv: m.csv, RelatorioLeiteAcessoError: class extends Error {} }));
vi.mock("../../services/propriedade.js", async original => ({ ...await original<typeof import("../../services/propriedade.js")>(), resolverEscopoLeitura: m.leitura, resolverEscopoEscrita: m.escrita }));
import { leiteRelatoriosRouter } from "./leite-relatorios.js";
const id = "00000000-0000-4000-8000-000000000001";
const payload = { chave: id, inicio: "2026-10-01", fim: "2026-10-02" };
const post = (body: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
function app(flags: string[] = [], areas = ["pecuaria"], autenticado = true) {
  return new Hono().use("*", async (c, next) => { if (autenticado) c.set("usuario" as never, { id: 5, dono: false, flags, areas, abas: [] } as never); await next(); }).route("/", leiteRelatoriosRouter);
}
beforeEach(() => { vi.resetAllMocks(); m.leitura.mockResolvedValue(7); m.escrita.mockResolvedValue(7); m.emitir.mockResolvedValue({ id, snapshot: { valores: null } }); m.obter.mockResolvedValue({ id, snapshot: { valores: null } }); m.listar.mockResolvedValue({ itens: [] }); m.csv.mockResolvedValue({ nome: "leite.csv", conteudo: "Relatório" }); });
describe("permissões das emissões de leite", () => {
  it("exige sessão/área e exportar para emissão e arquivo, sem exigir financeiro para produção", async () => {
    expect((await app([], [], false).request("/relatorios/emissoes")).status).toBe(401);
    expect((await app(["exportar"], ["financeiro"]).request("/relatorios/emissoes", post(payload))).status).toBe(403);
    expect((await app().request("/relatorios/emissoes", post(payload))).status).toBe(403);
    expect((await app().request(`/relatorios/emissoes/${id}/csv`)).status).toBe(403);
    expect(m.emitir).not.toHaveBeenCalled(); expect(m.csv).not.toHaveBeenCalled();
    expect((await app(["exportar"]).request("/relatorios/emissoes", post(payload))).status).toBe(201);
    expect(m.emitir).toHaveBeenCalledWith({ ...payload, propriedadeId: 7, incluirValores: false }, 5, false);
  });
  it("verValores isolado não basta sem área financeira e sítio vem do servidor", async () => {
    expect((await app(["exportar", "verValores"]).request("/relatorios/emissoes", post({ ...payload, incluirValores: true }))).status).toBe(403);
    expect(m.emitir).not.toHaveBeenCalled();
    expect((await app(["exportar", "verValores"], ["pecuaria", "financeiro"]).request("/relatorios/emissoes", post({ ...payload, incluirValores: true }))).status).toBe(201);
    expect(m.emitir).toHaveBeenCalledWith({ ...payload, propriedadeId: 7, incluirValores: true }, 5, true);
    expect(m.escrita).toHaveBeenCalledWith(expect.anything(), undefined);
  });
  it("reavalia acesso na abertura e no CSV, conserva cache privado e recusa consolidado", async () => {
    const consulta = await app().request(`/relatorios/emissoes/${id}`);
    expect(consulta.status).toBe(200); expect(consulta.headers.get("cache-control")).toBe("private, no-store"); expect(m.obter).toHaveBeenCalledWith(id, 7, false);
    expect((await app(["exportar"]).request(`/relatorios/emissoes/${id}/csv`)).status).toBe(200); expect(m.csv).toHaveBeenCalledWith(id, 7, false);
    m.leitura.mockResolvedValue(null); expect((await app().request("/relatorios/emissoes")).status).toBe(422);
  });
  it("rejeita intervalo inválido e parâmetros desconhecidos sem emitir", async () => {
    expect((await app(["exportar"]).request("/relatorios/emissoes", post({ ...payload, inicio: "2026-02-30" }))).status).toBe(422);
    expect((await app(["exportar"]).request("/relatorios/emissoes", post({ ...payload, lucro: true }))).status).toBe(422);
    expect(m.emitir).not.toHaveBeenCalled();
  });
});
