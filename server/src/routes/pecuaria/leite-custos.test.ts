import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ consultar: vi.fn(), resolver: vi.fn() }));
vi.mock("../../services/pecuaria/leite/custos.js", () => ({
  consultarCustosLeite: m.consultar,
}));
vi.mock("../../services/propriedade.js", async (original) => ({
  ...(await original<typeof import("../../services/propriedade.js")>()),
  resolverEscopoLeitura: m.resolver,
}));
import { leiteCustosRouter } from "./leite-custos.js";
function app(flags: string[], areas = ["pecuaria"]) {
  return new Hono()
    .use("*", async (c, next) => {
      c.set(
        "usuario" as never,
        { id: 7, dono: false, flags, areas, abas: [] } as never,
      );
      await next();
    })
    .route("/", leiteCustosRouter);
}
beforeEach(() => {
  vi.clearAllMocks();
  m.resolver.mockResolvedValue(2);
  m.consultar.mockResolvedValue({
    consolidado: { situacao: "OCULTO", custoPorLitro: null },
  });
});
const periodo = "inicio=2026-10-01&fim=2026-10-19";
it("autoriza exportação no servidor e mantém máscara financeira independente", async () => {
  expect((await app([]).request(`/exportacao?${periodo}`)).status).toBe(403);
  expect(m.consultar).not.toHaveBeenCalled();
  const r = await app(["exportar"]).request(`/exportacao?${periodo}`);
  expect(r.status).toBe(200);
  expect(m.consultar).toHaveBeenLastCalledWith(
    2,
    { inicio: "2026-10-01", fim: "2026-10-19" },
    false,
  );
  expect(await r.json()).toEqual({
    consolidado: { situacao: "OCULTO", custoPorLitro: null },
  });
  await app(["exportar", "verValores"], ["pecuaria", "financeiro"]).request(
    `/exportacao?${periodo}`,
  );
  expect(m.consultar).toHaveBeenLastCalledWith(2, expect.anything(), true);
});
it("consulta comum continua independente da permissão de exportar e exige sítio", async () => {
  expect((await app([]).request(`/?${periodo}`)).status).toBe(200);
  m.resolver.mockResolvedValue(null);
  expect((await app([]).request(`/?${periodo}`)).status).toBe(422);
  expect(
    (await app(["exportar"], ["financeiro"]).request(`/exportacao?${periodo}`))
      .status,
  ).toBe(403);
});
