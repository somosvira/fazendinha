import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uid } from "../../lib/uid.fixture.js";
const mocks = vi.hoisted(() => ({ leitura: vi.fn(), visao: vi.fn(), resumo: vi.fn(), vigencia: vi.fn(), fechamentos: vi.fn() }));
vi.mock("../../services/propriedade.js", async original => ({ ...await original<typeof import("../../services/propriedade.js")>(), resolverEscopoLeitura: mocks.leitura }));
vi.mock("../../services/pecuaria/nutricao/consultas.js", () => ({ visaoGeral: mocks.visao, resumoLote: mocks.resumo }));
vi.mock("../../services/pecuaria/nutricao/dietas.js", async original => ({ ...await original<typeof import("../../services/pecuaria/nutricao/dietas.js")>(), obterVigencia: mocks.vigencia }));
vi.mock("../../services/pecuaria/nutricao/consumo.js", async original => ({ ...await original<typeof import("../../services/pecuaria/nutricao/consumo.js")>(), listarFechamentos: mocks.fechamentos }));
import { nutricaoRouter } from "./nutricao.js";
import { PropriedadeError } from "../../services/propriedade.js";
const app = (areas = ["pecuaria"], flags: string[] = []) => new Hono().use("*", async (c, next) => { c.set("usuario" as never, { id: 7, dono: false, areas, flags, abas: [] } as never); await next(); }).route("/", nutricaoRouter);
beforeEach(() => { vi.resetAllMocks(); mocks.leitura.mockResolvedValue(2); mocks.visao.mockResolvedValue({ lotes: [], verValores: false }); mocks.resumo.mockResolvedValue({ custos: {} }); mocks.vigencia.mockResolvedValue({}); mocks.fechamentos.mockResolvedValue({ itens: [], total: 0, pagina: 1, limite: 25 }); });
describe("leituras do redesign de Nutrição", () => {
  it.each([[[], false], [["verValores"], false]])("não concede valores só pelo flag financeiro: %s", async (flags, permitido) => {
    expect((await app(["pecuaria"], flags).request("/visao-geral")).status).toBe(200);
    expect(mocks.visao).toHaveBeenCalledWith(2, permitido);
    expect((await app(["pecuaria"], flags).request(`/lotes/${uid(1)}/resumo`)).status).toBe(200);
    expect(mocks.resumo).toHaveBeenCalledWith(uid(1), 2, permitido);
  });
  it("exige área e flag financeiros e mantém escopo consolidado", async () => {
    mocks.leitura.mockResolvedValue(null);
    await app(["pecuaria", "financeiro"], ["verValores"]).request("/visao-geral");
    expect(mocks.visao).toHaveBeenCalledWith(null, true);
    await app(["pecuaria", "financeiro"]).request(`/lotes/${uid(1)}/resumo`);
    expect(mocks.resumo).toHaveBeenCalledWith(uid(1), null, false);
  });
  it("filtra situação no servidor sem exigir lote e mantém paginação", async () => {
    const resposta = await app().request("/consumo/fechamentos?status=ESTORNADO&pagina=3");
    expect(resposta.status).toBe(200);
    expect(mocks.fechamentos).toHaveBeenCalledWith(undefined, 2, { pagina: 3, limite: 25 }, false, undefined, "ESTORNADO");
  });
  it("valida UUID, status e escopo antes da consulta", async () => {
    expect((await app().request("/lotes/invalido/resumo")).status).toBe(422);
    expect((await app().request("/vigencias/invalido")).status).toBe(422);
    expect((await app().request("/consumo/fechamentos?status=INVALIDO")).status).toBe(422);
    expect(mocks.resumo).not.toHaveBeenCalled(); expect(mocks.fechamentos).not.toHaveBeenCalled();
    mocks.leitura.mockRejectedValue(new PropriedadeError("ESCOPO_INVALIDO", "Sítio inválido"));
    expect((await app().request("/visao-geral")).status).toBe(400); expect(mocks.visao).not.toHaveBeenCalled();
  });
});
