import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { UsuarioContexto } from "../../services/auth/sessao.js";
import { nutricaoRouter } from "./nutricao.js";
const mocks = vi.hoisted(() => ({ resumo: vi.fn(), leitura: vi.fn(), listar: vi.fn(), dietas: vi.fn() }));
vi.mock("../../services/pecuaria/nutricao/dietas.js", () => ({ listarDietas: mocks.dietas }));
vi.mock("../../services/pecuaria/nutricao/resumo.js", () => ({ consultarResumo: mocks.resumo }));
vi.mock("../../services/pecuaria/nutricao/consumo.js", () => ({ listarFechamentos: mocks.listar }));
vi.mock("../../services/propriedade.js", () => ({ resolverEscopoLeitura: mocks.leitura, resolverEscopoEscrita: vi.fn() }));
function app(p: Partial<UsuarioContexto> = {}) {
  const u: UsuarioContexto = { id: 1, nome: "Consulta", email: "consulta@example.test", papel: "consulta", abas: [], areas: ["pecuaria"], flags: [], status: "ATIVO", dono: false, ...p };
  return new Hono().use("*", async (c, next) => { c.set("usuario" as never, u as never); await next(); }).route("/", nutricaoRouter);
}
beforeEach(() => { vi.clearAllMocks(); mocks.leitura.mockResolvedValue(7); mocks.resumo.mockResolvedValue({ lotes: [], verValores: false }); mocks.listar.mockResolvedValue({ itens: [], total: 0 }); });
describe("leitura resumida da nutrição", () => {
  it("resolve o escopo dos lotes em uso das receitas no servidor", async () => {
    mocks.dietas.mockResolvedValue([]);
    expect((await app().request("/dietas")).status).toBe(200);
    expect(mocks.dietas).toHaveBeenCalledWith(7);
  });
  it.each([
    { areas: ["pecuaria"] as UsuarioContexto["areas"], flags: ["verValores"] as UsuarioContexto["flags"], permitido: false },
    { areas: ["pecuaria", "financeiro"] as UsuarioContexto["areas"], flags: [] as UsuarioContexto["flags"], permitido: false },
    { areas: ["pecuaria", "financeiro"] as UsuarioContexto["areas"], flags: ["verValores"] as UsuarioContexto["flags"], permitido: true },
  ])("resolve sítio e visibilidade no servidor: $permitido", async ({ areas, flags, permitido }) => {
    expect((await app({ areas, flags }).request("/resumo")).status).toBe(200);
    expect(mocks.resumo).toHaveBeenCalledWith(undefined, 7, true);
  });
  it("valida lote e situação antes de consultar e entrega paginação ao serviço", async () => {
    expect((await app().request("/resumo?loteId=invalido")).status).toBe(422);
    expect(mocks.resumo).not.toHaveBeenCalled();
    expect((await app().request("/consumo/fechamentos?status=INVALIDO")).status).toBe(422);
    expect(mocks.listar).not.toHaveBeenCalled();
    expect((await app().request("/consumo/fechamentos?status=ESTORNADO&pagina=3&limite=10")).status).toBe(200);
    expect(mocks.listar).toHaveBeenCalledWith(undefined, 7, { pagina: 3, limite: 10 }, true, undefined, "ESTORNADO", { de: undefined, ate: undefined });
  });
});

it("valida datas reais e encaminha o intervalo dos fechamentos sem perder o escopo", async () => {
  expect((await app().request("/consumo/fechamentos?de=2026-02-30")).status).toBe(422);
  expect((await app().request("/consumo/fechamentos?de=2026-10-31&ate=2026-10-01")).status).toBe(422);
  expect(mocks.listar).not.toHaveBeenCalled();
  expect((await app().request("/consumo/fechamentos?de=2026-10-01&ate=2026-10-31")).status).toBe(200);
  expect(mocks.listar).toHaveBeenCalledWith(undefined,7,expect.any(Object),true,undefined,undefined,{de:"2026-10-01",ate:"2026-10-31"});
});
