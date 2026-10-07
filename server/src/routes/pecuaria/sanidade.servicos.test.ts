import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uid } from "../../lib/uid.fixture.js";

const mocks = vi.hoisted(() => ({ leitura: vi.fn(), escrita: vi.fn(), listar: vi.fn(), confirmar: vi.fn() }));
vi.mock("../../services/propriedade.js", () => ({ resolverEscopoLeitura: mocks.leitura, resolverEscopoEscrita: mocks.escrita }));
vi.mock("../../services/pecuaria/sanidade/servicos.js", () => ({ listarProcedimentosServico: mocks.listar, confirmarProcedimentosServico: mocks.confirmar }));
import { sanidadeRouter } from "./sanidade.js";

const criarApp = (areas = ["pecuaria", "financeiro"], flags = ["lancar"]) => new Hono()
  .use("*", async (c, next) => { c.set("usuario" as never, { id: 7, dono: false, areas, flags, abas: [] } as never); await next(); })
  .route("/", sanidadeRouter);
const payload = { propriedadeId: 2, chaveIdempotencia: uid(4), motivo: "Procedimentos do atendimento", itens: [{ id: uid(2), tipo: "EXAME" }] };
const enviar = (app: Hono, body: unknown = payload) => app.request(`/servicos/${uid(1)}/procedimentos`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks(); mocks.escrita.mockResolvedValue(2); mocks.leitura.mockResolvedValue(2);
  mocks.confirmar.mockResolvedValue({ salvo: true, servicoId: uid(1), quantidade: 1, reenvio: false });
  mocks.listar.mockResolvedValue({ servico: { valorConfirmado: null }, itens: [], total: 0, pagina: 1, limite: 20 });
});

describe("procedimentos vinculados a Serviços — permissões e contrato", () => {
  it("permite consultar sem valores e encaminha máscara financeira", async () => {
    const res = await criarApp().request(`/servicos/${uid(1)}/procedimentos?propriedadeId=2&animalBusca=GV3-S2&grupo=ELEGIVEIS`);
    expect(res.status).toBe(200);
    expect(mocks.listar).toHaveBeenCalledWith(uid(1), 2, expect.objectContaining({ animalBusca: "GV3-S2", grupo: "ELEGIVEIS" }), false);
  });
  it("permite vincular sem atribuir custos para usuário lançador sem valores", async () => {
    expect((await enviar(criarApp())).status).toBe(200);
    expect(mocks.confirmar).toHaveBeenCalledWith({ ...payload, servicoId: uid(1) }, 7, false);
  });
  it.each(["0", "10", null])("não permite atribuir nem retirar valor %s sem permissão", async (valor) => {
    const res = await enviar(criarApp(), { ...payload, itens: [{ ...payload.itens[0], valor }] });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "SEM_PERMISSAO", campo: "itens" });
    expect(mocks.confirmar).not.toHaveBeenCalled();
  });
  it("preserva zero explícito quando há permissão financeira", async () => {
    const body = { ...payload, itens: [{ ...payload.itens[0], valor: "0" }] };
    expect((await enviar(criarApp(["pecuaria", "financeiro"], ["lancar", "verValores"]), body)).status).toBe(200);
    expect(mocks.confirmar).toHaveBeenCalledWith({ ...body, servicoId: uid(1) }, 7, true);
  });
  it.each([["pecuaria"], ["financeiro"]])("exige as duas áreas, não apenas %s", async (area) => {
    const app = criarApp([area]);
    expect((await enviar(app)).status).toBe(403);
    expect((await app.request(`/servicos/${uid(1)}/procedimentos?propriedadeId=2`)).status).toBe(403);
    expect(mocks.confirmar).not.toHaveBeenCalled(); expect(mocks.listar).not.toHaveBeenCalled();
  });
  it("somente leitura consulta mas não confirma", async () => {
    const app = criarApp(["pecuaria", "financeiro"], []);
    expect((await app.request(`/servicos/${uid(1)}/procedimentos?propriedadeId=2`)).status).toBe(200);
    expect((await enviar(app)).status).toBe(403);
  });
  it("recusa Serviço divergente e linhas repetidas sem chamar confirmação", async () => {
    expect((await enviar(criarApp(), { ...payload, servicoId: uid(5) })).status).toBe(422);
    const repetido = await enviar(criarApp(), { ...payload, itens: [payload.itens[0], payload.itens[0]] });
    expect(repetido.status).toBe(422);
    expect(await repetido.json()).toMatchObject({ campo: "itens" });
    expect(mocks.confirmar).not.toHaveBeenCalled();
  });
});
