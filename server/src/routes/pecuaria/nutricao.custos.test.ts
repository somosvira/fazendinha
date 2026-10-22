import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exigeArea } from "../../middleware/permissao.js";
import { uid } from "../../lib/uid.fixture.js";

const mocks = vi.hoisted(() => ({ animal: vi.fn(), detalhe: vi.fn(), listar: vi.fn(), leitura: vi.fn() }));
vi.mock("../../services/propriedade.js", async original => ({
  ...await original<typeof import("../../services/propriedade.js")>(), resolverEscopoLeitura: mocks.leitura,
}));
vi.mock("../../services/pecuaria/nutricao/consumo.js", async original => ({
  ...await original<typeof import("../../services/pecuaria/nutricao/consumo.js")>(),
  consumoAnimal: mocks.animal, detalheFechamento: mocks.detalhe, listarFechamentos: mocks.listar,
}));
import { rebanhoRouter } from "./rebanho.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";

const usuario = { id: 7, dono: false, areas: ["pecuaria"], flags: [], abas: [] };
function app(u: typeof usuario | null = usuario) {
  return new Hono().use("*", async (c, next) => {
    if (u) c.set("usuario" as never, u as never);
    await next();
  }).use("*", exigeArea("pecuaria")).route("/", rebanhoRouter);
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.leitura.mockResolvedValue(2);
  mocks.animal.mockResolvedValue({ verValores: true, itens: [{ custoConhecido: "0.00", itens: [{ custoConhecido: null }] }] });
  mocks.detalhe.mockResolvedValue({ verValores: true, custoConhecido: "12.50" });
  mocks.listar.mockResolvedValue({ itens: [], total: 0 });
});

describe("custos nutricionais consultados por leitores da Pecuária", () => {
  it("libera o custo atribuído do animal no sítio resolvido, sem confundir zero e desconhecido", async () => {
    const r = await app().request(`/nutricao/consumo/animais/${uid(1)}`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ verValores: true, itens: [{ custoConhecido: "0.00", itens: [{ custoConhecido: null }] }] });
    expect(mocks.animal).toHaveBeenCalledWith(uid(1), 2, expect.any(Object), true);
    expect((await app().request(`/nutricao/consumo/fechamentos/${uid(2)}`)).status).toBe(200);
    expect(mocks.detalhe).toHaveBeenCalledWith(uid(2), 2, true);
    expect((await app().request("/nutricao/consumo/fechamentos")).status).toBe(200);
    expect(mocks.listar).toHaveBeenCalledWith(undefined, 2, expect.any(Object), true, undefined, undefined, { de: undefined, ate: undefined });
  });

  it("mantém sessão, área e o isolamento de fatos de outro sítio", async () => {
    expect((await app(null).request(`/nutricao/consumo/animais/${uid(1)}`)).status).toBe(401);
    expect((await app({ ...usuario, areas: ["financeiro"] }).request(`/nutricao/consumo/animais/${uid(1)}`)).status).toBe(403);
    expect(mocks.animal).not.toHaveBeenCalled();
    mocks.animal.mockRejectedValue(new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado neste sítio"));
    expect((await app().request(`/nutricao/consumo/animais/${uid(1)}`)).status).toBe(404);
    expect(mocks.animal).toHaveBeenCalledWith(uid(1), 2, expect.any(Object), true);
  });
});
