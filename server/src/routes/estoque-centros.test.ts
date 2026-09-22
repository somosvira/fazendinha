import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  centroCustoFindMany: vi.fn(),
}));

vi.mock("../db.js", () => ({
  prisma: { centroCusto: { findMany: mocks.centroCustoFindMany } },
}));

import { estoqueCentrosRouter } from "./estoque-centros.js";

describe("GET /estoque/centros-atividade", () => {
  it("responde os ids de leite e café resolvidos num único findMany", async () => {
    mocks.centroCustoFindMany.mockResolvedValue([
      { id: 3, nome: "Atividade Leiteira" },
      { id: 5, nome: "Plantio Café" },
    ]);

    const res = await estoqueCentrosRouter.request("/estoque/centros-atividade");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ leite: 3, cafe: 5 });
    expect(mocks.centroCustoFindMany).toHaveBeenCalledTimes(1);
  });

  it("responde null para o que não existir cadastrado", async () => {
    mocks.centroCustoFindMany.mockResolvedValue([]);

    const res = await estoqueCentrosRouter.request("/estoque/centros-atividade");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ leite: null, cafe: null });
  });
});
