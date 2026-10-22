import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ registrar: vi.fn(), listar: vi.fn(), leitura: vi.fn(), escrita: vi.fn() }));
vi.mock("../../services/pecuaria/leite/conferencias-saldo.js", () => ({ registrarConferenciaSaldoLeite: m.registrar, listarConferenciasSaldoLeite: m.listar }));
vi.mock("../../services/propriedade.js", async original => ({ ...await original<typeof import("../../services/propriedade.js")>(), resolverEscopoLeitura: m.leitura, resolverEscopoEscrita: m.escrita }));
import { leiteConferenciasSaldoRouter } from "./leite-conferencias-saldo.js";
const id = "00000000-0000-4000-8000-000000000001";
const payload = { chave: id, produtoId: id, data: "2026-10-01", litrosObservados: 0, referencia: "Régua final", responsavel: "José", versaoEsperada: 0 };
const post = (body: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const app = (lancar = false) => new Hono().use("*", async (c, next) => { c.set("usuario" as never, { id: 5, dono: false, areas: ["pecuaria"], flags: lancar ? ["lancar"] : [], abas: [] } as never); await next(); }).route("/", leiteConferenciasSaldoRouter);
beforeEach(() => { vi.resetAllMocks(); m.leitura.mockResolvedValue(7); m.escrita.mockResolvedValue(7); m.registrar.mockResolvedValue({ id, litrosObservados: 0 }); m.listar.mockResolvedValue({ itens: [] }); });
describe("rotas de observação física", () => {
  it("exige lançar, preserva zero e resolve sítio principal no servidor", async () => {
    expect((await app().request("/conferencias-saldo", post(payload))).status).toBe(403);
    expect((await app(true).request("/conferencias-saldo", post(payload))).status).toBe(201);
    expect(m.registrar).toHaveBeenCalledWith({ ...payload, propriedadeId: 7 }, 5);
  });
  it("recusa correção sem motivo e valor negativo, mantém consulta sem acesso a dinheiro", async () => {
    expect((await app(true).request("/conferencias-saldo", post({ ...payload, versaoEsperada: 1 }))).status).toBe(422);
    expect((await app(true).request("/conferencias-saldo", post({ ...payload, litrosObservados: -1 }))).status).toBe(422);
    expect((await app().request(`/conferencias-saldo?produtoId=${id}&data=2026-10-01`)).status).toBe(200);
    expect(m.listar).toHaveBeenCalledWith(7, { produtoId: id, data: "2026-10-01", pagina: 1 }); expect(m.registrar).not.toHaveBeenCalled();
  });
});
