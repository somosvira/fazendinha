import type { UsuarioContexto } from "../../services/auth/sessao.js";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exigeArea } from "../../middleware/permissao.js";
import { uid } from "../../lib/uid.fixture.js";

const mocks = vi.hoisted(() => ({ animal: vi.fn(), detalhe: vi.fn(), listar: vi.fn(), leitura: vi.fn(), escrita: vi.fn(), fontes: vi.fn(), referencia: vi.fn(), resumo: vi.fn() }));
vi.mock("../../services/propriedade.js", async original => ({
  ...await original<typeof import("../../services/propriedade.js")>(), resolverEscopoLeitura: mocks.leitura, resolverEscopoEscrita: mocks.escrita,
}));
vi.mock("../../services/pecuaria/nutricao/consumo.js", async original => ({
  ...await original<typeof import("../../services/pecuaria/nutricao/consumo.js")>(),
  consumoAnimal: mocks.animal, detalheFechamento: mocks.detalhe, listarFechamentos: mocks.listar,
}));
vi.mock("../../services/pecuaria/leite/referencias.js", () => ({ listarReferenciasDisponiveis: mocks.fontes, revisarReferenciaLeite: mocks.referencia }));
vi.mock("../../services/pecuaria/nutricao/resumo.js", () => ({ consultarResumo: mocks.resumo }));
import { rebanhoRouter } from "./rebanho.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";

const usuario: Pick<UsuarioContexto, "id" | "dono" | "areas" | "flags" | "abas"> = { id: 7, dono: false, areas: ["pecuaria"], flags: [], abas: [] };
function app(u: typeof usuario | null = usuario) {
  return new Hono().use("*", async (c, next) => {
    if (u) c.set("usuario" as never, u as never);
    await next();
  }).use("*", exigeArea("pecuaria")).route("/", rebanhoRouter);
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.leitura.mockResolvedValue(2); mocks.escrita.mockResolvedValue(2); mocks.fontes.mockResolvedValue({itens:[]}); mocks.referencia.mockResolvedValue({versao:1});
  mocks.animal.mockResolvedValue({ verValores: true, itens: [{ custoConhecido: "0.00", itens: [{ custoConhecido: null }] }] });
  mocks.detalhe.mockResolvedValue({ verValores: true, custoConhecido: "12.50" });
  mocks.listar.mockResolvedValue({ itens: [], total: 0 });
  mocks.resumo.mockResolvedValue({ verValores: true, lotes: [] });
});

describe("custos nutricionais consultados por leitores da Pecuária", () => {
  it("libera o custo atribuído do animal no sítio resolvido, sem confundir zero e desconhecido", async () => {
    const r = await app().request(`/nutricao/consumo/animais/${uid(1)}`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ verValores: true, itens: [{ custoConhecido: "0.00", itens: [{ custoConhecido: null }] }] });
    expect(mocks.animal).toHaveBeenCalledWith(uid(1), 2, expect.any(Object), true, false);
    expect((await app().request(`/nutricao/consumo/fechamentos/${uid(2)}`)).status).toBe(200);
    expect(mocks.detalhe).toHaveBeenCalledWith(uid(2), 2, true, false);
    expect((await app().request("/nutricao/consumo/fechamentos")).status).toBe(200);
    expect(mocks.listar).toHaveBeenCalledWith(undefined, 2, expect.any(Object), true, undefined, undefined, { de: undefined, ate: undefined }, false);
  });

  it("mantém sessão, área e o isolamento de fatos de outro sítio", async () => {
    expect((await app(null).request(`/nutricao/consumo/animais/${uid(1)}`)).status).toBe(401);
    expect((await app({ ...usuario, areas: ["financeiro"] }).request(`/nutricao/consumo/animais/${uid(1)}`)).status).toBe(403);
    expect(mocks.animal).not.toHaveBeenCalled();
    mocks.animal.mockRejectedValue(new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado neste sítio"));
    expect((await app().request(`/nutricao/consumo/animais/${uid(1)}`)).status).toBe(404);
    expect(mocks.animal).toHaveBeenCalledWith(uid(1), 2, expect.any(Object), true, false);
  });
});

describe("preços referenciais leiteiros separados do custo operacional", () => {
 const comando = { chave: uid(8), propriedadeId: 1, fechamentoId: uid(9), versaoEsperada: 0, motivo: "Preço comprovado do mês" };
 const post = {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(comando)};
 it("nega preços a leitor pecuário e requer lançar para revisar mesmo com financeiro/verValores", async () => {
  expect((await app().request(`/nutricao/consumo/leite/${uid(1)}/referencias`)).status).toBe(403);
  expect((await app({...usuario,flags:["lancar"]}).request(`/nutricao/consumo/leite/${uid(1)}/referencia`,post)).status).toBe(403);
  const u = {...usuario,areas:["pecuaria","financeiro"],flags:["verValores"]};
  expect((await app(u).request(`/nutricao/consumo/leite/${uid(1)}/referencias`)).status).toBe(200);
  expect((await app(u).request(`/nutricao/consumo/leite/${uid(1)}/referencia`,post)).status).toBe(403);
  expect(mocks.referencia).not.toHaveBeenCalled();
 });
 it("autoriza comando com autoria e sítio resolvido, preservando período fechado como conflito", async () => {
  const u = {...usuario,areas:["pecuaria","financeiro"],flags:["verValores","lancar"]};
  expect((await app(u).request(`/nutricao/consumo/leite/${uid(1)}/referencia`,post)).status).toBe(200);
  expect(mocks.referencia).toHaveBeenCalledWith(uid(1),{...comando,propriedadeId:2},7);
 });
});


it("mantém gates distintos de custo e referência comercial no resumo por lote", async () => {
  expect((await app().request("/nutricao/resumo")).status).toBe(200);
  expect(mocks.resumo).toHaveBeenLastCalledWith(undefined, 2, true, false);
  const financeiro = { ...usuario, areas: ["pecuaria", "financeiro"], flags: ["verValores"] };
  expect((await app(financeiro).request(`/nutricao/resumo?loteId=${uid(5)}`)).status).toBe(200);
  expect(mocks.resumo).toHaveBeenLastCalledWith(uid(5), 2, true, true);
});
