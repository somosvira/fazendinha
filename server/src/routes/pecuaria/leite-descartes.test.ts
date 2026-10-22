import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ registrar: vi.fn(), estornar: vi.fn(), listar: vi.fn(), obter: vi.fn(), leitura: vi.fn(), escrita: vi.fn() }));
vi.mock("../../services/pecuaria/leite/descartes.js", () => ({ registrarDescarteLeite: m.registrar, estornarDescarteLeite: m.estornar, listarDescartesLeite: m.listar, obterDescarteLeite: m.obter }));
vi.mock("../../services/propriedade.js", async original => ({ ...await original<typeof import("../../services/propriedade.js")>(), resolverEscopoLeitura: m.leitura, resolverEscopoEscrita: m.escrita }));
import { leiteDescartesRouter } from "./leite-descartes.js";
const id = "00000000-0000-4000-8000-000000000001";
const payload = { chave: id, entradaId: id, data: "2026-10-01", quantidadeLitros: 3, quantidadeDisponivelEsperadaLitros: 10, motivo: "Descarte informado" };
const post = (body: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const app = (lancar = false) => new Hono().use("*", async (c, next) => { c.set("usuario" as never, { id: 5, dono: false, areas: ["pecuaria"], flags: lancar ? ["lancar"] : [], abas: [] } as never); await next(); }).route("/", leiteDescartesRouter);
beforeEach(() => { vi.resetAllMocks(); m.leitura.mockResolvedValue(7); m.escrita.mockResolvedValue(7); m.registrar.mockResolvedValue({ id }); });
describe("rotas de descarte físico", () => {
  it("exige lançar para descarte e estorno e resolve sítio principal omitido", async () => {
    expect((await app().request("/descartes", post(payload))).status).toBe(403);
    expect((await app().request(`/descartes/${id}/estorno`, post({}))).status).toBe(403);
    expect((await app(true).request("/descartes", post(payload))).status).toBe(201);
    expect(m.registrar).toHaveBeenCalledWith({ ...payload, propriedadeId: 7 }, 5); expect(m.escrita).toHaveBeenCalledWith(expect.anything(), undefined);
  });
  it("não aceita destinatário, zero, volume excedente ou estorno sem motivo/versão", async () => {
    for (const invalido of [{ ...payload, animalId: id }, { ...payload, quantidadeLitros: 0 }, { ...payload, quantidadeLitros: 11 }]) expect((await app(true).request("/descartes", post(invalido))).status).toBe(422);
    expect((await app(true).request(`/descartes/${id}/estorno`, post({ chave: id }))).status).toBe(422);
    expect(m.registrar).not.toHaveBeenCalled(); expect(m.estornar).not.toHaveBeenCalled();
  });
});
