import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ registrar: vi.fn(), estornar: vi.fn(), listar: vi.fn(), consultar: vi.fn(), origens: vi.fn(), candidatos: vi.fn(), crias: vi.fn(), leitura: vi.fn(), escrita: vi.fn() }));
vi.mock("../../services/pecuaria/leite/destinos.js", () => ({ registrarDestinoInterno: mocks.registrar, estornarDestinoInterno: mocks.estornar, listarDestinos: mocks.listar, consultarDestino: mocks.consultar, listarOrigensDestino: mocks.origens, listarDestinatarios: mocks.candidatos, listarCriasDestino: mocks.crias }));
vi.mock("../../services/propriedade.js", async original => ({ ...await original<typeof import("../../services/propriedade.js")>(), resolverEscopoLeitura: mocks.leitura, resolverEscopoEscrita: mocks.escrita }));
import { leiteDestinosRouter } from "./leite-destinos.js";
import { FinanceiroError } from "../../services/financeiro/regras.js";
const uid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const payload = { chave: uid(1), propriedadeId: 2, entradaId: uid(2), data: "2026-10-01", natureza: "LEITE_COMUM", declaracaoOrigem: "Leite informado para alimentação interna", quantidadeDisponivelEsperadaLitros: 10, parcelas: [{ animalId: uid(3), quantidadeLitros: 3 }, { animalId: uid(4), quantidadeLitros: 4 }] };
const app = (lancar = false, area = true, autenticado = true) => new Hono().use("*", async (c, next) => {
  if (autenticado) c.set("usuario" as never, { id: 7, dono: false, areas: area ? ["pecuaria"] : ["financeiro"], flags: lancar ? ["lancar"] : [], abas: [] } as never); await next();
}).route("/", leiteDestinosRouter);
const post = (body: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); mocks.leitura.mockResolvedValue(2); mocks.escrita.mockResolvedValue(2); mocks.registrar.mockResolvedValue({ id: uid(9), quantidadeLitros: 7, saldoOrigemDepois: 3 }); mocks.listar.mockResolvedValue({ itens: [], total: 0 }); mocks.origens.mockResolvedValue({ itens: [] }); });
describe("rotas de destino interno", () => {
  it("exige sessão, área pecuária e lançamento para efeitos físicos", async () => {
    expect((await app(false, true, false).request("/destinos")).status).toBe(401);
    expect((await app(true, false).request("/destinos", post(payload))).status).toBe(403);
    expect((await app().request("/destinos", post(payload))).status).toBe(403);
    expect((await app().request(`/destinos/${uid(9)}/estorno`, post({}))).status).toBe(403);
    expect(mocks.registrar).not.toHaveBeenCalled(); expect(mocks.estornar).not.toHaveBeenCalled();
  });
  it("preserva parcelas e natureza com autoria e sítio resolvidos no servidor", async () => {
    const resposta = await app(true).request("/destinos", post(payload));
    expect(resposta.status).toBe(201); expect(await resposta.json()).toMatchObject({ quantidadeLitros: 7, saldoOrigemDepois: 3 });
    expect(mocks.registrar).toHaveBeenCalledWith(payload, 7);
    expect(mocks.escrita).toHaveBeenCalledWith(expect.anything(), 2);
  });
  it("valida quantidades, datas e colostro sem inventar cria", async () => {
    expect((await app(true).request("/destinos", post({ ...payload, natureza: "COLOSTRO" }))).status).toBe(422);
    expect((await app(true).request("/destinos", post({ ...payload, data: "2026-02-30" }))).status).toBe(422);
    expect((await app(true).request("/destinos", post({ ...payload, parcelas: [{ animalId: uid(3), quantidadeLitros: 11 }] }))).status).toBe(422);
    expect(mocks.registrar).not.toHaveBeenCalled();
  });
  it("consulta origens e histórico apenas no sítio, recusando consolidado", async () => {
    mocks.candidatos.mockResolvedValue({ itens: [{ animalId: uid(3), sexo: "M", criaId: null }], total: 1 });
    expect((await app().request("/destinos/candidatos?data=2026-10-01&busca=Bezerro&pagina=2")).status).toBe(200);
    expect(mocks.candidatos).toHaveBeenCalledWith(2, "2026-10-01", "Bezerro", 2);
    mocks.crias.mockResolvedValue({ itens: [], total: 0 });
    expect((await app().request("/destinos/crias?data=2026-10-01&busca=S3")).status).toBe(200);
    expect(mocks.crias).toHaveBeenCalledWith(2, "2026-10-01", "S3", 1);
    expect((await app().request(`/destinos/origens?produtoId=${uid(5)}&data=2026-10-01`)).status).toBe(200);
    expect(mocks.origens).toHaveBeenCalledWith(2, uid(5), "2026-10-01");
    expect((await app().request("/destinos?pagina=2")).status).toBe(200);
    expect(mocks.listar).toHaveBeenCalledWith(2, { pagina: 2 });
    mocks.leitura.mockResolvedValue(null);
    expect((await app().request("/destinos")).status).toBe(422);
  });
  it("traduz período fechado em conflito e exige versão/motivo no estorno", async () => {
    mocks.registrar.mockRejectedValue(new FinanceiroError("PERIODO_FECHADO", "Período fechado"));
    expect((await app(true).request("/destinos", post(payload))).status).toBe(409);
    expect((await app(true).request(`/destinos/${uid(9)}/estorno`, post({ chave: uid(6), propriedadeId: 2 }))).status).toBe(422);
  });
});
