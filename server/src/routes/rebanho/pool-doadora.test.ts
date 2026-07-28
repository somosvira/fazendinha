import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ criar: vi.fn(), aplicar: vi.fn(), escrita: vi.fn() }));
vi.mock("../../services/rebanho/pool-doadora.js", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../services/rebanho/pool-doadora.js")>()), criarGrupoPool: mocks.criar, aplicarPool: mocks.aplicar }));
vi.mock("../../services/propriedade.js", () => ({ resolverEscopoEscrita: mocks.escrita, resolverEscopoLeitura: vi.fn() }));
import { PoolDoadoraError } from "../../services/rebanho/pool-doadora.js";
import { poolDoadoraRouter } from "./pool-doadora.js";
beforeEach(() => { vi.clearAllMocks(); mocks.escrita.mockResolvedValue(7); mocks.criar.mockResolvedValue({ id: 5 }); });
describe("rotas de pool de doadoras", () => {
  it("cria grupo com escopo de escrita", async () => {
    const res = await poolDoadoraRouter.request("/rebanho/fiv/pools", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nome: "Elite", doadoraIds: [31] }) });
    expect(res.status).toBe(201); expect(mocks.criar).toHaveBeenCalledWith({ nome: "Elite", doadoraIds: [31] }, 7);
  });
  it("mapeia aplicação repetida para 409", async () => {
    mocks.aplicar.mockRejectedValue(new PoolDoadoraError("CONFLITO", "pool já aplicado nesta data"));
    const res = await poolDoadoraRouter.request("/rebanho/fiv/pools/5/aplicar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: "2026-07-27" }) });
    expect(res.status).toBe(409);
  });
});
